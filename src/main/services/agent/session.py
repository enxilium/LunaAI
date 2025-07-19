"""
Luna AI LiveKit Agent
Integrates with your Electron app through LiveKit rooms
"""

import logging
import os
import sys
import signal
import asyncio
from google.genai import types
from dotenv import load_dotenv
from luna import LunaAgent

from livekit.agents import (
    AgentSession,
    JobContext,
    RoomInputOptions,
)
from livekit.plugins import google
from livekit import agents, rtc

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def entrypoint(ctx: JobContext):
    """
    Main entry point for the agent.
    """
    logger.info(f"[Luna Agent] Joining room: {ctx.room.name}")
    
    # Initialize session with userdata for storing auth tokens
    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            model="gemini-live-2.5-flash-preview",
            voice="Aoede",
            temperature=0.8,
            _gemini_tools=[types.GoogleSearch()],
            api_key=os.getenv("GEMINI_API_KEY"),
        ),
    )
    
    await session.start(
        room=ctx.room,
        agent=LunaAgent(ctx.room),
        room_input_options=RoomInputOptions(
            video_enabled=True,
        ),
    )

    await ctx.connect()

    logger.info(f"[Luna Agent] Started successfully in room {ctx.room.name}")


if __name__ == "__main__":
    # Enhanced logging for worker registration
    logging.basicConfig(level=logging.INFO)
    logger.info("[Luna Agent] Starting worker...")
    
    try:
        agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
    except Exception as e:
        logger.error(f"[Luna Agent] Error in main loop: {e}")
        sys.exit(1)