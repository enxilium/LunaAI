const { getUserData } = require("./credentials-service.js");
const { getSpotifyService } = require("./spotify-service.js");
const { getWitService } = require("./wit-service.js");
const { getAudioService } = require("./audio-service.js");
const { getEventsService } = require("./events-service.js");
const { getErrorService } = require("./error-service.js");

async function initializeServices() {
    // Initialize error service first so it's ready to receive errors
    const errorService = getErrorService();
    
    // Then initialize the events service which will subscribe to the error service
    const eventsService = await getEventsService();

    const userData = getUserData();
    const spotifyService = await getSpotifyService();

    if (spotifyService.isAuthorized()) {
        userData.setConfig("spotifyAuth", true);
    } else {
        userData.setConfig("spotifyAuth", false);
    }
    
    const witService = await getWitService();
    const audioService = await getAudioService();
}

module.exports = {
    initializeServices,
    getUserData,
    getSpotifyService,
    getWitService,
    getAudioService,
    getEventsService,
    getErrorService,
};
