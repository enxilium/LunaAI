import os
from dotenv import load_dotenv
from mem0 import Memory
from typing import Dict, Any, List, Optional
import asyncio

load_dotenv()

MEM0_CONFIG = {
    "llm": {
        "provider": "gemini",
        "config": {
            "model": "gemini-2.5-flash",
            "temperature": 0.2,
            "max_tokens": 2000,
            "top_p": 1.0
        }
    },
    "embedder": {
        "provider": "gemini",
        "config": {
            "model": "models/text-embedding-004",
        }
    },
    "vector_store": {
        "provider": "chroma",
        "config": {
            "collection_name": "memories",
            "path": "./assets/data/chroma_db",
        }
    }
}

mem0 = Memory.from_config(MEM0_CONFIG)

mem0.reset() # TODO: Development mode for now for testing purposes.

# TODO: Development mode - clear and populate tool execution logs with fresh test data
try:
    from .tool_logger import ToolLogger
    from datetime import datetime, timedelta
    import random
    import json
    
    print("[DEV] Clearing tool execution database...")
    logger = ToolLogger()
    logger.clear_all_logs()  # Clear existing data
    
    print("[DEV] Populating with fresh test data...")
    
    # Create realistic test data
    morning_tools = [
        {"tool_name": "google_search", "queries": ["Python best practices", "React hooks", "code review"]},
        {"tool_name": "file_operations", "actions": ["read", "write", "create"]},
        {"tool_name": "code_analysis", "inputs": ["def hello():", "useState hook", "async function"]},
    ]
    
    evening_tools = [
        {"tool_name": "google_search", "queries": ["jazz music", "movie recommendations", "cooking recipes"]},
        {"tool_name": "music_player", "actions": ["play", "pause", "next"]},
        {"tool_name": "weather_check", "locations": ["New York", "London", "Tokyo"]},
    ]
    
    # Generate data for the last 7 days
    base_time = datetime.now() - timedelta(days=7)
    session_counter = 1
    total_executions = 0
    
    for day in range(7):
        current_date = base_time + timedelta(days=day)
        
        # Morning productivity session (9-11 AM)
        if random.random() < 0.8:  # 80% chance of morning session
            session_id = f"dev_session_{session_counter}"
            session_counter += 1
            morning_start = current_date.replace(hour=9, minute=random.randint(0, 30))
            
            for i in range(random.randint(3, 6)):  # 3-6 tool executions
                tool_data = random.choice(morning_tools)
                tool_name = tool_data["tool_name"]
                
                if tool_name == "google_search":
                    query = random.choice(tool_data["queries"])
                    tool_input = {"query": query}
                    tool_output = {"results": [f"result1_{query[:10]}", f"result2_{query[:10]}"]}
                elif tool_name == "file_operations":
                    action = random.choice(tool_data["actions"])
                    tool_input = {"action": action, "file": f"project_{random.randint(1,3)}.py"}
                    tool_output = {"success": True, "content": "file content..."}
                elif tool_name == "code_analysis":
                    code = random.choice(tool_data["inputs"])
                    tool_input = {"code": code}
                    tool_output = {"suggestions": ["add docstring", "improve naming"]}
                
                success = random.random() > 0.05  # 95% success rate
                
                logger.log_tool_execution(
                    session_id=session_id,
                    user_id="dev_user",
                    tool_name=tool_name,
                    tool_input=tool_input,
                    tool_output=tool_output if success else {"error": "Operation failed"},
                    success=success,
                    error_message="Operation failed" if not success else None
                )
                total_executions += 1
        
        # Evening leisure session (7-9 PM)
        if random.random() < 0.6:  # 60% chance of evening session
            session_id = f"dev_session_{session_counter}"
            session_counter += 1
            evening_start = current_date.replace(hour=19, minute=random.randint(0, 60))
            
            for i in range(random.randint(2, 4)):  # 2-4 tool executions
                tool_data = random.choice(evening_tools)
                tool_name = tool_data["tool_name"]
                
                if tool_name == "google_search":
                    query = random.choice(tool_data["queries"])
                    tool_input = {"query": query}
                    tool_output = {"results": [f"result1_{query[:10]}", f"result2_{query[:10]}"]}
                elif tool_name == "music_player":
                    action = random.choice(tool_data["actions"])
                    tool_input = {"action": action, "track": f"track_{random.randint(1,50)}"}
                    tool_output = {"status": "playing" if action == "play" else "paused"}
                elif tool_name == "weather_check":
                    location = random.choice(tool_data["locations"])
                    tool_input = {"location": location}
                    tool_output = {"temperature": random.randint(60, 85), "condition": "sunny"}
                
                logger.log_tool_execution(
                    session_id=session_id,
                    user_id="dev_user",
                    tool_name=tool_name,
                    tool_input=tool_input,
                    tool_output=tool_output,
                    success=True
                )
                total_executions += 1
    
    print(f"[DEV] Created {total_executions} test tool executions across {session_counter-1} sessions")
    
