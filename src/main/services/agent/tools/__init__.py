# from .mcp import mcp_servers
from .util import util_tools

# Async function to get all tools including MCP
async def get_async_tools():
    """Get all tools including async MCP tools"""
    # Combine utility tools and MCP servers
    # MCP servers are configured as ADK MCPToolset instances
    return util_tools # + mcp_servers