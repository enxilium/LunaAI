/**
 * SimpleAudioStreaming - A simplified audio streaming implementation for Electron
 * This avoids AudioWorklet complexity and uses ScriptProcessorNode (deprecated but reliable)
 */
class SimpleAudioStreaming {
    private websocket: WebSocket | null = null;
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private micSource: MediaStreamAudioSourceNode | null = null;
    private scriptProcessor: ScriptProcessorNode | null = null;
    private gainNode: GainNode | null = null;

    // Audio playback queue for smooth playback
    private audioQueue: AudioBuffer[] = [];
    private isPlayingAudio = false;
    private playbackGain: GainNode | null = null;
    private nextPlayTime = 0;

    private isConnected = false;
    private isStreaming = false;
    private clientId: string;

    // Configuration - Updated to match Google ADK specifications
    private readonly serverUrl = "ws://localhost:8765";
    private readonly sampleRate = 24000; // ADK uses 24kHz for better quality
    private readonly bufferSize = 4096;

    // Callbacks
    public onConnectionChange: ((connected: boolean) => void) | null = null;
    public onStreamingStart: (() => void) | null = null;
    public onStreamingStop: (() => void) | null = null;
    public onError: ((error: string) => void) | null = null;

    constructor() {
        this.clientId =
            Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }

