"""
Luna AI LiveKit Agent
Integrates with your Electron app through LiveKit rooms
"""

import logging
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
        self.session.generate_reply(
            instructions="Greet the user warmly and let them know you're Luna, ready to help with any questions or tasks they have."
        )
    
    @function_tool()
    def handle_conversation_end(self):
        """Handle the end of a conversation session"""
        return "Conversation ended. Thank you for using Luna AI!"
    
    


async def entrypoint(ctx: JobContext):
    """
    Main entry point for the agent.
    """
    logger.info(f"[Luna Agent] Joining room: {ctx.room.name}")
    
    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            model="gemini-2.0-flash-exp",
            voice="Aoede",
            temperature=0.8,
        )
    )

    await session.start(
        room=ctx.room,
        agent=LunaAgent(),
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
    
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))