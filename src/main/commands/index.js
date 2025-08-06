const {
    getScreenSources,
    getPrimaryScreenSource,
} = require("./screen-capture");

/**
 * @description Exports all invoke handlers for IPC communication between renderer and main processes.
 * Each key corresponds to an IPC channel name, and the value is the handler function.
 * Refactored to only include methods used by StreamingService.
 */
module.exports = {
    getScreenSources,
    getPrimaryScreenSource,
};
