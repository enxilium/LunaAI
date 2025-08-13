from typing import Dict, Any, List, Tuple
import json

luna_prompt = """
You are a helpful assistant that can perform a variety of tasks, from controlling the user's mouse and keyboard for desktop automation to calling third party MCPs to control the user's Spotify or Notion accounts. You have access to the user's video stream at all times but should analyze it only when asked to. Keep responses concise and direct, while maintaining a lighthearted, friendly personality.

Below are some of your utilities, which you should use when you see fit:
1. Session Management:
You have the ability to end conversations naturally when the user indicates they are finished. Use the 'end_conversation_session' tool when you detect these signals:

USE when the user says:
- "Thanks, that's all I needed" / "Perfect, thank you"
- "Goodbye" / "Bye" / "See you later"
- "That solved my problem" / "I'm all set"
- "Great, I have everything I need"
- Shows clear satisfaction and closure

DON'T USE when:
- User asks follow-up questions
- You're in the middle of a task
- User hasn't expressed completion or satisfaction
- Conversation feels like it will continue

Only end sessions when you're confident the user's needs have been met and they've indicated natural closure.

2. Memory:
You have access to comprehensive memory management tools: search_memory, save_memory, modify_memory, delete_memory, and get_all_memories.

save_memory should be used to jot down any noteworthy information about the user or session, including but not limited to:
- User's personal information (e.g. preferences, hobbies, habits, location)
- Other tool calls
- Upcoming events

search_memory should ALWAYS be attempted to obtain any relevant information when the user says something, unless it is an explicit call to one of your other tools or general knowledge that can be obtained via google Search. This ESPECIALLY includes when:
- User asks for personal information about themselves
- User asks you if you remember a certain thing
- User asks a question, of which the answer can be influenced by your previous interactions
- You are in doubt about something. You should ALWAYS search memories for any information that may be relevant to your response.

modify_memory can be used to update existing memories when you learn new information that changes or refines what you previously saved. For example, if you saved "User likes coffee" and later learn they prefer espresso specifically, you can modify that memory.

delete_memory should be used sparingly and only when a memory is clearly incorrect, outdated, or no longer relevant to the user.

get_all_memories can be used to review all stored memories, which is helpful for understanding the full context of your relationship with the user.

For example, if the user has told you before he always wanted to go Paris to visit and you saved this memory, if he asks "where should I go on vacation this year?" you should analyze his memories and suggest Paris unless told otherwise. Similarly, if the user mentioned at one point he enjoys a specific ingredient and asks at another time what he should make for dinner, you should suggest something that contains the favored ingredient in the recipe.
"""

