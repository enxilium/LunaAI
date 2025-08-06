import os
from dotenv import load_dotenv
from mem0 import Memory

load_dotenv()

# MEM0_CONFIG = {
#     "llm": {
#         "provider": "gemini",
#         "config": {
#             "model": "gemini-2.5-flash",
#             "temperature": 0.2,
#             "max_tokens": 2000,
#             "top_p": 1.0
#         }
#     },
#     "embedder": {
#         "provider": "gemini",
#         "config": {
#             "model": "models/text-embedding-004",
#         }
#     },
#     "vector_store": {
#         "provider": "chroma",
#         "config": {
#             "collection_name": "memories",
#             "path": "./chroma_db",
#         }
#     }
# }

# mem0 = Memory.from_config(MEM0_CONFIG)

# def search_memory(query: str, category: str) -> dict:
#     """
#     Search through past conversations and memories

#     Possible categories:
#     - "general" for general knowledge
#     - "command" for command history
#     - "preferences" for user preferences
#     """
#     memories = mem0.search(query, user_id="default", filters={"category": category})
#     if memories:
#         memory_context = "\n".join([f"- {mem['memory']}" for mem in memories])
#         return {"status": "success", "memories": memory_context}
#     return {"status": "no_memories", "message": "No relevant memories found"}

# def save_memory(content: str, category: str) -> dict:
#     """
#     Save important information to memory
    
#     Possible categories:
#     - "general" for general knowledge
#     - "command" for command history
#     - "preferences" for user preferences
#     """
#     try:
#         mem0.add([{"role": "user", "content": content}], user_id="default", metadata={"category": category})
#         return {"status": "success", "message": "Information saved to memory"}
#     except Exception as e:
#         return {"status": "error", "message": f"Failed to save memory: {str(e)}"}

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
    
    This will gracefully close the session, clean up resources, and disconnect the user.
    Only use when you're confident the conversation has naturally ended.
    """
    # Simplified - just return a message, no complex session management
    return "Session ended gracefully. Goodbye!"

util_tools = [
    # search_memory,
    # save_memory,
    stop_streaming,
    end_conversation_session
]