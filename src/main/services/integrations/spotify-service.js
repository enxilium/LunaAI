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
        this.spotifyApi = null;
        this.scopes = [
            "user-read-private",
            "playlist-read-private",
            "user-read-email",
            "user-top-read",
            "user-read-playback-state",
            "user-modify-playback-state",
        ];
        this.isRefreshing = false;
        this.tokenExpiresAt = null;
    }

    /**
     * @description A wrapper for making authenticated API requests.
     * @param {Function} request - The function to execute.
     * @returns {Promise<any>} The result of the request.
     */
    async makeRequest(request) {
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
            throw error;
        }
    }

    /**
     * @description Initialize the service by loading credentials from the store.
     */
    async initialize() {
        const clientId = await this.credentialsService.getCredentials(
            "spotify-client-id"
        );
        const clientSecret = await this.credentialsService.getCredentials(
            "spotify-client-secret"
        );
        const redirectUri = await this.credentialsService.getCredentials(
            "spotify-redirect-uri"
        );

        if (!clientId || !clientSecret || !redirectUri) {
            this.settingsService.setConfig("spotifyAuth", false);
            return;
        }

        this.spotifyApi = new SpotifyWebApi({
            clientId,
            clientSecret,
            redirectUri,
        });

        // Load tokens
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
        // Ensure the API client is initialized before proceeding
        if (!this.spotifyApi) {
            const clientId = await this.credentialsService.getCredentials(
                "spotify-client-id"
            );
            const clientSecret = await this.credentialsService.getCredentials(
                "spotify-client-secret"
            );
            const redirectUri = await this.credentialsService.getCredentials(
                "spotify-redirect-uri"
            );

            if (!clientId || !clientSecret || !redirectUri) {
                return this.emit("spotify-not-authorized");
            }
            this.spotifyApi = new SpotifyWebApi({
                clientId,
                clientSecret,
                redirectUri,
            });
        }

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
                        this.settingsService.setConfig("spotifyAuth", false);
                        this.emit("spotify-not-authorized");
                        reject(error);
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
            this.settingsService.setConfig("spotifyAuth", false);
            throw error;
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * @description Disconnect the application from Spotify.
     */
    async disconnect() {
        return new Promise(async (resolve, reject) => {
            await this.credentialsService.deleteCredentials(
                "spotify.accessToken"
            );
            await this.credentialsService.deleteCredentials(
                "spotify.refreshToken"
            );
            await this.credentialsService.deleteCredentials(
                "spotify.expiresAt"
            );
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
            const response = await this.spotifyApi.getUserPlaylists();
            return { success: true, data: response.body };
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
            const response = await this.spotifyApi.getMyTopTracks({
                time_range: timeRange,
                limit,
            });
            return { success: true, data: response.body };
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
            const response = await this.spotifyApi.getMyTopArtists({
                time_range: timeRange,
                limit,
            });
            return { success: true, data: response.body };
        });
    }

    /**
     * @description Get the currently playing track.
     * @returns {Promise<Object>} The currently playing track.
     */
    async getCurrentlyPlaying() {
        return this.makeRequest(async () => {
            const response = await this.spotifyApi.getMyCurrentPlayingTrack();
            return { success: true, data: response.body };
        });
    }

    /**
     * @description Get the current playback state.
     * @returns {Promise<Object>} The current playback state.
     */
    async getPlaybackState() {
        return this.makeRequest(async () => {
            const response = await this.spotifyApi.getMyCurrentPlaybackState();
            return { success: true, data: response.body };
        });
    }

    /**
     * @description Ensures there is an active device for playback, opening Spotify if necessary.
     * @returns {Promise<string|null>} The ID of an available device, or null.
     */
    async ensureActivePlayback() {
        // 1. Check current playback state for an active device
        let stateResult = await this.getPlaybackState();
        if (stateResult.success && stateResult.data?.device?.id) {
            return stateResult.data.device.id;
        }

        // 2. If no device in state, get list of all available devices
        let devicesResult = await this.getDevices();
        let devices = devicesResult.data?.devices || [];

        // 3. If no devices available, open Spotify and wait.
        if (devices.length === 0) {
            console.log("[SpotifyService] No devices found. Opening Spotify.");
            await openSpotify({});
            await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for Spotify to open

            // Retry getting devices
            devicesResult = await this.getDevices();
            devices = devicesResult.data?.devices || [];

            if (devices.length === 0) {
                throw new Error("No devices found after opening Spotify.");
            }
        }

        // 4. Return the ID of the first available device
        const deviceToUse = devices.find((d) => d.is_active) || devices[0];
        return deviceToUse.id;
    }

    /**
     * @description Searches for content on Spotify.
     * @param {string} queryTerm - The term to search for.
     * @param {string} artist - The artist to search for.
     * @param {string} type - The type of content to search for.
     * @returns {Promise<Object>} The search results.
     */
    async search(queryTerm, artist = "", type = "track") {
        return this.makeRequest(async () => {
            let query = "";
            if (type === "track") {
                query = artist
                    ? `track:${queryTerm} artist:${artist}`
                    : `track:${queryTerm}`;
            } else {
                query = queryTerm;
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
                case "artist":
                    response = await this.spotifyApi.searchArtists(query);
                    break;
                default:
                    throw new Error(`Invalid search type: ${type}`);
            }

            const items =
                response.body.tracks?.items ||
                response.body.playlists?.items ||
                response.body.albums?.items ||
                response.body.artists?.items;

            if (!items || items.length === 0) {
                throw new Error(`No ${type}s found for "${queryTerm}"`);
            }
            return { success: true, data: items[0], allResults: items };
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
     * @param {string} genre - The genre of the content to play.
     * @returns {Promise<Object>} A confirmation message.
     */
    async play(title = "", artist = "", genre = "") {
        const deviceId = await this.ensureActivePlayback();
        if (!deviceId) {
            throw new Error("No Spotify devices available");
        }

        return this.makeRequest(async () => {
            let playOptions = { device_id: deviceId };
            let itemToPlay = null;
            let message = "Now playing"; // Default message

            // Case 1: Specific song and artist
            if (title && artist) {
                const searchResult = await this.search(title, artist, "track");
                if (searchResult.success && searchResult.data) {
                    itemToPlay = searchResult.data;
                    playOptions.uris = [itemToPlay.uri];
                    message = `Now playing "${itemToPlay.name}" by ${itemToPlay.artists[0].name}`;
                }
            }
            // Case 2: Only song title
            else if (title) {
                const searchResult = await this.search(title, "", "track");
                if (searchResult.success && searchResult.data) {
                    itemToPlay = searchResult.data;
                    playOptions.uris = [itemToPlay.uri];
                    message = `Now playing "${itemToPlay.name}" by ${itemToPlay.artists[0].name}`;
                }
            }
            // Case 3: Only artist name
            else if (artist) {
                const searchResult = await this.search(artist, "", "artist");
                if (searchResult.success && searchResult.data) {
                    itemToPlay = searchResult.data;
                    playOptions.context_uri = itemToPlay.uri;
                    message = `Playing music by ${itemToPlay.name}`;
                }
            }
            // Case 4: Only genre
            else if (genre) {
                const searchResult = await this.search(genre, "", "playlist");
                if (searchResult.success && searchResult.data) {
                    itemToPlay = searchResult.data;
                    playOptions.context_uri = itemToPlay.uri;
                    message = `Playing a ${genre} playlist for you.`;
                }
            }
            // Case 5: No criteria (generic "play music")
            else {
                // Play a popular curated playlist (e.g., Today's Top Hits)
                const playlistId = "37i9dQZF1DXcBWIGoYBM5M";
                const playlist = await this.spotifyApi.getPlaylist(playlistId);
                if (playlist.body) {
                    itemToPlay = playlist.body;
                    playOptions.context_uri = itemToPlay.uri;
                    message = `Playing "${itemToPlay.name}" playlist.`;
                }
            }

            if (!playOptions.uris && !playOptions.context_uri) {
                throw new Error(
                    `I couldn't find anything to play based on your request.`
                );
            }

            await this.spotifyApi.play(playOptions);

            return {
                success: true,
                message: message,
                item_details: itemToPlay, // Can be a track, artist, or playlist
            };
        });
    }

    /**
     * @description Adds a track to the user's playback queue.
     * @param {string} title - The title of the track to add.
     * @param {string} [artist=""] - The artist of the track.
     * @returns {Promise<Object>} A confirmation message.
     */
    async addToQueue(title, artist = "") {
        return this.makeRequest(async () => {
            if (!title) {
                throw new Error(
                    "A song title is required to add to the queue."
                );
            }

            // Ensure there's an active device before proceeding.
            await this.ensureActivePlayback();

            const searchResult = await this.search(title, artist, "track");
            if (!searchResult.success || !searchResult.data) {
                throw new Error(
                    `Could not find the song "${title}" by ${
                        artist || "any artist"
                    }.`
                );
            }

            const track = searchResult.data;
            await this.spotifyApi.addToQueue(track.uri);

            return {
                success: true,
                message: `Added "${track.name}" by ${track.artists[0].name} to the queue.`,
                item_details: track,
            };
        });
    }

    /**
     * @description Pauses the current playback.
     * @returns {Promise<Object>} A confirmation message.
     */
    async pause() {
        const deviceId = await this.ensureActivePlayback();
        if (!deviceId) {
            throw new Error("No Spotify devices available");
        }
        return this.makeRequest(async () => {
            const state = await this.getPlaybackState();
            if (state.success && !state.data?.is_playing) {
                return { success: true, message: "Already paused." };
            }
            await this.spotifyApi.pause({ device_id: deviceId });
            return { success: true, message: "Playback paused." };
        });
    }

    /**
     * @description Skips to the next track.
     * @returns {Promise<Object>} A confirmation message.
     */
    async nextTrack() {
        const deviceId = await this.ensureActivePlayback();
        if (!deviceId) {
            throw new Error("No Spotify devices available");
        }
        return this.makeRequest(async () => {
            if (!(await this.ensureActivePlayback())) {
                throw new Error("No Spotify devices available");
            }
            await this.spotifyApi.skipToNext({ device_id: deviceId });
            return { success: true, message: "Skipped to next track." };
        });
    }

    /**
     * @description Skips to the previous track.
     * @returns {Promise<Object>} A confirmation message.
     */
    async previousTrack() {
        const deviceId = await this.ensureActivePlayback();
        if (!deviceId) {
            throw new Error("No Spotify devices available");
        }
        return this.makeRequest(async () => {
            if (!(await this.ensureActivePlayback())) {
                throw new Error("No Spotify devices available");
            }
            await this.spotifyApi.skipToPrevious({ device_id: deviceId });
            return { success: true, message: "Skipped to previous track." };
        });
    }

    /**
     * @description Increases the volume by 10%.
     * @returns {Promise<Object>} A confirmation message.
     */
    async increaseVolume() {
        return this.makeRequest(async () => {
            const { body: state } =
                await this.spotifyApi.getMyCurrentPlaybackState();
            if (!state?.device) {
                throw new Error("No active device found to control volume.");
            }

            const currentVolume = state.device.volume_percent;
            const newVolume = Math.min(currentVolume + 10, 100);

            await this.spotifyApi.setVolume(newVolume, {
                device_id: state.device.id,
            });
            return {
                success: true,
                message: `Volume set to ${newVolume}%`,
            };
        });
    }

    /**
     * @description Decreases the volume by 10%.
     * @returns {Promise<Object>} A confirmation message.
     */
    async decreaseVolume() {
        return this.makeRequest(async () => {
            const { body: state } =
                await this.spotifyApi.getMyCurrentPlaybackState();

            if (!state?.device) {
                throw new Error("No active device found to control volume.");
            }

            const currentVolume = state.device.volume_percent;
            const newVolume = Math.max(currentVolume - 10, 0);

            await this.spotifyApi.setVolume(newVolume, {
                device_id: state.device.id,
            });

            return {
                success: true,
                message: `Volume set to ${newVolume}%`,
            };
        });
    }

    /**
     * @description Get a list of available devices.
     * @returns {Promise<Object>} A list of available devices.
     */
    async getDevices() {
        return this.makeRequest(async () => {
            const response = await this.spotifyApi.getMyDevices();
            return { success: true, data: response.body };
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
            await this.spotifyApi.transferMyPlayback([deviceId], { play });
            return { success: true, message: "Playback transferred." };
        });
    }

    /**
     * @description Set the shuffle mode.
     * @param {boolean} state - The shuffle state.
     * @returns {Promise<Object>} A confirmation message.
     */
    async setShuffle(state) {
        const deviceId = await this.ensureActivePlayback();
        if (!deviceId) {
            throw new Error("No Spotify devices available");
        }
        return this.makeRequest(async () => {
            if (!(await this.ensureActivePlayback())) {
                throw new Error("No Spotify devices available");
            }
            await this.spotifyApi.setShuffle({
                state,
                device_id: deviceId,
            });
            return { success: true, message: `Shuffle set to ${state}.` };
        });
    }
}

module.exports = { getSpotifyService };
