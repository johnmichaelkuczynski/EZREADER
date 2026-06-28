import logging
import re

logger = logging.getLogger(__name__)

def new_emergency_recovery_logic(self, original_text, result_text):
    """
    Enhanced emergency recovery logic to handle cases where output is shorter
    or simpler than input. This addresses density loss and breezification.
    
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
    if result_words < original_words:
        logger.warning(f"Output too short: original={original_words} words, result={result_words} words. Applying emergency recovery.")
        
        # Create emergency correction prompt
        emergency_prompt = f"""EMERGENCY CORRECTION REQUIRED: 

The rewrite you produced has FAILED to meet the mandatory quality requirements. It was too short, too simplistic, and lost the intellectual density of the original. This is a critical rewriting failure.

REQUIRED CORRECTIONS:
1. Your rewrite MUST match or exceed the original text length (minimum 100%-110% of original length)
2. You MUST preserve the full intellectual structure, complexity, and philosophical depth
3. You MUST maintain the formal academic tone, precise vocabulary, and conceptual density
4. You MUST keep complete argument structure with all logical steps intact
5. You MUST NOT simplify, summarize, or "breezify" the content

Rewrite the following text again, with particular focus on:
- Using precise technical/philosophical vocabulary 
- Maintaining complex sentence structures
- Preserving ALL logical steps in arguments
- Matching or exceeding the original's sophistication level
- Adding clarity without reducing complexity

Original text for reference:
{original_text[:5000]}

Text requiring comprehensive rewrite (maintaining full complexity and length):
{result_text}"""

        # Process with emergency prompt
        # (This would call the appropriate API again - implementation depends on existing code structure)
        corrected_text = self._process_with_appropriate_api(emergency_prompt)
        return corrected_text
    
    # Check for formality/density loss
    if self._check_tone_simplified(original_text, result_text):
        logger.warning("Output has been casualized or simplified. Applying formality correction.")
        
        # Create formality correction prompt
        formality_prompt = f"""CRITICAL FORMALITY CORRECTION REQUIRED:

You have FAILED to preserve the formal rigor, conceptual density, and technical tone of the original document. Your rewrite has inappropriately simplified, casualized, or "breezified" sophisticated content.

MANDATORY REQUIREMENTS:
1. Restore original argument structure without simplification
2. Use formal, precise vocabulary matching the original's sophistication
3. Maintain complex sentence structures and paragraph-by-paragraph logic 
4. Preserve all logical steps and intellectual density
5. Eliminate all casual language, simplifications, and journalistic style

When rewriting, you MUST:
- Replace simplified terms with precise technical vocabulary
- Restore formal academic/philosophical tone throughout
- Rebuild complex sentence structures
- Remove any invented examples or analogies
- Preserve exact logical flow and conceptual depth

Original text for tone reference:
{original_text[:5000]}

Text requiring formal tone restoration (MUST match intellectual weight and density of original):
{result_text}"""

        # Process with formality prompt
        # (This would call the appropriate API again - implementation depends on existing code structure)
        corrected_text = self._process_with_appropriate_api(formality_prompt)
        return corrected_text
    
    # If no issues detected, return the original result
    return result_text
    
def _check_tone_simplified(self, original_text, result_text):
    """
    Enhanced check for tone simplification, casual language, and breezification
    
    Args:
        original_text: The original formal text
        result_text: The rewritten text to check
        
    Returns:
        bool: True if text has been simplified/casualized, False if formality preserved
    """
    # Get samples for analysis
    original_sample = original_text[:10000] if len(original_text) > 10000 else original_text
    result_sample = result_text[:10000] if len(result_text) > 10000 else result_text
    
    # 1. Check sentence length - formal text often has longer sentences
    original_sentences = [s.strip() for s in re.split(r'[.!?]', original_sample) if s.strip()]
    result_sentences = [s.strip() for s in re.split(r'[.!?]', result_sample) if s.strip()]
    
    avg_original_len = sum(len(s.split()) for s in original_sentences) / max(1, len(original_sentences))
    avg_result_len = sum(len(s.split()) for s in result_sentences) / max(1, len(result_sentences))
    
    # If average sentence length decreased by more than 20%, likely breach of formality
    sentence_length_preserved = (avg_result_len >= avg_original_len * 0.8)
    
    # 2. Check for casual language markers
    casual_markers = [
        r'\bbasically\b', r'\bjust\b', r'\banyway\b', r'\bstuff\b', r'\bthings\b', 
        r'\bguy\b', r'\bkind of\b', r'\bsort of\b', r'\ba lot\b', r'\blike\b', 
        r'\byou know\b', r'\bI think\b', r'\bI feel\b',
        r'\bsimply put\b', r'\bin other words\b', r'\bto put it another way\b',
        r'\bto sum up\b', r'\bin summary\b', r'\bessentially\b', 
        r'\bmostly\b', r'\bmainly\b', r'\bgenerally\b', r'\boverall\b',
        r'\bin my opinion\b', r'\bI believe\b', r'\bpretty\b', r'\breally\b',
        r'\blet me\b', r'\blook at\b', r'\blet\'s consider\b', r'\blet\'s examine\b'
    ]
    
    casual_count_original = 0
    casual_count_result = 0
    
    for marker in casual_markers:
        casual_count_original += len(re.findall(marker, original_sample, re.IGNORECASE))
        casual_count_result += len(re.findall(marker, result_sample, re.IGNORECASE))
    
    # Normalize casual language count by word count
    original_words = len(original_sample.split())
    result_words = len(result_sample.split())
    
    casual_density_original = casual_count_original / max(1, original_words)
    casual_density_result = casual_count_result / max(1, result_words)
    
    # If casual language density increased by more than 50%, likely breach of formality
    casual_language_stable = (casual_density_result <= casual_density_original * 1.5)
    
    # 3. Check for technical vocabulary preservation
    # Extract potential technical terms from original (words not in common vocabulary)
    # This is a simplified approach - a real implementation would use more sophisticated NLP
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
    
    technical_vocabulary_preserved = (preserved_terms >= len(potential_technical_terms) * 0.7)
    
    # Combined decision - all checks must pass for formality to be considered preserved
    formality_preserved = sentence_length_preserved and casual_language_stable and technical_vocabulary_preserved
    
    return not formality_preserved