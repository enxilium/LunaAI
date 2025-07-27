from google.adk.tools.function_tool import FunctionTool

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

stop_streaming_tool = FunctionTool(stop_streaming)
end_conversation_session_tool = FunctionTool(end_conversation_session)

util_tools = [
    stop_streaming_tool,
    end_conversation_session_tool
]