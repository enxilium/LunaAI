import os
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioServerParameters, StdioConnectionParams

def get_documents_directory():
    """
    Get the standard Documents directory for the current OS
    """
    path = r"D:\Downloads"

    print(path)
    return os.path.abspath(path)

TARGET_FOLDER_PATH = get_documents_directory()

print(TARGET_FOLDER_PATH)

filesystem_mcp = MCPToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command='npx',
            args=[
                "-y",  
                "@modelcontextprotocol/server-filesystem",
                TARGET_FOLDER_PATH,  # Absolute path to Downloads directory
            ],
            # Set the working directory for the MCP server process to the target folder
            # This ensures that relative paths in the MCP server resolve correctly
            cwd=TARGET_FOLDER_PATH,
        ),
    )
    # TODO: Add user-configurable file access permissions and directory restrictions
)