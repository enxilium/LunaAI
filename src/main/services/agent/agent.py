"""
Luna AI LiveKit Agent
Integrates with your Electron app through LiveKit rooms
"""

import logging
import sys
import os
import time
import signal
import asyncio
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RoomInputOptions,
    function_tool,
    get_job_context
)
from livekit.plugins import google
from livekit import agents

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Flag to track if shutdown is in progress
shutdown_in_progress = False

# Global session reference for cleanup
active_session = None

class LunaAgent(Agent):
    def __init__(self) -> None:
        # AGENT INSTRUCTIONS: These define Luna's core personality and behavior
        # These instructions persist throughout the agent's lifecycle and define
        # the fundamental character of the agent. They are used as the system
        # message for the LLM and establish the agent's identity.
        instructions = """You are Luna, a helpful, witty, and friendly AI assistant. 
        You have access to various tools to help users with their tasks. 
        Your voice should be warm and engaging, with a lively and playful tone. 
        Talk quickly and always try to use tools when appropriate.
        
        You can help with various tasks including:
        - Answering questions
        - Getting current time and date information
        - Opening applications on the user's computer
        - Searching for information
        - Managing calendar events
        - Playing music
        - Weather information
        - File downloads
        - And much more through your integrated tools
        """

        super().__init__(
            instructions=instructions,
        )

    async def on_enter(self):
        """Called when the agent enters the room"""
        logger.info("[Luna Agent] Entering room...")
        
        # LLM INSTRUCTIONS: These are runtime/session-specific instructions
        # passed to generate_reply() for specific interactions. They can override
        # or supplement the agent's core instructions for particular responses.
        # These are temporary and contextual, used for dynamic behavior.

        
    
    @function_tool()
    def handle_conversation_end(self):
        """Handle the end of a conversation session"""
        return "Conversation ended. Thank you for using Luna AI!"
    
    


async def entrypoint(ctx: JobContext):
    """
    Main entry point for the agent.
    """
    global active_session
    logger.info(f"[Luna Agent] Joining room: {ctx.room.name}")
    
    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            model="gemini-live-2.5-flash-preview",
            voice="Aoede",
            temperature=0.8,
        )
    )
    
    # Store session reference for cleanup
    active_session = session

    await session.start(
        room=ctx.room,
        agent=LunaAgent(),
        room_input_options=RoomInputOptions(
            video_enabled=True,
        ),
    )

    await ctx.connect()

    logger.info(f"[Luna Agent] Started successfully in room {ctx.room.name}")


async def cleanup():
    """Clean up resources before exit"""
    global shutdown_in_progress, active_session
    
    if shutdown_in_progress:
        return
        
    shutdown_in_progress = True
    logger.info("[Luna Agent] Cleaning up before exit...")
    
    # Close active session if it exists
    if active_session:
        try:
            logger.info("[Luna Agent] Closing active session...")
            await active_session.close()
            logger.info("[Luna Agent] Session closed successfully")
        except Exception as e:
            logger.error(f"[Luna Agent] Error closing session: {e}")
    
    # Give a moment for cleanup to complete
    await asyncio.sleep(1)
    
    logger.info("[Luna Agent] Cleanup complete, exiting...")


def signal_handler(sig, frame):
    """Handle termination signals"""
    logger.info(f"[Luna Agent] Received signal {sig}, initiating shutdown...")
    
    # Run the cleanup in the event loop
    loop = asyncio.get_event_loop()
    if loop.is_running():
        loop.create_task(cleanup())
    else:
        loop.run_until_complete(cleanup())
    
    # Exit after cleanup
    sys.exit(0)


if __name__ == "__main__":
    # Enhanced logging for worker registration
    logging.basicConfig(level=logging.INFO)
    logger.info("[Luna Agent] Starting worker...")
    
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    if hasattr(signal, 'SIGBREAK'):  # Windows-specific signal
        signal.signal(signal.SIGBREAK, signal_handler)
    
    try:
        agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
    except KeyboardInterrupt:
        logger.info("[Luna Agent] Keyboard interrupt received, shutting down...")
        loop = asyncio.get_event_loop()
        loop.run_until_complete(cleanup())
    except Exception as e:
        logger.error(f"[Luna Agent] Error in main loop: {e}")
        loop = asyncio.get_event_loop()
        loop.run_until_complete(cleanup())
        sys.exit(1)