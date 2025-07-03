const fs = require("fs");
const path = require("path");

// Paths to the files
const mjsFilePath = path.join(
    "node_modules",
    "@google",
    "genai",
    "dist",
    "index.mjs"
);
const cjsFilePath = path.join(
    "node_modules",
    "@google",
    "genai",
    "dist",
    "index.cjs"
);
const nodeCjsFilePath = path.join(
    "node_modules",
    "@google",
    "genai",
    "dist",
    "node",
    "index.cjs"
);

// Function to fix the processJsonSchema function
function fixProcessJsonSchema(content, isCjs) {
    const typeRef = isCjs ? "exports.Type" : "Type";

    // Find the pattern where the issue occurs
    const regex = new RegExp(
        `(genAISchema\\['type'\\]\\s*=\\s*)Object\\.values\\(${typeRef}\\)\\.includes\\(\\s*fieldValue\\.toUpperCase\\(\\)`,
        "g"
    );

    // Replace with the fixed version that includes null/undefined check
    return content.replace(
        regex,
        `$1fieldValue && typeof fieldValue === 'string' && Object.values(${typeRef}).includes(\n            fieldValue.toUpperCase()`
    );
}

// Function to fix the filterToJsonSchema function
function fixFilterToJsonSchema(content) {
    // Find the pattern where the issue occurs in both file types
    // For MJS files
    let fixedContent = content.replace(
        /(const typeValue\s*=\s*)\(fieldValue as string\)\.toUpperCase\(\);/g,
        "$1fieldValue && typeof fieldValue === 'string' ? fieldValue.toUpperCase() : '';"
    );

    // For CJS files (might have different syntax)
    fixedContent = fixedContent.replace(
        /(const typeValue\s*=\s*)fieldValue\.toUpperCase\(\);/g,
        "$1fieldValue && typeof fieldValue === 'string' ? fieldValue.toUpperCase() : '';"
    );

    return fixedContent;
}

// Read and fix the MJS file
try {
    console.log(`Reading ${mjsFilePath}...`);
    let mjsContent = fs.readFileSync(mjsFilePath, "utf8");

    console.log("Fixing processJsonSchema in MJS file...");
    mjsContent = fixProcessJsonSchema(mjsContent, false);

    console.log("Fixing filterToJsonSchema in MJS file...");
    mjsContent = fixFilterToJsonSchema(mjsContent);

    console.log(`Writing fixed content to ${mjsFilePath}...`);
    fs.writeFileSync(mjsFilePath, mjsContent);

    console.log("MJS file fixed successfully!");
} catch (error) {
    console.error(`Error fixing MJS file: ${error.message}`);
}

// Read and fix the CJS file
try {
    console.log(`Reading ${cjsFilePath}...`);
    let cjsContent = fs.readFileSync(cjsFilePath, "utf8");

    console.log("Fixing processJsonSchema in CJS file...");
    cjsContent = fixProcessJsonSchema(cjsContent, true);

    console.log("Fixing filterToJsonSchema in CJS file...");
    cjsContent = fixFilterToJsonSchema(cjsContent);

    console.log(`Writing fixed content to ${cjsFilePath}...`);
    fs.writeFileSync(cjsFilePath, cjsContent);

    console.log("CJS file fixed successfully!");
} catch (error) {
    console.error(`Error fixing CJS file: ${error.message}`);
}

// Read and fix the Node CJS file
try {
    console.log(`Reading ${nodeCjsFilePath}...`);
    let nodeCjsContent = fs.readFileSync(nodeCjsFilePath, "utf8");

    console.log("Fixing processJsonSchema in Node CJS file...");
    nodeCjsContent = fixProcessJsonSchema(nodeCjsContent, true);

    console.log("Fixing filterToJsonSchema in Node CJS file...");
    nodeCjsContent = fixFilterToJsonSchema(nodeCjsContent);

    console.log(`Writing fixed content to ${nodeCjsFilePath}...`);
    fs.writeFileSync(nodeCjsFilePath, nodeCjsContent);

    console.log("Node CJS file fixed successfully!");
} catch (error) {
    console.error(`Error fixing Node CJS file: ${error.message}`);
}

console.log("All fixes applied!");
