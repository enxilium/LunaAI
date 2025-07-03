const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
    StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
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

async function testNotionConnection() {
    console.log("=== Testing Notion MCP Connection ===");

    const notionConfig = config.mcpServers.find(
        (server) => server.name === "notionMCP"
    );
    if (!notionConfig) {
        console.error("Notion MCP server config not found");
        return;
    }

    console.log("Notion config:", JSON.stringify(notionConfig, null, 2));

    let client = null;

    try {
        const transport = new StdioClientTransport(notionConfig.transport);
        client = new Client({ name: "notion-debug", version: "1.0.0" });
        await client.connect(transport);
        console.log("Connected to Notion MCP server");

        // List available tools first
        console.log("\n1. Listing available tools...");
        const toolsResponse = await client.listTools();
        console.log(
            "Available tools:",
            JSON.stringify(
                toolsResponse.tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                })),
                null,
                2
            )
        );

        // Test search for your database with correct tool name
        const searchTool = toolsResponse.tools.find((t) =>
            t.name.toLowerCase().includes("search")
        );
        if (searchTool) {
            console.log(`\n2. Using search tool: ${searchTool.name}`);

            // Search specifically for Trips database
            console.log('Searching for "Trips" database...');
            const searchResponse = await client.callTool({
                name: searchTool.name,
                arguments: {
                    query: "Trips",
                    filter: {
                        property: "object",
                        value: "database",
                    },
                },
            });

            // Parse and display search results
            const searchResults = JSON.parse(searchResponse.content[0].text);
            console.log(
                `Found ${searchResults.results.length} results for "Trips"`
            );

            searchResults.results.forEach((result, i) => {
                if (result.object === "database") {
                    console.log(`\nDatabase ${i + 1}:`);
                    console.log(`  ID: ${result.id}`);
                    console.log(
                        `  Title: ${
                            result.title?.map((t) => t.plain_text).join("") ||
                            "No title"
                        }`
                    );
                    console.log(`  Created: ${result.created_time}`);
                    console.log(
                        `  Properties: ${Object.keys(
                            result.properties || {}
                        ).join(", ")}`
                    );
                }
            });

            // Check if your specific database ID is in the results
            const yourDb = searchResults.results.find(
                (r) => r.id === "31407325-f0f8-4a80-9d3f-7e017da945c3"
            );
            if (yourDb) {
                console.log(
                    "\n✅ Found your Trips database in search results!"
                );
                console.log(
                    `Database title: ${
                        yourDb.title?.map((t) => t.plain_text).join("") ||
                        "No title"
                    }`
                );
            } else {
                console.log(
                    "\n❌ Your specific database ID was not found in search results"
                );
            }
        }

        // Test database query with correct tool name
        const queryTool = toolsResponse.tools.find((t) =>
            t.name.toLowerCase().includes("query")
        );
        if (queryTool) {
            console.log(`\n3. Using query tool: ${queryTool.name}`);
            const dbQueryResponse = await client.callTool({
                name: queryTool.name,
                arguments: {
                    database_id: "31407325-f0f8-4a80-9d3f-7e017da945c3",
                },
            });
            console.log("Database query successful - found existing trips");
        }

        // Test creating a new trip entry
        const createPageTool = toolsResponse.tools.find(
            (t) => t.name === "API-post-page"
        );
        if (createPageTool) {
            console.log(
                `\n4. Testing trip creation with: ${createPageTool.name}`
            );
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
                                                "Test Trip from Luna Debug",
                                        },
                                    },
                                ],
                            },
                            Details: {
                                rich_text: [
                                    {
                                        text: {
                                            content:
                                                "This is a test trip created via MCP to verify permissions",
                                        },
                                    },
                                ],
                            },
                        },
                    },
                });

                const result = JSON.parse(createResponse.content[0].text);
                console.log("✅ Successfully created new trip!");
                console.log(`New trip ID: ${result.id}`);
                console.log(`New trip URL: ${result.url}`);
            } catch (error) {
                console.error("❌ Failed to create trip:", error.message);
                if (error.message.includes("permissions")) {
                    console.log("This suggests a permissions issue.");
                } else {
                    console.log(
                        "This suggests a data format issue, not permissions."
                    );
                }
            }
        }
    } catch (error) {
        console.error("Error during Notion test:", error);
        console.error("Error details:", error.message);
    } finally {
        if (client) {
            try {
                await client.close();
                console.log("Client closed");
            } catch (e) {
                console.error("Error closing client:", e);
            }
        }
    }
}

testNotionConnection().catch(console.error);
