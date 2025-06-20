const { getUserData } = require("../services/credentials-service");
const { getEventsService } = require("../services/events-service");

/**
 * Handles the get-settings invoke call
 * @param {string} setting - Optional specific setting to retrieve
 * @returns {Array|Object} - Array of settings or specific setting object
 */
async function getSettings(setting) {
    // TODO: Error handling
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
}

module.exports = { getSettings };
