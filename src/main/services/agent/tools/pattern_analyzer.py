#!/usr/bin/env python3
"""
LLM Pattern Analyzer for Luna AI
Uses Gemini to analyze raw patterns and extract actionable insights
"""

import json
import asyncio
import os
from typing import Dict, List, Any, Optional
from google.genai import Client
from google.genai.types import GenerateContentConfig
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


class LLMPatternAnalyzer:
    """Uses LLM to analyze raw patterns and extract semantic insights"""
    
    def __init__(self, model: str = "gemini-2.5-flash"):
        """Initialize with Gemini client"""
        self.client = Client(api_key=GEMINI_API_KEY)
        self.model = model
    
    async def analyze_patterns(self, raw_patterns: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze raw patterns using Gemini to extract actionable insights"""

        print("[PATTERN] Analyzing patterns with LLM...")
        
        # Create analysis prompt
        prompt = self._create_analysis_prompt(raw_patterns)
        
        # Define response schema for structured output
        response_schema = {
            "type": "object",
            "properties": {
                "behavioral_insights": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {
                                "type": "string",
                                "enum": ["preference", "habit", "workflow", "optimization"],
                                "description": "Type of behavioral insight"
                            },
                            "insight": {
                                "type": "string",
                                "description": "Clear, actionable insight about user behavior"
                            },
                            "confidence": {
                                "type": "number",
                                "minimum": 0.0,
                                "maximum": 1.0,
                                "description": "Confidence level in this insight"
                            },
                            "evidence": {
                                "type": "string",
                                "description": "What data supports this insight"
                            }
                        },
                        "required": ["type", "insight", "confidence", "evidence"]
                    }
                },
                "user_preferences": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "category": {
                                "type": "string",
                                "enum": ["time", "tools", "content", "workflow"],
                                "description": "Category of preference"
                            },
                            "preference": {
                                "type": "string",
                                "description": "Specific preference identified"
                            },
                            "strength": {
                                "type": "string",
                                "enum": ["strong", "moderate", "weak"],
                                "description": "Strength of the preference"
                            },
                            "evidence": {
                                "type": "string",
                                "description": "Supporting data for this preference"
                            }
                        },
                        "required": ["category", "preference", "strength", "evidence"]
                    }
                }
            },
            "required": ["behavioral_insights", "user_preferences"]
        }
        
        try:
            # Generate analysis using Gemini with structured output
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=prompt,
                config=GenerateContentConfig(
                    temperature=0.3,  # Lower temperature for more consistent analysis
                    response_mime_type="application/json",
                    response_schema=response_schema
                )
            )
            
            # Parse the structured JSON response
            analysis_text = response.text
            print(f"[PATTERN] Received structured analysis: {analysis_text}")

            insights = json.loads(analysis_text)
            
            return {
                "success": True,
                "insights": insights,
                "raw_analysis": analysis_text,
                "metadata": {
                    "model_used": self.model,
                    "analyzed_executions": raw_patterns.get("analysis_metadata", {}).get("total_executions", 0),
                    "analysis_timestamp": raw_patterns.get("analysis_metadata", {}).get("generated_at")
                }
            }
            
        except Exception as e:
            print(f"[PATTERN] Error in LLM analysis: {e}")
            return {
                "success": False,
                "error": str(e),
                "insights": {
                    "behavioral_insights": [],
                    "user_preferences": []
                }
            }
    
    def _create_analysis_prompt(self, raw_patterns: Dict[str, Any]) -> str:
        """Create a structured prompt for pattern analysis"""
        
        patterns_json = json.dumps(raw_patterns, indent=2)
        
        prompt = f"""
You are an AI behavior analyst. Analyze the following tool usage patterns and extract actionable insights about user behavior and preferences.

TOOL USAGE DATA:
{patterns_json}

Based on this data, identify:

1. BEHAVIORAL INSIGHTS: Clear patterns in how the user behaves or works
   - Look for time-based patterns (when they're most active, preferred working hours)
   - Tool usage workflows and sequences
   - Performance patterns and habits
   - Only include insights with strong supporting evidence

2. USER PREFERENCES: What the user clearly prefers or favors
   - Time preferences (morning vs evening work)
   - Tool preferences (frequently used tools)
   - Content preferences (based on search queries, file types)
   - Workflow preferences

Focus on insights that help personalize the user experience and are directly supported by the data.
Be specific and actionable. Only include high-confidence insights.
"""
        
        return prompt
    
    async def generate_proactive_suggestions(self, insights: Dict[str, Any], current_context: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Generate proactive suggestions based on insights and current context"""
        
        if not insights.get("success"):
            return []
        
        # Define suggestions response schema
        suggestions_schema = {
            "type": "object",
            "properties": {
                "suggestions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {
                                "type": "string",
                                "enum": ["automation", "optimization", "recommendation", "shortcut"],
                                "description": "Type of suggestion"
                            },
                            "title": {
                                "type": "string",
                                "description": "Brief suggestion title"
                            },
                            "description": {
                                "type": "string",
                                "description": "Detailed description of the suggestion"
                            },
                            "confidence": {
                                "type": "number",
                                "minimum": 0.0,
                                "maximum": 1.0,
                                "description": "Confidence in suggestion value"
                            },
                            "timing": {
                                "type": "string",
                                "enum": ["immediate", "contextual", "scheduled"],
                                "description": "When this suggestion should be offered"
                            }
                        },
                        "required": ["type", "title", "description", "confidence", "timing"]
                    }
                }
            },
            "required": ["suggestions"]
        }
        
        # Create suggestions prompt
        suggestions_prompt = self._create_suggestions_prompt(insights, current_context)
        
        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=suggestions_prompt,
                config=GenerateContentConfig(
                    temperature=0.4,
                    response_mime_type="application/json",
                    response_schema=suggestions_schema
                )
            )
            
            suggestions_text = response.text
            parsed_suggestions = json.loads(suggestions_text)
            
            return parsed_suggestions.get("suggestions", [])
            
        except Exception as e:
            print(f"[PATTERN] Error generating proactive suggestions: {e}")
            return []
    
    def _create_suggestions_prompt(self, insights: Dict[str, Any], current_context: Dict[str, Any] = None) -> str:
        """Create prompt for generating proactive suggestions"""
        
        insights_json = json.dumps(insights.get("insights", {}), indent=2)
        context_json = json.dumps(current_context or {}, indent=2)
        
        return f"""
Based on the following user behavior insights and current context, generate proactive suggestions that could help the user.

USER INSIGHTS:
{insights_json}

CURRENT CONTEXT:
{context_json}

Generate suggestions that:
1. Could save the user time
2. Automate repetitive workflows
3. Improve tool performance
4. Provide contextually relevant recommendations
5. Help with common user patterns

Only suggest things with high confidence and clear value.
Focus on actionable suggestions the user would actually find helpful.
"""
