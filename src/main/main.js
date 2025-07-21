const { app, session, BrowserWindow } = require("electron");
const { createTray } = require("./tray");
const { createWindows } = require("./windows");
const { initializeServices } = require("./services");
const logger = require("./utils/logger");

require("dotenv").config();

/**
 * @description Initializes the application, including services, windows, and tray.
 * @returns {Promise<void>} A promise that resolves when initialization is complete.
 */
async function initialize() {
    logger.info("Main", "Starting Luna AI initialization...");

    try {
        await initializeServices();
        await createWindows();
        await createTray();
    } catch (error) {
        logger.error("Main", `Initialization failed: ${error.message}`);
        app.quit();
    }

    logger.success("Main", "Luna AI initialized and ready");
}

// Entry point
app.whenReady().then(() => {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                // WARNING: The current Content-Security-Policy is permissive and should be
                // tightened for production.
                "Content-Security-Policy": [
                    "default-src 'self' 'unsafe-inline'; connect-src 'self' file: luna-asset: ws://localhost:* wss://localhost:* https://*.picovoice.ai https://*.picovoice.net https://kmp1.picovoice.net wss://*.picovoice.ai wss://*.picovoice.net https://generativelanguage.googleapis.com https://*.googleapis.com; media-src 'self' blob:; script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:3000 blob:; script-src-elem 'self' 'unsafe-inline' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;",
                ],
            },
        });
    });
    initialize();
});

/**
 * @description Sets the app.isQuitting flag when the app is about to quit.
 * This ensures that windows close properly during app shutdown.
 */
app.on("before-quit", () => {
    app.isQuitting = true;
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
    app.quit();
}

/**
 * @description Quits the app when all windows are closed, except on macOS.
 */
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

/**
 * @description Re-creates windows when the app is activated with no windows open.
 * This is common on macOS when the dock icon is clicked.
 */
app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindows();
    }
});
