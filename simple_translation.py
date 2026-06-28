"""
Simple Translation Module

This module provides a clean, simplified translation service using the 
multi-provider processor. It's designed to handle both small and large documents
with optimal chunking for better performance.
"""

import os
import logging
import time
from typing import Dict, List, Tuple, Optional, Any
from api_key_manager import api_key_manager

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants for chunking large documents
MAX_CHUNK_SIZE = 4000  # characters per chunk for large documents
MAX_SINGLE_REQUEST_SIZE = 50000  # maximum characters for a single request

def translate_text(
    text: str,
    source_language: str,
    target_language: str,
    ai_provider: str = 'openai'
) -> Tuple[str, Dict[str, Any]]:
    """
    Translate text from source language to target language using the specified AI provider.
    
    Args:
        text: Text to translate
        source_language: Source language code (or 'auto' for auto-detection)
        target_language: Target language code
        ai_provider: AI provider to use ('openai', 'anthropic', or 'perplexity')
        
    Returns:
        Tuple of (translated_text, metadata)
    """
    if not text:
        return '', {'error': 'No text provided'}
        
    # If source and target languages are the same, return original text
    if source_language == target_language and source_language != 'auto':
        return text, {'message': 'No translation needed (same language)'}
    
    # Import our multi-provider processor
    from multi_provider_processor import MultiProviderProcessor
    
    # Get API key for the selected provider
    key_info = api_key_manager.get_key_by_provider(ai_provider)
    if not key_info:
        return '', {'error': f'No {ai_provider} API key available'}
        
    key_id, api_key = key_info
    
    # Define translation system prompts by provider
    system_prompts = {
        'openai': f"You are a professional translator. Translate the following text to {target_language}. Maintain all formatting, paragraph structure, and preserve the original meaning precisely. Do not add or remove information.",
        'anthropic': f"You are a professional translator. Translate the following text to {target_language}. Preserve all formatting, paragraph breaks, and special characters. Maintain the original meaning, tone, and style as closely as possible.",
        'perplexity': f"Translate the following text to {target_language}. Preserve formatting and maintain the exact meaning. Do not add explanations or notes."
    }
    
    # Create base prompt based on source language setting
    if source_language == 'auto':
        base_prompt = f"Translate this text to {target_language}:"
    else:
        base_prompt = f"Translate this text from {source_language} to {target_language}:"
    
    # Start timer for performance tracking
    start_time = time.time()
    word_count = len(text.split())
    
    # Process translation with appropriate provider
    try:
        processor = MultiProviderProcessor()
        
        # For large documents (over MAX_SINGLE_REQUEST_SIZE characters), chunk the text
        if len(text) > MAX_SINGLE_REQUEST_SIZE:
            logger.info(f"Large document detected ({len(text)} chars/{word_count} words), processing in chunks")
            
            # Split the text into chunks at paragraph boundaries
            chunks = split_into_chunks(text, MAX_CHUNK_SIZE)
            chunk_count = len(chunks)
            logger.info(f"Split document into {chunk_count} chunks")
            
            # Process each chunk and combine results
            translated_chunks = []
            for i, chunk in enumerate(chunks):
                logger.info(f"Processing chunk {i+1}/{chunk_count}")
                
                # Create chunk-specific prompt
                chunk_prompt = f"{base_prompt} This is part {i+1} of {chunk_count} of a larger document, so maintain consistency in translation:\n\n{chunk}"
                
                # Process this chunk with the selected provider
                if ai_provider == 'openai':
                    # Use OpenAI
                    chunk_result = process_with_openai(chunk_prompt, api_key, system_prompts['openai'])
                    
                elif ai_provider == 'anthropic':
                    # Use Anthropic
                    chunk_result = process_with_anthropic(chunk_prompt, api_key, system_prompts['anthropic'])
                    
                elif ai_provider == 'perplexity':
                    # Use Perplexity
                    chunk_result = process_with_perplexity(chunk_prompt, api_key, system_prompts['perplexity'])
                
                translated_chunks.append(chunk_result)
            
            # Combine all translated chunks
            final_result = '\n\n'.join(translated_chunks)
            
        else:
            # For smaller documents, process as a single request
            user_prompt = f"{base_prompt}\n\n{text}"
            
            if ai_provider == 'openai':
                # Use OpenAI
                final_result = process_with_openai(user_prompt, api_key, system_prompts['openai'])
                
            elif ai_provider == 'anthropic':
                # Use Anthropic
                final_result = process_with_anthropic(user_prompt, api_key, system_prompts['anthropic'])
                
            elif ai_provider == 'perplexity':
                # Use Perplexity
                final_result = process_with_perplexity(user_prompt, api_key, system_prompts['perplexity'])
        
        # Reset failure count after successful API call
        api_key_manager.reset_key_failure(key_id)
        
        # Calculate performance metrics
        elapsed_time = time.time() - start_time
        
        # Return the translation result with metadata
        return final_result, {
            'elapsed_seconds': round(elapsed_time, 1),
            'words_per_second': round(word_count / elapsed_time, 1) if elapsed_time > 0 else 0,
            'source_language': source_language,
            'target_language': target_language,
            'engine_used': ai_provider,
            'word_count': word_count
        }
            
    except Exception as e:
        logger.error(f"Error processing translation with {ai_provider}: {str(e)}")
        api_key_manager.mark_key_unavailable(key_id, 60)
        return '', {'error': f'Translation failed: {str(e)}'}

