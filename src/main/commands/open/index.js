const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const { getErrorService } = require('../../services/error-service');

// Convert exec to promise-based
const execPromise = promisify(exec);

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
        let command;
        
        // Determine the command based on the platform
        if (platform === 'win32') {
            // Windows
            command = `start "" "${appName}"`;
        } else if (platform === 'darwin') {
            // macOS
            command = `open -a "${appName}"`;
        } else if (platform === 'linux') {
            // Linux
            command = `xdg-open "${appName}"`;
        } else {
            throw new Error(`Unsupported platform: ${platform}`);
        }
        
        // Execute the command
        const { stdout, stderr } = await execPromise(command);
        
        if (stderr) {
            console.warn(`Warning when opening ${appName}:`, stderr);
        }
        
        context_map.application_opened = appName;
        context_map.open_result = stdout || 'Application opened successfully';
    } catch (error) {
        const errorService = getErrorService();
        errorService.reportError(error, 'open-command');
        console.error(`Error opening application:`, error);
        
        context_map.error = `Error opening application: ${error.message}`;
    } finally {
        return { context_map, stop: false };
    }
}

async function openWorkspace(context_map) {
    // TODO: Implement command.
}

module.exports = {
    openApplication,
}; 