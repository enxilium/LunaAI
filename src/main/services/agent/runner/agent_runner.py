"""
AgentRunner - Handles all agent-related operations and ADK session management
"""
import json
import asyncio
import time
from typing import Dict, Optional, Tuple, Callable
from pathlib import Path

from google.genai.types import (
    Part,
    Content,
    Blob,
    Modality,
)

from google.adk.runners import Runner
from google.adk.agents import LiveRequestQueue
from google.adk.agents.run_config import RunConfig
from google.adk.sessions.in_memory_session_service import InMemorySessionService

# Import async agent creation function from parent agent module
from ..agent import get_agent_async

# Application constants
APP_NAME = "luna_ai_streaming"

class AgentRunner:
    """Handles agent creation, session management, and ADK event processing"""
    
    def __init__(self):
        # Session service
        self.session_service = InMemorySessionService()
        
        # Pre-warmed session components (for faster initialization)
        self.pre_warmed_runner = None
        
        # Session cache for repeat users (keeps sessions warm)
        self.session_cache: Dict[str, tuple] = {}  # user_id -> (session, last_used_time)
        self.session_cache_ttl = 300  # 5 minutes
        
        # Logger functions (will be injected by main)
        self.log_info = None
        self.log_error = None
    
    def set_loggers(self, log_info: Callable[[str], None], log_error: Callable[[str], None]):
        """Inject logging functions"""
        self.log_info = log_info
        self.log_error = log_error
        
    async def initialize_components(self) -> None:
        """Pre-warm components for faster session startup"""
        if self.pre_warmed_runner is None:
            # Create agent asynchronously with MCP tools
            async_agent = await get_agent_async()
            
            self.pre_warmed_runner = Runner(
                app_name=APP_NAME,
                agent=async_agent,
                session_service=self.session_service,
            )
    
    async def create_session(self, user_id: str) -> Tuple:
        """Creates an agent session and returns (live_events, live_request_queue)"""
        # Create agent asynchronously with all tools including MCP
        async_agent = await get_agent_async()
        
        # Use pre-warmed runner or create new one with async agent
        if self.pre_warmed_runner is None:
            if self.log_info:
                self.log_info("[AGENT] Creating new Runner (first time initialization)")
            self.pre_warmed_runner = Runner(
                app_name=APP_NAME,
                agent=async_agent,
                session_service=self.session_service,
            )
        else:
            if self.log_info:
                self.log_info("[AGENT] Updating Runner with fresh async agent")
            # Create a new runner with the fresh async agent to avoid MCP connection reuse issues
            self.pre_warmed_runner = Runner(
                app_name=APP_NAME,
                agent=async_agent,
                session_service=self.session_service,
            )
        
        # Create a Session (this is still per-user)
        session = await self.session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
        )
        
        # Set response modality (AUDIO for Luna)
        modality = [Modality.AUDIO]
        run_config = RunConfig(response_modalities=modality)
        
        # Create a LiveRequestQueue for this session
        live_request_queue = LiveRequestQueue()
        
        # Start agent session - using user_id and session_id instead of deprecated session parameter
        live_events = self.pre_warmed_runner.run_live(
            user_id=user_id,
            session_id=session.id,
            live_request_queue=live_request_queue,
            run_config=run_config,
        )
        
        return live_events, live_request_queue

    def classify_event(self, event) -> str:
        """Classify event type and content based on ADK documentation patterns"""
        author = getattr(event, 'author', 'unknown')
        
        # Check for control signals first
        if hasattr(event, 'turn_complete') and event.turn_complete:
            return f"TURN_COMPLETE from {author}"
        if hasattr(event, 'interrupted') and event.interrupted:
            return f"INTERRUPTED from {author}"
        
        # Check if event has content
        if hasattr(event, 'content') and event.content and hasattr(event.content, 'parts') and event.content.parts:
            # Check for function calls (tool requests)
            if hasattr(event, 'get_function_calls'):
                try:
                    function_calls = event.get_function_calls()
                    if function_calls:
                        call_names = [call.name for call in function_calls if hasattr(call, 'name')]
                        return f"TOOL_CALL from {author}: {', '.join(call_names)}"
                except:
                    pass
            
            # Check for function responses (tool results)
            if hasattr(event, 'get_function_responses'):
                try:
                    function_responses = event.get_function_responses()
                    if function_responses:
                        response_names = [resp.name for resp in function_responses if hasattr(resp, 'name')]
                        return f"TOOL_RESULT from {author}: {', '.join(response_names)}"
                except:
                    pass
            
            # Check for text content
            first_part = event.content.parts[0]
            if hasattr(first_part, 'text') and first_part.text:
                is_partial = getattr(event, 'partial', False)
                text_preview = first_part.text[:50] + "..." if len(first_part.text) > 50 else first_part.text
                if is_partial:
                    return f"STREAMING_TEXT from {author}: '{text_preview}'"
                else:
                    return f"COMPLETE_TEXT from {author}: '{text_preview}'"
            
            # Check for other content types
            if hasattr(first_part, 'inline_data') and first_part.inline_data:
                mime_type = getattr(first_part.inline_data, 'mime_type', 'unknown')
                data_size = len(getattr(first_part.inline_data, 'data', b''))
                return f"MEDIA_CONTENT from {author}: {mime_type} ({data_size} bytes)"
        
        # Check for actions (state/artifact updates)
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
                return f"ACTION from {author}: {', '.join(actions)}"
        
        # Check for final response indicator
        if hasattr(event, 'is_final_response') and callable(event.is_final_response):
            try:
                if event.is_final_response():
                    return f"FINAL_RESPONSE from {author}"
            except:
                pass
        
        # Default case
        return f"OTHER_EVENT from {author}"

    async def process_events(self, live_events, message_sender: Callable) -> None:
        """Process ADK events and send messages via callback with comprehensive event logging and robust error handling"""
        try:
            async for event in live_events:
                try:
                    # Log notable events based on ADK patterns
                    event_classification = self.classify_event(event)
                    if "MEDIA_CONTENT" not in event_classification and self.log_info:
                        self.log_info(f"[AGENT_EVENT] {event_classification}")

                    # Handle turn completion/interruption
                    if hasattr(event, 'turn_complete') and hasattr(event, 'interrupted'):
                        if event.turn_complete or event.interrupted:
                            message = {
                                "type": "status",
                                "turn_complete": event.turn_complete,
                                "interrupted": event.interrupted,
                            }
                            try:
                                await message_sender(message)
                            except Exception as ws_e:
                                if self.log_error:
                                    self.log_error(f"[AGENT] Message send error: {ws_e}")
                            continue
                    
                    # Safely extract the first part from event content
                    part: Part = None
                    try:
                        if hasattr(event, 'content') and event.content and hasattr(event.content, 'parts') and event.content.parts:
                            part = event.content.parts[0]
                    except (AttributeError, IndexError, TypeError) as content_e:
                        if self.log_error:
                            self.log_error(f"[AGENT] Error accessing event content: {content_e}")
                        continue
                    
                    if not part:
                        continue
                    
                    # Handle audio data with robust error checking
                    try:
                        is_audio = (hasattr(part, 'inline_data') and 
                                   part.inline_data and 
                                   hasattr(part.inline_data, 'mime_type') and 
                                   part.inline_data.mime_type.startswith("audio/pcm"))
                        
                        if is_audio:
                            audio_data = getattr(part.inline_data, 'data', None)
                            if audio_data:
                                import base64
                                message = {
                                    "type": "audio",
                                    "mime_type": "audio/pcm",
                                    "data": base64.b64encode(audio_data).decode("ascii")
                                }
                                try:
                                    await message_sender(message)
                                except Exception as ws_e:
                                    if self.log_error:
                                        self.log_error(f"[AGENT] Message send error for audio: {ws_e}")
                                continue
                    except Exception as audio_e:
                        if self.log_error:
                            self.log_error(f"[AGENT] Error processing audio data: {audio_e}")
                        continue
                
                except Exception as inner_e:
                    # Catch any individual event processing errors and continue with next event
                    if self.log_error:
                        self.log_error(f"[AGENT] Error processing individual event: {type(inner_e).__name__}: {inner_e}")
                    continue
                
        except asyncio.CancelledError:
            if self.log_info:
                self.log_info("[AGENT] Event processing cancelled")
            raise  # Re-raise CancelledError to properly handle task cancellation
        except Exception as e:
            # Handle TaskGroup and other async errors more gracefully
            error_type = type(e).__name__
            if self.log_error:
                self.log_error(f"[AGENT] Error in process_events ({error_type}): {e}")
                
                # For TaskGroup errors, log additional context
                if "TaskGroup" in error_type or "unhandled errors" in str(e):
                    self.log_error("[AGENT] TaskGroup error detected - this may be due to MCP tool failures or ADK session issues")
            
            # Don't re-raise - let the connection cleanup handle this gracefully
            # This prevents the entire WebSocket connection from crashing