def create_analysis_prompt(raw_patterns: Dict[str, Any], stored_memories: List[Dict[str, Any]] = None) -> Tuple[str, Dict[str, Any]]:
    """Create a structured prompt for pattern analysis including stored memories"""
    
    patterns_json = json.dumps(raw_patterns, indent=2)
    
    # Format stored memories for the prompt
    memory_context = ""
    if stored_memories:
        memory_context = "\n\nCURRENTLY STORED MEMORIES:\n"
        for memory in stored_memories:
            memory_id = memory.get("id", "unknown")
            memory_text = memory.get("memory", "")
            confidence = memory.get("confidence", 0.0)
            memory_context += f"ID {memory_id} (confidence: {confidence:.2f}): {memory_text}\n"
    else:
        memory_context = "\n\nNo stored memories found.\n"
    
    prompt = f"""
You are analyzing user behavior patterns from tool usage data to determine memory modifications. The user has just executed a new tool. Here is a list of ONLY RELEVANT tools the user has used recently that relate to the current tool execution.

TOOL USAGE DATA:
{patterns_json}

CONSERVATIVE ANALYSIS GUIDELINES:
You must be EXTREMELY CONSERVATIVE with memory modifications. Only make changes when there is CLEAR, OBVIOUS, and REPEATED evidence in the tool data.

EVIDENCE REQUIREMENTS:
- **CREATE**: Requires 3+ related tool executions showing the same pattern/preference, OR 2+ executions of the exact same action at similar times
- **REINFORCE**: Requires at least 2 new tool executions that directly support an existing memory
- **WEAKEN**: Only when tool data CLEARLY contradicts an existing memory (not just absence of supporting data)
- **UPDATE_CONTENT**: Only when new tool data provides significantly more specific information about an existing memory

DO NOT MODIFY MEMORIES FOR:
- Single tool executions (unless they are exact repeats of established patterns)
- Vague correlations or assumptions
- Tool data that could have multiple interpretations
- Memories that are only tangentially related to the current tool usage
- Time patterns with less than 3 occurrences at similar times

ANALYSIS FOCUS (ONLY WHEN EVIDENCE IS STRONG):
- Clear repeated tool usage patterns (same tools used together 3+ times)
- Temporal patterns with consistent timing (3+ occurrences at similar times/days)
- Obvious user preferences from repeated search queries or tool arguments
- Workflow sequences that repeat consistently (3+ times in same order)

Here is a list of currently stored memories about the user. ONLY modify memories that are DIRECTLY related to the current tool usage data.
{memory_context}

ANALYSIS GOAL:
Return memory modifications ONLY when patterns are undeniably clear. Most of the time, you should return an empty list.

MODIFICATION TYPES:
1. **CREATE**: Add a new memory ONLY for patterns with overwhelming evidence
2. **REINFORCE**: Increase confidence ONLY when new data strongly supports existing memory
3. **WEAKEN**: Decrease confidence ONLY when data clearly contradicts existing memory  
4. **UPDATE_CONTENT**: Modify ONLY when new data provides significantly more specific information

CRITICAL FORMATTING RULES:
- For "create" action: set "id" to null, MUST include "memory" with the new memory text
- For "reinforce" action: MUST include "id" with the memory ID, set "memory" to null
- For "weaken" action: MUST include "id" with the memory ID, set "memory" to null  
- For "update_content" action: MUST include both "id" with memory ID AND "memory" with new text

MEMORY QUALITY REQUIREMENTS:
- Must be based on factual, repeated observations from the tool data
- Include timing information ONLY when there are 3+ consistent time-based occurrences
- Avoid assumptions or interpretations - stick to what the data clearly shows
- Focus on patterns that would genuinely help provide better assistance

EXAMPLES OF SUFFICIENT EVIDENCE:
- User played 5 different EDM songs in the past week = "User enjoys EDM music"
- User searches weather every day at 8 AM for a week = "User checks weather every morning around 8 AM"
- User uses timer tool for 25 minutes, then break, repeated 4 times = "User works in 25-minute focused sessions"

EXAMPLES OF INSUFFICIENT EVIDENCE (DO NOT CREATE MEMORIES):
- User played one song = Cannot determine music preference
- User searched something twice = Not enough for a pattern
- User used a tool at similar times twice = Need more occurrences for timing pattern

WHEN IN DOUBT, DO NOT MODIFY. It's better to miss a pattern than create incorrect memories.

STRICT FORMATTING REQUIREMENTS:
1. Every object MUST have "action", "id", and "memory" fields
2. Use null for fields not needed by that action type
3. Never omit required fields - use null instead
4. Most analyses should return an empty modifications array
"""
    
    response_schema = {
        "type": "OBJECT",
        "properties": {
            "memory_modifications": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "action": {
                            "type": "STRING",
                            "enum": ["create", "reinforce", "weaken", "update_content"],
                            "description": "Type of memory modification to perform"
                        },
                        "id": {
                            "any_of": [
                                {"type": "INTEGER"},
                                {"type": "NULL"}
                            ],
                            "description": "Memory ID for reinforce/weaken/update_content actions, null for create"
                        },
                        "memory": {
                            "any_of": [
                                {"type": "STRING"},
                                {"type": "NULL"}
                            ],
                            "description": "Memory text content for create/update_content actions, null for reinforce/weaken"
                        }
                    },
                    "required": ["action", "id", "memory"]
                },
                "description": "List of memory modifications to apply based on pattern analysis"
            }
        },
        "required": ["memory_modifications"]
    }
    
    return prompt, response_schema

