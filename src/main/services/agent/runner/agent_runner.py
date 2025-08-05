"""
AgentRunner - Handles all agent-related operations and ADK session management
"""
import asyncio
from typing import Dict, Optional, Tuple, Callable
from pathlib import Path

from google.genai.types import (
    Part,
    Modality,
)

from google.adk.runners import Runner
from google.adk.agents import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.sessions import InMemorySessionService
from google.adk.artifacts import InMemoryArtifactService
from google.genai import types

# Import async agent creation function from parent agent module
from ..agent import get_agent_async

# Application constants
APP_NAME = "LUNA"

class AgentRunner:
    """
    Handles agent creation, session management, and ADK event processing.
    """
    
    def __init__(self):
        """Initialize AgentRunner with basic setup. Call initialize() after construction for async setup."""
        self.session_service = InMemorySessionService()
        self.artifact_service = InMemoryArtifactService()
        
        # These will be set during initialize()
        self.current_session = None
        self.agent = None
        self.runner = None
        
        self.live_request_queue = LiveRequestQueue()
        self.runConfig = RunConfig(
            response_modalities=[Modality.AUDIO],
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

        self.log_info = None
        self.log_error = None
        
        # Flag to track when end_conversation_session tool has been called
        self.pendingClose = False
    
    async def initialize(self):
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
    

    def set_loggers(self, log_info: Callable[[str], None], log_error: Callable[[str], None]):
        """
        Inject logging functions from streaming server.
        """
        self.log_info = log_info
        self.log_error = log_error
    

    async def start_conversation(self) -> Tuple:
        """
        Begins a conversation and returns (live_events, live_request_queue)
        """
        
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
                    self.log_info(f"[AGENT_EVENT] {event_result['log_message']}")

        # End the conversation after processing all events.  
        await self.end_conversation()
    

    def classify_event(self, event) -> dict:
        """
        Classify event type and handle all processing logic, returning structured data for process_events
        """
        author = getattr(event, 'author', 'unknown')
        
        # Handle turn completion/interruption events
        if (hasattr(event, 'turn_complete') and event.turn_complete) or (hasattr(event, 'interrupted') and event.interrupted):
            # Check if we should close connection after turn completes
            if self.pendingClose and hasattr(event, 'turn_complete') and event.turn_complete:
                return {
                    "type": "close_connection",
                    "log_message": f"TURN_COMPLETE from {author} - CLOSING_CONNECTION",
                    "websocket_message": {
                        "type": "status",
                        "turn_complete": True,
                        "interrupted": False,
                        "close_connection": True
                    }
                }
            
            return {
                "type": "status",
                "log_message": f"TURN_COMPLETE from {author}" if hasattr(event, 'turn_complete') else f"INTERRUPTED from {author}",
                "websocket_message": {
                    "type": "status",
                    "turn_complete": hasattr(event, 'turn_complete'),
                    "interrupted": hasattr(event, 'interrupted'),
                }
            }
        
        # Handle error events
        if hasattr(event, 'error') and event.error:
            error_type = getattr(event.error, 'type', 'unknown')
            error_message = getattr(event.error, 'message', 'no message')[:50]
            return {
                "type": "log_only",
                "log_message": f"ERROR from {author}: {error_type} - {error_message}"
            }
        
        # Handle session state events
        if hasattr(event, 'session_state'):
            state = getattr(event.session_state, 'status', 'unknown')
            return {
                "type": "log_only",
                "log_message": f"SESSION_STATE from {author}: {state}"
            }
        
        # Handle tool execution events
        if hasattr(event, 'tool_execution'):
            tool_name = getattr(event.tool_execution, 'tool_name', 'unknown')
            status = getattr(event.tool_execution, 'status', 'unknown')
            
            # Check for end_conversation_session tool execution
            if tool_name == "end_conversation_session":
                self.pendingClose = True
                return {
                    "type": "log_only",
                    "log_message": f"TOOL_EXECUTION from {author}: {tool_name} - {status} - PENDING_CLOSE_SET"
                }
            
            return {
                "type": "log_only",
                "log_message": f"TOOL_EXECUTION from {author}: {tool_name} - {status}"
            }
        
        # Handle model processing events
        if hasattr(event, 'model_processing'):
            status = getattr(event.model_processing, 'status', 'unknown')
            return {
                "type": "log_only",
                "log_message": f"MODEL_PROCESSING from {author}: {status}"
            }
        
        # Handle plugin events
        if hasattr(event, 'plugin_event'):
            plugin_name = getattr(event.plugin_event, 'name', 'unknown')
            event_type = getattr(event.plugin_event, 'type', 'unknown')
            return {
                "type": "log_only",
                "log_message": f"PLUGIN_EVENT from {author}: {plugin_name} - {event_type}"
            }
        
        # Handle memory events
        if hasattr(event, 'memory_operation'):
            operation = getattr(event.memory_operation, 'type', 'unknown')
            return {
                "type": "log_only",
                "log_message": f"MEMORY_OPERATION from {author}: {operation}"
            }
        
        # Handle user input events
        if hasattr(event, 'user_input'):
            input_type = getattr(event.user_input, 'type', 'unknown')
            return {
                "type": "log_only",
                "log_message": f"USER_INPUT from {author}: {input_type}"
            }
        
        # Handle system events
        if hasattr(event, 'system_event'):
            event_type = getattr(event.system_event, 'type', 'unknown')
            return {
                "type": "log_only",
                "log_message": f"SYSTEM_EVENT from {author}: {event_type}"
            }
        
        # Handle function calls (tool requests)
        if hasattr(event, 'get_function_calls'):
            try:
                function_calls = event.get_function_calls()
                if function_calls:
                    call_names = [call.name for call in function_calls if hasattr(call, 'name')]
                    
                    # Check for end_conversation_session tool call
                    if any(name == "end_conversation_session" for name in call_names):
                        self.pendingClose = True
                        return {
                            "type": "log_only",
                            "log_message": f"TOOL_CALL from {author}: {', '.join(call_names)} - PENDING_CLOSE_SET"
                        }
                    
                    return {
                        "type": "log_only",
                        "log_message": f"TOOL_CALL from {author}: {', '.join(call_names)}"
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
                            "log_message": f"TOOL_RESULT from {author}: {', '.join(response_names)} - PENDING_CLOSE_SET"
                        }
                    
                    return {
                        "type": "log_only",
                        "log_message": f"TOOL_RESULT from {author}: {', '.join(response_names)}"
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
                        "log_message": f"AUDIO_CONTENT from {author}: {mime_type} ({data_size} bytes)",
                        "websocket_message": {
                            "type": "audio",
                            "mime_type": "audio/pcm",
                            "data": base64.b64encode(audio_data).decode("ascii")
                        }
                    }
                except (AttributeError, IndexError) as e:
                    return {
                        "type": "log_only",
                        "log_message": f"AUDIO_CONTENT_ERROR from {author}: Failed to process audio data - {e}"
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
            if hasattr(event.actions, 'memory_save') and event.actions.memory_save:
                actions.append("memory_save")
            if hasattr(event.actions, 'context_update') and event.actions.context_update:
                actions.append("context_update")
            if actions:
                return {
                    "type": "log_only",
                    "log_message": f"ACTION from {author}: {', '.join(actions)}"
                }
        
        # Handle streaming events
        if hasattr(event, 'streaming') and event.streaming:
            stream_type = getattr(event.streaming, 'type', 'unknown')
            return {
                "type": "log_only",
                "log_message": f"STREAMING from {author}: {stream_type}"
            }
        
        # Handle final response indicator
        if hasattr(event, 'is_final_response') and callable(event.is_final_response):
            try:
                if event.is_final_response():
                    return {
                        "type": "log_only",
                        "log_message": f"FINAL_RESPONSE from {author}"
                    }
            except:
                pass
        
        # Default case - include diagnostic information
        event_metadata = []
        if hasattr(event, 'timestamp'):
            event_metadata.append(f"timestamp={getattr(event, 'timestamp', 'unknown')}")
        if hasattr(event, 'event_id'):
            event_metadata.append(f"id={getattr(event, 'event_id', 'unknown')}")
        if hasattr(event, 'event_type'):
            event_metadata.append(f"type={getattr(event, 'event_type', 'unknown')}")
        
        metadata_str = f" ({', '.join(event_metadata)})" if event_metadata else ""
        event_attrs = [attr for attr in dir(event) if not attr.startswith('_') and not callable(getattr(event, attr, None))]
        attrs_preview = ', '.join(event_attrs[:5])  # Show first 5 attributes
        
        return {
            "type": "log_only",
            "log_message": f"OTHER_EVENT from {author}: attrs=[{attrs_preview}]{metadata_str}"
        }
