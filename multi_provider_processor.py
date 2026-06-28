import os
import sys
import time
import re
import logging
import concurrent.futures
from typing import Dict, List, Tuple, Optional, Any, Callable
from functools import lru_cache
import threading
from api_key_manager import api_key_manager
from improved_prompts import (OPENAI_FIRST_CHUNK_PROMPT, OPENAI_CONTINUATION_PROMPT,
                             ANTHROPIC_FIRST_CHUNK_PROMPT, ANTHROPIC_CONTINUATION_PROMPT,
                             EMERGENCY_RECOVERY_PROMPT, ENHANCED_FORMALITY_CORRECTION,
                             ADDITIONAL_CASUAL_MARKERS)
try:
    from azure_openai_processor import process_text_azure, is_available as azure_available
except ImportError:
    azure_available = lambda: False
    process_text_azure = None

# Initialize logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Constants for chunking
MACROCHUNK_SIZE = 5000  # words (about 20-25 pages)
MACROCHUNK_MIN_SIZE = 5000  # Minimum size for macrochunks (avoids small chunks)
MACROCHUNK_MAX_SIZE = 8000  # Maximum size for macrochunks
SUBCHUNK_SIZE = 500     # words (about 2-3 pages)
API_TIMEOUT = 45        # seconds
MAX_RETRIES = 1         # max retry per chunk

# Thread-local storage for tracking provider-specific clients
_thread_local = threading.local()

