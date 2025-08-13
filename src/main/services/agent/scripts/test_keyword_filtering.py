#!/usr/bin/env python3
"""
Test keyword-based filtering to verify EDM-related tools are properly detected
"""

import sys
import os
import asyncio
from datetime import datetime, timedelta

# Add the agent directory to the Python path
agent_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sys.path.insert(0, agent_dir)

from memory.memory_database import MemoryDatabase
from memory.pattern_extractor import AlgorithmicPatternExtractor

async def test_keyword_filtering():
    """Test the keyword-based filtering system specifically"""
    
    print("=" * 60)
    print("  KEYWORD FILTERING TEST")
    print("=" * 60)
    
    # Initialize components
    memory_db = MemoryDatabase()
    pattern_extractor = AlgorithmicPatternExtractor()
    
    # Get all tool executions
    all_executions = memory_db.get_tool_executions(limit=100)
    print(f"Total tool executions in database: {len(all_executions)}")
    
    # Target execution (remove_playlist with EDM content)
    target_execution = None
    for exec in all_executions:
        if exec['tool_name'] == 'remove_playlist':
            target_execution = exec
            break
    
    if not target_execution:
        print("No remove_playlist execution found!")
        return
    
    print(f"\nTarget execution: {target_execution['tool_name']}")
    print(f"Arguments: {target_execution['arguments']}")
    
    # Filter relevant executions
    relevant_executions = pattern_extractor._filter_relevant_executions(
        target_execution, all_executions
    )
    
    print(f"\nFiltered {len(relevant_executions)} relevant executions:")
    
    # Group by tool type
    by_tool = {}
    for exec in relevant_executions:
        tool_name = exec['tool_name']
        if tool_name not in by_tool:
            by_tool[tool_name] = []
        by_tool[tool_name].append(exec)
    
    # Show results grouped by tool type
    for tool_name, executions in by_tool.items():
        print(f"\n{tool_name}: {len(executions)} executions")
        for exec in executions:
            args_str = str(exec['arguments'])[:100] + "..." if len(str(exec['arguments'])) > 100 else str(exec['arguments'])
            print(f"  {exec['timestamp']}: {args_str}")
    
    # Test keyword extraction on specific executions
    print(f"\n" + "=" * 60)
    print("  KEYWORD EXTRACTION TEST")
    print("=" * 60)
    
    # Test keyword extraction on target
    target_keywords = pattern_extractor._extract_key_terms(target_execution['arguments'])
    print(f"Target execution keywords: {target_keywords}")
    
    # Test on Google search
    google_exec = None
    for exec in relevant_executions:
        if exec['tool_name'] == 'google_search' and 'EDM' in str(exec['arguments']):
            google_exec = exec
            break
    
    if google_exec:
        google_keywords = pattern_extractor._extract_key_terms(google_exec['arguments'])
        print(f"Google search keywords: {google_keywords}")
        
        # Check overlap
        overlap = target_keywords.intersection(google_keywords)
        meaningful_overlap = [word for word in overlap if len(word) > 3]
        print(f"Keyword overlap: {overlap}")
        print(f"Meaningful overlap (>3 chars): {meaningful_overlap}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(test_keyword_filtering())
