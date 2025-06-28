const { getUserData } = require("./credentials-service.js");
const { getSpotifyService } = require("./spotify-service.js");
const { getWitService } = require("./wit-service.js");
const { getAudioService } = require("./audio-service.js");
const { getEventsService } = require("./events-service.js");
const { getErrorService } = require("./error-service.js");
const { getNLGService } = require("./nlg-service.js");
const { getGoogleService } = require("./google-service.js");

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
    
    // Initialize Google service
    const googleService = await getGoogleService();
    
    if (googleService.isAuthorized()) {
        userData.setConfig("googleAuth", true);
    } else {
        userData.setConfig("googleAuth", false);
    }
    
    const witService = await getWitService();
    const audioService = await getAudioService();
    const nlgService = await getNLGService();
}

module.exports = {
    initializeServices,
    getUserData,
    getSpotifyService,
    getWitService,
    getAudioService,
    getEventsService,
    getErrorService,
    getGoogleService,
};
