const { contextBridge, ipcRenderer } = require("electron");

// Setup a safer logging method
const preloadLog = (...args) => {
    ipcRenderer.send("preload-log", ...args);
};

// Log immediately using the safe function
preloadLog("Preload script loaded successfully");

// Audio recording capabilities
let audioContext = null;
let audioStream = null;
let audioProcessor = null;
const SAMPLE_RATE = 16000; // 16kHz for speech recognition
const BUFFER_SIZE = 4096; // Buffer size
let isRecording = false;
let dataCounter = 0;
let startTime = 0;
let isProcessingAudio = false;  // Flag to prevent overlapping audio processing

// Set up event listeners immediately
ipcRenderer.on("start-listening", async () => {
    preloadLog("Received start-listening event");
    await startAudioCapture();
});

ipcRenderer.on("stop-listening", async () => {
    preloadLog("Received stop-listening event");
    await stopAudioCapture();
});

// Standard API exposure
contextBridge.exposeInMainWorld("electron", {
    // Validating what frontend (renderer) can send to backend (main process)
    send: (command) => {
        const validChannels = ["update-orb-size", "audio-data"];

        if (validChannels.includes(command.name)) {
            ipcRenderer.send("command", command);
        } else {
            preloadLog(`Invalid command: ${command}`);
        }
    },

    // Validating what backend (main process) can send to frontend (renderer)
    receive: (channel, func) => {
        const validChannels = [
            "error-response",
            "stop-listening",
            "processing",
            "conversation-end",
            "start-listening",
        ];

        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => {
                func(...args);
            });
        }
    },

    // Updated invoke method using centralized invoke pattern
    invoke: (name, ...args) => {
        const validMethods = [
            "get-picovoice-key",
            "get-settings",
            "authorize-service",
            "disconnect-service",
            "start-listening",
            "hide-orb",
        ];

        if (validMethods.includes(name)) {
            return ipcRenderer.invoke("invoke", { name, args });
        }
        return Promise.reject(new Error(`Invalid invoke method: ${name}`));
    },

    onAudioChunk: (callback) => {
        ipcRenderer.on("audio-chunk-received", (event, chunkData) => {
            callback(chunkData);
        });
    },

    onAudioStreamEnd: (callback) => {
        ipcRenderer.on("audio-stream-complete", (event, streamInfo) => {
            callback(streamInfo);
        });
    },

    // Allow removing listeners when they're no longer needed
    removeListener: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },
});

// Audio recording functions
async function startAudioCapture() {
    try {
        // If already recording, stop first to reset everything
        if (isRecording) {
            preloadLog("Already recording, stopping first");
            await stopAudioCapture();
        }

        isRecording = true;
        dataCounter = 0;
        startTime = Date.now();

        // Create audio context with proper sample rate
        audioContext = new AudioContext({
            sampleRate: SAMPLE_RATE,
            latencyHint: "interactive",
        });

        // Get microphone stream - this works without permission prompt
        // when triggered as a response to a user action in Electron
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1, // Force mono channel
                sampleRate: SAMPLE_RATE,
            },
        });

        // Create audio source node
        const source = audioContext.createMediaStreamSource(audioStream);

        // Create script processor for raw audio data
        audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
        audioProcessor.onaudioprocess = (e) => {
            if (!isRecording) return;
            
            // Prevent overlapping processing
            if (isProcessingAudio) return;
            isProcessingAudio = true;
            
            try {
                dataCounter++;
    
                // Get raw audio data
                const inputData = e.inputBuffer.getChannelData(0);
    
                // Convert Float32Array to Int16Array with proper scaling
                const intData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    // Properly scale float [-1.0, 1.0] to int16 [-32768, 32767]
                    // This is critical for audio quality
                    const sample = Math.max(-1, Math.min(1, inputData[i]));
                    // Use proper scaling factor for negative vs positive values
                    intData[i] =
                        sample < 0
                            ? Math.floor(sample * 0x8000)
                            : Math.floor(sample * 0x7fff);
                }
    
                // Create a Buffer that preserves the int16 data exactly
                const buffer = Buffer.from(intData.buffer);
    
                // Log status periodically (every ~1 second)
                if (dataCounter % 24 === 0) {
                    const elapsedSeconds = Math.round(
                        (Date.now() - startTime) / 1000
                    );
                    preloadLog(`Recording for ${elapsedSeconds}s, chunks: ${dataCounter}`);
                }
    
                // Send to main process - using a Uint8Array to preserve the binary data exactly
                ipcRenderer.send("audio-data", {
                    data: new Uint8Array(buffer),
                    sampleRate: SAMPLE_RATE,
                    format: "int16",
                    counter: dataCounter,
                });
            } finally {
                isProcessingAudio = false;
            }
        };

        // Connect audio nodes
        source.connect(audioProcessor);
        audioProcessor.connect(audioContext.destination);
        
        preloadLog("Audio capture started successfully");
    } catch (error) {
        isRecording = false;
        isProcessingAudio = false;
        preloadLog(`Error starting audio capture: ${error.message}`);
        console.error("Error starting audio capture:", error);
    }
}

async function stopAudioCapture() {
    try {
        isRecording = false;
        isProcessingAudio = false;

        // Disconnect and clean up audio nodes
        if (audioProcessor) {
            audioProcessor.disconnect();
            audioProcessor = null;
        }

        // Stop all tracks on the stream
        if (audioStream) {
            audioStream.getTracks().forEach((track) => {
                track.stop();
            });
            audioStream = null;
        }

        // Close audio context only if it exists and is not already closed
        if (audioContext && audioContext.state !== "closed") {
            try {
                await audioContext.close();
            } catch (closeError) {
                console.warn(
                    "Could not close AudioContext:",
                    closeError.message
                );
            }
        }

        // Always set to null to ensure we create a new one next time
        audioContext = null;
        
        preloadLog("Audio capture stopped");
    } catch (error) {
        preloadLog(`Error stopping audio capture: ${error.message}`);
        console.error("Error stopping audio capture:", error);
    }
}
