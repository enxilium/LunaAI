const { desktopCapturer } = require("electron");
const logger = require("../../../utils/logger");

/**
 * Screen sharing service using Electron's desktopCapturer API
 * Refactored to only include methods used by StreamingService
 */
class DesktopCapturerService {
    constructor() {
        // No state tracking needed for the simplified service
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

            const mappedSources = inputSources.map((source) => ({
                id: source.id,
                name: source.name,
                display_id: source.display_id,
                thumbnail: source.thumbnail
                    ? source.thumbnail.toDataURL()
                    : null,
            }));

            logger.success(
                "DesktopCapturer",
                `Successfully retrieved ${mappedSources.length} screen sources`
            );
            return mappedSources;
        } catch (error) {
            logger.error(
                "DesktopCapturer",
                "Error getting screen sources:",
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
            // Always select Screen 1
            let primarySource = sources.find(
                (source) => source.name === "Screen 1"
            );

            if (!primarySource) {
                // Fallback to first screen source
                primarySource = sources[0];
            }

            return primarySource;
        } catch (error) {
            logger.error(
                "DesktopCapturer",
                "Error getting primary screen:",
                error
            );
            throw error;
        }
    }
}

let desktopCapturerService = null;

function getDesktopCapturerService() {
    if (!desktopCapturerService) {
        desktopCapturerService = new DesktopCapturerService();
    }
    return desktopCapturerService;
}

module.exports = {
    getDesktopCapturerService,
};
