/**
 * ConnectionManager - Unified service for audio, video, and WebSocket management
 * Replaces AudioWorkletStreaming + VideoStreamingService + separate WebSocket handling
 */
class ConnectionManager {
    private websocket: WebSocket | null = null;
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private videoStream: MediaStream | null = null;
    private micSource: MediaStreamAudioSourceNode | null = null;
    private recorderNode: AudioWorkletNode | null = null;
    private playerNode: AudioWorkletNode | null = null;

    // Video elements
    private videoElement: HTMLVideoElement | null = null;
    private videoCanvas: HTMLCanvasElement | null = null;
    private captureInterval: NodeJS.Timeout | null = null;

    // State
    private isConnected = false;
    private isStreaming = false;
    private isMuted = true;
    private outputVolume = 1.0;
    private frameCount = 0;

    // Config
    private readonly serverUrl = "ws://localhost:8765";
    private readonly sampleRate = 24000;
    private readonly frameRate = 1;
    private readonly clientId = Math.random().toString(36).substring(2, 15);

    // Event emitter pattern - cleaner than callbacks
    private eventListeners: { [key: string]: Function[] } = {};

    constructor() {
        this.setupEventEmitter();
    }

    private setupEventEmitter() {
        this.eventListeners = {
            connectionChange: [],
            streamingChange: [],
            agentStateChange: [],
            inputAudioData: [],
            outputAudioData: [],
            error: [],
        };
    }

    // Event emitter methods
    on(event: string, callback: Function) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    off(event: string, callback: Function) {
        if (this.eventListeners[event]) {
            this.eventListeners[event] = this.eventListeners[event].filter(
                (cb) => cb !== callback
            );
        }
    }

