const { AccessToken } = require("livekit-server-sdk");
const { ipcMain, app } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

/**
 * LiveKit Service for Luna AI
 * Manages room creation and token generation
 */
class LiveKitService {
    constructor() {
        this.apiKey = null;
        this.apiSecret = null;
        this.serverUrl = null;
        // Python agent process management
        this.pythonProcess = null;
        this.isAgentRunning = false;
        this.pythonPath = null;
        // Warm token optimization
        this.warmToken = null;
        this.warmTokenExpiry = null;
    }

    async initialize() {
        // Get LiveKit credentials from environment or config
        this.apiKey = process.env.LIVEKIT_API_KEY;
        this.apiSecret = process.env.LIVEKIT_API_SECRET;
        this.serverUrl = process.env.LIVEKIT_URL || "ws://localhost:7880";

        if (!this.apiKey || !this.apiSecret) {
            console.warn("[LiveKit] API credentials not configured");
            return false;
        }

        // Initialize Python environment for development mode
        if (!app.isPackaged) {
            await this.initializePythonEnvironment();
            // Start the agent worker once at startup - it will auto-dispatch to rooms
            await this.startAgentWorker();
        }

        // Set up IPC handlers
        ipcMain.handle("livekit:get-token", async () => {
            try {
                const result = await this.generateToken();
                return result;
            } catch (error) {
                console.error("[LiveKit] Token generation error:", error);
                throw error;
            }
        });

        ipcMain.handle("livekit:start-session", async () => {
            try {
                const result = await this.startSession();
                return result;
            } catch (error) {
                console.error("[LiveKit] Session start error:", error);
                throw error;
            }
        });

        ipcMain.handle("livekit:stop-agent", async () => {
            try {
                return await this.stopAgent();
            } catch (error) {
                console.error("[LiveKit] Agent stop error:", error);
                throw error;
            }
        });

        // Generate warm token for faster connections
        if (!app.isPackaged) {
            this.generateWarmToken();
        }

        return true;
    }

    /**
     * Initialize Python environment for development mode
     */
    async initializePythonEnvironment() {
        const backendPath = process.cwd();

        // Look for virtual environment Python
        const venvPython =
            process.platform === "win32"
                ? path.join(backendPath, ".venv", "Scripts", "python.exe")
                : path.join(backendPath, ".venv", "bin", "python");

        const altVenvPython =
            process.platform === "win32"
                ? path.join(backendPath, "venv", "Scripts", "python.exe")
                : path.join(backendPath, "venv", "bin", "python");

        if (fs.existsSync(venvPython)) {
            this.pythonPath = venvPython;
        } else if (fs.existsSync(altVenvPython)) {
            this.pythonPath = altVenvPython;
        } else {
            // Try to find system Python
            this.pythonPath = this.findBestPython();
            if (!this.pythonPath) {
                console.error("[LiveKit] No suitable Python found!");
                console.error(
                    "[LiveKit] Please create a virtual environment with: python -m venv .venv"
                );
                throw new Error("No suitable Python environment found");
            }
        }
    }

    /**
     * Find the best available Python installation
     */
    findBestPython() {
        const candidates =
            process.platform === "win32"
                ? ["python", "python3", "py"]
                : ["python3", "python"];

        for (const candidate of candidates) {
            try {
                const result = require("child_process").execSync(
                    `${candidate} --version`,
                    { encoding: "utf8", stdio: "pipe" }
                );
                if (result.includes("Python 3.")) {
                    return candidate;
                }
            } catch (error) {
                // Continue to next candidate
            }
        }
        return null;
    }

    /**
     * Generate a warm token for faster connections
     */
    async generateWarmToken() {
        if (!this.apiKey || !this.apiSecret) {
            return;
        }

        try {
            const roomName = `luna-warm-${Date.now()}`;
            const participantName = "user";

            const token = new AccessToken(this.apiKey, this.apiSecret, {
                identity: participantName,
                ttl: "10m", // 10 minutes - enough time for quick access
            });

            token.addGrant({
                room: roomName,
                roomJoin: true,
                canPublish: true,
                canSubscribe: true,
            });

            this.warmToken = {
                token: await token.toJwt(),
                roomName: roomName,
                url: this.serverUrl,
            };
            this.warmTokenExpiry = Date.now() + 9 * 60 * 1000; // 9 minutes from now
        } catch (error) {
            console.warn("[LiveKit] Failed to generate warm token:", error);
        }
    }

    /**
     * Get or refresh warm token
     */
    getWarmToken() {
        // Check if warm token is still valid (with 1 minute buffer)
        if (
            this.warmToken &&
            this.warmTokenExpiry &&
            Date.now() < this.warmTokenExpiry - 60000
        ) {
            return this.warmToken;
        }

        // Token expired or doesn't exist, return null to generate new one
        return null;
    }