class MultiProviderProcessor:
    """
    Handles text processing through multiple AI providers with two-level chunking
    and robust error handling.
    """
    
    def __init__(self):
        """Initialize the processor with available API providers"""
        # Import provider-specific libraries only if keys are available
        self.has_openai = len(api_key_manager.openai_keys) > 0
        self.has_anthropic = len(api_key_manager.anthropic_keys) > 0
        self.has_perplexity = len(api_key_manager.perplexity_keys) > 0
        self.has_deepseek = len(api_key_manager.deepseek_keys) > 0
        self.has_venice = len(api_key_manager.venice_keys) > 0
        
        # Import the necessary libraries
        if self.has_openai:
            try:
                import openai
                self.openai_available = True
                logger.info("OpenAI client initialized successfully")
            except ImportError:
                logger.warning("OpenAI package not installed")
                self.openai_available = False
                
        if self.has_anthropic:
            try:
                import anthropic
                self.anthropic_available = True
                logger.info("Anthropic client initialized successfully")
            except ImportError:
                logger.warning("Anthropic package not installed")
                self.anthropic_available = False
                
        if self.has_perplexity:
            self.perplexity_available = True
            logger.info("Perplexity API access configured")
        else:
            self.perplexity_available = False
            
        if self.has_deepseek:
            try:
                import requests
                self.deepseek_available = True
                logger.info("DeepSeek API access configured")
            except ImportError:
                logger.warning("Requests package not available for DeepSeek")
                self.deepseek_available = False
        else:
            self.deepseek_available = False
            
        if self.has_venice:
            try:
                import requests
                self.venice_available = True
                logger.info("Venice API access configured")
            except ImportError:
                logger.warning("Requests package not available for Venice")
                self.venice_available = False
        else:
            self.venice_available = False
            
        # Track any in-progress processing for status updates
        self.current_process_id = None
        self.progress_tracking = {}
        
    def get_client_for_provider(self, provider: str, api_key: str) -> Any:
        """Get or create a client for the specified provider"""
        # Use thread local storage to cache clients per thread
        if not hasattr(_thread_local, 'clients'):
            _thread_local.clients = {}
            
        client_key = f"{provider}_{api_key[:8]}"
        
        if client_key in _thread_local.clients:
            return _thread_local.clients[client_key]
            
        # Create new client based on provider
        if provider == 'openai':
            import openai
            client = openai.OpenAI(api_key=api_key)
            _thread_local.clients[client_key] = client
            return client
            
        elif provider == 'anthropic':
            import anthropic
            from anthropic import Anthropic
            client = Anthropic(api_key=api_key)
            _thread_local.clients[client_key] = client
            return client
            
        elif provider == 'perplexity':
            # For Perplexity, we don't need a dedicated client object
            # We'll use requests directly in the process_with_perplexity method
            _thread_local.clients[client_key] = {"api_key": api_key}
            return _thread_local.clients[client_key]
            
        elif provider == 'deepseek':
            # For DeepSeek, we don't need a dedicated client object
            # We'll use requests directly in the process_with_deepseek method
            _thread_local.clients[client_key] = {"api_key": api_key}
            return _thread_local.clients[client_key]
            
        elif provider == 'venice':
            # For Venice, we use requests directly in process_with_venice
            _thread_local.clients[client_key] = {"api_key": api_key}
            return _thread_local.clients[client_key]
            
        return None

    def split_into_macrochunks(self, text: str) -> List[str]:
        """
        Split text into macrochunks of 5,000-8,000 words each, ensuring clean paragraph breaks
        for better semantic coherence and optimal processing
        """
        if not text:
            return []
            
        # Count total words
        words = text.split()
        total_words = len(words)
        
        if total_words <= MACROCHUNK_MIN_SIZE:
            logger.debug(f"Text has {total_words} words; treating as a single macrochunk")
            return [text]
            
        logger.info(f"Enhanced macrochunking: Splitting text of {total_words} words into optimal chunks of {MACROCHUNK_MIN_SIZE}-{MACROCHUNK_MAX_SIZE} words")
        
        # Split text into paragraphs with improved pattern recognition
        # Use multiple newline formats to better detect structural breaks
        paragraph_split_patterns = [r'\n\s*\n', r'\n\s*#', r'\n\s*\*\*\*', r'\n\s*---']
        paragraphs = []
        
        # First try to split by multiple line breaks
        for pattern in paragraph_split_patterns:
            split_text = re.split(pattern, text)
            if len(split_text) > 1:
                # We found paragraph breaks, process them
                for para_candidate in split_text:
                    if para_candidate.strip():
                        paragraphs.append(para_candidate.strip())
                break
        
        # Fallback to simple line breaks if no paragraph structure was found
        if not paragraphs:
            logger.debug("No standard paragraph breaks found, using line-by-line splitting")
            for line in text.split('\n'):
                if line.strip():
                    paragraphs.append(line.strip())
        
        # Detect section headings for better semantic chunking
        section_indicators = [
            r'^#+\s+', r'^\s*PART\s+[IVX0-9]+', r'^\s*CHAPTER\s+[IVX0-9]+', 
            r'^\s*SECTION\s+[IVX0-9]+', r'^[IVX]+\.\s', r'^\d+\.\s'
        ]
        
        section_starts = []
        for i, para in enumerate(paragraphs):
            # Check if paragraph starts with a section heading pattern
            for pattern in section_indicators:
                if re.match(pattern, para):
                    section_starts.append(i)
                    logger.debug(f"Detected section start at paragraph {i}: {para[:50]}...")
                    break
        
        # Group paragraphs into macrochunks with enhanced logic
        macrochunks = []
        current_chunk = []
        current_size = 0
        last_section_start = 0
        
        for i, paragraph in enumerate(paragraphs):
            para_words = len(paragraph.split())
            
            # Special handling for section starts - try to align macrochunk boundaries with section boundaries
            is_section_start = i in section_starts
            
            # If adding this paragraph would exceed the max limit AND we've already met the minimum size
            if current_size + para_words > MACROCHUNK_MAX_SIZE and current_size >= MACROCHUNK_MIN_SIZE and current_chunk:
                macrochunks.append('\n\n'.join(current_chunk))
                current_chunk = [paragraph]
                current_size = para_words
                last_section_start = i if is_section_start else last_section_start
            else:
                # If this is a section start and we're near our minimum size, consider ending the previous chunk
                if is_section_start and current_size >= MACROCHUNK_MIN_SIZE * 0.85 and current_chunk:
                    macrochunks.append('\n\n'.join(current_chunk))
                    current_chunk = [paragraph]
                    current_size = para_words
                    last_section_start = i
                else:
                    current_chunk.append(paragraph)
                    current_size += para_words
                    if is_section_start:
                        last_section_start = i
                    
                    # If we've reached the minimum size and we're at a good breaking point,
                    # consider this a good opportunity to end the macrochunk
                    if current_size >= MACROCHUNK_MIN_SIZE and len(current_chunk) > 1:
                        # Check if we're at a good semantic breaking point
                        last_para = current_chunk[-1]
                        good_ending = (
                            # Ends with sentence-ending punctuation
                            (last_para.endswith('.') or last_para.endswith('?') or last_para.endswith('!')) and
                            # Not in the middle of a paragraph (no trailing hyphen or comma)
                            not (last_para.endswith('-') or last_para.endswith(',')) and
                            # Not in the middle of a list
                            not (last_para.rstrip().endswith(':') or re.search(r'\d+\.\s*$', last_para))
                        )
                        
                        if good_ending:
                            # End the chunk at this good breaking point
                            macrochunks.append('\n\n'.join(current_chunk))
                            current_chunk = []
                            current_size = 0
                
        # Add the last macrochunk if there's anything left
        if current_chunk:
            macrochunks.append('\n\n'.join(current_chunk))
            
        logger.info(f"Created {len(macrochunks)} optimized macrochunks with improved semantic boundaries")
        
        # Log size information for better debugging
        if macrochunks:
            sizes = [len(chunk.split()) for chunk in macrochunks]
            logger.info(f"Macrochunk sizes (words): min={min(sizes)}, max={max(sizes)}, avg={sum(sizes)/len(sizes):.1f}")
            
            # Log each macrochunk size individually for detailed analysis
            for i, size in enumerate(sizes):
                logger.debug(f"Macrochunk {i+1}: {size} words ({size/total_words*100:.1f}% of total)")
            
        return macrochunks
    
    def split_into_subchunks(self, macrochunk: str) -> List[str]:
        """Split a macrochunk into subchunks of ~500 words each"""
        if not macrochunk:
            return []
            
        # Count total words
        words = macrochunk.split()
        total_words = len(words)
        
        if total_words <= SUBCHUNK_SIZE:
            logger.debug(f"Macrochunk has {total_words} words; treating as a single subchunk")
            return [macrochunk]
            
        logger.debug(f"Splitting macrochunk of {total_words} words into subchunks of ~{SUBCHUNK_SIZE} words")
        
        # Split text into paragraphs
        paragraphs = []
        for para_candidate in re.split(r'\n\s*\n', macrochunk):
            if para_candidate.strip():
                paragraphs.append(para_candidate.strip())
        
        # Group paragraphs into subchunks
        subchunks = []
        current_chunk = []
        current_size = 0
        
        for paragraph in paragraphs:
            para_words = len(paragraph.split())
            
            # If adding this paragraph would exceed the limit
            if current_size + para_words > SUBCHUNK_SIZE and current_chunk:
                subchunks.append('\n\n'.join(current_chunk))
                current_chunk = [paragraph]
                current_size = para_words
            else:
                current_chunk.append(paragraph)
                current_size += para_words
                
        # Add the last subchunk if there's anything left
        if current_chunk:
            subchunks.append('\n\n'.join(current_chunk))
            
        logger.debug(f"Created {len(subchunks)} subchunks")
        
        # Log some statistics
        if subchunks:
            sizes = [len(chunk.split()) for chunk in subchunks]
            logger.debug(f"Subchunk sizes (words): min={min(sizes)}, max={max(sizes)}, avg={sum(sizes)/len(sizes):.1f}")
            
        return subchunks
    
    def clean_ai_response(self, response_text: str, custom_instructions: str = '', style_instruction: str = '') -> str:
        """
        Clean AI response by applying dollar sign post-processing while preserving 
        all formatting, mathematical notation, and original structure.
        """
        # Apply dollar sign post-processing to prevent LaTeX conflicts
        cleaned_text = self.postprocess_text(response_text)
        
        # Final emergency cleanup - remove any remaining dollar signs
        if '$' in cleaned_text:
            cleaned_text = cleaned_text.replace('$', '')
            logger.warning("Emergency: Removed dollar signs from AI response")
        
        return cleaned_text
    
    def process_with_openai(
        self, 
        text: str, 
        api_key: str, 
        action: str = 'rewrite',
        style_instruction: str = '',
        custom_instructions: str = '',
        is_first_subchunk: bool = False
    ) -> str:
        """Process text using OpenAI API"""
        import openai
        from openai import OpenAI
        
        client = self.get_client_for_provider('openai', api_key)
        
        # Tell AI not to use dollar signs - simple approach
        if action == "expand":
            prompt = f"""CRITICAL: Do not use the $ symbol in your response.

{custom_instructions}"""
        else:
            prompt = f"""CRITICAL: Do not use the $ symbol in your response.

{custom_instructions}

Text to rewrite:
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
            
    def process_with_anthropic(
        self, 
        text: str, 
        api_key: str, 
        action: str = 'rewrite',
        style_instruction: str = '',
        custom_instructions: str = '',
        is_first_subchunk: bool = False
    ) -> str:
        """Process text using Anthropic API"""
        import anthropic
        from anthropic import Anthropic
        
        client = self.get_client_for_provider('anthropic', api_key)
        
        # Tell AI not to use dollar signs - simple approach
        if action == "expand":
            prompt = f"""CRITICAL: Do not use the $ symbol in your response.

