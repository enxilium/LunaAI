from google.adk.agents import Agent
from google.adk.tools import google_search

from .tools import get_async_tools
from .prompts.prompt import prompt

# Async agent creation (only pattern used)
async def get_agent_async():
    """Creates an ADK Agent equipped with MCP tools asynchronously"""
    
    # Get all tools including MCP tools asynchronously
    all_tools = [google_search] + await get_async_tools()
    
    agent = Agent(
        name="luna",
        model="gemini-2.5-flash-live-preview",
        description="A multimodal AI agent that can monitor video streams, answer questions, provide information, and assist with various tasks including UI automation.",
        instruction=prompt,
        tools=all_tools
    )
    
    return agent