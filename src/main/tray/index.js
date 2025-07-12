const { app, Menu, Tray } = require("electron");
const { getAsset } = require("../communication/get-assets");
const { getMainWindow, createMainWindow } = require("../windows/main-window");
const { getErrorService } = require("../services/error-service");

/**
 * @description Creates the system tray icon and menu.
 * @returns {Promise<Electron.Tray>} A promise that resolves with the created tray.
 * @throws {Error} If tray creation fails.
 */
async function createTray() {
    try {
        const iconPath = await getAsset("images", "luna-tray.png");
        const tray = new Tray(iconPath);
        tray.setToolTip("Luna Assistant");
        tray.setContextMenu(
            Menu.buildFromTemplate([
                {
                    label: "Show",
                    click: () => {
                        try {
                            const mainWindow = getMainWindow();
                            mainWindow ? mainWindow.show() : createMainWindow();
                        } catch (error) {
                            getErrorService().reportError(
                                `Error showing main window: ${error.message}`,
                                "tray"
                            );
                        }
                    },
                },
                {
                    label: "Hide",
                    click: () => {
                        try {
                            const mainWindow = getMainWindow();
                            if (mainWindow) {
                                mainWindow.hide();
                            }
                        } catch (error) {
                            getErrorService().reportError(
                                `Error hiding main window: ${error.message}`,
                                "tray"
                            );
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
            try {
                const mainWindow = getMainWindow();
                mainWindow ? mainWindow.show() : createMainWindow();
            } catch (error) {
                getErrorService().reportError(
                    `Error showing main window on double-click: ${error.message}`,
                    "tray"
                );
            }
        });

        return tray;
    } catch (error) {
        getErrorService().reportError(
            `Error creating tray: ${error.message}`,
            "tray"
        );
        throw error;
    }
}

module.exports = {
    createTray,
};
