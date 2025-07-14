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
    switch (type) {
        case "images": {
            const assetPath = getAssetPath("images", ...args);
            return assetPath;
        }
        case "models": {
            const modelPath = getAssetPath("models", ...args);
            return modelPath;
        }
        case "key": {
            const key = getAccessKey(...args);
            return key;
        }
        case "font": {
            const fontPath = getAssetPath("fonts", ...args);
            return fontPath;
        }
        default: {
            const errorService = getErrorService();
            errorService.reportError(
                `Unknown asset type: ${type}`,
                "get-asset"
            );
            throw new Error(`Unknown asset type: ${type}`);
        }
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
 * @description Get the appropriate path for an application asset
 * @param {string} assetType - Type of asset ('images', 'models', 'config')
 * @param {string} assetName - The name of the asset file
 * @returns {string} Absolute path to the asset
 */
function getAssetPath(assetType, assetName) {
    // Security: validate asset type and name
    if (!assetType || !assetName) {
        throw new Error("Asset type and name are required");
    }

    // Prevent directory traversal
    if (assetType.includes("..") || assetName.includes("..")) {
        throw new Error("Invalid asset path");
    }

    const basePath = isDev
        ? path.join(process.cwd(), "assets")
        : path.join(app.getAppPath(), "assets");

    const fullPath = path.join(basePath, assetType, assetName);

    // Additional security: ensure path is within assets directory
    if (!fullPath.startsWith(basePath)) {
        throw new Error("Asset path outside allowed directory");
    }

    return fullPath;
}

module.exports = {
    getAsset,
};
