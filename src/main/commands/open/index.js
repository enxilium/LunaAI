const { exec } = require('child_process');
const { spawn } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const { getErrorService } = require('../../services/error-service');
const { getUserData } = require('../../services/credentials-service');

// Convert exec to promise-based
const execPromise = promisify(exec);

/**
 * Common installation locations for popular applications by platform
 */
const COMMON_INSTALLATION_PATHS = {
    win32: {
        spotify: [
            'C:\\Program Files\\WindowsApps\\SpotifyAB.SpotifyMusic_*\\Spotify.exe',
            'C:\\Program Files\\Spotify\\Spotify.exe',
            'C:\\Program Files (x86)\\Spotify\\Spotify.exe',
            '%APPDATA%\\Spotify\\Spotify.exe',
            '%LOCALAPPDATA%\\Microsoft\\WindowsApps\\Spotify.exe'
        ],
        chrome: [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ],
        firefox: [
            'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
            'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'
        ],
        // Add more applications as needed
    },
    darwin: {
        spotify: [
            '/Applications/Spotify.app',
            '~/Applications/Spotify.app'
        ],
        chrome: [
            '/Applications/Google Chrome.app',
            '~/Applications/Google Chrome.app'
        ],
        firefox: [
            '/Applications/Firefox.app',
            '~/Applications/Firefox.app'
        ],
        // Add more applications as needed
    },
    linux: {
        spotify: [
            '/usr/bin/spotify',
            '/usr/local/bin/spotify',
            '/snap/bin/spotify'
        ],
        chrome: [
            '/usr/bin/google-chrome',
            '/usr/local/bin/google-chrome',
            '/snap/bin/google-chrome'
        ],
        firefox: [
            '/usr/bin/firefox',
            '/usr/local/bin/firefox',
            '/snap/bin/firefox'
        ],
        // Add more applications as needed
    }
};

/**
 * Find an application in common installation paths
 * @param {string} appName - Name of the application to find
 * @param {string} platform - Operating system platform
 * @returns {Promise<string|null>} - Path to the application or null if not found
 */
async function findApplicationPath(appName, platform) {
    // Check if we have common paths for this app on this platform
    const commonPaths = COMMON_INSTALLATION_PATHS[platform]?.[appName.toLowerCase()];
    
    if (!commonPaths) {
        console.log(`No common paths defined for ${appName} on ${platform}`);
        return null;
    }
    
    console.log(`Searching for ${appName} in common locations...`);
    
    // Check each common path
    for (const commonPath of commonPaths) {
        try {
            // Expand environment variables if present
            let expandedPath = commonPath;
            if (platform === 'win32' && commonPath.includes('%')) {
                // Handle Windows environment variables
                expandedPath = commonPath.replace(/%([^%]+)%/g, (_, envVar) => {
                    return process.env[envVar] || '';
                });
            }
            
            // Handle glob patterns in Windows paths (e.g., for Windows Store apps)
            if (platform === 'win32' && expandedPath.includes('*')) {
                // For simplicity, we'll use a direct approach rather than glob
                // This is a basic implementation - a more robust solution might use glob or readdir
                const baseDir = path.dirname(expandedPath.split('*')[0]);
                
                try {
                    const entries = await fs.readdir(baseDir);
                    for (const entry of entries) {
                        const fullPath = path.join(baseDir, entry, path.basename(expandedPath.split('*')[1] || ''));
                        try {
                            await fs.access(fullPath);
                            console.log(`Found ${appName} at ${fullPath}`);
                            return fullPath;
                        } catch (e) {
                            // Path doesn't exist, continue to next
                        }
                    }
                } catch (e) {
                    // Can't read directory, continue to next path
                    console.log(`Could not read directory ${baseDir}: ${e.message}`);
                }
            } else {
                // For non-glob paths, just check if they exist
                await fs.access(expandedPath);
                console.log(`Found ${appName} at ${expandedPath}`);
                return expandedPath;
            }
        } catch (e) {
            // Path doesn't exist, continue to next
        }
    }
    
    console.log(`Could not find ${appName} in any common locations`);
    return null;
}

/**
 * Open an application on the user's system
 * @param {Object} args - Arguments from the tool call.
 * @param {string} args.appName - The name of the application to open.
 * @returns {Promise<Object>} - A success or error object.
 */
async function openApplication({ appName }) {
    try {
        if (!appName) {
            throw new Error("No application name was provided to open.");
        }
        
        const platform = os.platform();
        let appPath = null;
        
        // Step 1: Check if we have a saved path for this application
        const userData = getUserData();
        appPath = userData.getConfig(`app_paths.${appName.toLowerCase()}`);
        
        if (appPath) {
            console.log(`Found saved path for ${appName}: ${appPath}`);
            try {
                await fs.access(appPath);
            } catch (error) {
                console.log(`Saved path for ${appName} no longer exists, searching again.`);
                appPath = null;
            }
        }
        
        // Step 2: If no saved path or it's invalid, search common locations
        if (!appPath) {
            appPath = await findApplicationPath(appName, platform);
            if (appPath) {
                userData.setConfig(`app_paths.${appName.toLowerCase()}`, appPath);
                console.log(`Saved new path for ${appName}: ${appPath}`);
            }
        }
        
        // Step 3: If still not found, return an error
        if (!appPath) {
            throw new Error(`Could not find ${appName}. Please set the path manually in settings.`);
        }
        
        // Step 4: Open the application
        console.log(`Opening application at: ${appPath}`);
        if (platform === 'win32') {
            spawn(appPath, [], { detached: true, stdio: 'ignore' }).unref();
        } else if (platform === 'darwin') {
            spawn('open', [appPath], { detached: true, stdio: 'ignore' }).unref();
        } else if (platform === 'linux') {
            spawn(appPath, [], { detached: true, stdio: 'ignore' }).unref();
        } else {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        return { success: true, message: `${appName} opened successfully.` };

    } catch (error) {
        getErrorService().reportError(error, 'open-command');
        return { 
            error: error.message,
            error_solution: `I'm sorry, I couldn't open ${appName || 'the application'}. Please try again.`
        };
    }
}

/**
 * Open Spotify specifically
 * @returns {Promise<Object>} - A success or error object.
 */
async function openSpotify() {
    return await openApplication({ appName: "spotify" });
}

/**
 * Open a specified workspace
 * @param {Object} args - Arguments from the tool call.
 * @param {string} args.workspaceName - The name of the workspace to open.
 * @returns {Promise<Object>} - A success or error object.
 */
async function openWorkspace({ workspaceName }) {
    try {
        if (!workspaceName) {
            throw new Error("No workspace name provided to open.");
        }
        
        // TODO: Implement workspace opening functionality
        const userData = getUserData();
        const workspacePath = userData.getConfig(`workspace_paths.${workspaceName.toLowerCase()}`);
        
        if (!workspacePath) {
            throw new Error(`Workspace '${workspaceName}' not found in settings.`);
        }
        
        // Open the workspace with the default application
        console.log(`Opening workspace: ${workspacePath}`);
        if (os.platform() === 'win32') {
            exec(`start "" "${workspacePath}"`);
        } else if (os.platform() === 'darwin') {
            exec(`open "${workspacePath}"`);
        } else {
            exec(`xdg-open "${workspacePath}"`);
        }

        return { success: true, message: `Workspace '${workspaceName}' opened.` };

    } catch (error) {
        getErrorService().reportError(error, 'open-workspace-command');
        return {
            error: error.message,
            error_solution: `I couldn't open the workspace '${workspaceName}'. Please check your settings.`
        };
    }
}

module.exports = {
    openApplication,
    openSpotify,
    openWorkspace
}; 