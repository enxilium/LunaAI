#!/usr/bin/env python3
"""
Utility tools for Luna AI Agent
Memory management and tool execution helpers
"""

from typing import List, Dict, Any, Optional

from ..memory.memory_database import MemoryDatabase

# Initialize memory database - handles both memories and tool executions
memory_db = MemoryDatabase()

def search_memory(query: str) -> Dict[str, Any]:
    """
    Search through past conversations and memories. You should use this to search for any information about the user that may be relevant to the current request, and should also be called if searching Google does not work.
    If the user asks you if you remember certain information or facts, you MUST call this tool. Only say you don't remember something if this tool yields no results.
    
    Args:
        query: What to search your memories for.
        
    Returns:
        dict: {"status": "success|no_memories|error", "memories": formatted_memories, "message": Optional[error_message]}
    """
    try:
        memories = memory_db.search_similar_memories(query, min_confidence=0.3)
        
        if memories:
            # Format memories for display
            memory_context = "\n".join([
                f"- {memory['memory']} (confidence: {memory['confidence']:.2f})" 
                for memory in memories
            ])
            return {"status": "success", "memories": memory_context}
        else:
            return {"status": "no_memories", "message": "No relevant memories found"}
        
    except Exception as e:
        print(f"Error searching memory: {e}")
        return {"status": "error", "message": f"Failed to search memory: {str(e)}"}


def save_memory(text: str) -> Dict[str, Any]:
    """
    Save important information to memory. This can include any preferences the user mentions 
    as well as general context knowledge that may be useful in a future conversation.
    
    Args:
        text: The information to save to memory

    Returns:
        dict: {"status": "success|error", "message": Optional[error_message]}
    """
    try:
        memory_id = memory_db.add_memory(
            memory=text,
            confidence=0.5  # Start with medium confidence
        )
        
        return {"status": "success", "id": memory_id}
        
    except Exception as e:
        print(f"Error saving memory: {e}")
        return {"status": "error", "message": str(e)}


def get_all_memories() -> Dict[str, Any]:
    """
    Get all memories from the database.
    
    Args:
        user_id: The user ID to get memories for (maintained for compatibility)
        
    Returns:
        dict: {"status": "success|error", "memories": List[Dict], "message": Optional[error_message]}
    """
    try:
        memories = memory_db.get_memories(min_confidence=0.1)  # Get almost all memories
        
        return {"status": "success", "memories": memories, "count": len(memories)}
        
    except Exception as e:
        print(f"Error retrieving memories: {e}")
        return {"status": "error", "message": str(e), "memories": []}


def modify_memory(memory_id: int, new_text: Optional[str], new_confidence: Optional[float]) -> Dict[str, Any]:
    """
    Modify an existing memory's content or confidence.
    
    Args:
        memory_id: ID of the memory to modify
        new_text: New memory text (optional)
        new_confidence: New confidence score (optional, 0.0-1.0)
        
    Returns:
        dict: {"status": "success|error", "message": Optional[error_message]}
    """
    # Check if memory exists by trying to get it
    memories = memory_db.get_memories(min_confidence=0.0)
    memory_exists = any(m['id'] == memory_id for m in memories)
    
    if not memory_exists:
        return {"status": "error", "message": f"Memory with ID {memory_id} not found"}
    
    # Use MemoryDatabase's built-in methods where possible
    if new_confidence is not None:
        if not 0.0 <= new_confidence <= 1.0:
            return {"status": "error", "message": "Confidence must be between 0.0 and 1.0"}
        
        # Get current memory to check current confidence
        current_memory = next((m for m in memories if m['id'] == memory_id), None)
        current_conf = current_memory['confidence']
        
        if new_confidence > current_conf:
            # Reinforce to increase confidence
            factor = (new_confidence - current_conf) / (1.0 - current_conf) if current_conf < 1.0 else 0
            memory_db.reinforce_memory(memory_id, factor)
        elif new_confidence < current_conf:
            # Weaken to decrease confidence
            factor = (current_conf - new_confidence) / current_conf if current_conf > 0 else 0
            memory_db.weaken_memory(memory_id, factor)
    
    # Update text using the new method
    if new_text is not None:
        success = memory_db.update_memory_content(memory_id, new_text)
        if not success:
            return {"status": "error", "message": "Failed to update memory content"}
    
    return {"status": "success", "message": f"Memory {memory_id} updated successfully"}


def delete_memory(memory_id: int) -> Dict[str, Any]:
    """
    Permanently delete a memory from the database.
    
    Args:
        memory_id: ID of the memory to delete
        
    Returns:
        dict: {"status": "success|error", "message": Optional[error_message]}
    """
    # Check if memory exists
    memories = memory_db.get_memories(min_confidence=0.0)
    memory_exists = any(m['id'] == memory_id for m in memories)
    
    if not memory_exists:
        return {"status": "error", "message": f"Memory with ID {memory_id} not found"}
    
    # Use weaken_memory with factor 1.0 to force deletion
    result = memory_db.weaken_memory(memory_id, factor=1.0, auto_cleanup_threshold=1.0)
    
    if result == "deleted":
        return {"status": "success", "message": f"Memory {memory_id} deleted successfully"}
    else:
        return {"status": "error", "message": f"Failed to delete memory {memory_id}"}


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

# NOTE: This is a test tool.
def play_song(genre: Optional[str], song_title: Optional[str], artist: Optional[str]):
    """
    Play a song from the user's playlist. At least one of genre, song_title, or artist must be provided.
    """
    pass

    return "Playing song from user's playlist."


# Export the tools
util_tools = [
    play_song,
    search_memory,
    save_memory,
    get_all_memories,
    modify_memory,
    delete_memory,
    stop_streaming,
    end_conversation_session
]