    /**
     * Start a new session - agent worker is already running and will auto-dispatch
     */
    async startSession() {
        try {
            // Try to use warm token first
            let tokenInfo = this.getWarmToken();

            if (!tokenInfo) {
                // Generate new token
                const roomName = `luna-chat-${Date.now()}`;
                tokenInfo = await this.generateTokenForRoom(roomName);
            }

            if (app.isPackaged) {
                // Production: Agents auto-dispatch when user joins room (cloud-hosted)
                return {
                    ...tokenInfo,
                    agentStarted: true,
                    agentType: "cloud",
                };
            } else {
                // Development: Agent worker is already running and will auto-dispatch
                return {
                    ...tokenInfo,
                    agentStarted: true,
                    agentType: "local_worker",
                };
            }
        } catch (error) {
            console.error("[LiveKit] Failed to start session:", error);
            throw error;
        }
    }

    /**
     * Generate token for a specific room
     */
    async generateTokenForRoom(roomName) {
        if (!this.apiKey || !this.apiSecret) {
            throw new Error("LiveKit credentials not configured");
        }

        try {
            const participantName = "user";

            const token = new AccessToken(this.apiKey, this.apiSecret, {
                identity: participantName,
                ttl: "1h",
            });

            token.addGrant({
                room: roomName,
                roomJoin: true,
                canPublish: true,
                canSubscribe: true,
            });

            const jwtToken = await token.toJwt();
            return {
                url: String(this.serverUrl),
                token: String(jwtToken),
                roomName: String(roomName),
            };
        } catch (error) {
            console.error("[LiveKit] Error generating token for room:", error);
            throw new Error(`Failed to generate token: ${error.message}`);
        }
    }

    /**
     * Start the LiveKit agent worker process (runs once at startup)
     * The worker will automatically dispatch agents to rooms as needed
     */
    async startAgentWorker() {
        if (this.isAgentRunning) {
            console.log("[LiveKit] Agent worker already running");
            return true;
        }

        try {
            console.log("[LiveKit] Starting LiveKit agent worker...");

            // Determine agent script path
            const agentScript = path.join(
                process.cwd(),
                "src",
                "main",
                "services",
                "agent",
                "agent.py"
            );

            // Verify the file exists
            if (!fs.existsSync(agentScript)) {
                console.error(
                    `[LiveKit] Agent script not found: ${agentScript}`
                );
                throw new Error(`Agent script not found: ${agentScript}`);
            }

            // Validate environment variables
            if (
                !this.apiKey ||
                !this.apiSecret ||
                !process.env.GEMINI_API_KEY
            ) {
                throw new Error(
                    "Missing required environment variables (LIVEKIT_API_KEY, LIVEKIT_API_SECRET, GEMINI_API_KEY)"
                );
            }

            // Set up environment variables for the agent worker
            const env = {
                ...process.env,
                LIVEKIT_URL: this.serverUrl,
                LIVEKIT_API_KEY: this.apiKey,
                LIVEKIT_API_SECRET: this.apiSecret,
                GOOGLE_API_KEY: process.env.GEMINI_API_KEY,
                PYTHONPATH: path.join(
                    process.cwd(),
                    "src",
                    "main",
                    "services",
                    "agent"
                ),
            };

            // Start the Python agent worker process
            this.pythonProcess = spawn(this.pythonPath, [agentScript, "dev"], {
                cwd: path.join(
                    process.cwd(),
                    "src",
                    "main",
                    "services",
                    "agent"
                ),
                env: env,
                stdio: ["pipe", "pipe", "pipe"],
            });

            this.setupAgentProcessHandlers();
            this.isAgentRunning = true;

            // Wait a moment for the agent worker to fully register with LiveKit server
            await new Promise((resolve) => setTimeout(resolve, 2000));

            console.log(
                "[LiveKit] Agent worker started and registered - ready for auto-dispatch"
            );
            return true;
        } catch (error) {
            console.error("[LiveKit] Failed to start agent worker:", error);
            return false;
        }
    }

