const { getUserData } = require("./credentials-service");
const { getErrorService } = require("./error-service");
const http = require("http");
const url = require("url");
const { shell } = require("electron");
const SpotifyWebApi = require('spotify-web-api-node');
const { openSpotify } = require("../commands/open")
const Fuse = require('fuse.js');

const userData = getUserData();

/**
 * Spotify Service
 * Manages authentication and interaction with Spotify API using spotify-web-api-node
 */
class SpotifyService {
    constructor() {
        this.clientId = process.env.SPOTIFY_CLIENT_ID;
        this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        this.redirectUri =
            process.env.SPOTIFY_REDIRECT_URI ||
            "http://localhost:8888/callback";
        this.scopes = [
            "user-read-private",
            "playlist-read-private",
            "user-read-email",
            "user-top-read",
            "user-read-playback-state",
            "user-modify-playback-state",
        ];
        
        // Initialize the Spotify API wrapper
        this.spotifyApi = new SpotifyWebApi({
            clientId: this.clientId,
            clientSecret: this.clientSecret,
            redirectUri: this.redirectUri
        });
        
        this.accessToken = null;
        this.refreshToken = null;
        this.authorized = false;
        this.errorService = null;
    }

    // Core authentication and token methods

    async initialize() {
        try {
            this.errorService = getErrorService();
            
            // Check for stored tokens
            const accessToken = await userData.getCredentials(
                "spotify.accessToken"
            );
            const refreshToken = await userData.getCredentials(
                "spotify.refreshToken"
            );
            const expiresAt = await userData.getCredentials(
                "spotify.expiresAt"
            );

            if (accessToken && refreshToken && expiresAt) {
                this.accessToken = accessToken;
                this.refreshToken = refreshToken;
                
                // Set the tokens on the API instance
                this.spotifyApi.setAccessToken(accessToken);
                this.spotifyApi.setRefreshToken(refreshToken);

                const expiryTime = parseInt(expiresAt);

                if (Date.now() >= expiryTime) {
                    // Token expired, refresh it
                    return await this.refreshAccessToken();
                }

                this.authorized = true;
                return true;
            }

            return false;
        } catch (error) {
            this.reportError(error, "initialize");
            return false;
        }
    }

    /**
     * Reports an error and formats it for return
     * @param {Error} error - The error that occurred
     * @param {string} method - The method where the error occurred
     * @returns {Object} - Error object with message and success flag
     */
    reportError(error, method) {
        // Report to error service if available
        if (this.errorService) {
            this.errorService.reportError(error, `spotify-service.${method}`);
        }
        
        // Return formatted error object
        return {
            success: false,
            error: `Error in ${method}: ${error.message}`
        };
    }

