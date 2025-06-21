const { getUserData } = require("../services/credentials-service");
const { getErrorService } = require("../services/error-service");

/**
 * Updates a user setting
 * @param {string} setting - The setting to update
 * @param {any} value - The new value for the setting
 * @returns {Object} - The updated setting
 */
async function updateSettings(setting, value) {
    try {
        const userData = getUserData();
        userData.setConfig(setting, value);
        
        return {
            field: setting,
            value: userData.getConfig(setting)
        };
    } catch (error) {
        // Use the error service to report the error
        const errorService = getErrorService();
        errorService.reportError(error, 'update-settings');
    }
}

module.exports = { updateSettings };