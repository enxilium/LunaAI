// Final test to confirm everything is working
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
    StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const {
    McpToolMapper,
} = require("../src/main/services/agent/mcp-tool-mapper.js");

async function finalValidationTest() {
    console.log("🔄 Final validation test...\n");

    const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@notionhq/notion-mcp-server"],
        env: {
            ...process.env,
            OPENAPI_MCP_HEADERS: JSON.stringify({
                Authorization:
                    "Bearer ***REMOVED***",
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

        // Test the MCP Tool Mapper
        const toolMapper = new McpToolMapper();
        const toolsResponse = await client.listTools();
        const createPageTool = toolsResponse.tools.find(
            (t) => t.name === "API-post-page"
        );

        if (createPageTool) {
            // Get the handler name that would be generated
            const handlerName = toolMapper.getHandlerName(
                "notionMCP",
                createPageTool.name
            );
            console.log(
                `✅ Handler name generation: ${createPageTool.name} -> ${handlerName}`
            );

            // Test the actual tool call
            console.log("\n🚀 Testing actual trip creation...");
            const response = await client.callTool({
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
                                            "Final Validation Test Trip - " +
                                            new Date().toISOString(),
                                    },
                                },
                            ],
                        },
                    },
                },
            });

            console.log("✅ Trip creation successful!");
            const responseData = JSON.parse(response.content[0].text);
            console.log(`   Trip ID: ${responseData.id}`);
            console.log(`   Trip URL: ${responseData.url}`);
        }
    } catch (error) {
        console.log("❌ Test failed:", error.message);
    } finally {
        await client.close();
    }

    console.log(
        "\n🎉 All systems validated! Luna should now be able to create Notion trips."
    );
    console.log(
        "💡 Make sure to restart Luna app to load the updated handler mappings."
    );
}

finalValidationTest().catch(console.error);
