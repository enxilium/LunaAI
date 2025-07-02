const { getSettingsService } = require("../services/user/settings-service");
const {
    getCredentialsService,
} = require("../services/user/credentials-service");
const { getErrorService } = require("../services/error-service");
const path = require("path");
const fs = require("fs").promises;
const { app } = require("electron");
const isDev = process.env.NODE_ENV === "development";

/**
 * @description A centralized handler for retrieving various assets and data.
 * @param {string} type - The type of asset to retrieve (e.g., 'settings', 'tools', 'asset-path', 'gemini-key').
 * @param {any[]} args - The arguments to pass to the respective handler.
 * @returns {Promise<any>} The requested asset or data.
 */
async function getAsset(type, ...args) {
    switch (type) {
        case "setting":
            const setting = getSetting(...args);
            return setting;
        case "allSettings":
            const allSettings = getAllSettings();
            return allSettings;
        case "tools":
            const tools = getTools();
            return tools;
        case "images":
            const assetPath = getAssetPath("images", ...args);
            return assetPath;
        case "models":
            const modelPath = getAssetPath("models", ...args);
            return modelPath;
        case "key":
            const key = getAccessKey(...args);
            return key;
        case "systemInstruction":
            const instruction = getSystemInstruction();
            return instruction;
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

async function getGeminiConfig() {
    const configPath = getAssetPath("config", "gemini-config.json");
    try {
        const configData = await fs.readFile(configPath, "utf-8");
        return JSON.parse(configData);
    } catch (error) {
        const errorService = getErrorService();
        errorService.reportError(
            new Error(`Failed to read or parse gemini-config.json: ${error}`),
            "get-asset"
        );
        return null;
    }
}

async function getTools() {
    const config = await getGeminiConfig();
    return config ? config.tools : [];
}

async function getSystemInstruction() {
    const config = await getGeminiConfig();
    return config ? config.systemInstruction : "";
}

module.exports = { getAsset };