def split_into_chunks(text: str, max_size: int) -> List[str]:
    """
    Split text into chunks of approximately max_size characters,
    ensuring chunk breaks occur at paragraph boundaries.
    
    Args:
        text: Text to split
        max_size: Maximum character length for each chunk
        
    Returns:
        List of text chunks
    """
    # Split text into paragraphs
    paragraphs = text.split('\n\n')
    
    chunks = []
    current_chunk = ""
    
    for paragraph in paragraphs:
        # If adding this paragraph would exceed max_size, start a new chunk
        if len(current_chunk) + len(paragraph) > max_size and current_chunk:
            chunks.append(current_chunk.strip())
            current_chunk = paragraph + '\n\n'
        else:
            current_chunk += paragraph + '\n\n'
    
    # Add the last chunk if not empty
    if current_chunk:
        chunks.append(current_chunk.strip())
        
    return chunks

def process_with_openai(prompt: str, api_key: str, system_prompt: str) -> str:
    """
    Process text with OpenAI GPT API
    """
    import openai
    from openai import OpenAI
    
    # Create client with API key
    client = OpenAI(api_key=api_key)
    
    try:
        # the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        # do not change this unless explicitly requested by the user
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,  # Lower temperature for more precise translation
            timeout=60  # Allow more time for translation
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        logger.error(f"OpenAI API error: {str(e)}")
        raise

def process_with_anthropic(prompt: str, api_key: str, system_prompt: str) -> str:
    """
    Process text with Anthropic Claude API
    """
    import anthropic
    from anthropic import Anthropic
    
    # Create client with API key
    client = Anthropic(api_key=api_key)
    
    try:
        # the newest Anthropic model is "claude-sonnet-4-5-20250929" which was released October 22, 2024
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            system=system_prompt,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,  # Lower temperature for more precise translation
            max_tokens=4000
        )
        
        return response.content[0].text
        
    except Exception as e:
        logger.error(f"Anthropic API error: {str(e)}")
        raise

def process_with_perplexity(prompt: str, api_key: str, system_prompt: str) -> str:
    """
    Process text with Perplexity API
    """
    import requests
    import json
    
    url = "https://api.perplexity.ai/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "sonar",
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.3,
        "max_tokens": 4000,
        "stream": False
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        
        result = response.json()
        return result["choices"][0]["message"]["content"]
        
    except Exception as e:
        logger.error(f"Perplexity API error: {str(e)}")
        raise