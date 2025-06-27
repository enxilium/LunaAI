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
 * @param {Object} context_map - Context map containing application info
 * @returns {Promise<Object>} - Updated context_map with response or error
 */
async function openApplication(context_map) {
    try {
        const appName = context_map.application;
        
        if (!appName) {
            context_map.error = "No application name provided to open";
            return { context_map, stop: false };
        }
        
        const platform = os.platform();
        let appPath = null;
        
        // Step 1: Check if we have a saved path for this application
        const userData = getUserData();
        appPath = userData.getConfig(`app_paths.${appName.toLowerCase()}`);
        
        if (appPath) {
            console.log(`Found saved path for ${appName}: ${appPath}`);

            // Verify the saved path still exists
            try {
                await fs.access(appPath);
            } catch (e) {
                console.log(
                    `Saved path for ${appName} no longer exists, will search for new path`
                );
                appPath = null;
            }
        }
        
        // Step 2: If no saved path or it's invalid, search common locations
        if (!appPath) {
            appPath = await findApplicationPath(appName, platform);
            
            // If found, save the path for future use
            if (appPath) {
                userData.setConfig(`app_paths.${appName.toLowerCase()}`, appPath);
                console.log(`Saved path for ${appName}: ${appPath}`);
            }
        }
        
        // Step 3: If still not found, return an error
        if (!appPath) {
            const errorMsg = `Could not find ${appName} in common locations. Please set the path in settings.`;
            context_map.error = errorMsg;
            return { context_map, stop: false };
        }
        
        // Step 4: Open the application using the found path
        console.log(`Executing command: ${appPath}`);
        
        // Use spawn instead of exec to avoid waiting for the process to complete
        if (platform === 'win32') {
            // Windows
            spawn(appPath, [], { detached: true, stdio: 'ignore' }).unref();
        } else if (platform === 'darwin') {
            // macOS
            spawn('open', [appPath], { detached: true, stdio: 'ignore' }).unref();
        } else if (platform === 'linux') {
            // Linux
            spawn(appPath, [], { detached: true, stdio: 'ignore' }).unref();
        } else {
            throw new Error(`Unsupported platform: ${platform}`);
        }
        
        context_map.application_opened = appName;
        context_map.application_path = appPath;
        context_map.open_result = 'Application opened successfully';
    } catch (error) {
        const errorService = getErrorService();
        errorService.reportError(error, 'open-command');
        console.error(`Error opening application:`, error);
        
        context_map.error = `Error opening application: ${error.message}`;
    } finally {
        return { context_map, stop: false };
    }
}

/**
 * Open Spotify specifically
 * @param {Object} context_map - Context map
 * @returns {Promise<Object>} - Updated context map
 */
async function openSpotify(context_map) {
    // Set the application name to spotify
    context_map.application = "spotify";
    return await openApplication(context_map);
}

async function openWorkspace(context_map) {
    // TODO: Implement command.
}

module.exports = {
    openApplication,
    openSpotify
}; 