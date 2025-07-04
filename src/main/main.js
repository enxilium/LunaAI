const { app, ipcMain, protocol, BrowserWindow, session } = require("electron");
const { createTray } = require("./tray");
const { createWindows } = require("./windows");
const { initializeServices } = require("./services");
const { getErrorService } = require("./services/error-service");
const { createOrbWindow } = require("./windows/orb-window");

require("dotenv").config();

/**
 * @description Initializes the application, including services, windows, and tray.
 */
async function initialize() {
    console.log("[Main] Starting Luna AI initialization...");

    // Register protocol handler for local files
    protocol.registerFileProtocol("file", (request, callback) => {
        const url = request.url.replace("file:///", "");
        try {
            return callback(decodeURIComponent(url));
        } catch (error) {
            const errorService = getErrorService();
            errorService.reportError(
                `Protocol handler error: ${error.message}`,
                "main"
            );
        }
    });

    try {
        // Initialize services BEFORE creating windows
        await initializeServices().then(async () => {
            console.log("[Main] Services initialized");
            await createWindows().then(async () => {
                console.log("[Main] Windows created");
                const tray = await createTray().then(() => {
                    console.log("[Main] Tray created");
                });
            });
        });

        // Log initialization complete
        console.log("[Main] Luna AI initialized and ready");
    } catch (error) {
        const errorService = getErrorService();
        errorService.reportError(
            `Initialization error: ${error.message}`,
            "main"
        );
    }
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
                    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:3000 blob:; connect-src 'self' ws://localhost:3000 wss://generativelanguage.googleapis.com; worker-src 'self' blob:;",
                ],
            },
        });
    });
    initialize();
});

app.on("quit", () => {
    app.quit();
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
    app.quit();
}

// Quit when all windows are closed, except on macOS.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createOrbWindow();
    }
});
