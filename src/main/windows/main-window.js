const { BrowserWindow } = require('electron');
const path = require('path');
const { getResourcePath } = require('../utils/paths');

let mainWindow = null;

function createMainWindow() {
    return new Promise((resolve, reject) => {
        mainWindow = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                preload: path.join(__dirname, "../../preload/preload.js"),
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        // Resolve promise when window is ready
        mainWindow.webContents.once('did-finish-load', () => {
            console.log('Main window loaded successfully');
            resolve(mainWindow);
        });

        // Reject promise if there's an error
        mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
            const error = new Error(`Failed to load main window: ${errorDescription} (${errorCode})`);
            console.error(error);
            reject(error);
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
    });
}

function getMainWindow() {
    return mainWindow;
}

module.exports = {
    createMainWindow,
    getMainWindow,
};