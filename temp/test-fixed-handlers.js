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

async function testFixedHandlerNames() {
    console.log("=== Testing Fixed Handler Names ===");

    const notionConfig = config.mcpServers.find(
        (server) => server.name === "notionMCP"
    );
    const mcpToolMapper = new McpToolMapper();

    let client = null;

    try {
        const transport = new StdioClientTransport(notionConfig.transport);
        client = new Client({ name: "handler-name-test", version: "1.0.0" });
        await client.connect(transport);

        // Get actual tools
        const toolsResponse = await client.listTools();
        console.log("\nOriginal MCP tool names:");
        toolsResponse.tools.forEach((tool, i) => {
            console.log(`${i + 1}. ${tool.name}`);
        });

        // Register tools with fixed MCP Tool Mapper
        await mcpToolMapper.registerMcpTools(
            client,
            "notionMCP",
            toolsResponse.tools
        );

        // Check what handler names were generated
        const debugInfo = mcpToolMapper.getDebugInfo();
        console.log("\nGenerated handler names (FIXED):");
        debugInfo.mappings.forEach((mapping, i) => {
            console.log(
                `${i + 1}. ${mapping.handler} -> ${mapping.originalTool}`
            );
        });

        // Test the page creation handler specifically
        const pageCreationHandler = debugInfo.handlers.find((h) =>
            h.toLowerCase().includes("postpage")
        );

        if (pageCreationHandler) {
            console.log(
                `\n🎯 Found page creation handler: ${pageCreationHandler}`
            );
            console.log(
                "This should match what Luna expects in all-tools.json"
            );

            // Test it by creating a trip
            console.log("\n🧪 Testing trip creation...");
            try {
                const result = await mcpToolMapper.executeHandler(
                    pageCreationHandler,
                    {
                        parent: {
                            database_id: "31407325-f0f8-4a80-9d3f-7e017da945c3",
                        },
                        properties: {
                            Name: {
                                title: [
                                    {
                                        text: {
                                            content: "Fixed Handler Test Trip",
                                        },
                                    },
                                ],
                            },
                            Details: {
                                rich_text: [
                                    {
                                        text: {
                                            content:
                                                "Created via fixed MCP Tool Mapper handler",
                                        },
                                    },
                                ],
                            },
                        },
                    }
                );

                console.log("✅ Trip creation successful via fixed handler!");
                console.log(
                    "Result preview:",
                    result.substring(0, 200) + "..."
                );
            } catch (error) {
                console.error("❌ Trip creation failed:", error.message);
            }
        } else {
            console.log(
                '\n❌ No page creation handler found with "postpage" in name'
            );
            console.log("Available handlers:", debugInfo.handlers);
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        if (client) await client.close();
    }
}

testFixedHandlerNames().catch(console.error);
