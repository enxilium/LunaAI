const {
    getSpotifyService,
} = require("../services/integrations/spotify-service");
const { getGoogleService } = require("../services/integrations/google-service");
const { getErrorService } = require("../services/error-service");

/**
 * @description Authorize a service.
 * @param {string} serviceName - The name of the service to authorize.
 * @returns {Promise<void>}
 */
async function authorizeService({ serviceName }) {
    serviceName = serviceName.toLowerCase();

    try {
        switch (serviceName) {
            case "spotify": {
                const spotifyService = await getSpotifyService();
                return await spotifyService.authorize();
            }
            case "google": {
                const googleService = await getGoogleService();
                return await googleService.authorize();
            }
            default:
                throw new Error(`Service not recognized: ${serviceName}`);
        }
    
    } catch (error) {
        const errorService = getErrorService();
        errorService.reportError(error, "authorize-service");
    }
}

module.exports = { authorizeService };