except Exception as e:
    print(f"[DEV] Warning: Could not populate test data: {e}")
    # Don't fail the entire import if test data creation fails

# Async versions for pattern recognition system
async def search_memory(query: str, user_id: str = "default", limit: int = 10) -> List[Dict[str, Any]]:
    """
    Search through memories asynchronously.
    
    Args:
        query: Search query
        user_id: User identifier
        limit: Maximum number of results
        
    Returns:
        List of memory results
    """
    def _search_sync():
        try:
            memories = mem0.search(query, user_id=user_id, limit=limit)
            if memories and "results" in memories:
                return memories["results"]
            return []
        except Exception as e:
            print(f"Failed to search memory: {str(e)}")
            return []
    
    # Run in thread pool to avoid blocking
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _search_sync)


async def save_memory(text: str, user_id: str = "default", metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Save information to memory asynchronously.
    
    Args:
        text: Content to save
        user_id: User identifier  
        metadata: Additional metadata
        
    Returns:
        Result dictionary with success/error info
    """
    def _save_sync():
        try:
            result = mem0.add([{"role": "user", "content": text}], user_id=user_id, metadata=metadata or {})
            return {"status": "success", "id": result}
        except Exception as e:
            print(f"Failed to save memory: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    # Run in thread pool to avoid blocking
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _save_sync)


# Sync versions for tool use (backwards compatibility)
def search_memory_sync(query: str, category: str) -> dict:
    """
    Search through past conversations and memories. You should use this to search for any information
    about the user that may be relevant to the current request, and should also be called if searching Google does not work.
    If the user asks you if you remember certain information or facts, you MUST call this tool. Only say you don't remember something if this tool yields no results.

    Possible categories:
    - "general" for general knowledge
    - "command" for command history
    - "preferences" for user preferences
    """
    print("Searching for memories")
    try:
        # Use ChromaDB $and operator format for filtering
        memories = mem0.search(query, user_id="default")
        if memories and "results" in memories:
            memory_context = "\n".join([f"- {mem['memory']}" for mem in memories["results"]])
            return {"status": "success", "memories": memory_context}
        return {"status": "no_memories", "message": "No relevant memories found"}
    except Exception as e:
        print(f"Failed to search memory: {str(e)}") 
        return {"status": "error", "message": f"Failed to search memory: {str(e)}"}


def save_memory_sync(content: str, category: str) -> dict:
    """
    Save important information to memory. This can include any preferences the user mentions as well as general context knowledge that may be useful in a future conversation.
    
    Possible categories:
    - "general" for general knowledge
    - "command" for command history
    - "preferences" for user preferences
    """
    try:
        mem0.add([{"role": "user", "content": content}], user_id="default", metadata={"category": category})
        return {"status": "success", "message": "Information saved to memory"}
    except Exception as e:
        print(f"Failed to save memory: {str(e)}")
        return {"status": "error", "message": f"Failed to save memory: {str(e)}"}
    

def stop_streaming(function_name: str):
    """Stop the streaming

    Args:
        function_name: The name of the streaming function to stop.
    """
    pass


def end_conversation_session():
    """End the current conversation session gracefully when the user indicates they are finished.
    
    Use this tool when you detect that the user's conversation has naturally concluded. 
    Look for these conversational cues:
    
    **Clear Ending Signals:**
    - "Thanks, that's all I needed"
    - "Perfect, goodbye" / "Bye" / "See you later"
    - "That solved my problem, thank you"
    - "I'm done for now" / "I'm all set"
    - "Great, I have everything I need"
    
    **Satisfaction & Closure:**
    - User expresses satisfaction with your help
    - Problem has been completely resolved
    - User thanks you and doesn't ask follow-up questions
    - User indicates they're leaving or ending the session
    
    **When NOT to use:**
    - User asks follow-up questions
    - User seems to want to continue the conversation
    - You're in the middle of a multi-step task
    - User hasn't expressed satisfaction or closure
    
    This will mark the session for graceful closure after you finish your current response.
    The session will end after you complete your turn (e.g., saying "You're welcome, goodbye!").
    """
    print("ENDING CONVERSATION")
    return "Session marked for graceful closure after current response completes."

util_tools = [
    search_memory_sync,
    save_memory_sync,
    stop_streaming,
    end_conversation_session
]