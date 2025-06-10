const { BrowserWindow } = require('electron');
const path = require('path');
const { getResourcePath } = require('../utils/paths');

let mainWindow = null;

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, "../../preload/preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
    }
    else {
        mainWindow.loadFile(getResourcePath('app/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function getMainWindow() {
    return mainWindow;
}

module.exports = {
    createMainWindow,
    getMainWindow,
};