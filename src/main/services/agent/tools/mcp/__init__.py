from .filesystem import filesystem_mcp

mcp_servers = [filesystem_mcp]

# Async function to get MCP tools
async def get_mcp_tools_async():
    """Get MCP tools asynchronously"""
    # For now, return the configured MCP servers
    # In the future, this could include connection validation
    return mcp_servers