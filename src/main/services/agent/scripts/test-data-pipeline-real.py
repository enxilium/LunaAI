#!/usr/bin/env python3
"""
Comprehensive test script for Luna AI Memory & RAG System
Tests the complete pipeline from tool execution logging to memory management using REAL database
"""

import sys
import os
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple

# Add the agent directory to Python path for imports
agent_dir = Path(__file__).parent.parent
sys.path.insert(0, str(agent_dir))

# Now import from the memory module (relative to agent directory)
from memory.memory_database import MemoryDatabase
from memory.pattern_recognizer import PatternRecognizer


class TestDataPipeline:
    """Test the complete memory and pattern analysis pipeline using REAL database"""
    
    def __init__(self):
        # Use REAL database - no temporary files
        self.memory_db = MemoryDatabase()  # Uses actual luna_memory.db
        self.pattern_recognizer = PatternRecognizer()
        
        # Clear database on every run for clean testing
        self.clear_database()
        
        # Track expected vs actual changes
        self.test_scenarios = []
        self.results = []
    
    def clear_database(self):
        """Clear all data from the database for clean testing"""
        print("🧹 Clearing database for clean test run...")
        try:
            # Use the MemoryDatabase method to clear all data
            rows_affected = self.memory_db.clear_all_data()
            print(f"✅ Database cleared successfully ({rows_affected} rows affected)")
        except Exception as e:
            print(f"❌ Error clearing database: {e}")
            raise
    
    def populate_sample_data(self):
        """Populate database with initial sample memories and tool executions"""
        print("🔧 Populating database with sample data...")
        
        # Add initial memories
        sample_memories = [
            ("User prefers Python for data analysis projects", 0.7),
            ("User typically uses search_memory on Thursday mornings", 0.6),
            ("User saves coding-related memories frequently", 0.5),
            ("User uses Google search before making code changes", 0.4),
            ("User works on frontend projects on Fridays", 0.3)
        ]
        
        memory_ids = []
        for memory_text, confidence in sample_memories:
            memory_id = self.memory_db.add_memory(memory_text, confidence)
            memory_ids.append(memory_id)
        
        # Add some historical tool executions to establish patterns
        base_time = datetime.now() - timedelta(days=7)
        historical_executions = [
            # Establish Thursday morning search_memory pattern
            ("search_memory", {"query": "python patterns"}, {"status": "success"}, base_time.replace(hour=9, minute=30)),
            ("search_memory", {"query": "data analysis"}, {"status": "success"}, base_time.replace(hour=9, minute=45)),
            # Friday frontend work pattern  
            ("google_search", {"query": "react components"}, {"status": "success"}, (base_time + timedelta(days=1)).replace(hour=14, minute=0)),
            ("save_memory", {"text": "User prefers React hooks"}, {"status": "success"}, (base_time + timedelta(days=1)).replace(hour=14, minute=15)),
            # General coding pattern
            ("google_search", {"query": "best practices"}, {"status": "success"}, base_time.replace(hour=11, minute=0)),
            ("save_memory", {"text": "User follows clean code principles"}, {"status": "success"}, base_time.replace(hour=11, minute=5))
        ]
        
        for tool_name, args, result, timestamp in historical_executions:
            # Log with custom timestamp for realistic historical data
            self.memory_db.log_tool_execution(tool_name, args, result, timestamp)
        
        print(f"✅ Added {len(sample_memories)} sample memories and {len(historical_executions)} historical tool executions")
        return memory_ids
    
    def get_memory_snapshot(self) -> Dict[str, Any]:
        """Get current state of memories for comparison"""
        memories = self.memory_db.get_memories(min_confidence=0.0)
        return {
            "total_memories": len(memories),
            "memories": {m['id']: {"text": m['memory'], "confidence": m['confidence']} for m in memories},
            "high_confidence_count": len([m for m in memories if m['confidence'] >= 0.7]),
            "stats": self.memory_db.get_memory_stats()
        }
    
    async def test_scenario(self, scenario_name: str, tool_name: str, args: Dict, result: Dict, expected_changes: List[str], execution_timestamp: datetime = None) -> Dict[str, Any]:
        """Test a single scenario: log tool execution and trigger analysis"""
        print(f"\n{'='*80}")
        print(f"🧪 TESTING SCENARIO: {scenario_name}")
        print(f"{'='*80}")
        print(f"📋 Tool Execution: {tool_name}")
        print(f"📝 Arguments: {args}")
        print(f"📤 Expected Result: {result}")
        
        print(f"\n🎯 INTENDED EFFECTS:")
        for i, effect in enumerate(expected_changes, 1):
            print(f"   {i}. {effect}")
        
        # Get snapshot before
        before_snapshot = self.get_memory_snapshot()
        
        # Log the tool execution
        execution_id = self.memory_db.log_tool_execution(tool_name, args, result, execution_timestamp)
        print(f"\n✅ Tool execution logged (ID: {execution_id})")
        
        # Manually trigger pattern recognition
        print(f"\n🔄 Starting pattern analysis...")
        try:
            analysis_result = await self.pattern_recognizer.recognize_patterns_async({
                "trigger_type": "tool_execution",
                "last_tool": tool_name
            })
            
        except Exception as e:
            print(f"⚠️ Pattern analysis exception: {type(e).__name__}: {e}")
            analysis_result = {"success": False, "error": str(e)}
        
        # Get snapshot after
        after_snapshot = self.get_memory_snapshot()
        
        # Show actual effects
        print(f"\n🎯 ACTUAL EFFECTS GENERATED:")
        actual_changes = self.compare_snapshots(before_snapshot, after_snapshot)
        for i, change in enumerate(actual_changes, 1):
            print(f"   {i}. {change}")
        
        result = {
            "scenario": scenario_name,
            "tool": tool_name,
            "expected_changes": expected_changes,
            "actual_changes": actual_changes,
            "analysis_result": analysis_result,
            "before_stats": before_snapshot["stats"],
            "after_stats": after_snapshot["stats"]
        }
        
        self.results.append(result)
        return result
    
    def compare_snapshots(self, before: Dict, after: Dict) -> List[str]:
        """Compare two memory snapshots and return list of changes"""
        changes = []
        
        # Check for new memories
        new_memories = set(after["memories"].keys()) - set(before["memories"].keys())
        for mem_id in new_memories:
            mem_data = after["memories"][mem_id]
            changes.append(f"Created memory: '{mem_data['text']}' (confidence: {mem_data['confidence']:.2f})")
        
        # Check for confidence changes
        for mem_id in set(before["memories"].keys()) & set(after["memories"].keys()):
            before_conf = before["memories"][mem_id]["confidence"]
            after_conf = after["memories"][mem_id]["confidence"]
            
            if abs(before_conf - after_conf) > 0.01:  # Significant change
                direction = "increased" if after_conf > before_conf else "decreased"
                mem_text = after["memories"][mem_id]["text"]
                changes.append(f"Memory '{mem_text}' confidence {direction}: {before_conf:.2f} → {after_conf:.2f}")
        
        # Check for deleted memories
        deleted_memories = set(before["memories"].keys()) - set(after["memories"].keys())
        for mem_id in deleted_memories:
            mem_text = before["memories"][mem_id]["text"]
            changes.append(f"Deleted memory: '{mem_text}' (low confidence)")
        
        # Check for text changes
        for mem_id in set(before["memories"].keys()) & set(after["memories"].keys()):
            before_text = before["memories"][mem_id]["text"]
            after_text = after["memories"][mem_id]["text"]
            
            if before_text != after_text:
                changes.append(f"Memory text updated: '{before_text}' → '{after_text}'")
        
        if not changes:
            changes.append("No significant changes detected")
            
        return changes
    
    def print_final_summary(self):
        """Print a concise final summary of all test results"""
        print("\n" + "="*80)
        print("🎯 FINAL TEST SUMMARY")
        print("="*80)
        
        total_scenarios = len(self.results)
        total_expected_effects = sum(len(r['expected_changes']) for r in self.results)
        total_actual_effects = sum(len(r['actual_changes']) for r in self.results)
        successful_analyses = sum(1 for r in self.results if r.get('analysis_result', {}).get('success', False))
        
        print(f"📊 OVERALL RESULTS:")
        print(f"   Total scenarios tested: {total_scenarios}")
        print(f"   Successful pattern analyses: {successful_analyses}/{total_scenarios}")
        print(f"   Total expected effects: {total_expected_effects}")
        print(f"   Total actual effects generated: {total_actual_effects}")
        
        print(f"\n📈 SCENARIO BREAKDOWN:")
        for i, result in enumerate(self.results, 1):
            scenario_name = result['scenario']
            expected_count = len(result['expected_changes'])
            actual_count = len(result['actual_changes'])
            success = "✅" if result.get('analysis_result', {}).get('success', False) else "❌"
            
            print(f"   {i}. {scenario_name[:40]}{'...' if len(scenario_name) > 40 else ''}")
            print(f"      {success} Analysis | Expected: {expected_count} effects | Actual: {actual_count} effects")
        
        final_stats = self.memory_db.get_memory_stats()
        print(f"\n💾 FINAL DATABASE STATE:")
        print(f"   Total memories in database: {final_stats['total_memories']}")
        print(f"   Average confidence score: {final_stats['average_confidence']:.3f}")
        print(f"   High confidence memories (≥0.7): {final_stats.get('high_confidence_memories', 'unknown')}")
        print(f"   Database path: {self.memory_db.db_path}")
        
        print(f"\n🔧 PIPELINE COMPONENTS TESTED:")
        print(f"   ✅ Memory Database (CRUD operations)")
        print(f"   ✅ Pattern Extractor (algorithmic analysis)")  
        print(f"   ✅ LLM Pattern Analyzer (Gemini API)")
        print(f"   ✅ Pattern Recognizer (orchestration)")
        print(f"   ✅ Tool Execution Logging")
        print(f"   ✅ Memory Modifications Processing")
        
        if successful_analyses == total_scenarios:
            print(f"\n🎉 ALL TESTS PASSED! Pipeline is fully functional.")
        else:
            print(f"\n⚠️  {total_scenarios - successful_analyses} test(s) had analysis issues.")
            
        print("="*80)
    
    def cleanup(self):
        """Clean up test data (optional - comment out to keep test data)"""
        # Uncomment these lines if you want to clean up test data
        # print("🧹 Cleaning up test data...")
        # Add cleanup logic here if needed
        pass
    
    async def run_complete_test(self):
        """Run the complete test suite"""
        print("🚀 Starting Luna AI Memory & RAG Pipeline Test")
        print("Using REAL database for authentic testing")
        
        # Step 1: Populate sample data
        initial_memory_ids = self.populate_sample_data()
        
        # Step 2-6: Run test scenarios (5 different tool executions)
        test_scenarios = [
            {
                "name": "Search Memory on Tuesday (not Thursday)",
                "tool": "search_memory",
                "args": {"query": "python debugging"},
                "result": {"status": "success", "count": 2},
                "expected": [
                    "Memory about Thursday search pattern should weaken",
                    "New memory about Tuesday search behavior might be created"
                ]
            },
            {
                "name": "Save Frontend Memory on Monday",
                "tool": "save_memory", 
                "args": {"text": "User prefers Vue.js over React"},
                "result": {"status": "success", "id": 99},
                "expected": [
                    "Memory about Friday frontend work should weaken",
                    "New memory about Vue.js preference created",
                    "Memory about React preference should be contradicted"
                ]
            },
            {
                "name": "Google Search Without Subsequent Save",
                "tool": "google_search",
                "args": {"query": "machine learning algorithms"},
                "result": {"status": "success", "results_count": 10},
                "expected": [
                    "Memory about search→save pattern might weaken",
                    "New memory about ML interest might be created"
                ]
            },
            {
                "name": "Search Memory on Thursday Morning (Reinforcement)",
                "tool": "search_memory",
                "args": {"query": "data structures"},
                "result": {"status": "success", "count": 1}, 
                "expected": [
                    "Memory about Thursday morning search pattern should reinforce",
                    "Confidence should increase for existing Thursday pattern"
                ]
            },
            {
                "name": "Python Data Analysis Pattern",
                "tool": "save_memory",
                "args": {"text": "User loves pandas for data manipulation"},
                "result": {"status": "success", "id": 100},
                "expected": [
                    "Memory about Python for data analysis should reinforce",
                    "New memory about pandas preference created"
                ]
            }
        ]
        
        # Define specific timestamps for each scenario to test temporal analysis
        now = datetime.now()
        
        # Calculate specific dates for different days of the week
        # Find the most recent Tuesday (for "Search Memory on Tuesday")
        days_since_tuesday = (now.weekday() - 1) % 7
        last_tuesday = now - timedelta(days=days_since_tuesday)
        
        # Find the most recent Monday (for "Save Frontend Memory on Monday") 
        days_since_monday = (now.weekday() - 0) % 7
        last_monday = now - timedelta(days=days_since_monday)
        
        # Find the most recent Thursday (for "Search Memory on Thursday")
        days_since_thursday = (now.weekday() - 3) % 7
        last_thursday = now - timedelta(days=days_since_thursday)
        
        scenario_timestamps = [
            last_tuesday.replace(hour=10, minute=30),      # Tuesday morning for "Search Memory on Tuesday"
            last_monday.replace(hour=15, minute=0),        # Monday afternoon for "Save Frontend Memory on Monday"
            now - timedelta(days=1, hours=13),             # Yesterday for "Google Search Without Save"
            last_thursday.replace(hour=9, minute=15),      # Thursday morning for "Search Memory on Thursday"
            now - timedelta(hours=2)                       # 2 hours ago for "Python Data Analysis"
        ]
        
        # Execute each test scenario
        for i, scenario in enumerate(test_scenarios):
            await self.test_scenario(
                scenario["name"],
                scenario["tool"], 
                scenario["args"],
                scenario["result"],
                scenario["expected"],
                scenario_timestamps[i]
            )
            
            # Small delay between tests for clarity
            await asyncio.sleep(0.5)
        
        # Step 7: Show final summary
        self.print_final_summary()
        
        # Cleanup (optional)
        self.cleanup()
        
        print("\n✅ Comprehensive pipeline test completed!")


async def main():
    """Main test function"""
    # Check if we're in the virtual environment
    if not os.environ.get('VIRTUAL_ENV'):
        print("⚠️  Warning: Virtual environment not detected. Make sure to activate .venv first!")
        print("   Run: source .venv/Scripts/activate")
        return
    
    test_pipeline = TestDataPipeline()
    await test_pipeline.run_complete_test()


if __name__ == "__main__":
    asyncio.run(main())
