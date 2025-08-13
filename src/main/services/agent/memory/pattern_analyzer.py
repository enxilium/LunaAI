#!/usr/bin/env python3
"""
LLM Pattern Analyzer for Luna AI
Uses Gemini to analyze raw patterns and extract actionable insights
"""

import json
import os
from typing import Dict, List, Any
from google.genai import Client
from google.genai.types import GenerateContentConfig

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))  # Add agent directory

from util import load_env
from prompts import create_analysis_prompt
from .memory_database import MemoryDatabase


class LLMPatternAnalyzer:
    """Uses LLM to analyze raw patterns and extract semantic insights"""
    
    def __init__(self, model: str = "gemini-2.5-flash"):
        """Initialize with Gemini client and memory database"""
        # Load Analyzer-specific environment when needed
        load_env('analyzer')
        api_key = os.getenv("GEMINI_API_KEY")
        self.client = Client(api_key=api_key)
        self.model = model
        self.memory_db = MemoryDatabase()
    
    async def analyze_patterns(self, raw_patterns: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze raw patterns using Gemini to extract memory modifications"""

        # Get stored memories for context
        stored_memories = self.memory_db.get_memories(min_confidence=0.1)
        
        # Create analysis prompt
        prompt, response_schema = create_analysis_prompt(raw_patterns, stored_memories)
        
        try:
            # Generate analysis using Gemini with structured output
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=prompt,
                config=GenerateContentConfig(
                    temperature=0.3,
                    response_mime_type="application/json",
                    response_schema=response_schema
                )
            )

            print(f"[Pattern Analyzer] Gemini response received:", response)
            
            if not response or not response.text:
                return {"success": False, "error": "Empty response from Gemini"}

            analysis_text = response.text.strip()
            
            if not analysis_text:
                return {"success": False, "error": "Empty analysis text from Gemini"}
            
            try:
                analysis_result = json.loads(analysis_text)
            except json.JSONDecodeError as json_error:
                return {"success": False, "error": f"JSON decode error: {json_error}", "raw_text": analysis_text}
            
            # Return memory modifications for processing by PatternRecognizer
            memory_modifications = analysis_result.get("memory_modifications", [])
            
            return {
                "success": True,
                "memory_modifications": memory_modifications,
                "modifications_count": len(memory_modifications)
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}