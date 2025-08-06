"""
AgentRunner - Handles all agent-related operations and ADK session management
"""
import warnings
from typing import Dict, Optional, Tuple, Callable
from pathlib import Path

from google.adk.runners import Runner
from google.adk.agents import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.sessions import InMemorySessionService
from google.adk.artifacts import InMemoryArtifactService
from google.genai import types
from google.genai.types import Modality

# Import async agent creation function from parent agent module
from ..agent import get_agent_async

# Application constants
APP_NAME = "LUNA"

class AgentRunner:
    """
    Handles agent creation, session management, and ADK event processing.
    """
    
    def __init__(self, log_info: Callable[[str], None] = None, log_error: Callable[[str], None] = None):
        """Initialize AgentRunner with basic setup. Call initialize() after construction for async setup."""
        self.session_service = InMemorySessionService()
        self.artifact_service = InMemoryArtifactService()
        
        # These will be set during initialize()
        self.current_session = None
        self.agent = None
        self.runner = None
        
        self.live_request_queue = LiveRequestQueue()
        # Set response modality (AUDIO for Luna) - matching old commit pattern
        modality = [Modality.AUDIO]
        self.runConfig = RunConfig(
            response_modalities=modality,
            speech_config=types.SpeechConfig(
                language_code="en-US", #TODO: Update to dynamic.
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Aoede" #TODO: Update to dynamic.
                    )
                ),
            ),
            support_cfc=True,
            streaming_mode=StreamingMode.BIDI,
        )

        self.log_info = log_info
        self.log_error = log_error

        # Flag to track when end_conversation_session tool has been called
        self.pendingClose = False
    
    async def _initialize(self):
        """Async initialization - call this after creating AgentRunner instance"""
        self.current_session = await self.session_service.create_session(
            app_name=APP_NAME,
            user_id="default",
            state={}
        )

        self.agent = await get_agent_async()

        self.runner = Runner(
            app_name=APP_NAME,
            agent=self.agent,
            session_service=self.session_service,
            artifact_service=self.artifact_service
        )

    async def start_conversation(self) -> Tuple:
        """
        Begins a conversation and returns (live_events, live_request_queue)
        """
        self.log_info("[AGENT] Starting conversation session")

        await self._initialize()
        
        live_events = self.runner.run_live(
            user_id="default",
            session_id=self.current_session.id,
            live_request_queue=self.live_request_queue,
            run_config=self.runConfig,
        )

        return live_events, self.live_request_queue
    
    async def end_conversation(self):
        """
        Ends the current conversation and cleans up resources.
        """
        await self.session_service.delete_session(
            app_name=APP_NAME,
            user_id="default",
            session_id=self.current_session.id
        )
    
    async def process_events(self, live_events, message_sender: Callable) -> None:
        """
        Process ADK events using classify_event for all logic and send messages via callback
        """
        async for event in live_events:
            event_result = self.classify_event(event)

            match event_result["type"]:
                case "log_only":
                    self.log_info(f"[AGENT_EVENT] {event_result['log_message']}")
                    continue

                case "audio":
                    # Skip logging audio chunks
                    await message_sender(event_result["websocket_message"])

                case "status":
                    self.log_info(f"[AGENT_EVENT] {event_result['log_message']}")
                    await message_sender(event_result["websocket_message"])

                case "close_connection":
                    self.log_info(f"[AGENT_EVENT] {event_result['log_message']}")
                    await message_sender(event_result["websocket_message"])
                    break
                    
                case _:
                    continue

        # End the conversation after processing all events.
        # Note: Only clean up if we didn't break due to close_connection
        # If pendingClose is True, cleanup should happen via WebSocket server

    def classify_event(self, event) -> dict:
        """
        Classify event type and handle all processing logic, returning structured data for process_events
        """
        if (hasattr(event, 'turn_complete') and event.turn_complete):
            if self.pendingClose:
                return {
                    "type": "close_connection",
                    "log_message": "TURN_COMPLETE - CLOSING_CONNECTION",
                    "websocket_message": {
                        "status": "close_connection",
                    }
                }
            else:
                return {
                    "type": "status",
                    "log_message": "TURN_COMPLETE",
                    "websocket_message": {
                        "status": "turn_complete"
                    }
                }
        
        if hasattr(event, 'interrupted') and event.interrupted:
            if self.pendingClose:
                self.pendingClose = False # In case user wants to make an additional request.
            
            return {
                    "type": "status",
                    "log_message": "INTERRUPTED",
                    "websocket_message": {
                        "status": "interrupted"
                    }
                }
        
        # Handle error events (ADK uses error_code and error_message)
        if (hasattr(event, 'error_code') and event.error_code) or (hasattr(event, 'error_message') and event.error_message):
            error_code = getattr(event, 'error_code', 'unknown')
            error_message = getattr(event, 'error_message', 'no message')[:50]
            return {
                "type": "log_only",
                "log_message": f"ERROR: {error_code} - {error_message}"
            }
        
        # Handle function calls (tool requests)
        if hasattr(event, 'get_function_calls') and event.get_function_calls():
            try:
                function_calls = event.get_function_calls()
                call_names = [call.name for call in function_calls if hasattr(call, 'name')]
                
                return {
                    "type": "log_only",
                    "log_message": f"TOOL_CALL: {', '.join(call_names)}"
                }
            except:
                pass
        
        # Handle function responses (tool results)
        if hasattr(event, 'get_function_responses'):
            try:
                function_responses = event.get_function_responses()
                if function_responses:
                    response_names = [resp.name for resp in function_responses if hasattr(resp, 'name')]
                    
                    # Check for end_conversation_session tool response
                    if any(name == "end_conversation_session" for name in response_names):
                        self.pendingClose = True
                        return {
                            "type": "log_only",
                            "log_message": f"TOOL_RESULT: {', '.join(response_names)} - PENDING_CLOSE_SET"
                        }
                    
                    return {
                        "type": "log_only",
                        "log_message": f"TOOL_RESULT: {', '.join(response_names)}"
                    }
            except:
                pass
        
        # Handle audio content (main content type for AUDIO modality)
        if hasattr(event, 'content') and event.content and hasattr(event.content, 'parts') and event.content.parts:
            first_part = event.content.parts[0]
            if hasattr(first_part, 'inline_data') and first_part.inline_data:
                mime_type = getattr(first_part.inline_data, 'mime_type', 'unknown')
                data_size = len(getattr(first_part.inline_data, 'data', b''))
                
                # Process audio data for WebSocket transmission
                try:
                    audio_data = first_part.inline_data.data
                    import base64
                    return {
                        "type": "audio",
                        "log_message": f"AUDIO_CONTENT: {mime_type} ({data_size} bytes)",
                        "websocket_message": {
                            "type": "audio",
                            "mime_type": "audio/pcm",
                            "data": base64.b64encode(audio_data).decode("ascii")
                        }
                    }
                except (AttributeError, IndexError) as e:
                    return {
                        "type": "log_only",
                        "log_message": f"AUDIO_CONTENT_ERROR: Failed to process audio data - {e}"
                    }
        
        # Handle actions (state/artifact updates)
        if hasattr(event, 'actions') and event.actions:
            actions = []
            if hasattr(event.actions, 'state_delta') and event.actions.state_delta:
                actions.append("state_delta")
            if hasattr(event.actions, 'artifact_delta') and event.actions.artifact_delta:
                actions.append("artifact_delta")
            if hasattr(event.actions, 'transfer_to_agent') and event.actions.transfer_to_agent:
                actions.append(f"transfer_to_{event.actions.transfer_to_agent}")
            if hasattr(event.actions, 'escalate') and event.actions.escalate:
                actions.append("escalate")
            if actions:
                return {
                    "type": "log_only",
                    "log_message": f"ACTION: {', '.join(actions)}"
                }
        
        # Handle final response indicator
        if hasattr(event, 'is_final_response') and callable(event.is_final_response):
            try:
                if event.is_final_response():
                    return {
                        "type": "log_only",
                        "log_message": f"FINAL_RESPONSE"
                    }
            except:
                pass

        return {
            "type": "general",
            "log_message": f"GENERAL_EVENT: {event}",
        }