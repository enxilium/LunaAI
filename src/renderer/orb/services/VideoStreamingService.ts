/**
 * VideoStreamingService - Handles desktop video capture and streaming
 * Separate from AudioWorkletStreaming for better separation of concerns
 */
class VideoStreamingService {
    private videoStream: MediaStream | null = null;
    private videoCanvas: HTMLCanvasElement | null = null;
    private videoElement: HTMLVideoElement | null = null;
    private captureInterval: NodeJS.Timeout | null = null;
    private websocket: WebSocket | null = null;

    private isCapturing = false;
    private readonly captureFrameRate = 1;
    private frameCount = 0;

    // Callbacks
    public onError: ((error: string) => void) | null = null;
    public onFrameCaptured: ((frameCount: number) => void) | null = null;

    /**
     * Initialize video capture using Electron's desktopCapturer (lazy initialization)
     */
    async initialize(): Promise<boolean> {
        try {
            console.log("[VideoStreaming] Starting initialization...");

            // Check if Electron API is available
            if (!(window as any).electron?.getScreenSources) {
                throw new Error("Electron screen capture API not available");
            }

            // Request desktop capture via Electron API (only when actually needed)
            console.log("[VideoStreaming] Requesting screen sources...");
            const sources = await (window as any).electron.getScreenSources();
            if (!sources || sources.length === 0) {
                throw new Error("No screen sources available");
            }

            console.log(
                `[VideoStreaming] Found ${sources.length} screen sources:`,
                sources.map((s: any) => s.name).join(", ")
            );

            // Use the primary screen source
            const primarySource =
                sources.find((s: any) => s.name === "Screen 1") || sources[0];

            console.log(
                `[VideoStreaming] Using source: ${primarySource.name} (${primarySource.id})`
            );

            // Get media stream using navigator.mediaDevices
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
                        minFrameRate: this.captureFrameRate,
                        maxFrameRate: 30,
                    },
                } as any,
            });

            this.setupVideoElements();
            console.log("[VideoStreaming] Initialized successfully");
            return true;
        } catch (error) {
            const errorMsg = `Failed to initialize video capture: ${error}`;
            console.error("[VideoStreaming]", errorMsg);
            if (this.onError) this.onError(errorMsg);
            return false;
        }
    }

    /**
     * Setup video elements for frame capture
     */
    private setupVideoElements(): void {
        if (!this.videoStream) return;

        this.videoElement = document.createElement("video");
        this.videoCanvas = document.createElement("canvas");

        this.videoElement.srcObject = this.videoStream;
        this.videoElement.play();

        // Set canvas dimensions when video metadata loads
        this.videoElement.addEventListener("loadedmetadata", () => {
            if (this.videoCanvas && this.videoElement) {
                this.videoCanvas.width = this.videoElement.videoWidth;
                this.videoCanvas.height = this.videoElement.videoHeight;
            }
        });
    }

    /**
     * Start video frame capture and streaming
     */
    startCapture(websocket: WebSocket): void {
        if (this.isCapturing || !this.videoStream) return;

        this.websocket = websocket;
        this.isCapturing = true;
        this.frameCount = 0;

        this.captureInterval = setInterval(() => {
            try {
                this.captureFrame();
                this.frameCount++;
                if (this.onFrameCaptured) this.onFrameCaptured(this.frameCount);
            } catch (error) {
                console.error("[VideoStreaming] Frame capture error:", error);
            }
        }, 1000 / this.captureFrameRate);

        console.log(
            `[VideoStreaming] Started capture at ${this.captureFrameRate}fps`
        );
    }

    /**
     * Stop video frame capture
     */
    stopCapture(): void {
        if (!this.isCapturing) return;

        this.isCapturing = false;

        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }

        console.log("[VideoStreaming] Stopped capture");
    }

    /**
     * Capture a single video frame as JPEG - High Performance Version
     */
    private captureFrame(): void {
        if (!this.videoElement || !this.videoCanvas) return;

        try {
            const ctx = this.videoCanvas.getContext("2d");
            if (!ctx) return;

            // Draw current video frame to canvas
            ctx.drawImage(
                this.videoElement,
                0,
                0,
                this.videoCanvas.width,
                this.videoCanvas.height
            );

            // Convert to JPEG and base64 encode synchronously (like Project Livewire)
            const base64Image = this.videoCanvas
                .toDataURL("image/jpeg", 0.7)
                .split(",")[1];
            this.sendFrame(base64Image);
        } catch (error) {
            console.error("[VideoStreaming] Frame capture failed:", error);
        }
    }

    /**
     * Send video frame to server.
     */
    private sendFrame(base64Data: string): void {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            const message = {
                type: "video",
                mime_type: "image/jpeg",
                data: base64Data,
            };

            this.websocket.send(JSON.stringify(message));

            console.log(`[VideoStreaming] ${this.frameCount} frames sent`);
        } catch (error) {
            console.error("[VideoStreaming] Failed to send frame:", error);
        }
    }

    /**
     * Get current capture status
     */
    getStatus() {
        return {
            isCapturing: this.isCapturing,
            hasVideoStream: !!this.videoStream,
            frameRate: this.captureFrameRate,
        };
    }

    /**
     * Cleanup resources
     */
    async destroy(): Promise<void> {
        this.stopCapture();

        if (this.videoStream) {
            this.videoStream.getTracks().forEach((track) => track.stop());
            this.videoStream = null;
        }

        if (this.videoElement) {
            this.videoElement.remove();
            this.videoElement = null;
        }

        if (this.videoCanvas) {
            this.videoCanvas.remove();
            this.videoCanvas = null;
        }

        this.websocket = null;
        console.log("[VideoStreaming] Destroyed");
    }
}

export default VideoStreamingService;
