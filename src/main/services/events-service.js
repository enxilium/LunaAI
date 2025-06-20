const { EventEmitter } = require("events");
const { BrowserWindow, ipcMain } = require("electron");
const { getMainWindow } = require("../windows/main-window");
const { getOrbWindow, setOrbWindow } = require("../windows/orb-window");
const getSettings = require("../invokes/settings/get-settings");
const authorizeService = require("../invokes/settings/authorize-service");
const disconnectService = require("../invokes/settings/disconnect-service");
const getPicovoiceKey = require("../invokes/settings/get-picovoice-key");

/**
 * Event types enumeration
 * Each event has a type and an expected payload structure
 */
const EVENT_TYPES = {
    // Audio recording events
    STOP_LISTENING: "stop-listening",
    START_LISTENING: "start-listening",
    PROCESSING_REQUEST: "processing-request",

    // Audio playback events
    AUDIO_CHUNK: "audio-chunk",
    AUDIO_STREAM_END: "audio-stream-end",
    AUDIO_DATA_RECEIVED: "audio-data-received",

    // Conversation events
    FULL_RESPONSE: "full-response",
    CONVERSATION_END: "conversation-end",
    RESET_CONVERSATION: "reset-conversation",

    // MISC events
    UPDATE_ORB_SIZE: "update-orb-size",

    // Error events
    ERROR: "error",
};

let eventsService = null;
let ipcHandlersRegistered = false;

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

        this.mainWindow = null;
        this.orbWindow = null;

        this.listeningStatus = false;
        
        // Track audio data to prevent duplicates
        this.lastAudioDataCounter = 0;
    }

    /**
     * Initializes the events service.
     */
    initialize() {
        this.mainWindow = getMainWindow();
        this.orbWindow = getOrbWindow();
        this._setupIpcHandlers();
    }

    /**
     * Set up IPC handlers for renderer communication
     * @private
     */
    _setupIpcHandlers() {
        // Ensure we only register handlers once
        if (ipcHandlersRegistered) {
            console.log("IPC handlers already registered, skipping");
            return;
        }
        
        // Handle audio data from renderer
        ipcMain.on("audio-data", (event, data) => {
            // Check for duplicate or out-of-order audio data
            if (data.counter && data.counter <= this.lastAudioDataCounter) {
                return;
            }
            
            // Update counter
            if (data.counter) {
                this.lastAudioDataCounter = data.counter;
            }
            
            this.emit(EVENT_TYPES.AUDIO_DATA_RECEIVED, data);
        });

        // Handle commands from renderer
        ipcMain.on("command", (event, info) => {
            this.handleCommand(info);
        });

        // Handle invokes from renderer
        ipcMain.handle("invoke", async (event, request) => {
            switch (request.name) {
                case "start-listening":
                    this.startListening();
                    break;
                case "get-settings":
                    return await getSettings(request.args[0]);
                case "authorize-service":
                    return await authorizeService(request.args[0]);
                case "disconnect-service":
                    return await disconnectService(request.args[0]);
                case "get-picovoice-key":
                    return await getPicovoiceKey();
                case "hide-orb":
                    this.hideOrbWindow();
                    break;
                case "error":
                    this.reportError(request.args[0]);
                default:
                    throw new Error(`Unknown invoke method: ${request.name}`);
            }
        });
        
        ipcHandlersRegistered = true;
        console.log("IPC handlers registered successfully");
    }

    /**
     * Emit an event with logging
     * @param {string} eventName - Name of the event
     * @param {any} payload - Event payload
     */
    emit(eventName, payload) {
        if (this.debugMode && eventName != "audio-data-received") {
            console.log(
                `[EventsService] Emitting: ${eventName}`,
                payload
                    ? typeof payload === "object"
                        ? "(payload object)"
                        : payload
                    : ""
            );
        }
        return super.emit(eventName, payload);
    }

    /**
     * Send an event to the renderer process
     * @param {string} channel - Channel name
     * @param {any} data - Event data
     */
    sendToRenderer(channel, data) {
        // Send to all windows
        try {
            const allWindows = BrowserWindow.getAllWindows();

            allWindows.forEach((window, index) => {
                if (!window.isDestroyed()) {
                    window.webContents.send(channel, data);
                }
            });
        } catch (error) {
            console.error(`[EVENT SERVICE] Error in sendToRenderer:`, error);
        }
    }

    /**
     * Handle a command from the renderer
     * @param {Object} info - Command information
     */
    handleCommand(info) {
        const name = info.name;
        const args = info.args;

        switch (name) {
            case "update-orb-size":
                setOrbWindow(args);
        }
    }

    /**
     * Start listening for audio
     */
    startListening() {
        // Reset audio counter when starting a new recording
        this.lastAudioDataCounter = 0;
        
        this.emit(EVENT_TYPES.START_LISTENING);
        this.showOrbWindow();
        this.listeningStatus = true;
        this.sendToRenderer("start-listening");
    }

    /**
     * Stop listening for audio
     */
    stopListening() {
        this.emit(EVENT_TYPES.STOP_LISTENING);
        this.sendToRenderer("stop-listening");
        this.listeningStatus = false;
    }

    /**
     * Signal that processing has started
     */
    processingStarted() {
        this.sendToRenderer("processing");
    }

    /**
     * Send audio chunk to renderer
     * @param {Buffer|string} chunk - Audio chunk data (Buffer or base64 string)
     */
    sendAudioChunk(chunk) {
        // Convert Buffer to base64 if needed
        const base64Chunk = Buffer.isBuffer(chunk)
            ? chunk.toString("base64")
            : chunk;

        this.sendToRenderer("audio-chunk-received", {
            chunk: base64Chunk,
        });
    }

    /**
     * Signal end of audio stream
     */
    audioStreamComplete(streamInfo) {
        this.sendToRenderer("audio-stream-complete");

        if (this.debugMode) {
            console.log("Audio stream complete. Total bytes:", streamInfo);
        }
    }

    /**
     * Signal end of current conversation
     */
    endConversation() {
        this.emit(EVENT_TYPES.CONVERSATION_END);
        this.sendToRenderer("conversation-end");

        if (this.debugMode) {
            console.log("Conversation ended");
        }
    }

    /**
     * Report an error
     * @param {Error|string} error - Error object or message
     */
    reportError(error) {
        const errorMessage = error instanceof Error ? error.message : error;
        console.error("Error occurred:", errorMessage);
        
        // Emit error event for other services to react
        this.emit(EVENT_TYPES.ERROR, error);
    }

    hideOrbWindow() {
        if (this.orbWindow && this.orbWindow.isVisible()) {
            setTimeout(() => {
                console.log("Hiding orb window");
                if (this.orbWindow && !this.orbWindow.isDestroyed()) {
                    this.orbWindow.hide();
                }
            }, 1000); // 1 second delay to match fade-out animation
        }
    }

    showOrbWindow() {
        if (this.orbWindow && !this.orbWindow.isVisible()) {
            console.log("Showing orb window");
            this.orbWindow.show();
        }
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
    EVENT_TYPES,
};
