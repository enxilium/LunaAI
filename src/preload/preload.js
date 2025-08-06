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
        "screen-capturer:get-sources",
        "screen-capturer:get-primary-source",
        "screen-capturer:start-capture",
        "screen-capturer:stop-capture",
        "screen-capturer:get-status",
        "screen-capturer:get-media-constraints",
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

    // Screen sharing methods
    /**
     * @description Get available screen sources for capture
     * @returns {Promise<Array>} Array of screen sources
     */
    getScreenSources: () => ipcRenderer.invoke("screen-capturer:get-sources"),

    /**
     * @description Get the primary screen source
     * @returns {Promise<Object>} Primary screen source
     */
    getPrimaryScreenSource: () => {
        return ipcRenderer.invoke("screen-capturer:get-primary-source");
    },
});

function reportError(error) {
    return ipcRenderer.invoke("error", { error, source: "preload" });
}
