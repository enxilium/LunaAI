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

# Now import our modules after logging is configured
# Add the parent directory to Python path to enable absolute imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from .agent_runner import AgentRunner
from .websocket_server import WebSocketServer

# Load environment variables
load_dotenv()

# Application constants
PORT = 8765

def create_server():
    """Create and configure the server components"""
    # Create agent runner
    agent_runner = AgentRunner()
    agent_runner.set_loggers(log_info, log_error)
    
    # Create WebSocket server with agent runner
    websocket_server = WebSocketServer(agent_runner)
    websocket_server.set_loggers(log_info, log_error)
    
    return websocket_server

# Global server instance
streaming_server = create_server()

async def start_streaming_server_async(host: str = "localhost", port: int = PORT):
    """Async method to start the server with minimal output"""
    await streaming_server.start_server_async(host, port)

if __name__ == "__main__":
    streaming_server.start_server()
