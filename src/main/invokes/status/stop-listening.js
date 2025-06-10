const { getAudioService } = require('../../services/audio-service');

/**
 * Handles stopping the listening process
 * @param {Object} context - Application context
 * @returns {Object} - Updated listening status
 */
async function stopListening(context) {
    const audioService = await getAudioService();
    // Update listening status
    const updatedStatus = {
        status: "idle",
        message: "System is idle"
    };
    
    // Update the global status through the context reference
    Object.assign(context.listeningStatus, updatedStatus);
    
    // Hide the orb window after a short delay (to allow fade-out animation)
    const { getOrbWindow } = require('../../windows/orb-window');
    const orbWindow = getOrbWindow();
    
    if (orbWindow && orbWindow.isVisible()) {
        // Stop audio recording
        audioService.stopRecording(orbWindow);
        
        // Save the recording for testing purposes
        const savedFilePath = audioService.saveRecordingToFile();
        if (savedFilePath) {
            console.log(`Audio saved for testing at: ${savedFilePath}`);
            // Add the file path to the response
            updatedStatus.recordingFile = savedFilePath;
        }
        
        // Allow time for the fade-out animation in the renderer
        setTimeout(() => {
            console.log("Hiding orb window");
            orbWindow.hide();
        }, 1000); // 1 second delay to match fade-out animation
    }
    
    return updatedStatus;
}

module.exports = stopListening; 