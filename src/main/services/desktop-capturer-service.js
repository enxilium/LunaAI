const { desktopCapturer, screen } = require("electron");

/**
 * Screen sharing service using Electron's desktopCapturer API
 */
class DesktopCapturerService {
    constructor() {
        this.currentStream = null;
        this.isCapturing = false;
    }

    /**
     * Get available screen sources
     * @returns {Promise<Array>} Array of screen sources
     */
    async getScreenSources() {
        try {
            const inputSources = await desktopCapturer.getSources({
                types: ["screen"],
                thumbnailSize: { width: 300, height: 200 },
            });

            return inputSources.map((source) => ({
                id: source.id,
                name: source.name,
                display_id: source.display_id,
                thumbnail: source.thumbnail
                    ? source.thumbnail.toDataURL()
                    : null,
            }));
        } catch (error) {
            console.error(
                "[DesktopCapturer] Error getting screen sources:",
                error
            );
            throw error;
        }
    }

    /**
     * Get the primary screen source (main display)
     * @returns {Promise<Object>} Primary screen source
     */
    async getPrimaryScreenSource() {
        try {
            const sources = await this.getScreenSources();
            // Find the primary screen or return the first screen source
            const primaryDisplay = screen.getPrimaryDisplay();
            let primarySource = sources.find(
                (source) => source.display_id === primaryDisplay.id.toString()
            );

            if (!primarySource) {
                // Fallback to first screen source
                primarySource =
                    sources.find((source) =>
                        source.name.includes("Entire screen")
                    ) || sources[0];
            }

            return primarySource;
        } catch (error) {
            console.error(
                "[DesktopCapturer] Error getting primary screen:",
                error
            );
            throw error;
        }
    }

    /**
     * Start screen capture
     * @param {string} sourceId - Optional source ID, defaults to primary screen
     * @returns {Promise<Object>} Screen capture information
     */
    async startScreenCapture(sourceId = null) {
        try {
            if (this.isCapturing) {
                throw new Error("Screen capture is already active");
            }

            let targetSource;
            if (sourceId) {
                const sources = await this.getScreenSources();
                targetSource = sources.find((source) => source.id === sourceId);
                if (!targetSource) {
                    throw new Error(
                        `Screen source with ID ${sourceId} not found`
                    );
                }
            } else {
                targetSource = await this.getPrimaryScreenSource();
            }

            this.isCapturing = true;

            console.log(
                `[DesktopCapturer] Starting screen capture for source: ${targetSource.name}`
            );

            return {
                success: true,
                sourceId: targetSource.id,
                sourceName: targetSource.name,
                displayId: targetSource.display_id,
                message: `Screen capture started for ${targetSource.name}`,
            };
        } catch (error) {
            console.error(
                "[DesktopCapturer] Error starting screen capture:",
                error
            );
            this.isCapturing = false;
            throw error;
        }
    }

    /**
     * Stop screen capture
     * @returns {Promise<Object>} Screen capture stop information
     */
    async stopScreenCapture() {
        try {
            if (!this.isCapturing) {
                throw new Error("No active screen capture to stop");
            }

            this.isCapturing = false;
            this.currentStream = null;

            console.log("[DesktopCapturer] Screen capture stopped");

            return {
                success: true,
                message: "Screen capture stopped",
            };
        } catch (error) {
            console.error(
                "[DesktopCapturer] Error stopping screen capture:",
                error
            );
            throw error;
        }
    }

    /**
     * Get current capture status
     * @returns {Object} Capture status information
     */
    getCaptureStatus() {
        return {
            isCapturing: this.isCapturing,
            hasStream: !!this.currentStream,
        };
    }

    /**
     * Get screen capture constraints for getUserMedia
     * @param {string} sourceId - The source ID to capture
     * @returns {Object} Media constraints for getUserMedia
     */
    getMediaConstraints(sourceId) {
        return {
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: "desktop",
                    chromeMediaSourceId: sourceId,
                    minWidth: 1280,
                    maxWidth: 1920,
                    minHeight: 720,
                    maxHeight: 1080,
                    minFrameRate: 30,
                    maxFrameRate: 60,
                },
            },
        };
    }
}

function getDesktopCapturerService() {
    if (!this.desktopCapturerService) {
        this.desktopCapturerService = new DesktopCapturerService();
    }
    return this.desktopCapturerService;
}

module.exports = {
    getDesktopCapturerService,
};
