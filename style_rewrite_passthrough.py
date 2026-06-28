"""
Style Rewrite Passthrough Module

This module implements the style rewrite functionality as a pure pass-through
mechanism following the specifications provided. It is designed to take 
inputs and pass them, unchanged, to an LLM without any rewriting, reformatting,
simplification, interpretation, or other alterations.
"""

import logging
import os
import json
import requests
from typing import Dict, List, Optional, Any

# Initialize logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def process_style_rewrite(style_sample: str, target_text: str) -> str:
    """
    Process a style rewrite by passing the style sample and target text
    directly to the LLM without any modifications.
    
    Args:
        style_sample: User-authored document representing the user's writing style
        target_text: New text to be rewritten in that style
        
    Returns:
        The LLM's response text
    """
    logger.debug("Processing style rewrite as pure pass-through")
    
    # Determine which AI provider to use based on available API keys
    provider = _get_available_provider()
    
    if provider == "openai":
        return _process_with_openai(style_sample, target_text)
    elif provider == "anthropic":
        return _process_with_anthropic(style_sample, target_text)
    elif provider == "perplexity":
        return _process_with_perplexity(style_sample, target_text)
    else:
        return "No API provider available. Please configure at least one API key."

def _get_available_provider() -> Optional[str]:
    """
    Determine which AI provider to use based on available API keys.
    
    Returns:
        The name of an available provider or None if none are available
    """
    # Check OpenAI
    openai_key = os.environ.get("OPENAI_API_KEY")
    if openai_key and len(openai_key.strip()) > 0:
        return "openai"
    
    # Check Anthropic
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if anthropic_key and len(anthropic_key.strip()) > 0:
        return "anthropic"
    
    # Check Perplexity
    perplexity_key = os.environ.get("PERPLEXITY_API_KEY")
    if perplexity_key and len(perplexity_key.strip()) > 0:
        return "perplexity"
    
    # Check DeepSeek
    deepseek_key = os.environ.get("DEEPSEEK_API_KEY")
    if deepseek_key and len(deepseek_key.strip()) > 0:
        return "deepseek"
    
    return None

def _process_with_openai(style_sample: str, target_text: str) -> str:
    """
    Process style rewrite with OpenAI as a pure pass-through.
    Optimized for faster response time.
    
    Args:
        style_sample: User's writing style sample
        target_text: Text to be rewritten
        
    Returns:
        The raw response from OpenAI
    """
    try:
        import openai
        from openai import OpenAI
        
        # the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
        # do not change this unless explicitly requested by the user
        
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        
        logger.debug(f"Processing with OpenAI - style sample length: {len(style_sample)} chars, target text length: {len(target_text)} chars")
        
        # Check if target text is long - use more efficient prompting for faster response
        is_long_text = len(target_text) > 1500
        
        # Use more compact prompt for faster processing
        system_message = "Rewrite the target text to exactly match the writing style of the sample. Mimic the style precisely while maintaining the original content. Be quick and efficient."
        
        # For very long texts, add a note about efficiency
        if is_long_text:
            system_message += " Process efficiently as this is a long text."
        
        # Send optimized prompt for faster responses
        response = client.chat.completions.create(
            model="gpt-4o",  # Latest model
            messages=[
                {
                    "role": "system",
                    "content": system_message
                },
                {
                    "role": "user",
                    "content": f"STYLE SAMPLE:\n{style_sample}\n\nTARGET TEXT TO REWRITE:\n{target_text}"
                }
            ],
            temperature=0.5,  # Lower temperature for faster, more focused response
            max_tokens=4000
        )
        
        # Return the raw text without any additional processing
        result = response.choices[0].message.content
        logger.debug(f"OpenAI response received: {len(result)} chars")
        return result
        
    except Exception as e:
        logger.error(f"Error processing with OpenAI: {str(e)}")
        return f"Error processing with OpenAI: {str(e)}"

def _process_with_anthropic(style_sample: str, target_text: str) -> str:
    """
    Process style rewrite with Anthropic Claude as a pure pass-through.
    Optimized for faster response time.
    
    Args:
        style_sample: User's writing style sample
        target_text: Text to be rewritten
        
    Returns:
        The raw response from Anthropic
    """
    try:
        import anthropic
        from anthropic import Anthropic
        
        # the newest Anthropic model is "claude-sonnet-4-5-20250929" which was released October 22, 2024
        # do not change this unless explicitly requested by the user
        
        client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        
        logger.debug(f"Processing with Anthropic - style sample length: {len(style_sample)} chars, target text length: {len(target_text)} chars")
        
        # Check if target text is long - use more efficient prompting for faster response
        is_long_text = len(target_text) > 1500
        
        # Use simplified system message for faster processing
        system_message = "Rewrite the target text to exactly match the writing style of the sample. Be quick and efficient."
        
        if is_long_text:
            system_message += " Process efficiently as this is a long text."
        
        # Send optimized prompt for faster responses
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            system=system_message,
            max_tokens=4000,
            temperature=0.5,  # Lower temperature for faster responses
            messages=[
                {
                    "role": "user", 
                    "content": f"STYLE SAMPLE:\n{style_sample}\n\nTARGET TEXT TO REWRITE:\n{target_text}"
                }
            ]
        )
        
        # Return the raw text without any additional processing
        result = response.content[0].text
        logger.debug(f"Anthropic response received: {len(result)} chars")
        return result
        
    except Exception as e:
        logger.error(f"Error processing with Anthropic: {str(e)}")
        return f"Error processing with Anthropic: {str(e)}"

def _process_with_perplexity(style_sample: str, target_text: str) -> str:
    """
    Process style rewrite with Perplexity as a pure pass-through.
    Optimized for faster response time.
    
    Args:
        style_sample: User's writing sample
        target_text: Text to be rewritten
        
    Returns:
        The raw response from Perplexity
    """
    try:
        api_key = os.environ.get("PERPLEXITY_API_KEY")
        if not api_key:
            logger.error("No Perplexity API key found in environment variables")
            return "Error: Perplexity API key not configured"
            
        logger.debug(f"Processing with Perplexity - style sample length: {len(style_sample)} chars, target text length: {len(target_text)} chars")
        
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        # Check if target text is long - use more efficient prompting for faster response
        is_long_text = len(target_text) > 1500
        
        # Use more compact prompt for faster processing
        system_message = "Rewrite the target text to match the style of the sample. Be quick and efficient."
        
        if is_long_text:
            system_message += " Process quickly as this is a long text."
        
        data = {
            "model": "sonar",  # Using recommended model from blueprint
            "messages": [
                {
                    "role": "system",
                    "content": system_message
                },
                {
                    "role": "user",
                    "content": f"STYLE SAMPLE:\n{style_sample}\n\nTARGET TEXT TO REWRITE:\n{target_text}"
                }
            ],
            "temperature": 0.5,  # Lower temperature for faster, more focused response
            "max_tokens": 4000
        }
        
        # Send the revised HARD FIX prompt with forced imitation priming
        response = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers=headers,
            json=data,
            timeout=60  # Adding timeout to avoid hanging
        )
        
        if response.status_code == 200:
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            logger.debug(f"Perplexity response received: {len(content)} chars")
            return content
        else:
            error_msg = f"Error from Perplexity API: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return error_msg
            
    except Exception as e:
        logger.error(f"Error processing with Perplexity: {str(e)}")
        return f"Error processing with Perplexity: {str(e)}"