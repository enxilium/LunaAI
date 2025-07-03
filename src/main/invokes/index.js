const { updateSettings } = require("./update-settings");
const { reportError } = require("./error");
const { executeCommand } = require("./execute-command");
const { getAsset } = require("./get-asset");

module.exports = {
    "get-asset": getAsset,
    "update-settings": updateSettings,
    "execute-command": executeCommand,
    "error": reportError,
};
