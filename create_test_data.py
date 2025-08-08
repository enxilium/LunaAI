#!/usr/bin/env python3
"""
Simple script to populate the tool execution database with realistic test data
"""

import sys
import os
from datetime import datetime, timedelta
import random

# Add the src directory to Python path
project_root = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(project_root, 'src', 'main', 'services', 'agent', 'tools'))

from tool_logger import ToolLogger


def create_realistic_test_data():
    """Create realistic tool execution data with varied patterns"""
    print("📝 Creating realistic test data for pattern recognition...")
    
    logger = ToolLogger()
    
    # Define different user behavior patterns
    morning_productivity_tools = [
        {"tool_name": "google_search", "queries": ["Python best practices", "React hooks tutorial", "JavaScript optimization", "code review checklist"]},
        {"tool_name": "file_operations", "actions": ["read", "write", "create"]},
        {"tool_name": "code_analysis", "inputs": ["def hello():", "useState hook", "async function", "class Component"]},
        {"tool_name": "git_operations", "actions": ["commit", "push", "pull", "status"]},
    ]
    
    evening_leisure_tools = [
        {"tool_name": "google_search", "queries": ["best jazz albums 2024", "movie recommendations", "cooking recipes", "travel destinations"]},
        {"tool_name": "music_player", "actions": ["play", "pause", "next", "search"]},
        {"tool_name": "weather_check", "locations": ["New York", "San Francisco", "London", "Tokyo"]},
    ]
    
    # Generate data for the last 14 days
    base_time = datetime.now() - timedelta(days=14)
    session_counter = 1
    total_executions = 0
    
    for day in range(14):
        current_date = base_time + timedelta(days=day)
        
        # Skip some days randomly to create realistic gaps
        if random.random() < 0.2:  # 20% chance to skip a day
            continue
        
        # Morning productivity session (9 AM - 11 AM)
        if random.random() < 0.8:  # 80% chance of morning session
            session_id = f"session_{session_counter}"
            session_counter += 1
            
            morning_start = current_date.replace(hour=9, minute=random.randint(0, 30))
            
            # 3-8 tool executions in morning session
            num_executions = random.randint(3, 8)
            
            for i in range(num_executions):
                execution_time = morning_start + timedelta(minutes=i*2 + random.randint(0, 5))
                
                # Choose a productivity tool
                tool_data = random.choice(morning_productivity_tools)
                tool_name = tool_data["tool_name"]
                
                # Generate realistic input/output
                if tool_name == "google_search":
                    query = random.choice(tool_data["queries"])
                    tool_input = {"query": query}
                    tool_output = {"results": [f"result1_{query[:10]}", f"result2_{query[:10]}"]}
                    exec_time = random.uniform(150, 300)  # 150-300ms for searches
                    
                elif tool_name == "file_operations":
                    action = random.choice(tool_data["actions"])
                    tool_input = {"action": action, "file": f"project_{random.randint(1,5)}.py"}
                    tool_output = {"success": True, "content": "file content..."}
                    exec_time = random.uniform(10, 50)  # 10-50ms for file ops
                    
                elif tool_name == "code_analysis":
                    code = random.choice(tool_data["inputs"])
                    tool_input = {"code": code}
                    tool_output = {"suggestions": ["add docstring", "improve naming"]}
                    exec_time = random.uniform(80, 200)  # 80-200ms for analysis
                    
                elif tool_name == "git_operations":
                    action = random.choice(tool_data["actions"])
                    tool_input = {"action": action}
                    tool_output = {"status": "success", "message": f"{action} completed"}
                    exec_time = random.uniform(100, 500)  # 100-500ms for git ops
                
                # Occasional failures (5% chance)
                success = random.random() > 0.05
                if not success:
                    tool_output = {"error": "Operation failed"}
                    exec_time *= 0.5  # Failed operations are faster
                
                logger.log_tool_execution(
                    session_id=session_id,
                    user_id="test_user",
                    tool_name=tool_name,
                    tool_input=tool_input,
                    tool_output=tool_output,
                    execution_time_ms=exec_time,
                    success=success,
                    error_message="Operation failed" if not success else None
                )
                
                total_executions += 1
        
        # Evening leisure session (7 PM - 9 PM)
        if random.random() < 0.6:  # 60% chance of evening session
            session_id = f"session_{session_counter}"
            session_counter += 1
            
            evening_start = current_date.replace(hour=19, minute=random.randint(0, 60))
            
            # 2-5 tool executions in evening session
            num_executions = random.randint(2, 5)
            
            for i in range(num_executions):
                execution_time = evening_start + timedelta(minutes=i*3 + random.randint(0, 10))
                
                # Choose a leisure tool
                tool_data = random.choice(evening_leisure_tools)
                tool_name = tool_data["tool_name"]
                
                # Generate realistic input/output
                if tool_name == "google_search":
                    query = random.choice(tool_data["queries"])
                    tool_input = {"query": query}
                    tool_output = {"results": [f"result1_{query[:10]}", f"result2_{query[:10]}"]}
                    exec_time = random.uniform(180, 350)  # Slightly slower evening searches
                    
                elif tool_name == "music_player":
                    action = random.choice(tool_data["actions"])
                    tool_input = {"action": action, "track": f"track_{random.randint(1,100)}"}
                    tool_output = {"status": "playing" if action == "play" else "paused"}
                    exec_time = random.uniform(20, 80)  # Fast music operations
                    
                elif tool_name == "weather_check":
                    location = random.choice(tool_data["locations"])
                    tool_input = {"location": location}
                    tool_output = {"temperature": random.randint(60, 85), "condition": "sunny"}
                    exec_time = random.uniform(100, 200)  # Medium speed for weather
                
                # Higher success rate for leisure activities (98%)
                success = random.random() > 0.02
                if not success:
                    tool_output = {"error": "Service unavailable"}
                
                logger.log_tool_execution(
                    session_id=session_id,
                    user_id="test_user",
                    tool_name=tool_name,
                    tool_input=tool_input,
                    tool_output=tool_output,
                    execution_time_ms=exec_time,
                    success=success,
                    error_message="Service unavailable" if not success else None
                )
                
                total_executions += 1
        
        # Weekend patterns (different behavior on weekends)
        if current_date.weekday() >= 5:  # Saturday or Sunday
            if random.random() < 0.4:  # 40% chance of weekend session
                session_id = f"session_{session_counter}"
                session_counter += 1
                
                # Random time during the day
                weekend_start = current_date.replace(
                    hour=random.randint(10, 16), 
                    minute=random.randint(0, 59)
                )
                
                # Mix of leisure and light productivity
                mixed_tools = evening_leisure_tools + [morning_productivity_tools[0]]  # Add search
                
                num_executions = random.randint(1, 4)
                for i in range(num_executions):
                    execution_time = weekend_start + timedelta(minutes=i*5 + random.randint(0, 15))
                    
                    tool_data = random.choice(mixed_tools)
                    tool_name = tool_data["tool_name"]
                    
                    if tool_name == "google_search":
                        # Weekend searches are more varied
                        weekend_queries = ["weekend activities", "home improvement", "recipe ideas", "book recommendations"]
                        query = random.choice(weekend_queries)
                        tool_input = {"query": query}
                        tool_output = {"results": [f"result1_{query[:10]}", f"result2_{query[:10]}"]}
                        exec_time = random.uniform(200, 400)  # Leisurely searches
                    else:
                        # Use existing tool patterns
                        continue
                    
                    logger.log_tool_execution(
                        session_id=session_id,
                        user_id="test_user",
                        tool_name=tool_name,
                        tool_input=tool_input,
                        tool_output=tool_output,
                        execution_time_ms=exec_time,
                        success=True
                    )
                    
                    total_executions += 1
    
    print(f"✅ Successfully created {total_executions} tool executions across {session_counter-1} sessions")
    print(f"📊 Data spans {14} days with realistic temporal and behavioral patterns")
    print(f"🎯 Patterns included:")
    print(f"   - Morning productivity sessions (9-11 AM)")
    print(f"   - Evening leisure sessions (7-9 PM)")
    print(f"   - Weekend mixed activities")
    print(f"   - Varied tool preferences and performance")
    print(f"   - Realistic success/failure rates")
    
    return total_executions


