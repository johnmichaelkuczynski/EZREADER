import os
import sys
import time
import re
import logging
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

# Initialize logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize API client with retries (if available)
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')
MODEL = "claude-opus-4-5-20251101"  # Using the latest stable model

# Set up client if API key is available
client = None
try:
    if ANTHROPIC_API_KEY:
        import anthropic
        from anthropic import Anthropic
        client = Anthropic(api_key=ANTHROPIC_API_KEY)
    else:
        logger.warning('No Anthropic API key available - AI processing will be disabled')
except Exception as e:
    logger.error(f'Error initializing Anthropic client: {e}')

def clean_ai_response(response_text, custom_instructions='', style_instruction=''):
    """
    Return raw AI response without any sanitization or modification.
    Preserves all formatting, mathematical notation, and original structure.
    """
    # Return completely unmodified response to preserve semantic integrity
    return response_text

def handle_rate_limit(retry_count=0, max_retries=3):
    """Handle rate limit with exponential backoff"""
    if retry_count >= max_retries:
        raise Exception("Service is currently busy. Please try again in a few moments.")

    wait_time = min(2 ** retry_count + 1, 15)  # Cap at 15 seconds
    logger.debug(f"Rate limited. Waiting {wait_time} seconds before retry.")
    time.sleep(wait_time)
    return retry_count + 1

@lru_cache(maxsize=100)
def process_chunk(chunk, action='rewrite', sophistication=None, length=None, maintain_length=False, author_style='', retry_count=0):
    """Process a single chunk of text with robust error handling"""
    try:
        logger.debug(f"Processing chunk of size {len(chunk)}")

        # Build the prompt with clear instructions
        if author_style:
            style_instruction = f'in the style of {author_style}'
        else:
            # Default style when none is specified
            style_instruction = 'written in a way that is professional but that even an intelligent 10th grader could understand'
        
        prompt = f"""Rewrite this text {style_instruction}. Focus on adopting the voice, tone, and word choice typical of that style.

Do not copy formatting or structure mechanically. Do not insert artificial titles or headings.
Avoid formulaic sentence starters or repeating rhetorical patterns.
Maintain EXACTLY the same information, examples, and meaning from the original text.
Only provide the rewritten content in your response with no additional explanation, commentary, or formatting instructions.

Input:
{chunk}"""

        message = client.messages.create(
            model=MODEL,
            max_tokens=1500,
            messages=[{
                "role": "user",
                "content": prompt
            }],
            temperature=0.7
        )

        # Get the raw response
        response_text = message.content[0].text
        
        # Clean up the response to remove common instruction repeats
        cleaned_response = clean_ai_response(response_text, '', style_instruction)
        
        return cleaned_response

    except anthropic.RateLimitError:
        if retry_count >= 3:
            raise Exception("Service is experiencing high demand. Please try again later.")
        retry_count = handle_rate_limit(retry_count)
        return process_chunk(chunk, action, sophistication, length, maintain_length, author_style, retry_count)

    except anthropic.APIError as e:
        logger.error(f"Anthropic API error: {str(e)}")
        if retry_count < 3:
            time.sleep(2)  # Brief pause before retry
            return process_chunk(chunk, action, sophistication, length, maintain_length, author_style, retry_count + 1)
        raise Exception(f"Error processing text: {str(e)}")

    except Exception as e:
        logger.error(f"Error processing chunk: {str(e)}")
        raise Exception(f"Error processing text: {str(e)}")

