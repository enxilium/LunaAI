const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
    StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const path = require("path");
const fs = require("fs");

async function testNotionMcp() {
    try {
        const configPath = path.join(
            process.cwd(),
            "assets/config/gemini-config.json"
        );
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

        const notionMcpConfig = config.mcpServers.find(
            (server) => server.name === "notionMCP"
        );

        if (!notionMcpConfig) {
            console.error(
                "Notion MCP configuration not found in gemini-config.json"
            );
            return;
        }

        console.log("Found Notion MCP config:", notionMcpConfig);

        const transport = new StdioClientTransport(notionMcpConfig.transport);
        const client = new Client({
            name: `notion-mcp-test-client`,
            version: "1.0.0",
        });

        console.log("Connecting to Notion MCP...");
        await client.connect(transport);
        console.log("Connected to Notion MCP.");

        // We will add the logic to get the tools here in the next step.
        console.log("Client object:", client);
    } catch (e) {
        console.error("An error occurred during the test:", e);
    }
}

testNotionMcp();
