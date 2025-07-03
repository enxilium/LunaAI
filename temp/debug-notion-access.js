console.log('=== Debugging Notion Database Access Issue ===');

// This script will help identify the correct database ID and check permissions

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function debugNotionAccess() {
    console.log('🔍 Checking Notion integration access...\n');
    
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
        name: 'debug-client',
        version: '1.0.0'
    }, {
        capabilities: {}
    });
    
    try {
        await client.connect(transport);
        console.log('✅ Connected to Notion MCP server');
        
        // First, let's check what we can access with a search
        console.log('\n🔍 Searching for accessible databases and pages...');
        try {
            const searchResponse = await client.callTool({
                name: 'API-post-search',
                arguments: {
                    query: 'Trips',
                    page_size: 10
                }
            });
            
            if (searchResponse && searchResponse.content) {
                const searchResults = JSON.parse(searchResponse.content[0].text);
                console.log('✅ Search successful! Found results:');
                console.log(`Total results: ${searchResults.results?.length || 0}`);
                
                if (searchResults.results && searchResults.results.length > 0) {
                    console.log('\n📋 Available pages/databases:');
                    searchResults.results.forEach((result, index) => {
                        console.log(`\n${index + 1}. ${result.object.toUpperCase()}: ${result.id}`);
                        
                        if (result.object === 'database') {
                            console.log(`   Database Title: ${result.title?.[0]?.text?.content || 'No title'}`);
                            console.log(`   📊 This is a DATABASE - can create pages here`);
                        } else if (result.object === 'page') {
                            console.log(`   Page Title: ${result.properties?.title?.title?.[0]?.text?.content || 'No title'}`);
                            console.log(`   📄 This is a PAGE`);
                        }
                        
                        console.log(`   URL: ${result.url || 'No URL'}`);
                        console.log(`   Created: ${result.created_time || 'Unknown'}`);
                    });
                    
                    // Find databases specifically
                    const databases = searchResults.results.filter(r => r.object === 'database');
                    if (databases.length > 0) {
                        console.log(`\n🎯 Found ${databases.length} accessible database(s):`);
                        databases.forEach((db, index) => {
                            console.log(`\n${index + 1}. Database ID: ${db.id}`);
                            console.log(`   Title: ${db.title?.[0]?.text?.content || 'No title'}`);
                            console.log(`   Use this ID for creating pages!`);
                        });
                        
                        // Test creating a page in the first database found
                        const firstDb = databases[0];
                        console.log(`\n🚀 Testing page creation in database: ${firstDb.id}`);
                        
                        try {
                            const createResponse = await client.callTool({
                                name: 'API-post-page',
                                arguments: {
                                    parent: {
                                        database_id: firstDb.id
                                    },
                                    properties: {
                                        Name: {
                                            title: [{
                                                text: {
                                                    content: `Test Trip - ${new Date().toISOString()}`
                                                }
                                            }]
                                        }
                                    }
                                }
                            });
                            
                            if (createResponse && createResponse.content) {
                                const createdPage = JSON.parse(createResponse.content[0].text);
                                console.log('✅ SUCCESS! Page created in database!');
                                console.log(`New page ID: ${createdPage.id}`);
                                console.log(`Page URL: ${createdPage.url}`);
                                
                                // Update our config with the working database ID
                                console.log(`\n📝 CORRECT DATABASE ID TO USE: ${firstDb.id}`);
                                console.log('You should update your tests to use this database ID instead.');
                            }
                            
                        } catch (createError) {
                            console.log('❌ Failed to create page in database:');
                            console.log('Error:', createError.message);
                            if (createError.data) {
                                console.log('Error details:', JSON.stringify(createError.data, null, 2));
                            }
                        }
                    } else {
                        console.log('\n❌ No databases found in search results');
                        console.log('This means the integration may not have access to any databases');
                    }
                } else {
                    console.log('❌ No results found in search');
                }
            }
            
        } catch (searchError) {
            console.log('❌ Search failed:');
            console.log('Error:', searchError.message);
            if (searchError.data) {
                console.log('Error details:', JSON.stringify(searchError.data, null, 2));
            }
        }
        
        // Also try to get self info to verify integration
        console.log('\n👤 Checking integration info...');
        try {
            const selfResponse = await client.callTool({
                name: 'API-get-self',
                arguments: {}
            });
            
            if (selfResponse && selfResponse.content) {
                const selfInfo = JSON.parse(selfResponse.content[0].text);
                console.log('✅ Integration info:');
                console.log(`Bot ID: ${selfInfo.id}`);
                console.log(`Bot Name: ${selfInfo.name}`);
                console.log(`Bot Type: ${selfInfo.type}`);
                console.log(`Owner: ${selfInfo.owner?.user?.name || 'Unknown'}`);
            }
        } catch (selfError) {
            console.log('❌ Failed to get self info:', selfError.message);
        }
        
    } catch (error) {
        console.log('❌ Connection failed:', error.message);
        if (error.data) {
            console.log('Error data:', JSON.stringify(error.data, null, 2));
        }
    } finally {
        await client.close();
    }
}

debugNotionAccess().catch(console.error);
