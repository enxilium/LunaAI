// Test Luna's ability to call the Notion trip creation handler directly
const path = require("path");

// Load Luna's services
const {
    getGeminiService,
} = require("../src/main/services/agent/gemini-service.js");

async function testLunaNotionTripCreation() {
    console.log("🔄 Testing Luna's Notion trip creation capability...\n");

    try {
        // Initialize the service (this will load all MCP servers and generate handlers)
        console.log("🚀 Initializing Gemini service...");
        const geminiService = await getGeminiService();
        console.log("✅ Gemini service initialized");

        // Check if the Notion handler is available
        const handlers = geminiService.getAvailableHandlers();
        console.log(`\n📋 Available handlers: ${Object.keys(handlers).length}`);

        const notionHandlers = Object.keys(handlers).filter((h) =>
            h.includes("notion")
        );
        console.log(`\n🗂️  Notion handlers (${notionHandlers.length}):`);
        notionHandlers.forEach((handler) => {
            console.log(`  - ${handler}`);
        });

        // Test the specific trip creation handler
        if (handlers.notionMcpApiPostPage) {
            console.log("\n🎯 Testing notionMcpApiPostPage handler...");

            const tripData = {
                parent: {
                    database_id: "31407325-f0f8-4a80-9d3f-7e017da945c3",
                },
                properties: {
                    Name: {
                        title: [
                            {
                                text: {
                                    content:
                                        "Test Trip from Luna App - " +
                                        new Date().toISOString(),
                                },
                            },
                        ],
                    },
                },
            };

            try {
                const result = await handlers.notionMcpApiPostPage(tripData);
                console.log("✅ Trip creation via Luna handler successful!");
                console.log("Result:", JSON.stringify(result, null, 2));
            } catch (error) {
                console.log("❌ Trip creation via Luna handler failed:");
                console.log("Error:", error.message);
                if (error.stack) {
                    console.log("Stack:", error.stack);
                }
            }
        } else {
            console.log("\n❌ notionMcpApiPostPage handler not found in Luna");
        }
    } catch (error) {
        console.log("❌ Failed to initialize Luna:", error.message);
        if (error.stack) {
            console.log("Stack:", error.stack);
        }
    }
}

testLunaNotionTripCreation().catch(console.error);
