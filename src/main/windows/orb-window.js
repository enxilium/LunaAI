const { BrowserWindow, screen, app, ipcMain } = require("electron");
const { getAsset } = require("../utils/get-asset");
const logger = require("../utils/logger");

let orbWindow = null;
let recentlyDragged = false;
let dragTimeout = null;

/**
 * @description Creates the floating orb window.
 * @returns {Promise<Electron.BrowserWindow>} A promise that resolves with the created window.
 * @throws {Error} If window creation fails.
 */
async function createOrbWindow() {
    return new Promise((resolve, reject) => {
        const { width } = screen.getPrimaryDisplay().workAreaSize;

        orbWindow = new BrowserWindow({
            width: 200, // Larger size to accommodate orb and arc menu
            height: 200,
            x: width - 420,
            y: 100,
            frame: false,
            backgroundColor: "#000000",
            transparent: false,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            hasShadow: false,
            roundedCorners: false,
            backgroundThrottling: false,
            webPreferences: {
                preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        // Use a more aggressive always-on-top setting
        orbWindow.setAlwaysOnTop(true, "floating");

        // Only open DevTools in development when needed (reduces console noise)
        if (!app.isPackaged) {
            orbWindow.webContents.openDevTools({ mode: "detach" });
        }

        // Resolve promise when window is ready
        orbWindow.webContents.once("did-finish-load", () => {
            resolve(orbWindow);
        });

        // Reject promise if there's an error
        orbWindow.webContents.on(
            "did-fail-load",
            async (_, errorCode, errorDescription) => {
                const error = new Error(
                    `Failed to load orb window: ${errorDescription} (${errorCode})`
                );
                
                reject(error);
            }
        );

        // Load the orb window
        if (!app.isPackaged) {
            orbWindow.loadURL(ORB_WINDOW_WEBPACK_ENTRY);
        } else {
            orbWindow.loadFile(getAsset("orb/index.html"));
        }

        orbWindow.hide(); // Start hidden

        // Add this event handler for continuous boundary checking during dragging
        orbWindow.on("move", () => {
            // Continuously constrain the window position during drag
            preventOffscreenMovement(orbWindow);
        });

        // Add this event listener after window creation
        orbWindow.on("moved", () => {
            // Store the current position immediately
            recentlyDragged = true;

            // Clear any existing timeout
            if (dragTimeout) clearTimeout(dragTimeout);

            // Reset the flag after a longer delay to prevent interference
            dragTimeout = setTimeout(() => {
                recentlyDragged = false;
            }, 1500); // Longer timeout to ensure stability

            // Re-assert always-on-top to ensure it stays on top
            orbWindow.setAlwaysOnTop(true, "floating");
        });

        // Handle close event - hide instead of close
        orbWindow.on("close", (event) => {
            logger.info(
                "OrbWindow",
                `close event, app.isQuitting: ${app.isQuitting}`
            );
            // If app is not quitting, prevent window closure
            if (!app.isQuitting) {
                event.preventDefault();
                orbWindow.hide();
                return false;
            }
        });
    });
}

/**
 * @description Updates the orb window size while maintaining its position.
 * @param {Object} args - The arguments for updating the window.
 * @param {number} args.width - The new width of the window.
 * @param {number} args.height - The new height of the window.
 */
function setOrbWindow(args) {
    if (orbWindow && orbWindow.isVisible() && !recentlyDragged) {
        const bounds = orbWindow.getBounds();

        const topLeftX = bounds.x;
        const topLeftY = bounds.y;

        // Set new size
        orbWindow.setSize(args.width, args.height);

        // Keep the same top-left position
        orbWindow.setPosition(topLeftX, topLeftY);

        // Use the new function instead
        preventOffscreenMovement(orbWindow);
    }
}

/**
 * @description Prevents the window from moving off-screen by constraining its position.
 * @param {Electron.BrowserWindow} window - The window to constrain.
 */
function preventOffscreenMovement(window) {
    const bounds = window.getBounds();

    // Calculate constrained position
    let newX = bounds.x;
    let newY = bounds.y;

    // Only set position if it changed
    if (newX !== bounds.x || newY !== bounds.y) {
        // Use setPosition directly - needs to be immediate
        window.setPosition(newX, newY);
    }
}

/**
 * @description Gets the current orb window instance.
 * @returns {Electron.BrowserWindow|null} The orb window instance or null if it doesn't exist.
 */
function getOrbWindow() {
    return orbWindow;
}

// Set up IPC handler for getting window bounds
ipcMain.handle("get-window-bounds", () => {
    if (orbWindow) {
        return orbWindow.getBounds();
    }
    return { x: 0, y: 0, width: 400, height: 400 };
});

module.exports = {
    createOrbWindow,
    getOrbWindow,
    setOrbWindow,
};
