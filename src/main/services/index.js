const { getSettingsService } = require("./user/settings-service.js");
const { getCredentialsService } = require("./user/credentials-service.js");
const { getDataService } = require("./user/data-service.js");
const { getEventsService } = require("./events-service.js");
const { StreamingServerService } = require("./streaming-server-service.js");

// Global streaming server instance
let streamingServerService = null;

/**
 * @description Gets or creates the streaming server service instance.
 * @returns {StreamingServerService} The streaming server service instance.
 */
function getStreamingServerService() {
    if (!streamingServerService) {
        streamingServerService = new StreamingServerService();
    }
    return streamingServerService;
}

/**
 * @description Initializes all application services.
 * @returns {Promise<Object>} A promise that resolves with an object containing all service instances.
 */
async function initializeServices() {
    console.log("[Services] Initializing services...");
    const eventsService = await getEventsService();
    const credentialsService = getCredentialsService();

    await initializeCredentialsFromEnv();

    const settingsService = getSettingsService();
    const dataService = getDataService();
    const streamingServerService = getStreamingServerService();

    // Start the streaming server
    console.log("[Services] Starting streaming server...");
    const serverStarted = await streamingServerService.startServer();
    if (!serverStarted) {
        console.error("[Services] Failed to start streaming server");
    }

    return {
        credentialsService,
        settingsService,
        dataService,
        eventsService,
        streamingServerService,
    };
}

/**
 * @description Initializes credentials from environment variables.
 * @returns {Promise<void>} A promise that resolves when credentials are initialized.
 */
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

    for (const [key, value] of Object.entries(credentialsToStore)) {
        if (value) {
            await credentialsService.setCredentials(key, value);
        }
    }
}

module.exports = {
    initializeServices,
    getCredentialsService,
    getSettingsService,
    getDataService,
    getEventsService,
    getStreamingServerService,
};
