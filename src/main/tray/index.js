const { app, Menu, Tray } = require("electron");
const { getAsset } = require("../utils/get-asset");
const { getMainWindow, createMainWindow } = require("../windows/main-window");

/**
 * @description Creates the system tray icon and menu.
 * @returns {Promise<Electron.Tray>} A promise that resolves with the created tray.
 * @throws {Error} If tray creation fails.
 */
async function createTray() {
    const iconPath = getAsset("luna-tray.png", "images");
    const tray = new Tray(iconPath);
    tray.setToolTip("Luna Assistant");
    tray.setContextMenu(
        Menu.buildFromTemplate([
            {
                label: "Show",
                click: () => {
                    const mainWindow = getMainWindow();
                    mainWindow ? mainWindow.show() : createMainWindow();
                },
            },
            {
                label: "Hide",
                click: () => {
                    const mainWindow = getMainWindow();
                    if (mainWindow) {
                        mainWindow.hide();
                    }
                },
            },
            {
                label: "Quit",
                click: () => {
                    app.quit();
                },
            },
        ])
    );

    tray.on("double-click", () => {
        const mainWindow = getMainWindow();
        mainWindow ? mainWindow.show() : createMainWindow();
    });

    return tray;
}

module.exports = {
    createTray,
};
