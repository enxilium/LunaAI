"""
Luna AI Streaming Server - Main entry point
Handles configuration, logging setup, and component wiring
"""
import os
import sys
import logging
import warnings
from pathlib import Path
from dotenv import load_dotenv

# Add the agent directory to Python path for proper imports
agent_dir = Path(__file__).parent.parent
if str(agent_dir) not in sys.path:
    sys.path.insert(0, str(agent_dir))

# Suppress known deprecation warnings from third-party libraries
# These warnings are from library internals and will be resolved when the libraries upgrade

# 1. Websockets deprecation warnings from uvicorn's internal use of deprecated websockets APIs
warnings.filterwarnings(
    "ignore",
    message="websockets.legacy is deprecated",
    category=DeprecationWarning,
    module="websockets.legacy"
)
warnings.filterwarnings(
    "ignore", 
    message="websockets.server.WebSocketServerProtocol is deprecated",
    category=DeprecationWarning,
    module="uvicorn.protocols.websockets.websockets_impl"
)

# 2. Google ADK deprecation warning from internal Gemini session usage
# The ADK library internally uses deprecated session.send() method
# This will be resolved when Google ADK upgrades to use the newer specific methods
warnings.filterwarnings(
    "ignore",
    message=r"The `session\.send` method is deprecated.*",
    category=DeprecationWarning,
    module="google.adk.models.gemini_llm_connection"
)


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
    # sys.stderr = devnull # TODO:Re-enable

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
    # Create AgentRunner instance with loggers in constructor
    agent_runner = AgentRunner(log_info, log_error)
    
    # Create WebSocketServer with loggers directly
    websocket_server = WebSocketServer(agent_runner, log_info, log_error)
    
    return websocket_server

async def start_streaming_server_async(host: str = "localhost", port: int = PORT):
    """Async method to start the server with minimal output"""
    streaming_server = await create_server()
    await streaming_server.start_server(host, port)

if __name__ == "__main__":
    import asyncio
    asyncio.run(start_streaming_server_async())