def show_database_summary():
    """Show a summary of what's in the database"""
    print("\n📋 Database Summary:")
    
    logger = ToolLogger()
    
    # Get recent executions
    recent_executions = logger.get_tool_executions(limit=10)
    print(f"📝 Total recent executions: {len(recent_executions)}")
    
    if recent_executions:
        print("🔧 Recent tools used:")
        tools = {}
        for execution in recent_executions:
            tool_name = execution['tool_name']
            tools[tool_name] = tools.get(tool_name, 0) + 1
        
        for tool, count in sorted(tools.items(), key=lambda x: x[1], reverse=True):
            print(f"   - {tool}: {count} times")
    
    # Get usage stats
    stats = logger.get_tool_usage_stats(user_id="test_user", days=30)
    print(f"\n📊 Overall Statistics:")
    print(f"   - Total executions: {stats['total_executions']}")
    print(f"   - Successful: {stats['successful_executions']}")
    print(f"   - Failed: {stats['failed_executions']}")
    
    if stats['tool_breakdown']:
        print(f"\n🏆 Top 5 Most Used Tools:")
        for i, tool in enumerate(stats['tool_breakdown'][:5]):
            print(f"   {i+1}. {tool['tool_name']}: {tool['usage_count']} uses "
                  f"(avg {tool['avg_execution_time']:.1f}ms)")


if __name__ == "__main__":
    print("🧪 Tool Execution Database Test Data Generator")
    print("=" * 60)
    
    try:
        # Create test data
        total_created = create_realistic_test_data()
        
        # Show summary
        show_database_summary()
        
        print("\n🎯 Test data creation completed!")
        print("💡 You can now test the pattern recognition components:")
        print("   1. AlgorithmicPatternExtractor")
        print("   2. LLMPatternAnalyzer (needs Google API key)")
        print("   3. PatternRecognizer (needs Google API key + Mem0)")
        
    except Exception as e:
        print(f"❌ Error creating test data: {e}")
        import traceback
        traceback.print_exc()
