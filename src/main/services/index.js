const getUserData = require('./credentials-service.js');
const getSpotifyService = require('./spotify-service.js');
const getWitService = require('./wit-service.js');
const { getAudioService } = require('./audio-service.js');

async function initializeServices() {
    const userData = getUserData();
    const spotifyService = await getSpotifyService();
    const witService = await getWitService();
    const audioService = await getAudioService();

    if (spotifyService.isAuthorized()) {
        userData.setConfig("spotifyAuthorized", true);
    } else {
        userData.setConfig("spotifyAuthorized", false);
    }
}

module.exports = {
    initializeServices,
};