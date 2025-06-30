const { getSpotifyService } = require("./spotify-service.js");
const { getGoogleService } = require("./google-service.js");
const { getErrorService } = require("./error-service.js");
const commands = require("../commands");
const { getEventsService } = require("./events-service.js");

let settingsService;

async function initializeServices() {
    console.log("Initializing services...");
    const errorService = getErrorService();
    const eventsService = getEventsService();
    const spotifyService = await getSpotifyService();
    const googleService = await getGoogleService();

    console.log("Services initialized.");

    return {
        spotifyService,
        googleService,
        errorService,
        commands,
        eventsService,
    };
}

module.exports = {
    initializeServices,
    getSpotifyService,
    getGoogleService,
    getErrorService,
    getCommands: () => commands,
    getEventsService,
};
