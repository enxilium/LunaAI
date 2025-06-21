const getSpotifyService = require("../../services/spotify-service");
const { getErrorService } = require("../../services/error-service");

async function useSpotifyService(args) {
    const spotifyService = await getSpotifyService();

    switch (args.command) {
        case "play":
            return await spotifyService.play(args.trackId);
        case "pause":
            return await spotifyService.pause();
        case "next":
            return await spotifyService.nextTrack();
        case "previous":
            return await spotifyService.previousTrack();
        case "volume":
            return await spotifyService.setVolume(args.volume);
        default:
            const error = new Error(`Unknown Spotify command: ${args.command}`);
            const errorService = getErrorService();
            errorService.reportError(error, 'spotify-command');
            return {
                type: "error-response",
                message: `Unknown Spotify command: ${args.command}`,
            };
    }
}

module.exports = {
    useSpotifyService,
};