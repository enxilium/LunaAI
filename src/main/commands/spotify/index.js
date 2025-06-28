const { getSpotifyService } = require("../../services/spotify-service");
const { getErrorService } = require("../../services/error-service");

/**
 * Play a specific song on Spotify
 * @param {Object} context_map - Context map containing trackId and other info
 * @returns {Promise<Object>} - Updated context_map with response or error
 */
async function playSong(context_map) {
    try {
        console.log(context_map);
        const spotifyService = await getSpotifyService();

        const song_title = context_map.song_title;
        const song_artist = context_map.artist_name;
        let personal;
        let type;

        if (context_map.personal) {
            personal = true;
        }

        if (context_map.album) {
            type = "album";
        } else if (context_map.playlist) {
            type = "playlist";
        }

        const result = await spotifyService.play(song_title, song_artist, type, personal);
        
        // Check if there was an error
        if (!result.success && result.error) {
            context_map.error = result.error;
            context_map.error_solution = `I couldn't play that song. ${
                !spotifyService.isAuthorized() 
                    ? "Please connect your Spotify account in settings." 
                    : "Please check that Spotify is running and try again."
            }`;
            
            // Report the error
            const errorService = getErrorService();
            errorService.reportError(result.error, 'spotify-command-playSong');
            
            return { context_map, stop: false };
        }
    } catch (error) {
        // Handle any unexpected errors
        const errorService = getErrorService();
        errorService.reportError(error, 'spotify-command-playSong');
        
        context_map.error = error.message;
        context_map.error_solution = "I encountered an issue playing that song. Please check that Spotify is running and try again.";
    }
    
    return { context_map, stop: false };
}

/**
 * Resume Spotify playback
 * @param {Object} context_map - Context map with conversation state
 * @returns {Promise<Object>} - Updated context_map with response or error
 */
async function resumePlayback(context_map) {
    try {
        const spotifyService = await getSpotifyService();
        const result = await spotifyService.play();
        
        // Check if there was an error
        if (!result.success && result.error) {
            context_map.error = result.error;
            context_map.error_solution = `I couldn't resume playback. ${
                !spotifyService.isAuthorized() 
                    ? "Please connect your Spotify account in settings." 
                    : "Please check that Spotify is running and try again."
            }`;
            
            // Report the error
            const errorService = getErrorService();
            errorService.reportError(result.error, 'spotify-command-resumePlayback');
            
            return { context_map, stop: false };
        }
        
        // Store the result in context map
        context_map.spotify_response = result;
    } catch (error) {
        // Handle any unexpected errors
        const errorService = getErrorService();
        errorService.reportError(error, 'spotify-command-resumePlayback');
        
        context_map.error = error.message;
        context_map.error_solution = "I encountered an issue resuming playback. Please check that Spotify is running and try again.";
    }
    
    return { context_map, stop: false };
}

/**
 * Pause Spotify playback
 * @param {Object} context_map - Context map with conversation state
 * @returns {Promise<Object>} - Updated context_map with response or error
 */
async function pausePlayback(context_map) {
    try {
        const spotifyService = await getSpotifyService();
        const result = await spotifyService.pause();
        
        // Check if there was an error
        if (!result.success && result.error) {
            context_map.error = result.error;
            context_map.error_solution = `I couldn't pause playback. ${
                !spotifyService.isAuthorized() 
                    ? "Please connect your Spotify account in settings." 
                    : "Please check that Spotify is running and try again."
            }`;
            
            // Report the error
            const errorService = getErrorService();
            errorService.reportError(result.error, 'spotify-command-pausePlayback');
            
            return { context_map, stop: false };
        }
        
        // Store the result in context map
        context_map.spotify_response = result;
    } catch (error) {
        // Handle any unexpected errors
        const errorService = getErrorService();
        errorService.reportError(error, 'spotify-command-pausePlayback');
        
        context_map.error = error.message;
        context_map.error_solution = "I encountered an issue pausing playback. Please check that Spotify is running and try again.";
    }
    
    return { context_map, stop: false };
}

/**
 * Skip to the next track on Spotify
 * @param {Object} context_map - Context map with conversation state
 * @returns {Promise<Object>} - Updated context_map with response or error
 */