{custom_instructions}"""
        else:
            prompt = f"""CRITICAL: Do not use the $ symbol in your response.

{custom_instructions}

Text to rewrite:
{text}"""

        try:
            #the newest Anthropic model is "claude-sonnet-4-5-20250929" which was released October 22, 2024
            message = client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=2000,
                messages=[{
                    "role": "user",
                    "content": prompt
                }],
                temperature=0.7
            )
            
            response_text = message.content[0].text
            cleaned_response = self.clean_ai_response(response_text, custom_instructions, style_instruction)
            return cleaned_response
            
        except Exception as e:
            logger.error(f"Anthropic API error: {str(e)}")
            raise
            
    def process_with_perplexity(
        self, 
        text: str, 
        api_key: str, 
        action: str = 'rewrite',
        style_instruction: str = '',
        custom_instructions: str = '',
        is_first_subchunk: bool = False
    ) -> str:
        """Process text using Perplexity API"""
        import requests
        import json
        
        # Tell AI not to use dollar signs - simple approach
        if action == "expand":
            system_content = "You are a text expander. CRITICAL: Do not use the $ symbol in your response."
            prompt = f"""{custom_instructions}"""
        else:
            system_content = f"CRITICAL: Do not use the $ symbol in your response. {style_instruction}"
            prompt = f"""{custom_instructions}