    /**
     * Set up process event handlers for the Python agent
     */
    setupAgentProcessHandlers() {
        if (!this.pythonProcess) return;

        // Set up log file for Luna Agent output
        const logDir = path.join(process.cwd(), "assets", "logs");
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const logFile = path.join(logDir, "luna-agent.log");

        // Clear the log file at the start of each run
        if (fs.existsSync(logFile)) {
            fs.truncateSync(logFile, 0);
        }

        const logStream = fs.createWriteStream(logFile, {
            flags: "w", // Write mode (creates new file)
            autoClose: true,
            highWaterMark: 0, // Disable buffering for immediate writes
        });

        // Add timestamp header to log file
        const timestamp = new Date().toISOString();
        logStream.write(`=== Luna Agent Session Started: ${timestamp} ===\n`);
        logStream.uncork(); // Force immediate write

        this.pythonProcess.stdout.on("data", (data) => {
            const message = data.toString().trim();
            const timestampedMessage = `[${new Date().toISOString()}] ${message}`;

            // Write all output to log file with immediate flush
            logStream.write(timestampedMessage + "\n");
            logStream.uncork(); // Force immediate write to disk
        });

        this.pythonProcess.stderr.on("data", (data) => {
            const message = data.toString().trim();

            // Python logging often goes to stderr - don't label as ERROR unless it actually is
            let logLevel = "LOG";
            if (
                message.includes("ERROR") ||
                message.includes("CRITICAL") ||
                message.includes("Exception")
            ) {
                logLevel = "ERROR";
            } else if (
                message.includes("WARNING") ||
                message.includes("WARN")
            ) {
                logLevel = "WARN";
            } else if (message.includes("DEBUG")) {
                logLevel = "DEBUG";
            } else if (message.includes("INFO")) {
                logLevel = "INFO";
            }

            const timestampedMessage = `[${new Date().toISOString()}] ${logLevel}: ${message}`;

            // Write all stderr to log file with immediate flush
            logStream.write(timestampedMessage + "\n");
            logStream.uncork(); // Force immediate write to disk
        });

        this.pythonProcess.on("close", (code) => {
            const timestamp = new Date().toISOString();
            logStream.write(
                `\n=== Luna Agent Session Ended: ${timestamp} (Exit Code: ${code}) ===\n`
            );
            logStream.uncork(); // Force immediate write
            logStream.end();

            if (code === 0) {
                console.log(`[LiveKit] Agent worker exited normally`);
            } else {
                console.error(
                    `[LiveKit] Agent worker exited with error code ${code}`
                );
            }
            this.isAgentRunning = false;
            this.pythonProcess = null;
        });

        this.pythonProcess.on("error", (error) => {
            const timestamp = new Date().toISOString();
            logStream.write(`[${timestamp}] PROCESS ERROR: ${error.message}\n`);
            logStream.uncork(); // Force immediate write

            // Only log process startup errors to console (not Luna Agent runtime errors)
            console.error(
                "[LiveKit] Agent worker process error:",
                error.message
            );
            this.isAgentRunning = false;
        });
    }

    /**
     * Stop the LiveKit agent worker
     */
    async stopAgent() {
        if (!this.isAgentRunning || !this.pythonProcess) {
            return { success: true, message: "Agent worker not running" };
        }

        return new Promise((resolve) => {
            this.pythonProcess.once("close", () => {
                this.isAgentRunning = false;
                this.pythonProcess = null;
                resolve({
                    success: true,
                    message: "Agent worker stopped successfully",
                });
            });

            // Graceful shutdown
            this.pythonProcess.kill("SIGTERM");

            // Force kill after 5 seconds
            setTimeout(() => {
                if (this.pythonProcess) {
                    this.pythonProcess.kill("SIGKILL");
                    this.isAgentRunning = false;
                    this.pythonProcess = null;
                    resolve({
                        success: true,
                        message: "Agent worker forcefully stopped",
                    });
                }
            }, 5000);
        });
    }

    /**
     * Generate a token for the user to join a LiveKit room
     */
    async generateToken() {
        if (!this.apiKey || !this.apiSecret) {
            throw new Error("LiveKit credentials not configured");
        }

        try {
            // Create a unique room name for this session
            const roomName = `luna-chat-${Date.now()}`;
            const participantName = "user";

            const token = new AccessToken(this.apiKey, this.apiSecret, {
                identity: participantName,
                ttl: "1h", // Token valid for 1 hour
            });

            // Grant permissions for the user
            token.addGrant({
                room: roomName,
                roomJoin: true,
                canPublish: true,
                canSubscribe: true,
            });

            // Convert to JWT and return only plain object
            const jwtToken = await token.toJwt();

            // Return only serializable data - no complex objects
            const result = {
                url: String(this.serverUrl),
                token: String(jwtToken),
                roomName: String(roomName),
            };

            return result;
        } catch (error) {
            console.error("[LiveKit] Error generating token:", error);
            throw new Error(`Failed to generate token: ${error.message}`);
        }
    }

    /**
     * Get room information for the Python agent
     */
    getRoomInfo() {
        // The Python agent will use the same room that was created for the user
        return {
            serverUrl: this.serverUrl,
            apiKey: this.apiKey,
            apiSecret: this.apiSecret,
        };
    }
}

let liveKitService = null;

async function getLiveKitService() {
    if (!liveKitService) {
        liveKitService = new LiveKitService();
        await liveKitService.initialize();
    }
    return liveKitService;
}

module.exports = { getLiveKitService };
