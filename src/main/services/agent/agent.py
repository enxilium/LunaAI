from google.adk.agents import Agent
from google.adk.tools import google_search
from google.adk.tools.tool_context import ToolContext
from google.adk.tools.base_tool import BaseTool
from typing import Dict, Any, Optional
import uuid

from .tools import get_async_tools
from .prompts.prompt import prompt
from .tool_callbacks import create_after_tool_callback


async def get_agent_async(session_id: str = None, user_id: str = "default"):
    """Creates an ADK Agent equipped with MCP tools and tool logging asynchronously"""
    
    # Generate session ID if not provided
    if session_id is None:
        session_id = str(uuid.uuid4())
    
    # Get all tools including MCP tools asynchronously
    all_tools = [google_search] + await get_async_tools()
    
    # Create simple after_tool_callback for logging
    after_tool_callback = create_after_tool_callback(session_id=session_id, user_id=user_id)
    
    agent = Agent(
        name="luna",
        model="gemini-2.5-flash-live-preview",
        description="A multimodal AI agent that can monitor video streams, answer questions, provide information, and assist with various tasks including UI automation. Has persistent memory capabilities and learns from usage patterns to provide proactive suggestions.",
        instruction=prompt,
        tools=all_tools,
        # Add the simple tool execution callback
        after_tool_callback=after_tool_callback,
    )
    
    return agent