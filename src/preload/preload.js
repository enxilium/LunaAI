const { contextBridge, ipcRenderer } = require("electron");

/**
 * @description A safer logging method for the preload script.
 * @param {...any} args - The arguments to log.
 */

/**
 * @description The allowed channels for IPC communication.
 * @type {{send: string[], receive: string[], invoke: string[]}}
 */
const validChannels = {
    send: ["show-orb", "hide-orb", "update-setting"],

    receive: ["error"],

    invoke: [
        "get-all-settings",
        "get-setting",
        "error",
        "get-key",
        "get-asset",
        "livekit:get-token",
        "livekit:get-server-url",
        "screen-capturer:get-sources",
        "screen-capturer:get-primary-source",
        "screen-capturer:start-capture",
        "screen-capturer:stop-capture",
        "screen-capturer:get-status",
        "screen-capturer:get-media-constraints",
        "text-typing:check-active",
        "text-typing:type-text",
        "text-typing:clear-field",
    ],
};

// Standard API exposure
contextBridge.exposeInMainWorld("electron", {
    /**
     * @description Send a message to the main process.
     * @param {string} channel - The channel to send the message on.
     * @param {...any} args - The arguments to send with the message.
     */
    send: (channel, ...args) => {
        if (validChannels.send.includes(channel)) {
            ipcRenderer.send(channel, ...args);
        } else {
            console.error(`Invalid send channel: ${channel}`, "preload");
        }
    },

    /**
     * @description Receive a message from the main process.
     * @param {string} channel - The channel to listen on.
     * @param {Function} func - The function to call when a message is received.
     */
    receive: (channel, func) => {
        if (validChannels.receive.includes(channel)) {
            const listener = (event, ...args) => func(...args);
            ipcRenderer.on(channel, listener);
            return () => ipcRenderer.removeListener(channel, listener);
        }
    },

    /**
     * @description Invoke a method in the main process.
     * @param {string} name - The name of the method to invoke.
     * @param {...any} args - The arguments to pass to the method.
     * @returns {Promise<any>} A promise that resolves with the result of the method.
     */
    invoke: (name, ...args) => {
        if (validChannels.invoke.includes(name)) {
            return ipcRenderer.invoke(name, ...args);
        }
        reportError(`Invalid invoke method: ${name}`, "preload");
    },

    /**
     * @description Reports an error to the main process.
     * @param {string} error - The error message.
     * @param {string} source - The source of the error.
     */
    reportError: (error, source) => {
        return ipcRenderer.invoke("error", { error, source });
    },

    /**
     * @description Get an asset from the main process.
     * @param {string} type - The type of asset to get.
     * @param {...any} args - The arguments to pass to the asset getter.
     * @returns {Promise<any>} A promise that resolves with the asset.
     */
    getAsset: (type, ...args) => {
        return ipcRenderer.invoke("get-asset", type, ...args);
    },

    /**
     * @description Get a credential/key from the main process.
     * @param {string} keyName - The name of the key to retrieve.
     * @returns {Promise<string|null>} A promise that resolves with the key.
     */
    getKey: (keyName) => {
        return ipcRenderer.invoke("get-key", keyName);
    },

    /**
     * @description Get all settings from the main process.
     * @returns {Promise<any>} A promise that resolves with the settings.
     */
    getAllSettings: () => {
        return ipcRenderer.invoke("get-all-settings");
    },

    /**
     * @description Get a setting from the main process.
     * @param {string} key - The key of the setting to get.
     * @returns {Promise<any>} A promise that resolves with the setting.
     */
    getSetting: (key) => {
        return ipcRenderer.invoke("get-setting", key);
    },

    /**
     * @description Update a setting in the main process.
     * @param {string} key - The key of the setting to update.
     * @param {any} value - The value to update the setting to.
     */
    updateSetting: (key, value) => {
        return ipcRenderer.send("update-setting", key, value);
    },

    /**
     * @description Remove all listeners for a specific channel.
     * @param {string} channel - The channel to remove listeners from.
     */
    removeListener: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },

    // LiveKit and Agent methods
    /**
     * @description Get a LiveKit token for connecting to the room.
     * @returns {Promise<{url: string, token: string, roomName: string}>} LiveKit connection details
     */
    getLiveKitToken: () => {
        return ipcRenderer.invoke("livekit:get-token");
    },

    /**
     * @description Get a LiveKit server URL for connecting to the room.
     * @returns {Promise<string>} LiveKit server URL
     */
    getLiveKitServerUrl: () => {
        return ipcRenderer.invoke("livekit:get-server-url");
    },

    // Screen sharing methods
    /**
     * @description Get available screen sources for capture
     * @returns {Promise<Array>} Array of screen sources
     */
    getScreenSources: () => {
        return ipcRenderer.invoke("screen-capturer:get-sources");
    },

    /**
     * @description Get the primary screen source
     * @returns {Promise<Object>} Primary screen source
     */
    getPrimaryScreenSource: () => {
        return ipcRenderer.invoke("screen-capturer:get-primary-source");
    },

    /**
     * @description Start screen capture
     * @param {string} sourceId - Optional source ID, defaults to primary screen
     * @returns {Promise<Object>} Screen capture result
     */
    startScreenCapture: (sourceId = null) => {
        return ipcRenderer.invoke("screen-capturer:start-capture", sourceId);
    },

    /**
     * @description Stop screen capture
     * @returns {Promise<Object>} Screen capture stop result
     */
    stopScreenCapture: () => {
        return ipcRenderer.invoke("screen-capturer:stop-capture");
    },

    /**
     * @description Get screen capture status
     * @returns {Promise<Object>} Screen capture status
     */
    getScreenCaptureStatus: () => {
        return ipcRenderer.invoke("screen-capturer:get-status");
    },

    /**
     * @description Get media constraints for screen capture
     * @param {string} sourceId - The source ID for constraints
     * @returns {Promise<Object>} Media constraints
     */
    getMediaConstraints: (sourceId) => {
        return ipcRenderer.invoke(
            "screen-capturer:get-media-constraints",
            sourceId
        );
    },

    // Text typing methods
    /**
     * @description Check if there's an active text input field
     * @returns {Promise<{success: boolean, isActive: boolean, message: string}>} Status of active text input
     */
    checkActiveTextInput: () => {
        return ipcRenderer.invoke("text-typing:check-active");
    },

    /**
     * @description Type text into the currently focused text field
     * @param {string} text - The text to type
     * @returns {Promise<{success: boolean, message: string}>} Result of typing operation
     */
    typeText: (text) => {
        return ipcRenderer.invoke("text-typing:type-text", text);
    },

    /**
     * @description Clear the currently focused text field
     * @returns {Promise<{success: boolean, message: string}>} Result of clear operation
     */
    clearTextField: () => {
        return ipcRenderer.invoke("text-typing:clear-field");
    },
});

function reportError(error) {
    return ipcRenderer.invoke("error", { error, source: "preload" });
}
