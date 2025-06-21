const { app, ipcMain, protocol, BrowserWindow } = require("electron");
const { createTray } = require("./tray");
const { createWindows } = require("./windows");
const { initializeServices } = require("./services");
const { getErrorService } = require("./services/error-service");

require("dotenv").config();

// Set up the preload log handler EARLY, before window creation
ipcMain.on("preload-log", (event, ...args) => {
    console.log("[PRELOAD]", ...args);
});

async function initialize() {
    console.log("Starting Luna AI initialization...");

    // Register protocol handler for local files
    protocol.registerFileProtocol("file", (request, callback) => {
        const url = request.url.replace("file:///", "");
        try {
            return callback(decodeURIComponent(url));
        } catch (error) {
            const errorService = getErrorService();
            errorService.reportError(error, 'protocol-handler');
        }
    });

    try {
        await createWindows();
        console.log("All windows created and loaded");

        console.log("Creating tray...");
        createTray();

        console.log("Initializing services...");
        await initializeServices();

        // Log initialization complete
        console.log("Luna AI initialized and ready");
    } catch (error) {
        const errorService = getErrorService();
        errorService.reportError(error, 'main-initialization');
    }
}

// Entry point
app.whenReady().then(() => {
    initialize();
});

app.on("quit", () => {
    app.quit();
});
