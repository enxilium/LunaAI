const { updateSettings } = require("./update-settings");
const { authorizeService } = require("./authorize-service");
const { disconnectService } = require("./disconnect-service");
const { reportError } = require("./error");
const { executeCommand } = require("./execute-command");
const { getAsset } = require("./get-asset");

module.exports = {
    "get-asset": getAsset,
    "update-settings": updateSettings,
    "authorize-service": authorizeService,
    "disconnect-service": disconnectService,
    "execute-command": executeCommand,
    error: reportError,
};
