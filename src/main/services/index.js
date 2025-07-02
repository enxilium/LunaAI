const { getSpotifyService } = require("./integrations/spotify-service.js");
const { getGoogleService } = require("./integrations/google-service.js");
const { getErrorService } = require("./error-service.js");
const { getSettingsService } = require("./user/settings-service.js");
const { getCredentialsService } = require("./user/credentials-service.js");
const { getDataService } = require("./user/data-service.js");
const { getEventsService } = require("./events-service.js");
const commands = require("../commands");

async function initializeServices() {
    console.log("Initializing services...");
    const errorService = getErrorService();
    const eventsService = getEventsService();
    const credentialsService = getCredentialsService();

    await initializeCredentialsFromEnv();

    const settingsService = getSettingsService();
    const dataService = getDataService();

    const spotifyService = await getSpotifyService();
    const googleService = await getGoogleService();

    return {
        spotifyService,
        googleService,
        errorService,
        credentialsService,
        settingsService,
        dataService,
        commands,
        eventsService,
    };
}

async function initializeCredentialsFromEnv() {
    const credentialsService = getCredentialsService();

    // Define a map of credential keys to environment variable names
    const credentialsToStore = {
        "spotify-client-id": process.env.SPOTIFY_CLIENT_ID,
        "spotify-client-secret": process.env.SPOTIFY_CLIENT_SECRET,
        "spotify-redirect-uri": process.env.SPOTIFY_REDIRECT_URI,
        "google-client-id": process.env.GOOGLE_CLIENT_ID,
        "google-client-secret": process.env.GOOGLE_CLIENT_SECRET,
        "google-redirect-uri": process.env.GOOGLE_REDIRECT_URI,
        "discord-client-id": process.env.DISCORD_CLIENT_ID,
        "discord-client-secret": process.env.DISCORD_CLIENT_SECRET,
        "notion-client-id": process.env.NOTION_CLIENT_ID,
        "notion-client-secret": process.env.NOTION_CLIENT_SECRET,
        "weather-api-key": process.env.WEATHERAPI_KEY,
        "gemini-key": process.env.GEMINI_API_KEY,
        "picovoice-key": process.env.PICOVOICE_ACCESS_KEY,
    };

    console.log("Initializing credentials from environment variables...");

    for (const [key, value] of Object.entries(credentialsToStore)) {
        if (value) {
            try {
                await credentialsService.setCredentials(key, value);
                console.log(`Successfully stored ${key}.`);
            } catch (error) {
                console.error(`Failed to store ${key}:`, error);
            }
        } else {
            console.warn(`Environment variable for ${key} is not set.`);
        }
    }
}

module.exports = {
    initializeServices,
    getSpotifyService,
    getGoogleService,
    getErrorService,
    getCredentialsService,
    getSettingsService,
    getDataService,
    getEventsService,
};
