const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const getWitService = require("./wit-service");
const { getMainWindow } = require("../windows/main-window");

let audioService = null;

/**
 * Custom audio stream for Wit.ai
 */
class AudioInputStream extends Readable {
    constructor(options = {}) {
        // Set highWaterMark to control backpressure - increase for better streaming
        super({
            ...options,
            highWaterMark: 32768, // 32KB chunks - larger buffer for smoother streaming
            objectMode: false, // Binary mode for audio data
        });
        this.ended = false;
        this.buffer = [];
        this.isReading = false;
        this.totalBytesRead = 0;
        this.totalBytesWritten = 0;
    }

    _read(size) {
        // If we're already processing a read, wait
        if (this.isReading) return;

        this.isReading = true;

        try {
            // Process any buffered chunks
            while (this.buffer.length > 0) {
                const chunk = this.buffer.shift();
                // If push() returns false, stop reading
                const pushResult = this.push(chunk);
                this.totalBytesRead += chunk.length;

                if (!pushResult) {
                    this.isReading = false;
                    return;
                }
            }

            // No more buffered chunks, allow new writes
            this.isReading = false;

            // If ended and no more chunks, end the stream
            if (this.ended && this.buffer.length === 0) {
                this.push(null);
            }
        } catch (error) {
            this.isReading = false;
            console.error("Error in AudioInputStream._read:", error);
            this.emit("error", error);
        }
    }

    /**
     * Write audio data to the stream
     * @param {Buffer} chunk - Audio data chunk
     * @returns {Boolean} - Whether the write was successful
     */
    write(chunk) {
        if (this.ended) {
            return false;
        }

        try {
            if (!chunk || chunk.length === 0) {
                return true; // Return true to not indicate backpressure
            }

            // Ensure chunk is a Buffer
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            this.totalBytesWritten += buffer.length;

            // If we're actively reading, push directly
            if (this.isReading) {
                const result = this.push(buffer);
                this.totalBytesRead += buffer.length;
                return result;
            }

            // Otherwise buffer the chunk
            this.buffer.push(buffer);

            // If buffer is getting too large, trigger a read
            if (this.buffer.length > 10) {
                setImmediate(() => this._read(buffer.length));
            }

            return true;
        } catch (error) {
            console.error("Error in AudioInputStream.write:", error);
            this.emit("error", error);
            return false;
        }
    }

    /**
     * End the stream
     */
    end() {
        if (!this.ended) {
            this.ended = true;

            // Process any remaining buffered chunks immediately
            if (this.buffer.length > 0) {
                // Create a copy of the buffer to avoid modification during iteration
                const remainingChunks = [...this.buffer];
                this.buffer = [];

                // Push all remaining chunks
                for (const chunk of remainingChunks) {
                    this.push(chunk);
                }

                // Give time for the chunks to be processed before sending end signal
                setImmediate(() => {
                    this.push(null);
                });
            } else {
                // No remaining chunks, can end immediately
                this.push(null);
            }
        }
    }
}

/**
 * Audio recording service for Electron
 * Handles microphone access without permission prompts
 */
class AudioService {
    constructor(listener) {
        this.recording = false;
        this.witService = null;
        this.chunks = [];
        this.listener = listener;
        this.sampleRate = 16000;
        this.audioStream = null;
        this.streamActive = false;
        this.currentWitConversation = null;
        this.recordingTimeout = null;
        this.mainWindow = null;
    }

    /**
     * Initialize the audio service
     */
    async initialize() {
        try {
            this.witService = await getWitService();

            if (this.witService) {
                console.log("AudioService: Setting up wit-service listeners");

                this.witService.on("full-response", (response) => {
                    this.notifyListener({
                        type: "final-response",
                        data: response,
                    });
                });

                // Handle streaming MP3 audio chunks
                this.witService.on("audio-chunk", (audioData) => {
                    this.notifyListener({
                        type: "audio-chunk",
                        data: {
                            chunk: audioData.chunk,
                            totalBytes: audioData.totalBytes,
                            contentType: "audio/mpeg",
                            isMP3: true,
                        },
                    });
                });

                // Handle end of MP3 audio stream
                this.witService.on("audio-stream-end", (streamInfo) => {
                    console.log(
                        "AudioService: Received audio-stream-end from wit-service"
                    );
                    this.notifyListener({
                        type: "audio-stream-end",
                        data: {
                            ...streamInfo,
                            contentType: "audio/mpeg",
                            isMP3: true,
                        },
                    });
                });

                // Handle error responses
                this.witService.on("error", (error) => {
                    console.error("AudioService: Wit.ai error:", error);
                    this.notifyListener({
                        type: "error",
                        error: error.message || "Unknown Wit.ai error",
                    });
                });

                console.log("AudioService: All wit-service listeners set up");
            }
        } catch (error) {
            console.error("Failed to initialize Wit.ai service:", error);
        }
    }

