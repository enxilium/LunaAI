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
        # Get API key from config if not provided

        self.client = Client(api_key=GEMINI_API_KEY)
        self.model = model
    
    async def analyze_patterns(self, raw_patterns: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze raw patterns using Gemini to extract actionable insights"""
        
        if not self.client:
            return {"error": "LLM client not initialized - missing API key"}
        
        # Create analysis prompt
        prompt = self._create_analysis_prompt(raw_patterns)
        
        try:
            # Generate analysis using Gemini
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=prompt,
                config=GenerateContentConfig(
                    temperature=0.3,  # Lower temperature for more consistent analysis
                    max_output_tokens=2000
                )
            )
            
            # Parse the response
            analysis_text = response.text

            print("Received analysis:", analysis_text)

            insights = self._parse_analysis_response(analysis_text)
            
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
            return {
                "success": False,
                "error": str(e),
                "insights": []
            }
    
    def _create_analysis_prompt(self, raw_patterns: Dict[str, Any]) -> str:
        """Create a structured prompt for pattern analysis"""
        
        patterns_json = json.dumps(raw_patterns, indent=2)
        
        prompt = f"""
You are an AI behavior analyst. Analyze the following tool usage patterns and extract actionable insights about user behavior, preferences, and potential optimizations.

TOOL USAGE DATA:
{patterns_json}

Please analyze this data and provide insights in the following JSON format:

{{
    "behavioral_insights": [
        {{
            "type": "preference|habit|workflow|optimization",
            "insight": "Clear, actionable insight about user behavior",
            "confidence": 0.0-1.0,
            "evidence": "What data supports this insight",
            "actionable_suggestion": "What can be done with this insight"
        }}
    ],
    "user_preferences": [
        {{
            "category": "time|tools|content|workflow",
            "preference": "Specific preference identified",
            "strength": "strong|moderate|weak",
            "evidence": "Supporting data"
        }}
    ],
    "optimization_opportunities": [
        {{
            "area": "performance|workflow|automation|suggestions",
            "opportunity": "Specific optimization opportunity",
            "impact": "high|medium|low",
            "implementation": "How this could be implemented"
        }}
    ],
    "notable_patterns": [
        {{
            "pattern": "Description of interesting pattern",
            "frequency": "How often this occurs",
            "significance": "Why this pattern matters"
        }}
    ]
}}

Focus on:
1. Time-based behavior patterns (when user is most active, preferred working hours)
2. Tool usage preferences and workflows
3. Content preferences from search queries and tool inputs
4. Performance patterns and potential optimizations
5. Workflow inefficiencies or automation opportunities

Be specific and actionable. Only include insights with strong supporting evidence from the data.
"""
        
        return prompt
    
    def _parse_analysis_response(self, analysis_text: str) -> Dict[str, Any]:
        """Parse the LLM response into structured insights"""
        try:
            # Try to extract JSON from the response
            start_idx = analysis_text.find('{')
            end_idx = analysis_text.rfind('}') + 1
            
            if start_idx != -1 and end_idx != -1:
                json_str = analysis_text[start_idx:end_idx]
                insights = json.loads(json_str)
                return insights
            else:
                # If no JSON found, create a basic structure
                return {
                    "behavioral_insights": [
                        {
                            "type": "analysis",
                            "insight": "Raw analysis provided",
                            "confidence": 0.5,
                            "evidence": "LLM response",
                            "actionable_suggestion": analysis_text[:500]
                        }
                    ],
                    "user_preferences": [],
                    "optimization_opportunities": [],
                    "notable_patterns": []
                }
                
        except json.JSONDecodeError:
            # Fallback for non-JSON responses
            return {
                "behavioral_insights": [
                    {
                        "type": "analysis",
                        "insight": "Analysis could not be parsed as JSON",
                        "confidence": 0.3,
                        "evidence": "Raw LLM response",
                        "actionable_suggestion": analysis_text[:500]
                    }
                ],
                "user_preferences": [],
                "optimization_opportunities": [],
                "notable_patterns": [],
                "raw_response": analysis_text
            }
    
    async def generate_proactive_suggestions(self, insights: Dict[str, Any], current_context: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Generate proactive suggestions based on insights and current context"""
        
        if not insights.get("success"):
            return []
        
        # Create suggestions prompt
        suggestions_prompt = self._create_suggestions_prompt(insights, current_context)
        
        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=suggestions_prompt,
                config=GenerateContentConfig(
                    temperature=0.4,
                    max_output_tokens=1000
                )
            )
            
            suggestions_text = response.text
            suggestions = self._parse_suggestions_response(suggestions_text)
            
            return suggestions
            
        except Exception as e:
            print(f"Error generating proactive suggestions: {e}")
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

Generate suggestions in this JSON format:

{{
    "suggestions": [
        {{
            "type": "automation|optimization|recommendation|shortcut",
            "title": "Brief suggestion title",
            "description": "Detailed description of the suggestion",
            "confidence": 0.0-1.0,
            "timing": "immediate|contextual|scheduled",
            "implementation": "How this suggestion could be implemented"
        }}
    ]
}}

Focus on suggestions that:
1. Could save the user time
2. Automate repetitive workflows
3. Improve tool performance
4. Provide contextually relevant recommendations
5. Help with common user patterns

Only suggest things with high confidence and clear value.
"""
    
    def _parse_suggestions_response(self, suggestions_text: str) -> List[Dict[str, Any]]:
        """Parse suggestions response into structured format"""
        try:
            start_idx = suggestions_text.find('{')
            end_idx = suggestions_text.rfind('}') + 1
            
            if start_idx != -1 and end_idx != -1:
                json_str = suggestions_text[start_idx:end_idx]
                parsed = json.loads(json_str)
                return parsed.get("suggestions", [])
            else:
                return []
                
        except json.JSONDecodeError:
            return []
