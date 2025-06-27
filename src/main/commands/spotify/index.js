const { getSpotifyService } = require("../../services/spotify-service");

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
            return { context_map, stop: false };
        }
    } catch (error) {
        // Handle any unexpected errors
        console.error("Unexpected error in playSong:", error);
        context_map.error = `Error playing song: ${error.message}`;
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
            return { context_map, stop: false };
        }
        
        // Store the result in context map
        context_map.spotify_response = result;
    } catch (error) {
        // Handle any unexpected errors
        console.error("Unexpected error in resumePlayback:", error);
        context_map.error = `Error resuming playback: ${error.message}`;
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
            return { context_map, stop: false };
        }
        
        // Store the result in context map
        context_map.spotify_response = result;
    } catch (error) {
        // Handle any unexpected errors
        console.error("Unexpected error in pausePlayback:", error);
        context_map.error = `Error pausing playback: ${error.message}`;
    }
    
    return { context_map, stop: false };
}

/**
 * Skip to next track on Spotify
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
            return { context_map, stop: false };
        }
        
        // Store the result in context map
        context_map.spotify_response = result;
    } catch (error) {
        // Handle any unexpected errors
        console.error("Unexpected error in skipTrack:", error);
        context_map.error = `Error skipping track: ${error.message}`;
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
            return { context_map, stop: false };
        }
        
        // Store the result in context map
        context_map.spotify_response = result;
    } catch (error) {
        // Handle any unexpected errors
        console.error("Unexpected error in playPreviousTrack:", error);
        context_map.error = `Error playing previous track: ${error.message}`;
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
            return { context_map, stop: false };
        }
        
        // Store the result in context map
        context_map.spotify_response = result;
    } catch (error) {
        // Handle any unexpected errors
        console.error("Unexpected error in shufflePlayback:", error);
        context_map.error = `Error setting shuffle: ${error.message}`;
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
            return { context_map, stop: false };
        }
        
        // Store the result in context map
        context_map.spotify_response = result;
        context_map.new_volume = newVolume;
    } catch (error) {
        // Handle any unexpected errors
        console.error("Unexpected error in increaseVolume:", error);
        context_map.error = `Error increasing volume: ${error.message}`;
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
            return { context_map, stop: false };
        }
        
        // Store the result in context map
        context_map.spotify_response = result;
        context_map.new_volume = newVolume;
    } catch (error) {
        // Handle any unexpected errors
        console.error("Unexpected error in decreaseVolume:", error);
        context_map.error = `Error decreasing volume: ${error.message}`;
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