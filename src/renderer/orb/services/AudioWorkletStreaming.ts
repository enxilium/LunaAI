/**
 * AudioWorkletStreaming - Modern AudioWorklet-based streaming implementation
 * This is the preferred approach over ScriptProcessorNode
 */
class AudioWorkletStreaming {
    private websocket: WebSocket | null = null;
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private micSource: MediaStreamAudioSourceNode | null = null;
    private recorderNode: AudioWorkletNode | null = null;
    private playerNode: AudioWorkletNode | null = null;

    private isConnected = false;
    private isStreaming = false;
    private clientId: string;
    private outputVolume = 1.0; // Output volume control (0.0 to 1.0)

    // Configuration
    private readonly serverUrl = "ws://localhost:8765";
    private readonly sampleRate = 24000; // Corrected to match Google ADK spec

    // Callbacks
    public onConnectionChange: ((connected: boolean) => void) | null = null;
    public onStreamingStart: (() => void) | null = null;
    public onStreamingStop: (() => void) | null = null;
    public onError: ((error: string) => void) | null = null;

    // New callbacks for audio data and agent state
    public onInputAudioData: ((audioData: Float32Array) => void) | null = null;
    public onOutputAudioData: ((audioData: Float32Array) => void) | null = null;
    public onAgentStateChange:
        | ((state: "listening" | "processing" | "speaking") => void)
        | null = null;

    constructor() {
        this.clientId =
            Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }

