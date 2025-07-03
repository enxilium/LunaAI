const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { getMcpServers } = require("../../invokes/get-asset");

let mcpService = null;

class McpService {
    constructor() {
        this.clients = [];
        this.serverConfigs = [];
    }

    async initialize() {
        this.serverConfigs = await getMcpServers();
        if (!this.serverConfigs) {
            console.error("MCP Service: Could not load server configurations.");
            return;
        }
    }

    async getAllClients() {
        if (this.clients.length > 0) {
            return this.clients;
        }

        const clientPromises = this.serverConfigs.map(async (config) => {

            try {
                const transport = new StdioClientTransport(config.transport);
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
}

async function getMcpService() {
    if (!mcpService) {
        mcpService = new McpService();
        await mcpService.initialize();
    }
    return mcpService;
}

module.exports = { getMcpService };
