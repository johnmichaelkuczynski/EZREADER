from typing import Dict, List, Tuple, Optional, Any, Callable
import logging
import os

logger = logging.getLogger(__name__)

# Constants
API_TIMEOUT = 45

def new_process_with_openai(
    self,
    text: str, 
    api_key: str, 
    action: str = 'rewrite',
    style_instruction: str = '',
    custom_instructions: str = '',
    is_first_subchunk: bool = False
) -> str:
    """Process text using OpenAI API with improved prompts for style and density preservation"""
    import openai
    from openai import OpenAI
    
    client = self.get_client_for_provider('openai', api_key)
    
    # Different prompt handling based on the action
    if action == "expand":
        # This is for the emergency expansion case
        prompt = f"""{custom_instructions}"""
    else:
        # Enhanced prompt for style and density preservation
        if is_first_subchunk:
            prompt = f"""CRITICAL REWRITE INSTRUCTION:
{custom_instructions}

MANDATORY REQUIREMENTS:
1. Match or exceed the length of the original text (target 100%–110% of original length)
2. Maintain complete argument structure and paragraph-by-paragraph logic - NEVER simplify
3. Preserve or elevate the intellectual density, complexity, and tone
4. Match the sentence structure, tone, formality, and rhythm {style_instruction}
5. NEVER simplify, summarize, or "breezify" the input - maintain full logical complexity

When rewriting, you MUST:
- Use precise vocabulary that maintains intellectual rigor
- Preserve complex sentence structures and logical density
- Match or exceed the sophistication level of the original
- Maintain all logical steps, arguments, and philosophical depth
- Avoid casual language, simplification, or summarization
- Structure each paragraph to maintain complete argument flow

Only provide the rewritten content with no explanations or commentary.

TARGET DOCUMENT TEXT:
{text}"""
        else:
            prompt = f"""CRITICAL REWRITE INSTRUCTION:
{custom_instructions}

MANDATORY REQUIREMENTS:
1. Match or exceed the length of the original text (target 100%–110% of original length)
2. Maintain complete argument structure and paragraph-by-paragraph logic - NEVER simplify
3. Preserve or elevate the intellectual density, complexity, and tone
4. Match the sentence structure, tone, formality, and rhythm {style_instruction}
5. NEVER simplify, summarize, or "breezify" the input - maintain full logical complexity
6. Maintain consistency with previous rewritten sections

When rewriting, you MUST:
- Use precise vocabulary that maintains intellectual rigor
- Preserve complex sentence structures and logical density
- Match or exceed the sophistication level of the original
- Maintain all logical steps, arguments, and philosophical depth
- Avoid casual language, simplification, or summarization

Only provide the rewritten content with no explanations or commentary.

TARGET DOCUMENT TEXT:
{text}"""

    try:
        # the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
        # do not change this unless explicitly requested by the user
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=2000,
            timeout=API_TIMEOUT
        )
        
        response_text = response.choices[0].message.content
        cleaned_response = self.clean_ai_response(response_text, custom_instructions, style_instruction)
        return cleaned_response
        
    except Exception as e:
        logger.error(f"OpenAI API error: {str(e)}")
        raise