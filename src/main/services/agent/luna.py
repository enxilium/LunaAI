import logging
import os
import sys
import signal
import asyncio
import json
from google.genai import types
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RoomInputOptions,
    function_tool,
)
from livekit.plugins import google
from livekit import agents, rtc

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
    """
    Luna AI Agent with integrated authentication for MCP services.
    
    Architecture:
    - Agent only contains tools the LLM should use directly
    - Authentication is handled transparently within each tool
    - Tokens are fetched via RPC and cached in session userdata
    - No explicit auth tools exposed to the LLM
    """
    
    def __init__(self, room: rtc.Room) -> None:

        instructions = """You are Luna, a helpful, witty, and friendly AI assistant. 
        You have access to various tools to help users with their tasks. 
        Your voice should be warm and engaging, with a lively and playful tone. 
        Talk quickly and always try to use tools when appropriate.
        
        BE DECISIVE AND ACTION-ORIENTED:
        - Do NOT ask for permission before using tools - just use them
        - Do NOT ask for clarification unless absolutely necessary
        - When you need context from the user's screen, silently start screen sharing and then immediately proceed with the original request
        - NEVER announce that you're starting screen sharing - just do it and continue
        - Make reasonable assumptions and take action
        - If something doesn't work, briefly mention it and suggest an alternative
        - Complete the user's request in ONE response - don't break it into multiple steps or conversations
        
        AVOID being overly cautious, hesitant, or asking too many questions. Users want you to be helpful and proactive, not cautious and slow.

        When in doubt, always use the Google Search tool to find information to back up your response.
        """

        super().__init__(
            instructions=instructions,
        )
        
        # Store room reference for RPC calls
        self._room = room

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
        return
        

    @function_tool()
    async def start_screen_share(self, enable: bool = True):
        """
        Start or stop the user's screen sharing by sending an RPC request to the client. Always use this tool first when the user makes a request that requires additional context from the screen, so you can analyze it first before executing the original request. Do not ask for permission to start screen sharing, just do it automatically when needed.
        
        Args:
            enable (bool): True to start screen sharing, False to stop it.
        """
        try:
            # Find the client participant (non-agent participant)
            client_participant = None
            for participant in self._room.remote_participants.values():
                if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD:
                    client_participant = participant
                    break
            
            if not client_participant:
                logger.warning("[Luna Agent] No client participant found for screen sharing")
                return f"Unable to start screen sharing: No client connected"
            
            # Send RPC request to client
            logger.info(f"[Luna Agent] Sending screen share RPC to {client_participant.identity}")
            
            payload = {"enable": enable}
            response = await self._room.local_participant.perform_rpc(
                destination_identity=client_participant.identity,
                method="start_screen_share",
                payload=json.dumps(payload)
            )
            
            response_data = json.loads(response)
            if response_data.get("success"):
                action = "started" if enable else "stopped"
                logger.info(f"[Luna Agent] Screen sharing {action} successfully")
                return f"Screen sharing {action} successfully"
            else:
                error_msg = response_data.get("error", "Unknown error")
                logger.error(f"[Luna Agent] Screen sharing failed: {error_msg}")
                return f"Screen sharing failed: {error_msg}"
                
        except Exception as e:
            logger.error(f"[Luna Agent] Error initiating screen sharing: {e}")
            return f"Unable to start screen sharing: {str(e)}"

    @function_tool()
    async def type_text(self, text: str, clear_first: bool = False):
        """
        Type text into the currently focused text field by sending an RPC request to the client. 

        IMPORTANT: When the user asks to reply to emails, messages, or answer questions they're looking at,
        you should FIRST call start_screen_share() to see the content, THEN call this function to type the response.
        Do this in the SAME response without announcing it to the user.

        TEXT FORMATTING RULES:
        - Use actual newline characters (\n) for line breaks - they will be converted to Enter key presses
        - Add empty lines (\n\n) between paragraphs for proper spacing
        
        Multi-paragraph text:
        "First paragraph here.\n\nSecond paragraph with proper spacing.\n\nThird paragraph continues the thought."
        
        Simple message:
        "Hello! This is a single line message."

        EXAMPLES:
        - "Reply to this email" -> Call start_screen_share(), analyze content, then type_text() with properly formatted response
        - "Answer this question" -> Call start_screen_share(), see question, then type_text() with formatted answer  
        - "Type Happy Birthday" -> Just call type_text() directly, no screen sharing needed
        
        Args:
            text (str): The text to type into the focused element. Use \n for line breaks and \n\n for paragraph spacing.
            clear_first (bool): Whether to clear the current content before typing new text.
        """
        try:
            # Find the client participant (non-agent participant)
            client_participant = None
            for participant in self._room.remote_participants.values():
                if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD:
                    client_participant = participant
                    break
            
            if not client_participant:
                logger.warning("[Luna Agent] No client participant found for text typing")
                return f"Unable to type text: No client connected"

            # Clear text field first if requested
            if clear_first:
                logger.info(f"[Luna Agent] Clearing text field first")
                clear_payload = {"action": "clear"}
                clear_response = await self._room.local_participant.perform_rpc(
                    destination_identity=client_participant.identity,
                    method="text_typing",
                    payload=json.dumps(clear_payload)
                )
                
                clear_data = json.loads(clear_response)
                if not clear_data.get("success"):
                    logger.error(f"[Luna Agent] Failed to clear text field: {clear_data.get('message')}")
                    return f"Failed to clear text field: {clear_data.get('message', 'Unknown error')}"

            # Type the text
            logger.info(f"[Luna Agent] Typing text to {client_participant.identity}: {len(text)} characters")
            
            payload = {"action": "type", "text": text}
            response = await self._room.local_participant.perform_rpc(
                destination_identity=client_participant.identity,
                method="text_typing",
                payload=json.dumps(payload)
            )
            
            response_data = json.loads(response)
            if response_data.get("success"):
                logger.info(f"[Luna Agent] Text typed successfully")
                return f"Done! I typed: {text}"
            else:
                error_msg = response_data.get("message", "Unknown error")
                logger.error(f"[Luna Agent] Text typing failed: {error_msg}")
                return f"I tried to type the text but it didn't work. Make sure you have a text field selected."
                
        except Exception as e:
            logger.error(f"[Luna Agent] Error typing text: {e}")
            return f"Something went wrong while typing. Let me try again or try clicking on a text field first."