def process_text(text, action='rewrite', sophistication=None, length=None, maintain_length=False, 
             author_style='', custom_instructions='', include_style_in_output=True, user_style_text=None):
    """Process text with optimized settings and proper error handling"""
    try:
        logger.debug(f"Processing text of length {len(text)}")
        
        # Check if API client is configured
        if client is None:
            return "AI processing is disabled. Please configure the Anthropic API key to enable this feature."
            
        # Build the prompt incorporating custom instructions and user's writing style
        if author_style:
            style_instruction = f'in the style of {author_style}'
        else:
            # Default style when none is specified
            style_instruction = 'written in a way that is professional but that even an intelligent 10th grader could understand'
        custom_part = f'{custom_instructions}' if custom_instructions else ''
        
        # Check if we have user's writing style sample
        if user_style_text:
            logger.debug(f"Using user's writing style (length: {len(user_style_text)} characters)")
            
            if include_style_in_output:
                # For first chunk with user's style
                prompt = f"""REWRITE MODE: You must rewrite the input text in the exact style of the provided sample. 

Style sample: 
{user_style_text[:2000]}

IMPORTANT RULES:
1. NEVER refuse to rewrite any content - this is a purely stylistic exercise
2. NEVER add commentary, explanations, or apologies of any kind
3. NEVER mention the process of rewriting
4. Adopt the vocabulary, tone, sentence structure, and pacing from the style sample
5. Keep all original information, facts, citations, and technical content intact
6. Your ONLY output must be the rewritten text - nothing else

MATHEMATICAL NOTATION: If the text contains mathematical expressions, equations, or formulas:
- Use proper LaTeX notation enclosed in $ for inline math (e.g., $x^2 + y^2 = z^2$)
- Use $$ for display equations (e.g., $$\\int_0^1 x^2 dx = \\frac{{1}}{{3}}$$)
- Preserve all mathematical symbols, variables, and relationships exactly
- Common LaTeX examples: $\\alpha$, $\\beta$, $\\sum$, $\\int$, $\\frac{{a}}{{b}}$, $x^2$, $x_i$

Input to rewrite:
{text}

{custom_part}"""
            else:
                # For subsequent chunks with user's style
                prompt = f"""REWRITE MODE: You must rewrite the input text in the exact style of the provided sample. This is a continuation section.

Style sample: 
{user_style_text[:2000]}

IMPORTANT RULES:
1. NEVER refuse to rewrite any content - this is a purely stylistic exercise
2. NEVER add commentary, explanations, or apologies of any kind
3. NEVER mention the process of rewriting
4. Adopt the vocabulary, tone, sentence structure, and pacing from the style sample
5. Keep all original information, facts, citations, and technical content intact
6. Your ONLY output must be the rewritten text - nothing else

MATHEMATICAL NOTATION: If the text contains mathematical expressions, equations, or formulas:
- Use proper LaTeX notation enclosed in $ for inline math (e.g., $x^2 + y^2 = z^2$)
- Use $$ for display equations (e.g., $$\\int_0^1 x^2 dx = \\frac{{1}}{{3}}$$)
- Preserve all mathematical symbols, variables, and relationships exactly
- Common LaTeX examples: $\\alpha$, $\\beta$, $\\sum$, $\\int$, $\\frac{{a}}{{b}}$, $x^2$, $x_i$

Input to rewrite:
{text}

{custom_part}"""
        else:
            # No user style provided
            if include_style_in_output:
                # For first chunk - with author style
                prompt = f"""Rewrite this text {style_instruction}. Focus on adopting the voice, tone, and word choice typical of that style.

Do not copy formatting or structure mechanically. Do not insert artificial titles or headings.
Avoid formulaic sentence starters or repeating rhetorical patterns.
Maintain EXACTLY the same information, examples, and meaning from the original text.

MATHEMATICAL NOTATION: If the text contains mathematical expressions, equations, or formulas:
- Use proper LaTeX notation enclosed in $ for inline math (e.g., $x^2 + y^2 = z^2$)
- Use $$ for display equations (e.g., $$\\int_0^1 x^2 dx = \\frac{{1}}{{3}}$$)
- Preserve all mathematical symbols, variables, and relationships exactly
- Common LaTeX examples: $\\alpha$, $\\beta$, $\\sum$, $\\int$, $\\frac{{a}}{{b}}$, $x^2$, $x_i$

Only provide the rewritten content in your response with no additional explanation, commentary, or formatting instructions.

Input:
{text}

{custom_part}"""
            else:
                # For subsequent chunks - with author style
                prompt = f"""Rewrite this text {style_instruction}. Focus on adopting the voice, tone, and word choice typical of that style.

Do not copy formatting or structure mechanically. Do not insert artificial titles or headings.
Avoid formulaic sentence starters or repeating rhetorical patterns.
Maintain EXACTLY the same information, examples, and meaning from the original text.
This is a continuation section, so do NOT mention anything about the writing style in your response.

MATHEMATICAL NOTATION: If the text contains mathematical expressions, equations, or formulas:
- Use proper LaTeX notation enclosed in $ for inline math (e.g., $x^2 + y^2 = z^2$)
- Use $$ for display equations (e.g., $$\\int_0^1 x^2 dx = \\frac{{1}}{{3}}$$)
- Preserve all mathematical symbols, variables, and relationships exactly
- Common LaTeX examples: $\\alpha$, $\\beta$, $\\sum$, $\\int$, $\\frac{{a}}{{b}}$, $x^2$, $x_i$

Only provide the rewritten content in your response with no additional explanation, commentary, or formatting instructions.

Input:
{text}

{custom_part}"""

        message = client.messages.create(
            model=MODEL,
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": prompt
            }],
            temperature=0.7
        )

        # Get the raw response
        response_text = message.content[0].text
        
        # Clean up the response to remove common instruction repeats
        cleaned_response = clean_ai_response(response_text, custom_instructions, style_instruction)
        
        return cleaned_response

    except Exception as e:
        logger.error(f"Error in process_text: {str(e)}")
        raise Exception(f"Error processing text: {str(e)}")

