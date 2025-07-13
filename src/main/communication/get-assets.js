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
        default: {
            const errorService = getErrorService();
            errorService.reportError(
                new Error(`Unknown asset type: ${type}`),
                "get-asset"
            );
            return null;
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
 * @param {string} assetType - Type of asset ('images', 'audio', 'models')
 * @param {string} assetName - The name of the asset file
 * @returns {string} Absolute path to the asset
 */
function getAssetPath(assetType, assetName) {
    // Option 1: Use file paths (current approach - works with file: protocol in CSP)
    // if (isDev) {
    //     // In development: use files from project directory
    //     return path.join(process.cwd(), "assets", assetType, assetName);
    // } else {
    //     // In production: use files from assets directory in the app package
    //     return path.join(app.getAppPath(), "assets", assetType, assetName);
    // }

    // Option 2: Use custom luna-asset:// protocol (more secure alternative)
    // Uncomment the line below and comment out the above if block to use custom protocol
    return `luna-asset://${assetType}/${assetName}`;
}

module.exports = {
    getAsset,
};
