const { getSettingsService } = require("../services/user/settings-service");
const { getErrorService } = require("../services/error-service");

/**
 * @description Update an application setting.
 * @param {string} key - The key of the setting to update.
 * @param {any} value - The new value for the setting.
 * @returns {Promise<void>}
 */
async function updateSettings(key, value) {
    const settingsService = getSettingsService();
    settingsService.setConfig(key, value);
}

module.exports = { updateSettings };
