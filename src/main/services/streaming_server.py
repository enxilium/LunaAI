import os
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
)

from google.adk.runners import Runner
from google.adk.agents import LiveRequestQueue
from google.adk.agents.run_config import RunConfig
from google.adk.sessions.in_memory_session_service import InMemorySessionService

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn

from agent.agent import root_agent

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
        self.setup_routes()
        
    async def initialize_pre_warmed_components(self):
        """Pre-warm components for faster session startup"""
        global pre_warmed_runner
        
        if pre_warmed_runner is None:
            print("[STREAMING] Pre-warming Runner for faster startup...")
            pre_warmed_runner = Runner(
                app_name=APP_NAME,
                agent=root_agent,
                session_service=session_service,
            )
            print("[STREAMING] Runner pre-warming complete")
        
    def setup_routes(self):
        """Set up WebSocket routes"""
        @self.app.websocket("/ws/{client_id}")
        async def websocket_endpoint(websocket: WebSocket, client_id: str, is_audio: str = "true"):
            """Main WebSocket endpoint for audio streaming"""
            connection_start_time = time.time()
            await websocket.accept()
            active_connections[client_id] = websocket
            
            print(f"[STREAMING] Client {client_id} connected, audio mode: {is_audio}")
            
            try:
                # Start agent session (always in audio mode for Luna)
                session_start_time = time.time()
                user_id_str = str(client_id)
                live_events, live_request_queue = await self.start_agent_session(user_id_str)
                session_init_time = time.time() - session_start_time
                
                print(f"[STREAMING] Session initialized in {session_init_time:.3f}s for client {client_id}")
                
                # Start bidirectional communication tasks
                agent_to_client_task = asyncio.create_task(
                    self.agent_to_client_messaging(websocket, live_events)
                )
                client_to_agent_task = asyncio.create_task(
                    self.client_to_agent_messaging(websocket, live_request_queue)
                )
                
                total_startup_time = time.time() - connection_start_time
                print(f"[STREAMING] Total startup time: {total_startup_time:.3f}s for client {client_id}")
                
                # Wait until the websocket is disconnected or an error occurs
                tasks = [agent_to_client_task, client_to_agent_task]
                await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)
                
            except WebSocketDisconnect:
                print(f"[STREAMING] Client {client_id} disconnected")
            except Exception as e:
                print(f"[STREAMING] Error with client {client_id}: {e}")
            finally:
                # Clean up
                if live_request_queue:
                    live_request_queue.close()
                if client_id in active_connections:
                    del active_connections[client_id]
                print(f"[STREAMING] Client {client_id} disconnected")

        @self.app.get("/health")
        async def health_check():
            """Health check endpoint"""
            return {"status": "healthy", "active_connections": len(active_connections)}

    async def start_agent_session(self, user_id: str):
        """Starts an agent session with Luna AI agent"""
        global pre_warmed_runner
        
        # Use pre-warmed runner or create new one
        if pre_warmed_runner is None:
            print("[STREAMING] Creating new Runner (first time initialization)")
            pre_warmed_runner = Runner(
                app_name=APP_NAME,
                agent=root_agent,
                session_service=session_service,
            )
        else:
            print("[STREAMING] Using pre-warmed Runner")
        
        # Create a Session (this is still per-user)
        session = await session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
        )
        
        # Set response modality (AUDIO for Luna) - using proper enum import
        from google.genai.types import Modality
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

    async def agent_to_client_messaging(self, websocket: WebSocket, live_events):
        """Stream agent responses to client"""
        try:
            async for event in live_events:
                # Handle turn completion/interruption
                if event.turn_complete or event.interrupted:
                    message = {
                        "type": "status",
                        "turn_complete": event.turn_complete,
                        "interrupted": event.interrupted,
                    }
                    await websocket.send_text(json.dumps(message))
                    print(f"[AGENT TO CLIENT]: {message}")
                    continue
                
                # Extract the first part from event content
                part: Part = (
                    event.content and event.content.parts and event.content.parts[0]
                )
                if not part:
                    continue
                
                # Handle audio data
                is_audio = part.inline_data and part.inline_data.mime_type.startswith("audio/pcm")
                if is_audio:
                    audio_data = part.inline_data and part.inline_data.data
                    if audio_data:
                        message = {
                            "type": "audio",
                            "mime_type": "audio/pcm",
                            "data": base64.b64encode(audio_data).decode("ascii")
                        }
                        await websocket.send_text(json.dumps(message))
                        print(f"[AGENT TO CLIENT]: audio/pcm: {len(audio_data)} bytes.")
                        continue
                
                # Handle text data (for debugging or fallback)
                if part.text and event.partial:
                    message = {
                        "type": "text",
                        "mime_type": "text/plain",
                        "data": part.text
                    }
                    await websocket.send_text(json.dumps(message))
                    print(f"[AGENT TO CLIENT]: text/plain: {message}")
                    
        except Exception as e:
            print(f"[STREAMING] Error in agent_to_client_messaging: {e}")

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
                
                # Handle audio input
                if message_type == "audio" and mime_type == "audio/pcm":
                    # Send audio data to agent
                    decoded_data = base64.b64decode(data)
                    live_request_queue.send_realtime(Blob(data=decoded_data, mime_type=mime_type))
                    
                else:
                    print(f"[STREAMING] Unsupported message type: {message_type} with mime_type: {mime_type}")
                    
        except WebSocketDisconnect:
            print("[STREAMING] Client disconnected during messaging")
        except Exception as e:
            print(f"[STREAMING] Error in client_to_agent_messaging: {e}")

    def start_server(self, host: str = "localhost", port: int = PORT):
        """Start the FastAPI server"""
        print(f"[STREAMING] Starting Luna AI Streaming Server on {host}:{port}")
        
        # Pre-warm components before starting server
        import asyncio
        asyncio.run(self.initialize_pre_warmed_components())
        
        uvicorn.run(
            self.app,
            host=host,
            port=port,
            log_level="info",
            access_log=True
        )

# Global server instance
streaming_server = StreamingServer()

async def start_streaming_server_async(host: str = "localhost", port: int = PORT):
    """Async method to start the server"""
    
    # Pre-warm components
    await streaming_server.initialize_pre_warmed_components()
    
    config = uvicorn.Config(
        streaming_server.app,
        host=host,
        port=port,
        log_level="info",
        access_log=True
    )
    server = uvicorn.Server(config)
    await server.serve()

if __name__ == "__main__":
    streaming_server.start_server()
