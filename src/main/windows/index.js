const { getMainWindow, createMainWindow } = require("./main-window");
const { getOrbWindow, setOrbWindow, createOrbWindow } = require("./orb-window");

/**
 * @description Creates all application windows in parallel.
 * @returns {Promise<{mainWindow: Electron.BrowserWindow, orbWindow: Electron.BrowserWindow}>} A promise that resolves with the created windows.
 * @throws {Error} If window creation fails.
 */
async function createWindows() {
    // Parallelize window creation to improve startup time
    const [mainWindow, orbWindow] = await Promise.all([
        createMainWindow(),
        createOrbWindow(),
    ]);

    return { mainWindow, orbWindow };
}

module.exports = {
    createWindows,
    getMainWindow,
    getOrbWindow,
    setOrbWindow,
};
