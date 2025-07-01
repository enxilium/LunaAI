const {
    getSpotifyService,
} = require("../services/integrations/spotify-service");
const { getGoogleService } = require("../services/integrations/google-service");
const { getErrorService } = require("../services/error-service");

/**
 * @description Disconnect a service.
 * @param {string} serviceName - The name of the service to disconnect.
 * @returns {Promise<any>} A promise that resolves with the result of the disconnection.
 */
async function disconnectService({serviceName}) {
    serviceName = serviceName.toLowerCase();

    console.log("Disconnecting service:", serviceName);

    try {
        if (serviceName === "spotify") {
            const spotifyService = await getSpotifyService();
            return await spotifyService.disconnect();
        } else if (serviceName === "google") {
            const googleService = await getGoogleService();
            return await googleService.disconnect();
        }
    } catch (error) {
        const errorService = getErrorService();
        errorService.reportError(error, "disconnect-service");
    }
}

module.exports = { disconnectService };