    /**
     * Pre-warm the audio system and WebSocket connection for faster startStreaming()
     * This initializes audio but doesn't start streaming yet
     */
    async preWarm(): Promise<boolean> {
        try {
            // Initialize audio system if not already done
            if (!this.audioContext) {
                const success = await this.initialize();
                if (!success) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.warn("Audio pre-warming failed:", error);
            return false;
        }
    }

    /**
     * Set output volume for audio playback
     */
    setOutputVolume(volume: number): void {
        this.outputVolume = Math.max(0.0, Math.min(1.0, volume));
    }

    async initialize(): Promise<boolean> {
        try {
            // Create audio context
            this.audioContext = new AudioContext({
                sampleRate: this.sampleRate,
            });

            if (this.audioContext.state === "suspended") {
                await this.audioContext.resume();
            }

            // Load worklet modules - simplified approach
            await this.loadWorklets();

            // Get microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.sampleRate,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            // Create audio nodes
            await this.createAudioNodes();

            return true;
        } catch (error) {
            console.error("[AudioWorklet] Failed to initialize:", error);
            if (this.onError) {
                this.onError(`Audio initialization failed: ${error}`);
            }
            return false;
        }
    }

    private async loadWorklets(): Promise<void> {
        if (!this.audioContext) throw new Error("No audio context");

        // Simple inline worklet definitions to avoid file loading issues
        const recorderWorklet = `
            class RecorderProcessor extends AudioWorkletProcessor {
                process(inputs) {
                    const input = inputs[0];
                    if (input && input[0]) {
                        // Convert to Int16 PCM
                        const float32Data = input[0];
                        const int16Data = new Int16Array(float32Data.length);
                        
                        for (let i = 0; i < float32Data.length; i++) {
                            const sample = Math.max(-1, Math.min(1, float32Data[i]));
                            int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
                        }
                        
                        // Send to main thread
                        this.port.postMessage({
                            type: 'audioData',
                            data: int16Data
                        });
                    }
                    return true;
                }
            }
            registerProcessor('recorder-processor', RecorderProcessor);
        `;

        const playerWorklet = `
            class PlayerProcessor extends AudioWorkletProcessor {
                constructor() {
                    super();
                    this.audioQueue = []; // Simple FIFO queue instead of circular buffer
                    this.currentBuffer = null;
                    this.currentBufferIndex = 0;
                    this.isPlaying = false;
                    
                    this.port.onmessage = (event) => {
                        if (event.data.type === 'audioData') {
                            // Convert Int16 to Float32
                            const int16Data = event.data.data;
                            const float32Data = new Float32Array(int16Data.length);
                            
                            for (let i = 0; i < int16Data.length; i++) {
                                float32Data[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7fff);
                            }
                            
                            // Add to simple queue
                            this.audioQueue.push(float32Data);
                            this.isPlaying = true;
                        } else if (event.data.type === 'clear') {
                            this.audioQueue = [];
                            this.currentBuffer = null;
                            this.currentBufferIndex = 0;
                            this.isPlaying = false;
                        }
                    };
                }
                
                process(inputs, outputs) {
                    const output = outputs[0];
                    if (!output || !output[0]) return true;
                    
                    const outputData = output[0];
                    
                    if (!this.isPlaying) {
                        outputData.fill(0);
                        return true;
                    }
                    
                    for (let i = 0; i < outputData.length; i++) {
                        // Get current buffer if we don't have one or finished the current one
                        if (!this.currentBuffer || this.currentBufferIndex >= this.currentBuffer.length) {
                            if (this.audioQueue.length > 0) {
                                this.currentBuffer = this.audioQueue.shift();
                                this.currentBufferIndex = 0;
                            } else {
                                // No more data, output silence
                                outputData[i] = 0;
                                continue;
                            }
                        }
                        
                        // Output sample from current buffer
                        if (this.currentBuffer && this.currentBufferIndex < this.currentBuffer.length) {
                            outputData[i] = this.currentBuffer[this.currentBufferIndex];
                            this.currentBufferIndex++;
                        } else {
                            outputData[i] = 0;
                        }
                    }
                    
                    // Stop playing if no more data
                    if (this.audioQueue.length === 0 && 
                        (!this.currentBuffer || this.currentBufferIndex >= this.currentBuffer.length)) {
                        this.isPlaying = false;
                    }
                    
                    return true;
                }
            }
            registerProcessor('player-processor', PlayerProcessor);
        `;

        // Create blob URLs to avoid file loading issues
        const recorderBlob = new Blob([recorderWorklet], {
            type: "application/javascript",
        });
        const playerBlob = new Blob([playerWorklet], {
            type: "application/javascript",
        });

        await this.audioContext.audioWorklet.addModule(
            URL.createObjectURL(recorderBlob)
        );
        await this.audioContext.audioWorklet.addModule(
            URL.createObjectURL(playerBlob)
        );
    }

    private async createAudioNodes(): Promise<void> {
        if (!this.audioContext || !this.mediaStream) {
            throw new Error("Audio context or media stream not available");
        }

        // Create microphone source
        this.micSource = this.audioContext.createMediaStreamSource(
            this.mediaStream
        );

        // Create recorder worklet
        this.recorderNode = new AudioWorkletNode(
            this.audioContext,
            "recorder-processor"
        );
        this.recorderNode.port.onmessage = (event) => {
            if (event.data.type === "audioData" && this.isStreaming) {
                this.sendAudioToAgent(event.data.data);
            }
        };

        // Create player worklet
        this.playerNode = new AudioWorkletNode(
            this.audioContext,
            "player-processor"
        );
        this.playerNode.connect(this.audioContext.destination);

        // Connect the audio graph
        this.micSource.connect(this.recorderNode);
    }

    async startStreaming(): Promise<void> {
        if (this.isStreaming) {
            return;
        }

        try {
            // Initialize audio if needed
            if (!this.audioContext) {
                const success = await this.initialize();
                if (!success) {
                    throw new Error("Failed to initialize audio");
                }
            }

            // Connect to WebSocket
            await this.connectWebSocket();

            // Clear any leftover audio to prevent jumbled playback
            if (this.playerNode) {
                this.playerNode.port.postMessage({ type: "clear" });
            }

            this.isStreaming = true;
            if (this.onStreamingStart) this.onStreamingStart();
            if (this.onAgentStateChange) this.onAgentStateChange("listening");
        } catch (error) {
            console.error("[AudioWorklet] Failed to start streaming:", error);
            if (this.onError) {
                this.onError(`Failed to start streaming: ${error}`);
            }
            throw error;
        }
    }

    async stopStreaming(): Promise<void> {
        if (!this.isStreaming) return;

        this.isStreaming = false;

        // Close WebSocket
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        // Clean up audio resources
        if (this.recorderNode) {
            this.recorderNode.disconnect();
            this.recorderNode = null;
        }
        if (this.playerNode) {
            this.playerNode.disconnect();
            this.playerNode = null;
        }
        if (this.micSource) {
            this.micSource.disconnect();
            this.micSource = null;
        }

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
    }

    private async connectWebSocket(): Promise<void> {
        return new Promise((resolve, reject) => {
            const wsUrl = `${this.serverUrl}/ws/${this.clientId}?is_audio=true`;

            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = () => {
                this.isConnected = true;
                if (this.onConnectionChange) this.onConnectionChange(true);
                resolve();
            };

            this.websocket.onmessage = (event) => {
                this.handleServerMessage(event.data);
            };

            this.websocket.onclose = () => {
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

            // Handle audio from agent
            if (message.mime_type === "audio/pcm" && message.data) {
                // Agent is speaking when we receive audio
                if (this.onAgentStateChange) {
                    this.onAgentStateChange("speaking");
                }

                this.playAudioFromAgent(message.data);
            } else if (message.turn_complete || message.interrupted) {
                // Agent finished speaking, back to listening
                if (this.onAgentStateChange) {
                    this.onAgentStateChange("listening");
                }

                if (this.playerNode) {
                    this.playerNode.port.postMessage({ type: "clear" });
                }
            }
            // Handle other message types...
        } catch (error) {
            console.error("[WebSocket] Failed to parse message:", error);
        }
    }

    private sendAudioToAgent(audioData: Int16Array) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            // Calculate volume for visualization
            const volume = this.calculateVolume(audioData);

            // Convert to Float32 for callback
            const float32Data = new Float32Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
                float32Data[i] =
                    audioData[i] / (audioData[i] < 0 ? 0x8000 : 0x7fff);
            }

            // Call input audio callback for visualization
            if (this.onInputAudioData) {
                this.onInputAudioData(float32Data);
            }

            const uint8Array = new Uint8Array(audioData.buffer);
            const base64Data = btoa(String.fromCharCode(...uint8Array));

            const message = {
                type: "audio",
                mime_type: "audio/pcm",
                data: base64Data,
            };

            this.websocket.send(JSON.stringify(message));
        } catch (error) {
            console.error("[AudioWorklet] Failed to send audio:", error);
        }
    }

