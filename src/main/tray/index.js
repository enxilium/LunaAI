const { app, Menu, Tray } = require("electron");
const { getAsset } = require("../invokes/get-asset");
const { getMainWindow, createMainWindow } = require("../windows/main-window");

async function createTray() {
    const iconPath = await getAsset("images", "luna-tray.png");
    console.log(iconPath);
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
