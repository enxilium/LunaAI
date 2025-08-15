#!/usr/bin/env python3
"""
LLM Pattern Analyzer for Luna AI
Uses Gemini to analyze raw patterns and extract actionable insights
"""

import json
import os
import asyncio
from typing import Dict, List, Any

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))  # Add agent directory

from util import load_env
from prompts import create_analysis_prompt
from .memory_database import MemoryDatabase

# Load analyzer environment BEFORE importing google.genai to avoid API key warnings
load_env('analyzer')

from google.genai import Client
from google.genai.types import GenerateContentConfig

class LLMPatternAnalyzer:
    """Uses LLM to analyze raw patterns and extract semantic insights"""
    
    def __init__(self, model: str = "gemini-2.5-flash"):
        """Initialize with Gemini client and memory database"""
        # Load Analyzer-specific environment when needed
        api_key = os.getenv("GEMINI_API_KEY")
        
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment")
        
        self.client = Client(api_key=api_key)
        self.model = model
        self.memory_db = MemoryDatabase.get_instance()
    
    async def analyze_patterns(self, analysis_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze patterns using Gemini to extract memory modifications"""

        # Create analysis prompt with system instructions
        prompt, response_schema, system_instruction = create_analysis_prompt(analysis_data)
        
        try:
            print("Calling Gemini for analysis...")

            response = await asyncio.wait_for(
                self.client.aio.models.generate_content(
                    model=self.model,
                    contents=prompt,
                    config=GenerateContentConfig(
                        temperature=0.3,
                        response_mime_type="application/json",
                        response_schema=response_schema,
                        system_instruction=system_instruction
                    )
                ),
                timeout=30.0
            )
            
            # Print the Gemini response text with error handling
            try:
                print(f"[GEMINI RESPONSE] {response.text if response else 'None'}")
            except Exception as print_error:
                try:
                    # Fallback: print just the length if text is problematic
                    print(f"[GEMINI RESPONSE] <Response received but print failed: {str(print_error)}> (Length: {len(response.text) if response and response.text else 0})")
                except:
                    print(f"[GEMINI RESPONSE] <Response received but completely unprintable>")
            
            if not response or not response.text:
                return {"success": False, "error": "Empty response from Gemini"}
            
            analysis_result = json.loads(response.text.strip())
            memory_modifications = analysis_result.get("memory_modifications", [])
            
            return {
                "success": True,
                "memory_modifications": memory_modifications,
                "modifications_count": len(memory_modifications)
            }
            
        except Exception as e:
            print(f"[PATTERN ANALYZER ERROR] {str(e)}")
            return {"success": False, "error": str(e)}