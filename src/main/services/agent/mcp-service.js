const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
    StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const { getMcpServers } = require("../../invokes/get-asset");
const fs = require("fs");
const path = require("path");

let mcpService = null;

class McpService {
    constructor() {
        this.clients = [];
        this.serverConfigs = [];
    }

    async initialize() {
        this.serverConfigs = await getMcpServers();
        if (!this.serverConfigs) {
            const { getErrorService } = require("../error-service");
            getErrorService().reportError(
                "Could not load server configurations",
                "MCP Service"
            );
            return;
        }
    }

    /**
     * Configure logging for MCP server
     */
    configureLogging(config) {
        const transportConfig = { ...config.transport };

        if (config.logFile) {
            console.log(`[MCP Service] Configuring logging for ${config.name}`);

            // Ensure log directory exists
            const logDir = path.dirname(config.logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            // Write server start timestamp to log
            const timestamp = new Date().toISOString();
            fs.appendFileSync(
                config.logFile,
                `\n=== ${config.name} MCP Server Started ${timestamp} ===\n`
            );

            // Environment variables for the server process
            if (!transportConfig.env) {
                transportConfig.env = { ...process.env };
            }

            // Add logging environment variables
            transportConfig.env.MCP_LOG_FILE = config.logFile;
            transportConfig.env.NODE_ENV = "production";
            transportConfig.env.SILENT = "true";
            transportConfig.env.DEBUG = "";

            // Suppress server process output by redirecting to our log file
            transportConfig.stdio = ["pipe", "ignore", "ignore"];
        }

        return transportConfig;
    }

    async getAllClients() {
        if (this.clients.length > 0) {
            return this.clients;
        }

        const clientPromises = this.serverConfigs.map(async (config) => {
            try {
                // Configure logging for the transport
                const transportConfig = this.configureLogging(config);

                const transport = new StdioClientTransport(transportConfig);
                const client = new Client({
                    name: `luna-mcp-client-for-${config.name}`,
                    version: "1.0.0",
                });
                await client.connect(transport);
                console.log(`[MCP Service] Connected to ${config.name}`);
                return client;
            } catch (e) {
                const { getErrorService } = require("../error-service");
                getErrorService().reportError(
                    `Failed to connect to ${config.name} server: ${e.message}`,
                    "MCP Service"
                );
                return null;
            }
        });

        const clients = await Promise.all(clientPromises);
        this.clients = clients.filter((c) => c !== null); // Filter out failed connections
        return this.clients;
    }

    getServerConfigs() {
        return this.serverConfigs;
    }
}

async function getMcpService() {
    if (!mcpService) {
        mcpService = new McpService();
        await mcpService.initialize();
    }
    return mcpService;
}

module.exports = { getMcpService };
