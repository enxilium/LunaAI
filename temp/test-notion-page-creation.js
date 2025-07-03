const { getMcpService } = require("../src/main/services/agent/mcp-service.js");
const geminiConfig = require("../assets/config/gemini-config.json");

console.log("=== Testing Notion Page Creation in Database ===");

async function testNotionPageCreation() {
    const mcpService = await getMcpService();

    try {
        const notionClient = mcpService.getClient("notion");
        if (!notionClient) {
            console.log("❌ Could not get Notion MCP client");
            return;
        }

        console.log("✅ Notion MCP client connected");

        // First, let's check what tools are available
        const toolsResponse = await notionClient.listTools();
        console.log("\n=== Available Notion Tools ===");
        if (toolsResponse && toolsResponse.tools) {
            toolsResponse.tools.forEach((tool, index) => {
                console.log(`${index + 1}. ${tool.name} - ${tool.description}`);
            });
        }

        // Test querying the Trips database to see its structure
        const tripsDbId = "c3e8e5bfaeb344168b5a3d5b43e89b09";
        console.log("\n=== Querying Trips Database Structure ===");

        const queryResult = await notionClient.callTool(
            "API-post-database-query",
            {
                database_id: tripsDbId,
                page_size: 1,
            }
        );

        if (
            queryResult &&
            queryResult.content &&
            queryResult.content.length > 0
        ) {
            const content = JSON.parse(queryResult.content[0].text);
            console.log("Database query result:");
            console.log(JSON.stringify(content, null, 2));

            // Check if there are any results to see page structure
            if (content.results && content.results.length > 0) {
                console.log("\n=== Example Page Structure ===");
                const examplePage = content.results[0];
                console.log("Page ID:", examplePage.id);
                console.log("Properties:", Object.keys(examplePage.properties));
                console.log("Full properties:");
                console.log(JSON.stringify(examplePage.properties, null, 2));
            }
        }

        // Now let's test creating a page in the database
        console.log("\n=== Testing Page Creation in Database ===");

        // First attempt - using the standard API-post-page with parent database_id
        try {
            const createPageResult = await notionClient.callTool(
                "API-post-page",
                {
                    parent: {
                        type: "database_id",
                        database_id: tripsDbId,
                    },
                    properties: {
                        "Trip Name": {
                            title: [
                                {
                                    text: {
                                        content: "Test Trip from Luna AI",
                                    },
                                },
                            ],
                        },
                        Status: {
                            select: {
                                name: "Planning",
                            },
                        },
                    },
                }
            );

            console.log("✅ Page creation successful!");
            console.log("Result:", JSON.stringify(createPageResult, null, 2));
        } catch (error) {
            console.log("❌ Page creation failed:", error.message);

            // Let's check what the exact error is
            if (error.content) {
                console.log("Error details:", error.content);
            }
        }

        // Let's also check if there are any template-related operations by examining the search results
        console.log("\n=== Searching for Template-related Content ===");

        try {
            const searchResult = await notionClient.callTool(
                "API-post-search",
                {
                    query: "template",
                    page_size: 10,
                }
            );

            if (searchResult && searchResult.content) {
                const searchContent = JSON.parse(searchResult.content[0].text);
                console.log("Template search results:");
                console.log(JSON.stringify(searchContent, null, 2));
            }
        } catch (error) {
            console.log("Search failed:", error.message);
        }
    } catch (error) {
        console.error("Error during test:", error);
    }
}

testNotionPageCreation().catch(console.error);
