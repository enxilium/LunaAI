const { EventEmitter } = require("events");
const { ipcMain } = require("electron");
const { getMainWindow, getOrbWindow, setOrbWindow } = require("../windows");
const { getErrorService } = require("./error-service");
const { updateSettings } = require("../invokes/update-settings");
const { reportError } = require("../invokes/error");
const { executeCommand } = require("../invokes/execute-command");
const { getAsset } = require("../invokes/get-asset");

let eventsService = null;

const invokeHandlers = {
    "get-asset": getAsset,
    "update-settings": updateSettings,
    "execute-command": executeCommand,
    "error": reportError,
};

/**
 * Centralized Events Service
 * Handles all event communication between main process components
 * and between main process and renderer process
 */
class EventsService extends EventEmitter {
    constructor() {
        super();

        // Debug mode for logging events
        this.debugMode = process.env.NODE_ENV === "development";

        this.listeningStatus = false;

        // Track audio streaming state
        this.isAudioStreaming = false;
        this.audioStreamTimeout = null;
        // Track audio data to prevent duplicates
        this.lastAudioDataCounter = 0;

        this.errorService = null;
    }

    /**
     * Initialize the events service.
     */
    initialize() {
        this.errorService = getErrorService();
        this._setupIpcHandlers();
        this._subscribeToErrorService();
    }

    /**
     * Subscribe to the centralized error service
     * @private
     */
    _subscribeToErrorService() {
        try {
            // Subscribe to all errors reported to the error service
            this.errorService.on("error", (errorInfo) => {
                if (errorInfo.error === "Empty transcription.") {
                    this.stopListening();
                    this.hideOrbWindow();
                }
            });
        } catch (error) {
            console.error(
                "Error setting up error service subscription:",
                error
            );
        }
    }

    /**
     * Set up IPC handlers for renderer communication
     * @private
     */
    _setupIpcHandlers() {
        // Handle show-orb from renderer.
        ipcMain.on("show-orb", (event, info) => {
            this.showOrbWindow();
        });

        // Handle conversation-end from renderer.
        ipcMain.on("audio-stream-end", (event, info) => {
            this.hideOrbWindow();
        });

        this._registerInvokeHandlers();

        console.log("[EventsService] IPC handlers registered successfully");
    }

    /**
     * @description Register all invoke handlers.
     * @private
     */
    _registerInvokeHandlers() {
        for (const [name, handler] of Object.entries(invokeHandlers)) {
            ipcMain.handle(name, (event, ...args) => handler(...args));
        }
        console.log("Invoke handlers registered.");
    }

    /**
     * Emit an event with logging
     * @param {string} eventName - Name of the event
     * @param {any} payload - Event payload
     */
    emit(eventName, payload) {
        console.log(
            `[EventsService] Emitting: ${eventName}`,
            payload
                ? typeof payload === "object"
                    ? "(payload object)"
                    : payload
                : ""
        );
        return super.emit(eventName, payload);
    }

    /**
     * Send an event to the renderer process
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
            console.log("[EventsService] Showing orb window");

            orbWindow.show();
        }
    }

    /**
     * @description Hide the orb window.
     */
    hideOrbWindow() {
        const orbWindow = getOrbWindow();
        if (orbWindow && orbWindow.isVisible()) {
            console.log("[EventsService] Hiding orb window");

            orbWindow.hide();
        }
    }

    /**
     * Signal that processing has started. //TODO: Modify for asynchronous function calls.
     */
    processingStarted() {
        this.emit("processing-started");
    }

    /**
     * Signal end of current conversation
     */
    async handleConversationEnd() {
        this.sendToRenderer("orb", "end-conversation");

        return {
            success: true,
            message: "Conversation ended successfully.",
        };
    }

    /**
     * Report an error
     * @param {Error|string} error - Error object or message
     */
    reportError(error) {
        this.errorService.reportError(error, "events-service");
    }
}

// Create and export singleton instance
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
