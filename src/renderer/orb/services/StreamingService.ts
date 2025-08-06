/**
 * StreamingService - Handles both audio and video streaming to Luna AI agent
 * Combines functionality from AudioWorkletStreaming and VideoStreamingService
 */
class StreamingService {
    // WebSocket
    private websocket: WebSocket | null = null;
    private isConnected = false;
    private isStreaming = false;

    // Audio components
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private micSource: MediaStreamAudioSourceNode | null = null;
    private recorderNode: AudioWorkletNode | null = null;
    private playerNode: AudioWorkletNode | null = null;
    private outputVolume = 1.0;

    // Video components
    private videoStream: MediaStream | null = null;
    private videoElement: HTMLVideoElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private captureInterval: NodeJS.Timeout | null = null;
    private frameCount = 0;

    // Streaming states
    private isVideoEnabledDefault = true; // TODO: Make this configurable.
    private isVideoStreaming = false;
    private isMicrophoneMuted = false;

    // Configuration
    private readonly serverUrl = "ws://localhost:8765";
    private readonly sampleRate = 24000;
    private readonly frameRate = 1;
    private readonly jpegQuality = 1.0;

    // Callbacks
    public onConnectionChange: ((connected: boolean) => void) | null = null;
    public onStreamingStart: (() => void) | null = null;
    public onStreamingStop: (() => void) | null = null;
    public onError: ((error: string) => void) | null = null;
    public onInputAudioData: ((audioData: Float32Array) => void) | null = null;
    public onOutputAudioData: ((audioData: Float32Array) => void) | null = null;
    public onAgentStateChange:
        | ((state: "listening" | "processing" | "speaking") => void)
        | null = null;
    public onVideoStateChange: ((streaming: boolean) => void) | null = null;

    constructor() {
        // No clientId needed anymore
    }

    /**
     * Pre-warm the audio system for faster streaming start
     */
    async preWarm(): Promise<boolean> {
        try {
            if (!this.audioContext) {
                const success = await this.initializeAudio();
                if (!success) {
                    return false;
                }
            }
            return true;
        } catch (error) {
            console.warn("Pre-warming failed:", error);
            return false;
        }
    }

    /**
     * Set output volume for audio playback
     */
    setOutputVolume(volume: number): void {
        this.outputVolume = Math.max(0.0, Math.min(1.0, volume));
    }

    /**
     * Enable/disable video streaming
     */
    async setVideoEnabled(enabled: boolean): Promise<void> {
        this.isVideoEnabledDefault = enabled;

        if (enabled && this.isStreaming) {
            await this.startVideoCapture();
        } else if (!enabled) {
            this.stopVideoCapture();
        }
    }

    /**
     * Enable/disable microphone muting
     */
    setMicrophoneMuted(muted: boolean): void {
        this.isMicrophoneMuted = muted;

        // Mute/unmute the media stream tracks
        if (this.mediaStream) {
            this.mediaStream.getAudioTracks().forEach((track) => {
                track.enabled = !muted;
            });
        }
    }

    private async initializeAudio(): Promise<boolean> {
        try {
            // Create audio context
            this.audioContext = new AudioContext({
                sampleRate: this.sampleRate,
            });

            if (this.audioContext.state === "suspended") {
                await this.audioContext.resume();
            }

            // Load worklet modules
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
            console.error(
                "[UnifiedStreaming] Failed to initialize audio:",
                error
            );
            if (this.onError) {
                this.onError(`Audio initialization failed: ${error}`);
            }
            return false;
        }
    }

