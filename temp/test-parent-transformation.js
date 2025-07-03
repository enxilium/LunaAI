console.log('=== Testing Parent Object Transformation Fix ===');

const { McpToolMapper } = require('../src/main/services/agent/mcp-tool-mapper.js');

// Test the parent object transformation
const mapper = new McpToolMapper();

console.log('🧪 Testing parent object transformation...\n');

// Test case 1: Gemini sends multiple null properties (the problem case)
const testCase1 = {
    parent: {
        page_id: null,
        database_id: "31407325-f0f8-4a80-9d3f-7e017da945c3",
        type: "database_id",
        workspace: null
    },
    properties: {
        Name: {
            title: [{ text: { content: "Test Trip" } }]
        }
    }
};

console.log('📝 Test Case 1 - Multiple properties with nulls:');
console.log('Input:', JSON.stringify(testCase1.parent, null, 2));

const cleaned1 = mapper.transformNotionParent(testCase1.parent);
console.log('Output:', JSON.stringify(cleaned1, null, 2));
console.log('');

// Test case 2: Clean input with just database_id
const testCase2 = {
    parent: {
        database_id: "31407325-f0f8-4a80-9d3f-7e017da945c3"
    }
};

console.log('📝 Test Case 2 - Clean database_id only:');
console.log('Input:', JSON.stringify(testCase2.parent, null, 2));

const cleaned2 = mapper.transformNotionParent(testCase2.parent);
console.log('Output:', JSON.stringify(cleaned2, null, 2));
console.log('');

// Test case 3: Multiple valid properties (should keep first one)
const testCase3 = {
    parent: {
        database_id: "31407325-f0f8-4a80-9d3f-7e017da945c3",
        page_id: "225e6d17-90a5-811d-9874-c98481a0c05b"
    }
};

console.log('📝 Test Case 3 - Multiple valid properties:');
console.log('Input:', JSON.stringify(testCase3.parent, null, 2));

const cleaned3 = mapper.transformNotionParent(testCase3.parent);
console.log('Output:', JSON.stringify(cleaned3, null, 2));
console.log('');

console.log('✅ Expected behavior:');
console.log('1. Null values should be filtered out');
console.log('2. Only one parent type should remain');
console.log('3. Proper type field should be added when needed');
console.log('4. The result should be valid for Notion API');