    async authorize() {
        return new Promise((resolve, reject) => {
            // Create a temporary server to handle the callback
            const server = http.createServer(async (req, res) => {
                const parsedUrl = url.parse(req.url, true);

                if (parsedUrl.pathname === "/callback") {
                    // We got the callback with the authorization code
                    const code = parsedUrl.query.code;

                    if (!code) {
                        res.writeHead(400, { "Content-Type": "text/html" });
                        res.end(
                            "<h1>Authentication failed</h1><p>No authorization code received</p>"
                        );
                        server.close();
                        reject(new Error("No authorization code received"));
                        return;
                    }

                    // Display success message to the user
                    res.writeHead(200, { "Content-Type": "text/html" });
                    res.end(
                        "<h1>Authentication successful!</h1><p>You can close this window and return to Luna.</p>"
                    );

                    try {
                        // Exchange code for tokens using the wrapper library
                        const data = await this.spotifyApi.authorizationCodeGrant(code);

                        // Store tokens
                        this.accessToken = data.body.access_token;
                        this.refreshToken = data.body.refresh_token;
                        
                        // Set tokens on the API instance
                        this.spotifyApi.setAccessToken(data.body.access_token);
                        this.spotifyApi.setRefreshToken(data.body.refresh_token);

                        // Store tokens in user data
                        await userData.setCredentials(
                            "spotify.accessToken",
                            data.body.access_token
                        );
                        await userData.setCredentials(
                            "spotify.refreshToken",
                            data.body.refresh_token
                        );
                        await userData.setCredentials(
                            "spotify.expiresAt",
                            String(Date.now() + data.body.expires_in * 1000)
                        );

                        this.authorized = true;

                        server.close();
                        resolve(true);
                    } catch (error) {
                        this.reportError(error, "authorize");
                        server.close();
                        reject(error);
                    }
                }
            });

            // Parse the redirectUri to get the port
            const redirectUrl = new URL(this.redirectUri);
            const port = parseInt(redirectUrl.port) || 8888;

            // Start the server
            server.listen(port, async () => {
                try {
                    // Generate random state for CSRF protection
                    const state = Math.random().toString(36).substring(2, 15);

                    // Generate the authorization URL using the wrapper
                    const authUrl = this.spotifyApi.createAuthorizeURL(
                        this.scopes, 
                        state, 
                        true // showDialog
                    );

                    // Open URL in user's default browser
                    await shell.openExternal(authUrl);
                } catch (error) {
                    server.close();
                    this.reportError(error, "authorize");
                    reject(
                        new Error(`Failed to open browser: ${error.message}`)
                    );
                }
            });

            // Handle server errors
            server.on("error", (err) => {
                this.reportError(err, "authorize-server");
                reject(new Error(`Server error: ${err.message}`));
            });
        });
    }

    async refreshAccessToken() {
        try {
            if (!this.refreshToken) {
                this.authorized = false;
                return false;
            }

            // Use the wrapper to refresh the token
            const data = await this.spotifyApi.refreshAccessToken();

            // Update the access token
            this.accessToken = data.body.access_token;
            this.spotifyApi.setAccessToken(data.body.access_token);
            
            // Store the new token
            await userData.setCredentials(
                "spotify.accessToken",
                data.body.access_token
            );
            await userData.setCredentials(
                "spotify.expiresAt",
                String(Date.now() + data.body.expires_in * 1000)
            );

            this.authorized = true;
            return true;
        } catch (error) {
            this.reportError(error, "refreshAccessToken");
            this.authorized = false;
            return false;
        }
    }

    async getPlaylists() {
        try {
            // Ensure we have valid tokens
            if (!this.accessToken) {
                const initialized = await this.initialize();
                if (!initialized) {
                    await this.authorize();
                }
            }
            
            const response = await this.spotifyApi.getUserPlaylists();

            return response.body;
        } catch (error) {
            // Return error message instead of throwing
            return this.reportError(error, "getPlaylists");
        }
    }

    async getTopTracks(timeRange = "medium_term", limit = 20) {
        try {
            const response = await this.spotifyApi.getMyTopTracks({ 
                time_range: timeRange, 
                limit 
            });
            return response.body;
        } catch (error) {
            // Return error message instead of throwing
            return this.reportError(error, "getTopTracks");
        }
    }

    async getTopArtists(timeRange = "medium_term", limit = 20) {
        try {
            const response = await this.spotifyApi.getMyTopArtists({ 
                time_range: timeRange, 
                limit 
            });
            return response.body;
        } catch (error) {
            // Return error message instead of throwing
            return this.reportError(error, "getTopArtists");
        }
    }

    async getCurrentlyPlaying() {
        try {
            const response = await this.spotifyApi.getMyCurrentPlayingTrack();
            return response.body;
        } catch (error) {
            // Return error message instead of throwing
            return this.reportError(error, "getCurrentlyPlaying");
        }
    }

    async getPlaybackState() {
        try {
            const response = await this.spotifyApi.getMyCurrentPlaybackState();
            return response.body;
        } catch (error) {
            // Return error message instead of throwing
            return this.reportError(error, "getPlaybackState");
        }
    }

