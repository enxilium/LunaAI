const {
    getScreenSources,
    getPrimaryScreenSource,
    startScreenCapture,
    stopScreenCapture,
    getScreenCaptureStatus,
    getMediaConstraints,
} = require("./screen-capture");

const {
    checkActiveTextInput,
    typeText,
    clearTextField,
} = require("./text-typing");

const { controlMouse } = require("./mouse-control");

/**
 * @description Exports all invoke handlers for IPC communication between renderer and main processes.
 * Each key corresponds to an IPC channel name, and the value is the handler function.
 */
module.exports = {
    getScreenSources,
    getPrimaryScreenSource,
    startScreenCapture,
    stopScreenCapture,
    getScreenCaptureStatus,
    getMediaConstraints,
    checkActiveTextInput,
    typeText,
    clearTextField,
    controlMouse,
};