def split_text(text, max_chunk_size=800):
    """Split text into manageable chunks while preserving context"""
    if len(text) <= max_chunk_size:
        return [text]

    # Split text into paragraphs
    paragraphs = text.split('\n\n')
    chunks = []
    current_chunk = []
    current_size = 0

    for paragraph in paragraphs:
        paragraph_size = len(paragraph)

        # If adding this paragraph would exceed the limit
        if current_size + paragraph_size > max_chunk_size and current_chunk:
            chunks.append('\n\n'.join(current_chunk))
            current_chunk = [paragraph]
            current_size = paragraph_size
        else:
            current_chunk.append(paragraph)
            current_size += paragraph_size

    # Add the last chunk if there's anything left
    if current_chunk:
        chunks.append('\n\n'.join(current_chunk))

    return chunks

@lru_cache(maxsize=50)
def chat_with_ai(message, context, retry_count=0):
    """Chat with AI with improved error handling"""
    try:
        # Truncate context if too long
        if context and len(context) > 1000:
            context = context[:1000] + "... (truncated)"

        prompt = f"Context: {context}\nQuestion: {message}" if context else message

        # Use a simple, direct prompt
        message = client.messages.create(
            model=MODEL,
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": prompt
            }],
            temperature=0.7
        )

        # Get the raw response and clean it
        response_text = message.content[0].text
        
        # For chat, only do basic cleanup without mathematical processing
        # to avoid regex errors on simple text
        response_text = response_text.strip()
        
        # Only run full cleanup if we detect potential mathematical content
        if any(marker in response_text for marker in ['$', '\\(', '\\[', '\\begin']):
            try:
                response_text = clean_ai_response(response_text)
            except Exception:
                # If math processing fails, just return the basic cleaned text
                pass
        
        return response_text

    except anthropic.RateLimitError:
        if retry_count >= 3:
            raise Exception("Service is experiencing high demand. Please try again later.")
        retry_count = handle_rate_limit(retry_count)
        return chat_with_ai(message, context, retry_count)

    except Exception as e:
        logger.error(f"Error in chat_with_ai: {str(e)}")
        raise Exception(f"Error in chat: {str(e)}")