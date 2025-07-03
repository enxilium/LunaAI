console.log('=== Checking Actual Notion MCP Schema ===');

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function checkActualNotionSchema() {
    console.log('🔍 Getting the actual schema from Notion MCP server...\n');
    
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
        name: 'schema-check-client',
        version: '1.0.0'
    }, {
        capabilities: {}
    });
    
    try {
        await client.connect(transport);
        console.log('✅ Connected to Notion MCP server');
        
        const toolsResponse = await client.listTools();
        const postPageTool = toolsResponse.tools.find(tool => tool.name === 'API-post-page');
        
        if (postPageTool) {
            console.log('📋 Raw API-post-page schema from Notion MCP:');
            console.log(JSON.stringify(postPageTool.inputSchema, null, 2));
            
            // Check the parent property specifically
            if (postPageTool.inputSchema && postPageTool.inputSchema.properties && postPageTool.inputSchema.properties.parent) {
                console.log('\\n🎯 Parent property schema:');
                console.log(JSON.stringify(postPageTool.inputSchema.properties.parent, null, 2));
            }
        } else {
            console.log('❌ API-post-page tool not found');
        }
        
    } catch (error) {
        console.log('❌ Error:', error.message);
    } finally {
        await client.close();
    }
}

checkActualNotionSchema().catch(console.error);
