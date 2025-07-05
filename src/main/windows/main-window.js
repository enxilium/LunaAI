const { BrowserWindow } = require("electron");
const { getResourcePath } = require("../utils/paths");
const { getErrorService } = require("../services/error-service");

let mainWindow = null;

function createMainWindow() {
    return new Promise((resolve, reject) => {
        mainWindow = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        // Resolve promise when window is ready
        mainWindow.webContents.once("did-finish-load", () => {
            console.log("[Main Window] Loaded successfully");
            resolve(mainWindow);
        });

        // Reject promise if there's an error
        mainWindow.webContents.on(
            "did-fail-load",
            (_, errorCode, errorDescription) => {
                const error = new Error(
                    `Failed to load main window: ${errorDescription} (${errorCode})`
                );
                const errorService = getErrorService();
                errorService.reportError(error.message, "main-window");
                reject(error);
            }
        );

        if (process.env.NODE_ENV === "development") {
            mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
        } else {
            mainWindow.loadFile(getResourcePath("app/index.html"));
        }

        mainWindow.on("closed", () => {
            mainWindow = null;
        });
    });
}

function getMainWindow() {
    return mainWindow;
}

module.exports = {
    createMainWindow,
    getMainWindow,
};
