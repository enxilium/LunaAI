# from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StreamableHTTPConnectionParams
# from google.adk.auth import AuthCredential, AuthCredentialTypes, HttpAuth, HttpCredentials
# from google.adk.auth.auth_schemes import HTTPBearer
# from google.adk.auth import AuthCredential
# from google.adk.auth import AuthCredentialTypes

# auth_scheme = HTTPBearer()

# # Define the credential containing the actual token.
# auth_credential = AuthCredential(
#     auth_type=AuthCredentialTypes.HTTP,
#     http=HttpAuth(
#         scheme="bearer", credentials=HttpCredentials(token=MY_MCP_API_TOKEN)
#     ),
# )

# notion_mcp = MCPToolset(
#     connection_params=StreamableHTTPConnectionParams(
#         url="https://mcp.notion.com/mcp"
#     ),
# )