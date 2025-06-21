const { BrowserWindow, screen, app } = require("electron");
const path = require("path");
const { getResourcePath } = require("../utils/paths");
const { getErrorService } = require("../services/error-service");

const ORB_MARGIN = 30;
let orbWindow = null;
let recentlyDragged = false;
let dragTimeout = null;

async function createOrbWindow() {
    return new Promise((resolve, reject) => {
        const { width } = screen.getPrimaryDisplay().workAreaSize;

        orbWindow = new BrowserWindow({
            width: 100, // Fixed size large enough for animation
            height: 100,
            x: width - 120,
            y: 100,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            hasShadow: false,
            roundedCorners: false,
            backgroundThrottling: false,
            webPreferences: {
                preload: path.join(__dirname, "../../preload/preload.js"),
                contextIsolation: true,
                nodeIntegration: false,
            },
        });

        // Use a more aggressive always-on-top setting
        orbWindow.setAlwaysOnTop(true, "floating");

        orbWindow.webContents.openDevTools({ mode: "detach" });
        
        // Resolve promise when window is ready
        orbWindow.webContents.once('did-finish-load', () => {
            console.log('Orb window loaded successfully');
            resolve(orbWindow);
        });

        // Reject promise if there's an error
        orbWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
            const error = new Error(`Failed to load orb window: ${errorDescription} (${errorCode})`);
            const errorService = getErrorService();
            errorService.reportError(error, 'orb-window');
            reject(error);
        });

        // Load the orb window
        if (process.env.NODE_ENV === "development") {
            orbWindow.loadURL("http://localhost:3000?window=orb");
        } else {
            orbWindow.loadURL(
                `file://${getResourcePath("app/index.html")}?window=orb`
            );
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
            // If app is not quitting, prevent window closure
            if (!app.isQuitting) {
                event.preventDefault();
                orbWindow.hide();
                return false;
            }
        });
    });
}

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

function preventOffscreenMovement(window) {
    const bounds = window.getBounds();
    const workArea = screen.getPrimaryDisplay().workAreaSize;

    // Calculate constrained position
    let newX = bounds.x;
    let newY = bounds.y;

    // Left edge constraint
    if (newX < ORB_MARGIN) {
        newX = ORB_MARGIN;
    }

    // Right edge constraint
    if (newX + bounds.width > workArea.width - ORB_MARGIN) {
        newX = workArea.width - bounds.width - ORB_MARGIN;
    }

    // Top edge constraint
    if (newY < ORB_MARGIN) {
        newY = ORB_MARGIN;
    }

    // Bottom edge constraint
    if (newY + bounds.height > workArea.height - ORB_MARGIN) {
        newY = workArea.height - bounds.height - ORB_MARGIN;
    }

    // Only set position if it changed
    if (newX !== bounds.x || newY !== bounds.y) {
        // Use setPosition directly - needs to be immediate
        window.setPosition(newX, newY);
    }
}

function getOrbWindow() {
    return orbWindow;
}

module.exports = {
    createOrbWindow,
    getOrbWindow,
    setOrbWindow,
};
