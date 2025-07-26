"""
WebSocketServer - Handles FastAPI setup, WebSocket connections, and message routing
"""
import json
import asyncio
import base64
import time
from typing import Dict, Callable
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn

from google.genai.types import Blob

class WebSocketServer:
    """Handles WebSocket connections and message routing"""
    
    def __init__(self, agent_runner):
        self.agent_runner = agent_runner
        self.app = FastAPI(title="Luna AI Streaming Server")
        
        # Active connections tracking
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Video frame rate limiting
        self.last_video_frame_time = 0
        self.video_frame_interval = 0.2  # Minimum 200ms between frames (5fps max)
        
        # Logger functions (will be injected by main)
        self.log_info = None
        self.log_error = None
        
        self.setup_routes()
    
    def set_loggers(self, log_info: Callable[[str], None], log_error: Callable[[str], None]):
        """Inject logging functions"""
        self.log_info = log_info
        self.log_error = log_error
    
    def setup_routes(self):
        """Set up WebSocket routes"""
        
        @self.app.websocket("/ws/{client_id}")
        async def websocket_endpoint(websocket: WebSocket, client_id: str):
            """Main WebSocket endpoint for audio and video streaming"""
            await websocket.accept()
            self.active_connections[client_id] = websocket
            
            try:
                # Start agent session (multimodal: audio + video for Luna)
                session_start_time = time.time()
                user_id_str = str(client_id)
                live_events, live_request_queue = await self.agent_runner.create_session(user_id_str)
                session_init_time = time.time() - session_start_time
                
                # Create message sender callback for the agent
                async def message_sender(message: dict):
                    """Send message to WebSocket client"""
                    try:
                        await websocket.send_text(json.dumps(message))
                    except Exception as e:
                        if self.log_error:
                            self.log_error(f"[WEBSOCKET] Send error: {e}")
                
                # Start bidirectional communication tasks
                agent_to_client_task = asyncio.create_task(
                    self.agent_runner.process_events(live_events, message_sender)
                )
                client_to_agent_task = asyncio.create_task(
                    self.handle_client_messages(websocket, live_request_queue)
                )
                
                # Wait until the websocket is disconnected or an error occurs
                tasks = [agent_to_client_task, client_to_agent_task]
                await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)
                
            except WebSocketDisconnect:
                if self.log_info:
                    self.log_info(f"[WEBSOCKET] Client {client_id} disconnected")
            except Exception as e:
                if self.log_error:
                    self.log_error(f"[WEBSOCKET] Error with client {client_id}: {e}")
            finally:
                # Clean up
                if live_request_queue:
                    live_request_queue.close()
                if client_id in self.active_connections:
                    del self.active_connections[client_id]
                if self.log_info:
                    self.log_info(f"[WEBSOCKET] Client {client_id} disconnected")

        @self.app.get("/health")
        async def health_check():
            """Health check endpoint"""
            return {"status": "healthy", "active_connections": len(self.active_connections)}

    async def handle_client_messages(self, websocket: WebSocket, live_request_queue) -> None:
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
                    if self.log_error:
                        self.log_error(f"[WEBSOCKET] Unsupported message type: {message_type} with mime_type: {mime_type}")
                    
        except WebSocketDisconnect:
            if self.log_info:
                self.log_info("[WEBSOCKET] Client disconnected during messaging")
        except Exception as e:
            if self.log_error:
                self.log_error(f"[WEBSOCKET] Error in handle_client_messages: {e}")

    async def start_server_async(self, host: str = "localhost", port: int = 8765):
        """Start the FastAPI server asynchronously"""
        # Pre-warm agent components
        await self.agent_runner.initialize_components()
        
        config = uvicorn.Config(
            self.app,
            host=host,
            port=port,
            log_level="critical",  # Only critical errors
            access_log=False,      # No access log spam
            use_colors=False       # No color codes
        )
        server = uvicorn.Server(config)
        await server.serve()
    
    def start_server(self, host: str = "localhost", port: int = 8765):
        """Start the FastAPI server in sync mode"""
        # Pre-warm components before starting server
        import asyncio
        asyncio.run(self.agent_runner.initialize_components())
        
        # Start uvicorn in completely silent mode
        uvicorn.run(
            self.app,
            host=host,
            port=port,
            log_level="critical",  # Only critical errors
            access_log=False,      # No access log spam
            use_colors=False       # No color codes
        )
