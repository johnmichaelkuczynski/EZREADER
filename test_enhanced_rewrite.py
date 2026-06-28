"""
Test script for the enhanced rewrite functionality
"""

import logging
import sys
from multi_provider_processor import MultiProviderProcessor
from enhanced_integration import integrate_enhanced_rewrite

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_rewrite():
    """
    Test the enhanced rewrite functionality with a sample text
    """
    logger.info("Initializing enhanced rewrite system...")
    
    # Apply enhanced rewrite functionality
    try:
        integrate_enhanced_rewrite()
        logger.info("Enhanced rewrite system successfully integrated")
    except Exception as e:
        logger.error(f"Failed to integrate enhanced rewrite system: {str(e)}")
        return False
    
    # Initialize the processor
    processor = MultiProviderProcessor()
    
    # Sample academic text for testing
    sample_text = """
    The philosophical question concerning the relationship between determinism and free will has been a central concern in metaphysics for centuries. Compatibilism, as proposed by philosophers such as David Hume and more recently Harry Frankfurt, argues that determinism and free will are not mutually exclusive concepts. According to this view, freedom of will is not defined by the absence of causal determination, but rather by the absence of constraints on acting according to one's desires. Incompatibilists, by contrast, maintain that true free will necessarily requires the falsity of determinism, as the ability to do otherwise is contingent upon there being multiple possible futures available to an agent at any given moment.
    
    Hard determinists, a subset of incompatibilists, acknowledge the compelling evidence for causal determinism provided by our scientific understanding of physical law, and consequently reject the notion of free will as illusory. They maintain that each decision an individual makes is ultimately the result of prior causes extending backwards indefinitely, rendering the sensation of free choice merely epiphenomenal. Libertarians, another incompatibilist position, defend the reality of free will at the expense of strict determinism, often appealing to quantum indeterminacy or positing agent-causal powers not reducible to event causation.
    """
    
    # Test the rewrite functionality
    logger.info("Testing enhanced rewrite with sample text...")
    try:
        result = processor.process_text(
            text=sample_text,
            action='rewrite',
            custom_instructions='Maintain the academic tone and philosophical sophistication',
            include_style_in_output=True
        )
        
        # Log the results
        logger.info("----- ORIGINAL TEXT -----")
        logger.info(sample_text)
        logger.info("----- REWRITTEN TEXT -----")
        logger.info(result)
        
        # Basic verification
        original_words = len(sample_text.split())
        result_words = len(result.split())
        
        logger.info(f"Original word count: {original_words}")
        logger.info(f"Result word count: {result_words}")
        logger.info(f"Word count ratio: {result_words / original_words:.2f}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error testing rewrite: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_rewrite()
    sys.exit(0 if success else 1)