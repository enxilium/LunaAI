const { reportError } = require("./report-error");
const { getAsset } = require("./get-assets");
const { updateSetting, getAllSettings, getSetting } = require("./manage-settings");
/**
 * @description Exports all invoke handlers for IPC communication between renderer and main processes.
 * Each key corresponds to an IPC channel name, and the value is the handler function.
 */
module.exports = {
    reportError,
    getAsset,
    updateSetting,
    getAllSettings,
    getSetting,
};
