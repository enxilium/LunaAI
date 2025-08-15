from .mcp import mcp_servers
from .util import util_tools
from .workspaces import (
    create_workspace,
    create_and_launch_workspace,
    launch_workspace,
    list_workspaces,
    search_workspaces,
    delete_workspace,
    clear_all_workspaces,
    get_workspace_stats
)

# Workspace tools
workspace_tools = [
    create_workspace,
    create_and_launch_workspace,
    launch_workspace,
    list_workspaces,
    search_workspaces,
    delete_workspace,
    clear_all_workspaces,
    get_workspace_stats
]

# Async function to get all tools including MCP
async def get_async_tools():
    """Get all tools including async MCP tools"""
    # Combine utility tools, workspace tools, and MCP servers
    # MCP servers are configured as ADK MCPToolset instances
    return util_tools + workspace_tools + mcp_servers