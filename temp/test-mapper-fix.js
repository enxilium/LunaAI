console.log('=== Testing MCP Tool Mapper Fix ===');

// Test the updated MCP Tool Mapper with additionalProperties handling

const { McpToolMapper } = require('../src/main/services/agent/mcp-tool-mapper.js');

// Create a test tool that mimics the Notion MCP schema
const testNotionTool = {
    name: 'API-post-page',
    description: 'Create a page',
    inputSchema: {
        type: 'object',
        properties: {
            parent: {
                type: 'object',
                properties: {
                    page_id: {
                        type: 'string',
                        format: 'uuid'
                    }
                },
                required: ['page_id'],
                additionalProperties: true
            },
            properties: {
                type: 'object',
                properties: {
                    title: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                text: {
                                    type: 'object',
                                    properties: {
                                        content: {
                                            type: 'string'
                                        }
                                    },
                                    required: ['content']
                                }
                            },
                            required: ['text']
                        }
                    }
                }
            }
        },
        required: ['parent', 'properties']
    }
};

console.log('🧪 Testing MCP Tool Mapper with Notion schema...\n');

const mapper = new McpToolMapper();

// Process the tool schema
const geminiSchema = mapper.convertToGeminiSchema(testNotionTool);

console.log('✅ Processed schema:');
console.log(JSON.stringify(geminiSchema, null, 2));

console.log('\\n🎯 Parent object properties:');
if (geminiSchema.properties && geminiSchema.properties.parent && geminiSchema.properties.parent.properties) {
    const parentProps = geminiSchema.properties.parent.properties;
    console.log('Available parent properties:', Object.keys(parentProps));
    
    Object.entries(parentProps).forEach(([key, prop]) => {
        console.log(`- ${key}: ${prop.type} ${prop.description ? '- ' + prop.description : ''}`);
    });
    
    if (parentProps.database_id) {
        console.log('\\n✅ SUCCESS: database_id property was added!');
    } else {
        console.log('\\n❌ FAILED: database_id property missing');
    }
    
    if (parentProps.type && parentProps.type.enum) {
        console.log(`\\n✅ Type enum added: ${parentProps.type.enum.join(', ')}`);
    }
} else {
    console.log('❌ No parent properties found');
}

console.log('\\n📝 This should now allow both:');
console.log('1. { parent: { page_id: "..." } }');
console.log('2. { parent: { database_id: "..." } }');
console.log('3. { parent: { type: "database_id", database_id: "..." } }');
