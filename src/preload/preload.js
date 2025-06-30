const { contextBridge, ipcRenderer } = require("electron");

// Setup a safer logging method
const preloadLog = (...args) => {
    ipcRenderer.send("preload-log", ...args);
};

// Log immediately using the safe function
preloadLog("Preload script loaded successfully");

// Standard API exposure
contextBridge.exposeInMainWorld("electron", {
    // Validating what frontend (renderer) can send to backend (main process)
    send: (channel, ...args) => {
        const validChannels = ["audio-input", "update-orb-size"];

        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, ...args);
        } else {
            preloadLog(`Invalid send channel: ${channel}`);
        }
    },

    // Validating what backend (main process) can send to frontend (renderer)
    receive: (channel, func) => {
        const validChannels = [
            "error-response",
            "stop-listening",
            "processing",
            "conversation-end",
            "start-listening",
            "spotify-not-authorized",
            "google-not-authorized",
            "audio-output",
        ];

        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => {
                func(...args);
            });
        }
    },

    // Updated invoke method using centralized invoke pattern
    invoke: (name, ...args) => {
        const validMethods = [
            "get-gemini-key",
            "get-settings",
            "authorize-service",
            "disconnect-service",
            "start-listening",
            "hide-orb",
            "get-asset-path",
        ];

        if (validMethods.includes(name)) {
            return ipcRenderer.invoke("invoke", { name, args });
        }
        return Promise.reject(new Error(`Invalid invoke method: ${name}`));
    },

    getAssetPath: async (...paths) => {
        return await ipcRenderer.invoke("invoke", {
            name: "get-asset-path",
            args: paths,
        });
    },

    // Google API functions
    google: {
        checkAuth: () => ipcRenderer.invoke("google:check-auth"),

        authorize: () => ipcRenderer.invoke("google:auth"),

        getEmails: (maxResults = 10) =>
            ipcRenderer.invoke("google:get-emails", maxResults),

        sendEmail: (to, subject, body) =>
            ipcRenderer.invoke("google:send-email", { to, subject, body }),

        getCalendarEvents: (maxResults = 10) =>
            ipcRenderer.invoke("google:get-calendar-events", maxResults),

        createCalendarEvent: (
            summary,
            description,
            startDateTime,
            endDateTime,
            timeZone
        ) =>
            ipcRenderer.invoke("google:create-calendar-event", {
                summary,
                description,
                startDateTime,
                endDateTime,
                timeZone,
            }),

        listDriveFiles: (maxResults = 10) =>
            ipcRenderer.invoke("google:list-drive-files", maxResults),
    },

    // Allow removing listeners when they're no longer needed
    removeListener: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },
});

preloadLog("Preload script fully executed");
