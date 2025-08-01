"""
Luna AI Streaming Server - Main entry point
Handles configuration, logging setup, and component wiring
"""
import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv

# Configure logging FIRST, before any other imports that might generate output
# Global references to original streams (before redirection)
original_stdout = None
original_stderr = None

def configure_logging():
    """Configure selective logging - silence libraries but preserve our explicit logs"""
    global original_stdout, original_stderr
    
    original_stdout = sys.stdout
    original_stderr = sys.stderr
    
    devnull = open(os.devnull, 'w')

    # sys.stdout = devnull
    # sys.stderr = devnull

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

from .agent_runner import AgentRunner
from .websocket_server import WebSocketServer

load_dotenv()

PORT = 8765

async def create_server():
    """Create and configure the server components"""
    # Create AgentRunner instance first (regular constructor)
    agent_runner = AgentRunner()
    
    # Then initialize async components
    await agent_runner.initialize()
    
    agent_runner.set_loggers(log_info, log_error)
    
    websocket_server = WebSocketServer(agent_runner)
    websocket_server.set_loggers(log_info, log_error)
    
    return websocket_server

async def start_streaming_server_async(host: str = "localhost", port: int = PORT):
    """Async method to start the server with minimal output"""
    streaming_server = await create_server()
    await streaming_server.start_server_async(host, port)

if __name__ == "__main__":
    import asyncio
    asyncio.run(start_streaming_server_async())
