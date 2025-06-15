const { app, ipcMain, protocol, BrowserWindow } = require("electron");
const { createTray } = require("./tray");
const { createWindows } = require("./windows");
const { handleCommand } = require("./commands");
const { initializeServices } = require("./services");
const handleInvoke = require("./invokes");
const { getAudioService } = require("./services/audio-service");
const { appEvents, EVENTS } = require("./events");
require("dotenv").config();

let audioService = null;

// Global state for listening status
let listeningStatus = {
    status: "idle",
    message: "System is idle"
};

async function initialize() {
    // Register protocol handler for local files
    protocol.registerFileProtocol('file', (request, callback) => {
        const url = request.url.replace('file:///', '');
        try {
            return callback(decodeURIComponent(url));
        } catch (error) {
            console.error('Error with protocol handler:', error);
        }
    });
    
    createWindows();
    createTray();
    initializeServices();
    
    // Get audio service and set up event forwarding
    audioService = await getAudioService();

    // Set up event listeners for app events
    setupAppEventListeners();
}

// Setup IPC handlers
function setupIpcHandlers() {
    // Handle invokes using the centralized pattern
    ipcMain.handle('invoke', async (event, request) => {
        try {
            return await handleInvoke(request, { listeningStatus });
        } catch (error) {
            console.error(`Error handling invoke ${request.name}:`, error);
            return { error: error.message };
        }
    });

    // Handle commands from renderer
    ipcMain.on('command', (event, command) => {
        handleCommand(command);
    });
    
    // Handle audio data from renderer
    ipcMain.on('audio-data', (event, data) => {
        try {
            if (!data || !data.data) {
                console.error('Received invalid audio data', data);
                return;
            }
            
            // Ensure we have the audio service
            if (!audioService) {
                console.error('Audio service not available');
                return;
            }

            // Process audio data in the audio service
            audioService.processAudioData(data.data, data.sampleRate);
        } catch (error) {
            console.error('Error handling audio data:', error);
        }
    });
}

// Entry point
app.whenReady().then(() => {
    initialize();
    setupIpcHandlers();
});

app.on("quit", () => {
    app.quit();
});
