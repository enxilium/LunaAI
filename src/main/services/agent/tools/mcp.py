import os
from dotenv import load_dotenv

from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioServerParameters, StdioConnectionParams, StreamableHTTPConnectionParams

load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

mcpServers = [
    MCPToolset(
        connection_params=StdioConnectionParams(
            server_params=StdioServerParameters(
                command='npx',
                args=[
                    "-y",
                    "@modelcontextprotocol/server-google-maps",
                ],
                env={
                    "GOOGLE_MAPS_API_KEY": GOOGLE_MAPS_API_KEY
                }
            )
        ),
    ),
    MCPToolset(
        connection_params=StreamableHTTPConnectionParams(
            url="https://mcp.notion.com/mcp"
        ),
        # Notion MCP server also doesn't need auth_config for basic usage
        auth_config=None
    )
]