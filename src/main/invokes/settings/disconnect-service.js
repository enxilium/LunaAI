const getUserData = require("../../services/credentials-service");

/**
 * Handles the disconnect-service invoke call
 * @param {string} service - Service to disconnect
 * @returns {Object} - Disconnect result
 */
async function disconnectService(service) {
    const userData = getUserData();
    
    if (service === "spotify") {
        await userData.deleteCredentials("spotify.accessToken");
        await userData.deleteCredentials("spotify.refreshToken");
        await userData.deleteCredentials("spotify.expiresAt");

        await userData.deleteConfig("spotifyAuthorized");
    }

    console.log("Disconnected from service:", service);
    
    return {
        field: service + "Authorized",
        value: false
    };
}

module.exports = disconnectService; 