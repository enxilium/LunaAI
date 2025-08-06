"""
WebSocketServer - Handles FastAPI setup, WebSocket connections, and message routing
"""
import json
import asyncio
import base64
from typing import Callable
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn

from google.genai.types import Blob

class WebSocketServer:
    """Handles WebSocket connections and message routing"""
    
    def __init__(self, agent_runner, log_info: Callable[[str], None] = None, log_error: Callable[[str], None] = None):
        self.agent_runner = agent_runner
        self.app = FastAPI(title="Luna AI Streaming Server")
        self.log_info = log_info
        self.log_error = log_error
        
        # Single connection tracking (Luna AI only has one Electron renderer)
        self.current_websocket: WebSocket = None
        self.current_client_id: str = None
        
        # Setup routes directly in constructor
        self._setup_routes()
    
    def _setup_routes(self):
        """Set up WebSocket routes"""
        
        @self.app.websocket("/ws")
        async def websocket_endpoint(websocket: WebSocket):
            """Main WebSocket endpoint for audio and video streaming"""
            await websocket.accept()
            self.current_websocket = websocket
            self.current_client_id = "luna"  # Fixed client ID since Luna is single-user
            
            try:
                live_events, live_request_queue = await self.agent_runner.start_conversation()
                
                # Create message sender callback for the agent
                async def message_sender(message: dict):
                    try:
                        await websocket.send_text(json.dumps(message))
                    except Exception as e:
                        self.log_error(f"[WEBSOCKET] Send error: {e}")
                
                # Start bidirectional communication tasks
                agent_to_client_task = asyncio.create_task(
                    self.agent_runner.process_events(live_events, message_sender)
                )
                client_to_agent_task = asyncio.create_task(
                    self._handle_client_messages(websocket, live_request_queue)
                )
                
                # Wait until the websocket is disconnected or an error occurs
                try:
                    await asyncio.wait([agent_to_client_task, client_to_agent_task])
                finally:
                    # Cancel any remaining tasks when connection closes
                    if not agent_to_client_task.done():
                        agent_to_client_task.cancel()
                    if not client_to_agent_task.done():
                        client_to_agent_task.cancel()
                    
                    # Wait for tasks to complete cancellation
                    try:
                        await asyncio.gather(agent_to_client_task, client_to_agent_task, return_exceptions=True)
                    except Exception:
                        pass  # Ignore cancellation exceptions
                
            except WebSocketDisconnect:
                self.log_info(f"[WEBSOCKET] Client luna disconnected")
            except Exception as e:
                self.log_error(f"[WEBSOCKET] Error with client luna: {e}")
            finally:
                await self.agent_runner.end_conversation()
                self.current_websocket = None
                self.current_client_id = None
                self.log_info(f"[WEBSOCKET] Client luna cleanup completed")

        @self.app.get("/health")
        async def health_check():
            """Health check endpoint"""
            return {"status": "healthy", "active_connections": 1 if self.current_websocket else 0}

    async def _handle_client_messages(self, websocket: WebSocket, live_request_queue) -> None:
        """Receive client messages and forward to agent"""
        try:
            while True:
                message_json = await websocket.receive_text()
                message = json.loads(message_json)
                
                message_type = message.get("type", "")
                mime_type = message.get("mime_type", "")
                data = message.get("data", "")
                
                # Handle session control messages
                if message_type == "stop_session":
                    self.log_info("[WEBSOCKET] Frontend requested session stop")
                    break  # Exit the message loop to trigger cleanup
                
                # Handle both audio and video data
                elif (message_type == "audio" and mime_type == "audio/pcm") or \
                     (message_type == "video" and mime_type == "image/jpeg"):
                    decoded_data = base64.b64decode(data)
                    live_request_queue.send_realtime(Blob(data=decoded_data, mime_type=mime_type))
                else:
                    self.log_error(f"[WEBSOCKET] Unsupported message: {message_type}/{mime_type}")
                    
        except WebSocketDisconnect:
            self.log_info("[WEBSOCKET] Client disconnected during messaging")
        except Exception as e:
            self.log_error(f"[WEBSOCKET] Error in message handling: {e}")

    async def start_server(self, host: str = "localhost", port: int = 8765):
        """Start the FastAPI server"""
        config = uvicorn.Config(
            self.app,
            host=host,
            port=port,
            log_level="critical",
            access_log=False,
            use_colors=False
        )
        server = uvicorn.Server(config)
        await server.serve()
