const { getSettingsService } = require("../services/user/settings-service");
const {
    getCredentialsService,
} = require("../services/user/credentials-service");
const { getErrorService } = require("../services/error-service");
const path = require("path");
const { app } = require("electron");
const isDev = process.env.NODE_ENV === "development";

/**
 * @description A centralized handler for retrieving various assets and data.
 * @param {string} type - The type of asset to retrieve (e.g., 'settings', 'tools', 'asset-path', 'gemini-key').
 * @param {any[]} args - The arguments to pass to the respective handler.
 * @returns {Promise<any>} The requested asset or data.
 */
async function getAsset(type, ...args) {
    console.log(`getAsset called with type: ${type} and args:`, args);
    switch (type) {
        case "setting":
            const setting = getSetting(...args);
            console.log("Returning setting:", setting);
            return setting;
        case "allSettings":
            const allSettings = getAllSettings();
            console.log("Returning all settings:", allSettings);
            return allSettings;
        case "tools":
            const tools = getTools();
            console.log("Returning tools:", tools);
            return tools;
        case "images":
            const assetPath = getAssetPath("images", ...args);
            console.log("Returning asset path:", assetPath);
            return assetPath;
        case "models":
            const modelPath = getAssetPath("models", ...args);
            console.log("Returning model path:", modelPath);
            return modelPath;
        case "key":
            const key = getAccessKey(...args);
            console.log("Returning key:", key);
            return key;
        default:
            const errorService = getErrorService();
            errorService.reportError(
                new Error(`Unknown asset type: ${type}`),
                "get-asset"
            );
    }
}

/**
 * @description Retrieves an access key from the credentials service.
 * @param {string} keyName - The name of the key to retrieve.
 * @returns {Promise<string | null>} The retrieved key.
 */
function getAccessKey(keyName) {
    const credentialsService = getCredentialsService();
    return credentialsService.getCredentials(`${keyName}-key`);
}

/**
 * @description Retrieves settings from the settings service.
 * @param {string} keyName - The name of the key to retrieve.
 * @returns {Promise<string | null>} The retrieved key.
 */
function getSetting(keyName) {
    const settingsService = getSettingsService();
    return settingsService.getConfig(keyName);
}

/**
 * @description Retrieves all settings from the settings service.
 * @returns {Promise<object>} All settings.
 */
function getAllSettings() {
    const settingsService = getSettingsService();
    return settingsService.getConfig();
}

/**
 * @description Get the appropriate path for an application asset
 * @param {string} assetType - Type of asset ('images', 'audio', 'models')
 * @param {string} assetName - The name of the asset file
 * @returns {string} Absolute path to the asset
 */
function getAssetPath(assetType, assetName) {
    // Both development and production use the same assets folder structure
    if (isDev) {
        // In development: use files from project directory
        return path.join(process.cwd(), "assets", assetType, assetName);
    } else {
        // In production: use files from assets directory in the app package
        return path.join(app.getAppPath(), "assets", assetType, assetName);
    }
}

function getTools() {
    return [
        {
            functionDeclarations: [
                {
                    name: "getDate",
                    description: "Gets the current date.",
                    behavior: "NON_BLOCKING",
                },
                {
                    name: "getTime",
                    description: "Gets the current time.",
                    behavior: "NON_BLOCKING",
                },
                {
                    name: "getWeather",
                    description: "Fetches weather data for a given location.",
                    parameters: {
                        type: "object",
                        properties: {
                            location: {
                                type: "string",
                                description:
                                    "The location to get the weather for.",
                            },
                        },
                        required: ["location"],
                    },
                },
                {
                    name: "playSong",
                    description: "Plays a song on Spotify.",
                    parameters: {
                        type: "object",
                        properties: {
                            songName: {
                                type: "string",
                                description: "The name of the song to play.",
                            },
                            artistName: {
                                type: "string",
                                description: "The name of the artist.",
                            },
                        },
                        required: ["songName"],
                    },
                },
                {
                    name: "resumePlayback",
                    description: "Resumes Spotify playback.",
                },
                {
                    name: "pausePlayback",
                    description: "Pauses Spotify playback.",
                },
                {
                    name: "skipTrack",
                    description: "Skips to the next track on Spotify.",
                },
                {
                    name: "playPreviousTrack",
                    description: "Goes to the previous track on Spotify.",
                },
                {
                    name: "shufflePlayback",
                    description: "Toggles shuffle on for Spotify.",
                },
                {
                    name: "increaseVolume",
                    description: "Increases the volume on Spotify.",
                },
                {
                    name: "decreaseVolume",
                    description: "Decreases the volume on Spotify.",
                },
                {
                    name: "openApplication",
                    description: "Opens an application on the user's system.",
                    behavior: "NON_BLOCKING",
                    parameters: {
                        type: "object",
                        properties: {
                            appName: {
                                type: "string",
                                description:
                                    "The name of the application to open.",
                            },
                        },
                        required: ["appName"],
                    },
                },
                {
                    name: "openWorkspace",
                    description: "Opens a specified workspace.",
                    behavior: "NON_BLOCKING",
                    parameters: {
                        type: "object",
                        properties: {
                            workspaceName: {
                                type: "string",
                                description:
                                    "The name of the workspace to open.",
                            },
                        },
                        required: ["workspaceName"],
                    },
                },
                {
                    name: "checkEmails",
                    description: "Gets unread emails from Gmail.",
                },
                {
                    name: "draftEmail",
                    description: "Creates a draft email in Gmail.",
                    behavior: "NON_BLOCKING",
                    parameters: {
                        type: "object",
                        properties: {
                            recipient: {
                                type: "string",
                                description:
                                    "The email address of the recipient.",
                            },
                            subject: {
                                type: "string",
                                description: "The subject of the email.",
                            },
                            body: {
                                type: "string",
                                description: "The body content of the email.",
                            },
                        },
                        required: ["recipient", "subject", "body"],
                    },
                },
                {
                    name: "getCalendarEvents",
                    description: "Gets upcoming events from Google Calendar.",
                },
                {
                    name: "createCalendarEvent",
                    description: "Creates a new event in Google Calendar.",
                    parameters: {
                        type: "object",
                        properties: {
                            title: {
                                type: "string",
                                description: "The title of the event.",
                            },
                            startTime: {
                                type: "string",
                                description: "The start time in ISO format.",
                            },
                            endTime: {
                                type: "string",
                                description: "The end time in ISO format.",
                            },
                            location: {
                                type: "string",
                                description: "The location of the event.",
                            },
                        },
                        required: ["title", "startTime", "endTime"],
                    },
                },
                {
                    name: "listDriveFiles",
                    description: "Lists files from Google Drive.",
                },
                {
                    name: "handleEnd",
                    behavior: "NON_BLOCKING",
                    description:
                        "Handles the end of a conversation. Should be called to end the current session after user is done with requests for the time being.",
                },
                {
                    name: "authorizeService",
                    description:
                        "When a tool call fails due to an authorization error, use this tool to initiate the authorization process for that service.",
                    behavior: "NON_BLOCKING",
                    parameters: {
                        type: "object",
                        properties: {
                            serviceName: {
                                type: "string",
                                description:
                                    "The name of the service that requires authorization, e.g., 'Spotify' or 'Google'.",
                            },
                        },
                        required: ["serviceName"],
                    },
                },
            ],
        },
    ];
}

module.exports = { getAsset };
