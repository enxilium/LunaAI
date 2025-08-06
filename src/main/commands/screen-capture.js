const {
    getDesktopCapturerService,
} = require("../services/agent/runner/desktop-capturer-service");
const logger = require("../utils/logger");

/**
 * Desktop capturer handlers for screen sharing
 * Refactored to only include methods used by StreamingService
 */

const desktopCapturerService = getDesktopCapturerService();

const getScreenSources = async () => {
    try {
        const sources = await desktopCapturerService.getScreenSources();
        return sources;
    } catch (error) {
        logger.error("IPC", "Error getting screen sources:", error);
        throw error;
    }
};

const getPrimaryScreenSource = async () => {
    try {
        return await desktopCapturerService.getPrimaryScreenSource();
    } catch (error) {
        logger.error("IPC", "Error getting primary screen source:", error);
        throw error;
    }
};

module.exports = {
    getScreenSources,
    getPrimaryScreenSource,
};
