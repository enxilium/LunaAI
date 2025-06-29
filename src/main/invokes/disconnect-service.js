const { getUserData } = require("../services/credentials-service");

/**
 * Handles the disconnect-service invoke call
 * @param {string} service - Service to disconnect
 * @returns {Object} - Disconnect result
 */
async function disconnectService(service) {
    const userData = getUserData();

    // TODO: Implement disconnect for all services

    if (service === "spotify") {
        await userData.deleteCredentials("spotify.accessToken");
        await userData.deleteCredentials("spotify.refreshToken");
        await userData.deleteCredentials("spotify.expiresAt");
        await userData.deleteConfig("spotifyAuth");
    } else if (service === "google") {
        await userData.deleteCredentials("google.accessToken");
        await userData.deleteCredentials("google.refreshToken");
        await userData.deleteCredentials("google.tokenExpiry");
        await userData.deleteConfig("googleAuth");
    }

    console.log("Disconnected from service:", service);

    return {
        value: true,
    };
}

module.exports = { disconnectService };
