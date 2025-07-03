const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
    StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const { spawn } = require("child_process");
const path = require("path");

console.log("=== Testing Notion Page Creation and Template Capabilities ===");

async function testNotionPageCreation() {
    let notionClient = null;
    let serverProcess = null;

    try {
        // Start the Notion MCP server
        const mcpServerPath = path.join(
            __dirname,
            "..",
            "node_modules",
            "@modelcontextprotocol",
            "server-notion",
            "dist",
            "index.js"
        );
        console.log("Starting Notion MCP server...");

        serverProcess = spawn("node", [mcpServerPath], {
            stdio: "pipe",
            env: {
                ...process.env,
                NOTION_API_KEY:
                    process.env.NOTION_API_KEY ||
                    "secret_J9gKJwCTiNn8BpYdW9rqSPmfMJUTPfvJRJHNJ82G7zS",
            },
        });

        // Create transport and client
        const transport = new StdioClientTransport({
            command: "node",
            args: [mcpServerPath],
            env: {
                ...process.env,
                NOTION_API_KEY:
                    process.env.NOTION_API_KEY ||
                    "secret_J9gKJwCTiNn8BpYdW9rqSPmfMJUTPfvJRJHNJ82G7zS",
            },
        });

        notionClient = new Client(
            {
                name: "test-client",
                version: "1.0.0",
            },
            {
                capabilities: {},
            }
        );

        await notionClient.connect(transport);
        console.log("✅ Connected to Notion MCP server");

        // List all available tools
        const toolsResponse = await notionClient.listTools();
        console.log("\\n=== Available Notion Tools ===");
        if (toolsResponse && toolsResponse.tools) {
            toolsResponse.tools.forEach((tool, index) => {
                console.log(`${index + 1}. ${tool.name} - ${tool.description}`);

                // Check for template-related properties
                if (tool.inputSchema && tool.inputSchema.properties) {
                    const props = Object.keys(tool.inputSchema.properties);
                    const templateProps = props.filter((key) => {
                        const prop = tool.inputSchema.properties[key];
                        return (
                            key.toLowerCase().includes("template") ||
                            prop.description?.toLowerCase().includes("template")
                        );
                    });

                    if (templateProps.length > 0) {
                        console.log(
                            `   🎯 TEMPLATE PROPERTIES: ${templateProps.join(
                                ", "
                            )}`
                        );
                    }
                }
            });
        }

        // Test creating a page in the Trips database
        const tripsDbId = "c3e8e5bfaeb344168b5a3d5b43e89b09";
        console.log("\\n=== Testing Page Creation in Database ===");

        try {
            // First, query the database to understand its structure
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
                console.log("✅ Database query successful");

                if (content.results && content.results.length > 0) {
                    console.log("\\n=== Example Page Structure ===");
                    const examplePage = content.results[0];
                    console.log(
                        "Properties available:",
                        Object.keys(examplePage.properties)
                    );

                    // Show property details
                    Object.entries(examplePage.properties).forEach(
                        ([key, prop]) => {
                            console.log(`- ${key}: ${prop.type}`);
                        }
                    );
                }
            }

            // Now try to create a page
            console.log("\\n=== Creating New Page ===");
            const createResult = await notionClient.callTool("API-post-page", {
                parent: {
                    type: "database_id",
                    database_id: tripsDbId,
                },
                properties: {
                    "Trip Name": {
                        title: [
                            {
                                text: {
                                    content:
                                        "Test Trip from Luna AI Template Investigation",
                                },
                            },
                        ],
                    },
                },
            });

            if (createResult && createResult.content) {
                const createdPage = JSON.parse(createResult.content[0].text);
                console.log("✅ Page created successfully!");
                console.log("New page ID:", createdPage.id);
                console.log(
                    "Created page properties:",
                    Object.keys(createdPage.properties)
                );
            }
        } catch (error) {
            console.log("❌ Error:", error.message);
            if (error.content) {
                console.log("Error details:", error.content);
            }
        }

        // Search for template-related content
        console.log("\\n=== Searching for Template Content ===");
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
                console.log(
                    `Found ${
                        searchContent.results?.length || 0
                    } results for "template"`
                );

                if (searchContent.results && searchContent.results.length > 0) {
                    searchContent.results.forEach((result, index) => {
                        console.log(
                            `${index + 1}. ${result.object}: ${
                                result.properties?.title?.title?.[0]?.text
                                    ?.content ||
                                result.title?.[0]?.text?.content ||
                                "No title"
                            }`
                        );
                    });
                }
            }
        } catch (error) {
            console.log("Search failed:", error.message);
        }

        // Check if there are any database creation or duplication tools
        console.log("\\n=== Checking Database Management Tools ===");
        const dbTools = toolsResponse.tools.filter(
            (tool) =>
                tool.name.toLowerCase().includes("database") ||
                tool.name.toLowerCase().includes("duplicate") ||
                tool.name.toLowerCase().includes("template")
        );

        if (dbTools.length > 0) {
            console.log("Database management tools found:");
            dbTools.forEach((tool) => {
                console.log(`- ${tool.name}: ${tool.description}`);
                if (tool.inputSchema && tool.inputSchema.properties) {
                    console.log(
                        `  Parameters: ${Object.keys(
                            tool.inputSchema.properties
                        ).join(", ")}`
                    );
                }
            });
        } else {
            console.log("No database management tools found");
        }
    } catch (error) {
        console.error("Error during test:", error);
    } finally {
        try {
            if (notionClient) {
                await notionClient.close();
            }
            if (serverProcess) {
                serverProcess.kill();
            }
        } catch (e) {
            console.error("Error during cleanup:", e);
        }
    }
}

testNotionPageCreation().catch(console.error);
