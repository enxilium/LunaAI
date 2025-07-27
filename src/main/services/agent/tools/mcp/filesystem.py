import os
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioServerParameters, StdioConnectionParams

def get_documents_directory():
    """
    Get the standard Documents directory for the current OS
    """

    return os.path.join(os.path.expanduser("~"), "Documents")

TARGET_FOLDER_PATH = get_documents_directory()

filesystem_mcp = MCPToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command='npx',
            args=[
                "-y",  
                "@modelcontextprotocol/server-filesystem",
                os.path.abspath(TARGET_FOLDER_PATH),  # Absolute path to Documents directory
            ],
        ),
    )
    # TODO: Add user-configurable file access permissions and directory restrictions
)