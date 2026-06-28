"""
Integration script for enhanced rewrite functionality.
This script patches the MultiProviderProcessor with improved functionality.
"""

import logging
from multi_provider_processor import MultiProviderProcessor
from rewrite_enhancer import RewriteEnhancer

logger = logging.getLogger(__name__)

def integrate_enhanced_rewrite():
    """
    Patch the MultiProviderProcessor with enhanced rewrite functionality.
    This function must be called before the processor is used.
    """
    logger.info("Integrating enhanced rewrite functionality...")
    
    # Store original methods for fallback
    original_process_with_openai = MultiProviderProcessor.process_with_openai
    original_process_with_anthropic = MultiProviderProcessor.process_with_anthropic
    original_process_macrochunk = MultiProviderProcessor.process_macrochunk
    
    # Define method to patch process_macrochunk with enhanced emergency recovery
    def patched_process_macrochunk(self, *args, **kwargs):
        """
        Patched method with enhanced emergency recovery
        """
        macrochunk_index = args[0] if args else kwargs.get('macrochunk_index', 0)
        macrochunk = args[1] if len(args) > 1 else kwargs.get('macrochunk', '')
        
        # Process the macrochunk using the original method
        result = original_process_macrochunk(self, *args, **kwargs)
        
        # Create enhancer and apply emergency recovery if needed
        enhancer = RewriteEnhancer(self)
        enhanced_result = enhancer.enhanced_emergency_recovery(macrochunk, result)
        
        return enhanced_result
    
    # Apply the patches
    MultiProviderProcessor.process_with_openai = lambda self, *args, **kwargs: RewriteEnhancer(self).enhanced_process_with_openai(*args, **kwargs)
    MultiProviderProcessor.process_with_anthropic = lambda self, *args, **kwargs: RewriteEnhancer(self).enhanced_process_with_anthropic(*args, **kwargs)
    MultiProviderProcessor.process_macrochunk = patched_process_macrochunk
    
    logger.info("Enhanced rewrite functionality integration complete")
    
    return {
        'original_openai': original_process_with_openai,
        'original_anthropic': original_process_with_anthropic,
        'original_macrochunk': original_process_macrochunk
    }