from google.adk.tools.function_tool import FunctionTool

def stop_streaming(function_name: str):
    """Stop the streaming

    Args:
        function_name: The name of the streaming function to stop.
    """
    pass

stop_streaming_tool = FunctionTool(stop_streaming)

util_tools = [
    stop_streaming_tool
]