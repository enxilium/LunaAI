const {
    getDesktopCapturerService,
} = require("../services/agent/runner/desktop-capturer-service");
const logger = require("../utils/logger");

/**
 * Desktop capturer handlers for screen sharing
 */

const desktopCapturerService = getDesktopCapturerService();

const getScreenSources = async () => {
    try {
        logger.debug("IPC", "Processing getScreenSources request");
        const sources = await desktopCapturerService.getScreenSources();
        logger.debug(
            "IPC",
            `Returning ${sources.length} screen sources to renderer`
        );
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

const startScreenCapture = async (sourceId) => {
    try {
        return await desktopCapturerService.startScreenCapture(sourceId);
    } catch (error) {
        logger.error("IPC", "Error starting screen capture:", error);
        throw error;
    }
};

const stopScreenCapture = async () => {
    try {
        return await desktopCapturerService.stopScreenCapture();
    } catch (error) {
        logger.error("IPC", "Error stopping screen capture:", error);
        throw error;
    }
};

const getScreenCaptureStatus = () => {
    return desktopCapturerService.getCaptureStatus();
};

const getMediaConstraints = (sourceId) => {
    return desktopCapturerService.getMediaConstraints(sourceId);
};

module.exports = {
    getScreenSources,
    getPrimaryScreenSource,
    startScreenCapture,
    stopScreenCapture,
    getScreenCaptureStatus,
    getMediaConstraints,
};
