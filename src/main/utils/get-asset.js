const path = require("path");
const { app } = require("electron");
const isPackaged = app.isPackaged;

/**
 * @description Get asset paths for both resources and assets.
 * @param {string} assetName - The name/path of the asset.
 * @param {string|null} assetType - Optional asset type ('images', 'audio', 'models', etc.).
 *                                  If null, treats as resource path for app files.
 * @returns {string} Absolute path to the asset.
 */
function getAsset(assetName, assetType = null) {
    // Security: validate inputs
    if (!assetName) {
        throw new Error("Asset name is required");
    }

    // Prevent directory traversal
    if (assetName.includes("..") || (assetType && assetType.includes(".."))) {
        throw new Error("Invalid asset path");
    }

    if (assetType === null) {
        // Resource path behavior - for app files (HTML, JS, etc.)
        if (!isPackaged) {
            // Development: files are in the source directory structure
            return path.join(process.cwd(), "src", "renderer", assetName);
        } else {
            // Production: files are in the app resources
            return path.join(process.resourcesPath, "app", assetName);
        }
    } else {
        // Asset path behavior - for static assets (images, audio, models, etc.)
        const basePath = !isPackaged
            ? path.join(process.cwd(), "assets")
            : path.join(app.getAppPath(), "assets");

        return path.join(basePath, assetType, assetName);
    }
}

module.exports = {
    getAsset,
};
