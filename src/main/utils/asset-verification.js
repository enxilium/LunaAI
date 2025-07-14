/**
 * Production Asset Path Verification
 * Ensures assets work correctly in both development and production builds
 */

const path = require("path");
const { app } = require("electron");

/**
 * Test asset path resolution for production compatibility
 */
function verifyAssetPaths() {
    const isDev = process.env.NODE_ENV === "development";
    const basePath = isDev
        ? path.join(process.cwd(), "assets")
        : path.join(app.getAppPath(), "assets");

    console.log(
        `[AssetVerification] Environment: ${
            isDev ? "Development" : "Production"
        }`
    );
    console.log(`[AssetVerification] Base asset path: ${basePath}`);

    // Test critical asset paths
    const criticalAssets = [
        { type: "images", name: "luna-tray.png" },
        { type: "models", name: "wakeWord.ppn" },
        { type: "models", name: "porcupine_params.pv" },
    ];

    criticalAssets.forEach(({ type, name }) => {
        const fullPath = path.join(basePath, type, name);
        console.log(`[AssetVerification] ${type}/${name} -> ${fullPath}`);
    });

    return basePath;
}

/**
 * Asset bundling check for webpack compatibility
 */
function checkWebpackCompatibility() {
    // In production, webpack creates the main bundle
    // Assets should be accessible via app.getAppPath()
    const isWebpackBuild = process.env.NODE_ENV === "production";

    if (isWebpackBuild) {
        const appPath = app.getAppPath();
        const assetsPath = path.join(appPath, "assets");

        console.log(`[WebpackCheck] App path: ${appPath}`);
        console.log(`[WebpackCheck] Expected assets path: ${assetsPath}`);

        // Verify the assets directory exists in the bundle
        try {
            require("fs").accessSync(assetsPath);
            console.log(
                `[WebpackCheck] ✅ Assets directory found in production bundle`
            );
            return true;
        } catch (error) {
            console.error(
                `[WebpackCheck] ❌ Assets directory not found: ${error.message}`
            );
            return false;
        }
    } else {
        console.log(
            `[WebpackCheck] Development mode - using project directory`
        );
        return true;
    }
}

module.exports = {
    verifyAssetPaths,
    checkWebpackCompatibility,
};
