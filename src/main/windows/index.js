const { getMainWindow, createMainWindow } = require("./main-window");
const { getOrbWindow, setOrbWindow, createOrbWindow } = require("./orb-window");
const { getErrorService } = require("../services/error-service");

/**
 * @description Creates all application windows in parallel.
 * @returns {Promise<{mainWindow: Electron.BrowserWindow, orbWindow: Electron.BrowserWindow}>} A promise that resolves with the created windows.
 * @throws {Error} If window creation fails.
 */
async function createWindows() {
    try {
        // Create all windows in parallel and wait for them to load
        const [mainWindow, orbWindow] = await Promise.all([
            createMainWindow(),
            createOrbWindow(),
        ]);

        return { mainWindow, orbWindow };
    } catch (error) {
        const errorService = getErrorService();
        errorService.reportError(
            `Error creating windows: ${error.message}`,
            "windows"
        );
        throw error;
    }
}

module.exports = {
    createWindows,
    getMainWindow,
    getOrbWindow,
    setOrbWindow,
};
