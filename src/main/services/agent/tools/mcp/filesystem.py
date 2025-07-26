import os
from google.adk.agents import LlmAgent
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioServerParameters, StdioConnectionParams

# Get the standard Documents directory based on the operating system
# TODO: Replace this with user-defined settings from configuration file
def get_documents_directory():
    """Get the standard Documents directory for the current OS"""
    # All major OS use ~/Documents, so we can simplify this
    return os.path.join(os.path.expanduser("~"), "Documents")

TARGET_FOLDER_PATH = get_documents_directory()
# Ensure TARGET_FOLDER_PATH is an absolute path for the MCP server.

filesystem_mcp = MCPToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command='npx',
            args=[
                "-y",  # Auto-confirm package installation
                "@modelcontextprotocol/server-filesystem",
                os.path.abspath(TARGET_FOLDER_PATH),  # Absolute path to Documents directory
            ],
        ),
    )
    # TODO: Add user-configurable file access permissions and directory restrictions
)