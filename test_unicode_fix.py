#!/usr/bin/env python3
"""
Simple test to verify pattern recognition works without Unicode issues
"""

import sys
import os
import asyncio

# Add the src directory to Python path
project_root = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(project_root, 'src', 'main', 'services', 'agent', 'tools'))

async def test_pattern_extraction():
    """Test just the algorithmic pattern extraction"""
    print("[TEST] Testing algorithmic pattern extraction...")
    
    try:
        from pattern_extractor import AlgorithmicPatternExtractor
        
        extractor = AlgorithmicPatternExtractor()
        patterns = extractor.generate_pattern_summary(days_back=30)
        
        print(f"[SUCCESS] Extracted patterns from {patterns['analysis_metadata']['total_executions']} executions")
        
        # Show some key insights
        if patterns['temporal_patterns']['peak_hours']:
            top_hour = patterns['temporal_patterns']['peak_hours'][0]
            print(f"[INSIGHT] Peak usage hour: {top_hour[0]}:00 ({top_hour[1]} executions)")
        
        if patterns['tool_usage_patterns']['most_used_tools']:
            top_tool = patterns['tool_usage_patterns']['most_used_tools'][0]
            print(f"[INSIGHT] Most used tool: {top_tool['tool_name']} ({top_tool['total_uses']} uses)")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Pattern extraction failed: {e}")
        return False

async def test_pattern_recognizer():
    """Test the pattern recognizer with mock context"""
    print("[TEST] Testing pattern recognizer...")
    
    try:
        from pattern_recognizer import PatternRecognizer
        
        recognizer = PatternRecognizer(user_id="test_user", days_to_analyze=30)
        
        trigger_context = {
            "trigger_type": "manual_test",
            "test_name": "unicode_fix_test"
        }
        
        result = await recognizer.recognize_patterns_async(trigger_context)
        
        if result.get('success'):
            print(f"[SUCCESS] Pattern recognition completed!")
            print(f"[INFO] Analyzed {result['raw_patterns_summary']['total_executions']} executions")
            return True
        elif result.get('skipped'):
            print(f"[INFO] Pattern recognition skipped: {result.get('reason')}")
            return True
        else:
            print(f"[ERROR] Pattern recognition failed: {result.get('error')}")
            return False
            
    except Exception as e:
        print(f"[ERROR] Pattern recognizer test failed: {e}")
        return False

async def main():
    """Run the tests"""
    print("Testing Pattern Recognition (Unicode Fix)")
    print("=" * 50)
    
    # Test 1: Pattern extraction
    extraction_ok = await test_pattern_extraction()
    
    # Test 2: Pattern recognizer (might fail on LLM/Mem0 but shouldn't have Unicode errors)
    if extraction_ok:
        print("\n" + "-" * 30)
        recognizer_ok = await test_pattern_recognizer()
    else:
        recognizer_ok = False
    
    # Summary
    print("\n" + "=" * 50)
    print(f"[SUMMARY] Pattern extraction: {'PASS' if extraction_ok else 'FAIL'}")
    print(f"[SUMMARY] Pattern recognizer: {'PASS' if recognizer_ok else 'FAIL'}")
    
    if extraction_ok:
        print("[SUCCESS] No Unicode encoding errors detected!")
    else:
        print("[ERROR] Issues remain - check the logs above")

if __name__ == "__main__":
    asyncio.run(main())
