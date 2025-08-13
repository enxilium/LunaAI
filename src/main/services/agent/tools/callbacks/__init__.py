from google.adk.tools.tool_context import ToolContext
from google.adk.tools.base_tool import BaseTool
from typing import Dict, Any, Optional, Set
import asyncio
from ...memory.memory_database import MemoryDatabase
from ...memory.pattern_recognizer import PatternRecognizer

# Global set to track active pattern analysis tasks
_active_analysis_tasks: Set[asyncio.Task] = set()


def after_tool_callback(
    tool: BaseTool, 
    args: Dict[str, Any], 
    tool_context: ToolContext, 
    tool_response: Dict
) -> Optional[Dict]:
    """Simple after_tool_callback for logging tool executions and triggering pattern recognition"""
    
    # Skip memory-related tools as they don't provide user behavioral insights
    memory_tools = {
        "search_memory",
        "save_memory", 
        "get_all_memories",
        "modify_memory",
        "delete_memory"
    }
    
    if tool.name in memory_tools:
        return None  # Skip logging and pattern analysis for memory tools
    
    try:
        # Log the tool execution with result for confidence scoring
        memory_db = MemoryDatabase()
        
        memory_db.log_tool_execution(
            tool_name=tool.name,
            tool_arguments=args,
            tool_result=tool_response
        )
        print(f"[Tool Logger] Logged execution of '{tool.name}'")
        
        # Trigger pattern recognition (non-blocking)
        try:
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
            
        except Exception as pattern_error:
            print(f"[Pattern Recognition] ERROR: Failed to start pattern analysis: {pattern_error}")
        
    except Exception as e:
        print(f"[Tool Callback] ERROR: {e}")
    
    # Return None to use the original tool response
    return None


async def await_pending_analysis():
    """Await all pending pattern analysis tasks before cleanup"""
    if _active_analysis_tasks:
        print(f"[Pattern Recognition] Awaiting {len(_active_analysis_tasks)} pending analysis tasks...")
        try:
            # Wait for all active tasks with a reasonable timeout
            await asyncio.wait_for(
                asyncio.gather(*_active_analysis_tasks, return_exceptions=True),
                timeout=20.0  # 20 second timeout
            )
            print("[Pattern Recognition] All analysis tasks completed")
        except asyncio.TimeoutError:
            print("[Pattern Recognition] Analysis tasks timed out, proceeding with cleanup")
        except Exception as e:
            print(f"[Pattern Recognition] Error during analysis cleanup: {e}")
        finally:
            _active_analysis_tasks.clear()
