#!/usr/bin/env python3
"""
Test script for the conservative pattern analysis system
Tests memory weakening when contradictory evidence is found (EDM music scenario)
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta
from pathlib import Path
import random

# Add the agent directory to the Python path for imports
agent_dir = Path(__file__).parent.parent
sys.path.insert(0, str(agent_dir))

from memory.memory_database import MemoryDatabase
from memory.pattern_recognizer import PatternRecognizer


def print_separator(title: str):
    """Print a clear separator with title"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def print_step(step_num: int, description: str):
    """Print step header"""
    print(f"\n--- STEP {step_num}: {description} ---")


def print_memories(memory_db: MemoryDatabase):
    """Print current memories in database"""
    memories = memory_db.get_memories()
    if memories:
        print("\nCURRENT MEMORIES:")
        for memory in memories:
            print(f"  ID {memory['id']}: '{memory['memory']}' (confidence: {memory['confidence']:.2f})")
    else:
        print("\nCURRENT MEMORIES: None")


def print_tool_executions(memory_db: MemoryDatabase, tool_name: str = None, limit: int = 10):
    """Print recent tool executions"""
    executions = memory_db.get_tool_executions(tool_name=tool_name, limit=limit)
    print(f"\nRECENT TOOL EXECUTIONS ({tool_name or 'all'}):")
    for exec in executions:
        timestamp = exec['timestamp']
        tool = exec['tool']
        args = exec.get('arguments', {})
        print(f"  {timestamp}: {tool} -> {args}")


def print_analysis_results(result: dict):
    """Print pattern analysis results"""
    print("\nANALYSIS RESULTS:")
    if result.get("skipped"):
        print(f"  SKIPPED: {result.get('reason')}")
        print(f"  Total executions: {result.get('total_executions', 0)}")
    elif result.get("success"):
        print(f"  SUCCESS: {result.get('insights_saved_count', 0)} insights saved")
        print(f"  Target tool: {result.get('target_tool')}")
        print(f"  Total executions analyzed: {result.get('total_executions', 0)}")
    else:
        print(f"  ERROR: {result.get('error')}")


