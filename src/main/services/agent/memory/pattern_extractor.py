#!/usr/bin/env python3
"""
Algorithmic Pattern Extractor for Luna AI
Extracts raw patterns and aggregations from tool execution logs
"""

from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
from collections import defaultdict, Counter
import json

from .memory_database import MemoryDatabase


class AlgorithmicPatternExtractor:
    """Extracts raw patterns from tool execution data using algorithmic analysis"""
    
    def __init__(self):
        """Initialize with memory database connection"""
        self.memory_db = MemoryDatabase.get_instance()
    
    def extract_temporal_patterns(self, days_back: int = 30) -> Dict[str, Any]:
        """Extract time-based usage patterns"""
        # Get tool executions from memory database
        executions = self.memory_db.get_tool_executions(limit=1000)
        
        # Filter by date
        cutoff_date = datetime.now() - timedelta(days=days_back)
        filtered_executions = []
        for exec in executions:
            exec_time = datetime.fromisoformat(exec['timestamp'].replace('Z', '+00:00'))
            if exec_time >= cutoff_date:
                filtered_executions.append(exec)
        
        if not filtered_executions:
            return {"message": "No tool executions found"}
        
        # Analyze temporal patterns
        patterns = {
            "total_executions": len(filtered_executions),
            "date_range": {
                "from": filtered_executions[-1]["timestamp"],
                "to": filtered_executions[0]["timestamp"]
            },
            "hourly_distribution": defaultdict(int),
            "daily_distribution": defaultdict(int),
            "tool_timing": defaultdict(list),
            "peak_hours": [],
            "tool_sequences": []
        }
        
        # Process each execution
        for execution in filtered_executions:
            timestamp = datetime.fromisoformat(execution["timestamp"])
            hour = timestamp.hour
            day_name = timestamp.strftime("%A")
            
            patterns["hourly_distribution"][hour] += 1
            patterns["daily_distribution"][day_name] += 1
            patterns["tool_timing"][execution["tool"]].append({
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
        # Get tool executions from memory database
        executions = self.memory_db.get_tool_executions(limit=1000)
        
        # Filter by date and count tool usage
        cutoff_date = datetime.now() - timedelta(days=days_back)
        tool_counts = defaultdict(int)
        
        for exec in executions:
            exec_time = datetime.fromisoformat(exec['timestamp'].replace('Z', '+00:00'))
            if exec_time >= cutoff_date:
                tool_counts[exec['tool']] += 1
        
        # Sort by usage count
        tool_stats = [{"tool": tool, "total_uses": count} 
                     for tool, count in sorted(tool_counts.items(), key=lambda x: x[1], reverse=True)]
        
        return {
            "tool_statistics": tool_stats,
            "most_used_tools": tool_stats[:5]
        }
    
    def extract_sequence_patterns(self, days_back: int = 30) -> Dict[str, Any]:
        """Extract tool usage sequences and chains based on timestamp proximity"""
        # Get tool executions from memory database
        executions = self.memory_db.get_tool_executions(limit=1000)
        
        # Filter by date and sort by timestamp
        cutoff_date = datetime.now() - timedelta(days=days_back)
        filtered_executions = []
        for exec in executions:
            exec_time = datetime.fromisoformat(exec['timestamp'].replace('Z', '+00:00'))
            if exec_time >= cutoff_date:
                filtered_executions.append({"tool": exec["tool"], "timestamp": exec["timestamp"]})
        
        # Sort by timestamp
        filtered_executions.sort(key=lambda x: x["timestamp"])
        
        # Group by time proximity (within 5 minutes = potential sequence)
        sequences = []
        current_sequence = []
        
        for i, execution in enumerate(filtered_executions):
            if i == 0:
                current_sequence = [execution["tool"]]
                continue
                
            # Check if this execution is within 5 minutes of the last one
            current_time = datetime.fromisoformat(execution["timestamp"])
            prev_time = datetime.fromisoformat(filtered_executions[i-1]["timestamp"])
            time_diff = (current_time - prev_time).total_seconds()
            
            if time_diff <= 300:  # 5 minutes
                current_sequence.append(execution["tool"])
            else:
                if len(current_sequence) > 1:
                    sequences.append(current_sequence)
                current_sequence = [execution["tool"]]
        
        # Add the last sequence if it has multiple tools
        if len(current_sequence) > 1:
            sequences.append(current_sequence)
        
        # Find common tool pairs and sequences
        tool_pairs = Counter()
        tool_triplets = Counter()
        
        for sequence in sequences:
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
            "sequence_count": len(sequences),
            "common_tool_pairs": tool_pairs.most_common(10),
            "common_tool_triplets": tool_triplets.most_common(5),
            "average_sequence_length": sum(len(seq) for seq in sequences) / len(sequences) if sequences else 0
        }
    
    def extract_behavioral_patterns(self, days_back: int = 30) -> Dict[str, Any]:
        """Extract behavioral insights from tool arguments and context"""
        # Get tool executions from memory database
        executions = self.memory_db.get_tool_executions(limit=1000)
        
        # Filter by date and only include those with arguments
        cutoff_date = datetime.now() - timedelta(days=days_back)
        filtered_executions = []
        
        for exec in executions:
            exec_time = datetime.fromisoformat(exec['timestamp'].replace('Z', '+00:00'))
            if exec_time >= cutoff_date and exec.get('arguments'):
                filtered_executions.append(exec)
        
        # Analyze tool inputs for patterns
        input_patterns = defaultdict(list)
        search_queries = []
        
        for execution in filtered_executions:
            tool_arguments = execution["arguments"]  # Already parsed by MemoryDatabase
            input_patterns[execution["tool"]].append(tool_arguments)
            
            # Extract search queries specifically
            if execution["tool"] == "google_search" and "query" in tool_arguments:
                search_queries.append({
                    "query": tool_arguments["query"],
                    "timestamp": execution["timestamp"]
                })
                continue
        
        return {
            "total_analyzed_executions": len(executions),
            "tools_with_inputs": list(input_patterns.keys()),
            "search_queries": search_queries[-20:],  # Last 20 search queries
            "input_sample_size": {tool: len(inputs) for tool, inputs in input_patterns.items()}
        }
    
    def extract_similar_tool_patterns(self, target_tool: str = None, days_back: int = 30) -> Dict[str, Any]:
        """Extract patterns focusing only on RELEVANT tools with strict filtering"""
        # Get tool executions from memory database
        executions = self.memory_db.get_tool_executions(limit=1000)
        
        # If no target tool specified, find the most recent tool execution
        if not target_tool and executions:
            target_tool = executions[0]["tool"]  # Most recent (already sorted by timestamp DESC)
        elif not target_tool:
            return {"message": "No tool executions found"}
        
        # Apply strict relevance filtering
        relevant_executions = self._filter_relevant_executions(executions, target_tool, days_back)
        
        if len(relevant_executions) < 2:
            return {
                "message": f"Insufficient relevant data for tool: {target_tool}",
                "relevant_executions_found": len(relevant_executions),
                "analysis_metadata": {
                    "target_tool": target_tool,
                    "total_executions": len(relevant_executions)
                }
            }
        
        # Analyze temporal clustering for relevant executions only
        temporal_clusters = defaultdict(list)
        success_patterns = {"successful": [], "failed": []}
        argument_patterns = defaultdict(list)
        
        for execution in relevant_executions:
            timestamp = datetime.fromisoformat(execution["timestamp"])
            day_of_week = timestamp.strftime("%A")
            hour = timestamp.hour
            
            # Group by day of week and hour for clustering
            temporal_key = f"{day_of_week}_{hour:02d}"
            temporal_clusters[temporal_key].append(execution)
            
            # Track argument patterns for similar behavior detection
            if execution.get("arguments"):
                tool_name = execution["tool"]
                argument_patterns[tool_name].append({
                    "arguments": execution["arguments"],
                    "timestamp": execution["timestamp"]
                })
            
            # Analyze success patterns
            try:
                result = json.loads(execution["result"]) if execution["result"] else {}
                is_successful = result.get("success", True)  # Default to success if not specified
            except (json.JSONDecodeError, TypeError):
                is_successful = True  # Default to success if result parsing fails
            
            if is_successful:
                success_patterns["successful"].append(execution)
            else:
                success_patterns["failed"].append(execution)
        
        # Find similar behavioral patterns within relevant executions
        behavioral_clusters = self._extract_behavioral_clusters(relevant_executions)
        
        return {
            "analysis_metadata": {
                "target_tool": target_tool,
                "days_analyzed": days_back,
                "generated_at": datetime.now().isoformat(),
                "total_executions": len(relevant_executions),
                "relevance_filtering": "strict"
            },
            "tool_specific_patterns": {
                "total_relevant_uses": len(relevant_executions),
                "success_rate": len(success_patterns["successful"]) / len(relevant_executions) if relevant_executions else 0,
                "temporal_distribution": dict(temporal_clusters),
                "behavioral_clusters": behavioral_clusters,
                "argument_patterns": dict(argument_patterns)
            },
            "success_analysis": {
                "successful_executions": len(success_patterns["successful"]),
                "failed_executions": len(success_patterns["failed"]),
                "recent_successes": success_patterns["successful"][-3:],  # Last 3 successful
                "recent_failures": success_patterns["failed"][-2:]      # Last 2 failed
            }
        }
    
    def _filter_relevant_executions(self, executions: List[Dict], target_tool: str, days_back: int) -> List[Dict]:
        """Apply strict relevance filtering to tool executions"""
        cutoff_date = datetime.now() - timedelta(days=days_back)
        target_execution = None
        
        # Find the most recent execution of the target tool
        for exec in executions:
            if exec["tool"] == target_tool:
                target_execution = exec
                break
        
        if not target_execution:
            return []
        
        relevant_executions = []
        target_timestamp = datetime.fromisoformat(target_execution["timestamp"])
        target_keywords = self._extract_key_terms(target_execution.get("arguments", {}))
        
        # Define tool relationship categories
        related_tools = self._get_related_tools(target_tool)
        
        for exec in executions:
            exec_time = datetime.fromisoformat(exec['timestamp'].replace('Z', '+00:00'))
            
            # Skip if outside date range
            if exec_time < cutoff_date:
                continue
            
            tool_name = exec["tool"]
            
            # Include if it's the exact same tool
            if tool_name == target_tool:
                relevant_executions.append(exec)
                continue
            
            # Include if it's a related tool AND within temporal proximity
            if tool_name in related_tools:
                time_diff = abs((exec_time - target_timestamp).total_seconds())
                
                # More strict temporal filtering - within 2 hours of target execution
                if time_diff <= 7200:  # 2 hours
                    relevant_executions.append(exec)
                    continue
                
                # OR if it has similar arguments/context
                if self._has_similar_context(exec, target_execution):
                    relevant_executions.append(exec)
                    continue
            
            # Include if arguments suggest related intent (e.g., similar search queries)
            if self._has_related_intent(exec, target_execution):
                relevant_executions.append(exec)
                continue
            
            # NEW: Include if tool has similar keywords/arguments regardless of tool type
            exec_keywords = self._extract_key_terms(exec.get("arguments", {}))
            keyword_overlap = len(target_keywords.intersection(exec_keywords))
            if keyword_overlap >= 1 and target_keywords and exec_keywords:
                # Only include if the overlap is meaningful (not just common words)
                meaningful_overlap = any(
                    keyword in target_keywords and len(keyword) > 3 
                    for keyword in exec_keywords 
                    if keyword in target_keywords
                )
                if meaningful_overlap:
                    relevant_executions.append(exec)
                    continue
        
        # Sort by timestamp (most recent first) and limit to prevent overwhelm
        relevant_executions.sort(key=lambda x: x["timestamp"], reverse=True)
        return relevant_executions[:20]  # Limit to 20 most relevant executions
    
    def _get_related_tools(self, target_tool: str) -> set:
        """Define which tools are considered related to the target tool"""
        # Music-related tools
        music_tools = {"play_song", "pause_music", "next_song", "previous_song", "set_volume", 
                      "search_spotify", "add_to_playlist", "save_track"}
        
        # Search-related tools  
        search_tools = {"google_search", "search_memory", "search_spotify", "search_notion"}
        
        # Navigation/browsing tools
        browse_tools = {"open_url", "navigate_to", "click_element", "scroll_page"}
        
        # Memory tools
        memory_tools = {"save_memory", "search_memory", "modify_memory", "delete_memory"}
        
        # File/document tools
        file_tools = {"read_file", "write_file", "create_document", "edit_document"}
        
        # Communication tools
        comm_tools = {"send_email", "send_message", "make_call"}
        
        # Determine related tools based on target
        if target_tool in music_tools:
            return music_tools
        elif target_tool in search_tools:
            return search_tools
        elif target_tool in browse_tools:
            return browse_tools
        elif target_tool in memory_tools:
            return memory_tools
        elif target_tool in file_tools:
            return file_tools
        elif target_tool in comm_tools:
            return comm_tools
        else:
            # For unknown tools, only include the exact same tool
            return {target_tool}
    
    def _has_similar_context(self, exec1: Dict, exec2: Dict) -> bool:
        """Check if two executions have similar context/arguments"""
        args1 = exec1.get("arguments", {})
        args2 = exec2.get("arguments", {})
        
        if not args1 or not args2:
            return False
        
        # For search tools, check query similarity
        if exec1["tool"] in ["google_search", "search_spotify"] and exec2["tool"] in ["google_search", "search_spotify"]:
            query1 = args1.get("query", "").lower()
            query2 = args2.get("query", "").lower()
            
            if query1 and query2:
                # Simple keyword overlap check
                words1 = set(query1.split())
                words2 = set(query2.split())
                overlap = len(words1.intersection(words2))
                return overlap >= 2  # At least 2 common words
        
        # For music tools, check artist/song similarity
        if exec1["tool"] in ["play_song", "search_spotify"] and exec2["tool"] in ["play_song", "search_spotify"]:
            # Check for artist or track name overlap
            for key in ["artist", "track", "song", "query"]:
                val1 = str(args1.get(key, "")).lower()
                val2 = str(args2.get(key, "")).lower()
                if val1 and val2 and (val1 in val2 or val2 in val1):
                    return True
        
        return False
    
    def _has_related_intent(self, exec1: Dict, exec2: Dict) -> bool:
        """Check if two executions suggest related user intent"""
        args1 = exec1.get("arguments", {})
        args2 = exec2.get("arguments", {})
        
        # Extract key terms from arguments
        terms1 = self._extract_key_terms(args1)
        terms2 = self._extract_key_terms(args2)
        
        if not terms1 or not terms2:
            return False
        
        # Check for term overlap
        overlap = len(terms1.intersection(terms2))
        return overlap >= 1  # At least 1 common meaningful term
    
    def _extract_key_terms(self, arguments: Dict) -> set:
        """Extract meaningful terms from tool arguments"""
        terms = set()
        
        for key, value in arguments.items():
            if isinstance(value, str) and len(value) > 2:
                # Extract words longer than 2 characters
                words = [word.lower().strip() for word in value.split() if len(word) > 2]
                # Filter out common stop words
                stop_words = {"the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now", "old", "see", "two", "who", "boy", "did", "man", "way", "where", "with", "this", "that", "they", "will", "from", "have", "been", "said", "each", "which", "what", "were", "when", "more", "than", "into", "very", "after", "first", "well", "just", "like", "over", "also", "back", "other", "many", "then", "them", "these", "some", "time", "would", "could", "should", "about", "there", "their", "only", "come", "work", "know", "take", "year", "good", "much", "make", "most", "long", "little", "great", "right", "still", "small", "large", "such", "here", "even", "both", "last", "next", "same", "find", "give", "place", "want", "need", "seem", "high", "every", "between", "never", "being", "again", "around", "through", "during", "before", "another", "too"}
                meaningful_words = [word for word in words if word not in stop_words]
                terms.update(meaningful_words)
            elif isinstance(value, list):
                # Handle lists of strings (like playlist names)
                for item in value:
                    if isinstance(item, str) and len(item) > 2:
                        words = [word.lower().strip() for word in item.split() if len(word) > 2]
                        stop_words = {"the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now", "old", "see", "two", "who", "boy", "did", "man", "way", "where", "with"}
                        meaningful_words = [word for word in words if word not in stop_words]
                        terms.update(meaningful_words)
        
        return terms
    
    def _extract_behavioral_clusters(self, executions: List[Dict]) -> Dict[str, Any]:
        """Extract behavioral patterns from filtered relevant executions"""
        if len(executions) < 3:
            return {"message": "Insufficient data for behavioral clustering"}
        
        # Group by similar time patterns (hour of day)
        time_clusters = defaultdict(list)
        
        for exec in executions:
            timestamp = datetime.fromisoformat(exec["timestamp"])
            hour_block = timestamp.hour // 3  # Group into 3-hour blocks
            time_clusters[f"block_{hour_block}"].append(exec)
        
        # Find clusters with 3+ executions (strong evidence)
        significant_clusters = {}
        for block, execs in time_clusters.items():
            if len(execs) >= 3:
                significant_clusters[block] = {
                    "execution_count": len(execs),
                    "tools_used": list(set(exec["tool"] for exec in execs)),
                    "time_range": f"{(int(block.split('_')[1]) * 3):02d}:00-{(int(block.split('_')[1]) * 3 + 3):02d}:00"
                }
        
        return {
            "total_time_clusters": len(time_clusters),
            "significant_clusters": significant_clusters,
            "cluster_threshold": 3
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
    
    def generate_similar_tool_summary(self, target_tool: str = None, days_back: int = 30) -> Dict[str, Any]:
        """Generate pattern summary focusing only on similar tools and timestamps"""
        similar_patterns = self.extract_similar_tool_patterns(target_tool, days_back)
        
        return {
            "analysis_type": "similar_tool_focus",
            "similar_tool_patterns": similar_patterns
        }