    private async initializeVideo(): Promise<boolean> {
        try {
            // Check if Electron API is available
            if (!(window as any).electron?.getScreenSources) {
                throw new Error("Electron screen capture API not available");
            }

            // Get screen sources
            const sources = await (window as any).electron.getScreenSources();
            if (!sources || sources.length === 0) {
                throw new Error("No screen sources available");
            }

            // Get primary screen (or first available)
            const primarySource =
                sources.find((s: any) => s.name === "Screen 1") || sources[0];

            // Get screen capture stream
            this.videoStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: "desktop",
                        chromeMediaSourceId: primarySource.id,
                        minWidth: 1280,
                        maxWidth: 1920,
                        minHeight: 720,
                        maxHeight: 1080,
                        minFrameRate: this.frameRate,
                        maxFrameRate: 30,
                    },
                } as any,
            });

            // Create video elements
            this.setupVideoElements();

            console.log(
                "[UnifiedStreaming] Video initialized with source:",
                primarySource.name
            );
            return true;
        } catch (error) {
            console.error(
                "[UnifiedStreaming] Failed to initialize video:",
                error
            );
            if (this.onError) {
                this.onError(`Video initialization failed: ${error}`);
            }
            return false;
        }
    }

    private async loadWorklets(): Promise<void> {
        if (!this.audioContext) throw new Error("No audio context");

        // Recorder worklet
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

        // Player worklet
        const playerWorklet = `
            class PlayerProcessor extends AudioWorkletProcessor {
                constructor() {
                    super();
                    this.audioQueue = [];
                    this.currentBuffer = null;
                    this.currentBufferIndex = 0;
                    this.isPlaying = false;
                    
                    this.port.onmessage = (event) => {
                        if (event.data.type === 'audioData') {
                            const int16Data = event.data.data;
                            const float32Data = new Float32Array(int16Data.length);
                            
                            for (let i = 0; i < int16Data.length; i++) {
                                float32Data[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7fff);
                            }
                            
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
                        if (!this.currentBuffer || this.currentBufferIndex >= this.currentBuffer.length) {
                            if (this.audioQueue.length > 0) {
                                this.currentBuffer = this.audioQueue.shift();
                                this.currentBufferIndex = 0;
                            } else {
                                outputData[i] = 0;
                                continue;
                            }
                        }
                        
                        if (this.currentBuffer && this.currentBufferIndex < this.currentBuffer.length) {
                            outputData[i] = this.currentBuffer[this.currentBufferIndex];
                            this.currentBufferIndex++;
                        } else {
                            outputData[i] = 0;
                        }
                    }
                    
                    if (this.audioQueue.length === 0 && 
                        (!this.currentBuffer || this.currentBufferIndex >= this.currentBuffer.length)) {
                        this.isPlaying = false;
                    }
                    
                    return true;
                }
            }
            registerProcessor('player-processor', PlayerProcessor);
        `;

        // Create blob URLs
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

        // Connect audio graph
        this.micSource.connect(this.recorderNode);
    }

    private setupVideoElements(): void {
        if (!this.videoStream) return;

        // Create video element (hidden)
        this.videoElement = document.createElement("video");
        this.videoElement.srcObject = this.videoStream;
        this.videoElement.autoplay = true;
        this.videoElement.muted = true;
        this.videoElement.style.display = "none";

        // Create canvas for frame capture
        this.canvas = document.createElement("canvas");

        // Wait for video metadata to set canvas dimensions
        this.videoElement.addEventListener("loadedmetadata", () => {
            if (this.canvas && this.videoElement) {
                this.canvas.width = this.videoElement.videoWidth;
                this.canvas.height = this.videoElement.videoHeight;
                console.log(
                    `[UnifiedStreaming] Canvas set to ${this.canvas.width}x${this.canvas.height}`
                );
            }
        });

        // Start video playback
        this.videoElement.play();
    }

    async startStreaming(): Promise<void> {
        if (this.isStreaming) {
            return;
        }

        try {
            // Initialize audio if needed
            if (!this.audioContext) {
                const success = await this.initializeAudio();
                if (!success) {
                    throw new Error("Failed to initialize audio");
                }
            }

            // Connect to WebSocket
            await this.connectWebSocket();

            // Clear any leftover audio
            if (this.playerNode) {
                this.playerNode.port.postMessage({ type: "clear" });
            }

            this.isStreaming = true;

            // Start video if enabled
            if (this.isVideoEnabledDefault) {
                await this.startVideoCapture();
            }

            if (this.onStreamingStart) this.onStreamingStart();
            if (this.onAgentStateChange) this.onAgentStateChange("listening");

            console.log("[UnifiedStreaming] Started streaming");
        } catch (error) {
            console.error(
                "[UnifiedStreaming] Failed to start streaming:",
                error
            );
            if (this.onError) {
                this.onError(`Failed to start streaming: ${error}`);
            }
            throw error;
        }
    }

    async stopStreaming(): Promise<void> {
        if (!this.isStreaming) return;

        this.isStreaming = false;

        // Stop video capture
        this.stopVideoCapture();

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

        // Stop media streams
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
            this.mediaStream = null;
        }
        if (this.videoStream) {
            this.videoStream.getTracks().forEach((track) => track.stop());
            this.videoStream = null;
        }

        // Clean up video elements
        if (this.videoElement) {
            this.videoElement.remove();
            this.videoElement = null;
        }
        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
        }

        // Close audio context
        if (this.audioContext && this.audioContext.state !== "closed") {
            await this.audioContext.close();
            this.audioContext = null;
        }

        this.isConnected = false;
        if (this.onConnectionChange) this.onConnectionChange(false);
        if (this.onStreamingStop) this.onStreamingStop();

        console.log("[UnifiedStreaming] Stopped streaming");

        window.electron.send("hide-orb");
    }

    private async startVideoCapture(): Promise<void> {
        if (!this.isVideoEnabledDefault || this.isVideoStreaming) return;

        try {
            // Initialize video if needed
            if (!this.videoStream) {
                const success = await this.initializeVideo();
                if (!success) {
                    throw new Error("Failed to initialize video");
                }
            }

            // Start frame capture
            this.frameCount = 0;
            this.captureInterval = setInterval(() => {
                this.captureFrame();
                this.frameCount++;
            }, 1000 / this.frameRate);

            this.isVideoStreaming = true;
            if (this.onVideoStateChange) this.onVideoStateChange(true);

            console.log(
                `[UnifiedStreaming] Video capture started at ${this.frameRate}fps`
            );
        } catch (error) {
            console.error(
                "[UnifiedStreaming] Failed to start video capture:",
                error
            );
            if (this.onError) {
                this.onError(`Failed to start video capture: ${error}`);
            }
        }
    }

    private stopVideoCapture(): void {
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }

        this.isVideoStreaming = false;
        if (this.onVideoStateChange) this.onVideoStateChange(false);

        console.log("[UnifiedStreaming] Video capture stopped");
    }

    private async connectWebSocket(): Promise<void> {
        return new Promise((resolve, reject) => {
            const wsUrl = `${this.serverUrl}/ws`;

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
                console.error("[UnifiedStreaming] WebSocket error:", error);
                if (this.onError) this.onError("WebSocket connection error");
                reject(error);
            };
        });
    }

    private handleServerMessage(data: string) {
        try {
            const message = JSON.parse(data);

            // Handle status-based messages
            if (message.status) {
                switch (message.status) {
                    case "close_connection":
                        console.log(
                            "🏁 [Session] Agent ended session gracefully"
                        );
                        this.stopStreaming();
                        return;

                    case "turn_complete":
                        if (this.onAgentStateChange)
                            this.onAgentStateChange("listening");
                        return;

                    case "interrupted":
                        // Clear audio queue to immediately stop playback
                        if (this.playerNode) {
                            this.playerNode.port.postMessage({ type: "clear" });
                        }
                        if (this.onAgentStateChange)
                            this.onAgentStateChange("listening");
                        return;
                }
            }

            // Handle audio from agent
            if (
                message.type === "audio" &&
                message.mime_type === "audio/pcm" &&
                message.data
            ) {
                this.playAudioFromAgent(message.data);
                if (this.onAgentStateChange)
                    this.onAgentStateChange("speaking");
            }

            // Legacy support for old message format (fallback)
            else if (message.mime_type === "audio/pcm" && message.data) {
                this.playAudioFromAgent(message.data);
                if (this.onAgentStateChange)
                    this.onAgentStateChange("speaking");
            } else if (message.turn_complete || message.interrupted) {
                if (this.onAgentStateChange)
                    this.onAgentStateChange("listening");
            }
        } catch (error) {
            console.error(
                "[UnifiedStreaming] Error handling server message:",
                error
            );
        }
    }

    private sendAudioToAgent(audioData: Int16Array) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            return;
        }

        // Don't send audio if microphone is muted
        if (this.isMicrophoneMuted) {
            return;
        }

        try {
            // Convert Int16Array to base64
            const uint8Array = new Uint8Array(audioData.buffer);
            let binaryString = "";
            for (let i = 0; i < uint8Array.length; i++) {
                binaryString += String.fromCharCode(uint8Array[i]);
            }
            const base64Data = btoa(binaryString);

            const message = {
                type: "audio",
                mime_type: "audio/pcm",
                data: base64Data,
            };

            this.websocket.send(JSON.stringify(message));

            // Emit audio data for visualization
            if (this.onInputAudioData) {
                const float32Data = new Float32Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                    float32Data[i] =
                        audioData[i] / (audioData[i] < 0 ? 0x8000 : 0x7fff);
                }
                this.onInputAudioData(float32Data);
            }
        } catch (error) {
            console.error("[UnifiedStreaming] Error sending audio:", error);
        }
    }

    private captureFrame(): void {
        if (
            !this.videoElement ||
            !this.canvas ||
            !this.websocket ||
            !this.isVideoEnabledDefault
        ) {
            return;
        }

        try {
            const ctx = this.canvas.getContext("2d");
            if (!ctx) return;

            // Draw current video frame to canvas
            ctx.drawImage(
                this.videoElement,
                0,
                0,
                this.canvas.width,
                this.canvas.height
            );

            // Convert to JPEG and get base64 data
            const base64Image = this.canvas
                .toDataURL("image/jpeg", this.jpegQuality)
                .split(",")[1];

            // Send to agent
            const message = {
                type: "video",
                mime_type: "image/jpeg",
                data: base64Image,
            };

            this.websocket.send(JSON.stringify(message));
        } catch (error) {
            console.error("[UnifiedStreaming] Frame capture failed:", error);
        }
    }

    private playAudioFromAgent(base64Data: string) {
        try {
            // Decode base64 to binary data
            const binaryData = atob(base64Data);
            const uint8Array = new Uint8Array(binaryData.length);
            for (let i = 0; i < binaryData.length; i++) {
                uint8Array[i] = binaryData.charCodeAt(i);
            }

            // Convert to Int16Array
            const int16Array = new Int16Array(uint8Array.buffer);

            // Apply volume and convert to Float32Array for playback
            const float32Data = new Float32Array(int16Array.length);
            for (let i = 0; i < int16Array.length; i++) {
                const sample =
                    int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
                float32Data[i] = sample * this.outputVolume;
            }

            // Send to player worklet
            if (this.playerNode) {
                this.playerNode.port.postMessage({
                    type: "audioData",
                    data: int16Array,
                });
            }

            // Emit audio data for visualization
            if (this.onOutputAudioData) {
                this.onOutputAudioData(float32Data);
            }
        } catch (error) {
            console.error("[UnifiedStreaming] Error playing audio:", error);
        }
    }

    sendToServer(type: any) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            try {
                const stopMessage = {
                    type: type,
                };
                this.websocket.send(JSON.stringify(stopMessage));
            } catch (error) {
                console.warn(
                    "[UnifiedStreaming] Failed to send message to server:",
                    error
                );
            }
        }
    }

    // Getters
    getIsConnected(): boolean {
        return this.isConnected;
    }

    getIsStreaming(): boolean {
        return this.isStreaming;
    }

    getisVideoEnabledDefault(): boolean {
        return this.isVideoEnabledDefault;
    }

    getIsVideoStreaming(): boolean {
        return this.isVideoStreaming;
    }

    getIsMicrophoneMuted(): boolean {
        return this.isMicrophoneMuted;
    }

    getFrameCount(): number {
        return this.frameCount;
    }

    getWebSocket(): WebSocket | null {
        return this.websocket;
    }
}

export default StreamingService;
