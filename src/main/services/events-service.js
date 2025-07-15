const { EventEmitter } = require("events");
const { ipcMain } = require("electron");
const { getMainWindow, getOrbWindow } = require("../windows");
const {
    updateSetting,
    getAllSettings,
    getSetting,
} = require("../communication");
const { getAccessKey } = require("../utils/get-paths");
const {
    getLiveKitToken,
    getLiveKitServerUrl,
} = require("./agent/livekit-service");

let eventsService = null;

/**
 * @class EventsService
 * @description Centralized Events Service
 * Handles all event communication between main process components
 * and between main process and renderer process
 * @extends EventEmitter
 */
class EventsService extends EventEmitter {
    /**
     * @description Creates an instance of EventsService.
     */
    constructor() {
        super();

        this.debugMode = process.env.NODE_ENV === "development";
    }

    /**
     * @description Initialize the events service.
     */
    initialize() {
        this._setupIpcHandlers();
    }

    /**
     * @description Centralized error logging function
     * @param {Error|string} error - The error to log
     * @param {string} source - The source of the error
     */
    logError(error, source = "unknown") {
        const errorMessage = error instanceof Error ? error.message : error;

        // Console logging for development
        console.error(`[${source}] Error ❌:`, errorMessage);
    }

    /**
     * @description Set up IPC handlers for renderer communication
     * @private
     */
    _setupIpcHandlers() {
        const invokeHandlers = {
            "get-all-settings": getAllSettings,
            "get-setting": getSetting,
            "error": this.logError,
            "get-key": getAccessKey,
            "livekit:get-token": getLiveKitToken,
            "livekit:get-server-url": getLiveKitServerUrl,
        };

        for (const [name, handler] of Object.entries(invokeHandlers)) {
            ipcMain.handle(name, async (event, ...args) => {
                try {
                    return await handler(...args);
                } catch (error) {
                    this.logError(error, `IPC:${name}`);
                    throw error;
                }
            });
        }

        const commandHandlers = {
            "show-orb": this.showOrbWindow,
            "hide-orb": this.hideOrbWindow,
            "update-setting": updateSetting,
        };

        for (const [name, handler] of Object.entries(commandHandlers)) {
            ipcMain.on(name, (event, ...args) => handler(...args));
        }
    }

    /**
     * @description Emit an event with logging
     * @param {string} eventName - Name of the event
     * @param {any} payload - Event payload
     * @returns {boolean} Whether the event had listeners
     */
    emit(eventName, payload) {
        return super.emit(eventName, payload);
    }

    /**
     * @description Send an event to the renderer process
     * @param {string} windowName - Window name ('main' or 'orb')
     * @param {string} channel - Channel name
     * @param {any} data - Event data
     */
    sendToRenderer(windowName, channel, data) {
        const window =
            windowName === "main" ? getMainWindow() : getOrbWindow();

        if (!window || window.isDestroyed()) {
            throw new Error(`Window ${windowName} not found`);
        }

        window.webContents.send(channel, data);
    }

    /**
     * @description Show the orb window.
     */
    showOrbWindow() {
        const orbWindow = getOrbWindow();
        if (orbWindow && !orbWindow.isVisible()) {
            orbWindow.show();
        }
    }

    /**
     * @description Hide the orb window.
     */
    hideOrbWindow() {
        const orbWindow = getOrbWindow();
        if (orbWindow && orbWindow.isVisible()) {
            orbWindow.hide();
        }
    }

    /**
     * @description Signal end of current conversation
     * @returns {Promise<{success: boolean, message: string}>} Result of the conversation end
     */
    async handleConversationEnd() {
        this.sendToRenderer("orb", "end-conversation");

        return {
            success: true,
            message: "Conversation ended successfully.",
        };
    }

    /**
     * @description Stop the listening process
     */
    stopListening() {
        this.listeningStatus = false;
    }
}

/**
 * @description Create and export singleton instance
 * @returns {Promise<EventsService>} The events service instance
 */
async function getEventsService() {
    if (!eventsService) {
        eventsService = new EventsService();
        await eventsService.initialize();
    }
    return eventsService;
}

module.exports = {
    getEventsService,
};
