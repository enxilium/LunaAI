#!/usr/bin/env python3
"""
Manual testing script for pattern recognition components
Run this after creating test data with create_test_data.py
"""

import sys
import os
import asyncio
import json

# Add the src directory to Python path
project_root = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(project_root, 'src', 'main', 'services', 'agent', 'tools'))

from pattern_extractor import AlgorithmicPatternExtractor


def test_pattern_extractor():
    """Test the algorithmic pattern extraction (no external dependencies)"""
    print("🔍 Testing Algorithmic Pattern Extractor...")
    print("-" * 50)
    
    try:
        extractor = AlgorithmicPatternExtractor()
        
        print("📊 Extracting temporal patterns...")
        temporal = extractor.extract_temporal_patterns(days_back=30)
        print(f"✅ Total executions: {temporal['total_executions']}")
        if temporal['peak_hours']:
            print(f"⏰ Peak hours: {temporal['peak_hours'][:3]}")
        
        print("\n🔧 Extracting tool usage patterns...")
        usage = extractor.extract_tool_usage_patterns(days_back=30)
        if usage['most_used_tools']:
            print("🏆 Most used tools:")
            for tool in usage['most_used_tools'][:5]:
                print(f"   - {tool['tool_name']}: {tool['total_uses']} uses, "
                      f"{tool['success_rate']:.1f}% success rate")
        
        print("\n🔗 Extracting sequence patterns...")
        sequences = extractor.extract_sequence_patterns(days_back=30)
        print(f"📋 Sessions analyzed: {sequences['session_count']}")
        if sequences['common_tool_pairs']:
            print("🔄 Common tool pairs:")
            for pair, count in sequences['common_tool_pairs'][:3]:
                print(f"   - {pair[0]} → {pair[1]}: {count} times")
        
        print("\n🎯 Extracting behavioral patterns...")
        behavioral = extractor.extract_behavioral_patterns(days_back=30)
        print(f"🧠 Executions analyzed: {behavioral['total_analyzed_executions']}")
        if behavioral['search_queries']:
            print("🔍 Recent search queries:")
            for query in behavioral['search_queries'][-5:]:
                print(f"   - '{query['query']}' at {query['timestamp'][:19]}")
        
        print("\n📋 Generating complete summary...")
        summary = extractor.generate_pattern_summary(days_back=30)
        
        print(f"\n✅ Pattern extraction completed successfully!")
        print(f"📊 Summary: {summary['analysis_metadata']['total_executions']} executions analyzed")
        
        return summary
        
    except Exception as e:
        print(f"❌ Error in pattern extraction: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_pattern_analyzer(raw_patterns):
    """Test the LLM pattern analyzer (requires Google API key)"""
    print("\n🧠 Testing LLM Pattern Analyzer...")
    print("-" * 50)
    
    try:
        from pattern_analyzer import LLMPatternAnalyzer
        
        analyzer = LLMPatternAnalyzer()
        
        print("🤖 Analyzing patterns with Gemini...")
        analysis = await analyzer.analyze_patterns(raw_patterns)
        
        if analysis['success']:
            insights = analysis['insights']
            print(f"✅ Analysis successful!")
            
            # Show behavioral insights
            behavioral = insights.get('behavioral_insights', [])
            print(f"\n💡 Behavioral Insights ({len(behavioral)}):")
            for insight in behavioral[:3]:
                print(f"   - {insight.get('insight', 'N/A')} (confidence: {insight.get('confidence', 0):.2f})")
            
            # Show user preferences
            preferences = insights.get('user_preferences', [])
            print(f"\n👤 User Preferences ({len(preferences)}):")
            for pref in preferences[:3]:
                print(f"   - {pref.get('preference', 'N/A')} ({pref.get('strength', 'unknown')} strength)")
            
            # Show optimization opportunities
            optimizations = insights.get('optimization_opportunities', [])
            print(f"\n⚡ Optimization Opportunities ({len(optimizations)}):")
            for opt in optimizations[:3]:
                print(f"   - {opt.get('opportunity', 'N/A')} ({opt.get('impact', 'unknown')} impact)")
            
            print(f"\n🎯 Generating proactive suggestions...")
            suggestions = await analyzer.generate_proactive_suggestions(analysis)
            print(f"💡 Generated {len(suggestions)} suggestions:")
            for suggestion in suggestions[:2]:
                print(f"   - {suggestion.get('title', 'N/A')}: {suggestion.get('description', 'N/A')[:100]}...")
            
            return analysis
            
        else:
            print(f"❌ LLM Analysis failed: {analysis.get('error')}")
            print("💡 This likely means Google API key is not configured")
            return None
            
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("💡 This likely means Google GenAI dependencies are not installed")
        return None
    except Exception as e:
        print(f"❌ Error in LLM analysis: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_pattern_recognizer():
    """Test the complete pattern recognizer (requires Google API key + Mem0)"""
    print("\n🎯 Testing Complete Pattern Recognizer...")
    print("-" * 50)
    
    try:
        from pattern_recognizer import PatternRecognizer
        
        recognizer = PatternRecognizer(user_id="test_user", days_to_analyze=30)
        
        trigger_context = {
            "trigger_type": "manual_test",
            "test_name": "comprehensive_test"
        }
        
        print("🔄 Running complete pattern recognition pipeline...")
        result = await recognizer.recognize_patterns_async(trigger_context)
        
        if result.get('success'):
            print(f"🎉 Complete pattern recognition successful!")
            print(f"📊 Executions analyzed: {result['raw_patterns_summary']['total_executions']}")
            print(f"💾 Insights saved to memory: {result['insights_saved_count']}")
            print(f"💡 Proactive suggestions: {len(result['proactive_suggestions'])}")
            
            # Show saved insights
            if result['memory_results']['saved_insights']:
                print(f"\n🧠 Insights saved to Mem0:")
                for insight in result['memory_results']['saved_insights'][:3]:
                    print(f"   - {insight['type']}: {insight.get('insight', insight.get('preference', insight.get('opportunity', 'Summary')))}")
            
            # Show suggestions
            if result['proactive_suggestions']:
                print(f"\n💡 Proactive suggestions:")
                for suggestion in result['proactive_suggestions'][:2]:
                    print(f"   - {suggestion.get('title', 'N/A')}: {suggestion.get('description', 'N/A')[:80]}...")
            
            return result
            
        else:
            print(f"❌ Pattern recognition failed: {result.get('error', result.get('reason'))}")
            return None
            
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("💡 This likely means Mem0 or Google GenAI dependencies are not installed")
        return None
    except Exception as e:
        print(f"❌ Error in pattern recognition: {e}")
        import traceback
        traceback.print_exc()
        return None


async def main():
    """Run all manual tests"""
    print("🧪 Manual Pattern Recognition Testing")
    print("=" * 60)
    print("💡 Make sure you've run create_test_data.py first!")
    print()
    
    # Test 1: Algorithmic Pattern Extraction (no dependencies)
    raw_patterns = test_pattern_extractor()
    
    if raw_patterns is None:
        print("❌ Cannot continue without raw patterns")
        return
    
    # Test 2: LLM Analysis (requires Google API key)
    print("\n" + "="*60)
    llm_analysis = await test_pattern_analyzer(raw_patterns)
    
    # Test 3: Complete Pattern Recognizer (requires Google API key + Mem0)
    print("\n" + "="*60)
    full_result = await test_pattern_recognizer()
    
    # Summary
    print("\n" + "="*60)
    print("📋 Test Summary:")
    print(f"✅ Algorithmic Pattern Extraction: {'✓' if raw_patterns else '✗'}")
    print(f"🧠 LLM Pattern Analysis: {'✓' if llm_analysis else '✗'}")
    print(f"🎯 Complete Pattern Recognition: {'✓' if full_result else '✗'}")
    
    if not llm_analysis:
        print("\n💡 To test LLM components:")
        print("   1. Set up Google API key in assets/config/google-auth.json")
        print("   2. Or set GOOGLE_API_KEY environment variable")
    
    if not full_result:
        print("\n💡 To test complete system:")
        print("   1. Ensure Google API key is configured")
        print("   2. Install Mem0: pip install mem0ai")
        print("   3. Make sure ChromaDB is working")


if __name__ == "__main__":
    asyncio.run(main())
