const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const ORB_MARGIN = 30;

let mainWindow = null;
let orbWindow = null;
let recentlyDragged = false;
let dragTimeout = null;

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}


function createOrbWindow() {
    const { width } = screen.getPrimaryDisplay().workAreaSize;

    orbWindow = new BrowserWindow({
        width: 100,             // Fixed size large enough for animation
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
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    // Use a more aggressive always-on-top setting
    orbWindow.setAlwaysOnTop(true, 'floating');

    // Load the orb window
    if (process.env.NODE_ENV === 'development') {
        orbWindow.loadURL('http://localhost:3000?window=orb');
    } else {
        orbWindow.loadURL(`file://${path.join(__dirname, '../build/index.html')}?window=orb`);
    }

    orbWindow.hide(); // Start hidden

    // Add this event handler for continuous boundary checking during dragging
    orbWindow.on('move', () => {
        // Continuously constrain the window position during drag
        preventOffscreenMovement(orbWindow);
    });

    // Add this event listener after window creation
    orbWindow.on('moved', () => {
        // Store the current position immediately
        recentlyDragged = true;
        
        // Clear any existing timeout
        if (dragTimeout) clearTimeout(dragTimeout);
        
        // Reset the flag after a longer delay to prevent interference
        dragTimeout = setTimeout(() => {
            recentlyDragged = false;
        }, 1500); // Longer timeout to ensure stability
        
        // Re-assert always-on-top to ensure it stays on top
        orbWindow.setAlwaysOnTop(true, 'floating');
    });
}


function createWindows() {
    createMainWindow();
    createOrbWindow();
}


function startListen() {
    if (orbWindow && !orbWindow.isVisible()) {
        orbWindow.setAlwaysOnTop(true, 'floating');
        orbWindow.show();
    }
}

function stopListen() {
    if (orbWindow && orbWindow.isVisible()) {
        orbWindow.hide();
    }
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

// Simplified command handler
async function handleCommand(command) {
    let args = command.args;
    command = command.command;

    let responseType;
    let response;

    if (command === 'start-listen') {
        console.log('Starting to listen...');
        startListen();
        responseType = 'system-response';
        response = { status: 'listening', message: 'Listening started!' };
    } else if (command === 'stop-listen') {
        console.log('Stopping listening...');
        stopListen();
        responseType = 'system-response';
        response = { status: 'idle', message: 'Listening stopped!' };
    } else if (command === 'update-orb-size') {
        setOrbWindow(args);
        return null;
    } else {
        console.error(`Unknown command: ${command}`);
        responseType = 'error-response';
        response = `Unknown command: ${command}`;
    }

    return { type: responseType, message: response };
}


ipcMain.on('command', (event, command) => {
    handleCommand(command).then((response) => {
        // Only send response if we have one
        if (response) {
            event.sender.send(response.type, response.message);
        }
    });
});

// Entry point
app.whenReady().then(createWindows);
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});