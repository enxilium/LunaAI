console.log('=== Testing Luna Notion Handler Call ===');

// Let's test the exact same call that Luna is making to see why it fails

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function testLunaNotionCall() {
    console.log('🔍 Testing the exact same call Luna is making...\n');
    
    const transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@notionhq/notion-mcp-server'],
        env: {
            ...process.env,
            OPENAPI_MCP_HEADERS: JSON.stringify({
                "Authorization": "Bearer ***REMOVED***",
                "Notion-Version": "2022-06-28"
            })
        }
    });
    
    const client = new Client({
        name: 'luna-test-client',
        version: '1.0.0'
    }, {
        capabilities: {}
    });
    
    try {
        await client.connect(transport);
        console.log('✅ Connected to Notion MCP server');
        
        // Test 1: The working format (what we just confirmed works)
        console.log('\n🧪 Test 1: Working format with database_id');
        try {
            const workingResponse = await client.callTool({
                name: 'API-post-page',
                arguments: {
                    parent: {
                        database_id: "31407325-f0f8-4a80-9d3f-7e017da945c3"
                    },
                    properties: {
                        Name: {
                            title: [{
                                text: {
                                    content: "Working Format Test - " + new Date().toISOString()
                                }
                            }]
                        }
                    }
                }
            });
            
            console.log('✅ Test 1 PASSED - Working format successful');
            
        } catch (error) {
            console.log('❌ Test 1 FAILED:', error.message);
        }
        
        // Test 2: What Luna's schema suggests (page_id format)
        console.log('\n🧪 Test 2: Luna schema format with page_id (should fail)');
        try {
            const lunaSchemaResponse = await client.callTool({
                name: 'API-post-page', 
                arguments: {
                    parent: {
                        page_id: "31407325-f0f8-4a80-9d3f-7e017da945c3"
                    },
                    properties: {
                        Name: {
                            title: [{
                                text: {
                                    content: "Luna Schema Test - " + new Date().toISOString()
                                }
                            }]
                        }
                    }
                }
            });
            
            console.log('✅ Test 2 PASSED - Luna schema format worked (unexpected!)');
            
        } catch (error) {
            console.log('❌ Test 2 FAILED (expected):', error.message);
            console.log('This confirms the schema issue - Luna is using page_id instead of database_id');
        }
        
        // Test 3: What if Luna is sending the arguments wrong?
        console.log('\n🧪 Test 3: Testing different argument structures');
        
        // Check if Luna might be calling with wrong tool name
        const toolsResponse = await client.listTools();
        console.log('\nAvailable tools:');
        toolsResponse.tools.forEach(tool => {
            if (tool.name.includes('page')) {
                console.log(`- ${tool.name}: ${tool.description}`);
            }
        });
        
        // Test 4: Check if there's a rate limiting or timing issue
        console.log('\n🧪 Test 4: Testing rapid calls (like Luna might do)');
        for (let i = 0; i < 3; i++) {
            try {
                const rapidResponse = await client.callTool({
                    name: 'API-post-page',
                    arguments: {
                        parent: {
                            database_id: "31407325-f0f8-4a80-9d3f-7e017da945c3"
                        },
                        properties: {
                            Name: {
                                title: [{
                                    text: {
                                        content: `Rapid Test ${i + 1} - ${new Date().toISOString()}`
                                    }
                                }]
                            }
                        }
                    }
                });
                
                console.log(`✅ Rapid test ${i + 1} passed`);
                
            } catch (error) {
                console.log(`❌ Rapid test ${i + 1} failed:`, error.message);
                if (error.status === 404) {
                    console.log('💡 404 error - this suggests the issue might be intermittent or timing-related');
                }
            }
            
            // Small delay between calls
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('\n=== ANALYSIS ===');
        console.log('1. The database ID 31407325-f0f8-4a80-9d3f-7e017da945c3 IS accessible');
        console.log('2. Creating pages in this database DOES work');
        console.log('3. The issue is likely:');
        console.log('   a) Luna is using wrong parent format (page_id vs database_id)');
        console.log('   b) Luna is sending malformed arguments');
        console.log('   c) There\'s a timing/rate limiting issue');
        console.log('   d) Luna\'s MCP tool mapper is transforming arguments incorrectly');
        
    } catch (error) {
        console.log('❌ Connection failed:', error.message);
    } finally {
        await client.close();
    }
}

testLunaNotionCall().catch(console.error);