    /**
     * Calculate volume level from audio data (RMS)
     */
    private calculateVolume(audioData: Int16Array | Float32Array): number {
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            const normalized =
                audioData instanceof Int16Array
                    ? audioData[i] / 32768
                    : audioData[i];
            sum += normalized * normalized;
        }
        return Math.sqrt(sum / audioData.length);
    }

    private playAudioFromAgent(base64Data: string) {
        if (!this.playerNode) return;

        try {
            // Decode base64 to binary data
            const binaryString = atob(base64Data);
            const uint8Array = new Uint8Array(binaryString.length);

            for (let i = 0; i < binaryString.length; i++) {
                uint8Array[i] = binaryString.charCodeAt(i);
            }

            // Convert to Int16Array
            const int16Array = new Int16Array(uint8Array.buffer);

            // Calculate volume for visualization
            const volume = this.calculateVolume(int16Array);

            // Convert to Float32 for callback and apply volume control
            const float32Data = new Float32Array(int16Array.length);
            const volumeAdjustedInt16 = new Int16Array(int16Array.length);

            for (let i = 0; i < int16Array.length; i++) {
                // Convert to float and apply volume
                const floatValue =
                    int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
                const volumeAdjustedFloat = floatValue * this.outputVolume;
                float32Data[i] = volumeAdjustedFloat;

                // Convert back to int16 for playback with volume applied
                volumeAdjustedInt16[i] = Math.round(
                    volumeAdjustedFloat *
                        (volumeAdjustedFloat < 0 ? 0x8000 : 0x7fff)
                );
            }

            // Call output audio callback for visualization (with volume applied)
            if (this.onOutputAudioData) {
                this.onOutputAudioData(float32Data);
            }

            // Send volume-adjusted audio to player worklet
            this.playerNode.port.postMessage({
                type: "audioData",
                data: volumeAdjustedInt16,
            });
        } catch (error) {
            console.error("[AudioWorklet] Failed to play agent audio:", error);
        }
    }

    getStatus() {
        return {
            isStreaming: this.isStreaming,
            isConnected: this.isConnected,
            clientId: this.clientId,
            contextState: this.audioContext?.state || null,
        };
    }

    /**
     * Get the WebSocket connection for external services
     */
    getWebSocket(): WebSocket | null {
        return this.websocket;
    }

    async destroy() {
        await this.stopStreaming();
    }
}

export default AudioWorkletStreaming;
