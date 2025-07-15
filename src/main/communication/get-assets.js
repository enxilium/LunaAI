const path = require("path");
const { app } = require("electron");
const isDev = process.env.NODE_ENV === "development";

/**
 * @description Handler for retrieving assets needed by the main process (like tray icons).
 * Renderer processes should use direct webpack bundling for their assets.
 * @param {string} type - The type of asset to retrieve ('images' for main process assets).
 * @param {any[]} args - The arguments to pass to the respective handler.
 * @returns {Promise<any>} The requested asset path.
 */
async function getAsset(type, ...args) {
    switch (type) {
        case "images": {
            // Only for main process assets like tray icons
            const assetPath = getAssetPath("images", ...args);
            return assetPath;
        }
        default: {
            throw new Error(
                `Unsupported asset type: ${type}. Only 'images' is supported for main process.`
            );
        }
    }
}

/**
 * @description Handler specifically for retrieving credentials/keys.
 * This is separate from asset retrieval and used by renderer processes.
 * @param {string} keyName - The name of the key to retrieve.
 * @returns {Promise<string | null>} The requested credential/key.
 */
async function getKey(keyName) {
    return getAccessKey(keyName);
}

/**
 * @description Retrieves an access key from the credentials service.
 * @param {string} keyName - The name of the key to retrieve.
 * @returns {Promise<string | null>} The retrieved key.
 */
function getAccessKey(keyName) {
    const {
        getCredentialsService,
    } = require("../services/user/credentials-service");
    const credentialsService = getCredentialsService();
    return credentialsService.getCredentials(`${keyName}-key`);
}

/**
 * @description Get the appropriate path for a main process asset (like tray icons)
 * @param {string} assetType - Type of asset ('images')
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
    getKey,
};