async def main():
    """Run the memory weakening test scenario"""
    print_separator("MEMORY WEAKENING TEST - EDM MUSIC SCENARIO")
    
    # Initialize components
    memory_db = MemoryDatabase()
    pattern_recognizer = PatternRecognizer(days_to_analyze=30)
    
    # Step 1: Clear existing database for clean test
    print_step(1, "Clear existing database for clean test")
    memory_db.clear_all_data()
    print("Database cleared successfully")
    print_memories(memory_db)
    
    # Step 2: Add diverse memories and tool executions including EDM preference
    print_step(2, "Add diverse memories and tool executions including EDM music preference")
    
    # Add diverse unrelated memories
    memory_db.add_memory("User works as a software developer", confidence=0.7)
    memory_db.add_memory("User prefers coffee over tea", confidence=0.6)
    memory_db.add_memory("User likes EDM music", confidence=0.8)  # This will be tested
    memory_db.add_memory("User uses VS Code for development", confidence=0.7)
    memory_db.add_memory("User lives in Pacific timezone", confidence=0.6)
    
    # Create various tool execution timestamps over the past week
    base_date = datetime.now() - timedelta(days=7)
    
    # Add diverse tool executions
    random_tools = [
        ("google_search", {"query": "Python best practices"}),
        ("open_file", {"path": "project.py"}),
        ("send_email", {"to": "colleague@work.com", "subject": "Project update"}),
        ("set_timer", {"duration": "25 minutes", "purpose": "work session"}),
        ("google_search", {"query": "coffee shops near me"}),
        ("google_search", {"query": "top EDM hits 2025"})  # This should be filtered as related
    ]
    
    # Add EDM-related tool executions (showing strong EDM preference)
    edm_tools = [
        ("play_song", {"artist": "Deadmau5", "track": "Strobe"}),
        ("play_song", {"artist": "Calvin Harris", "track": "Feel So Close"}),
        ("save_track", {"artist": "Skrillex", "track": "Bangarang", "playlist": "Favorites"}),
        ("play_song", {"artist": "David Guetta", "track": "Titanium"}),
        ("save_track", {"artist": "Avicii", "track": "Wake Me Up", "playlist": "EDM Collection"}),
        ("create_playlist", {"name": "Best EDM 2025", "genre": "Electronic Dance Music"}),
        ("search_spotify", {"query": "EDM hits 2025"}),
        ("play_song", {"artist": "Martin Garrix", "track": "Animals"}),
        ("add_to_playlist", {"playlist": "EDM Collection", "artist": "Tiesto", "track": "Adagio for Strings"})
    ]
    
    # Add tool executions with timestamps
    for i, (tool, args) in enumerate(random_tools + edm_tools):
        timestamp = base_date + timedelta(days=i % 7, hours=random.randint(8, 20), minutes=random.randint(0, 59))
        memory_db.log_tool_execution(
            tool_name=tool,
            tool_arguments=args,
            tool_result={"success": True},
            timestamp=timestamp
        )
    
    print("Added diverse memories and tool executions")
    print_memories(memory_db)
    
    # Step 3: Log contradictory tool execution - removing EDM playlists WITHOUT explicit reason
    print_step(3, "Log contradictory action - removing EDM playlists (no explicit reason)")
    
    current_time = datetime.now()
    memory_db.log_tool_execution(
        tool_name="remove_playlist",
        tool_arguments={
            "playlist_names": ["Best EDM 2025", "EDM Collection", "Electronic Favorites"]
        },
        tool_result={
            "removed_playlists": ["Best EDM 2025", "EDM Collection", "Electronic Favorites"],
            "success": True
        },
        timestamp=current_time
    )
    
    print(f"Added remove_playlist execution at {current_time.strftime('%Y-%m-%d %H:%M')}")
    print("Arguments: Just playlist names, no explicit reason given")
    
    # Show the EDM memory before analysis
    edm_memory = None
    for memory in memory_db.get_memories():
        if "EDM music" in memory["memory"]:
            edm_memory = memory
            break
    
    if edm_memory:
        print(f"\nEDM memory BEFORE analysis:")
        print(f"  ID {edm_memory['id']}: '{edm_memory['memory']}' (confidence: {edm_memory['confidence']:.2f})")
    
    # Step 4: Run pattern analysis pipeline
    print_step(4, "Run pattern analysis pipeline on remove_playlist action")
    
    # Show what tool executions are being filtered and selected
    print("\nTOOL EXECUTION FILTERING:")
    extractor = pattern_recognizer.extractor
    
    # Get all tool executions and the target execution
    all_executions = memory_db.get_tool_executions(limit=50)
    target_execution = None
    for exec in all_executions:
        if exec['tool'] == 'remove_playlist':
            target_execution = exec
            break
    
    print(f"Total tool executions in database: {len(all_executions)}")
    
    if target_execution:
        # Use the pattern extractor's filtering method to see what gets included
        relevant_executions = extractor._filter_relevant_executions(
            all_executions, target_execution['tool'], 30
        )
        
        print(f"Target tool: {target_execution['tool']}")
        print(f"Target arguments: {target_execution.get('arguments', {})}")
        print(f"\nFiltered {len(relevant_executions)} relevant executions:")
        
        # Group by tool type and show each execution
        by_tool = {}
        for exec in relevant_executions:
            tool_name = exec['tool']
            if tool_name not in by_tool:
                by_tool[tool_name] = []
            by_tool[tool_name].append(exec)
        
        for tool_name, executions in by_tool.items():
            print(f"\n{tool_name}: {len(executions)} executions")
            for exec in executions:
                timestamp = exec['timestamp']
                args = exec.get('arguments', {})
                print(f"  {timestamp}: {args}")
    
    # Now run the extractor to get the summary data
    raw_patterns = extractor.generate_similar_tool_summary("remove_playlist", 30)
    
    # Run the analysis
    trigger_context = {"last_tool": "remove_playlist"}
    result = await pattern_recognizer.recognize_patterns_async(trigger_context)
    
    print_analysis_results(result)
    
    # Step 5: Show memory modifications results
    print_step(5, "Memory modifications after contradictory evidence")
    print_memories(memory_db)
    
    # Show the EDM memory after analysis
    edm_memory_after = None
    for memory in memory_db.get_memories():
        if "EDM music" in memory["memory"]:
            edm_memory_after = memory
            break
    
    if edm_memory and edm_memory_after:
        print(f"\nEDM MEMORY COMPARISON:")
        print(f"  BEFORE: ID {edm_memory['id']} confidence: {edm_memory['confidence']:.2f}")
        print(f"  AFTER:  ID {edm_memory_after['id']} confidence: {edm_memory_after['confidence']:.2f}")
        confidence_change = edm_memory_after['confidence'] - edm_memory['confidence']
        if confidence_change < 0:
            print(f"  RESULT: Confidence DECREASED by {abs(confidence_change):.2f} (weakened)")
        elif confidence_change > 0:
            print(f"  RESULT: Confidence INCREASED by {confidence_change:.2f} (reinforced)")
        else:
            print(f"  RESULT: No change in confidence")
    elif edm_memory and not edm_memory_after:
        print(f"\nEDM MEMORY RESULT: Memory was DELETED due to low confidence")
    
    print_separator("TEST COMPLETE")


if __name__ == "__main__":
    # Run the async test
    asyncio.run(main())
