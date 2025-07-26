from .mcp import mcp_servers
from .util import util_tools

# Synchronous tools (without MCP)
tools = util_tools

# Async function to get all tools including MCP
async def get_async_tools():
    """Get all tools including async MCP tools"""
    # For now, return MCP servers directly since they're already configured
    # In the future, this could include proper async initialization
    return util_tools + mcp_servers