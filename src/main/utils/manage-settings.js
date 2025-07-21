const { getSettingsService } = require("../services/user/settings-service");

/**
 * @description Retrieves settings from the settings service.
 * @param {string} keyName - The name of the key to retrieve.
 * @returns {Promise<string | null>} The retrieved key.
 */
function getSetting(keyName) {
    const settingsService = getSettingsService();
    return settingsService.getConfig(keyName);
}

/**
 * @description Retrieves all settings from the settings service.
 * @returns {Promise<object>} All settings.
 */
function getAllSettings() {
    const settingsService = getSettingsService();
    return settingsService.getConfig();
}

/**
 * @description Update an application setting.
 * @param {string} key - The key of the setting to update.
 * @param {any} value - The new value for the setting.
 * @returns {Promise<void>}
 */
async function updateSetting(key, value) {
    const settingsService = getSettingsService();
    settingsService.setConfig(key, value);
}

module.exports = {
    getSetting,
    getAllSettings,
    updateSetting,
};