Text to rewrite:
{text}"""

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "sonar",
            "messages": [
                {
                    "role": "system",
                    "content": system_content
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7,
            "max_tokens": 2000,
            "stream": False
        }
        
        try:
            response = requests.post(
                "https://api.perplexity.ai/chat/completions",
                headers=headers,
                data=json.dumps(data),
                timeout=API_TIMEOUT
            )
            
            if response.status_code != 200:
                logger.error(f"Perplexity API error: {response.status_code}, {response.text}")
                raise Exception(f"API error: {response.status_code}")
                
            result = response.json()
            response_text = result["choices"][0]["message"]["content"]
            cleaned_response = self.clean_ai_response(response_text, custom_instructions, style_instruction)
            return cleaned_response
            
        except Exception as e:
            logger.error(f"Perplexity API error: {str(e)}")
            raise
    
    def process_with_deepseek(
        self, 
        text: str, 
        api_key: str, 
        action: str = 'rewrite',
        style_instruction: str = '',
        custom_instructions: str = '',
        is_first_subchunk: bool = False
    ) -> str:
        """Process text using DeepSeek API"""
        import requests
        import json
        
        # Tell AI not to use dollar signs - simple approach
        if action == "expand":
            system_content = "You are a text expander. CRITICAL: Do not use the $ symbol in your response."
            prompt = f"""{custom_instructions}"""
        else:
            system_content = f"CRITICAL: Do not use the $ symbol in your response. {style_instruction}"
            prompt = f"""{custom_instructions}

Text to rewrite:
{text}"""

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "deepseek-chat",
            "messages": [
                {
                    "role": "system",
                    "content": system_content
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7,
            "max_tokens": 2000,
            "stream": False
        }
        
        try:
            response = requests.post(
                "https://api.deepseek.com/chat/completions",
                headers=headers,
                data=json.dumps(data),
                timeout=API_TIMEOUT
            )
            
            if response.status_code != 200:
                logger.error(f"DeepSeek API error: {response.status_code}, {response.text}")
                raise Exception(f"API error: {response.status_code}")
                
            result = response.json()
            response_text = result["choices"][0]["message"]["content"]
            cleaned_response = self.clean_ai_response(response_text, custom_instructions, style_instruction)
            return cleaned_response
            
        except Exception as e:
            logger.error(f"DeepSeek API error: {str(e)}")
            raise
    
    def process_with_venice(
        self, 
        text: str, 
        api_key: str, 
        action: str = 'rewrite',
        style_instruction: str = '',
        custom_instructions: str = '',
        is_first_subchunk: bool = False
    ) -> str:
        """Process text using Venice AI API (OpenAI-compatible)"""
        import requests
        import json
        
        # Tell AI not to use dollar signs - simple approach
        if action == "expand":
            system_content = "You are a text expander. CRITICAL: Do not use the $ symbol in your response."
            prompt = f"""{custom_instructions}"""
        else:
            system_content = f"CRITICAL: Do not use the $ symbol in your response. {style_instruction}"
            prompt = f"""{custom_instructions}

Text to rewrite:
{text}"""

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "llama-3.3-70b",
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 2000,
            "stream": False
        }
        
        try:
            response = requests.post(
                "https://api.venice.ai/api/v1/chat/completions",
                headers=headers,
                data=json.dumps(data),
                timeout=API_TIMEOUT
            )
            
            if response.status_code != 200:
                logger.error(f"Venice API error: {response.status_code}, {response.text}")
                raise Exception(f"API error: {response.status_code}")
                
            result = response.json()
            response_text = result["choices"][0]["message"]["content"]
            cleaned_response = self.clean_ai_response(response_text, custom_instructions, style_instruction)
            return cleaned_response
            
        except Exception as e:
            logger.error(f"Venice API error: {str(e)}")
            raise
    
    def process_with_azure(
        self, 
        text: str, 
        api_key: str, 
        action: str = 'rewrite',
        style_instruction: str = '',
        custom_instructions: str = '',
        is_first_subchunk: bool = False
    ) -> str:
        """Process text using Azure OpenAI API"""
        from azure_openai_processor import process_text_azure
        
        # Build the full instruction set for Azure OpenAI
        if action == "expand":
            # This is for the emergency expansion case
            full_instructions = custom_instructions
        else:
            # Normal rewrite case
            if is_first_subchunk:
                full_instructions = f"""Rewrite this text {style_instruction}. Focus on adopting the voice, tone, and word choice typical of that style.

Do not copy formatting or structure mechanically. Do not insert artificial titles or headings.
Avoid formulaic sentence starters or repeating rhetorical patterns.
Maintain EXACTLY the same information, examples, and meaning from the original text.

{custom_instructions}"""
            else:
                full_instructions = f"""Rewrite this text {style_instruction}. Focus on adopting the voice, tone, and word choice typical of that style.

Do not copy formatting or structure mechanically. Do not insert artificial titles or headings.
Avoid formulaic sentence starters or repeating rhetorical patterns.
Maintain EXACTLY the same information, examples, and meaning from the original text.
This is a continuation section, so maintain consistency with previous sections.

