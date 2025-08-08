#!/usr/bin/env python3
"""
Pattern Recognizer for Luna AI
Combines algorithmic pattern extraction with LLM analysis and saves insights to Mem0
"""

import asyncio
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path

from .pattern_extractor import AlgorithmicPatternExtractor
from .pattern_analyzer import LLMPatternAnalyzer
from .util import save_memory, search_memory


class PatternRecognizer:
    """Main pattern recognition system that combines algorithmic and LLM analysis"""
    
    def __init__(self, user_id: str = "default", days_to_analyze: int = 30):
        """Initialize the pattern recognizer"""
        self.user_id = user_id
        self.days_to_analyze = days_to_analyze
        
        # Initialize components
        self.extractor = AlgorithmicPatternExtractor()
        self.analyzer = LLMPatternAnalyzer()
        
        # Track last analysis to avoid over-processing
        self.last_analysis_timestamp = None
        self.min_analysis_interval_minutes = 30  # Don't analyze more than once per 30 minutes
    
    async def recognize_patterns_async(self, trigger_context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Asynchronously recognize patterns from tool execution data
        
        Args:
            trigger_context: Context about what triggered this analysis (optional)
            
        Returns:
            Dictionary containing analysis results and saved insights
        """
        try:
            # Check if we should skip analysis (too soon since last run)
            if self._should_skip_analysis():
                return {
                    "skipped": True,
                    "reason": "Analysis interval not met",
                    "last_analysis": self.last_analysis_timestamp
                }
            
            print(f"[PATTERN] Starting pattern recognition for user {self.user_id}...")
            
            # Step 1: Extract raw patterns algorithmically
            print("[PATTERN] Extracting algorithmic patterns...")
            raw_patterns = self.extractor.generate_pattern_summary(self.days_to_analyze)
            
            if raw_patterns.get("analysis_metadata", {}).get("total_executions", 0) < 5:
                print("[PATTERN] WARNING: Insufficient data for meaningful analysis")
                return {
                    "skipped": True,
                    "reason": "Insufficient data (< 5 executions)",
                    "total_executions": raw_patterns.get("analysis_metadata", {}).get("total_executions", 0)
                }
            
            # Step 2: Analyze patterns with LLM
            llm_analysis = await self.analyzer.analyze_patterns(raw_patterns)
            
            if not llm_analysis.get("success"):
                print(f"[PATTERN] ERROR: LLM analysis failed: {llm_analysis.get('error')}")
                return {
                    "success": False,
                    "error": llm_analysis.get("error"),
                    "raw_patterns": raw_patterns
                }
            
            # Step 3: Save insights to Mem0
            print("[PATTERN] Saving insights to memory...")
            memory_results = await self._save_insights_to_memory(llm_analysis["insights"], raw_patterns)
            
            # Step 4: Generate proactive suggestions
            print("[PATTERN] Generating proactive suggestions...")
            suggestions = await self.analyzer.generate_proactive_suggestions(
                llm_analysis, trigger_context
            )
            
            # Update last analysis timestamp
            self.last_analysis_timestamp = datetime.now().isoformat()
            
            result = {
                "success": True,
                "analysis_timestamp": self.last_analysis_timestamp,
                "raw_patterns_summary": {
                    "total_executions": raw_patterns.get("analysis_metadata", {}).get("total_executions"),
                    "days_analyzed": self.days_to_analyze,
                    "peak_hours": raw_patterns.get("temporal_patterns", {}).get("peak_hours", []),
                    "most_used_tools": [tool["tool_name"] for tool in raw_patterns.get("tool_usage_patterns", {}).get("most_used_tools", [])[:3]]
                },
                "llm_insights": llm_analysis["insights"],
                "memory_results": memory_results,
                "proactive_suggestions": suggestions,
                "insights_saved_count": len(memory_results.get("saved_insights", []))
            }
            
            print(f"[PATTERN] SUCCESS: Pattern recognition completed! Saved {result['insights_saved_count']} insights to memory")
            return result
            
        except Exception as e:
            print(f"[PATTERN] ERROR: Error in pattern recognition: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def _should_skip_analysis(self) -> bool:
        """Check if analysis should be skipped based on timing"""
        if not self.last_analysis_timestamp:
            return False
        
        try:
            last_analysis = datetime.fromisoformat(self.last_analysis_timestamp)
            now = datetime.now()
            minutes_since_last = (now - last_analysis).total_seconds() / 60
            
            return minutes_since_last < self.min_analysis_interval_minutes
        except:
            return False
    
    async def _save_insights_to_memory(self, insights: Dict[str, Any], raw_patterns: Dict[str, Any]) -> Dict[str, Any]:
        """Save analyzed insights to Mem0 memory system - only user preferences and behavioral insights"""
        saved_insights = []
        failed_saves = []
        
        try:
            # Save behavioral insights only (things the agent can learn from)
            for insight in insights.get("behavioral_insights", []):
                if insight.get("confidence", 0) >= 0.7:  # Higher threshold for behavioral insights
                    memory_text = f"User behavior: {insight['insight']}. Evidence: {insight['evidence']}"
                    
                    try:
                        result = await save_memory(
                            text=memory_text,
                            user_id=self.user_id,
                            metadata={
                                "type": "behavioral_insight",
                                "confidence": insight["confidence"],
                                "insight_type": insight["type"],
                                "analysis_date": datetime.now().isoformat()
                            }
                        )
                        print(f"[MEMORY] Saved behavioral insight: {memory_text}")
                        print(f"[MEMORY] Result: {result}")
                        
                        saved_insights.append({
                            "type": "behavioral_insight",
                            "insight": insight["insight"],
                            "memory_id": result.get("id")
                        })
                    except Exception as e:
                        print(f"[MEMORY] Failed to save behavioral insight: {e}")
                        failed_saves.append({"insight": insight["insight"], "error": str(e)})
            
            # Save user preferences only (personalization data)
            for preference in insights.get("user_preferences", []):
                if preference.get("strength") in ["strong", "moderate"]:
                    memory_text = f"User prefers: {preference['preference']} ({preference['category']}). Strength: {preference['strength']}. Evidence: {preference['evidence']}"
                    
                    try:
                        result = await save_memory(
                            text=memory_text,
                            user_id=self.user_id,
                            metadata={
                                "type": "user_preference",
                                "category": preference["category"],
                                "strength": preference["strength"],
                                "analysis_date": datetime.now().isoformat()
                            }
                        )
                        print(f"[MEMORY] Saved user preference: {memory_text}")
                        print(f"[MEMORY] Result: {result}")
                        
                        saved_insights.append({
                            "type": "user_preference",
                            "preference": preference["preference"],
                            "memory_id": result.get("id")
                        })
                    except Exception as e:
                        print(f"[MEMORY] Failed to save user preference: {e}")
                        failed_saves.append({"preference": preference["preference"], "error": str(e)})
            
            return {
                "saved_insights": saved_insights,
                "failed_saves": failed_saves,
                "total_saved": len(saved_insights),
                "total_failed": len(failed_saves)
            }
            
        except Exception as e:
            print(f"[MEMORY] Error in _save_insights_to_memory: {e}")
            return {
                "saved_insights": [],
                "failed_saves": [{"error": str(e)}],
                "total_saved": 0,
                "total_failed": 1
            }
    
    async def get_relevant_insights(self, query: str = None, limit: int = 5) -> List[Dict[str, Any]]:
        """Retrieve relevant insights from memory"""
        try:
            if query:
                # Search for specific insights
                results = await search_memory(query=query, user_id=self.user_id, limit=limit)
            else:
                # Get recent behavioral insights
                results = await search_memory(
                    query="user behavior pattern preference optimization", 
                    user_id=self.user_id, 
                    limit=limit
                )
            
            return results if results else []
            
        except Exception as e:
            print(f"Error retrieving insights: {e}")
            return []
    
    # Synchronous wrapper for integration
    def recognize_patterns(self, trigger_context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Synchronous wrapper for pattern recognition"""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If already in an async context, create a new task
                task = asyncio.create_task(self.recognize_patterns_async(trigger_context))
                return {"task_created": True, "message": "Pattern recognition running asynchronously"}
            else:
                # Run in new event loop
                return loop.run_until_complete(self.recognize_patterns_async(trigger_context))
        except Exception as e:
            return {"success": False, "error": str(e)}
