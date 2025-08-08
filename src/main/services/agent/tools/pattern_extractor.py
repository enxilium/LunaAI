#!/usr/bin/env python3
"""
Algorithmic Pattern Extractor for Luna AI
Extracts raw patterns and aggregations from tool execution logs
"""

import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
from collections import defaultdict, Counter
import json
from pathlib import Path


class AlgorithmicPatternExtractor:
    """Extracts raw patterns from tool execution data using algorithmic analysis"""
    
    def __init__(self, db_path: str = None):
        """Initialize with database connection"""
        if db_path is None:
            # Get the project root (go up from tools folder)
            project_root = Path(__file__).parents[5]  # Go up 5 levels from tools folder
            db_path = str(project_root / "assets" / "data" / "tool_execution.db")
        
        self.db_path = db_path
    
    def extract_temporal_patterns(self, days_back: int = 30) -> Dict[str, Any]:
        """Extract time-based usage patterns"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Get executions from the last N days
            cursor.execute("""
                SELECT tool_name, timestamp, success
                FROM tool_executions 
                WHERE timestamp >= datetime('now', '-{} days')
                ORDER BY timestamp
            """.format(days_back))
            
            executions = [dict(row) for row in cursor.fetchall()]
        
        if not executions:
            return {"message": "No tool executions found"}
        
        # Analyze temporal patterns
        patterns = {
            "total_executions": len(executions),
            "date_range": {
                "from": executions[-1]["timestamp"],
                "to": executions[0]["timestamp"]
            },
            "hourly_distribution": defaultdict(int),
            "daily_distribution": defaultdict(int),
            "tool_timing": defaultdict(list),
            "peak_hours": [],
            "tool_sequences": []
        }
        
        # Process each execution
        for execution in executions:
            timestamp = datetime.fromisoformat(execution["timestamp"])
            hour = timestamp.hour
            day_name = timestamp.strftime("%A")
            
            patterns["hourly_distribution"][hour] += 1
            patterns["daily_distribution"][day_name] += 1
            patterns["tool_timing"][execution["tool_name"]].append({
                "hour": hour,
                "day": day_name,
                "timestamp": execution["timestamp"]
            })
        
        # Find peak usage hours (top 3)
        hourly_sorted = sorted(patterns["hourly_distribution"].items(), 
                             key=lambda x: x[1], reverse=True)
        patterns["peak_hours"] = hourly_sorted[:3]
        
        # Convert defaultdicts to regular dicts for JSON serialization
        patterns["hourly_distribution"] = dict(patterns["hourly_distribution"])
        patterns["daily_distribution"] = dict(patterns["daily_distribution"])
        patterns["tool_timing"] = dict(patterns["tool_timing"])
        
        return patterns
    
    def extract_tool_usage_patterns(self, days_back: int = 30) -> Dict[str, Any]:
        """Extract tool-specific usage patterns"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Get tool usage statistics
            cursor.execute("""
                SELECT 
                    tool_name,
                    COUNT(*) as total_uses,
                    COUNT(CASE WHEN success = 1 THEN 1 END) as successful_uses,
                    COUNT(CASE WHEN success = 0 THEN 1 END) as failed_uses
                FROM tool_executions 
                WHERE timestamp >= datetime('now', '-{} days')
                GROUP BY tool_name
                ORDER BY total_uses DESC
            """.format(days_back))
            
            tool_stats = [dict(row) for row in cursor.fetchall()]
        
        # Calculate success rates
        for tool in tool_stats:
            tool["success_rate"] = (tool["successful_uses"] / tool["total_uses"]) * 100
            tool["failure_rate"] = (tool["failed_uses"] / tool["total_uses"]) * 100
        
        return {
            "tool_statistics": tool_stats,
            "most_used_tools": tool_stats[:5],
            "least_reliable_tools": sorted(tool_stats, key=lambda x: x["success_rate"])[:3]
        }
    
    def extract_sequence_patterns(self, days_back: int = 30) -> Dict[str, Any]:
        """Extract tool usage sequences and chains"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Get tool sequences by session
            cursor.execute("""
                SELECT session_id, tool_name, timestamp
                FROM tool_executions 
                WHERE timestamp >= datetime('now', '-{} days')
                ORDER BY session_id, timestamp
            """.format(days_back))
            
            executions = [dict(row) for row in cursor.fetchall()]
        
        # Group by session and find sequences
        session_sequences = defaultdict(list)
        for execution in executions:
            session_sequences[execution["session_id"]].append(execution["tool_name"])
        
        # Find common tool pairs and sequences
        tool_pairs = Counter()
        tool_triplets = Counter()
        
        for sequence in session_sequences.values():
            if len(sequence) < 2:
                continue
                
            # Count tool pairs (A -> B)
            for i in range(len(sequence) - 1):
                pair = (sequence[i], sequence[i + 1])
                tool_pairs[pair] += 1
            
            # Count tool triplets (A -> B -> C)
            for i in range(len(sequence) - 2):
                triplet = (sequence[i], sequence[i + 1], sequence[i + 2])
                tool_triplets[triplet] += 1
        
        return {
            "session_count": len(session_sequences),
            "common_tool_pairs": tool_pairs.most_common(10),
            "common_tool_triplets": tool_triplets.most_common(5),
            "average_session_length": sum(len(seq) for seq in session_sequences.values()) / len(session_sequences) if session_sequences else 0
        }
    
    def extract_behavioral_patterns(self, days_back: int = 30) -> Dict[str, Any]:
        """Extract behavioral insights from tool arguments and outputs"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Get tool inputs and outputs for analysis
            cursor.execute("""
                SELECT tool_name, tool_input, tool_output, timestamp
                FROM tool_executions 
                WHERE timestamp >= datetime('now', '-{} days')
                AND tool_input IS NOT NULL
                ORDER BY timestamp DESC
            """.format(days_back))
            
            executions = [dict(row) for row in cursor.fetchall()]
        
        # Analyze tool inputs for patterns
        input_patterns = defaultdict(list)
        search_queries = []
        
        for execution in executions:
            try:
                if execution["tool_input"]:
                    tool_input = json.loads(execution["tool_input"])
                    input_patterns[execution["tool_name"]].append(tool_input)
                    
                    # Extract search queries specifically
                    if execution["tool_name"] == "google_search" and "query" in tool_input:
                        search_queries.append({
                            "query": tool_input["query"],
                            "timestamp": execution["timestamp"]
                        })
            except (json.JSONDecodeError, TypeError):
                continue
        
        return {
            "total_analyzed_executions": len(executions),
            "tools_with_inputs": list(input_patterns.keys()),
            "search_queries": search_queries[-20:],  # Last 20 search queries
            "input_sample_size": {tool: len(inputs) for tool, inputs in input_patterns.items()}
        }
    
    def generate_pattern_summary(self, days_back: int = 30) -> Dict[str, Any]:
        """Generate a comprehensive summary of all patterns"""
        temporal = self.extract_temporal_patterns(days_back)
        usage = self.extract_tool_usage_patterns(days_back)
        sequences = self.extract_sequence_patterns(days_back)
        behavioral = self.extract_behavioral_patterns(days_back)
        
        return {
            "analysis_metadata": {
                "days_analyzed": days_back,
                "generated_at": datetime.now().isoformat(),
                "total_executions": temporal.get("total_executions", 0)
            },
            "temporal_patterns": temporal,
            "tool_usage_patterns": usage,
            "sequence_patterns": sequences,
            "behavioral_patterns": behavioral
        }
