const getUserData = require("../../services/credentials-service");
const getSpotifyService = require("../../services/spotify-service");

/**
 * Handles the authorize-service invoke call
 * @param {string} service - Service to authorize
 * @returns {Object} - Authorization result
 */
async function authorizeService(service) {
    let authorizeSuccess = false;

    switch (service) {
        case "spotify":
            const spotifyService = await getSpotifyService();
            authorizeSuccess = await spotifyService.authorize();
            getUserData().setConfig("spotifyAuth", authorizeSuccess);
            break;
        default:
            throw new Error("Authorization not supported for this service");
    }

    return authorizeSuccess;
}

module.exports = authorizeService; 