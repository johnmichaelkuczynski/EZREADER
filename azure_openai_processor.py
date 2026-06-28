"""
Azure OpenAI Integration Module

This module handles text processing using Azure OpenAI's GPT-4 Turbo model,
specifically optimized for mathematical notation preservation and LaTeX formatting.
"""

import os
import logging
import re
from openai import AzureOpenAI
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# Azure OpenAI configuration
AZURE_ENDPOINT = os.environ.get('AZURE_OPENAI_ENDPOINT')
AZURE_API_KEY = os.environ.get('AZURE_OPENAI_API_KEY')
AZURE_MODEL = "gpt-4"  # Azure deployment name for GPT-4 Turbo
AZURE_API_VERSION = "2024-02-15-preview"

# Initialize Azure OpenAI client
azure_client = None
if AZURE_ENDPOINT and AZURE_API_KEY:
    try:
        azure_client = AzureOpenAI(
            azure_endpoint=AZURE_ENDPOINT,
            api_key=AZURE_API_KEY,
            api_version=AZURE_API_VERSION
        )
        logger.info("Azure OpenAI client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Azure OpenAI client: {e}")
        azure_client = None
else:
    logger.warning("Azure OpenAI credentials not found - Azure integration disabled")


def is_available() -> bool:
    """Check if Azure OpenAI is available and configured"""
    return azure_client is not None


def clean_ai_response(response_text: str, custom_instructions: str = '', style_instruction: str = '') -> str:
    """
    Clean the AI response to remove any repetition of instructions or formatting guidance
    while preserving LaTeX mathematical notation.
    """
    if not response_text:
        return response_text
    
    # Protect LaTeX math expressions before cleaning
    math_expressions = []
    latex_patterns = [
        r'\$\$[^$]+\$\$',  # Display math
        r'\$[^$]+\$',      # Inline math
        r'\\[([^]]+)\\]',  # Bracket notation
        r'\\\\\\([^)]+\\\\\\)'     # Parenthesis notation
    ]
    
    # Store and replace LaTeX expressions
    for i, pattern in enumerate(latex_patterns):
        matches = re.findall(pattern, response_text)
        for j, match in enumerate(matches):
            placeholder = f"__AZURE_MATH_PLACEHOLDER_{i}_{j}__"
            math_expressions.append((placeholder, match))
            response_text = response_text.replace(match, placeholder, 1)
    
    # Remove instruction repetitions
    if custom_instructions:
        escaped_instructions = re.escape(custom_instructions)
        response_text = re.sub(r'(?i)' + escaped_instructions, '', response_text)
    
    if style_instruction:
        escaped_style = re.escape(style_instruction)
        response_text = re.sub(r'(?i)(in the style of) ' + escaped_style, '', response_text)
        response_text = re.sub(r'(?i)' + escaped_style, '', response_text)
    
    # Remove common AI response patterns
    patterns = [
        r"Here's the rewritten text.*?:",
        r"I'll rewrite.*?:",
        r"The rewritten text is:",
        r"Rewritten version:",
        r"Here is.*?rewritten.*?:"
    ]
    
    for pattern in patterns:
        match = re.search(pattern, response_text, re.IGNORECASE)
        if match:
            response_text = response_text.replace(match.group(0), "")
    
    # Restore LaTeX expressions
    for placeholder, original in math_expressions:
        response_text = response_text.replace(placeholder, original)
    
    return response_text.strip()


