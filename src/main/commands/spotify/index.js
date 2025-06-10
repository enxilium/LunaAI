const getSpotifyService = require("../../services/spotify-service");

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
            console.error(`Unknown Spotify command: ${args.command}`);
            return {
                type: "error-response",
                message: `Unknown Spotify command: ${args.command}`,
            };
    }
}

module.exports = {
    useSpotifyService,
};