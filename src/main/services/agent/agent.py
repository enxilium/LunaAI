from google.adk.agents import Agent
from google.adk.tools import google_search
from google.adk.agents import LiveRequestQueue
from google.genai import Client
from google.genai.types import GenerateContentConfig
from google.adk.tools.function_tool import FunctionTool
from google.genai import types as genai_types

import asyncio
import sys
from typing import AsyncGenerator, Dict, Any

def log_info(message: str):
    """Log info message to stdout"""
    print(message, file=sys.stdout, flush=True)

def log_error(message: str):
    """Log error message to stderr"""
    print(message, file=sys.stderr, flush=True)

# async def monitor_video_stream(input_stream: LiveRequestQueue) -> AsyncGenerator[str, None]:
#     """Monitor desktop video stream for changes and activity."""
#     log_info("[AGENT] Starting video stream monitoring...")
#     client = Client()
    
#     prompt_text = (
#         "Analyze this desktop screenshot. Describe any significant UI elements, "
#         "applications, or activities you can see. If this appears to be different "
#         "from previous frames, note what has changed. Keep responses concise."
#     )
    
#     last_description = None
#     frame_count = 0
    
#     while True:
#         last_valid_req = None
        
#         # Get the latest video frame, discarding older ones
#         while input_stream._queue.qsize() != 0:
#             try:
#                 live_req = await input_stream.get()
                
#                 if (live_req.blob is not None and 
#                     live_req.blob.mime_type == "image/jpeg"):
#                     last_valid_req = live_req
#                     frame_count += 1
#             except Exception as e:
#                 log_error(f"[AGENT] Error getting frame: {e}")
#                 break
        
#         # Process the most recent frame if available
#         if last_valid_req is not None:
#             log_info(f"[AGENT] Processing video frame #{frame_count}")
            
#             try:
#                 # Create image part from the video frame
#                 image_part = genai_types.Part.from_bytes(
#                     data=last_valid_req.blob.data, 
#                     mime_type=last_valid_req.blob.mime_type
#                 )
                
#                 contents = genai_types.Content(
#                     role="user",
#                     parts=[image_part, genai_types.Part.from_text(prompt_text)],
#                 )
                
#                 # Analyze the frame
#                 response = await client.models.generate_content_async(
#                     model="gemini-2.5-flash",
#                     contents=contents,
#                     config=genai_types.GenerateContentConfig(
#                         system_instruction=(
#                             "You are a desktop monitoring assistant. Analyze desktop "
#                             "screenshots and report on UI changes, activities, and significant events."
#                         )
#                     ),
#                 )
                
#                 current_description = response.candidates[0].content.parts[0].text
                
#                 # Only yield if this is significantly different from the last description
#                 if not last_description:
#                     last_description = current_description
#                     yield f"Desktop monitoring started. Current state: {current_description}"
#                 elif _is_significantly_different(last_description, current_description):
#                     last_description = current_description
#                     yield f"Desktop change detected: {current_description}"
#                     log_info(f"[AGENT] Video change detected: {current_description}")
                    
#             except Exception as e:
#                 log_error(f"[AGENT] Error processing video frame: {e}")
#                 yield f"Error processing video frame: {str(e)}"
        
#         # Wait before checking for new frames
#         await asyncio.sleep(1.0)

# def _is_significantly_different(old_desc: str, new_desc: str) -> bool:
#     """Simple heuristic to determine if two descriptions are significantly different."""
#     if not old_desc or not new_desc:
#         return True
    
#     # Basic word-based comparison
#     old_words = set(old_desc.lower().split())
#     new_words = set(new_desc.lower().split())
    
#     # Calculate Jaccard similarity
#     intersection = len(old_words.intersection(new_words))
#     union = len(old_words.union(new_words))
    
#     similarity = intersection / union if union > 0 else 0
    
#     # Consider it significantly different if similarity is below threshold
#     return similarity < 0.7

# async def complex_ui_task(input_stream: LiveRequestQueue) -> AsyncGenerator[Dict[str, Any], None]:
#     """
#     Perform a complex UI task that requires multiple steps and user interaction.
#     Analyzes video stream of user's desktop and executes mouse/keyboard commands iteratively.
    
#     Yields structured commands for mouse control and keyboard typing until the task is complete.
#     """
#     client = Client()
    
#     # Get the initial user request
#     initial_request = await input_stream.get()
#     user_task = initial_request.text if hasattr(initial_request, 'text') else str(initial_request)
    
#     # Initialize task completion tracking
#     task_complete = False
#     max_iterations = 50  # Prevent infinite loops
#     iteration_count = 0
    
