from google.adk.tools.tool_context import ToolContext
from google.adk.tools.base_tool import BaseTool
from typing import Dict, Any, Optional, Set
import asyncio
from ...memory.memory_database import MemoryDatabase

# Global set to track active pattern analysis tasks
_active_analysis_tasks: Set[asyncio.Task] = set()

def after_tool_callback(
    tool: BaseTool, 
    args: Dict[str, Any], 
    tool_context: ToolContext, 
    tool_response: Any  # Changed from Dict to Any since it's a CallToolResult object
) -> Optional[Dict]:
    """Simple after_tool_callback for logging tool executions and triggering pattern recognition"""
    
    # Skip memory-related tools as they don't provide user behavioral insights
    skip_tools = {
        "search_memory",
        "save_memory", 
        "get_all_memories",
        "modify_memory",
        "delete_memory",
        "end_conversation_session"
    }
    
    if tool.name in skip_tools:
        return None  # Skip logging and pattern analysis for memory tools
    
    # Log the tool execution with result for confidence scoring
    memory_db = MemoryDatabase()
    
    # Extract content from CallToolResult object
    serializable_result = str(tool_response.content) if hasattr(tool_response, 'content') else str(tool_response)
    
    # Extract context parameter if present
    context = args.get('context', None)
    
    memory_db.log_tool_execution(
        tool_name=tool.name,
        tool_arguments=args,
        tool_result=serializable_result,
        context=context
    )
    
    # Log the tool being analyzed (required log #1)
    from datetime import datetime
    print(f"[ANALYZING] Tool: {tool.name} | Args: {args} | Time: {datetime.now().isoformat()}")
    
    # Lazy import to avoid triggering google.genai import chain until needed
    from ...memory.pattern_recognizer import PatternRecognizer
    
    # Trigger pattern recognition (non-blocking)
    pattern_recognizer = PatternRecognizer()
    trigger_context = {
        "trigger_type": "tool_execution",
        "last_tool": tool.name,
    }
    
    # Create and track pattern analysis task
    task = asyncio.create_task(
        pattern_recognizer.recognize_patterns_async(trigger_context)
    )
    _active_analysis_tasks.add(task)
    
    # Clean up completed task from tracking set
    def cleanup_task(completed_task):
        _active_analysis_tasks.discard(completed_task)
    
    task.add_done_callback(cleanup_task)
    
    # Return None to use the original tool response
    return None


async def await_pending_analysis():
    """Await all pending pattern analysis tasks before cleanup"""
    if _active_analysis_tasks:
        await asyncio.wait_for(
            asyncio.gather(*_active_analysis_tasks, return_exceptions=True),
            timeout=20.0  # 20 second timeout
        )
        _active_analysis_tasks.clear()
