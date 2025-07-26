# Luna AI Streaming Server - Modular Architecture

## Overview

The streaming server has been refactored into a clean, modular architecture with well-defined separation of concerns. This eliminates the monolithic design while preserving all existing functionality.

## Architecture

### 1. `streaming_server.py` - Main Entry Point
- **Purpose**: Configuration, logging setup, and component wiring
- **Responsibilities**:
  - Configure selective logging (silence libraries, preserve explicit logs)
  - Load environment variables
  - Wire together AgentRunner and WebSocketServer components
  - Provide entry points for both sync and async server startup

### 2. `agent_runner.py` - Agent Operations Manager
- **Purpose**: Handles all agent-related operations and ADK session management
- **Responsibilities**:
  - Agent creation with MCP tools integration
  - Session management (create, cleanup)
  - ADK Runner lifecycle management
  - Event processing and TaskGroup management with robust error handling
  - Async agent-to-client messaging with graceful failure recovery

### 3. `websocket_server.py` - Network & WebSocket Manager
- **Purpose**: Handles FastAPI setup, WebSocket connections, and message routing
- **Responsibilities**:
  - FastAPI application setup
  - WebSocket connection management
  - Message parsing and routing (text, video, audio)
  - Frame rate limiting for video streams
  - Connection lifecycle management

## Key Features

### Selective Logging System
- **Library Silence**: All library output (Google ADK, FastAPI, etc.) redirected to devnull
- **Explicit Logs**: `log_info()` and `log_error()` functions send messages to original stdout/stderr
- **Node.js Integration**: Clean logs with `[PYTHON]` prefix for easy parsing

### Robust Error Handling
- **TaskGroup Protection**: Individual event processing wrapped in try-catch blocks
- **Graceful Degradation**: Server continues operating even if individual events fail
- **Connection Recovery**: WebSocket errors handled gracefully without crashing the server

### Module Import Strategy
- **Relative Imports**: All modules use relative imports within the package
- **Module Execution**: Node.js service runs as `python -m src.main.services.agent.streaming_server`
- **Path Management**: Proper Python path setup to avoid conflicts with installed packages

## Usage

### Development
The Node.js service automatically runs the streaming server as a Python module:
```bash
python -m src.main.services.agent.streaming_server
```

### Direct Testing
You can test the server directly from the project root:
```bash
.venv/Scripts/python.exe -m src.main.services.agent.streaming_server
```

## File Structure
```
src/main/services/agent/
├── streaming_server.py      # Main entry point and configuration
├── agent_runner.py          # Agent operations and session management
├── websocket_server.py      # WebSocket server and message handling
├── agent.py                 # Agent creation utilities
└── tools/                   # MCP and utility tools
    ├── __init__.py
    ├── util.py
    └── mcp/
        ├── __init__.py
        └── filesystem.py
```

## Benefits of Refactoring

1. **Maintainability**: Clear separation of concerns makes code easier to understand and modify
2. **Testability**: Individual components can be tested in isolation
3. **Modularity**: Components can be reused or replaced independently
4. **Debugging**: Issues can be traced to specific functional areas
5. **Scalability**: New features can be added to appropriate modules without affecting others

## Migration Notes

- **No Breaking Changes**: All existing functionality is preserved
- **Same Interface**: Node.js service integration remains unchanged
- **Enhanced Logging**: Improved log clarity and reduced noise
- **Better Error Handling**: More robust error recovery mechanisms
