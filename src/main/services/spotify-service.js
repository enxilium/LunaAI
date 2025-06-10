const getUserData = require("./credentials-service");
const http = require("http");
const url = require("url");
const { shell } = require("electron");

const userData = getUserData();
const BASE_API = "https://api.spotify.com/v1";

class SpotifyService {
    constructor() {
        this.clientId = process.env.SPOTIFY_CLIENT_ID;
        this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        this.redirectUri =
            process.env.SPOTIFY_REDIRECT_URI ||
            "http://localhost:8888/callback";
        this.scopes = [
            "user-read-private",
            "user-read-email",
            "user-top-read",
            "user-read-playback-state",
            "user-modify-playback-state",
        ];
        this.accessToken = null;
        this.refreshToken = null;
        this.authorized = false;
    }

    // Core authentication and token methods

    async initialize() {
        try {
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

                const expiryTime = parseInt(expiresAt);

                if (Date.now() >= expiryTime) {
                    // Token expired, refresh it
                    console.log("Spotify token expired, refreshing");
                    return await this.refreshAccessToken();
                }

                console.log("Using existing valid Spotify tokens");
                this.authorized = true;
                return true;
            }

            console.log("No valid Spotify tokens found");
            return false;
        } catch (error) {
            console.error("Failed to initialize Spotify:", error);
            return false;
        }
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
                        // Exchange code for tokens - manually handle the token exchange
                        const tokenResponse = await this.exchangeCodeForTokens(
                            code
                        );

                        // Store tokens
                        this.accessToken = tokenResponse.access_token;
                        this.refreshToken = tokenResponse.refresh_token;

                        await userData.setCredentials(
                            "spotify.accessToken",
                            tokenResponse.access_token
                        );
                        await userData.setCredentials(
                            "spotify.refreshToken",
                            tokenResponse.refresh_token
                        );
                        await userData.setCredentials(
                            "spotify.expiresAt",
                            String(Date.now() + tokenResponse.expires_in * 1000)
                        );

                        console.log("Spotify tokens stored successfully");
                        this.authorized = true;