async function skipTrack(context_map) {
    try {
        const spotifyService = await getSpotifyService();
        const result = await spotifyService.nextTrack();
        
        // Check if there was an error
        if (!result.success && result.error) {
            context_map.error = result.error;
            context_map.error_solution = `I couldn't skip to the next track. ${
                !spotifyService.isAuthorized() 
                    ? "Please connect your Spotify account in settings." 
                    : "Please check that Spotify is running and try again."
            }`;
            
            // Report the error
            const errorService = getErrorService();
            errorService.reportError(result.error, 'spotify-command-skipTrack');
            
            return { context_map, stop: false };
        }
        
        // Store the result in context map
        context_map.spotify_response = result;
    } catch (error) {
        // Handle any unexpected errors
        const errorService = getErrorService();
        errorService.reportError(error, 'spotify-command-skipTrack');
        
        context_map.error = error.message;
        context_map.error_solution = "I encountered an issue skipping to the next track. Please check that Spotify is running and try again.";
    }
    
    return { context_map, stop: false };
}

/**
 * Go to previous track on Spotify
 * @param {Object} context_map - Context map with conversation state
 * @returns {Promise<Object>} - Updated context_map with response or error
 */
async function playPreviousTrack(context_map) {
    try {
        const spotifyService = await getSpotifyService();
        const result = await spotifyService.previousTrack();
        
        // Check if there was an error
        if (!result.success && result.error) {
            context_map.error = result.error;
            context_map.error_solution = `I couldn't go to the previous track. ${
                !spotifyService.isAuthorized() 
                    ? "Please connect your Spotify account in settings." 
                    : "Please check that Spotify is running and try again."
            }`;
            
            // Report the error
            const errorService = getErrorService();
            errorService.reportError(result.error, 'spotify-command-playPreviousTrack');
            
            return { context_map, stop: false };
        }
        
        // Store the result in context map
        context_map.spotify_response = result;
    } catch (error) {
        // Handle any unexpected errors
        const errorService = getErrorService();
        errorService.reportError(error, 'spotify-command-playPreviousTrack');
        
        context_map.error = error.message;
        context_map.error_solution = "I encountered an issue going to the previous track. Please check that Spotify is running and try again.";
    }
    
    return { context_map, stop: false };
}

/**
 * Shuffle playback on Spotify
 * @param {Object} context_map - Context map with conversation state
 * @returns {Promise<Object>} - Updated context_map with response or error
 */
async function shufflePlayback(context_map) {
    try {
        const spotifyService = await getSpotifyService();
        // Determine shuffle state from context or default to toggling
        const state = context_map.shuffle_state !== undefined 
            ? context_map.shuffle_state 
            : true; // Default to enabling shuffle
        
        const result = await spotifyService.setShuffle(state);
        
        // Check if there was an error
        if (!result.success && result.error) {
            context_map.error = result.error;
            context_map.error_solution = `I couldn't ${state ? "enable" : "disable"} shuffle. ${
                !spotifyService.isAuthorized() 
                    ? "Please connect your Spotify account in settings." 
                    : "Please check that Spotify is running and try again."
            }`;
            
            // Report the error
            const errorService = getErrorService();
            errorService.reportError(result.error, 'spotify-command-shufflePlayback');
            
            return { context_map, stop: false };
        }
        
        // Store the result in context map
        context_map.spotify_response = result;
    } catch (error) {
        // Handle any unexpected errors
        const errorService = getErrorService();
        errorService.reportError(error, 'spotify-command-shufflePlayback');
        
        context_map.error = error.message;
        context_map.error_solution = "I encountered an issue setting shuffle mode. Please check that Spotify is running and try again.";
    }
    
    return { context_map, stop: false };
}

/**
 * Increase Spotify volume
 * @param {Object} context_map - Context map containing volume info
 * @returns {Promise<Object>} - Updated context_map with response or error
 */
