const { getUserData } = require("../services/credentials-service");
const { getErrorService } = require("../services/error-service");

/**
 * Handles the authorize-service invoke call
 * @param {string} service - Service to authorize
 * @returns {Object} - Authorization result
 */
async function authorizeService(service) {
    let authorizeSuccess = false;
    const userData = getUserData();

    switch (service) {
        case "spotify":
            // Lazy load the Spotify service
            const { getSpotifyService } = require("../services/spotify-service");
            const spotifyService = await getSpotifyService();
            authorizeSuccess = await spotifyService.authorize();
            userData.setConfig("spotifyAuth", authorizeSuccess);
            break;
        case "google":
            // Lazy load the Google service
            const { getGoogleService } = require("../services/google-service");
            const googleService = await getGoogleService();
            authorizeSuccess = await googleService.authorize();
            userData.setConfig("googleAuth", authorizeSuccess);
            break;
        default:
            const errorService = getErrorService();
            errorService.reportError(new Error("Authorization not supported for this service"), 'authorize-service');
    }

    return authorizeSuccess;
}

module.exports = { authorizeService };
