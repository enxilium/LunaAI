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
    send: ["show-orb", "audio-stream-end"],

    receive: [
        "end-conversation",
        "processing",
        "livekit:connected",
        "livekit:disconnected",
        "livekit:error",
        "livekit:agent-started",
        "livekit:agent-stopped",
        "livekit:agent-error",
    ],

    invoke: [
        "error",
        "update-settings",
        "get-asset",
        "get-window-bounds",
        "livekit:get-token",
        "livekit:start-session",
        "livekit:stop-agent",
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

        console.error(`Invalid invoke method: ${name}`, "preload");
        return Promise.reject(new Error(`Invalid invoke method: ${name}`));
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
     * @description Start a LiveKit session with agent.
     * @returns {Promise<{url: string, token: string, roomName: string, agentStarted: boolean, agentType: string}>} Session details
     */
    startLiveKitSession: () => {
        return ipcRenderer.invoke("livekit:start-session");
    },

    /**
     * @description Stop the LiveKit agent.
     * @returns {Promise<{success: boolean, message: string}>} Stop result
     */
    stopLiveKitAgent: () => {
        return ipcRenderer.invoke("livekit:stop-agent");
    },
});
