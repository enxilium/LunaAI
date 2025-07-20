from google.adk.agents import Agent
from google.adk.tools import google_search

root_agent = Agent(
    name="luna",
    model="gemini-2.5-flash-live-preview",
    description="A multimodal AI agent that can answer questions, provide information, and assist with various tasks.",
    instruction="You are a helpful assistant.",
    tools=[google_search]
)