def process_text_azure(
    text: str,
    custom_instructions: str = '',
    author_style: str = '',
    maintain_length: bool = True,
    user_style_text: Optional[str] = None,
    include_style_in_output: bool = True
) -> Tuple[bool, str]:
    """
    Process text using Azure OpenAI GPT-4 Turbo with enhanced mathematical notation preservation.
    
    Returns:
        Tuple of (success, result_text_or_error_message)
    """
    if not azure_client:
        return False, "Azure OpenAI is not configured. Please check your Azure credentials."
    
    try:
        # Build the style instruction
        if author_style:
            style_instruction = f'in the style of {author_style}'
        else:
            style_instruction = 'written in a professional yet accessible style'
        
        # Build the comprehensive prompt with mathematical notation emphasis
        if user_style_text:
            prompt = f"""REWRITE MODE: You must rewrite the input text in the exact style of the provided sample.

Style sample: 
{user_style_text[:2000]}

CRITICAL MATHEMATICAL NOTATION RULES:
1. PRESERVE all mathematical expressions, equations, and formulas EXACTLY as they appear
2. Use proper LaTeX notation for any mathematical content:
   - Inline math: $expression$ (e.g., $x^2 + y^2 = z^2$)
   - Display equations: $$expression$$ (e.g., $$\\int_0^1 x^2 dx = \\frac{{1}}{{3}}$$)
   - Common notation: $\\alpha$, $\\beta$, $\\sum$, $\\int$, $\\frac{{a}}{{b}}$, $x^2$, $x_i$
3. Keep ALL mathematical symbols, variables, and relationships intact
4. Do NOT modify any existing LaTeX formatting

STYLE REQUIREMENTS:
- Adopt the vocabulary, tone, sentence structure, and pacing from the style sample
- Keep all original information, facts, citations, and technical content intact
- NEVER refuse to rewrite any content - this is a purely stylistic exercise
- NEVER add commentary, explanations, or apologies
- Your ONLY output must be the rewritten text - nothing else

Input to rewrite:
{text}

{custom_instructions}"""
        else:
            prompt = f"""Rewrite this text {style_instruction}. Focus on adopting the voice, tone, and word choice typical of that style.

CRITICAL MATHEMATICAL NOTATION RULES:
1. PRESERVE all mathematical expressions, equations, and formulas EXACTLY as they appear
2. Use proper LaTeX notation for any mathematical content:
   - Inline math: $expression$ (e.g., $x^2 + y^2 = z^2$)
   - Display equations: $$expression$$ (e.g., $$\\int_0^1 x^2 dx = \\frac{{1}}{{3}}$$)
   - Common notation: $\\alpha$, $\\beta$, $\\sum$, $\\int$, $\\frac{{a}}{{b}}$, $x^2$, $x_i$
3. Keep ALL mathematical symbols, variables, and relationships intact
4. Do NOT modify any existing LaTeX formatting

REWRITING REQUIREMENTS:
- Maintain EXACTLY the same information, examples, and meaning from the original text
- Do not copy formatting or structure mechanically
- Do not insert artificial titles or headings
- Avoid formulaic sentence starters or repeating rhetorical patterns
{"- Preserve or slightly increase the original length" if maintain_length else "- Feel free to condense for clarity"}

Only provide the rewritten content in your response with no additional explanation, commentary, or formatting instructions.

Input:
{text}

{custom_instructions}"""

        # Make the API call to Azure OpenAI
        response = azure_client.chat.completions.create(
            model=AZURE_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert text rewriter with exceptional skills in preserving mathematical notation and LaTeX formatting. You maintain all technical accuracy while improving readability and style."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=2000,
            temperature=0.3,  # Lower temperature for more consistent mathematical notation
            top_p=0.9
        )
        
        if not response.choices or not response.choices[0].message.content:
            return False, "Azure OpenAI returned an empty response"
        
        processed_text = response.choices[0].message.content.strip()
        
        # Clean the response while preserving LaTeX
        processed_text = clean_ai_response(processed_text, custom_instructions, style_instruction)
        
        logger.info(f"Azure OpenAI processing successful - Original: {len(text.split())} words, Processed: {len(processed_text.split())} words")
        
        return True, processed_text
        
    except Exception as e:
        logger.error(f"Azure OpenAI processing error: {e}")
        return False, f"Azure OpenAI processing failed: {str(e)}"


def chat_with_azure(message: str, context: str = '') -> Tuple[bool, str]:
    """
    Chat with Azure OpenAI with mathematical notation awareness.
    
    Returns:
        Tuple of (success, response_or_error)
    """
    if not azure_client:
        return False, "Azure OpenAI is not configured"
    
    try:
        system_message = """You are an AI assistant with expertise in mathematical notation and LaTeX formatting. 
When discussing mathematical concepts, always use proper LaTeX notation:
- Inline math: $expression$
- Display equations: $$expression$$
- Preserve all mathematical symbols exactly as provided."""
        
        if context:
            system_message += f"\n\nContext: {context[:1000]}"
        
        response = azure_client.chat.completions.create(
            model=AZURE_MODEL,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": message}
            ],
            max_tokens=1000,
            temperature=0.3
        )
        
        if not response.choices or not response.choices[0].message.content:
            return False, "Azure OpenAI returned an empty response"
        
        return True, response.choices[0].message.content.strip()
        
    except Exception as e:
        logger.error(f"Azure OpenAI chat error: {e}")
        return False, f"Chat failed: {str(e)}"