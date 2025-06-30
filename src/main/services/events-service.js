const { EventEmitter } = require("events");
const { BrowserWindow, ipcMain, app } = require("electron");
const { getMainWindow, getOrbWindow, setOrbWindow } = require("../windows");
const {
    getSettings,
    updateSettings,
    authorizeService,
    disconnectService,
    getGeminiKey,
} = require("../invokes");
const { getErrorService } = require("./error-service");
const path = require("path");

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

    // Service authentication events
    SPOTIFY_NOT_AUTHORIZED: "spotify-not-authorized",
    GOOGLE_NOT_AUTHORIZED: "google-not-authorized",

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
        this._setupIpcHandlers();
        this.errorService = getErrorService();
        this._subscribeToErrorService();
        this._setupAuthEventForwarding();
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
        // Ensure we only register handlers once
        if (ipcHandlersRegistered) {
            console.log("IPC handlers already registered, skipping");
            return;
        }

        // Handle commands from renderer
        ipcMain.on("command", (event, info) => {
            this.handleCommand(info);
        });

        // Handle invokes from renderer
        ipcMain.handle("invoke", async (event, request) => {
            switch (request.name) {
                case "get-settings":
                    return await getSettings(request.args[0]);
                case "update-settings":
                    return await updateSettings(
                        request.args[0],
                        request.args[1]
                    );
                case "authorize-service":
                    return await authorizeService(request.args[0]);
                case "disconnect-service":
                    return await disconnectService(request.args[0]);
                case "get-gemini-key":
                    return await getGeminiKey();
                case "get-asset-path":
                    return path.join(
                        app.getAppPath(),
                        "assets",
                        ...request.args
                    );
                case "start-listening":
                    this.startListening();
                    break;
                case "hide-orb":
                    this.hideOrbWindow();
                    break;
                case "error":
                    this.reportError(request.args[0]);
                default:
                    this.reportError(
                        new Error(`Unknown invoke method: ${request.name}`)
                    );
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
     * @param {string} windowName - Window name ('main' or 'orb')
     * @param {string} channel - Channel name
     * @param {any} data - Event data
     */
    sendToRenderer(windowName, channel, data) {
        try {
            let window;
            if (windowName === "main") {
                window = getMainWindow();
            } else if (windowName === "orb") {
                window = getOrbWindow();
            } else {
                this.reportError(new Error(`Unknown window: ${windowName}`));
                return;
            }

            if (window && !window.isDestroyed()) {
                window.webContents.send(channel, data);
            }
        } catch (error) {
            this.reportError(error);
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
    async startListening() {
        // Reset audio counter when starting a new recording
        this.lastAudioDataCounter = 0;

        this.emit(EVENT_TYPES.START_LISTENING);
        this.showOrbWindow();
        this.listeningStatus = true;
        this.sendToRenderer("orb", "start-listening");
    }

    /**
     * Stop listening for audio
     */
    stopListening() {
        this.emit(EVENT_TYPES.STOP_LISTENING);
        this.sendToRenderer("orb", "stop-listening");
        this.listeningStatus = false;
    }

    /**
     * Signal that processing has started
     */
    processingStarted() {
        this.emit(EVENT_TYPES.PROCESSING_REQUEST);
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

        // Mark that we're streaming audio
        this.isAudioStreaming = true;

        // Clear any existing timeout
        if (this.audioStreamTimeout) {
            clearTimeout(this.audioStreamTimeout);
            this.audioStreamTimeout = null;
        }

        this.sendToRenderer("orb", "audio-chunk-received", {
            chunk: base64Chunk,
        });
    }

    /**
     * Signal end of audio stream
     */
    audioStreamComplete(nextAction) {
        // Set a timeout to mark streaming as complete after a delay
        // This prevents the orb from flickering between chunks
        this.audioStreamTimeout = setTimeout(() => {
            this.isAudioStreaming = false;
            this.audioStreamTimeout = null;
        }, 1000); // 1 second delay

        this.sendToRenderer("orb", "audio-stream-complete", nextAction);

        if (this.debugMode) {
            console.log(
                "[EventsService] Audio stream complete with next action:",
                nextAction
            );
        }
    }

    /**
     * Signal end of current conversation
     */
    handleConversationEnd() {
        this.lastAudioDataCounter = 0;
        this.emit(EVENT_TYPES.CONVERSATION_END);
    }

    /**
     * Report an error
     * @param {Error|string} error - Error object or message
     */
    reportError(error) {
        this.errorService.reportError(error, "events-service");
    }

    hideOrbWindow() {
        const orbWindow = getOrbWindow();
        if (orbWindow && orbWindow.isVisible()) {
            console.log("Hiding orb window");
            if (orbWindow && !orbWindow.isDestroyed()) {
                orbWindow.hide();
            }
        }
    }

    showOrbWindow() {
        const orbWindow = getOrbWindow();
        if (orbWindow && !orbWindow.isVisible()) {
            console.log("Showing orb window");
            orbWindow.show();
        }
    }

    /**
     * Set up forwarding of authentication events to the renderer
     * @private
     */
    _setupAuthEventForwarding() {
        // Listen for Spotify authentication events
        this.on("spotify-not-authorized", () => {
            this.sendToRenderer("main", "spotify-not-authorized");
        });

        // Listen for Google authentication events
        this.on("google-not-authorized", () => {
            this.sendToRenderer("main", "google-not-authorized");
        });
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
