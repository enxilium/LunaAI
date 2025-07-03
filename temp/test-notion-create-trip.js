const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
    StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");

async function testNotionTripCreation() {
    console.log("🔄 Testing Notion trip creation...\n");

    const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@notionhq/notion-mcp-server"],
        env: {
            ...process.env,
            OPENAPI_MCP_HEADERS: JSON.stringify({
                Authorization:
                    "Bearer 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",
                "Notion-Version": "2022-06-28",
            }),
        },
    });

    const client = new Client(
        {
            name: "test-client",
            version: "1.0.0",
        },
        {
            capabilities: {},
        }
    );

    try {
        await client.connect(transport);
        console.log("✅ Connected to Notion MCP server");

        // List all available tools
        const toolsResponse = await client.listTools();
        console.log(`\n📋 Available tools (${toolsResponse.tools.length}):`);
        toolsResponse.tools.forEach((tool) => {
            console.log(`  - ${tool.name}: ${tool.description}`);
        });

        // Find the correct tool for creating pages
        const createPageTool = toolsResponse.tools.find(
            (t) => t.name === "API-post-page"
        );
        if (!createPageTool) {
            console.log("\n❌ API-post-page tool not found");
            return;
        }

        console.log(`\n📝 Tool definition for ${createPageTool.name}:`);
        console.log(JSON.stringify(createPageTool.inputSchema, null, 2));

        // Test creating a new trip entry with correct structure
        console.log("\n🚀 Testing trip creation...");
        try {
            const createResponse = await client.callTool({
                name: createPageTool.name,
                arguments: {
                    parent: {
                        database_id: "31407325-f0f8-4a80-9d3f-7e017da945c3",
                    },
                    properties: {
                        Name: {
                            title: [
                                {
                                    text: {
                                        content:
                                            "Test Trip from Luna Debug - " +
                                            new Date().toISOString(),
                                    },
                                },
                            ],
                        },
                    },
                },
            });

            console.log("✅ Trip creation successful!");
            console.log("Response:", JSON.stringify(createResponse, null, 2));
        } catch (error) {
            console.log("❌ Trip creation failed:");
            console.log("Error:", error.message);
            if (error.data) {
                console.log("Error data:", JSON.stringify(error.data, null, 2));
            }
        }
    } catch (error) {
        console.log("❌ Connection failed:", error.message);
        if (error.data) {
            console.log("Error data:", JSON.stringify(error.data, null, 2));
        }
    } finally {
        await client.close();
    }
}

testNotionTripCreation().catch(console.error);
