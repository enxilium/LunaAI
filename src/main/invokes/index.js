const { updateSettings } = require("./update-settings");
const { reportError } = require("./report-error");
const { getAsset } = require("./get-asset");

module.exports = {
    "get-asset": getAsset,
    "update-settings": updateSettings,
    "error": reportError,
};
