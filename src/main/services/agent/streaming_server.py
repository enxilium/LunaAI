import os
import sys
import logging

# Configure logging FIRST, before any other imports that might generate output
# Global references to original streams (before redirection)
original_stdout = None
original_stderr = None

def configure_logging():
    """Configure selective logging - silence libraries but preserve our explicit logs"""
    global original_stdout, original_stderr
    
    # Save original streams before redirection
    original_stdout = sys.stdout
    original_stderr = sys.stderr
    
    # Suppress ALL warnings and library output
    import warnings
    warnings.filterwarnings("ignore")
    
    # Set environment variables to suppress all possible debug output and subprocess inheritance
    os.environ['GOOGLE_ADK_DEBUG'] = 'false'
    os.environ['GOOGLE_ADK_LOG_LEVEL'] = 'CRITICAL'
    os.environ['PYTHONWARNINGS'] = 'ignore'
    os.environ['PYTHONIOENCODING'] = 'utf-8'  # Prevent encoding issues
    
    # Completely disable all logging from all libraries
    logging.disable(logging.CRITICAL)
    
    # Redirect library stdout/stderr to devnull (but preserve originals for our logs)
    devnull = open(os.devnull, 'w')
    sys.stdout = devnull
    sys.stderr = devnull

# Configure logging immediately, before any other imports
configure_logging()

def log_info(message: str):
    """Log info message to original stdout (visible to Node.js)"""
    if original_stdout:
        print(message, file=original_stdout, flush=True)
    else:
        print(message, file=sys.stdout, flush=True)

def log_error(message: str):
    """Log error message to original stderr (visible to Node.js)"""
    if original_stderr:
        print(message, file=original_stderr, flush=True)
    else:
        print(message, file=sys.stderr, flush=True)

# Now import everything else after logging is configured
import json
import asyncio
import base64
import uuid
import time
from typing import Dict, Optional
from pathlib import Path
from dotenv import load_dotenv

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

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn

# Add the parent directory to Python path to enable absolute imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import async agent creation function instead of root_agent
from agent.agent import get_agent_async

# Load environment variables
load_dotenv()

# Application constants
APP_NAME = "luna_ai_streaming"
PORT = 8765

# Session service
session_service = InMemorySessionService()

# Active connections tracking
active_connections: Dict[str, WebSocket] = {}

# Pre-warmed session components (for faster initialization)
pre_warmed_runner = None
pre_warmed_session = None

# Session cache for repeat users (keeps sessions warm)
session_cache: Dict[str, tuple] = {}  # user_id -> (session, last_used_time)
SESSION_CACHE_TTL = 300  # 5 minutes