                        server.close();
                        resolve(true);
                    } catch (error) {
                        console.error(
                            "Failed to exchange code for tokens:",
                            error
                        );
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

                    // Generate the authorization URL
                    const authUrl = `https://accounts.spotify.com/authorize?client_id=${
                        this.clientId
                    }&response_type=code&redirect_uri=${encodeURIComponent(
                        this.redirectUri
                    )}&state=${state}&scope=${encodeURIComponent(
                        this.scopes.join(" ")
                    )}&show_dialog=true`;

                    // Open URL in user's default browser
                    console.log(`Opening auth URL in browser: ${authUrl}`);
                    await shell.openExternal(authUrl);
                } catch (error) {
                    server.close();
                    reject(
                        new Error(`Failed to open browser: ${error.message}`)
                    );
                }
            });

            // Handle server errors
            server.on("error", (err) => {
                reject(new Error(`Server error: ${err.message}`));
            });
        });
    }

    async exchangeCodeForTokens(code) {
        const authString = Buffer.from(
            `${this.clientId}:${this.clientSecret}`
        ).toString("base64");
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                Authorization: `Basic ${authString}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: this.redirectUri,
                client_id: this.clientId,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
                `Token request failed: ${
                    errorData.error_description || response.statusText
                }`
            );
        }

        return response.json();
    }

    async refreshAccessToken() {
        try {
            if (!this.refreshToken) {
                console.log(
                    "No refresh token available, authorization required"
                );
                this.authorized = false;
                return false;
            }

            const authString = Buffer.from(
                `${this.clientId}:${this.clientSecret}`
            ).toString("base64");

            const response = await fetch(
                "https://accounts.spotify.com/api/token",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        Authorization: `Basic ${authString}`,
                    },
                    body: new URLSearchParams({
                        grant_type: "refresh_token",
                        refresh_token: this.refreshToken,
                        // Remove client_id from body since it's now in the auth header
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    `Refresh token request failed: ${
                        errorData.error_description || response.statusText
                    }`
                );
            }

            const data = await response.json();

            // Update the access token
            this.accessToken = data.access_token;
            await userData.setCredentials(
                "spotify.accessToken",
                data.access_token
            );
            await userData.setCredentials(
                "spotify.expiresAt",
                String(Date.now() + data.expires_in * 1000)
            );

            // If a new refresh token was provided, update it
            if (data.refresh_token) {
                this.refreshToken = data.refresh_token;
                await userData.setCredentials(
                    "spotify.refreshToken",
                    data.refresh_token
                );
            }

            console.log("Access token refreshed successfully");
            this.authorized = true;

            return true;
        } catch (error) {
            console.error("Failed to refresh access token:", error);
            return false;
        }
    }

    // Helper for making authenticated requests to the Spotify API
    async apiRequest(endpoint, method = "GET", body = null) {
        try {
            // Ensure we have valid tokens
            if (!this.accessToken) {
                const initialized = await this.initialize();
                if (!initialized) {
                    await this.authorize();
                }
            }

            // Build request options
            const options = {
                method,
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                },
            };

            // Add body if provided
            if (body) {
                options.headers["Content-Type"] = "application/json";
                options.body = JSON.stringify(body);
            }

            // Make the request
            const response = await fetch(`${BASE_API}${endpoint}`, options);

            // SUCCESS: No content (common for playback commands)
            if (response.status === 204) {
                return { success: true };
            }

            // SUCCESS: Has content
            if (response.ok) {
                // Only try to parse if there's a response body
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    return await response.json();
                } else {
                    return { success: true };
                }
            }

            // ERROR: Handle error responses
            try {
                const errorData = await response.json();
                throw new Error(
                    `API request failed: ${
                        errorData.error?.message || response.statusText
                    }`
                );
            } catch (jsonError) {
                throw new Error(`API request failed: ${response.statusText}`);
            }
        } catch (error) {
            console.error(`Error making request to ${endpoint}:`, error);
            throw error;
        }
    }

    // API methods that wrap the Spotify REST endpoints

    async getUserProfile() {
        return this.apiRequest("/me");
    }

    async getPlaylists(limit = 50) {
        return this.apiRequest(`/me/playlists?limit=${limit}`);
    }

    async getTopTracks(timeRange = "medium_term", limit = 20) {
        return this.apiRequest(
            `/me/top/tracks?time_range=${timeRange}&limit=${limit}`
        );
    }

    async getTopArtists(timeRange = "medium_term", limit = 20) {
        return this.apiRequest(
            `/me/top/artists?time_range=${timeRange}&limit=${limit}`
        );
    }

    async getCurrentlyPlaying() {
        return this.apiRequest("/me/player/currently-playing");
    }

    async getPlaybackState() {
        return this.apiRequest("/me/player");
    }

    async ensureActivePlayback() {
        try {
            // Check if we already have active playback
            const state = await this.getPlaybackState();

            // If active playback exists, we're good to go
            if (state && state.device) {
                return true;
            }

            // Otherwise, find available devices
            const devices = await this.getDevices();
            if (!devices || !devices.devices || devices.devices.length === 0) {
                console.log("No Spotify devices available");
                return false;
            }

            // Pick the first available device
            const device =
                devices.devices.find((d) => d.is_active) || devices.devices[0];
            console.log(`Activating Spotify device: ${device.name}`);

            // Transfer playback to this device
            await this.transferPlayback(device.id, true);

            // Give Spotify a moment to register the change
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return true;
        } catch (error) {
            console.error("Failed to ensure active playback:", error);
            return false;
        }
    }

    async play(uri = null) {
        // Ensure we have an active device first
        if (!(await this.ensureActivePlayback())) {
            throw new Error("No Spotify devices available");
        }

        // Continue with existing play implementation
        const body = uri ? { uris: [uri] } : undefined;
        return this.apiRequest("/me/player/play", "PUT", body);
    }

    async pause() {
        try {
            // First, check current playback state
            const playbackState = await this.getPlaybackState();

            // If nothing is playing or no active device, nothing to pause
            if (!playbackState || !playbackState.is_playing) {
                console.log("Nothing currently playing to pause");
                return { success: true, already_paused: true };
            }

            // Only try to pause if something is actually playing
            return this.apiRequest("/me/player/pause", "PUT");
        } catch (error) {
            console.error("Failed to pause playback:", error);
            throw error;
        }
    }

    async nextTrack() {
        // Ensure we have an active device first
        if (!(await this.ensureActivePlayback())) {
            throw new Error("No Spotify devices available");
        }

        return this.apiRequest("/me/player/next", "POST");
    }

    async previousTrack() {
        // Ensure we have an active device first
        if (!(await this.ensureActivePlayback())) {
            throw new Error("No Spotify devices available");
        }

        return this.apiRequest("/me/player/previous", "POST");
    }

    async setVolume(volumePercent) {
        // Ensure we have an active device first
        if (!(await this.ensureActivePlayback())) {
            throw new Error("No Spotify devices available");
        }

        return this.apiRequest(
            `/me/player/volume?volume_percent=${volumePercent}`,
            "PUT"
        );
    }

    async getDevices() {
        return this.apiRequest("/me/player/devices");
    }

    async transferPlayback(deviceId, play = true) {
        return this.apiRequest("/me/player", "PUT", {
            device_ids: [deviceId],
            play: play,
        });
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

module.exports = getSpotifyService;
