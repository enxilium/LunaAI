const {
    getSpotifyService,
} = require("../../services/integrations/spotify-service");
const { getErrorService } = require("../../services/error-service");

/**
 * Play a specific song on Spotify
 * @param {Object} args - Arguments from the tool call.
 * @param {string} args.songName - The name of the song to play.
 * @param {string} [args.artistName] - The name of the artist.
 * @param {string} [args.genre] - The genre of music to play.
 * @returns {Promise<Object>} - A success or error object.
 */
async function playSong({ songName, artistName, genre }) {
    try {
        await checkAuthorization();

        const spotifyService = await getSpotifyService();

        const result = await spotifyService.play(songName, artistName, genre);

        return result;
    } catch (error) {
        getErrorService().reportError(error, "spotify-command-playSong");

        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Resume Spotify playback
 * @returns {Promise<Object>} - A success or error object.
 */
async function resumePlayback() {
    try {
        await checkAuthorization();

        const spotifyService = await getSpotifyService();

        const result = await spotifyService.play();

        return result;
    } catch (error) {
        getErrorService().reportError(error, "spotify-command-resumePlayback");
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Pause Spotify playback
 * @returns {Promise<Object>} - A success or error object.
 */
async function pausePlayback() {
    try {
        await checkAuthorization();

        const spotifyService = await getSpotifyService();
        const result = await spotifyService.pause();

        return result;
    } catch (error) {
        getErrorService().reportError(error, "spotify-command-pausePlayback");
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Skip to the next track on Spotify
 * @returns {Promise<Object>} - A success or error object.
 */
async function skipTrack() {
    try {
        await checkAuthorization();

        const spotifyService = await getSpotifyService();
        const result = await spotifyService.nextTrack();

        return result;
    } catch (error) {
        getErrorService().reportError(error, "spotify-command-skipTrack");
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Go to previous track on Spotify
 * @returns {Promise<Object>} - A success or error object.
 */
async function playPreviousTrack() {
    try {
        await checkAuthorization();

        const spotifyService = await getSpotifyService();
        const result = await spotifyService.previousTrack();

        return result;
    } catch (error) {
        getErrorService().reportError(
            error,
            "spotify-command-playPreviousTrack"
        );
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Shuffle playback on Spotify
 * @returns {Promise<Object>} - A success or error object.
 */
async function shufflePlayback() {
    try {
        await checkAuthorization();

        const spotifyService = await getSpotifyService();
        // This will toggle shuffle on.
        const result = await spotifyService.setShuffle(true);

        return result;
    } catch (error) {
        getErrorService().reportError(error, "spotify-command-shufflePlayback");
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Increase volume on Spotify
 * @returns {Promise<Object>} - A success or error object.
 */
async function increaseVolume() {
    try {
        await checkAuthorization();

        const spotifyService = await getSpotifyService();
        const result = await spotifyService.increaseVolume();

        return result;
    } catch (error) {
        getErrorService().reportError(error, "spotify-command-increaseVolume");
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Decrease volume on Spotify
 * @returns {Promise<Object>} - A success or error object.
 */
async function decreaseVolume() {
    try {
        await checkAuthorization();

        const spotifyService = await getSpotifyService();
        const result = await spotifyService.decreaseVolume();

        return result;
    } catch (error) {
        getErrorService().reportError(error, "spotify-command-decreaseVolume");
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Adds a song to the Spotify queue.
 * @param {Object} args - Arguments from the tool call.
 * @param {string} args.songName - The name of the song to add.
 * @param {string} [args.artistName] - The name of the artist.
 * @returns {Promise<Object>} - A success or error object.
 */
async function addSongToQueue({ songName, artistName }) {
    try {
        await checkAuthorization();
        const spotifyService = await getSpotifyService();
        const result = await spotifyService.addToQueue(songName, artistName);
        return result;
    } catch (error) {
        getErrorService().reportError(error, "spotify-command-addSongToQueue");
        return {
            success: false,
            error: error.message,
        };
    }
}

async function checkAuthorization() {
    const spotifyService = await getSpotifyService();
    if (!spotifyService.isAuthorized()) {
        throw new Error(
            "Spotify service not authorized. Please connect your account in the settings."
        );
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
    decreaseVolume,
    addSongToQueue,
};
