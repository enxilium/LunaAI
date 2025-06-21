const { getUserData } = require("../services/credentials-service");
const { getErrorService } = require("../services/error-service");

/**
 * Handles the get-settings invoke call
 * @param {string} setting - Optional specific setting to retrieve
 * @returns {Array|Object} - Array of settings or specific setting object
 */
async function getSettings(setting) {
    try {
        const userData = getUserData();
        const SETTINGS = [
            "spotifyAuth",
            "googleAuth",
            "discordAuth",
            "notionAuth",
            "clippingEnabled",
            "clipsFolder",
            "runOnStartup",
            "startMinimized",
            "automaticallyCheckForUpdates",
            "learningMode",
        ];

        if (!setting) {
            // If no specific setting is requested, return all settings
            const settingsObject = {};

            SETTINGS.forEach((settingName) => {
                settingsObject[settingName] = userData.getConfig(settingName);
            });

            return settingsObject;
        } else {
            return {
                field: setting,
                value: userData.getConfig(setting),
            };
        }
    } catch (error) {
        // Use the error service to report the error
        const errorService = getErrorService();
        errorService.reportError(error, 'get-settings');
    }
}

module.exports = { getSettings };
