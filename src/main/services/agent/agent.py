import os
from google.adk.agents import Agent
from google.adk.tools import google_search

from .util import load_env
from .tools import get_async_tools
from .prompts import luna_prompt
from .tools.callbacks import after_tool_callback


async def get_agent_async():
    """Creates an ADK Agent equipped with MCP tools and tool logging asynchronously"""
    
    # Load Luna-specific environment when needed
    load_env('luna')
    
    # Get all tools including MCP tools asynchronously
    all_tools = [google_search] + await get_async_tools()
    
    agent = Agent(
        name="luna",
        model="gemini-2.5-flash-live-preview",
        description="A multimodal AI agent that can monitor video streams, answer questions, provide information, and assist with various tasks including UI automation. Has persistent memory capabilities and learns from usage patterns to provide proactive suggestions.",
        instruction=luna_prompt,
        tools=all_tools,
        after_tool_callback=after_tool_callback,
    )
    
    return agent