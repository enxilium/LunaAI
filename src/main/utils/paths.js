const path = require("path");
const { app } = require("electron");
const isDev = process.env.NODE_ENV === "development";

/**
 * Get the appropriate path for an application asset
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

/**
 * Get path for a resource within the application bundle.
 * In development, it points to the 'app' directory.
 * In production, it points to the 'resources/app' directory.
 * @param {string} resourcePath - The relative path to the resource.
 * @returns {string} The absolute path to the resource.
 */
function getResourcePath(resourcePath) {
    if (isDev) {
        return path.join(process.cwd(), "app", resourcePath);
    }
    return path.join(process.resourcesPath, "app", resourcePath);
}

/**
 * Get path for image assets
 * @param {string} imageName - Image filename
 * @returns {string} Absolute path to the image file
 */
function getImagePath(imageName) {
    return getAssetPath("images", imageName);
}

/**
 * Get path for model assets
 * @param {string} modelName - Model filename
 * @returns {string} Absolute path to the model file
 */
function getModelPath(modelName) {
    return getAssetPath("models", modelName);
}


/**
 * Gets the path to the Python executable to run the agent process. Only used in development.
 * @returns 
 */
function getPythonPath() {
    const candidates =
        process.platform === "win32"
            ? ["python", "python3", "py"]
            : ["python3", "python"];

    for (const candidate of candidates) {
        try {
            const result = require("child_process").execSync(
                `${candidate} --version`,
                { encoding: "utf8", stdio: "pipe" }
            );
            if (result.includes("Python 3.")) {
                return candidate;
            }
        } catch (error) {
            // Continue to next candidate
        }
    }
    return null;
}

module.exports = {
    getAssetPath,
    getImagePath,
    getModelPath,
    getResourcePath,
    getPythonPath,
};