{custom_instructions}"""
        
        # Call Azure OpenAI processor
        success, result = process_text_azure(
            text=text,
            custom_instructions=full_instructions,
            author_style=style_instruction,
            maintain_length=True,
            user_style_text=None,
            include_style_in_output=is_first_subchunk
        )
        
        if success:
            return result
        else:
            raise Exception(f"Azure OpenAI processing failed: {result}")
    
    def process_subchunk(
        self, 
        subchunk: str, 
        key_info: Tuple[str, str, str], 
        action: str = 'rewrite',
        style_instruction: str = '',
        custom_instructions: str = '',
        is_first_subchunk: bool = False,
        retry_count: int = 0
    ) -> str:
        """
        Process a single subchunk with the specified API key and provider
        with timeout and retry logic
        """
        key_id, provider, api_key = key_info
        logger.debug(f"Processing subchunk ({len(subchunk.split())} words) with {provider} key {key_id}")
        
        try:
            # Set a timeout context to catch hanging API calls
            if provider == 'openai':
                result = self.process_with_openai(
                    subchunk, api_key, action, style_instruction, custom_instructions, is_first_subchunk
                )
            elif provider == 'anthropic':
                result = self.process_with_anthropic(
                    subchunk, api_key, action, style_instruction, custom_instructions, is_first_subchunk
                )
            elif provider == 'perplexity':
                result = self.process_with_perplexity(
                    subchunk, api_key, action, style_instruction, custom_instructions, is_first_subchunk
                )
            elif provider == 'deepseek':
                result = self.process_with_deepseek(
                    subchunk, api_key, action, style_instruction, custom_instructions, is_first_subchunk
                )
            elif provider == 'venice':
                result = self.process_with_venice(
                    subchunk, api_key, action, style_instruction, custom_instructions, is_first_subchunk
                )
            elif provider == 'azure':
                result = self.process_with_azure(
                    subchunk, api_key, action, style_instruction, custom_instructions, is_first_subchunk
                )
            else:
                raise ValueError(f"Unsupported provider: {provider}")
                
            # Success! Reset the failure counter
            api_key_manager.reset_key_failure(key_id)
            return result
            
        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            
            logger.error(f"Failed to process subchunk with {provider} key {key_id}: {str(e)}")
            logger.error(f"Full traceback: {error_traceback}")
            
            # Mark the key as having an issue
            api_key_manager.mark_key_unavailable(key_id)
            
            # Retry with a different key if available and not exceeded retry count
            if retry_count < MAX_RETRIES:
                logger.info(f"Retrying subchunk with a different key (attempt {retry_count + 1}/{MAX_RETRIES})")
                new_key_info = api_key_manager.get_next_available_key()
                
                if new_key_info:
                    logger.info(f"Attempting with new key: {new_key_info[0]} (provider: {new_key_info[1]})")
                    return self.process_subchunk(
                        subchunk, new_key_info, action, style_instruction, 
                        custom_instructions, is_first_subchunk, retry_count + 1
                    )
                else:
                    logger.error("No more API keys available for retry")
                    
            # All retries failed or no more keys available
            return f"[Warning: Subchunk failed to process after retry. Error: {str(e)}. Skipped. Original text: {subchunk[:100]}...]"
            
    def process_macrochunk(
        self,
        macrochunk_index: int,
        macrochunk: str,
        action: str = 'rewrite',
        style_instruction: str = '',
        custom_instructions: str = '',
        callback: Optional[Callable[[int, int, str], None]] = None,
        total_macrochunks: int = 1,
        content_source: Optional[str] = None,
        length_multiplier: Optional[float] = None,
        provider_preference: Optional[str] = None
    ) -> str:
        """
        Process a macrochunk by splitting it into subchunks and processing each
        with the assigned API key. Returns the combined processed text.
        
        Implements smart macrochunking with persistent rebuild memory and length-matching.
        Includes brutal prompt reinforcement and length checking with emergency expansion.
        """
        # Get word count of original macrochunk
        original_word_count = len(macrochunk.split())
        logger.debug(f"Processing macrochunk {macrochunk_index+1}/{total_macrochunks} ({original_word_count} words)")
        
        # Get key assignment for this macrochunk, respecting provider preference if specified
        if provider_preference and provider_preference in ['openai', 'anthropic', 'perplexity', 'azure', 'deepseek', 'venice']:
            # Handle Azure OpenAI specially since it uses a different processing approach
            if provider_preference == 'azure':
                # Use Azure OpenAI directly
                logger.info(f"Using Azure OpenAI for macrochunk {macrochunk_index+1}")
                key_info = ('azure', 'azure', 'azure_key')
            else:
                # Try to get a key for the preferred provider
                provider_key = api_key_manager.get_key_by_provider(provider_preference)
                if provider_key:
                    key_id, api_key = provider_key
                    provider = provider_preference
                    logger.info(f"Using preferred provider {provider} for macrochunk {macrochunk_index+1}")
                    key_info = (key_id, provider, api_key)
                else:
                    logger.warning(f"Preferred provider {provider_preference} not available, falling back to automatic selection")
                    key_info = api_key_manager.get_key_for_macrochunk(macrochunk_index)
        else:
            # Get key based on default round-robin approach
            key_info = api_key_manager.get_key_for_macrochunk(macrochunk_index)
        
        if not key_info:
            logger.error(f"No API keys available for macrochunk {macrochunk_index}")
            return f"[Error: No API keys available to process macrochunk {macrochunk_index+1}. Skipped.]"
            
        key_id, provider, api_key = key_info
        logger.info(f"Assigned {provider} key {key_id} to macrochunk {macrochunk_index+1}")
        
        # Length handling based on whether maintain_length is true
        length_matching_instruction = ""
        if length_multiplier:
            # User explicitly requested document expansion
            length_matching_instruction = f"Expand the content by approximately {int(length_multiplier * 100)}% while maintaining the original meaning and structure."
            
        # Simple rewrite instruction without bloat
        rebuild_memory_instruction = "Rewrite the text in a clear, professional manner that maintains the meaning, tone, and key points of the original."
        
        if total_macrochunks > 1:
            if macrochunk_index == 0:
                rebuild_memory_instruction += " This is part 1 of the document. Maintain consistent style and tone throughout."
            else:
                rebuild_memory_instruction += f" This is part {macrochunk_index+1} of {total_macrochunks}. The overall goal is document-scale rewriting, not isolated section rewrites. Maintain consistent style and tone with previous sections."
        
        # Handle content source integration
        content_source_instruction = ""
        
        # First check if content_source parameter was provided (takes precedence)
        if content_source and len(content_source.strip()) > 0:
            logger.info(f"Using explicit content source with {len(content_source.split())} words")
            
            # Construct a detailed instruction for using the content source
            content_source_instruction = (
                "\n\nPlease use the following content source to improve your response:\n\n" + 
                "CONTENT SOURCE TEXT:\n" + content_source + 
                "\n\nImportant: Draw from this content source to enhance your response. " +
                "Include relevant information, ideas, examples, or arguments from this content source " +
                "where appropriate to improve the target text."
            )
        # Fallback to check if custom_instructions mentions content source
        elif "content source" in custom_instructions.lower() or "content_source" in custom_instructions.lower() or "source text" in custom_instructions.lower():
            content_source_instruction = (
                " MANDATORY CONTENT SOURCE INTEGRATION: You MUST integrate concepts from the content source. "
                "For EACH major section, incorporate at least 2-3 relevant ideas, concepts, paradoxes, or examples from the content source. "
                "This integration must be substantive and meaningful, not superficial. "
                "The content source concepts should deepen and enrich the intellectual arguments. "
                "Failure to properly integrate the content source is considered task failure."
            )
        
        # Create a clean prompt without bloat
        clean_prompt = rebuild_memory_instruction
        
        # Add length instruction if specified
        if length_matching_instruction:
            clean_prompt += "\n\n" + length_matching_instruction
            
        # Add content source if available
        if content_source_instruction:
            clean_prompt += "\n\n" + content_source_instruction
            
        # Add custom instructions from user
        if custom_instructions:
            clean_prompt += "\n\n" + custom_instructions
        
        # Update progress tracking
        if self.current_process_id:
            self.progress_tracking[self.current_process_id] = {
                "macrochunk": macrochunk_index,
                "total_macrochunks": total_macrochunks,
                "status": "processing"
            }
        
        # Process the macrochunk with clean prompt
        try:
            # Process the macrochunk directly instead of breaking into subchunks
            is_first_macrochunk = (macrochunk_index == 0)
            
            # First attempt at processing the macrochunk
            result = self.process_subchunk(
                macrochunk, key_info, action, style_instruction,
                clean_prompt, is_first_macrochunk
            )
            
            # Log result word count information
            result_word_count = len(result.split())
            original_to_result_ratio = result_word_count / original_word_count
            logger.info(f"Macrochunk {macrochunk_index+1} - Original: {original_word_count} words, Processed: {result_word_count} words, Ratio: {original_to_result_ratio:.2f}")
            
            # Only enforce length requirements if explicitly specified via length_multiplier
            if length_multiplier and length_multiplier > 1.0:
                logger.info(f"Length multiplier: {length_multiplier}x specified")
                
                # Check if we met the target expansion
                target_word_count = int(original_word_count * length_multiplier)
                if result_word_count < (target_word_count * 0.9):  # Allow 10% tolerance
                    logger.info(f"Output length {result_word_count} words is less than target {target_word_count} words. Adding specific instructions.")
                    
                    # Add a gentle reminder about length
                    expansion_instructions = f"Please expand this text to reach approximately {target_word_count} words while maintaining quality."
                    enhanced_prompt = clean_prompt + "\n\n" + expansion_instructions
                    
                    # Try once more with the enhanced instructions
                    result = self.process_subchunk(
                        macrochunk, key_info, action, style_instruction,
                        enhanced_prompt, is_first_macrochunk
                    )
            
            # No more automatic expansion - just return the result
            api_key_manager.reset_key_failure(key_id)
            
            # Call the callback if provided
            if callback:
                callback(macrochunk_index, 0, result)
                
            return result
                
        except Exception as e:
            logger.error(f"Error processing macrochunk {macrochunk_index+1}: {str(e)}")
            error_msg = f"[Warning: Macrochunk {macrochunk_index+1} failed to process. Skipped.]"
            
            # Call the callback with the error if provided
            if callback:
                callback(macrochunk_index, 0, error_msg)
            
            return error_msg
    
    def preprocess_text(self, text: str) -> str:
        """
        SIMPLE APPROACH: Remove ALL dollar signs from text. Period.
        """
        if not text:
            return text
            
        # SIMPLE: Just remove all dollar signs
        processed_text = text.replace('$', '')
        
        logger.debug("REMOVED ALL DOLLAR SIGNS from input text")
        return processed_text

    def postprocess_text(self, text: str) -> str:
        """
        SIMPLE APPROACH: Remove ALL dollar signs from AI output. Period.
        """
        if not text:
            return text
            

        
        # SIMPLE: Just remove all dollar signs
        processed_text = text.replace('$', '')
        
        logger.debug("REMOVED ALL DOLLAR SIGNS from AI output")
        return processed_text

    def process_text(
        self,
        text: str,
        action: str = 'rewrite',
        sophistication: Optional[str] = None,
        custom_instructions: str = '',
        include_style_in_output: bool = True,
        user_style_text: Optional[str] = None,
        callback: Optional[Callable[[int, int, str], None]] = None,
        content_source: Optional[str] = None,
        length_multiplier: Optional[float] = None,
        provider_preference: Optional[str] = None,
        maintain_length: bool = True
    ) -> str:
        """
        Process text using the two-tiered chunking approach with multiple API providers.
        
        Args:
            text: The input text to process
            action: The processing action (rewrite, summarize, etc.)
            sophistication: Target sophistication level
            custom_instructions: Additional instructions for processing
            include_style_in_output: Whether to include style instructions in output
            user_style_text: Optional text sample for matching user's writing style
            callback: Optional callback function called after each subchunk is processed
            content_source: Optional content source text for enhancing the output
            length_multiplier: Optional multiplier for target output length
            provider_preference: Optional preference for specific AI provider ('openai', 'anthropic', 'perplexity', 'azure')
            
        Returns:
            The processed text
        """
        # CRITICAL: Strip all dollar signs from input before processing
        if text:
            text = text.replace('$', ' ')
            text = ' '.join(text.split())  # Clean up extra spaces
            logger.debug("Stripped all dollar signs from input text")
        
        if content_source:
            content_source = content_source.replace('$', ' ')
            content_source = ' '.join(content_source.split())  # Clean up extra spaces
            logger.debug("Stripped all dollar signs from content source")
        
        # Preprocess text to handle special characters
        text = self.preprocess_text(text)
        
        logger.debug(f"Processing text of length {len(text)} characters")
        
        # Check if we have any API keys available
        if not api_key_manager.get_available_providers():
            return "AI processing is disabled. Please configure at least one API key to enable this feature."
            
        # Create a unique process ID for tracking
        self.current_process_id = f"process_{int(time.time())}"
        self.progress_tracking[self.current_process_id] = {
            "status": "starting",
            "macrochunk": 0,
            "total_macrochunks": 0,
            "subchunk": 0,
            "total_subchunks": 0
        }
        
        # Build the style instruction
        style_instruction = ''
        if user_style_text:
            logger.debug(f"Using user's writing style (length: {len(user_style_text)} characters)")
            style_instruction = "matching the style of the provided writing sample"
        else:
            # Default style when none is specified
            style_instruction = 'in a way that is professional but that even an intelligent 10th grader could understand'
            
        # Split into macrochunks if text is long
        total_words = len(text.split())
        if total_words > MACROCHUNK_SIZE:
            logger.info(f"Text has {total_words} words, using two-level chunking")
            macrochunks = self.split_into_macrochunks(text)
        else:
            logger.info(f"Text has {total_words} words, using single-level chunking")
            macrochunks = [text]
            
        # Update progress tracking
        self.progress_tracking[self.current_process_id]["total_macrochunks"] = len(macrochunks)
        
        # Process each macrochunk and collect results
        processed_text = ""
        
        for i, macrochunk in enumerate(macrochunks):
            try:
                # Update progress tracking
                self.progress_tracking[self.current_process_id]["macrochunk"] = i + 1
                self.progress_tracking[self.current_process_id]["status"] = "processing"
                
                # Process the macrochunk with total macrochunks information and pass content_source and length_multiplier
                # Only set length_multiplier if maintain_length is true, otherwise use None to avoid length expansion
                actual_length_multiplier = length_multiplier if maintain_length else None
                
                result = self.process_macrochunk(
                    i, macrochunk, action, style_instruction, custom_instructions, callback,
                    total_macrochunks=len(macrochunks),
                    content_source=content_source,
                    length_multiplier=actual_length_multiplier,
                    provider_preference=provider_preference
                )
                
                # Append to the processed text
                if processed_text and result:
                    processed_text += "\n\n" + result
                else:
                    processed_text = result
                    
            except Exception as e:
                logger.error(f"Error processing macrochunk {i}: {str(e)}")
                error_msg = f"[Warning: Macrochunk {i+1} failed to process. Skipped.]"
                if processed_text:
                    processed_text += "\n\n" + error_msg
                else:
                    processed_text = error_msg
        
        # Update progress tracking
        self.progress_tracking[self.current_process_id]["status"] = "completed"
        
        # Clear the current process ID
        self.current_process_id = None
        
        # Remove all markdown formatting from the final output
        import re
        # Remove markdown headers (###, ##, #)
        processed_text = re.sub(r'^#{1,6}\s+', '', processed_text, flags=re.MULTILINE)
        # Remove bold formatting (**)
        processed_text = re.sub(r'\*\*(.*?)\*\*', r'\1', processed_text)
        # Remove italic formatting (*)
        processed_text = re.sub(r'\*(.*?)\*', r'\1', processed_text)
        # Remove bullet points (- or *)
        processed_text = re.sub(r'^[\*\-]\s+', '- ', processed_text, flags=re.MULTILINE)
        # Clean up extra whitespace
        processed_text = re.sub(r'\n{3,}', '\n\n', processed_text)
        
        # Apply post-processing to remove dollar signs from AI output
        processed_text = self.postprocess_text(processed_text)
        
        return processed_text
        
    def _check_formality_preserved(self, original_text: str, rewritten_text: str) -> bool:
        """
        Check if the formality, density, and technical tone are preserved in the rewritten text.
        
        This is a sophisticated check using multiple heuristics to identify "breezification" or 
        casualization of the text which would violate the No Watering Down requirements.
        
        Args:
            original_text: The original formal text
            rewritten_text: The rewritten text to check
            
        Returns:
            bool: True if formality is preserved, False if text has been casualized
        """
        # Get samples of text for analysis (to avoid memory issues with very large texts)
        # For actual implementation, we'd use more advanced NLP techniques
        original_sample = original_text[:10000] if len(original_text) > 10000 else original_text
        rewritten_sample = rewritten_text[:10000] if len(rewritten_text) > 10000 else rewritten_text
        
        # 1. Check sentence length - formal academic text often has longer sentences
        original_sentences = [s.strip() for s in re.split(r'[.!?]', original_sample) if s.strip()]
        rewritten_sentences = [s.strip() for s in re.split(r'[.!?]', rewritten_sample) if s.strip()]
        
        avg_original_sent_len = sum(len(s.split()) for s in original_sentences) / max(1, len(original_sentences))
        avg_rewritten_sent_len = sum(len(s.split()) for s in rewritten_sentences) / max(1, len(rewritten_sentences))
        
        # If average sentence length decreased by more than 20%, likely breach of formality
        sentence_length_preserved = (avg_rewritten_sent_len >= avg_original_sent_len * 0.8)
        
        # 2. Check for casual language markers - these would indicate inappropriate tone change
        casual_markers = [
            r'\bbasically\b', r'\bjust\b', r'\banyway\b', r'\bstuff\b', r'\bthings\b', 
            r'\bguy\b', r'\bkind of\b', r'\bsort of\b', r'\ba lot\b', r'\blike\b', 
            r'\byou know\b', r'\bI think\b', r'\bI feel\b'
        ]
        
        # Count casual markers in both texts
        original_casual_count = sum(len(re.findall(marker, original_sample.lower())) for marker in casual_markers)
        rewritten_casual_count = sum(len(re.findall(marker, rewritten_sample.lower())) for marker in casual_markers)
        
        # If casual markers increased significantly, likely breach of formality
        formality_tone_preserved = (rewritten_casual_count <= original_casual_count + 5)
        
        # 3. Check for technical vocabulary preservation
        # Extract "uncommon" words that likely represent technical vocabulary
        # This is a simplified approach - in a real system we'd use domain-specific dictionaries
        words_original = re.findall(r'\b[a-zA-Z]{7,}\b', original_sample.lower())
        words_rewritten = re.findall(r'\b[a-zA-Z]{7,}\b', rewritten_sample.lower())
        
        # Check what percentage of original technical terms are preserved
        # At least 80% should be maintained for technical vocabulary preservation
        technical_vocab_preserved = True
        if words_original:
            preserved_ratio = len(set(words_rewritten).intersection(set(words_original))) / len(set(words_original))
            technical_vocab_preserved = (preserved_ratio >= 0.7)  # At least 70% preservation required
        
        # Combine the checks - all must pass for formality to be considered preserved
        formality_preserved = sentence_length_preserved and formality_tone_preserved and technical_vocab_preserved
        
        # Log the results for debugging
        logger.debug(f"Formality check - Sentence length preserved: {sentence_length_preserved}, " +
                    f"Tone preserved: {formality_tone_preserved}, " +
                    f"Technical vocab preserved: {technical_vocab_preserved}")
        
        return formality_preserved
    
    def get_processing_status(self, process_id: str) -> Dict:
        """Get the current status of a processing job"""
        if process_id in self.progress_tracking:
            return self.progress_tracking[process_id]
        return {"status": "not_found"}

# Create a singleton instance
multi_provider_processor = MultiProviderProcessor()