/**
 * VideoStreamingService - Handles screen capture and video streaming to agent
 * Works alongside AudioWorkletStreaming for complete multimodal experience
 */
class VideoStreamingService {
    private websocket: WebSocket | null = null;
    private videoStream: MediaStream | null = null;
    private videoElement: HTMLVideoElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private captureInterval: NodeJS.Timeout | null = null;

    private isStreaming = false;
    private frameCount = 0;
    private clientId: string;

    // Configuration
    private readonly serverUrl = "ws://localhost:8765";
    private readonly frameRate = 1; // 1 fps for video frames
    private readonly jpegQuality = 0.7; // 70% JPEG quality

    // Callbacks
    public onError: ((error: string) => void) | null = null;

    constructor(clientId: string) {
        this.clientId = clientId;
    }

    async initialize(): Promise<boolean> {
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

            // Create video element and canvas for frame capture
            this.setupVideoElements();

            console.log(
                "[VideoStreaming] Initialized with source:",
                primarySource.name
            );
            return true;
        } catch (error) {
            console.error("[VideoStreaming] Failed to initialize:", error);
            if (this.onError) {
                this.onError(`Video initialization failed: ${error}`);
            }
            return false;
        }
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
                    `[VideoStreaming] Canvas set to ${this.canvas.width}x${this.canvas.height}`
                );
            }
        });

        // Start video playback
        this.videoElement.play();
    }

    async startStreaming(existingWebSocket?: WebSocket): Promise<void> {
        if (this.isStreaming) return;

        try {
            // Use existing WebSocket from AudioWorkletStreaming or create new one
            if (existingWebSocket) {
                this.websocket = existingWebSocket;
            } else {
                await this.connectWebSocket();
            }

            // Initialize video capture if not done already
            if (!this.videoStream) {
                const success = await this.initialize();
                if (!success) {
                    throw new Error("Failed to initialize video capture");
                }
            }

            // Start frame capture
            this.startFrameCapture();

            this.isStreaming = true;
            console.log("[VideoStreaming] Started streaming");
        } catch (error) {
            console.error("[VideoStreaming] Failed to start streaming:", error);
            if (this.onError) {
                this.onError(`Failed to start video streaming: ${error}`);
            }
            throw error;
        }
    }

    async stopStreaming(): Promise<void> {
        if (!this.isStreaming) return;

        this.isStreaming = false;

        // Stop frame capture
        this.stopFrameCapture();

        // Clean up video resources
        if (this.videoElement) {
            this.videoElement.remove();
            this.videoElement = null;
        }
        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
        }
        if (this.videoStream) {
            this.videoStream.getTracks().forEach((track) => track.stop());
            this.videoStream = null;
        }

        // Close WebSocket if we own it
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        console.log("[VideoStreaming] Stopped streaming");
    }

    private async connectWebSocket(): Promise<void> {
        return new Promise((resolve, reject) => {
            const wsUrl = `${this.serverUrl}/ws/${this.clientId}?is_video=true`;

            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = () => {
                console.log("[VideoStreaming] WebSocket connected");
                resolve();
            };

            this.websocket.onclose = () => {
                console.log("[VideoStreaming] WebSocket disconnected");
            };

            this.websocket.onerror = (error) => {
                console.error("[VideoStreaming] WebSocket error:", error);
                if (this.onError)
                    this.onError("Video WebSocket connection error");
                reject(error);
            };
        });
    }

    private startFrameCapture(): void {
        if (!this.videoElement || !this.canvas) return;

        this.frameCount = 0;
        this.captureInterval = setInterval(() => {
            this.captureFrame();
            this.frameCount++;
        }, 1000 / this.frameRate);

        console.log(
            `[VideoStreaming] Frame capture started at ${this.frameRate}fps`
        );
    }

    private stopFrameCapture(): void {
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
        console.log("[VideoStreaming] Frame capture stopped");
    }

    private captureFrame(): void {
        if (!this.videoElement || !this.canvas || !this.websocket) return;

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
            console.error("[VideoStreaming] Frame capture failed:", error);
        }
    }

    // Getters
    getIsStreaming(): boolean {
        return this.isStreaming;
    }

    getFrameCount(): number {
        return this.frameCount;
    }

    getWebSocket(): WebSocket | null {
        return this.websocket;
    }
}

export default VideoStreamingService;