async function increaseVolume(context_map) {
    try {
        const spotifyService = await getSpotifyService();
        // Get current playback state to determine current volume
        const playbackState = await spotifyService.getPlaybackState();
        
        // Check if there was an error getting playback state
        if (playbackState && playbackState.error) {
            context_map.error = playbackState.error;
            context_map.error_solution = `I couldn't get the current volume. ${
                !spotifyService.isAuthorized() 
                    ? "Please connect your Spotify account in settings." 
                    : "Please check that Spotify is running and try again."
            }`;
            
            // Report the error
            const errorService = getErrorService();
            errorService.reportError(playbackState.error, 'spotify-command-increaseVolume-getState');
            
            return { context_map, stop: false };
        }
        
        // Calculate new volume (increase by 10% or use specified amount)
        const currentVolume = playbackState.device?.volume_percent || 50;
        const volumeIncrease = context_map.volume_change || 10;
        const newVolume = Math.min(100, currentVolume + volumeIncrease);
        
        const result = await spotifyService.setVolume(newVolume);
        
        // Check if there was an error
        if (!result.success && result.error) {
            context_map.error = result.error;
            context_map.error_solution = `I couldn't increase the volume. ${
                !spotifyService.isAuthorized() 
                    ? "Please connect your Spotify account in settings." 
                    : "Please check that Spotify is running and try again."
            }`;
            
            // Report the error
            const errorService = getErrorService();
            errorService.reportError(result.error, 'spotify-command-increaseVolume');
            
            return { context_map, stop: false };
        }
        
        // Store the result in context map
        context_map.spotify_response = result;
        context_map.new_volume = newVolume;
    } catch (error) {
        // Handle any unexpected errors
        const errorService = getErrorService();
        errorService.reportError(error, 'spotify-command-increaseVolume');
        
        context_map.error = error.message;
        context_map.error_solution = "I encountered an issue increasing the volume. Please check that Spotify is running and try again.";
    }
    
    return { context_map, stop: false };
}

/**
 * Decrease Spotify volume
 * @param {Object} context_map - Context map containing volume info
 * @returns {Promise<Object>} - Updated context_map with response or error
 */
async function decreaseVolume(context_map) {
    try {
        const spotifyService = await getSpotifyService();
        // Get current playback state to determine current volume
        const playbackState = await spotifyService.getPlaybackState();
        
        // Check if there was an error getting playback state
        if (playbackState && playbackState.error) {
            context_map.error = playbackState.error;
            context_map.error_solution = `I couldn't get the current volume. ${
                !spotifyService.isAuthorized() 
                    ? "Please connect your Spotify account in settings." 
                    : "Please check that Spotify is running and try again."
            }`;
            
            // Report the error
            const errorService = getErrorService();
            errorService.reportError(playbackState.error, 'spotify-command-decreaseVolume-getState');
            
            return { context_map, stop: false };
        }
        
        // Calculate new volume (decrease by 10% or use specified amount)
        const currentVolume = playbackState.device?.volume_percent || 50;
        const volumeDecrease = context_map.volume_change || 10;
        const newVolume = Math.max(0, currentVolume - volumeDecrease);
        
        const result = await spotifyService.setVolume(newVolume);
        
        // Check if there was an error
        if (!result.success && result.error) {
            context_map.error = result.error;
            context_map.error_solution = `I couldn't decrease the volume. ${
                !spotifyService.isAuthorized() 
                    ? "Please connect your Spotify account in settings." 
                    : "Please check that Spotify is running and try again."
            }`;
            
            // Report the error
            const errorService = getErrorService();
            errorService.reportError(result.error, 'spotify-command-decreaseVolume');
            
            return { context_map, stop: false };
        }
        
        // Store the result in context map
        context_map.spotify_response = result;
        context_map.new_volume = newVolume;
    } catch (error) {
        // Handle any unexpected errors
        const errorService = getErrorService();
        errorService.reportError(error, 'spotify-command-decreaseVolume');
        
        context_map.error = error.message;
        context_map.error_solution = "I encountered an issue decreasing the volume. Please check that Spotify is running and try again.";
    }
    
    return { context_map, stop: false };
}

module.exports = {
    // Export commands with exact method names as specified
    skipTrack,
    playPreviousTrack,
    resumePlayback,
    shufflePlayback,
    pausePlayback,
    increaseVolume,
    decreaseVolume,
    playSong,
};