    private emit(event: string, ...args: any[]) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach((callback) => callback(...args));
        }
    }

    /**
     * Initialize all components (audio, video, WebSocket)
     */
    async initialize(): Promise<boolean> {
        try {
            // Initialize audio
            await this.initializeAudio();

            // Initialize video
            await this.initializeVideo();

            return true;
        } catch (error) {
            console.error("[ConnectionManager] Initialization failed:", error);
            this.emit("error", `Initialization failed: ${error}`);
            return false;
        }
    }

    private async initializeAudio(): Promise<void> {
        this.audioContext = new AudioContext({ sampleRate: this.sampleRate });

        // Get microphone stream
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: { sampleRate: this.sampleRate, channelCount: 1 },
        });

        await this.loadAudioWorklets();
        await this.createAudioNodes();
    }

    private async initializeVideo(): Promise<void> {
        // Check if Electron API is available
        if (!(window as any).electron?.getScreenSources) {
            throw new Error("Electron screen capture API not available");
        }

        // Get screen sources
        const sources = await (window as any).electron.getScreenSources();
        if (!sources || sources.length === 0) {
            throw new Error("No screen sources available");
        }

        const primarySource =
            sources.find((s: any) => s.name === "Screen 1") || sources[0];

        // Get video stream
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

        this.setupVideoElements();
    }

    private async loadAudioWorklets(): Promise<void> {
        if (!this.audioContext) return;

        const recorderWorklet = `
            class RecorderProcessor extends AudioWorkletProcessor {
                process(inputs) {
                    const input = inputs[0];
                    if (input && input[0]) {
                        const float32Data = input[0];
                        const int16Data = new Int16Array(float32Data.length);
                        
                        for (let i = 0; i < float32Data.length; i++) {
                            const sample = Math.max(-1, Math.min(1, float32Data[i]));
                            int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
                        }
                        
                        this.port.postMessage({ type: 'audioData', data: int16Data });
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
                    this.audioQueue = [];
                    this.port.onmessage = (event) => {
                        if (event.data.type === 'audioData') {
                            this.audioQueue.push(event.data.data);
                        }
                    };
                }
                
                process(inputs, outputs) {
                    const output = outputs[0];
                    if (output && output[0] && this.audioQueue.length > 0) {
                        const audioData = this.audioQueue.shift();
                        const channelData = output[0];
                        
                        for (let i = 0; i < Math.min(channelData.length, audioData.length); i++) {
                            channelData[i] = audioData[i];
                        }
                    }
                    return true;
                }
            }
            registerProcessor('player-processor', PlayerProcessor);
        `;

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
        if (!this.audioContext || !this.mediaStream) return;

        this.micSource = this.audioContext.createMediaStreamSource(
            this.mediaStream
        );
        this.recorderNode = new AudioWorkletNode(
            this.audioContext,
            "recorder-processor"
        );
        this.playerNode = new AudioWorkletNode(
            this.audioContext,
            "player-processor"
        );

        // Connect audio pipeline
        this.micSource.connect(this.recorderNode);
        this.playerNode.connect(this.audioContext.destination);

        // Handle audio data
        this.recorderNode.port.onmessage = (event) => {
            if (
                event.data.type === "audioData" &&
                !this.isMuted &&
                this.isStreaming
            ) {
                this.sendAudioToAgent(event.data.data);
                this.emit("inputAudioData", new Float32Array(event.data.data));
            }
        };
    }

    private setupVideoElements(): void {
        if (!this.videoStream) return;

        this.videoElement = document.createElement("video");
        this.videoCanvas = document.createElement("canvas");

        this.videoElement.srcObject = this.videoStream;
        this.videoElement.play();

        this.videoElement.addEventListener("loadedmetadata", () => {
            if (this.videoCanvas && this.videoElement) {
                this.videoCanvas.width = this.videoElement.videoWidth;
                this.videoCanvas.height = this.videoElement.videoHeight;
            }
        });
    }

    /**
     * Start streaming session (audio + video + WebSocket)
     */
    async startStreaming(): Promise<void> {
        if (this.isStreaming) return;

        try {
            // Connect WebSocket
            await this.connectWebSocket();

            // Start video capture
            this.startVideoCapture();

            this.isStreaming = true;
            this.emit("streamingChange", true);
            this.emit("connectionChange", true);

            console.log("[ConnectionManager] Streaming started");
        } catch (error) {
            console.error(
                "[ConnectionManager] Failed to start streaming:",
                error
            );
            this.emit("error", `Failed to start streaming: ${error}`);
            throw error;
        }
    }

    /**
     * Stop streaming session
     */
    async stopStreaming(): Promise<void> {
        if (!this.isStreaming) return;

        try {
            this.stopVideoCapture();

            if (this.websocket) {
                this.websocket.close();
                this.websocket = null;
            }

            this.isStreaming = false;
            this.isConnected = false;
            this.emit("streamingChange", false);
            this.emit("connectionChange", false);

            console.log("[ConnectionManager] Streaming stopped");
        } catch (error) {
            console.error(
                "[ConnectionManager] Error stopping streaming:",
                error
            );
            this.emit("error", `Error stopping streaming: ${error}`);
        }
    }

    private async connectWebSocket(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.websocket = new WebSocket(
                `${this.serverUrl}/ws/${this.clientId}`
            );

            this.websocket.onopen = () => {
                this.isConnected = true;
                console.log("[ConnectionManager] WebSocket connected");
                resolve();
            };

            this.websocket.onmessage = (event) => {
                this.handleServerMessage(event.data);
            };

            this.websocket.onclose = () => {
                this.isConnected = false;
                this.emit("connectionChange", false);
                console.log("[ConnectionManager] WebSocket disconnected");
            };

            this.websocket.onerror = (error) => {
                console.error("[ConnectionManager] WebSocket error:", error);
                reject(error);
            };

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!this.isConnected) {
                    reject(new Error("WebSocket connection timeout"));
                }
            }, 10000);
        });
    }

    private handleServerMessage(data: string) {
        try {
            const message = JSON.parse(data);

            if (message.type === "audio") {
                this.playAudioFromAgent(message.data);
            } else if (message.type === "agent_state") {
                this.emit("agentStateChange", message.state);
            }
        } catch (error) {
            console.error(
                "[ConnectionManager] Error handling server message:",
                error
            );
        }
    }

    private sendAudioToAgent(audioData: Int16Array) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN)
            return;

        try {
            const base64Data = btoa(
                String.fromCharCode(...new Uint8Array(audioData.buffer))
            );
            const message = {
                type: "audio",
                mime_type: "audio/pcm",
                data: base64Data,
            };
            this.websocket.send(JSON.stringify(message));
        } catch (error) {
            console.error("[ConnectionManager] Error sending audio:", error);
        }
    }

    private playAudioFromAgent(base64Data: string) {
        try {
            const binaryData = atob(base64Data);
            const audioData = new Float32Array(binaryData.length);

            for (let i = 0; i < binaryData.length; i++) {
                audioData[i] =
                    (binaryData.charCodeAt(i) / 127.5 - 1) * this.outputVolume;
            }

            if (this.playerNode) {
                this.playerNode.port.postMessage({
                    type: "audioData",
                    data: audioData,
                });
            }

            this.emit("outputAudioData", audioData);
        } catch (error) {
            console.error("[ConnectionManager] Error playing audio:", error);
        }
    }

    private startVideoCapture(): void {
        if (!this.videoElement || !this.videoCanvas) return;

        this.frameCount = 0;
        this.captureInterval = setInterval(() => {
            this.captureFrame();
            this.frameCount++;
        }, 1000 / this.frameRate);

        console.log(
            `[ConnectionManager] Video capture started at ${this.frameRate}fps`
        );
    }

    private stopVideoCapture(): void {
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
        console.log("[ConnectionManager] Video capture stopped");
    }

    private captureFrame(): void {
        if (!this.videoElement || !this.videoCanvas || !this.websocket) return;

        try {
            const ctx = this.videoCanvas.getContext("2d");
            if (!ctx) return;

            ctx.drawImage(
                this.videoElement,
                0,
                0,
                this.videoCanvas.width,
                this.videoCanvas.height
            );

            const base64Image = this.videoCanvas
                .toDataURL("image/jpeg", 0.7)
                .split(",")[1];

            const message = {
                type: "video",
                mime_type: "image/jpeg",
                data: base64Image,
            };

            this.websocket.send(JSON.stringify(message));
        } catch (error) {
            console.error("[ConnectionManager] Frame capture failed:", error);
        }
    }

    // Public control methods
    setMuted(muted: boolean): void {
        this.isMuted = muted;
        console.log(
            `[ConnectionManager] Microphone ${muted ? "muted" : "unmuted"}`
        );
    }

    setOutputVolume(volume: number): void {
        this.outputVolume = Math.max(0.0, Math.min(1.0, volume));
        console.log(
            `[ConnectionManager] Output volume set to ${Math.round(
                this.outputVolume * 100
            )}%`
        );
    }

    // Getters
    getStatus() {
        return {
            isConnected: this.isConnected,
            isStreaming: this.isStreaming,
            isMuted: this.isMuted,
            outputVolume: this.outputVolume,
            frameCount: this.frameCount,
        };
    }

    getWebSocket(): WebSocket | null {
        return this.websocket;
    }

    // Cleanup
    async destroy(): Promise<void> {
        await this.stopStreaming();

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
        }
        if (this.videoStream) {
            this.videoStream.getTracks().forEach((track) => track.stop());
        }
        if (this.audioContext) {
            await this.audioContext.close();
        }
        if (this.videoElement) {
            this.videoElement.remove();
        }
        if (this.videoCanvas) {
            this.videoCanvas.remove();
        }

        // Clear event listeners
        this.eventListeners = {};

        console.log("[ConnectionManager] Destroyed");
    }
}

export default ConnectionManager;
