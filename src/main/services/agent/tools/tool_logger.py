import sqlite3
import json
import os
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path


class ToolLogger:
    def __init__(self, db_path: str = None):
        """
        Initialize the ToolLogger with SQLite database
        
        Args:
            db_path: Path to SQLite database file. If None, uses default path in assets/data
        """
        if db_path is None:
            # Get the project root (go up from tools folder)
            project_root = Path(__file__).parents[5]  # Go up 5 levels from tools folder
            assets_data_dir = project_root / "assets" / "data"
            assets_data_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(assets_data_dir / "tool_execution.db")
        
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize the SQLite database with required tables"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Create tool_executions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tool_executions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    tool_name TEXT NOT NULL,
                    tool_input TEXT,
                    tool_output TEXT,
                    success BOOLEAN NOT NULL,
                    error_message TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    context_data TEXT
                )
            """)
            
            # Create indexes for better query performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_session_id ON tool_executions(session_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_id ON tool_executions(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tool_name ON tool_executions(tool_name)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON tool_executions(timestamp)")
            
            conn.commit()
    
    def log_tool_execution(
        self,
        session_id: str,
        user_id: str,
        tool_name: str,
        tool_input: Any = None,
        tool_output: Any = None,
        success: bool = True,
        error_message: str = None,
        context_data: Dict[str, Any] = None
    ):
        """
        Log a tool execution to the database
        
        Args:
            session_id: Unique session identifier
            user_id: User identifier
            tool_name: Name of the executed tool
            tool_input: Input parameters passed to the tool
            tool_output: Output/result from the tool
            success: Whether the execution was successful
            error_message: Error message if execution failed
            context_data: Additional context information
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Serialize complex data as JSON
            tool_input_json = json.dumps(tool_input) if tool_input is not None else None
            tool_output_json = json.dumps(tool_output) if tool_output is not None else None
            context_data_json = json.dumps(context_data) if context_data is not None else None
            
            cursor.execute("""
                INSERT INTO tool_executions (
                    session_id, user_id, tool_name, tool_input, tool_output,
                    success, error_message, context_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                session_id, user_id, tool_name, tool_input_json, tool_output_json,
                success, error_message, context_data_json
            ))
            
            conn.commit()
    
    def get_tool_executions(
        self,
        session_id: str = None,
        user_id: str = None,
        tool_name: str = None,
        limit: int = 100,
        offset: int = 0
    ) -> list:
        """
        Retrieve tool executions from the database
        
        Args:
            session_id: Filter by session ID
            user_id: Filter by user ID
            tool_name: Filter by tool name
            limit: Maximum number of records to return
            offset: Number of records to skip
            
        Returns:
            List of tool execution records
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row  # Return rows as dictionaries
            cursor = conn.cursor()
            
            # Build dynamic query based on filters
            where_clauses = []
            params = []
            
            if session_id:
                where_clauses.append("session_id = ?")
                params.append(session_id)
            
            if user_id:
                where_clauses.append("user_id = ?")
                params.append(user_id)
            
            if tool_name:
                where_clauses.append("tool_name = ?")
                params.append(tool_name)
            
            where_sql = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""
            
            query = f"""
                SELECT * FROM tool_executions
                {where_sql}
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            """
            
            params.extend([limit, offset])
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            # Convert rows to dictionaries and parse JSON fields
            results = []
            for row in rows:
                record = dict(row)
                
                # Parse JSON fields back to Python objects
                if record['tool_input']:
                    try:
                        record['tool_input'] = json.loads(record['tool_input'])
                    except json.JSONDecodeError:
                        pass  # Keep as string if JSON parsing fails
                
                if record['tool_output']:
                    try:
                        record['tool_output'] = json.loads(record['tool_output'])
                    except json.JSONDecodeError:
                        pass  # Keep as string if JSON parsing fails
                
                if record['context_data']:
                    try:
                        record['context_data'] = json.loads(record['context_data'])
                    except json.JSONDecodeError:
                        pass  # Keep as string if JSON parsing fails
                
                results.append(record)
            
            return results
    
    def get_tool_usage_stats(self, user_id: str = None, days: int = 30) -> Dict[str, Any]:
        """
        Get tool usage statistics
        
        Args:
            user_id: Filter by user ID
            days: Number of days to look back
            
        Returns:
            Dictionary with usage statistics
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row  # Return rows as dictionaries
            cursor = conn.cursor()
            
            where_clause = "WHERE timestamp >= datetime('now', '-{} days')".format(days)
            if user_id:
                where_clause += " AND user_id = ?"
                params = [user_id]
            else:
                params = []
            
            # Get total executions
            cursor.execute(f"""
                SELECT COUNT(*) as total_executions,
                       COUNT(CASE WHEN success = 1 THEN 1 END) as successful_executions,
                       COUNT(CASE WHEN success = 0 THEN 1 END) as failed_executions
                FROM tool_executions {where_clause}
            """, params)
            
            row = cursor.fetchone()
            stats = {
                'total_executions': row['total_executions'],
                'successful_executions': row['successful_executions'],
                'failed_executions': row['failed_executions']
            }
            
            # Get tool usage breakdown
            cursor.execute(f"""
                SELECT tool_name, COUNT(*) as usage_count,
                       COUNT(CASE WHEN success = 1 THEN 1 END) as success_count
                FROM tool_executions {where_clause}
                GROUP BY tool_name
                ORDER BY usage_count DESC
            """, params)
            
            stats['tool_breakdown'] = [dict(row) for row in cursor.fetchall()]
            
            return stats
