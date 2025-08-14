#!/usr/bin/env python3
"""
SQLite-based Memory Database for Luna AI
Simple, efficient memory storage with confidence scores
"""

import sqlite3
import json
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path

class MemoryDatabase:
    """SQLite-based memory storage with confidence scoring"""
    
    def __init__(self, db_path: str = None):
        """Initialize with database connection"""
        if db_path is None:
            # Get the project root and place memory db in assets/data
            project_root = Path(__file__).parents[5]  # Go up 5 levels
            db_path = str(project_root / "assets" / "data" / "luna_memory.db")
        
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        """Initialize database schema"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Create memories table - simple 4 column structure
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS memories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    memory TEXT NOT NULL,
                    confidence REAL DEFAULT 0.5,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create tool_executions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tool_executions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tool TEXT NOT NULL,
                    arguments TEXT,
                    result TEXT,
                    context TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create indices for performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_memories_confidence ON memories(confidence DESC)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(last_updated DESC)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tool_executions_tool ON tool_executions(tool)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tool_executions_timestamp ON tool_executions(timestamp)")
            
            conn.commit()
    
    def add_memory(self, memory: str, confidence: float = 0.5) -> int:
        """Add a new memory to the database"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO memories (memory, confidence)
                VALUES (?, ?)
            """, (memory, confidence))
            
            conn.commit()
            return cursor.lastrowid
    
    def get_memories(self, min_confidence: float = 0.0, limit: int = None) -> List[Dict[str, Any]]:
        """Retrieve memories above confidence threshold"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            query = """
                SELECT id, memory, confidence, last_updated
                FROM memories 
                WHERE confidence >= ?
                ORDER BY confidence DESC, last_updated DESC
            """
            
            if limit:
                query += f" LIMIT {limit}"
            
            cursor.execute(query, (min_confidence,))
            
            memories = []
            for row in cursor.fetchall():
                memories.append(dict(row))
            
            return memories
    
    def reinforce_memory(self, memory_id: int, factor: float = 0.1):
        """Reinforce a memory by increasing its confidence"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT confidence FROM memories WHERE id = ?", (memory_id,))
            result = cursor.fetchone()
            
            if result:
                current_confidence = result[0]
                # Increase confidence with diminishing returns (can't exceed 1.0)
                new_confidence = min(1.0, current_confidence + factor * (1.0 - current_confidence))
                
                cursor.execute("""
                    UPDATE memories 
                    SET confidence = ?, last_updated = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (new_confidence, memory_id))
                
                conn.commit()
                return True
            return False
    
    def weaken_memory(self, memory_id: int, factor: float = 0.2, auto_cleanup_threshold: float = 0.1):
        """Weaken a memory by decreasing its confidence and auto-cleanup if below threshold"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT confidence FROM memories WHERE id = ?", (memory_id,))
            result = cursor.fetchone()
            
            if result:
                current_confidence = result[0]
                # Decrease confidence (can't go below 0.0)
                new_confidence = max(0.0, current_confidence * (1.0 - factor))
                
                # If confidence drops below threshold, delete the memory
                if new_confidence < auto_cleanup_threshold:
                    cursor.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
                    conn.commit()
                    return "deleted"
                else:
                    cursor.execute("""
                        UPDATE memories 
                        SET confidence = ?, last_updated = CURRENT_TIMESTAMP
                        WHERE id = ?
                    """, (new_confidence, memory_id))
                    conn.commit()
                    return True
            return False
    
    def search_similar_memories(self, query: str, min_confidence: float = 0.3) -> List[Dict[str, Any]]:
        """Simple text-based similarity search (will be enhanced later)"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Simple keyword matching for now
            search_terms = query.lower().split()
            like_conditions = " OR ".join(["LOWER(memory) LIKE ?" for _ in search_terms])
            like_params = [f"%{term}%" for term in search_terms]
            
            cursor.execute(f"""
                SELECT id, memory, confidence, last_updated
                FROM memories 
                WHERE confidence >= ? AND ({like_conditions})
                ORDER BY confidence DESC, last_updated DESC
                LIMIT 20
            """, [min_confidence] + like_params)
            
            memories = []
            for row in cursor.fetchall():
                memories.append(dict(row))
            
            return memories
    
    def cleanup_low_confidence_memories(self, threshold: float = 0.1):
        """Remove memories below confidence threshold"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM memories WHERE confidence < ?", (threshold,))
            deleted_count = cursor.rowcount
            conn.commit()
            
            return deleted_count
    
    def log_tool_execution(self, tool_name: str, tool_arguments: Any = None, tool_result: Any = None, context: str = None, timestamp: datetime = None):
        """Log a tool execution to the database"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            arguments_json = json.dumps(tool_arguments) if tool_arguments is not None else None
            result_json = json.dumps(tool_result) if tool_result is not None else None
            
            if timestamp:
                # Use custom timestamp in ISO format
                timestamp_str = timestamp.isoformat()
            else:
                # Use current timestamp in ISO format (consistent with custom timestamps)
                timestamp_str = datetime.now().isoformat()
            
            cursor.execute("""
                INSERT INTO tool_executions (tool, arguments, result, context, timestamp)
                VALUES (?, ?, ?, ?, ?)
            """, (tool_name, arguments_json, result_json, context, timestamp_str))
            
            conn.commit()
            return cursor.lastrowid
    
    def get_tool_executions(self, tool_name: str = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieve tool executions from the database"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            if tool_name:
                cursor.execute("""
                    SELECT * FROM tool_executions 
                    WHERE tool = ? 
                    ORDER BY timestamp DESC 
                    LIMIT ?
                """, (tool_name, limit))
            else:
                cursor.execute("""
                    SELECT * FROM tool_executions 
                    ORDER BY timestamp DESC 
                    LIMIT ?
                """, (limit,))
            
            results = []
            for row in cursor.fetchall():
                record = dict(row)
                if record['arguments']:
                    record['arguments'] = json.loads(record['arguments'])
                if record.get('result'):
                    record['result'] = json.loads(record['result'])
                results.append(record)
            
            return results
    
    def update_memory_content(self, memory_id: int, new_text: str) -> bool:
        """Update memory text"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE memories 
                SET memory = ?, last_updated = CURRENT_TIMESTAMP 
                WHERE id = ?
            """, (new_text, memory_id))
            
            conn.commit()
            return cursor.rowcount > 0
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Memory stats
            cursor.execute("SELECT COUNT(*) FROM memories")
            total_memories = cursor.fetchone()[0]
            
            cursor.execute("SELECT AVG(confidence) FROM memories")
            avg_confidence = cursor.fetchone()[0] or 0.0
            
            cursor.execute("SELECT COUNT(*) FROM memories WHERE confidence >= 0.7")
            high_confidence_memories = cursor.fetchone()[0]
            
            return {
                "total_memories": total_memories,
                "average_confidence": round(avg_confidence, 3),
                "high_confidence_memories": high_confidence_memories
            }
    
    def clear_all_data(self):
        """Clear all data from the database for testing purposes and reset ID counters"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM memories")
            cursor.execute("DELETE FROM tool_executions")
            # Reset auto-increment counters
            cursor.execute("DELETE FROM sqlite_sequence WHERE name='memories'")
            cursor.execute("DELETE FROM sqlite_sequence WHERE name='tool_executions'")
            conn.commit()
            return cursor.rowcount
