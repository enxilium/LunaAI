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
import json
from dataclasses import dataclass
from typing import Dict, Any, Optional
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RoomInputOptions,
    function_tool,
    RunContext,
    get_job_context,
    mcp
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

@dataclass
class LunaSessionData:
    """Data structure for storing session-specific information including auth tokens"""
    auth_tokens: Dict[str, str] = None  # service_name -> token
    user_preferences: Dict[str, Any] = None
    session_id: str = None
    
    def __post_init__(self):
        if self.auth_tokens is None:
            self.auth_tokens = {}
        if self.user_preferences is None:
            self.user_preferences = {}

class LunaAgent(Agent):
    """
    Luna AI Agent with integrated authentication for MCP services.
    
    Architecture:
    - Agent only contains tools the LLM should use directly
    - Authentication is handled transparently within each tool
    - Tokens are fetched via RPC and cached in session userdata
    - No explicit auth tools exposed to the LLM
    """
    
    def __init__(self) -> None:
        # AGENT INSTRUCTIONS: These define Luna's core personality and behavior
        # These instructions persist throughout the agent's lifecycle and define
        # the fundamental character of the agent. They are used as the system
        # message for the LLM and establish the agent's identity.
        instructions = """You are Luna, a helpful, witty, and friendly AI assistant. 
        You have access to various tools to help users with their tasks. 
        Your voice should be warm and engaging, with a lively and playful tone. 
        Talk quickly and always try to use tools when appropriate.
        
        When using external services, the tools will automatically handle authentication - 
        you don't need to fetch tokens manually, just call the service tools directly.
        """

        super().__init__(
            instructions=instructions,
        )

    async def on_enter(self):
        """Called when the agent enters the room"""
        logger.info("[Luna Agent] Entering room...")
        
        # Set up event listeners for speech completion detection
        self.session.on("speech_created", self._on_speech_created)
        
    @function_tool()
    def handle_conversation_end(self):
        """
        Handle the end of a conversation session. Should be called when the user signals there's nothing else to be done.
        """
        # Generate a farewell message and monitor when it completes
        speech_handle = self.session.generate_reply(
            "Say goodbye to the user and let them know to reach out if they need anything else.",
            tool_choice="none",  # Prevent further tool calls
        )
        
        # Schedule cleanup after speech completes
        asyncio.create_task(self._cleanup_after_speech(speech_handle))

    def _on_speech_created(self, event):
        """Handle speech creation events to monitor completion"""
        speech_handle = event.speech_handle
        
        # If this speech was created by our conversation end tool, monitor its completion
        if hasattr(self, '_awaiting_conversation_end') and self._awaiting_conversation_end:
            asyncio.create_task(self._monitor_farewell_speech(speech_handle))
    
    async def _monitor_farewell_speech(self, speech_handle):
        """Monitor the farewell speech and cleanup when complete"""
        try:
            await speech_handle
            logger.info("[Luna Agent] Farewell speech completed via event monitoring")
            self._awaiting_conversation_end = False
            
            # Brief delay for audio completion
            await asyncio.sleep(1.0)
            
            # Graceful session cleanup
            if hasattr(self, 'session') and self.session:
                await self.session.aclose()
                logger.info("[Luna Agent] Session closed after farewell")
                
        except Exception as e:
            logger.error(f"[Luna Agent] Error monitoring farewell speech: {e}")
            self._awaiting_conversation_end = False
    
    async def _cleanup_after_speech(self, speech_handle):
        """Wait for speech to complete, then gracefully end the session"""
        try:
            # Wait for the speech to finish
            await speech_handle
            logger.info("[Luna Agent] Farewell speech completed, initiating session cleanup...")
            
            # Give a brief moment for audio to finish playing
            await asyncio.sleep(1.0)
            
            # Gracefully close the session
            if hasattr(self, 'session') and self.session:
                await self.session.aclose()
                logger.info("[Luna Agent] Session closed gracefully")
            
        except Exception as e:
            logger.error(f"[Luna Agent] Error during graceful cleanup: {e}")
    

async def entrypoint(ctx: JobContext):
    """
    Main entry point for the agent.
    """
    global active_session
    logger.info(f"[Luna Agent] Joining room: {ctx.room.name}")
    
    # Initialize session with userdata for storing auth tokens
    session = AgentSession[LunaSessionData](
        llm=google.beta.realtime.RealtimeModel(
            model="gemini-live-2.5-flash-preview",
            voice="Aoede",
            temperature=0.8,
        ),
        userdata=LunaSessionData(),
        # Note: We'll create our own MCP servers dynamically with auth
        # mcp_servers will be empty initially
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