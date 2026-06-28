#!/usr/bin/env python3
"""
Test script to verify dollar sign elimination works correctly
"""

import sys
import os
sys.path.append('.')

from multi_provider_processor import MultiProviderProcessor

def test_dollar_preprocessing():
    """Test that dollar sign preprocessing works"""
    processor = MultiProviderProcessor()
    
    # Test input with various dollar formats
    test_input = "The item costs $25.99 and the service fee is $4.50. Additional charges include $10.00 processing fee and $2,500 handling fee."
    
    # Test preprocessing
    processed = processor.preprocess_text(test_input)
    
    print("=== DOLLAR SIGN PREPROCESSING TEST ===")
    print(f"Original: {test_input}")
    print(f"Processed: {processed}")
    print(f"Dollar signs found in processed text: {'$' in processed}")
    
    if '$' in processed:
        print("❌ FAILURE: Dollar signs still present after preprocessing")
        return False
    else:
        print("✅ SUCCESS: All dollar signs removed by preprocessing")
        return True

def test_postprocessing():
    """Test the postprocessing cleanup"""
    processor = MultiProviderProcessor()
    
    # Simulate AI response with dollar signs
    ai_response_with_dollars = "The cost is $25.99 and additional fees are $4.50 for processing."
    
    processed = processor.postprocess_text(ai_response_with_dollars)
    
    print("\n=== DOLLAR SIGN POSTPROCESSING TEST ===")
    print(f"AI Response: {ai_response_with_dollars}")
    print(f"Post-processed: {processed}")
    print(f"Dollar signs found in final output: {'$' in processed}")
    
    if '$' in processed:
        print("❌ FAILURE: Dollar signs still present after postprocessing")
        return False
    else:
        print("✅ SUCCESS: All dollar signs removed by postprocessing")
        return True

def test_emergency_cleanup():
    """Test the emergency cleanup in clean_ai_response"""
    processor = MultiProviderProcessor()
    
    # Simulate AI response that somehow still has dollar signs
    ai_response = "The price is $25 and tax is $3.50."
    
    cleaned = processor.clean_ai_response(ai_response)
    
    print("\n=== EMERGENCY CLEANUP TEST ===")
    print(f"AI Response: {ai_response}")
    print(f"After cleanup: {cleaned}")
    print(f"Dollar signs found in final output: {'$' in cleaned}")
    
    if '$' in cleaned:
        print("❌ FAILURE: Emergency cleanup failed")
        return False
    else:
        print("✅ SUCCESS: Emergency cleanup worked")
        return True

if __name__ == "__main__":
    print("Testing Dollar Sign Elimination System\n")
    
    test1 = test_dollar_preprocessing()
    test2 = test_postprocessing()
    test3 = test_emergency_cleanup()
    
    print(f"\n=== FINAL RESULTS ===")
    print(f"Preprocessing: {'✅ PASS' if test1 else '❌ FAIL'}")
    print(f"Postprocessing: {'✅ PASS' if test2 else '❌ FAIL'}")
    print(f"Emergency Cleanup: {'✅ PASS' if test3 else '❌ FAIL'}")
    
    if test1 and test2 and test3:
        print("\n🎉 ALL TESTS PASSED - Dollar sign elimination system is working!")
        sys.exit(0)
    else:
        print("\n💥 SOME TESTS FAILED - Dollar sign elimination needs fixes!")
        sys.exit(1)