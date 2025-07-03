console.log("=== Luna AI Notion Tools Analysis ===");

// Load the saved tools from all-tools.json to analyze Notion capabilities
const allTools = require("../assets/config/all-tools.json");

console.log("\n=== Analyzing Notion Tools from Luna's Configuration ===");

// Find all Notion-related tools
const notionTools = [];
allTools.forEach((toolGroup) => {
    if (toolGroup.functionDeclarations) {
        toolGroup.functionDeclarations.forEach((tool) => {
            if (tool.name.toLowerCase().includes("notion")) {
                notionTools.push(tool);
            }
        });
    }
});

console.log(`Found ${notionTools.length} Notion tools:`);

notionTools.forEach((tool, index) => {
    console.log(`\n${index + 1}. ${tool.name}`);
    console.log(`   Description: ${tool.description}`);

    if (tool.parameters && tool.parameters.properties) {
        const params = Object.keys(tool.parameters.properties);
        console.log(`   Parameters: ${params.join(", ")}`);

        // Check for template-related parameters
        const templateParams = params.filter((param) => {
            const prop = tool.parameters.properties[param];
            return (
                param.toLowerCase().includes("template") ||
                prop.description?.toLowerCase().includes("template")
            );
        });

        if (templateParams.length > 0) {
            console.log(
                `   🎯 TEMPLATE PARAMETERS: ${templateParams.join(", ")}`
            );
        }

        // For page creation tools, show detailed parameters
        if (
            tool.name.toLowerCase().includes("page") &&
            (tool.name.toLowerCase().includes("post") ||
                tool.name.toLowerCase().includes("create"))
        ) {
            console.log(`   📝 PAGE CREATION TOOL DETAILS:`);
            console.log(
                `   Full parameters:`,
                JSON.stringify(tool.parameters, null, 6)
            );
        }
    }
});

console.log("\n=== Analysis: Template Capabilities ===");

// Check for database duplication or template creation tools
const templateRelatedTools = notionTools.filter(
    (tool) =>
        tool.name.toLowerCase().includes("template") ||
        tool.name.toLowerCase().includes("duplicate") ||
        tool.name.toLowerCase().includes("copy") ||
        tool.description.toLowerCase().includes("template") ||
        tool.description.toLowerCase().includes("duplicate")
);

if (templateRelatedTools.length > 0) {
    console.log("✅ Template-related tools found:");
    templateRelatedTools.forEach((tool) => {
        console.log(`- ${tool.name}: ${tool.description}`);
    });
} else {
    console.log("❌ No direct template tools found");
}

// Check for page creation in database capability
const pageCreationTools = notionTools.filter(
    (tool) =>
        tool.name.toLowerCase().includes("page") &&
        (tool.name.toLowerCase().includes("post") ||
            tool.name.toLowerCase().includes("create"))
);

console.log("\n=== Page Creation Analysis ===");
if (pageCreationTools.length > 0) {
    console.log("✅ Page creation tools found:");
    pageCreationTools.forEach((tool) => {
        console.log(`\n📄 ${tool.name}`);

        if (tool.parameters && tool.parameters.properties) {
            // Check if it supports database as parent
            if (tool.parameters.properties.parent) {
                console.log("   - Supports parent specification ✅");
                const parentProps = tool.parameters.properties.parent;
                if (parentProps.properties) {
                    const parentTypes = Object.keys(parentProps.properties);
                    console.log(`   - Parent types: ${parentTypes.join(", ")}`);

                    if (parentTypes.includes("database_id")) {
                        console.log("   - ✅ Can create pages in databases");
                    }
                }
            }

            // Check properties parameter
            if (tool.parameters.properties.properties) {
                console.log("   - Supports properties specification ✅");
            }

            // Check children parameter (for content)
            if (tool.parameters.properties.children) {
                console.log("   - Supports content/children ✅");
            }
        }
    });
} else {
    console.log("❌ No page creation tools found");
}

console.log("\n=== Conclusion ===");
console.log("Based on the available Notion MCP tools:");

if (pageCreationTools.length > 0) {
    console.log("✅ Page creation in databases is supported");
    console.log("✅ You can specify properties when creating pages");
    console.log("✅ You can add content/children to new pages");
} else {
    console.log("❌ Page creation not available");
}

if (templateRelatedTools.length > 0) {
    console.log("✅ Template-related functionality may be available");
} else {
    console.log("❌ No direct template functionality found");
    console.log("💡 Template behavior would need to be implemented by:");
    console.log("   1. Querying an existing page/database for structure");
    console.log("   2. Using that structure to create new pages");
    console.log("   3. Copying properties and content patterns");
}

console.log("\n=== Recommended Approach for Template-like Behavior ===");
console.log(
    "1. Use notionMcpApiPostDatabaseQuery to fetch existing pages as templates"
);
console.log("2. Extract property structure and content patterns");
console.log(
    "3. Use notionMcpApiPostPage to create new pages with similar structure"
);
console.log("4. Populate properties based on template patterns");
