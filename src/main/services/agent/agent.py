import sys

from google.adk.agents import Agent
from google.adk.tools import google_search

from .tools import tools as agent_tools

TOOLS = [google_search] + agent_tools



def log_info(message: str):
    """Log info message to stdout"""
    print(message, file=sys.stdout, flush=True)

def log_error(message: str):
    """Log error message to stderr"""
    print(message, file=sys.stderr, flush=True)

# Create the root agent with video monitoring and UI automation tools
root_agent = Agent(
    name="luna",
    model="gemini-2.5-flash-live-preview",
    description="A multimodal AI agent that can monitor video streams, answer questions, provide information, and assist with various tasks including UI automation.",
    instruction="You are a helpful assistant that can perform a variety of tasks, from controlling the user's mouse and keyboard for desktop automation to calling third party MCPs to control the user's Spotify or Notion accounts. You can analyze screen content and respond to user queries based on the visual context.",
    tools=TOOLS
)

    