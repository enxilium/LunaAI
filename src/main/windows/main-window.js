const { BrowserWindow, app } = require("electron");
const { getAsset } = require("../utils/get-asset");

let mainWindow = null;

/**
 * @description Creates the main application window.
 * @returns {Promise<Electron.BrowserWindow>} A promise that resolves with the created window.
 * @throws {Error} If window creation fails.
 */
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
            resolve(mainWindow);
        });

        // Reject promise if there's an error
        mainWindow.webContents.on(
            "did-fail-load",
            async (_, errorCode, errorDescription) => {
                const error = new Error(
                    `Failed to load main window: ${errorDescription} (${errorCode})`
                );

                reject(error);
            }
        );

        if (!app.isPackaged) {
            mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
        } else {
            mainWindow.loadFile(getAsset("main/index.html"));
        }

        mainWindow.on("closed", () => {
            mainWindow = null;
        });
    });
}

/**
 * @description Gets the current main window instance.
 * @returns {Electron.BrowserWindow|null} The main window instance or null if it doesn't exist.
 */
function getMainWindow() {
    return mainWindow;
}

module.exports = {
    createMainWindow,
    getMainWindow,
};
