from google.adk.tools.tool_context import ToolContext
from google.adk.tools.base_tool import BaseTool
from typing import Dict, Any, Optional
import asyncio
from .tools.tool_logger import ToolLogger
from .tools.pattern_recognizer import PatternRecognizer


def create_after_tool_callback(session_id: str, user_id: str = "default"):
    """Create a simple after_tool_callback function for logging tool executions"""
    
    tool_logger = ToolLogger()
    pattern_recognizer = PatternRecognizer(user_id=user_id)
    execution_count = 0  # Track how many tools have been executed
    
    def after_tool_callback(
        tool: BaseTool, 
        args: Dict[str, Any], 
        tool_context: ToolContext, 
        tool_response: Dict
    ) -> Optional[Dict]:
        """Log tool execution after it completes and trigger pattern recognition periodically"""
        nonlocal execution_count
        
        try:
            # Log the tool execution
            tool_logger.log_tool_execution(
                session_id=session_id,
                user_id=user_id,
                tool_name=tool.name,
                tool_input=args,
                tool_output=tool_response,
                success=True
            )
            print(f"[Tool Logger] Logged execution of '{tool.name}' for session {session_id}")
            
            # Increment execution count
            execution_count += 1
            
            # Trigger pattern recognition every 10 tool executions (non-blocking)
            if execution_count >= 1:
                print(f"[Pattern Recognition] Triggering analysis after {execution_count} executions...")
                
                # Create trigger context
                trigger_context = {
                    "trigger_type": "execution_count",
                    "execution_count": execution_count,
                    "last_tool": tool.name,
                    "session_id": session_id
                }
                
                # Run pattern recognition asynchronously without blocking
                try:
                    asyncio.create_task(
                        pattern_recognizer.recognize_patterns_async(trigger_context)
                    )
                except Exception as pattern_error:
                    print(f"[Pattern Recognition] ERROR: Failed to start pattern analysis: {pattern_error}")
                
        except Exception as e:
            print(f"[Tool Callback] ERROR: {e}")
        
        # Return None to use the original tool response
        return None
    
    return after_tool_callback
