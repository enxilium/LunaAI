const { BrowserWindow } = require('electron');
const { getAudioService } = require('../../services/audio-service');

/**
 * Handles starting the listening process
 * @param {Object} context - Application context
 * @returns {Object} - Updated listening status
 */
async function startListening(context) {
    // Show the orb window
    const { getOrbWindow } = require('../../windows/orb-window');
    const orbWindow = getOrbWindow();
    const audioService = await getAudioService();
    
    if (orbWindow && !orbWindow.isVisible()) {
        console.log("Showing orb window");
        orbWindow.show();
        
        // Start audio recording through the orb window
        audioService.startRecording(orbWindow);
    }
    
    // Update listening status
    const updatedStatus = {
        status: "listening",
        message: "Listening for commands..."
    };
    
    // Update the global status through the context reference
    Object.assign(context.listeningStatus, updatedStatus);
    
    return updatedStatus;
}

module.exports = startListening; 