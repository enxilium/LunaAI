const getUserData = require("../../services/credentials-service");

/**
 * Handles the get-settings invoke call
 * @param {string} setting - Optional specific setting to retrieve
 * @returns {Array|Object} - Array of settings or specific setting object
 */
async function getSettings(setting) {
    const userData = getUserData();
    const settings = ["spotifyAuthorized"];
    
    if (!setting) {
        return settings.map((setting) => ({
            field: setting,
            value: userData.getConfig(setting),
        }));
    } else {
        return {
            field: setting,
            value: userData.getConfig(setting),
        };
    }
}

module.exports = getSettings; 