    async initialize(): Promise<boolean> {
        try {
            console.log("[SimpleAudio] Initializing audio system...");

            // Create audio context - let browser use native sample rate for compatibility
            this.audioContext = new (window.AudioContext ||
                (window as any).webkitAudioContext)();

            if (this.audioContext.state === "suspended") {
                await this.audioContext.resume();
            }

            console.log(
                `[SimpleAudio] Audio context created with native rate: ${this.audioContext.sampleRate}Hz (ADK source: ${this.sampleRate}Hz)`
            );

            // Get microphone access - use native sample rate for better compatibility
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            // Create audio processing chain
            this.micSource = this.audioContext.createMediaStreamSource(
                this.mediaStream
            );
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 1.0;

            // Create playback gain node for agent audio
            this.playbackGain = this.audioContext.createGain();
            this.playbackGain.gain.value = 0.8; // Slightly lower volume
            this.playbackGain.connect(this.audioContext.destination);

            // Create script processor (deprecated but reliable for this use case)
            this.scriptProcessor = this.audioContext.createScriptProcessor(
                this.bufferSize,
                1,
                1
            );

            this.scriptProcessor.onaudioprocess = (event) => {
                if (
                    this.isStreaming &&
                    this.websocket &&
                    this.websocket.readyState === WebSocket.OPEN
                ) {
                    const inputBuffer = event.inputBuffer.getChannelData(0);
                    this.processAudioData(inputBuffer);
                }
            };

            // Connect audio processing chain
            // Note: ScriptProcessor must be connected to destination to function
            this.micSource.connect(this.gainNode);
            this.gainNode.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);

            // Mute the microphone input so we don't hear ourselves
            this.gainNode.gain.value = 0;

            console.log("[SimpleAudio] ✓ Audio system initialized");
            return true;
        } catch (error) {
            console.error("[SimpleAudio] Failed to initialize:", error);
            if (this.onError) {
                this.onError(`Audio initialization failed: ${error}`);
            }
            return false;
        }
    }

    private processAudioData(inputBuffer: Float32Array) {
        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputBuffer.length);
        for (let i = 0; i < inputBuffer.length; i++) {
            const sample = Math.max(-1, Math.min(1, inputBuffer[i]));
            pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }

        this.sendAudioToAgent(pcmData);
    }

    async startStreaming(): Promise<void> {
        if (this.isStreaming) {
            console.log("[SimpleAudio] Already streaming");
            return;
        }

        try {
            console.log("[SimpleAudio] Starting streaming...");

            // Initialize audio if needed
            if (!this.audioContext) {
                const success = await this.initialize();
                if (!success) {
                    throw new Error("Failed to initialize audio");
                }
            }

            // Connect to WebSocket
            await this.connectWebSocket();

            // Clear any leftover audio queue
            this.clearAudioQueue();

            this.isStreaming = true;
            if (this.onStreamingStart) this.onStreamingStart();

            console.log("[SimpleAudio] ✓ Streaming started");
        } catch (error) {
            console.error("[SimpleAudio] Failed to start streaming:", error);
            if (this.onError) {
                this.onError(`Failed to start streaming: ${error}`);
            }
            throw error;
        }
    }

    async stopStreaming(): Promise<void> {
        if (!this.isStreaming) {
            return;
        }

        console.log("[SimpleAudio] Stopping streaming...");

        this.isStreaming = false;

        // Close WebSocket
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        // Clean up audio resources
        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
        }
        if (this.micSource) {
            this.micSource.disconnect();
        }
        if (this.playbackGain) {
            this.playbackGain.disconnect();
        }

        // Clear audio queue
        this.audioQueue = [];
        this.isPlayingAudio = false;
        this.nextPlayTime = 0;

        // Stop media stream
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
            this.mediaStream = null;
        }

        // Close audio context
        if (this.audioContext && this.audioContext.state !== "closed") {
            await this.audioContext.close();
            this.audioContext = null;
        }

        this.isConnected = false;
        if (this.onConnectionChange) this.onConnectionChange(false);
        if (this.onStreamingStop) this.onStreamingStop();

        console.log("[SimpleAudio] ✓ Streaming stopped");
    }

    private async connectWebSocket(): Promise<void> {
        return new Promise((resolve, reject) => {
            const wsUrl = `${this.serverUrl}/ws/${this.clientId}?is_audio=true`;
            console.log("[WebSocket] Connecting to:", wsUrl);

            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = () => {
                console.log("[WebSocket] ✓ Connected");
                this.isConnected = true;
                if (this.onConnectionChange) this.onConnectionChange(true);
                resolve();
            };

            this.websocket.onmessage = (event) => {
                this.handleServerMessage(event.data);
            };

            this.websocket.onclose = () => {
                console.log("[WebSocket] Connection closed");
                this.isConnected = false;
                if (this.onConnectionChange) this.onConnectionChange(false);
            };

            this.websocket.onerror = (error) => {
                console.error("[WebSocket] Error:", error);
                if (this.onError) this.onError("WebSocket connection error");
                reject(error);
            };
        });
    }

    private handleServerMessage(data: string) {
        try {
            const message = JSON.parse(data);

            // Handle different message formats from the server
            if (message.turn_complete || message.interrupted) {
                console.log("[Agent] Turn complete or interrupted:", message);
                // Clear audio queue on interruption or turn completion
                this.clearAudioQueue();
                return;
            }

            if (message.mime_type === "audio/pcm" && message.data) {
                console.log(
                    "[Agent Audio] Received audio data:",
                    message.data.length,
                    "characters"
                );
                this.playAudioFromAgent(message.data);
            } else if (message.mime_type === "text/plain" && message.data) {
                console.log("[Agent Text]:", message.data);
            } else if (message.type) {
                // Legacy format handling
                switch (message.type) {
                    case "audio":
                        if (message.mime_type === "audio/pcm") {
                            this.playAudioFromAgent(message.data);
                        }
                        break;
                    case "text":
                        console.log("[Agent Response]:", message.data);
                        break;
                    case "error":
                        console.error("[Agent Error]:", message.data);
                        if (this.onError)
                            this.onError(`Agent error: ${message.data}`);
                        break;
                    case "session_end":
                        console.log("[Session] Ended by agent");
                        this.stopStreaming();
                        break;
                    default:
                        console.log(
                            "[WebSocket] Unknown message type:",
                            message.type
                        );
                }
            } else {
                console.log("[WebSocket] Unhandled message:", message);
            }
        } catch (error) {
            console.error("[WebSocket] Failed to parse message:", error);
        }
    }

    private sendAudioToAgent(audioData: Int16Array) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            const uint8Array = new Uint8Array(audioData.buffer);
            const base64Data = btoa(String.fromCharCode(...uint8Array));

            // Send in the format expected by the ADK server
            const message = {
                type: "audio",
                mime_type: "audio/pcm",
                data: base64Data,
            };

            this.websocket.send(JSON.stringify(message));
        } catch (error) {
            console.error("[SimpleAudio] Failed to send audio:", error);
        }
    }

    private playAudioFromAgent(base64Data: string) {
        if (!this.audioContext || !this.playbackGain) return;

        try {
            // Decode base64 to audio data
            const binaryString = atob(base64Data);
            const uint8Array = new Uint8Array(binaryString.length);

            for (let i = 0; i < binaryString.length; i++) {
                uint8Array[i] = binaryString.charCodeAt(i);
            }

            // Ensure we have even number of bytes for 16-bit samples
            const byteLength = uint8Array.length;
            const sampleLength = Math.floor(byteLength / 2);

            if (sampleLength === 0) {
                console.warn("[SimpleAudio] Empty audio data received");
                return;
            }

            // Convert to Float32Array for Web Audio API - improved conversion
            const int16Array = new Int16Array(
                uint8Array.buffer,
                0,
                sampleLength
            );
            const float32Array = new Float32Array(sampleLength);

            for (let i = 0; i < sampleLength; i++) {
                // Proper 16-bit to float conversion
                float32Array[i] = int16Array[i] / 32768.0;
            }

            // CRITICAL FIX: Create audio buffer at browser's native sample rate
            // Since ADK sends 24kHz audio but browser runs at native rate (typically 48kHz),
            // we need to create the buffer at the context's rate and resample the data
            const nativeSampleRate = this.audioContext.sampleRate;
            const adkSampleRate = 24000;

            // Calculate how many samples we need for the native rate
            const nativeSampleLength = Math.floor(
                (sampleLength * nativeSampleRate) / adkSampleRate
            );

            // Create buffer at native sample rate
            const audioBuffer = this.audioContext.createBuffer(
                1, // mono
                nativeSampleLength,
                nativeSampleRate
            );

            // Simple linear interpolation resampling
            const channelData = audioBuffer.getChannelData(0);
            for (let i = 0; i < nativeSampleLength; i++) {
                const sourceIndex = (i * adkSampleRate) / nativeSampleRate;
                const lowerIndex = Math.floor(sourceIndex);
                const upperIndex = Math.min(lowerIndex + 1, sampleLength - 1);
                const fraction = sourceIndex - lowerIndex;

                // Linear interpolation between samples
                const lowerValue = float32Array[lowerIndex] || 0;
                const upperValue = float32Array[upperIndex] || 0;
                channelData[i] =
                    lowerValue + (upperValue - lowerValue) * fraction;
            }

            console.log(
                `[SimpleAudio] Resampled audio: ${sampleLength} samples (24kHz) -> ${nativeSampleLength} samples (${nativeSampleRate}Hz)`
            );

            // Add to queue and process
            this.audioQueue.push(audioBuffer);
            this.processAudioQueue();
        } catch (error) {
            console.error("[SimpleAudio] Failed to play agent audio:", error);
        }
    }

    private processAudioQueue() {
        if (
            !this.audioContext ||
            !this.playbackGain ||
            this.audioQueue.length === 0
        ) {
            return;
        }

        // If audio is already playing, let it continue - the queue will be processed when it finishes
        if (this.isPlayingAudio) {
            return;
        }

        const audioBuffer = this.audioQueue.shift()!;
        this.isPlayingAudio = true;

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.playbackGain);

        // Calculate when to start the next audio chunk
        const currentTime = this.audioContext.currentTime;
        const startTime = Math.max(currentTime, this.nextPlayTime);
        this.nextPlayTime = startTime + audioBuffer.duration;

        source.onended = () => {
            this.isPlayingAudio = false;
            // Process next audio chunk in queue
            setTimeout(() => this.processAudioQueue(), 0);
        };

        source.start(startTime);
    }

    private clearAudioQueue() {
        this.audioQueue = [];
        this.isPlayingAudio = false;
        this.nextPlayTime = 0;
        console.log("[SimpleAudio] Audio queue cleared");
    }

    getStatus() {
        return {
            isStreaming: this.isStreaming,
            isConnected: this.isConnected,
            clientId: this.clientId,
            contextState: this.audioContext?.state || null,
            audioQueueLength: this.audioQueue.length,
            isPlayingAudio: this.isPlayingAudio,
        };
    }

    async destroy() {
        await this.stopStreaming();
    }
}

export default SimpleAudioStreaming;
