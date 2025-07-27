"""
WebSocketServer - Handles FastAPI setup, WebSocket connections, and message routing
"""
import json
import asyncio
import base64
import time
from typing import Callable
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn

from google.genai.types import Blob

class WebSocketServer:
    """Handles WebSocket connections and message routing"""
    
    def __init__(self, agent_runner):
        self.agent_runner = agent_runner
        self.app = FastAPI(title="Luna AI Streaming Server")
        
        # Single connection tracking (Luna AI only has one Electron renderer)
        self.current_websocket: WebSocket = None
        self.current_client_id: str = None
        
        # Logger functions (will be injected by main)
        self.log_info = None
        self.log_error = None
        
        self.setup_routes()
    
    def terminate_client_connection(self, client_id: str):
        """Terminate the current client connection gracefully"""
        if self.current_websocket:
            try:
                # Send a graceful closure message before closing
                asyncio.create_task(self._send_session_end_message(self.current_websocket, client_id))
            except Exception as e:
                if self.log_error:
                    self.log_error(f"[WEBSOCKET] Error terminating connection for {client_id}: {e}")
    
    async def _send_session_end_message(self, websocket: WebSocket, client_id: str):
        """Send session end message and close connection gracefully"""
        try:
            # Send session end notification
            end_message = {
                "type": "session_end",
                "reason": "user_initiated",
                "message": "Session ended gracefully"
            }
            await websocket.send_text(json.dumps(end_message))
            
            # Small delay to ensure message is sent
            await asyncio.sleep(0.1)
            
            # Close the connection
            await websocket.close(code=1000, reason="Session ended by user")
            
            if self.log_info:
                self.log_info(f"[WEBSOCKET] Gracefully closed connection for {client_id}")
                
        except Exception as e:
            if self.log_error:
                self.log_error(f"[WEBSOCKET] Error sending session end message to {client_id}: {e}")
            # Force close if graceful close fails
            try:
                await websocket.close()
            except:
                pass
    
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
            self.current_websocket = websocket
            self.current_client_id = client_id
            
            try:
                live_events, live_request_queue = await self.agent_runner.start_conversation()
                
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
                await self.agent_runner.end_conversation()
                
                # Clear connection references
                self.current_websocket = None
                self.current_client_id = None
                    
                if self.log_info:
                    self.log_info(f"[WEBSOCKET] Client {client_id} cleanup completed")

        @self.app.get("/health")
        async def health_check():
            """Health check endpoint"""
            connection_count = 1 if self.current_websocket else 0
            return {"status": "healthy", "active_connections": connection_count}

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
        # Start uvicorn in completely silent mode
        uvicorn.run(
            self.app,
            host=host,
            port=port,
            log_level="critical",  # Only critical errors
            access_log=False,      # No access log spam
            use_colors=False       # No color codes
        )
