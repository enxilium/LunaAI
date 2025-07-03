const { getErrorService } = require("./error-service.js");
const { getSettingsService } = require("./user/settings-service.js");
const { getCredentialsService } = require("./user/credentials-service.js");
const { getDataService } = require("./user/data-service.js");
const { getEventsService } = require("./events-service.js");
const { getGeminiService } = require("./agent/gemini-service.js");
const commands = require("../commands");

async function initializeServices() {
    console.log("Initializing services...");
    const errorService = getErrorService();
    const eventsService = await getEventsService();
    const credentialsService = getCredentialsService();

    await initializeCredentialsFromEnv();

    const settingsService = getSettingsService();
    const dataService = getDataService();

    const geminiService = await getGeminiService();

    return {
        errorService,
        credentialsService,
        settingsService,
        dataService,
        commands,
        eventsService,
        geminiService,
    };
}

async function initializeCredentialsFromEnv() {
    const credentialsService = getCredentialsService();

    // Define a map of credential keys to environment variable names
    const credentialsToStore = {
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
    getErrorService,
    getCredentialsService,
    getSettingsService,
    getDataService,
    getEventsService,
    getGeminiService,
};