    async ensureActivePlayback() {
        try {
            // Check if we already have active playback
            const state = await this.getPlaybackState();

            // Check if state has an error
            if (state && state.error) {
                return false;
            }

            // If active playback exists, we're good to go
            if (state && state.device) {
                return true;
            }

            // Otherwise, find available devices
            const devicesResponse = await this.spotifyApi.getMyDevices();
            
            // Check if devices response has an error
            if (devicesResponse.error) {
                return false;
            }
            
            let devices = devicesResponse.body;
            
            if (!devices || !devices.devices || devices.devices.length === 0) {
                console.log("[SpotifyService] No Spotify devices available. Attempting to open Spotify application.");

                // Create an empty context map
                let context_map = {};
                
                // Open Spotify application using the improved openSpotify function
                const openResult = await openSpotify(context_map);

                // Check if there was an error opening Spotify
                if (openResult.context_map.error) {
                    return this.reportError(new Error(openResult.context_map.error), "ensureActivePlayback");
                }

                console.log(
                    "[SpotifyService] Spotify opened successfully, waiting for it to initialize..."
                );
                
                // Wait longer for Spotify to initialize (5 seconds instead of 3)
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // Try to get devices with retries
                const maxRetries = 5;
                let retryCount = 0;
                let deviceFound = false;
                
                while (retryCount < maxRetries && !deviceFound) {
                    try {
                        const newDevicesResponse = await this.spotifyApi.getMyDevices();
                        devices = newDevicesResponse.body;
                        
                        if (devices && devices.devices && devices.devices.length > 0) {
                            deviceFound = true;
                        } else {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            retryCount++;
                        }
                    } catch (deviceError) {
                        console.log(`[SpotifyService] Error checking devices (attempt ${retryCount + 1}): ${deviceError.message}`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        retryCount++;
                    }
                }
                
                // If still no devices after all retries, return an error
                if (!deviceFound) {
                    return this.reportError(
                        new Error("Spotify opened but no devices became available after multiple attempts"), 
                        "ensureActivePlayback"
                    );
                }
            }

            // Pick the first available device
            const device = devices.devices.find((d) => d.is_active) || devices.devices[0];
            console.log(`[SpotifyService] Activating Spotify device: ${device.name}`);

            // Transfer playback to this device WITHOUT starting playback automatically
            const transferResult = await this.transferPlayback(device.id, false);
            
            // Check if transfer was successful
            if (transferResult.error) {
                return this.reportError(new Error(transferResult.error), "ensureActivePlayback");
            }

            // Give Spotify a moment to register the change
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return true;
        } catch (error) {
            return this.reportError(error, "ensureActivePlayback");
        }
    }

    async search(track, artist = '', type = "track") {
        try {
            let response;
            let query = "";
            
            // Build query based on search type
            if (type === "track") {
                // For track searches, we can use both track and artist
                query = artist 
                    ? `track:${track} artist:${artist}`
                    : `track:${track}`;
            } else if (type === "album" && artist) {
                // For album searches with artist name
                query = `album:${track} artist:${artist}`;
            } else if (type === "album") {
                // For album searches without artist name
                query = `album:${track}`;
            } else if (type === "playlist" && artist) {
                // For playlist searches, artist name can be part of the query
                // but not as a specific filter since playlists don't have "artists"
                query = `${track} ${artist}`;
            } else {
                // Default case for playlist without artist or other types
                query = track;
            }
            
            console.log(`Searching for ${type} with query: ${query}`);

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
                        error: `Invalid search type: ${type}`
                    };
            }
            
            // Check if we have results based on the type
            let items = [];
            let propertyName = "";
            
            switch(type) {
                case "track":
                    if (!response.body.tracks || !response.body.tracks.items.length) {
                        console.log('No tracks found matching the search criteria');
                        return { 
                            success: false,
                            error: `No tracks found matching "${track}" ${artist ? `by "${artist}"` : ''}`
                        };
                    }
                    items = response.body.tracks.items.filter(item => item !== null);
                    propertyName = "track";
                    break;
                case "playlist":
                    if (!response.body.playlists || !response.body.playlists.items.length) {
                        console.log('No playlists found matching the search criteria');
                        return { 
                            success: false,
                            error: `No playlists found matching "${track}"`
                        };
                    }
                    items = response.body.playlists.items.filter(item => item !== null);
                    propertyName = "playlist";
                    break;
                case "album":
                    if (!response.body.albums || !response.body.albums.items.length) {
                        console.log('No albums found matching the search criteria');
                        return { 
                            success: false,
                            error: `No albums found matching "${track}" ${artist ? `by "${artist}"` : ''}`
                        };
                    }
                    items = response.body.albums.items.filter(item => item !== null);
                    propertyName = "album";
                    break;
            }
            
            // Make sure we still have items after filtering nulls
            if (items.length === 0) {
                return {
                    success: false,
                    error: `No valid ${type}s found matching the search criteria`
                };
            }
            
            // Get the top result
            const topResult = items[0];
            
            // Format the result based on the type
            let formattedResult = { success: true };
            
            switch(type) {
                case "track":
                    formattedResult[propertyName] = {
                        id: topResult.id,
                        name: topResult.name,
                        uri: topResult.uri,
                        artists: Array.isArray(topResult.artists) ? topResult.artists.map(artist => ({
                            name: artist?.name || 'Unknown Artist',
                            id: artist?.id || 'unknown'
                        })) : [{ name: 'Unknown Artist', id: 'unknown' }],
                        album: {
                            name: topResult.album?.name || 'Unknown Album',
                            release_date: topResult.album?.release_date || 'Unknown Date'
                        },
                        duration_ms: topResult.duration_ms || 0,
                        popularity: topResult.popularity || 0
                    };
                    formattedResult.allResults = items.map(item => ({
                        id: item.id || 'unknown',
                        name: item.name || 'Unknown Track',
                        uri: item.uri || '',
                        artists: Array.isArray(item.artists) ? item.artists.map(artist => artist?.name || 'Unknown Artist').join(', ') : 'Unknown Artist',
                        album: item.album?.name || 'Unknown Album'
                    }));
                    break;
                case "playlist":
                    formattedResult[propertyName] = {
                        id: topResult.id || 'unknown',
                        name: topResult.name || 'Unknown Playlist',
                        uri: topResult.uri || '',
                        owner: {
                            id: topResult.owner?.id || 'unknown',
                            display_name: topResult.owner?.display_name || 'Unknown Owner'
                        },
                        tracks: {
                            total: topResult.tracks?.total || 0
                        },
                        description: topResult.description || '',
                        public: topResult.public || false,
                        collaborative: topResult.collaborative || false
                    };
                    formattedResult.allResults = items.map(item => {
                        if (!item) return null;
                        return {
                            id: item.id || 'unknown',
                            name: item.name || 'Unknown Playlist',
                            uri: item.uri || '',
                            owner: item.owner?.display_name || 'Unknown Owner',
                            tracks: item.tracks?.total || 0
                        };
                    }).filter(item => item !== null);
                    break;
                case "album":
                    formattedResult[propertyName] = {
                        id: topResult.id || 'unknown',
                        name: topResult.name || 'Unknown Album',
                        uri: topResult.uri || '',
                        artists: Array.isArray(topResult.artists) ? topResult.artists.map(artist => ({
                            name: artist?.name || 'Unknown Artist',
                            id: artist?.id || 'unknown'
                        })) : [{ name: 'Unknown Artist', id: 'unknown' }],
                        release_date: topResult.release_date || 'Unknown Date',
                        total_tracks: topResult.total_tracks || 0,
                        album_type: topResult.album_type || 'album'
                    };
                    formattedResult.allResults = items.map(item => {
                        if (!item) return null;
                        return {
                            id: item.id || 'unknown',
                            name: item.name || 'Unknown Album',
                            uri: item.uri || '',
                            artists: Array.isArray(item.artists) ? item.artists.map(artist => artist?.name || 'Unknown Artist').join(', ') : 'Unknown Artist',
                            release_date: item.release_date || 'Unknown Date',
                            total_tracks: item.total_tracks || 0
                        };
                    }).filter(item => item !== null);
                    break;
            }
            
            return formattedResult;
        } catch (error) {
            // Return error message instead of throwing
            return this.reportError(error, "search");
        }
    }

    /**
     * Find the best matching playlist from user's playlists using fuzzy matching
     * @param {string} title - The title to search for
     * @param {Array} playlists - List of user's playlists
     * @returns {Object|null} - Best matching playlist or null if none found
     */
    findBestMatchingPlaylist(title, playlists) {
        if (!title || !playlists || !playlists.items || playlists.items.length === 0) {
            return null;
        }

        // If title is too short, it's too vague for matching
        if (title.trim().length < 2) {
            return null;
        }
        
        // Configure Fuse with options for playlist search
        const options = {
            includeScore: true,     // Return score with results
            threshold: 0.6,         // Higher threshold = less strict matching (0-1)
            keys: [
                { name: 'name', weight: 2 }  // Focus on playlist name
            ],
            minMatchCharLength: 1,  // Minimum characters that must match
            shouldSort: true        // Sort results by score
        };
        
        // Create a new Fuse instance with the playlists
        const fuse = new Fuse(playlists.items, options);
        
        // Perform the search
        const results = fuse.search(title);
        
        // Return the best match if any found, otherwise null
        return results.length > 0 ? results[0].item : null;
    }

    async play(title, artist = "", type = "track", personal = false) {
        try {
            // Ensure we have an active device first
            if (!(await this.ensureActivePlayback())) {
                return {
                    success: false,
                    error: "No Spotify devices available"
                };
            }

            let itemToPlay = null;
            let artistsText = "";

            // Search for the content based on type if not personal
            if (!personal) {
                const searchResult = await this.search(title, artist, type);
                
                if (!searchResult.success) {
                    return searchResult; // Return the error from search
                }
                
                // Extract the appropriate item based on type
                if (type === "track") {
                    itemToPlay = searchResult.track;
                    artistsText = `by "${itemToPlay.artists.map(a => a.name).join(', ')}"`;
                } else if (type === "playlist") {
                    itemToPlay = searchResult.playlist;
                    artistsText = `by ${itemToPlay.owner.display_name}`;
                } else if (type === "album") {
                    itemToPlay = searchResult.album;
                    artistsText = `by "${itemToPlay.artists.map(a => a.name).join(', ')}"`;
                }
            } else {
                // For personal playlists, first get the current user's profile
                try {
                    // Get the current user's profile to identify their playlists
                    const userProfile = await this.spotifyApi.getMe();
                    const userId = userProfile.body.id;
                    
                    // Get user's playlists
                    const playlists = await this.getPlaylists();
                    
                    // Check if playlists response has an error
                    if (playlists.error) {
                        return playlists; // Return the error
                    }
                    
                    // Filter to only include the user's own playlists
                    const personalPlaylists = {
                        ...playlists,
                        items: playlists.items.filter(playlist => 
                            playlist && playlist.owner && playlist.owner.id === userId
                        )
                    };
                    
                    // Find best matching playlist from personal playlists
                    let bestMatch = this.findBestMatchingPlaylist(title, personalPlaylists);
                    
                    if (bestMatch) {
                        itemToPlay = {
                            name: bestMatch.name,
                            uri: bestMatch.uri
                        };
                    } else {
                        // If no personal playlist matches, try searching Spotify for a playlist
                        const searchResult = await this.search(title, artist, "playlist");
                        
                        if (!searchResult.success) {
                            return searchResult; // Return the error from search
                        }
                        
                        itemToPlay = searchResult.playlist;
                        artistsText = `by ${itemToPlay.owner.display_name}`;
                    }
                } catch (userError) {
                    // Fall back to regular playlist search
                    const searchResult = await this.search(title, artist, "playlist");
                    
                    if (!searchResult.success) {
                        return searchResult; // Return the error from search
                    }
                    
                    itemToPlay = searchResult.playlist;
                    artistsText = `by ${itemToPlay.owner.display_name}`;
                }
            }
            
            if (!itemToPlay) {
                return {
                    success: false,
                    error: `Could not find a playlist matching "${title}"`
                };
            }
            
            // Play the found content
            // The context_uri is different from a track URI - for albums and playlists we need to use the context
            if (type === "track") {
                await this.spotifyApi.play({ uris: [itemToPlay.uri] });
            } else {
                await this.spotifyApi.play({ context_uri: itemToPlay.uri });
            }
            
            return {
                success: true,
                message: `Now playing ${type}: "${itemToPlay.name}" ${artistsText}`,
                item_details: itemToPlay
            };
        } catch (error) {
            // Return error message instead of throwing
            return this.reportError(error, "play");
        }
    }

    async pause() {
        try {
            // First, check current playback state
            const playbackState = await this.getPlaybackState();

            // If playbackState has an error, return it
            if (playbackState && playbackState.error) {
                return playbackState;
            }

            // If nothing is playing or no active device, nothing to pause
            if (!playbackState || !playbackState.is_playing) {
                return { success: true, already_paused: true };
            }

            // Only try to pause if something is actually playing
            await this.spotifyApi.pause();
            return { success: true };
        } catch (error) {
            // Return error message instead of throwing
            return this.reportError(error, "pause");
        }
    }

    async nextTrack() {
        try {
            // Ensure we have an active device first
            if (!(await this.ensureActivePlayback())) {
                return {
                    success: false,
                    error: "No Spotify devices available"
                };
            }

            await this.spotifyApi.skipToNext();
            return { success: true };
        } catch (error) {
            // Return error message instead of throwing
            return this.reportError(error, "nextTrack");
        }
    }

    async previousTrack() {
        try {
            // Ensure we have an active device first
            if (!(await this.ensureActivePlayback())) {
                return {
                    success: false,
                    error: "No Spotify devices available"
                };
            }

            await this.spotifyApi.skipToPrevious();
            return { success: true };
        } catch (error) {
            // Return error message instead of throwing
            return this.reportError(error, "previousTrack");
        }
    }

    async setVolume(volumePercent) {
        try {
            // Ensure we have an active device first
            if (!(await this.ensureActivePlayback())) {
                return {
                    success: false,
                    error: "No Spotify devices available"
                };
            }

            await this.spotifyApi.setVolume(volumePercent);
            return { success: true };
        } catch (error) {
            // Return error message instead of throwing
            return this.reportError(error, "setVolume");
        }
    }

    async getDevices() {
        try {
            const response = await this.spotifyApi.getMyDevices();
            return response.body;
        } catch (error) {
            // Return error message instead of throwing
            return this.reportError(error, "getDevices");
        }
    }

    async transferPlayback(deviceId, play = true) {
        try {
            await this.spotifyApi.transferMyPlayback([deviceId], { play });
            return { success: true };
        } catch (error) {
            // Return error message instead of throwing
            return this.reportError(error, "transferPlayback");
        }
    }

    async setShuffle(state) {
        try {
            // Ensure we have an active device first
            if (!(await this.ensureActivePlayback())) {
                return {
                    success: false,
                    error: "No Spotify devices available"
                };
            }

            await this.spotifyApi.setShuffle({ state });
            return { success: true };
        } catch (error) {
            // Return error message instead of throwing
            return this.reportError(error, "setShuffle");
        }
    }

    isAuthorized() {
        return this.authorized;
    }

    static async create() {
        const service = new SpotifyService();
        await service.initialize();
        return service;
    }
}

let spotifyService = null;

async function getSpotifyService() {
    if (!spotifyService) {
        spotifyService = await SpotifyService.create();
    }
    return spotifyService;
}

module.exports = { getSpotifyService };