class StreamingServer:
    def __init__(self):
        self.app = FastAPI(title="Luna AI Streaming Server")
        self.last_video_frame_time = 0
        self.video_frame_interval = 0.2  # Minimum 200ms between frames (5fps max)
        self.setup_routes()
        
    async def initialize_pre_warmed_components(self):
        """Pre-warm components for faster session startup"""
        global pre_warmed_runner
        
        if pre_warmed_runner is None:
            # Create agent asynchronously to properly initialize MCP tools
            async_agent = await get_agent_async()
            
            pre_warmed_runner = Runner(
                app_name=APP_NAME,
                agent=async_agent,
                session_service=session_service,
            )
        
    def setup_routes(self):
        """Set up WebSocket routes"""
        @self.app.websocket("/ws/{client_id}")
        async def websocket_endpoint(websocket: WebSocket, client_id: str):
            """Main WebSocket endpoint for audio and video streaming"""
            await websocket.accept()
            active_connections[client_id] = websocket
            
            try:
                # Start agent session (multimodal: audio + video for Luna)
                session_start_time = time.time()
                user_id_str = str(client_id)
                live_events, live_request_queue = await self.start_agent_session(user_id_str)
                session_init_time = time.time() - session_start_time
                
                # Start bidirectional communication tasks
                agent_to_client_task = asyncio.create_task(
                    self.agent_to_client_messaging(websocket, live_events)
                )
                client_to_agent_task = asyncio.create_task(
                    self.client_to_agent_messaging(websocket, live_request_queue)
                )
                
                # Wait until the websocket is disconnected or an error occurs
                tasks = [agent_to_client_task, client_to_agent_task]
                await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)
                
            except WebSocketDisconnect:
                log_info(f"[STREAMING] Client {client_id} disconnected")
            except Exception as e:
                log_error(f"[STREAMING] Error with client {client_id}: {e}")
            finally:
                # Clean up
                if live_request_queue:
                    live_request_queue.close()
                if client_id in active_connections:
                    del active_connections[client_id]
                log_info(f"[STREAMING] Client {client_id} disconnected")

        @self.app.get("/health")
        async def health_check():
            """Health check endpoint"""
            return {"status": "healthy", "active_connections": len(active_connections)}

    async def start_agent_session(self, user_id: str):
        """Starts an agent session with Luna AI agent"""
        global pre_warmed_runner
        
        try:
            async_agent = await get_agent_async()
        except Exception as e:
            log_error(f"[STREAMING] Failed to create async agent: {e}")
            # Fall back to a minimal agent without MCP tools
            from google.adk.agents import Agent
            from google.adk.tools import google_search
            from .tools.util import util_tools
            
            async_agent = Agent(
                name="luna_fallback",
                model="gemini-2.5-flash-live-preview",
                description="A fallback AI agent with basic functionality.",
                instruction="You are a helpful assistant. Some advanced features may not be available in this fallback mode.",
                tools=[google_search] + util_tools
            )
            log_info("[STREAMING] Created fallback agent without MCP tools")
        
        # Use pre-warmed runner or create new one with async agent
        if pre_warmed_runner is None:
            log_info("[STREAMING] Creating new Runner (first time initialization)")
            pre_warmed_runner = Runner(
                app_name=APP_NAME,
                agent=async_agent,
                session_service=session_service,
            )
        else:
            log_info("[STREAMING] Updating Runner with fresh async agent")
            # Create a new runner with the fresh async agent to avoid MCP connection reuse issues
            pre_warmed_runner = Runner(
                app_name=APP_NAME,
                agent=async_agent,
                session_service=session_service,
            )
        
        # Create a Session (this is still per-user)
        session = await session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
        )
        
        # Set response modality (AUDIO for Luna)
        modality = [Modality.AUDIO]
        run_config = RunConfig(response_modalities=modality)
        
        # Create a LiveRequestQueue for this session
        live_request_queue = LiveRequestQueue()
        
        # Start agent session - using user_id and session_id instead of deprecated session parameter
        live_events = pre_warmed_runner.run_live(
            user_id=user_id,
            session_id=session.id,
            live_request_queue=live_request_queue,
            run_config=run_config,
        )
        
        return live_events, live_request_queue

    def classify_event(self, event):
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

    async def agent_to_client_messaging(self, websocket: WebSocket, live_events):
        """Stream agent responses to client with comprehensive event logging and robust error handling"""
        try:
            async for event in live_events:
                try:
                    # Log notable events based on ADK patterns
                    event_classification = self.classify_event(event)
                    if "MEDIA_CONTENT" not in event_classification:
                        log_info(f"[AGENT_EVENT] {event_classification}")

                    # Handle turn completion/interruption
                    if hasattr(event, 'turn_complete') and hasattr(event, 'interrupted'):
                        if event.turn_complete or event.interrupted:
                            message = {
                                "type": "status",
                                "turn_complete": event.turn_complete,
                                "interrupted": event.interrupted,
                            }
                            try:
                                await websocket.send_text(json.dumps(message))
                            except Exception as ws_e:
                                log_error(f"[STREAMING] WebSocket send error: {ws_e}")
                            continue
                    
                    # Safely extract the first part from event content
                    part: Part = None
                    try:
                        if hasattr(event, 'content') and event.content and hasattr(event.content, 'parts') and event.content.parts:
                            part = event.content.parts[0]
                    except (AttributeError, IndexError, TypeError) as content_e:
                        log_error(f"[STREAMING] Error accessing event content: {content_e}")
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
                                message = {
                                    "type": "audio",
                                    "mime_type": "audio/pcm",
                                    "data": base64.b64encode(audio_data).decode("ascii")
                                }
                                try:
                                    await websocket.send_text(json.dumps(message))
                                except Exception as ws_e:
                                    log_error(f"[STREAMING] WebSocket send error for audio: {ws_e}")
                                continue
                    except Exception as audio_e:
                        log_error(f"[STREAMING] Error processing audio data: {audio_e}")
                        continue
                
                except Exception as inner_e:
                    # Catch any individual event processing errors and continue with next event
                    log_error(f"[STREAMING] Error processing individual event: {type(inner_e).__name__}: {inner_e}")
                    continue
                
        except asyncio.CancelledError:
            log_info("[STREAMING] Agent-to-client messaging cancelled")
            raise  # Re-raise CancelledError to properly handle task cancellation
        except Exception as e:
            # Handle TaskGroup and other async errors more gracefully
            error_type = type(e).__name__
            log_error(f"[STREAMING] Error in agent_to_client_messaging ({error_type}): {e}")
            
            # For TaskGroup errors, log additional context
            if "TaskGroup" in error_type or "unhandled errors" in str(e):
                log_error("[STREAMING] TaskGroup error detected - this may be due to MCP tool failures or ADK session issues")
                
            # Don't re-raise - let the connection cleanup handle this gracefully
            # This prevents the entire WebSocket connection from crashing

    async def client_to_agent_messaging(self, websocket: WebSocket, live_request_queue: LiveRequestQueue):
        """Receive client messages and forward to agent"""
        try:
            while True:
                # Receive and decode JSON message
                message_json = await websocket.receive_text()
                message = json.loads(message_json)
                
                message_type = message.get("type", "")
                mime_type = message.get("mime_type", "")
                data = message.get("data", "")
                
                # Handle audio input (PCM audio)
                if message_type == "audio" and mime_type == "audio/pcm":
                    # Send audio data to agent
                    decoded_data = base64.b64decode(data)
                    live_request_queue.send_realtime(Blob(data=decoded_data, mime_type=mime_type))
                
                # Handle video frame input (JPEG images for desktop capture)
                elif message_type == "video" and mime_type == "image/jpeg":
                    # Frame rate limiting to prevent queue buildup
                    current_time = time.time()
                    if current_time - self.last_video_frame_time < self.video_frame_interval:
                        # Drop frame to prevent queue buildup
                        continue
                    
                    self.last_video_frame_time = current_time
                    
                    # Send video frame to agent - optimized path
                    decoded_data = base64.b64decode(data)
                    live_request_queue.send_realtime(Blob(data=decoded_data, mime_type=mime_type))
                else:
                    log_error(f"[STREAMING] Unsupported message type: {message_type} with mime_type: {mime_type}")
                    
        except WebSocketDisconnect:
            log_info("[STREAMING] Client disconnected during messaging")
        except Exception as e:
            log_error(f"[STREAMING] Error in client_to_agent_messaging: {e}")

    def start_server(self, host: str = "localhost", port: int = PORT):
        """Start the FastAPI server in silent mode"""
        # Pre-warm components before starting server
        import asyncio
        asyncio.run(self.initialize_pre_warmed_components())
        
        # Start uvicorn in completely silent mode
        uvicorn.run(
            self.app,
            host=host,
            port=port,
            log_level="critical",  # Only critical errors
            access_log=False,      # No access log spam
            use_colors=False       # No color codes
        )

# Global server instance
streaming_server = StreamingServer()

async def start_streaming_server_async(host: str = "localhost", port: int = PORT):
    """Async method to start the server with minimal output"""
    
    # Pre-warm components
    await streaming_server.initialize_pre_warmed_components()
    
    config = uvicorn.Config(
        streaming_server.app,
        host=host,
        port=port,
        log_level="critical",  # Only critical errors
        access_log=False,      # No access log spam
        use_colors=False       # No color codes
    )
    server = uvicorn.Server(config)
    await server.serve()

if __name__ == "__main__":
    streaming_server.start_server()
