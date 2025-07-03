const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
    StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const { McpToolMapper } = require("../src/main/services/agent/mcp-tool-mapper");
const fs = require("fs");
const path = require("path");

// Read Gemini config
const configPath = path.join(
    __dirname,
    "..",
    "assets",
    "config",
    "gemini-config.json"
);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

async function debugNotionHandlers() {
    console.log("=== Debugging Notion Handler Names ===");

    const notionConfig = config.mcpServers.find(
        (server) => server.name === "notionMCP"
    );
    const mcpToolMapper = new McpToolMapper();

    let client = null;

    try {
        const transport = new StdioClientTransport(notionConfig.transport);
        client = new Client({ name: "notion-handler-debug", version: "1.0.0" });
        await client.connect(transport);

        // Get actual tools
        const toolsResponse = await client.listTools();
        console.log("\nActual MCP tool names:");
        toolsResponse.tools.forEach((tool, i) => {
            console.log(`${i + 1}. ${tool.name}`);
        });

        // Register tools with MCP Tool Mapper
        await mcpToolMapper.registerMcpTools(
            client,
            "notionMCP",
            toolsResponse.tools
        );

        // Check what handler names were generated
        const debugInfo = mcpToolMapper.getDebugInfo();
        console.log("\nGenerated handler names:");
        debugInfo.handlers.forEach((handler, i) => {
            const mapping = debugInfo.mappings.find(
                (m) => m.handler === handler
            );
            console.log(
                `${i + 1}. ${handler} -> ${mapping?.originalTool || "unknown"}`
            );
        });

        // Test creating a new page
        const createPageHandler = debugInfo.handlers.find(
            (h) =>
                h.toLowerCase().includes("postpage") ||
                h.toLowerCase().includes("createpage")
        );
        if (createPageHandler) {
            console.log(
                `\nTesting page creation with handler: ${createPageHandler}`
            );
            try {
                const result = await mcpToolMapper.executeHandler(
                    createPageHandler,
                    {
                        parent: {
                            page_id: "31407325-f0f8-4a80-9d3f-7e017da945c3",
                        },
                        properties: {
                            title: [
                                {
                                    text: {
                                        content: "Test Trip from Luna",
                                    },
                                    type: "text",
                                },
                            ],
                            type: "title",
                        },
                    }
                );
                console.log("Page creation result:", result);
            } catch (error) {
                console.error("Page creation error:", error.message);
            }
        } else {
            console.log("\nNo page creation handler found");
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        if (client) await client.close();
    }
}

debugNotionHandlers().catch(console.error);
