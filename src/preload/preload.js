const { contextBridge, ipcRenderer } = require("electron");

// Audio recording capabilities
let audioContext = null;
let audioStream = null;
let audioProcessor = null;
const SAMPLE_RATE = 16000; // 16kHz for speech recognition
const BUFFER_SIZE = 4096; // Buffer size
let isRecording = false;
let dataCounter = 0;
let startTime = 0;

// Audio recording functions
async function startAudioCapture() {
    try {
        // Clear any existing audio context
        if (audioContext) {
            await stopAudioCapture();
        }

        console.log("Starting audio capture with sample rate", SAMPLE_RATE);
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

        console.log(
            "Got microphone stream with settings:",
            audioStream.getAudioTracks()[0].getSettings()
        );

        // Create audio source node
        const source = audioContext.createMediaStreamSource(audioStream);

        // Create script processor for raw audio data
        audioProcessor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
        audioProcessor.onaudioprocess = (e) => {
            if (!isRecording) return;

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
                console.log(
                    `[${elapsedSeconds}s] Sending audio chunk #${dataCounter}:`,
                    {
                        size: buffer.length,
                        numSamples: intData.length,
                        firstFewSamples: Array.from(intData.slice(0, 4)),
                    }
                );
            }

            // Send to main process - using a Uint8Array to preserve the binary data exactly
            ipcRenderer.send("audio-data", {
                data: new Uint8Array(buffer),
                sampleRate: SAMPLE_RATE,
                format: "int16",
                counter: dataCounter,
            });
        };

        // Connect audio nodes
        source.connect(audioProcessor);
        audioProcessor.connect(audioContext.destination);

        console.log("Audio capture started successfully");
    } catch (error) {
        isRecording = false;
        console.error("Error starting audio capture:", error);
    }
}

async function stopAudioCapture() {
    try {
        console.log("Stopping audio capture...");
        isRecording = false;

        // Disconnect and clean up audio nodes
        if (audioProcessor) {
            audioProcessor.disconnect();
            audioProcessor = null;
            console.log("Audio processor disconnected");
        }

        // Stop all tracks on the stream
        if (audioStream) {
            audioStream.getTracks().forEach((track) => {
                track.stop();
                console.log(`Track ${track.id} stopped`);
            });
            audioStream = null;
        }

        // Close audio context
        if (audioContext) {
            await audioContext.close();
            audioContext = null;
            console.log("Audio context closed");
        }

        console.log(
            "Audio capture stopped after processing",
            dataCounter,
            "chunks"
        );
    } catch (error) {
        console.error("Error stopping audio capture:", error);
    }
}

// Listen for commands from main process
ipcRenderer.on("start-audio-capture", async () => {
    await startAudioCapture();
});

ipcRenderer.on("stop-audio-capture", async () => {
    await stopAudioCapture();
});

// Standard API exposure
contextBridge.exposeInMainWorld("electron", {
    // Validating what frontend (renderer) can send to backend (main process)
    send: (command) => {
        const validChannels = [
            "update-orb-size",
            "save-settings",
            "disconnect-service",
            "audio-data",
        ];

        if (validChannels.includes(command.name)) {
            ipcRenderer.send("command", command);
        } else {
            console.error(`Invalid command: ${command}`);
        }
    },

    // Validating what backend (main process) can send to frontend (renderer)
    receive: (channel, func) => {
        const validChannels = ["error-response", "transcription-result"];

        if (validChannels.includes(channel)) {
            // Log when we set up a listener
            console.log(`Setting up renderer listener for ${channel}`);
            ipcRenderer.on(channel, (event, ...args) => {
                console.log(`Received ${channel} event:`, ...args);
                func(...args);
            });
        }
    },

    // Allow removing listeners when they're no longer needed
    removeListener: (channel) => {
        const validChannels = ["error-response", "transcription-result"];

        if (validChannels.includes(channel)) {
            ipcRenderer.removeAllListeners(channel);
        }
    },

    // Updated invoke method using centralized invoke pattern
    invoke: (name, ...args) => {
        const validMethods = [
            "get-picovoice-key",
            "get-settings",
            "get-listening-status",
            "authorize-service",
            "disconnect-service",
            "start-listening",
            "stop-listening",
            "transcribe-audio",
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

    removeAudioListeners: () => {
        ipcRenderer.removeAllListeners("audio-chunk-received");
        ipcRenderer.removeAllListeners("audio-stream-complete");
        console.log("Audio listeners removed");
    },
});
