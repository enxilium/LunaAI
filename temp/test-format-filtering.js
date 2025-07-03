const { McpToolMapper } = require("../src/main/services/agent/mcp-tool-mapper");

// Test the format property filtering
const mapper = new McpToolMapper();

// Test schema with format properties (like Google Calendar might have)
const testSchema = {
    type: "object",
    properties: {
        title: {
            type: "string",
            description: "Event title",
        },
        startTime: {
            type: "string",
            format: "date-time",
            description: "Start time of the event",
        },
        endTime: {
            type: "string",
            format: "date-time",
            description: "End time of the event",
        },
        attendees: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    email: {
                        type: "string",
                        format: "email",
                        description: "Attendee email",
                    },
                    name: {
                        type: "string",
                        description: "Attendee name",
                    },
                },
            },
        },
    },
    required: ["title", "startTime", "endTime"],
};

console.log("Original schema:");
console.log(JSON.stringify(testSchema, null, 2));

console.log("\n" + "=".repeat(50) + "\n");

// Process the schema
const processedSchema = mapper.convertToGeminiSchema({
    name: "testTool",
    description: "Test tool with format properties",
    inputSchema: testSchema,
});

console.log("Processed schema (should have no 'format' properties):");
console.log(JSON.stringify(processedSchema, null, 2));

// Check if any format properties remain
const schemaStr = JSON.stringify(processedSchema);
const formatMatches = schemaStr.match(/"format":/g);

if (formatMatches) {
    console.log(
        `\n❌ ERROR: Found ${formatMatches.length} format properties in processed schema!`
    );
} else {
    console.log(`\n✅ SUCCESS: No format properties found in processed schema`);
}

// Check for attendees property
const attendeesMatches = schemaStr.match(/"attendees":/g);
if (attendeesMatches) {
    console.log(
        `✅ Attendees property preserved: ${attendeesMatches.length} occurrence(s)`
    );
}
