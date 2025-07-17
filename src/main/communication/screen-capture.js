const {
    getDesktopCapturerService,
} = require("../services/desktop-capturer-service");

/**
 * Desktop capturer handlers for screen sharing
 */

const desktopCapturerService = getDesktopCapturerService();

const getScreenSources = async () => {
    try {
        return await desktopCapturerService.getScreenSources();
    } catch (error) {
        console.error("[IPC] Error getting screen sources:", error);
        throw error;
    }
};

const getPrimaryScreenSource = async () => {
    try {
        return await desktopCapturerService.getPrimaryScreenSource();
    } catch (error) {
        console.error("[IPC] Error getting primary screen source:", error);
        throw error;
    }
};

const startScreenCapture = async (sourceId) => {
    try {
        return await desktopCapturerService.startScreenCapture(sourceId);
    } catch (error) {
        console.error("[IPC] Error starting screen capture:", error);
        throw error;
    }
};

const stopScreenCapture = async () => {
    try {
        return await desktopCapturerService.stopScreenCapture();
    } catch (error) {
        console.error("[IPC] Error stopping screen capture:", error);
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
    getMediaConstraints
}