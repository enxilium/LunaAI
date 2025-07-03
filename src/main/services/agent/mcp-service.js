const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
    StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const { getMcpServers } = require("../../invokes/get-asset");

let mcpService = null;

class McpService {
    constructor() {
        this.clients = [];
        this.serverConfigs = [];
        this.connectionHealth = new Map(); // Track connection health
    }

    async initialize() {
        this.serverConfigs = await getMcpServers();
        if (!this.serverConfigs) {
            console.error("MCP Service: Could not load server configurations.");
            return;
        }
    }

    /**
     * Check if a client connection is healthy
     */
    async isClientHealthy(client, serverName) {
        try {
            // Try a simple operation with short timeout
            await Promise.race([
                client.listTools(),
                new Promise((_, reject) =>
                    setTimeout(
                        () => reject(new Error("Health check timeout")),
                        5000
                    )
                ),
            ]);

            this.connectionHealth.set(serverName, {
                healthy: true,
                lastCheck: Date.now(),
            });
            return true;
        } catch (error) {
            console.warn(
                `MCP Service: Health check failed for ${serverName}:`,
                error.message
            );
            this.connectionHealth.set(serverName, {
                healthy: false,
                lastCheck: Date.now(),
                error: error.message,
            });
            return false;
        }
    }

    /**
     * Reconnect a specific client
     */
    async reconnectClient(index) {
        const config = this.serverConfigs[index];
        console.log(
            `MCP Service: Attempting to reconnect to ${config.name}...`
        );

        try {
            // Add logging configuration if specified
            const transportConfig = { ...config.transport };
            if (config.logFile) {
                console.log(
                    `MCP Service: Configuring logging for ${config.name} reconnect to ${config.logFile}`
                );
                if (!transportConfig.env) {
                    transportConfig.env = {};
                }
                transportConfig.env.MCP_LOG_FILE = config.logFile;
            }

            const transport = new StdioClientTransport(transportConfig);
            const client = new Client({
                name: `luna-mcp-client-for-${config.name}`,
                version: "1.0.0",
            });
            await client.connect(transport);

            this.clients[index] = client;
            console.log(
                `MCP Service: Successfully reconnected to ${config.name}`
            );
            return client;
        } catch (error) {
            console.error(
                `MCP Service: Failed to reconnect to ${config.name}:`,
                error
            );
            return null;
        }
    }

    async getAllClients() {
        if (this.clients.length > 0) {
            return this.clients;
        }

        const clientPromises = this.serverConfigs.map(async (config) => {
            try {
                // Add logging configuration if specified
                const transportConfig = { ...config.transport };
                if (config.logFile) {
                    console.log(
                        `MCP Service: Configuring logging for ${config.name} to ${config.logFile}`
                    );
                    // Set up logging environment variable if needed
                    if (!transportConfig.env) {
                        transportConfig.env = {};
                    }
                    transportConfig.env.MCP_LOG_FILE = config.logFile;
                }

                const transport = new StdioClientTransport(transportConfig);
                const client = new Client({
                    name: `luna-mcp-client-for-${config.name}`,
                    version: "1.0.0",
                });
                await client.connect(transport);
                console.log(`MCP Service: Connected to ${config.name} server.`);
                return client;
            } catch (e) {
                console.error(
                    `MCP Service: Failed to connect to ${config.name} server`,
                    e
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
