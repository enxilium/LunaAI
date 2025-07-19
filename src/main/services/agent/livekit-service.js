const { AccessToken } = require("livekit-server-sdk");

/**
 * @class LiveKitService
 * @description LiveKit Service for Luna AI
 * Manages room creation and token generation
 */
class LiveKitService {
    /**
     * @description Creates an instance of LiveKitService.
     */
    constructor() {
        this.apiKey = null;
        this.apiSecret = null;
        this.serverUrl = null;
        // Warm token optimization
        this.warmToken = null;
        this.warmTokenExpiry = null;
    }

    /**
     * @description Initialize the LiveKit service with credentials.
     * @returns {Promise<boolean>} True if initialization was successful, false otherwise.
     */
    async initialize() {
        // Get LiveKit credentials from environment or config
        this.apiKey = process.env.LIVEKIT_API_KEY;
        this.apiSecret = process.env.LIVEKIT_API_SECRET;
        this.serverUrl = process.env.LIVEKIT_URL;

        if (!this.apiKey || !this.apiSecret) {
            throw new Error("LiveKit API credentials not configured");
        }

        return true;
    }

    /**
     * @description Creates a long-lived token for pre-warming the connection.
     * @returns {Promise<string>} The generated JWT token.
     */
    async generateToken() {
        const roomName = `warmup-${Date.now()}`;
        const participantName = `warmup-participant-${Date.now()}`;
        const token = new AccessToken(this.apiKey, this.apiSecret, {
            identity: participantName,
            // Give it a long TTL, e.g., 1 hour.
            ttl: 60 * 60,
        });

        this.warmTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour from now

        token.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
        });

        const jwtToken = await token.toJwt();
        this.warmToken = jwtToken;
        return jwtToken;
    }
}

let liveKitService = null;

/**
 * @description Get the singleton LiveKit service instance.
 * @returns {Promise<LiveKitService>} The LiveKit service instance.
 */
async function getLiveKitService() {
    if (!liveKitService) {
        liveKitService = new LiveKitService();
        await liveKitService.initialize();
    }
    return liveKitService;
}

async function getLiveKitToken() {
    const livekitService = await getLiveKitService();
    return livekitService.warmToken
        ? livekitService.warmToken
        : await livekitService.generateToken();
}

async function getLiveKitServerUrl() {
    const livekitService = await getLiveKitService();
    return livekitService.serverUrl;
}

module.exports = { getLiveKitService, getLiveKitToken, getLiveKitServerUrl };
