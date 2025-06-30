const { getSpotifyService } = require("../../services/spotify-service");
const { getErrorService } = require("../../services/error-service");

/**
 * Play a specific song on Spotify
 * @param {Object} args - Arguments from the tool call.
 * @param {string} args.songName - The name of the song to play.
 * @param {string} [args.artistName] - The name of the artist.
 * @returns {Promise<Object>} - A success or error object.
 */
async function playSong({ songName, artistName }) {
    try {
        if (!songName) {
            throw new Error("A song name is required to play a song.");
        }
        const spotifyService = await getSpotifyService();
        const result = await spotifyService.play(songName, artistName);

        if (!result.success) {
            throw new Error(result.error);
        }
        return result;
    } catch (error) {
        getErrorService().reportError(error, 'spotify-command-playSong');
        return { 
            error: error.message, 
            error_solution: "I couldn't play that song. Please ensure Spotify is running and your account is connected."
        };
    }
}

/**
 * Resume Spotify playback
 * @returns {Promise<Object>} - A success or error object.
 */
async function resumePlayback() {
    try {
        const spotifyService = await getSpotifyService();
        const result = await spotifyService.play();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        return result;
    } catch (error) {
        getErrorService().reportError(error, 'spotify-command-resumePlayback');
        return { 
            error: error.message,
            error_solution: "I couldn't resume playback. Please ensure Spotify is running and your account is connected."
        };
    }
}

/**
 * Pause Spotify playback
 * @returns {Promise<Object>} - A success or error object.
 */
async function pausePlayback() {
    try {
        const spotifyService = await getSpotifyService();
        const result = await spotifyService.pause();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        return result;
    } catch (error) {
        getErrorService().reportError(error, 'spotify-command-pausePlayback');
        return { 
            error: error.message,
            error_solution: "I couldn't pause playback. Please ensure Spotify is running and your account is connected."
        };
    }
}

/**
 * Skip to the next track on Spotify
 * @returns {Promise<Object>} - A success or error object.
 */
async function skipTrack() {
    try {
        const spotifyService = await getSpotifyService();
        const result = await spotifyService.nextTrack();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        return result;
    } catch (error) {
        getErrorService().reportError(error, 'spotify-command-skipTrack');
        return { 
            error: error.message,
            error_solution: "I couldn't skip to the next track. Please ensure Spotify is running."
        };
    }
}

/**
 * Go to previous track on Spotify
 * @returns {Promise<Object>} - A success or error object.
 */
async function playPreviousTrack() {
    try {
        const spotifyService = await getSpotifyService();
        const result = await spotifyService.previousTrack();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        return result;
    } catch (error) {
        getErrorService().reportError(error, 'spotify-command-playPreviousTrack');
        return { 
            error: error.message,
            error_solution: "I couldn't go to the previous track. Please ensure Spotify is running."
        };
    }
}

/**
 * Shuffle playback on Spotify
 * @returns {Promise<Object>} - A success or error object.
 */
async function shufflePlayback() {
    try {
        const spotifyService = await getSpotifyService();
        // This will toggle shuffle on.
        const result = await spotifyService.setShuffle(true);
        
        if (!result.success) {
            throw new Error(result.error);
        }
        return result;
    } catch (error) {
        getErrorService().reportError(error, 'spotify-command-shufflePlayback');
        return { 
            error: error.message,
            error_solution: "I couldn't enable shuffle. Please ensure Spotify is running."
        };
    }
}

/**
 * Increase volume on Spotify
 * @returns {Promise<Object>} - A success or error object.
 */
async function increaseVolume() {
    try {
        const spotifyService = await getSpotifyService();
        const result = await spotifyService.increaseVolume();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        return result;
    } catch (error) {
        getErrorService().reportError(error, 'spotify-command-increaseVolume');
        return { 
            error: error.message,
            error_solution: "I couldn't increase the volume. Please ensure Spotify is running."
        };
    }
}

/**
 * Decrease volume on Spotify
 * @returns {Promise<Object>} - A success or error object.
 */
async function decreaseVolume() {
    try {
        const spotifyService = await getSpotifyService();
        const result = await spotifyService.decreaseVolume();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        return result;
    } catch (error) {
        getErrorService().reportError(error, 'spotify-command-decreaseVolume');
        return { 
            error: error.message,
            error_solution: "I couldn't decrease the volume. Please ensure Spotify is running."
        };
    }
}


module.exports = {
    playSong,
    resumePlayback,
    pausePlayback,
    skipTrack,
    playPreviousTrack,
    shufflePlayback,
    increaseVolume,
    decreaseVolume
};