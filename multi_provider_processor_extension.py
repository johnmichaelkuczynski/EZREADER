"""
Extension for the MultiProviderProcessor class to add direct chat functionality.
This module patches the MultiProviderProcessor class with methods to handle
direct chat interactions with AI providers for translation and other features.
"""

import os
import sys
import time
import logging
import requests
import json
from typing import Dict, List, Optional, Any

# Initialize logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def patch_multi_provider_processor():
    """
    Patch the MultiProviderProcessor class with chat functionality
    """
    from multi_provider_processor import MultiProviderProcessor
    from api_key_manager import api_key_manager
    
    # Add chat processing methods to MultiProviderProcessor
    def process_chat(self, system_message, user_message, provider_preference=None):
        """
        Process a simple chat message with the selected AI provider
        
        Args:
            system_message: System message to set context
            user_message: User query/request
            provider_preference: Optional specific provider to use
            
        Returns:
            Response text from the AI
        """
        if provider_preference and provider_preference not in ['openai', 'anthropic', 'perplexity']:
            provider_preference = None
            
        # Track attempts for each provider to avoid infinite loops
        attempts = {
            'openai': 0,
            'anthropic': 0,
            'perplexity': 0
        }
        max_provider_attempts = 2
        
        # First try the preferred provider if specified
        if provider_preference:
            try:
                return self._process_chat_with_provider(system_message, user_message, provider_preference)
            except Exception as e:
                logger.warning(f"Failed to process chat with preferred provider {provider_preference}: {str(e)}")
                attempts[provider_preference] += 1
        
        # Try each available provider in order of preference
        providers_to_try = []
        
        # Order based on what's available
        if self.has_openai:
            providers_to_try.append('openai')
        if self.has_anthropic:
            providers_to_try.append('anthropic')
        if self.has_perplexity:
            providers_to_try.append('perplexity')
            
        # If all have failed once, try one more time with each
        for _ in range(2):  # Max 2 complete cycles through providers
            for provider in providers_to_try:
                if attempts[provider] < max_provider_attempts:
                    try:
                        return self._process_chat_with_provider(system_message, user_message, provider)
                    except Exception as e:
                        logger.warning(f"Failed to process chat with provider {provider}: {str(e)}")
                        attempts[provider] += 1
        
        # If we get here, all providers have failed
        raise Exception("All AI providers failed to process the chat request. Please try again later.")
    
    def _process_chat_with_provider(self, system_message, user_message, provider):
        """Process a chat message with the specified provider"""
        try:
            if provider == 'openai':
                return self._process_chat_openai(system_message, user_message)
            elif provider == 'anthropic':
                return self._process_chat_anthropic(system_message, user_message)
            elif provider == 'perplexity':
                return self._process_chat_perplexity(system_message, user_message)
            else:
                raise ValueError(f"Unsupported provider: {provider}")
        except Exception as e:
            logger.error(f"Error in _process_chat_with_provider for {provider}: {str(e)}")
            raise
    
    def _process_chat_openai(self, system_message, user_message):
        """Process chat with OpenAI"""
        import openai
        from api_key_manager import api_key_manager
        
        # Get an OpenAI API key
        key_info = api_key_manager.get_key_by_provider('openai')
        if not key_info:
            raise ValueError("No OpenAI API key available")
            
        key_id, provider, api_key = key_info
        
        try:
            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model="gpt-4o",  # Use the newest model
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.3,
                max_tokens=4000
            )
            
            # Mark this key as successful
            api_key_manager.reset_key_failure(key_id)
            
            return response.choices[0].message.content
        except Exception as e:
            # Mark this key as having a failure
            api_key_manager.mark_key_unavailable(key_id)
            logger.error(f"OpenAI chat error: {str(e)}")
            raise
    
    def _process_chat_anthropic(self, system_message, user_message):
        """Process chat with Anthropic"""
        import anthropic
        from anthropic import Anthropic
        from api_key_manager import api_key_manager
        
        # Get an Anthropic API key
        key_info = api_key_manager.get_key_by_provider('anthropic')
        if not key_info:
            raise ValueError("No Anthropic API key available")
            
        key_id, provider, api_key = key_info
        
        try:
            client = Anthropic(api_key=api_key)
            # The newest Anthropic model is "claude-sonnet-4-5-20250929" which was released October 22, 2024
            response = client.messages.create(
                model="claude-sonnet-4-5-20250929",
                system=system_message,
                messages=[
                    {"role": "user", "content": user_message}
                ],
                temperature=0.3,
                max_tokens=4000
            )
            
            # Mark this key as successful
            api_key_manager.reset_key_failure(key_id)
            
            return response.content[0].text
        except Exception as e:
            # Mark this key as having a failure
            api_key_manager.mark_key_unavailable(key_id)
            logger.error(f"Anthropic chat error: {str(e)}")
            raise
    
    def _process_chat_perplexity(self, system_message, user_message):
        """Process chat with Perplexity"""
        import requests
        import json
        from api_key_manager import api_key_manager
        
        # Get a Perplexity API key
        key_info = api_key_manager.get_key_by_provider('perplexity')
        if not key_info:
            raise ValueError("No Perplexity API key available")
            
        key_id, provider, api_key = key_info
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "sonar",
            "messages": [
                {
                    "role": "system",
                    "content": system_message
                },
                {
                    "role": "user",
                    "content": user_message
                }
            ],
            "temperature": 0.2,
            "top_p": 0.9,
            "max_tokens": 4000
        }
        
        try:
            response = requests.post(
                "https://api.perplexity.ai/chat/completions",
                headers=headers,
                json=data
            )
            
            if response.status_code != 200:
                logger.error(f"Perplexity API error: {response.status_code} - {response.text}")
                api_key_manager.mark_key_unavailable(key_id)
                raise Exception(f"Perplexity API returned status code {response.status_code}")
                
            # Mark this key as successful
            api_key_manager.reset_key_failure(key_id)
            
            result = response.json()
            return result['choices'][0]['message']['content']
        except Exception as e:
            # Mark this key as having a failure
            api_key_manager.mark_key_unavailable(key_id)
            logger.error(f"Perplexity chat error: {str(e)}")
            raise
    
    # Add methods to the MultiProviderProcessor class
    MultiProviderProcessor.process_chat = process_chat
    MultiProviderProcessor._process_chat_with_provider = _process_chat_with_provider
    MultiProviderProcessor._process_chat_openai = _process_chat_openai
    MultiProviderProcessor._process_chat_anthropic = _process_chat_anthropic
    MultiProviderProcessor._process_chat_perplexity = _process_chat_perplexity
    
    logger.info("MultiProviderProcessor patched with chat functionality")
    
    return True