#     yield {
#         "type": "status",
#         "message": f"Starting UI automation task: {user_task}",
#         "iteration": iteration_count
#     }
    
#     while not task_complete and iteration_count < max_iterations:
#         log_info(f"[AGENT] Starting iteration {iteration_count + 1}")
#         iteration_count += 1
        
#         # Get current video frame from stream
#         try:
#             current_frame = await input_stream.get()
            
#             # Define the response schema for structured output
#             response_schema = {
#                 "type": "object",
#                 "properties": {
#                     "action_type": {
#                         "type": "string",
#                         "enum": ["mouse_move", "mouse_click", "keyboard_type", "wait", "complete"]
#                     },
#                     "reasoning": {
#                         "type": "string",
#                         "description": "Brief explanation of why this action"
#                     },
#                     "details": {
#                         "type": "object",
#                         "properties": {
#                             "x": {"type": "number"},
#                             "y": {"type": "number"}, 
#                             "button": {"type": "string", "enum": ["left", "right"]},
#                             "text": {"type": "string"},
#                             "duration": {"type": "number"},
#                             "success": {"type": "boolean"},
#                             "summary": {"type": "string"}
#                         }
#                     }
#                 },
#                 "required": ["action_type", "reasoning", "details"]
#             }
            
#             # Analyze current screen state and determine next action
#             analysis_prompt = f"""
#             I am helping a user with this task: "{user_task}"
            
#             I'm looking at their current desktop screen (iteration {iteration_count}).
            
#             Analyze what I can see and determine the next specific action I should take.
            
#             For mouse_move/mouse_click: include x, y coordinates
#             For mouse_click: also include button ("left" or "right")  
#             For keyboard_type: include text to type
#             For wait: include duration in seconds
#             For complete: include success (true/false) and summary
            
#             Be very specific with coordinates. Ensure any typing is preceded by proper focus actions.
#             """

#             contents = genai_types.Content(
#                 role="user",
#                 parts=[
#                     genai_types.Part.from_bytes(current_frame.data, mime_type=current_frame.mime_type),
#                     genai_types.Part.from_text(analysis_prompt)
#                 ]
#             )
            
#             # Send analysis request with structured output
#             response = await client.models.generate_content(
#                 model="gemini-2.5-flash",
#                 contents=contents,
#                 config=GenerateContentConfig(
#                     response_schema=response_schema,
#                     response_mime_type="application/json",
#                     system_instruction="You are a vision-based AI assistant that performs complex UI automation tasks by analyzing screen content and executing precise mouse and keyboard commands."
#                 )
#             )
            
#             # Parse the structured response
#             command = response.json()
            
#             # Check if task is complete
#             if command.get("action_type") == "complete":
#                 task_complete = True
#                 yield {
#                     "type": "completion",
#                     "success": command["details"].get("success", True),
#                     "summary": command["details"].get("summary", "Task completed"),
#                     "iteration": iteration_count
#                 }
#                 break
            
#             # Yield the command for execution
#             yield {
#                 "type": "command",
#                 "action_type": command["action_type"],
#                 "reasoning": command.get("reasoning", ""),
#                 "details": command.get("details", {}),
#                 "iteration": iteration_count
#             }
            
#             # Small delay to allow action to complete before next analysis
#             await asyncio.sleep(0.5)
            
#         except Exception as e:
#             yield {
#                 "type": "error",
#                 "message": f"Error in iteration {iteration_count}: {str(e)}",
#                 "iteration": iteration_count
#             }
#             await asyncio.sleep(1)  # Wait before retry
    
#     # If we hit max iterations without completion
#     if not task_complete:
#         yield {
#             "type": "timeout",
#             "message": f"Task did not complete within {max_iterations} iterations",
#             "iteration": iteration_count
#         }

# def stop_streaming(function_name: str):
#     """Stop the streaming

#     Args:
#         function_name: The name of the streaming function to stop.
#     """
#     pass

# Create the root agent with video monitoring and UI automation tools
root_agent = Agent(
    name="luna",
    model="gemini-2.5-flash-live-preview",
    description="A multimodal AI agent that can monitor video streams, answer questions, provide information, and assist with various tasks including UI automation.",
    instruction="You are a helpful assistant that can monitor desktop video streams, perform complex UI automation tasks, and respond to user queries. You can analyze screen content continuously and execute precise mouse and keyboard commands when needed.",
    tools=[
        google_search, 
        # complex_ui_task,
        # FunctionTool(stop_streaming)
    ]
)

