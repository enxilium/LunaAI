const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const isDev = process.env.NODE_ENV === "development";

class StreamingServerService {
    constructor() {
        this.serverProcess = null;
        this.isRunning = false;
        this.serverPort = 8765;
        this.serverHost = "localhost";

        // Path to the streaming server Python script - deterministic based on environment
        this.serverScriptPath = this.getServerScriptPath();
    }

    /**
     * Get the correct path to the streaming server script
     * Uses the same pattern as other utilities in the app
     */
    getServerScriptPath() {
        if (isDev) {
            // In development: use source file
            return path.join(
                process.cwd(),
                "src",
                "main",
                "services",
                "streaming_server.py"
            );
        } else {
            // In production: use webpack bundled file
            return path.join(__dirname, "streaming_server.py");
        }
    }

    /**
     * Start the Python streaming server
     */
    async startServer() {
        if (this.isRunning) {
            console.log("[StreamingServer] Server is already running");
            return true;
        }

        try {
            console.log(
                `[StreamingServer] Starting Python streaming server...`
            );
            console.log(
                `[StreamingServer] Using script: ${this.serverScriptPath}`
            );
            console.log(
                `[StreamingServer] Environment: ${
                    isDev ? "development" : "production"
                }`
            );

            // Check if the server script exists
            if (!fs.existsSync(this.serverScriptPath)) {
                throw new Error(
                    `Streaming server script not found at: ${this.serverScriptPath}`
                );
            }

            // Spawn the Python process
            this.serverProcess = spawn("python", [this.serverScriptPath], {
                cwd: path.dirname(this.serverScriptPath),
                stdio: ["pipe", "pipe", "pipe"],
                env: {
                    ...process.env,
                    PYTHONPATH: path.dirname(this.serverScriptPath),
                },
            });

            // Set up event handlers
            this.setupEventHandlers();

            // Wait for server to start up
            await this.waitForServerReady();

            this.isRunning = true;
            console.log(
                `[StreamingServer] Server started successfully on ${this.serverHost}:${this.serverPort}`
            );
            return true;
        } catch (error) {
            console.error("[StreamingServer] Failed to start server:", error);
            this.cleanup();
            return false;
        }
    }

    /**
     * Stop the Python streaming server
     */
    stopServer() {
        if (!this.isRunning || !this.serverProcess) {
            console.log("[StreamingServer] Server is not running");
            return;
        }

        console.log("[StreamingServer] Stopping Python streaming server...");

        try {
            // Gracefully terminate the process
            this.serverProcess.kill("SIGTERM");

            // If it doesn't stop gracefully, force kill after timeout
            setTimeout(() => {
                if (this.serverProcess && !this.serverProcess.killed) {
                    console.log(
                        "[StreamingServer] Force killing server process"
                    );
                    this.serverProcess.kill("SIGKILL");
                }
            }, 5000);
        } catch (error) {
            console.error("[StreamingServer] Error stopping server:", error);
        }
    }

    /**
     * Set up event handlers for the server process
     */
    setupEventHandlers() {
        if (!this.serverProcess) return;

        this.serverProcess.stdout.on("data", (data) => {
            const output = data.toString().trim();
            if (output) {
                console.log("[StreamingServer]", output);
            }
        });

        this.serverProcess.stderr.on("data", (data) => {
            const error = data.toString().trim();
            if (error) {
                console.error("[StreamingServer Error]", error);
            }
        });

        this.serverProcess.on("close", (code) => {
            console.log(`[StreamingServer] Process exited with code ${code}`);
            this.cleanup();
        });

        this.serverProcess.on("error", (error) => {
            console.error("[StreamingServer] Process error:", error);
            this.cleanup();
        });
    }

    /**
     * Wait for the server to be ready to accept connections
     */
    async waitForServerReady(timeout = 30000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkServer = async () => {
                if (Date.now() - startTime > timeout) {
                    reject(new Error("Server startup timeout"));
                    return;
                }

                try {
                    // Try to make a health check request
                    const response = await fetch(
                        `http://${this.serverHost}:${this.serverPort}/health`
                    );
                    if (response.ok) {
                        resolve();
                        return;
                    }
                } catch {
                    // Server not ready yet, continue waiting
                }

                // Check again after a short delay
                setTimeout(checkServer, 1000);
            };

            checkServer();
        });
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.isRunning = false;
        this.serverProcess = null;
    }

    /**
     * Check if the server is running
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            port: this.serverPort,
            host: this.serverHost,
            serverUrl: `ws://${this.serverHost}:${this.serverPort}`,
        };
    }

    /**
     * Get the server URL for WebSocket connections
     */
    getWebSocketURL() {
        return `ws://${this.serverHost}:${this.serverPort}`;
    }
}

module.exports = { StreamingServerService };
