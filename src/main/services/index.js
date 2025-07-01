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
    const spotifyService = await getSpotifyService();
    const googleService = await getGoogleService();
    const credentialsService = getCredentialsService();
    const settingsService = getSettingsService();
    const dataService = getDataService();

    // Store Picovoice key if it exists in env and not in credentials
    const picovoiceKey = await credentialsService.getCredentials(
        "picovoice-key"
    );
    if (!picovoiceKey && process.env.PICOVOICE_ACCESS_KEY) {
        await credentialsService.setCredentials(
            "picovoice-key",
            process.env.PICOVOICE_ACCESS_KEY
        );
        console.log("Stored Picovoice access key.");
    }

    // Store Gemini key if it exists in env and not in credentials
    const geminiKey = await credentialsService.getCredentials("gemini-key");
    if (!geminiKey && process.env.GEMINI_API_KEY) {
        await credentialsService.setCredentials(
            "gemini-key",
            process.env.GEMINI_API_KEY
        );
        console.log("Stored Gemini API key.");
    }

    console.log("Services initialized.");

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
