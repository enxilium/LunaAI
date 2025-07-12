const { AccessToken } = require("livekit-server-sdk");
const { app } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { getPythonPath } = require("./../../utils/get-paths");
const { getErrorService } = require("../error-service");

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
        // Python agent process management
        this.pythonProcess = null;
        this.isAgentRunning = false;
        this.pythonPath = null;
        // Warm token optimization
        this.warmToken = null;
        this.warmTokenExpiry = null;
    }

    /**
     * @description Initialize the LiveKit service with credentials and set up IPC handlers.
     * @returns {Promise<boolean>} True if initialization was successful, false otherwise.
     */
    async initialize() {
        // Get LiveKit credentials from environment or config
        this.apiKey = process.env.LIVEKIT_API_KEY;
        this.apiSecret = process.env.LIVEKIT_API_SECRET;
        this.serverUrl = process.env.LIVEKIT_URL;

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

        return true;
    }

    /**
     * @description Initialize Python environment for development mode.
     * @returns {Promise<void>}
     */
    async initializePythonEnvironment() {
        this.pythonPath = getPythonPath();

        if (!this.pythonPath) {
            this.reportError("No suitable Python path found.");
        }
    }

    /**
     * @description Creates a long-lived token for pre-warming the connection.
     * @returns {Promise<string>} The generated JWT token.
     */
    async generateToken() {
        try {
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
        } catch (error) {
            this.reportError(`Error generating token: ${error.message}`);
            throw error;
        }
    }

    /**
     * @description Start the LiveKit agent worker process (runs once at startup).
     * The worker will automatically dispatch agents to rooms as needed.
     * @returns {Promise<boolean>} True if the agent was started successfully, false otherwise.
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
                const error = new Error(
                    `Agent script not found: ${agentScript}`
                );
                this.reportError(error.message);
                throw error;
            }

            // Validate environment variables
            if (
                !this.apiKey ||
                !this.apiSecret ||
                !process.env.GEMINI_API_KEY
            ) {
                const error = new Error(
                    "Missing required environment variables (LIVEKIT_API_KEY, LIVEKIT_API_SECRET, GEMINI_API_KEY)"
                );
                this.reportError(error.message);
                throw error;
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
            this.reportError(`Failed to start agent worker: ${error.message}`);
            return false;
        }
    }

    /**
     * @description Set up process event handlers for the Python agent.
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
                this.reportError(`Agent worker exited with error code ${code}`);
            }
            this.isAgentRunning = false;
            this.pythonProcess = null;
        });

        this.pythonProcess.on("error", (error) => {
            const timestamp = new Date().toISOString();
            logStream.write(`[${timestamp}] PROCESS ERROR: ${error.message}\n`);
            logStream.uncork(); // Force immediate write

            // Only log process startup errors to console (not Luna Agent runtime errors)
            this.reportError(`Agent worker process error: ${error.message}`);
            this.isAgentRunning = false;
        });
    }

    /**
     * @description Stop the LiveKit agent worker.
     * @returns {Promise<{success: boolean, message: string}>} Result of the stop operation.
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
     * @description Get room information for the Python agent.
     * @returns {Object} Room connection details.
     */
    getRoomInfo() {
        // The Python agent will use the same room that was created for the user
        return {
            serverUrl: this.serverUrl,
            apiKey: this.apiKey,
            apiSecret: this.apiSecret,
        };
    }

    /**
     * @description Report an error to the error service.
     * @param {string|Error} error - Error object or message to report.
     */
    reportError(error) {
        const errorService = getErrorService();
        const errorMessage = error instanceof Error ? error.message : error;
        errorService.reportError(errorMessage, "LiveKitService");
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

module.exports = { getLiveKitService };
