#!/usr/bin/env python3
"""
Test script for Pattern Recognition System
"""

import asyncio
import sys
import os
import json
from datetime import datetime, timedelta

# Add the src directory to Python path
project_root = os.path.dirname(__file__)
agent_path = os.path.join(project_root, 'src', 'main', 'services', 'agent')
sys.path.insert(0, agent_path)

try:
    from tools.tool_logger import ToolLogger
    from tools.pattern_extractor import AlgorithmicPatternExtractor
    from tools.pattern_analyzer import LLMPatternAnalyzer
    from tools.pattern_recognizer import PatternRecognizer
    print("✅ All imports successful!")
except ImportError as e:
    print(f"❌ Import error: {e}")
    print(f"Looking for modules in: {agent_path}")
    print("Available files:")
    tools_path = os.path.join(agent_path, 'tools')
    if os.path.exists(tools_path):
        for file in os.listdir(tools_path):
            print(f"  - {file}")
    sys.exit(1)


async def create_test_data():
    """Create some test tool execution data"""
    print("📝 Creating test tool execution data...")
    
    logger = ToolLogger()
    
    # Create varied test data to demonstrate patterns
    test_executions = [
        # Morning productivity tools
        {"session_id": "session_1", "user_id": "test_user", "tool_name": "google_search", 
         "tool_input": {"query": "Python best practices"}, "tool_output": {"results": ["python.org"]}, 
         "execution_time_ms": 245.0, "success": True},
        
        {"session_id": "session_1", "user_id": "test_user", "tool_name": "file_operations", 
         "tool_input": {"action": "read", "file": "code.py"}, "tool_output": {"content": "def hello():"}, 
         "execution_time_ms": 12.5, "success": True},
         
        {"session_id": "session_1", "user_id": "test_user", "tool_name": "code_analysis", 
         "tool_input": {"code": "def hello(): pass"}, "tool_output": {"suggestions": ["add docstring"]}, 
         "execution_time_ms": 89.2, "success": True},
        
        # Evening entertainment searches
        {"session_id": "session_2", "user_id": "test_user", "tool_name": "google_search", 
         "tool_input": {"query": "best jazz albums 2024"}, "tool_output": {"results": ["jazz albums"]}, 
         "execution_time_ms": 198.0, "success": True},
         
        {"session_id": "session_2", "user_id": "test_user", "tool_name": "google_search", 
         "tool_input": {"query": "movie recommendations"}, "tool_output": {"results": ["movies"]}, 
         "execution_time_ms": 156.0, "success": True},
        
        # Failed operations to test error handling
        {"session_id": "session_2", "user_id": "test_user", "tool_name": "file_operations", 
         "tool_input": {"action": "delete", "file": "important.txt"}, "tool_output": None, 
         "execution_time_ms": 8.0, "success": False, "error_message": "Permission denied"},
        
        # More productivity tools
        {"session_id": "session_3", "user_id": "test_user", "tool_name": "google_search", 
         "tool_input": {"query": "React hooks tutorial"}, "tool_output": {"results": ["react docs"]}, 
         "execution_time_ms": 267.0, "success": True},
         
        {"session_id": "session_3", "user_id": "test_user", "tool_name": "code_analysis", 
         "tool_input": {"code": "useState hook"}, "tool_output": {"suggestions": ["use useCallback"]}, 
         "execution_time_ms": 134.5, "success": True},
    ]
    
    # Add timestamp variation to create realistic patterns
    base_time = datetime.now() - timedelta(days=7)
    
    for i, execution in enumerate(test_executions):
        # Vary timestamps - some in morning (9 AM), some in evening (8 PM)
        if "productivity" in str(execution) or "code" in execution["tool_name"]:
            time_offset = timedelta(days=i//3, hours=9, minutes=i*5)  # Morning work
        else:
            time_offset = timedelta(days=i//3, hours=20, minutes=i*3)  # Evening leisure
            
        execution_time = base_time + time_offset
        
        # Insert with specific timestamp (would need to modify logger for this in real implementation)
        logger.log_tool_execution(**execution)
        print(f"  ✅ Added: {execution['tool_name']} for {execution['session_id']}")
    
    print(f"📊 Created {len(test_executions)} test tool executions")
    return len(test_executions)


async def test_pattern_extraction():
    """Test the algorithmic pattern extraction"""
    print("\n🔍 Testing Algorithmic Pattern Extraction...")
    
    extractor = AlgorithmicPatternExtractor()
    patterns = extractor.generate_pattern_summary(days_back=30)
    
    print(f"📈 Total executions analyzed: {patterns['analysis_metadata']['total_executions']}")
    print(f"📅 Date range: {patterns['analysis_metadata']['generated_at']}")
    
    # Show temporal patterns
    if patterns['temporal_patterns']['peak_hours']:
        print(f"⏰ Peak hours: {patterns['temporal_patterns']['peak_hours'][:2]}")
    
    # Show tool usage
    if patterns['tool_usage_patterns']['most_used_tools']:
        most_used = patterns['tool_usage_patterns']['most_used_tools'][:3]
        print(f"🔧 Most used tools: {[tool['tool_name'] for tool in most_used]}")
    
    # Show sequences
    if patterns['sequence_patterns']['common_tool_pairs']:
        pairs = patterns['sequence_patterns']['common_tool_pairs'][:2]
        print(f"🔗 Common tool sequences: {pairs}")
    
    return patterns


async def test_llm_analysis(raw_patterns):
    """Test the LLM pattern analysis"""
    print("\n🧠 Testing LLM Pattern Analysis...")
    
    analyzer = LLMPatternAnalyzer()
    analysis = await analyzer.analyze_patterns(raw_patterns)
    
    if analysis['success']:
        insights = analysis['insights']
        
        print(f"✅ LLM Analysis successful!")
        print(f"📊 Behavioral insights: {len(insights.get('behavioral_insights', []))}")
        print(f"👤 User preferences: {len(insights.get('user_preferences', []))}")
        print(f"⚡ Optimization opportunities: {len(insights.get('optimization_opportunities', []))}")
        
        # Show a sample insight
        if insights.get('behavioral_insights'):
            sample = insights['behavioral_insights'][0]
            print(f"💡 Sample insight: {sample.get('insight', 'N/A')} (confidence: {sample.get('confidence', 0)})")
            
    else:
        print(f"❌ LLM Analysis failed: {analysis.get('error')}")
    
    return analysis


async def test_full_pattern_recognition():
    """Test the complete pattern recognition system"""
    print("\n🎯 Testing Complete Pattern Recognition System...")
    
    recognizer = PatternRecognizer(user_id="test_user", days_to_analyze=30)
    
    trigger_context = {
        "trigger_type": "manual_test",
        "test_timestamp": datetime.now().isoformat()
    }
    
    result = await recognizer.recognize_patterns_async(trigger_context)
    
    if result.get('success'):
        print(f"🎉 Pattern recognition completed successfully!")
        print(f"📊 Total executions analyzed: {result['raw_patterns_summary']['total_executions']}")
        print(f"💾 Insights saved to memory: {result['insights_saved_count']}")
        print(f"💡 Proactive suggestions generated: {len(result['proactive_suggestions'])}")
        
        # Show memory results
        if result['memory_results']['saved_insights']:
            print(f"\n🧠 Saved insights:")
            for insight in result['memory_results']['saved_insights'][:3]:
                print(f"  - {insight['type']}: {insight.get('insight', insight.get('preference', insight.get('opportunity', 'N/A')))}")
        
        # Show suggestions
        if result['proactive_suggestions']:
            print(f"\n💡 Proactive suggestions:")
            for suggestion in result['proactive_suggestions'][:2]:
                print(f"  - {suggestion.get('title', 'N/A')}: {suggestion.get('description', 'N/A')}")
                
    else:
        print(f"❌ Pattern recognition failed: {result.get('error')}")
        if result.get('reason'):
            print(f"📝 Reason: {result['reason']}")
    
    return result


async def main():
    """Run all pattern recognition tests"""
    print("🧪 Starting Pattern Recognition System Tests")
    print("=" * 60)
    
    try:
        # Step 1: Create test data
        await create_test_data()
        
        # Step 2: Test pattern extraction
        raw_patterns = await test_pattern_extraction()
        
        # Step 3: Test LLM analysis
        llm_analysis = await test_llm_analysis(raw_patterns)
        
        # Step 4: Test complete system
        full_result = await test_full_pattern_recognition()
        
        print("\n🎯 All tests completed!")
        print("=" * 60)
        
        if full_result.get('success'):
            print("✅ Pattern Recognition System is working correctly!")
            print("🚀 Ready for integration with Luna AI agent!")
        else:
            print("⚠️ Some issues detected. Check the logs above.")
            
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
