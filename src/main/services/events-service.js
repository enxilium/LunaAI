const { EventEmitter } = require("events");
const { ipcMain } = require("electron");
const { getMainWindow, getOrbWindow } = require("../windows");
const { getErrorService } = require("./error-service");
const {
    reportError,
    getAsset,
    updateSetting,
    getAllSettings,
    getSetting,
} = require("../communication");
const { getLiveKitService } = require("./agent/livekit-service");

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

        // Debug mode for logging events
        this.debugMode = process.env.NODE_ENV === "development";
    }

    /**
     * @description Initialize the events service.
     */
    initialize() {
        this._setupIpcHandlers();
    }

    /**
     * @description Set up IPC handlers for renderer communication
     * @private
     */
    _setupIpcHandlers() {
        // Invoke handlers
        const invokeHandlers = {
            "get-asset": getAsset,
            "get-all-settings": getAllSettings,
            "get-setting": getSetting,
            "error": reportError,
            "livekit:get-token": async () => {
                const livekitService = await getLiveKitService();
                return livekitService.warmToken
                    ? livekitService.warmToken
                    : await livekitService.generateToken();
            },
            "livekit:get-server-url": async () => {
                const livekitService = await getLiveKitService();
                return livekitService.serverUrl;
            },
        };

        for (const [name, handler] of Object.entries(invokeHandlers)) {
            ipcMain.handle(name, (event, ...args) => {
                return handler(...args);
            });
        }

        // Command handlers
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
        try {
            const window =
                windowName === "main" ? getMainWindow() : getOrbWindow();

            if (!window || window.isDestroyed()) {
                throw new Error(`Window ${windowName} not found`);
            }

            window.webContents.send(channel, data);
        } catch (error) {
            this.reportError(error);
        }
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
     * @description Signal that processing has started.
     */
    processingStarted() {
        this.emit("processing-started");
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
     * @description Report an error to the error service
     * @param {Error|string} error - Error object or message
     */
    reportError(error) {
        getErrorService().reportError(error);
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
