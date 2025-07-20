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

    // Configuration
    private readonly serverUrl = "ws://localhost:8765";
    private readonly sampleRate = 24000; // Corrected to match Google ADK spec

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
            console.log("[AudioWorklet] Initializing audio system...");

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

            console.log("[AudioWorklet] ✓ Audio system initialized");
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

        console.log("[AudioWorklet] ✓ Audio nodes created and connected");
    }

    async startStreaming(): Promise<void> {
        if (this.isStreaming) {
            console.log("[AudioWorklet] Already streaming");
            return;
        }

        try {
            console.log("[AudioWorklet] Starting streaming...");

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
                console.log(
                    "[AudioWorklet] Cleared audio queue for fresh start"
                );
            }

            this.isStreaming = true;
            if (this.onStreamingStart) this.onStreamingStart();

            console.log("[AudioWorklet] ✓ Streaming started");
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

        console.log("[AudioWorklet] Stopping streaming...");
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

        console.log("[AudioWorklet] ✓ Streaming stopped");
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

            // Handle audio from agent
            if (message.mime_type === "audio/pcm" && message.data) {
                console.log(
                    "[Agent Audio] Received audio data:",
                    message.data.length,
                    "characters"
                );
                this.playAudioFromAgent(message.data);
            } else if (message.turn_complete || message.interrupted) {
                console.log("[Agent] Turn complete or interrupted:", message);
                if (this.playerNode) {
                    this.playerNode.port.postMessage({ type: "clear" });
                    console.log(
                        "[AudioWorklet] Cleared audio queue due to turn completion/interruption"
                    );
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

            // Send to player worklet immediately - no buffering delays
            this.playerNode.port.postMessage({
                type: "audioData",
                data: int16Array,
            });

            console.log(
                `[AudioWorklet] Queued ${int16Array.length} audio samples for playback`
            );
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

    async destroy() {
        await this.stopStreaming();
    }
}

export default AudioWorkletStreaming;
