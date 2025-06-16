const { getWitService } = require("./wit-service");
const { getEventsService, EVENT_TYPES } = require("./events-service");
const AudioInputStream = require("../utils/audio-input-stream");

let audioService = null;

/**
 * Audio recording service for Electron
 * Handles microphone access without permission prompts
 */
class AudioService {
    constructor() {
        this.recording = false;
        
        this.chunks = [];
        this.sampleRate = 16000;
        this.audioStream = null;
        this.streamActive = false;
        this.currentWitConversation = null;
        this.recordingTimeout = null;
        
        // Services
        this.eventsService = null;
        this.witService = null;
        
        // Debug tracking
        this.processedChunks = 0;
    }

    /**
     * Initialize the audio service
     */
    async initialize() {
        this.witService = await getWitService();
        this.eventsService = await getEventsService();

        // Listen for events from the central event service
        this.eventsService.on(EVENT_TYPES.PROCESSING_REQUEST, () => {
            this.stopRecording();
        });

        this.eventsService.on(EVENT_TYPES.START_LISTENING, () => {
            this.startRecording();
        });

        this.eventsService.on(EVENT_TYPES.STOP_LISTENING, () => {
            this.stopRecording();
        });

        // Listen for audio data from renderer
        this.eventsService.on(EVENT_TYPES.AUDIO_DATA_RECEIVED, (data) => {
            this.processAudioData(data.data, data.sampleRate);
        });

        console.log("AudioService: All event listeners set up");
    }

    /**
     * Start recording from microphone and stream to Wit.ai
     * @returns {Boolean} Success status
     */
    async startRecording() {
        if (this.recording) {
            console.log("AudioService: Already recording");
            return true;
        }

        console.log("AudioService: Starting recording");

        try {
            // Reset state
            this.recording = true;
            this.chunks = [];
            this.processedChunks = 0;

            // Create new audio stream
            this.audioStream = new AudioInputStream();
            this.streamActive = true;

            // Start Wit.ai conversation
            this.currentWitConversation = this.witService.startConversation(this.audioStream);

            return true;
        } catch (error) {
            console.error("Error starting recording:", error);
            this.eventsService.reportError(error);
            this.recording = false;
            this.streamActive = false;
            return false;
        }
    }

    /**
     * Stop recording and end Wit.ai conversation
     * @returns {Boolean} Success status
     */
    async stopRecording() {
        console.log("AudioService: Stopping recording");

        if (!this.recording) {
            return true;
        }

        try {
            // Set recording flag to false first
            this.recording = false;

            // Clear any recording timeout if set
            if (this.recordingTimeout) {
                clearTimeout(this.recordingTimeout);
                this.recordingTimeout = null;
            }

            // End the audio stream properly
            if (this.audioStream) {
                console.log(`Processed ${this.processedChunks} audio chunks before stopping`);
                
                // End the stream - our improved end() method will handle flushing the buffer
                this.audioStream.end();

                // Small delay to ensure the stream end signal has been sent
                await new Promise((resolve) => setTimeout(resolve, 100));

                // Only set streamActive to false after ending the stream
                this.streamActive = false;
                this.audioStream = null;
            } else {
                this.streamActive = false;
            }

            // Wait for Wit.ai conversation to complete
            if (this.currentWitConversation) {
                try {
                    await this.currentWitConversation;
                    this.currentWitConversation = null;
                } catch (error) {
                    console.error("Error completing Wit.ai conversation:", error);
                    this.eventsService.reportError(error);
                    this.currentWitConversation = null;
                }
            }

            return true;
        } catch (error) {
            console.error("Error stopping recording:", error);
            this.eventsService.reportError(error);
            // Ensure flags are reset even on error
            this.recording = false;
            this.streamActive = false;
            return false;
        }
    }

    /**
     * Process audio data received from renderer
     * @param {Int16Array|Float32Array|Array|Buffer} audioData - PCM audio data
     * @param {Number} sampleRate - Sample rate of audio
     */
    processAudioData(audioData, sampleRate) {
        // Check if recording is active
        if (!this.recording || !this.streamActive) {
            return;
        }

        try {
            // Check if the provided sample rate matches our expected rate
            if (sampleRate !== this.sampleRate) {
                console.warn(`Sample rate mismatch: expected ${this.sampleRate}, got ${sampleRate}`);
            }

            // Handle different types of audio data
            let processedData;

            if (Buffer.isBuffer(audioData)) {
                // For direct Buffer input, make a copy to ensure we don't modify the original
                processedData = Buffer.from(audioData);
            } else if (audioData instanceof Uint8Array) {
                // For Uint8Array, create a Buffer view of the underlying data
                processedData = Buffer.from(
                    audioData.buffer,
                    audioData.byteOffset,
                    audioData.byteLength
                );
            } else if (audioData instanceof Int16Array) {
                // For Int16Array, create a Buffer view of the underlying data
                processedData = Buffer.from(
                    audioData.buffer,
                    audioData.byteOffset,
                    audioData.byteLength
                );
            } else if (audioData instanceof Float32Array) {
                // Convert Float32Array to Int16LE Buffer
                processedData = Buffer.alloc(audioData.length * 2);
                for (let i = 0; i < audioData.length; i++) {
                    const sample = Math.max(-1, Math.min(1, audioData[i]));
                    // Use proper scaling factor and floor for consistent integer values
                    const value =
                        sample < 0
                            ? Math.floor(sample * 0x8000)
                            : Math.floor(sample * 0x7fff);
                    processedData.writeInt16LE(value, i * 2);
                }
            } else if (Array.isArray(audioData)) {
                // If array is sent from the renderer, it might be a serialized typed array
                // Convert to Int16Array first to ensure proper handling
                const intArray = new Int16Array(audioData);
                processedData = Buffer.alloc(intArray.length * 2);
                for (let i = 0; i < intArray.length; i++) {
                    processedData.writeInt16LE(intArray[i], i * 2);
                }
            } else {
                throw new Error("Unsupported audio data format");
            }

            // Stream the data immediately through the AudioInputStream
            if (this.audioStream) {
                this.audioStream.write(processedData);
                this.processedChunks++;
                
                // Log every 50 chunks for debugging
                if (this.processedChunks % 50 === 0) {
                    console.log(`Processed ${this.processedChunks} audio chunks so far`);
                }
            }

            // Store chunk for potential file saving
            this.chunks.push(processedData);
        } catch (error) {
            console.error("Error processing audio data:", error);
            this.eventsService.reportError(error);
        }
    }
}

async function getAudioService() {
    if (!audioService) {
        audioService = new AudioService();
        await audioService.initialize();
    }
    return audioService;
}

module.exports = { getAudioService };
