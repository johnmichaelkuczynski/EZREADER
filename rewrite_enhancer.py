"""
Enhanced Rewrite System - Integrates with the existing multi_provider_processor
to provide improved style mimicry and intellectual density preservation.
"""

import logging
import re
from typing import Dict, List, Tuple, Optional, Any, Callable
from improved_prompts import (
    OPENAI_FIRST_CHUNK_PROMPT, 
    OPENAI_CONTINUATION_PROMPT,
    ANTHROPIC_FIRST_CHUNK_PROMPT,
    ANTHROPIC_CONTINUATION_PROMPT,
    EMERGENCY_RECOVERY_PROMPT,
    ENHANCED_FORMALITY_CORRECTION,
    ADDITIONAL_CASUAL_MARKERS
)

logger = logging.getLogger(__name__)

class RewriteEnhancer:
    """
    Enhances the rewrite functionality of the MultiProviderProcessor
    with improved prompts and density preservation.
    """
    
    def __init__(self, processor):
        """
        Initialize with a reference to the parent processor to extend its functionality.
        
        Args:
            processor: The MultiProviderProcessor instance to enhance
        """
        self.processor = processor
        
    def enhanced_process_with_openai(
        self, 
        text: str, 
        api_key: str, 
        action: str = 'rewrite',
        style_instruction: str = '',
        custom_instructions: str = '',
        is_first_subchunk: bool = False
    ) -> str:
        """Enhanced OpenAI processor with improved prompts for style and density preservation"""
        
        # Different prompt handling based on the action
        if action == "expand":
            # Emergency expansion case uses original prompt
            prompt = f"""{custom_instructions}"""
        else:
            # Enhanced prompt for improved style mimicry and density preservation
            if is_first_subchunk:
                prompt = OPENAI_FIRST_CHUNK_PROMPT.format(
                    custom_instructions=custom_instructions,
                    style_instruction=style_instruction,
                    text=text
                )
            else:
                prompt = OPENAI_CONTINUATION_PROMPT.format(
                    custom_instructions=custom_instructions,
                    style_instruction=style_instruction,
                    text=text
                )

        try:
            # Get OpenAI client from the processor
            client = self.processor.get_client_for_provider('openai', api_key)
            
            # the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
            # do not change this unless explicitly requested by the user
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=2000,
                timeout=45  # Use consistent timeout
            )
            
            response_text = response.choices[0].message.content
            cleaned_response = self.processor.clean_ai_response(response_text, custom_instructions, style_instruction)
            return cleaned_response
            
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            raise
            
    def enhanced_process_with_anthropic(
        self, 
        text: str, 
        api_key: str, 
        action: str = 'rewrite',
        style_instruction: str = '',
        custom_instructions: str = '',
        is_first_subchunk: bool = False
    ) -> str:
        """Enhanced Anthropic processor with improved prompts for style and density preservation"""
        
        # Different prompt handling based on the action
        if action == "expand":
            # Emergency expansion case uses original prompt
            prompt = f"""{custom_instructions}"""
        else:
            # Enhanced prompt for improved style mimicry and density preservation
            if is_first_subchunk:
                prompt = ANTHROPIC_FIRST_CHUNK_PROMPT.format(
                    custom_instructions=custom_instructions,
                    style_instruction=style_instruction,
                    text=text
                )
            else:
                prompt = ANTHROPIC_CONTINUATION_PROMPT.format(
                    custom_instructions=custom_instructions,
                    style_instruction=style_instruction,
                    text=text
                )

        try:
            # Get Anthropic client from the processor
            client = self.processor.get_client_for_provider('anthropic', api_key)
            
            # the newest Anthropic model is "claude-sonnet-4-5-20250929" which was released October 22, 2024
            # do not change this unless explicitly requested by the user
            response = client.messages.create(
                model="claude-sonnet-4-5-20250929",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=4000
            )
            
            response_text = response.content[0].text
            cleaned_response = self.processor.clean_ai_response(response_text, custom_instructions, style_instruction)
            return cleaned_response
            
        except Exception as e:
            logger.error(f"Anthropic API error: {str(e)}")
            raise
            
    def enhanced_emergency_recovery(self, original_text, result_text):
        """
        Enhanced emergency recovery logic for cases where output is shorter
        or simpler than input. Addresses density loss and breezification.
        
        Args:
            original_text: The original text that was processed
            result_text: The resulting text after initial processing
            
        Returns:
            str: The corrected text with preserved intellectual density
        """
        # Calculate word counts
        original_words = len(original_text.split())
        result_words = len(result_text.split())
        
        # Check if output is shorter than input
        if result_words < original_words * 0.95:  # Allow for 5% variation
            logger.warning(f"Output too short: original={original_words} words, result={result_words} words. Applying emergency recovery.")
            
            # Create emergency recovery prompt
            emergency_prompt = EMERGENCY_RECOVERY_PROMPT.format(
                original_text=original_text[:5000],  # First 5000 chars as reference
                text=result_text
            )
            
            # Get a key for recovery processing
            key_info = self.processor.api_key_manager.get_next_available_key()
            if not key_info:
                logger.error("No API keys available for emergency recovery")
                return result_text  # Return original result if no keys available
                
            key_id, provider, api_key = key_info
            
            # Use the appropriate provider for recovery
            try:
                if provider == "openai":
                    corrected_text = self.enhanced_process_with_openai(
                        emergency_prompt, api_key, action="expand"
                    )
                elif provider == "anthropic":
                    corrected_text = self.enhanced_process_with_anthropic(
                        emergency_prompt, api_key, action="expand"
                    )
                else:
                    # Fallback to original text if provider not supported
                    logger.warning(f"Provider {provider} not supported for emergency recovery")
                    return result_text
                    
                logger.info("Emergency recovery completed successfully")
                return corrected_text
                
            except Exception as e:
                logger.error(f"Emergency recovery failed: {str(e)}")
                return result_text  # Return original result if recovery fails
        
        # Check for formality loss
        if self._check_formality_lost(original_text, result_text):
            logger.warning("Formality check failed - Output has been casualized. Performing emergency formality correction.")
            
            # Create formality correction prompt
            formality_prompt = ENHANCED_FORMALITY_CORRECTION.format(
                original_text=original_text[:5000],  # First 5000 chars as reference
                text=result_text
            )
            
            # Get a key for formality correction
            key_info = self.processor.api_key_manager.get_next_available_key()
            if not key_info:
                logger.error("No API keys available for formality correction")
                return result_text  # Return original result if no keys available
                
            key_id, provider, api_key = key_info
            
            # Use the appropriate provider for formality correction
            try:
                if provider == "openai":
                    corrected_text = self.enhanced_process_with_openai(
                        formality_prompt, api_key, action="expand"
                    )
                elif provider == "anthropic":
                    corrected_text = self.enhanced_process_with_anthropic(
                        formality_prompt, api_key, action="expand"
                    )
                else:
                    # Fallback to original text if provider not supported
                    logger.warning(f"Provider {provider} not supported for formality correction")
                    return result_text
                    
                logger.info("Formality correction completed successfully")
                return corrected_text
                
            except Exception as e:
                logger.error(f"Formality correction failed: {str(e)}")
                return result_text  # Return original result if correction fails
        
        # If no issues detected, return the original result
        return result_text
        
    def _check_formality_lost(self, original_text, result_text):
        """
        Enhanced check for formality loss, casual language, and breezification
        
        Args:
            original_text: The original formal text
            result_text: The rewritten text to check
            
        Returns:
            bool: True if formality has been lost, False if preserved
        """
        # Get samples for analysis
        original_sample = original_text[:10000] if len(original_text) > 10000 else original_text
        result_sample = result_text[:10000] if len(result_text) > 10000 else result_text
        
        # 1. Check sentence length - formal text often has longer sentences
        original_sentences = [s.strip() for s in re.split(r'[.!?]', original_sample) if s.strip()]
        result_sentences = [s.strip() for s in re.split(r'[.!?]', result_sample) if s.strip()]
        
        if not original_sentences or not result_sentences:
            return False  # Can't determine if empty sentences
            
        avg_original_len = sum(len(s.split()) for s in original_sentences) / len(original_sentences)
        avg_result_len = sum(len(s.split()) for s in result_sentences) / len(result_sentences)
        
        # If average sentence length decreased by more than 20%, likely breach of formality
        sentence_length_preserved = (avg_result_len >= avg_original_len * 0.8)
        
        # 2. Check for casual language markers
        casual_markers = [
            r'\bbasically\b', r'\bjust\b', r'\banyway\b', r'\bstuff\b', r'\bthings\b', 
            r'\bguy\b', r'\bkind of\b', r'\bsort of\b', r'\ba lot\b', r'\blike\b', 
            r'\byou know\b', r'\bI think\b', r'\bI feel\b'
        ] + ADDITIONAL_CASUAL_MARKERS
        
        casual_count_original = 0
        casual_count_result = 0
        
        for marker in casual_markers:
            casual_count_original += len(re.findall(marker, original_sample, re.IGNORECASE))
            casual_count_result += len(re.findall(marker, result_sample, re.IGNORECASE))
        
        # Normalize casual language count by word count
        original_words = len(original_sample.split())
        result_words = len(result_sample.split())
        
        if original_words == 0 or result_words == 0:
            return False  # Can't determine if empty text
            
        casual_density_original = casual_count_original / original_words
        casual_density_result = casual_count_result / result_words
        
        # If casual language density increased by more than 50%, likely breach of formality
        casual_language_stable = (casual_density_result <= casual_density_original * 1.5)
        
        # 3. Check for technical vocabulary preservation
        # Extract potential technical terms from original (words not in common vocabulary)
        common_words = {'the', 'and', 'a', 'to', 'of', 'in', 'that', 'is', 'was', 'for', 'on', 'with', 'by', 'as', 'it', 'this', 'at', 'from'}
        potential_technical_terms = set()
        
        for word in original_sample.split():
            word = re.sub(r'[^\w]', '', word.lower())
            if len(word) > 6 and word not in common_words:  # Simple heuristic for technical terms
                potential_technical_terms.add(word)
        
        # Count how many potential technical terms are preserved in result
        preserved_terms = 0
        result_words_set = {re.sub(r'[^\w]', '', word.lower()) for word in result_sample.split()}
        
        for term in potential_technical_terms:
            if term in result_words_set:
                preserved_terms += 1
        
        # If fewer than 70% of technical terms preserved, likely breach of formality
        if len(potential_technical_terms) > 0:
            technical_vocabulary_preserved = (preserved_terms >= len(potential_technical_terms) * 0.7)
        else:
            technical_vocabulary_preserved = True  # No technical terms to preserve
        
        # Combined decision - all checks must pass for formality to be considered preserved
        formality_preserved = sentence_length_preserved and casual_language_stable and technical_vocabulary_preserved
        
        return not formality_preserved