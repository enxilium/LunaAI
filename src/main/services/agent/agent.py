import sys

from google.adk.agents import Agent
from google.adk.tools import google_search

from .tools import tools as agent_tools, get_async_tools

TOOLS = [google_search] + agent_tools

def log_info(message: str):
    """Log info message to stdout"""
    print(message, file=sys.stdout, flush=True)

def log_error(message: str):
    """Log error message to stderr"""
    print(message, file=sys.stderr, flush=True)

# Create the root agent with video monitoring and UI automation tools (synchronous version)
root_agent = Agent(
    name="luna",
    model="gemini-2.5-flash-live-preview",
    description="A multimodal AI agent that can answer questions, provide information, and assist with various tasks including UI automation.",
    instruction="You are a helpful assistant that can perform a variety of tasks, from controlling the user's mouse and keyboard for desktop automation to calling third party MCPs to control the user's Spotify or Notion accounts. You have access to the user's video stream at all times but should analyze it only when asked to. Keep responses concise and direct, while maintaining a lighthearted, friendly personality.",
    tools=TOOLS
)

# Async version for MCP tools (required for streaming server)
async def get_agent_async():
    """Creates an ADK Agent equipped with MCP tools asynchronously"""
    log_info("[AGENT] Creating agent with async MCP tools...")
    
    try:
        # Get regular (non-MCP) tools first
        log_info(f"[AGENT] Loaded {len(agent_tools)} regular tools")
        
        # Get MCP tools asynchronously
        try:
            mcp_tools = await get_async_tools()
            log_info(f"[AGENT] Loaded {len(mcp_tools)} total tools (including MCP)")
        except Exception as e:
            log_error(f"[AGENT] Failed to load async tools: {e}")
            mcp_tools = agent_tools
        
        # Combine all tools
        all_tools = [google_search] + mcp_tools
        log_info(f"[AGENT] Total tools: {len(all_tools)}")
        
        agent = Agent(
            name="luna",
            model="gemini-2.5-flash-live-preview",
            description="A multimodal AI agent that can monitor video streams, answer questions, provide information, and assist with various tasks including UI automation.",
            instruction="You are a helpful assistant that can perform a variety of tasks, from controlling the user's mouse and keyboard for desktop automation to calling third party MCPs to control the user's Spotify or Notion accounts. You have access to the user's video stream at all times but should analyze it only when asked to. Keep responses concise and direct, while maintaining a lighthearted, friendly personality.",
            tools=all_tools
        )
        
        log_info("[AGENT] Agent created successfully with MCP tools")
        return agent
        
    except Exception as e:
        log_error(f"[AGENT] Error creating agent with MCP tools: {e}")
        # Fallback to agent without MCP tools
        log_info("[AGENT] Creating fallback agent without MCP tools...")
        
        fallback_tools = [google_search] + agent_tools
        
        agent = Agent(
            name="luna",
            model="gemini-2.5-flash-live-preview",
            description="A multimodal AI agent that can monitor video streams, answer questions, provide information, and assist with various tasks including UI automation.",
            instruction="You are a helpful assistant that can perform a variety of tasks, from controlling the user's mouse and keyboard for desktop automation to calling third party MCPs to control the user's Spotify or Notion accounts. You have access to the user's video stream at all times but should analyze it only when asked to. Keep responses concise and direct, while maintaining a lighthearted, friendly personality.",
            tools=fallback_tools
        )
        
        log_info("[AGENT] Fallback agent created successfully")
        return agent