    /**
     * Start recording from microphone and stream to Wit.ai
     * @returns {Boolean} Success status
     */
    async startRecording(mainWindow) {
        if (this.recording) {
            return true;
        }

        this.mainWindow = mainWindow;

        try {
            // Reset state
            this.recording = true;
            this.chunks = [];

            // Create new audio stream
            this.audioStream = new AudioInputStream();
            this.streamActive = true;

            // Start Wit.ai conversation if service is available
            if (this.witService) {
                try {
                    // Pass the audio stream to Wit.ai
                    this.currentWitConversation =
                        this.witService.startConversation(this.audioStream);
                } catch (error) {
                    console.error("Error starting Wit.ai conversation:", error);
                    // Don't stop recording if Wit.ai fails, we can still save the audio
                }
            } else {
                console.warn("Wit.ai service not initialized");
            }

            // Use the main window's webContents to start recording
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send("start-audio-capture");
                return true;
            }

            return false;
        } catch (error) {
            console.error("Error starting recording:", error);
            this.recording = false;
            this.streamActive = false;
            return false;
        }
    }

    /**
     * Stop recording and end Wit.ai conversation
     * @returns {Boolean} Success status
     */
    async stopRecording(mainWindow) {
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
                    const result = await this.currentWitConversation;
                    this.currentWitConversation = null;
                } catch (error) {
                    console.error(
                        "Error completing Wit.ai conversation:",
                        error
                    );
                    this.currentWitConversation = null;
                }
            }

            // Tell renderer to stop recording
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send("stop-audio-capture");
            }

            return true;
        } catch (error) {
            console.error("Error stopping recording:", error);
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
                console.warn(
                    `Sample rate mismatch: expected ${this.sampleRate}, got ${sampleRate}`
                );
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
            }

            // Store chunk for potential file saving
            this.chunks.push(processedData);
        } catch (error) {
            console.error("Error processing audio data:", error);
        }
    }

    /**
     * Get the active audio stream
     * @returns {Readable|null} The audio input stream if active, null otherwise
     */
    getAudioStream() {
        return this.streamActive ? this.audioStream : null;
    }

    /**
     * Save recorded audio to a WAV file
     * @param {String} filename - Optional filename to save to
     * @returns {String} Path to saved file
     */
    saveRecordingToFile(filename = null) {
        if (this.chunks.length === 0) {
            return null;
        }

        try {
            // Generate filename if not provided
            if (!filename) {
                const timestamp = new Date()
                    .toISOString()
                    .replace(/[:.]/g, "-");
                filename = `recording-${timestamp}.wav`;
            }

            // Ensure directory exists
            const userDataPath = app.getPath("userData");
            const recordingsDir = path.join(userDataPath, "recordings");
            if (!fs.existsSync(recordingsDir)) {
                fs.mkdirSync(recordingsDir, { recursive: true });
            }

            const filePath = path.join(recordingsDir, filename);

            // Calculate total length in bytes
            let totalLength = 0;
            for (const chunk of this.chunks) {
                totalLength += chunk.length;
            }

            // Create WAV file
            const buffer = this.createWavFile(totalLength);

            // Write to file
            fs.writeFileSync(filePath, buffer);

            return filePath;
        } catch (error) {
            return null;
        }
    }

    /**
     * Create a WAV file buffer from the recorded audio chunks
     * @param {Number} totalLength - Total number of bytes in all chunks
     * @returns {Buffer} WAV file buffer
     */
    createWavFile(totalLength) {
        // WAV file header size
        const headerLength = 44;

        // Calculate actual data size (total bytes in chunks)
        const dataSize = totalLength;

        // Create buffer for the entire WAV file
        const buffer = Buffer.alloc(headerLength + dataSize);

        // Write WAV header
        // RIFF header
        buffer.write("RIFF", 0);
        // File size (data size + 36)
        buffer.writeUInt32LE(36 + dataSize, 4);
        // WAVE header
        buffer.write("WAVE", 8);
        // Format chunk marker
        buffer.write("fmt ", 12);
        // Format chunk length
        buffer.writeUInt32LE(16, 16);
        // Sample format (1 = PCM)
        buffer.writeUInt16LE(1, 20);
        // Channels (1 = mono)
        buffer.writeUInt16LE(1, 22);
        // Sample rate
        buffer.writeUInt32LE(this.sampleRate, 24);
        // Byte rate (SampleRate * NumChannels * BitsPerSample/8)
        buffer.writeUInt32LE((this.sampleRate * 1 * 16) / 8, 28);
        // Block align (NumChannels * BitsPerSample/8)
        buffer.writeUInt16LE((1 * 16) / 8, 32);
        // Bits per sample
        buffer.writeUInt16LE(16, 34);
        // Data chunk marker
        buffer.write("data", 36);
        // Data size
        buffer.writeUInt32LE(dataSize, 40);

        // Write audio data - directly copy each chunk's buffer
        let offset = 44;
        for (const chunk of this.chunks) {
            chunk.copy(buffer, offset);
            offset += chunk.length;
        }

        return buffer;
    }

    /**
     * Notify all listeners of an event
     * @param {Object} event - Event data
     */
    notifyListener(event) {
        try {
            this.listener(event);
        } catch (error) {
            console.error("Error in audio listener:", error);
        }
    }
}

async function handleListener(response) {

    if (response.type === "final-response") {
        console.log("Final response:", response);
    } else if (response.type === "audio-chunk") {
        try {
            const base64Chunk = response.data.chunk.toString("base64");
            this.mainWindow.webContents.send("audio-chunk-received", {
                chunk: base64Chunk,
                totalBytes: response.data.totalBytes,
                contentType: "audio/mpeg", // Specify MP3 format
                isMP3: true,
            });
        } catch (error) {
            console.error("Error processing audio chunk:", error);
        }
    } else if (response.type === "audio-stream-end") {
        this.mainWindow.webContents.send("audio-stream-complete", {
            ...response.data,
            contentType: "audio/mpeg",
            isMP3: true,
        });
    }
}

async function getAudioService() {
    if (!audioService) {
        audioService = new AudioService(handleListener);
        await audioService.initialize();
    }
    return audioService;
}

module.exports = { getAudioService };
