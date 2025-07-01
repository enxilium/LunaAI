const { EventEmitter } = require("events");
const http = require("http");
const url = require("url");
const { shell } = require("electron");
const SpotifyWebApi = require("spotify-web-api-node");
const Fuse = require("fuse.js");
const { getErrorService } = require("../error-service");
const { getCredentialsService } = require("../user/credentials-service");
const { getSettingsService } = require("../user/settings-service");
const { openSpotify } = require("../../commands/open");

let spotifyService = null;

/**
 * @description Get the singleton spotify service instance.
 * @returns {Promise<SpotifyService>} The spotify service instance.
 */
async function getSpotifyService() {
    if (!spotifyService) {
        const credentialsService = getCredentialsService();
        const settingsService = getSettingsService();
        spotifyService = new SpotifyService(
            credentialsService,
            settingsService
        );
        await spotifyService.initialize();
    }
    return spotifyService;
}

/**
 * @class SpotifyService
 * @description A service for interacting with the Spotify API.
 * @extends EventEmitter
 */
class SpotifyService extends EventEmitter {
    constructor(credentialsService, settingsService) {
        super();
        this.credentialsService = credentialsService;
        this.settingsService = settingsService;
        this.spotifyApi = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            redirectUri: process.env.SPOTIFY_REDIRECT_URI,
        });
        this.scopes = [
            "user-read-private",
            "playlist-read-private",
            "user-read-email",
            "user-top-read",
            "user-read-playback-state",
            "user-modify-playback-state",
        ];
        this.isRefreshing = false;
        this.errorService = getErrorService();
        this.tokenExpiresAt = null;
    }

    /**
     * @description Reports an error and formats it for return
     * @param {Error} error - The error that occurred
     * @param {string} method - The method where the error occurred
     * @returns {Object} - Error object with message and success flag
     */
    reportError(error, method) {
        this.errorService.reportError(error, `spotify-service.${method}`);
        return {
            success: false,
            error: `Error in ${method}: ${error.message}`,
        };
    }

    /**
     * @description A wrapper for making authenticated API requests.
     * @param {Function} request - The function to execute.
     * @returns {Promise<any>} The result of the request.
     */
    async makeRequest(request) {
        if (!this.isAuthorized()) {
            return { success: false, error: "Not authorized with Spotify" };
        }
        if (this.tokenExpiresAt && new Date() >= this.tokenExpiresAt) {
            await this.refreshToken();
        }
        try {
            return await request();
        } catch (error) {
            if (error.statusCode === 401) {
                await this.refreshToken();
                return await request();
            }
            // Rethrow the error to be caught by the calling function's try/catch block
            throw error;
        }
    }

    /**
     * @description Initialize the service by loading credentials from the store.
     */
    async initialize() {
        const accessToken = await this.credentialsService.getCredentials(
            "spotify.accessToken"
        );
        const refreshToken = await this.credentialsService.getCredentials(
            "spotify.refreshToken"
        );
        const expiresAt = await this.credentialsService.getCredentials(
            "spotify.expiresAt"
        );

        if (accessToken && refreshToken && expiresAt) {
            this.spotifyApi.setAccessToken(accessToken);
            this.spotifyApi.setRefreshToken(refreshToken);
            this.tokenExpiresAt = new Date(expiresAt);

            if (new Date() >= this.tokenExpiresAt) {
                await this.refreshToken();
            } else {
                this.settingsService.setConfig("spotifyAuth", true);
            }
        } else {
            this.settingsService.setConfig("spotifyAuth", false);
        }
    }

    /**
     * @description Checks if the user is authorized with Spotify.
     * @returns {boolean} - True if authorized, false otherwise.
     */
    isAuthorized() {
        return this.settingsService.getConfig("spotifyAuth") === true;
    }

    /**
     * @description Authorize the application with Spotify.
     * @returns {Promise<boolean>} A promise that resolves with true if the authorization was successful, and false otherwise.
     */
    async authorize() {
        return new Promise((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                const parsedUrl = url.parse(req.url, true);
                if (parsedUrl.pathname === "/callback") {
                    const code = parsedUrl.query.code;
                    if (!code) {
                        res.writeHead(400, { "Content-Type": "text/html" });
                        res.end(
                            "<h1>Authentication failed</h1><p>No authorization code received</p>"
                        );
                        server.close();
                        return reject(
                            new Error("No authorization code received.")
                        );
                    }
                    res.writeHead(200, { "Content-Type": "text/html" });
                    res.end(
                        "<h1>Authentication successful!</h1><p>You can close this window and return to Luna.</p>"
                    );
                    server.close();
                    try {
                        const data =
                            await this.spotifyApi.authorizationCodeGrant(code);
                        const { access_token, refresh_token, expires_in } =
                            data.body;
                        this.spotifyApi.setAccessToken(access_token);
                        this.spotifyApi.setRefreshToken(refresh_token);
                        const expiresAt =
                            new Date().getTime() + expires_in * 1000;
                        this.tokenExpiresAt = new Date(expiresAt);

                        await this.credentialsService.setCredentials(
                            "spotify.accessToken",
                            access_token
                        );
                        await this.credentialsService.setCredentials(
                            "spotify.refreshToken",
                            refresh_token
                        );
                        await this.credentialsService.setCredentials(
                            "spotify.expiresAt",
                            this.tokenExpiresAt.toISOString()
                        );
                        this.settingsService.setConfig("spotifyAuth", true);
                        this.emit("spotify-authorized");
                        resolve(true);
                    } catch (error) {
                        this.reportError(error, "authorize-grant");
                        this.settingsService.setConfig("spotifyAuth", false);
                        reject(false);
                    }
                }
            });

            server.listen(8888, () => {
                const state = Math.random().toString(36).substring(2, 15);
                const authUrl = this.spotifyApi.createAuthorizeURL(
                    this.scopes,
                    state,
                    true // showDialog
                );
                shell.openExternal(authUrl);
            });

            server.on("error", (err) => {
                this.reportError(err, "authorize-server");
                reject(new Error(`Server error: ${err.message}`));
            });
        });
    }

    /**
     * @description Refresh the access token.
     */
    async refreshToken() {
        if (this.isRefreshing) {
            // Avoid multiple refresh attempts simultaneously
            // Wait for the ongoing refresh to complete
            return new Promise((resolve) => {
                const checkRefresh = () => {
                    if (!this.isRefreshing) {
                        resolve();
                    } else {
                        setTimeout(checkRefresh, 100);
                    }
                };
                checkRefresh();
            });
        }
        this.isRefreshing = true;

        try {
            const data = await this.spotifyApi.refreshAccessToken();
            const { access_token, expires_in } = data.body;
            this.spotifyApi.setAccessToken(access_token);

            const expiresAt = new Date().getTime() + expires_in * 1000;
            this.tokenExpiresAt = new Date(expiresAt);

            await this.credentialsService.setCredentials(
                "spotify.accessToken",
                access_token
            );
            await this.credentialsService.setCredentials(
                "spotify.expiresAt",
                this.tokenExpiresAt.toISOString()
            );
            this.settingsService.setConfig("spotifyAuth", true);
        } catch (error) {
            this.reportError(error, "refreshToken");
            this.settingsService.setConfig("spotifyAuth", false);
            this.emit("spotify-not-authorized");
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * @description Disconnect the application from Spotify.
     */
    async disconnect() {
        return new Promise(async (resolve, reject) => {
            await this.credentialsService.deleteCredentials("spotify.accessToken");
            await this.credentialsService.deleteCredentials("spotify.refreshToken");
            await this.credentialsService.deleteCredentials("spotify.expiresAt");
            this.settingsService.setConfig("spotifyAuth", false);
            this.spotifyApi.setAccessToken(null);
            this.spotifyApi.setRefreshToken(null);
            this.tokenExpiresAt = null;
            resolve(true);
        });
    }

    // --- Playback and Content Methods ---

    /**
     * @description Get the user's playlists.
     * @returns {Promise<Object>} The user's playlists.
     */
    async getPlaylists() {
        return this.makeRequest(async () => {
            try {
                const response = await this.spotifyApi.getUserPlaylists();
                return { success: true, data: response.body };
            } catch (error) {
                return this.reportError(error, "getPlaylists");
            }
        });
    }

    /**
     * @description Get the user's top tracks.
     * @param {string} timeRange - The time range for the top tracks.
     * @param {number} limit - The number of tracks to retrieve.
     * @returns {Promise<Object>} The user's top tracks.
     */
    async getTopTracks(timeRange = "medium_term", limit = 20) {
        return this.makeRequest(async () => {
            try {
                const response = await this.spotifyApi.getMyTopTracks({
                    time_range: timeRange,
                    limit,
                });
                return { success: true, data: response.body };
            } catch (error) {
                return this.reportError(error, "getTopTracks");
            }
        });
    }

    /**
     * @description Get the user's top artists.
     * @param {string} timeRange - The time range for the top artists.
     * @param {number} limit - The number of artists to retrieve.
     * @returns {Promise<Object>} The user's top artists.
     */
    async getTopArtists(timeRange = "medium_term", limit = 20) {
        return this.makeRequest(async () => {
            try {
                const response = await this.spotifyApi.getMyTopArtists({
                    time_range: timeRange,
                    limit,
                });
                return { success: true, data: response.body };
            } catch (error) {
                return this.reportError(error, "getTopArtists");
            }
        });
    }

    /**
     * @description Get the currently playing track.
     * @returns {Promise<Object>} The currently playing track.
     */
    async getCurrentlyPlaying() {
        return this.makeRequest(async () => {
            try {
                const response =
                    await this.spotifyApi.getMyCurrentPlayingTrack();
                return { success: true, data: response.body };
            } catch (error) {
                return this.reportError(error, "getCurrentlyPlaying");
            }
        });
    }

    /**
     * @description Get the current playback state.
     * @returns {Promise<Object>} The current playback state.
     */
    async getPlaybackState() {
        return this.makeRequest(async () => {
            try {
                const response =
                    await this.spotifyApi.getMyCurrentPlaybackState();
                return { success: true, data: response.body };
            } catch (error) {
                return this.reportError(error, "getPlaybackState");
            }
        });
    }

    /**
     * @description Ensures there is an active device for playback, opening Spotify if necessary.
     * @returns {Promise<boolean>} True if playback is active, false otherwise.
     */
    async ensureActivePlayback() {
        try {
            const stateResult = await this.getPlaybackState();
            if (stateResult.success && stateResult.data?.device) {
                return true;
            }

            const devicesResult = await this.getDevices();
            if (!devicesResult.success) return false;

            let devices = devicesResult.data?.devices || [];

            if (devices.length === 0) {
                console.log(
                    "[SpotifyService] No devices found. Opening Spotify."
                );
                await openSpotify({});
                await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for Spotify to open

                // Retry getting devices
                const newDevicesResult = await this.getDevices();
                if (!newDevicesResult.success) return false;
                devices = newDevicesResult.data?.devices || [];

                if (devices.length === 0) {
                    this.reportError(
                        new Error("No devices found after opening Spotify."),
                        "ensureActivePlayback"
                    );
                    return false;
                }
            }

            const activeDevice = devices.find((d) => d.is_active);
            const deviceToUse = activeDevice || devices[0];

            await this.transferPlayback(deviceToUse.id, false);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return true;
        } catch (error) {
            this.reportError(error, "ensureActivePlayback");
            return false;
        }
    }

    /**
     * @description Searches for content on Spotify.
     * @param {string} track - The track to search for.
     * @param {string} artist - The artist to search for.
     * @param {string} type - The type of content to search for.
     * @returns {Promise<Object>} The search results.
     */
    async search(track, artist = "", type = "track") {
        return this.makeRequest(async () => {
            try {
                let query = "";
                if (type === "track") {
                    query = artist
                        ? `track:${track} artist:${artist}`
                        : `track:${track}`;
                } else {
                    query = track;
                }

                let response;
                switch (type) {
                    case "track":
                        response = await this.spotifyApi.searchTracks(query);
                        break;
                    case "playlist":
                        response = await this.spotifyApi.searchPlaylists(query);
                        break;
                    case "album":
                        response = await this.spotifyApi.searchAlbums(query);
                        break;
                    default:
                        return {
                            success: false,
                            error: `Invalid search type: ${type}`,
                        };
                }

                const items =
                    response.body.tracks?.items ||
                    response.body.playlists?.items ||
                    response.body.albums?.items;

                if (!items || items.length === 0) {
                    return {
                        success: false,
                        error: `No ${type}s found for "${track}"`,
                    };
                }
                return { success: true, data: items[0], allResults: items };
            } catch (error) {
                return this.reportError(error, "search");
            }
        });
    }

    /**
     * Find the best matching playlist from user's playlists using fuzzy matching
     * @param {string} title - The title to search for
     * @param {Array} playlists - List of user's playlists
     * @returns {Object|null} - Best matching playlist or null if none found
     */
    findBestMatchingPlaylist(title, playlists) {
        if (!title || !playlists || playlists.length === 0) {
            return null;
        }

        const options = {
            includeScore: true,
            threshold: 0.6,
            keys: [{ name: "name", weight: 2 }],
        };

        const fuse = new Fuse(playlists, options);
        const results = fuse.search(title);
        return results.length > 0 ? results[0].item : null;
    }

    /**
     * @description Plays a track, album, or playlist.
     * @param {string} title - The title of the content to play.
     * @param {string} artist - The artist of the content to play.
     * @param {string} type - The type of content to play.
     * @param {boolean} personal - Whether to search for personal playlists.
     * @returns {Promise<Object>} A confirmation message.
     */
    async play(title, artist = "", type = "track", personal = false) {
        if (!this.isAuthorized()) {
            return {
                success: false,
                error: "Not authorized with Spotify. Try first calling the authorize service tool for Spotify.",
            };
        }
        if (!(await this.ensureActivePlayback())) {
            return { success: false, error: "No Spotify devices available" };
        }

        try {
            let itemToPlay = null;

            if (personal && type === "playlist") {
                const playlistsResult = await this.getPlaylists();
                if (playlistsResult.success) {
                    const userProfile = await this.spotifyApi.getMe();
                    const userId = userProfile.body.id;
                    const personalPlaylists = playlistsResult.data.items.filter(
                        (p) => p.owner.id === userId
                    );
                    itemToPlay = this.findBestMatchingPlaylist(
                        title,
                        personalPlaylists
                    );
                }
            }

            if (!itemToPlay) {
                const searchResult = await this.search(title, artist, type);
                if (!searchResult.success) return searchResult;
                itemToPlay = searchResult.data;
            }

            if (!itemToPlay) {
                return {
                    success: false,
                    error: `Could not find a ${type} matching "${title}"`,
                };
            }

            if (type === "track") {
                await this.spotifyApi.play({ uris: [itemToPlay.uri] });
            } else {
                await this.spotifyApi.play({ context_uri: itemToPlay.uri });
            }

            return {
                success: true,
                message: `Now playing ${type}: "${itemToPlay.name}"`,
                item_details: itemToPlay,
            };
        } catch (error) {
            return this.reportError(error, "play");
        }
    }

    /**
     * @description Pauses the current playback.
     * @returns {Promise<Object>} A confirmation message.
     */
    async pause() {
        return this.makeRequest(async () => {
            try {
                const state = await this.getPlaybackState();
                if (state.success && !state.data?.is_playing) {
                    return { success: true, message: "Already paused." };
                }
                await this.spotifyApi.pause();
                return { success: true, message: "Playback paused." };
            } catch (error) {
                return this.reportError(error, "pause");
            }
        });
    }

    /**
     * @description Skips to the next track.
     * @returns {Promise<Object>} A confirmation message.
     */
    async nextTrack() {
        return this.makeRequest(async () => {
            try {
                if (!(await this.ensureActivePlayback())) {
                    return {
                        success: false,
                        error: "No Spotify devices available",
                    };
                }
                await this.spotifyApi.skipToNext();
                return { success: true, message: "Skipped to next track." };
            } catch (error) {
                return this.reportError(error, "nextTrack");
            }
        });
    }

    /**
     * @description Skips to the previous track.
     * @returns {Promise<Object>} A confirmation message.
     */
    async previousTrack() {
        return this.makeRequest(async () => {
            try {
                if (!(await this.ensureActivePlayback())) {
                    return {
                        success: false,
                        error: "No Spotify devices available",
                    };
                }
                await this.spotifyApi.skipToPrevious();
                return { success: true, message: "Skipped to previous track." };
            } catch (error) {
                return this.reportError(error, "previousTrack");
            }
        });
    }

    /**
     * @description Sets the volume.
     * @param {number} volumePercent - The volume percentage.
     * @returns {Promise<Object>} A confirmation message.
     */
    async setVolume(volumePercent) {
        return this.makeRequest(async () => {
            try {
                if (!(await this.ensureActivePlayback())) {
                    return {
                        success: false,
                        error: "No Spotify devices available",
                    };
                }
                await this.spotifyApi.setVolume(volumePercent);
                return {
                    success: true,
                    message: `Volume set to ${volumePercent}%`,
                };
            } catch (error) {
                return this.reportError(error, "setVolume");
            }
        });
    }

    /**
     * @description Get a list of available devices.
     * @returns {Promise<Object>} A list of available devices.
     */
    async getDevices() {
        return this.makeRequest(async () => {
            try {
                const response = await this.spotifyApi.getMyDevices();
                return { success: true, data: response.body };
            } catch (error) {
                return this.reportError(error, "getDevices");
            }
        });
    }

    /**
     * @description Transfer playback to a different device.
     * @param {string} deviceId - The ID of the device to transfer playback to.
     * @param {boolean} play - Whether to start playback after transferring.
     * @returns {Promise<Object>} A confirmation message.
     */
    async transferPlayback(deviceId, play = true) {
        return this.makeRequest(async () => {
            try {
                await this.spotifyApi.transferMyPlayback([deviceId], { play });
                return { success: true, message: "Playback transferred." };
            } catch (error) {
                return this.reportError(error, "transferPlayback");
            }
        });
    }

    /**
     * @description Set the shuffle mode.
     * @param {boolean} state - The shuffle state.
     * @returns {Promise<Object>} A confirmation message.
     */
    async setShuffle(state) {
        return this.makeRequest(async () => {
            try {
                if (!(await this.ensureActivePlayback())) {
                    return {
                        success: false,
                        error: "No Spotify devices available",
                    };
                }
                await this.spotifyApi.setShuffle({ state });
                return { success: true, message: `Shuffle set to ${state}.` };
            } catch (error) {
                return this.reportError(error, "setShuffle");
            }
        });
    }
}

module.exports = { getSpotifyService };
