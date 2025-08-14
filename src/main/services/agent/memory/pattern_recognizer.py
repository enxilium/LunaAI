#!/usr/bin/env python3
"""
Pattern Recognizer for Luna AI
Combines algorithmic pattern extraction with LLM analysis and saves insights to memory database
"""

import asyncio
import json
from datetime import datetime
from typing import Dict, List, Any

from .pattern_analyzer import LLMPatternAnalyzer
from .memory_database import MemoryDatabase


class PatternRecognizer:
    """Main pattern recognition system that combines algorithmic and LLM analysis"""
    
    def __init__(self, days_to_analyze: int = 30):
        """Initialize the pattern recognizer"""
        self.days_to_analyze = days_to_analyze
        
        # Initialize components
        self.analyzer = LLMPatternAnalyzer()
        self.memory_db = MemoryDatabase()
        
        # Track last analysis to avoid over-processing
        self.last_analysis_timestamp = None
    
    async def recognize_patterns_async(self, trigger_context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Asynchronously recognize patterns from tool execution data
        """
        # Get total tool executions count to determine if we should run analysis
        total_tool_count = len(self.memory_db.get_tool_executions(limit=1000))
        
        # In development: run on every tool call
        # In production: run every 10 tool calls
        is_development = True  # TODO: Set this based on environment
        
        if is_development:
            should_analyze = True
        else:
            should_analyze = (total_tool_count % 10 == 0)
        
        if not should_analyze:
            return {
                "skipped": True,
                "reason": f"Waiting for analysis interval (tool count: {total_tool_count})",
                "total_tool_count": total_tool_count
            }
        
        # Get ALL tool executions for comprehensive analysis
        all_tool_executions = self.memory_db.get_tool_executions(limit=100)
        
        # Get ALL stored memories for context
        stored_memories = self.memory_db.get_memories(min_confidence=0.0)
        
        # Log what we're analyzing (required log #2)
        print(f"[RELEVANT TOOLS] ALL (Total: {len(all_tool_executions)} executions)")
        
        analysis_data = {
            "tool_executions": all_tool_executions,
            "stored_memories": stored_memories,
            "total_executions": len(all_tool_executions),
            "analysis_trigger": "comprehensive_analysis"
        }
        
        # Analyze patterns with LLM
        llm_analysis = await self.analyzer.analyze_patterns(analysis_data)
        
        if not llm_analysis.get("success"):
            print(f"[PATTERN ANALYZER ERROR] {llm_analysis.get('error')}")
            return {
                "success": False,
                "error": llm_analysis.get("error"),
                "analysis_data": analysis_data
            }
        
        # Save insights to memory database
        memory_results = await self._save_insights_to_memory(llm_analysis.get("memory_modifications", []))
        
        # Print memory modifications for visibility (required log #3)
        # Wrapped in try-catch to prevent silent failures
        try:
            if memory_results.get("saved_insights"):
                print(f"[MEMORY MODIFICATIONS]:")
                for i, insight in enumerate(memory_results["saved_insights"], 1):
                    action = insight.get("action")
                    memory_text = insight.get("memory", "")
                    memory_id = insight.get("id")
                    
                    if action == "created":
                        print(f"   {i}. Created memory: '{memory_text}' (ID: {memory_id})")
                    elif action == "reinforced":
                        print(f"   {i}. Reinforced memory ID {memory_id}")
                    elif action == "weakened":
                        print(f"   {i}. Weakened memory ID {memory_id}")
                    elif action == "deleted":
                        print(f"   {i}. Deleted memory ID {memory_id}")
                    elif action == "updated":
                        print(f"   {i}. Updated memory ID {memory_id}: '{memory_text}'")
            else:
                print(f"[MEMORY MODIFICATIONS]: No changes made")
        except Exception as logging_error:
            print(f"[MEMORY MODIFICATIONS LOGGING ERROR]: {str(logging_error)}")
            print(f"[MEMORY MODIFICATIONS]: {len(memory_results.get('saved_insights', []))} modifications processed (logging failed)")
        
        # Clean up low-confidence memories
        cleanup_threshold = 0.1
        deleted_count = self.memory_db.cleanup_low_confidence_memories(cleanup_threshold)
        
        # Update last analysis timestamp
        self.last_analysis_timestamp = datetime.now().isoformat()
        
        return {
            "success": True,
            "analysis_timestamp": self.last_analysis_timestamp,
            "total_executions": len(all_tool_executions),
            "insights_saved_count": len(memory_results.get("saved_insights", [])),
            "memories_cleaned_up": deleted_count
        }
    
    def _should_skip_analysis(self) -> bool:
        """Check if analysis should be skipped based on timing - DISABLED FOR TESTING"""
        # Disable throttling for comprehensive testing
        return False
    
    async def _save_insights_to_memory(self, memory_modifications: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process memory modifications and save pattern insights to database"""
        saved_insights = []
        failed_saves = []
        
        # Process each memory modification through the database
        for i, mod in enumerate(memory_modifications, 1):
            try:
                action = mod.get("action")
                memory_id = mod.get("id")
                memory_text = mod.get("memory")
                
                if action == "create" and memory_text:
                    new_id = self.memory_db.add_memory(memory_text, confidence=0.5)
                    saved_insights.append({
                        "action": "created",
                        "id": new_id,
                        "memory": memory_text
                    })
                
                elif action == "reinforce" and memory_id:
                    success = self.memory_db.reinforce_memory(memory_id)
                    if success:
                        saved_insights.append({
                            "action": "reinforced",
                            "id": memory_id
                        })
                    else:
                        failed_saves.append({"action": action, "id": memory_id, "error": "Reinforce failed"})
                
                elif action == "weaken" and memory_id:
                    result = self.memory_db.weaken_memory(memory_id)
                    if result == "deleted":
                        saved_insights.append({
                            "action": "deleted",
                            "id": memory_id
                        })
                    elif result:
                        saved_insights.append({
                            "action": "weakened",
                            "id": memory_id
                        })
                    else:
                        failed_saves.append({"action": action, "id": memory_id, "error": "Weaken failed"})
                
                elif action == "update_content" and memory_id and memory_text:
                    success = self.memory_db.update_memory_content(memory_id, memory_text)
                    if success:
                        saved_insights.append({
                            "action": "updated",
                            "id": memory_id,
                            "memory": memory_text
                        })
                    else:
                        failed_saves.append({"action": action, "id": memory_id, "error": "Update failed"})
                        
            except Exception as e:
                failed_saves.append({
                    "action": mod.get("action"),
                    "id": mod.get("id"),
                    "error": str(e)
                })
        
        return {
            "saved_insights": saved_insights,
            "failed_saves": failed_saves,
            "modifications_processed": len(memory_modifications),
            "success": len(failed_saves) == 0,
            "timestamp": datetime.now().isoformat()
        }
    
    async def get_relevant_insights(self) -> List[Dict[str, Any]]:
        """Retrieve relevant insights from memory using deterministic category filtering"""
        # Get all memories with learned_behaviors category
        memories = self.memory_db.get_memories(min_confidence=0.3)
        
        # Filter by category
        learned_behaviors = []
        for memory in memories:
            metadata = memory.get("metadata", {})
            if metadata.get("category") == "learned_behaviors":
                learned_behaviors.append(memory)
        
        return learned_behaviors