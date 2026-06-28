"""
Replica Text-to-Speech Integration

This module handles text-to-speech conversion using Replica's API.
It supports voice selection, language detection, and chunking for long texts.
"""

import os
import requests
import json
import time
import logging
import uuid
from typing import Dict, List, Tuple, Optional, Any, Union
from langdetect import detect as detect_language_code

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
API_BASE_URL = "https://api.replicastudios.com"
MAX_CHAR_PER_CHUNK = 3000  # Replica can handle longer texts than other services

# Voice IDs by language from Replica documentation (using Freya as example)
VOICE_MAPPING = {
    "en": {  # English
        "female": ["9b1f5c26-a18b-4b9e-a785-b3a3b3b875a", "8fe51dbf-4cce-403b-b3a7-69ed8092948f"],  # Freya, Madison
        "male": ["f1c4708d-9c3e-4b3a-9c9f-5e5c8a1e9e8d", "3b57f18d-6a91-c34e-1d67-a25f9b45e712"]     # Daniel, Jason
    },
    "es": {  # Spanish
        "female": ["2f7b35d8-a17c-24e4-e67b-35d8a17c24e4", "f24d5518-ae63-dc78-5a8b-07e9ae63dc78"],
        "male": ["ae63dc78-5a8b-07e9-ae63-dc78-5a8b-07e9", "5a8b07e9-ae63-dc78-5a8b-07e9ae63dc78"]
    },
    "fr": {  # French
        "female": ["7d27f3c8-4932-dd7b-2a14-263d5b4e2315", "4932dd7b-2a14-263d-5b4e-23152a14263d"],
        "male": ["2a14263d-5b4e-2315-2a14-263d5b4e2315", "5b4e2315-2a14-263d-5b4e-23152a14263d"]
    },
    "de": {  # German
        "female": ["6f1d5911-7f76-bd18-3a4e-9a471c94e916", "7f76bd18-3a4e-9a47-1c94-e9163a4e9a47"],
        "male": ["3a4e9a47-1c94-e916-3a4e-9a471c94e916", "1c94e916-3a4e-9a47-1c94-e9163a4e9a47"]
    },
    "it": {  # Italian
        "female": ["8f67d3c2-4a81-c63b-2e5a-7d147c94e163", "4a81c63b-2e5a-7d14-7c94-e1632e5a7d14"],
        "male": ["2e5a7d14-7c94-e163-2e5a-7d147c94e163", "7c94e163-2e5a-7d14-7c94-e1632e5a7d14"]
    },
    "ja": {  # Japanese
        "female": ["5d14f28a-7c91-e36f-2e67-b35d8a17c24e", "7c91e36f-2e67-b35d-8a17-c24e2e67b35d"],
        "male": ["2e67b35d-8a17-c24e-2e67-b35d8a17c24e", "8a17c24e-2e67-b35d-8a17-c24e2e67b35d"]
    }
}

# Default voice to use if language not supported (Freya from documentation)
DEFAULT_VOICE_ID = "9b1f5c26-a18b-4b9e-a785-b3a3b3b875a"

# Language name mapping
LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ja": "Japanese",
    "zh": "Chinese (Mandarin)",
    "ko": "Korean",
    "ru": "Russian",
    "ar": "Arabic",
    "hi": "Hindi",
    "nl": "Dutch",
    "pl": "Polish",
    "tr": "Turkish",
    "sv": "Swedish",
    "da": "Danish",
    "fi": "Finnish",
    "no": "Norwegian",
    "cs": "Czech",
    "hu": "Hungarian",
    "ro": "Romanian",
    "th": "Thai",
    "vi": "Vietnamese",
    "uk": "Ukrainian",
    "el": "Greek",
    "he": "Hebrew",
    "id": "Indonesian"
}

def get_api_key() -> str:
    """Get Replica API key from environment"""
    api_key = os.environ.get("REPLICA_API_KEY")
    if not api_key:
        raise ValueError("REPLICA_API_KEY environment variable not set")
    return api_key

def detect_language(text: str) -> str:
    """
    Detect the language of input text
    
    Args:
        text: Text to analyze
        
    Returns:
        ISO 639-1 language code (e.g., 'en', 'es', 'fr')
    """
    try:
        # Detect language code
        lang_code = detect_language_code(text)
        logger.info(f"Detected language: {lang_code}")
        return lang_code
    except Exception as e:
        logger.warning(f"Language detection failed: {str(e)}")
        return "en"  # Default to English

def get_voices() -> Dict[str, Dict[str, Any]]:
    """
    Get available voices from Replica API
    
    Returns:
        Dictionary of voices with their details
    """
    try:
        api_key = get_api_key()
        headers = {
            "Authorization": f"Bearer {api_key}"
        }
        
        # Using the /library/voices endpoint as shown in the docs
        response = requests.get(
            f"{API_BASE_URL}/library/voices",
            headers=headers
        )
        
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error getting voices: {str(e)}")
        return {}

def get_best_voice_for_language(language_code: str, gender: str = "female") -> str:
    """
    Get the best voice ID for a language and gender
    
    Args:
        language_code: ISO 639-1 language code
        gender: 'male' or 'female'
        
    Returns:
        Voice ID string
    """
    # Check if we have voices for this language
    if language_code in VOICE_MAPPING and gender in VOICE_MAPPING[language_code]:
        # Return the first voice in the list for this language and gender
        return VOICE_MAPPING[language_code][gender][0]
    
    # If language not supported, use default English voice
    logger.warning(f"No voice found for language {language_code} and gender {gender}, using default")
    return DEFAULT_VOICE_ID

def chunk_text(text: str, max_chars: int = MAX_CHAR_PER_CHUNK) -> List[str]:
    """
    Split text into manageable chunks at sentence boundaries
    
    Args:
        text: Text to chunk
        max_chars: Maximum characters per chunk
        
    Returns:
        List of text chunks
    """
    # If text is shorter than max_chars, return it as is
    if len(text) <= max_chars:
        return [text]
    
    chunks = []
    current_chunk = ""
    
    # Split by sentences (simple implementation)
    sentences = []
    for paragraph in text.split('\n'):
        for sentence in paragraph.split('. '):
            if sentence:
                sentences.append(sentence.strip() + '.')
    
    for sentence in sentences:
        # If adding this sentence would exceed the limit
        if len(current_chunk) + len(sentence) > max_chars and current_chunk:
            chunks.append(current_chunk.strip())
            current_chunk = sentence
        else:
            current_chunk += ' ' + sentence
    
    # Add the last chunk if it's not empty
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    logger.info(f"Split text into {len(chunks)} chunks")
    return chunks

def synthesize_speech(
    text: str,
    voice_id: str,
    output_path: str,
    retry_count: int = 0,
    max_retries: int = 3
) -> Tuple[bool, str]:
    """
    Synthesize speech from text using Replica API with Legacy API
    
    Args:
        text: Text to synthesize
        voice_id: Replica voice ID
        output_path: Path to save the audio file
        retry_count: Current retry count
        max_retries: Maximum number of retries
        
    Returns:
        Tuple of (success, result_message_or_error)
    """
    try:
        # Get API key
        api_key = get_api_key()
        
        # Set up request headers 
        headers = {
            "Authorization": f"Bearer {api_key}"
        }
        
        # Using the correct /speech/tts endpoint from the docs
        logger.info(f"Requesting speech synthesis for {len(text)} characters of text")
        response = requests.post(
            f"{API_BASE_URL}/speech/tts",
            headers=headers,
            json={
                "text": text,
                "speaker_id": voice_id,
                "output_format": "mp3"
            }
        )
        
        # Check for errors
        if response.status_code != 200:
            logger.error(f"Speech synthesis error: {response.status_code} - {response.text}")
            error_message = f"Error from Replica API: {response.status_code}"
            
            # Handle rate limiting with exponential backoff
            if response.status_code == 429 and retry_count < max_retries:
                wait_time = (2 ** retry_count) * 5
                logger.warning(f"Rate limited, retrying in {wait_time}s...")
                time.sleep(wait_time)
                return synthesize_speech(text, voice_id, output_path, retry_count + 1, max_retries)
                
            return False, error_message
        
        # Check if we got audio directly
        if response.headers.get('Content-Type', '').startswith('audio/'):
            # Save the direct audio content
            with open(output_path, 'wb') as f:
                f.write(response.content)
            
            logger.info(f"Audio saved directly to {output_path}")
            return True, output_path
        
        # If not direct audio, handle JSON response
        audio_url = None
        
        try:
            # Try to parse JSON
            synthesis_data = response.json()
            
            # Check for URL in different formats
            if 'url' in synthesis_data:
                audio_url = synthesis_data['url']
            elif 'audio_url' in synthesis_data:
                audio_url = synthesis_data['audio_url']
            else:
                logger.error(f"No audio URL in response: {synthesis_data}")
                return False, "No audio URL in Replica API response"
                
        except Exception as e:
            logger.error(f"Failed to parse API response: {str(e)}")
            return False, f"Error parsing API response: {str(e)}"
        
        # Download the audio file using the URL
        if audio_url:
            try:
                audio_response = requests.get(audio_url)
                
                if audio_response.status_code != 200:
                    logger.error(f"Error downloading audio: {audio_response.status_code}")
                    return False, f"Error downloading audio: {audio_response.status_code}"
                
                # Save the audio file
                with open(output_path, 'wb') as f:
                    f.write(audio_response.content)
                
                logger.info(f"Audio saved to {output_path}")
                return True, output_path
                
            except Exception as e:
                logger.error(f"Error downloading audio from URL: {str(e)}")
                return False, f"Error downloading audio: {str(e)}"
        
        return False, "Failed to process audio response"
        
    except Exception as e:
        logger.error(f"Error in synthesize_speech: {str(e)}")
        
        # Retry on general errors
        if retry_count < max_retries:
            wait_time = (2 ** retry_count) * 2
            logger.warning(f"Error occurred, retrying in {wait_time}s...")
            time.sleep(wait_time)
            return synthesize_speech(text, voice_id, output_path, retry_count + 1, max_retries)
        
        return False, f"Error creating audio: {str(e)}"

def create_audiobook(
    text: str,
    output_file: str,
    preferred_gender: str = "female",
    force_language: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Create an audiobook from text
    
    Args:
        text: Text to convert to audio
        output_file: Path to save the audio file
        preferred_gender: 'male' or 'female' voice preference
        force_language: Force a specific language (if None, auto-detect)
        
    Returns:
        Tuple of (success, result_message_or_path)
    """
    try:
        # Auto-detect language if not specified
        language_code = force_language if force_language else detect_language(text)
        
        # Get appropriate voice
        voice_id = get_best_voice_for_language(language_code, preferred_gender)
        
        # For longer texts, we need to chunk and process separately
        if len(text) > MAX_CHAR_PER_CHUNK:
            logger.info(f"Long text detected ({len(text)} chars), chunking...")
            chunks = chunk_text(text)
            
            # Process each chunk and create temp files
            temp_files = []
            for i, chunk in enumerate(chunks):
                temp_output = f"{output_file}.part{i}.mp3"
                success, result = synthesize_speech(chunk, voice_id, temp_output)
                
                if not success:
                    logger.error(f"Error processing chunk {i}: {result}")
                    # Clean up temp files
                    for temp_file in temp_files:
                        if os.path.exists(temp_file):
                            os.remove(temp_file)
                    return False, f"Error processing chunk {i}: {result}"
                
                temp_files.append(temp_output)
            
            # Combine audio files
            if temp_files:
                with open(output_file, 'wb') as outfile:
                    for temp_file in temp_files:
                        with open(temp_file, 'rb') as infile:
                            outfile.write(infile.read())
                
                # Clean up temp files
                for temp_file in temp_files:
                    os.remove(temp_file)
                
                return True, output_file
            else:
                # No temp files were created (empty chunks case)
                return False, "No audio was generated - text may be empty or invalid"
        else:
            # Process single chunk
            return synthesize_speech(text, voice_id, output_file)
    
    except Exception as e:
        logger.error(f"Error in create_audiobook: {str(e)}")
        return False, f"Error creating audiobook: {str(e)}"

def get_language_voices() -> Dict[str, List[Dict[str, Any]]]:
    """
    Get voices organized by language for UI
    
    Returns:
        Dictionary mapping language codes to lists of voice options
    """
    language_voices = {}
    
    # Start with our pre-defined mapping
    for lang_code, voices in VOICE_MAPPING.items():
        if lang_code not in language_voices:
            language_voices[lang_code] = []
        
        # Add female voices
        for voice_id in voices.get('female', []):
            language_voices[lang_code].append({
                'id': voice_id,
                'name': f"Female Voice {voice_id[:4]}",
                'gender': 'female'
            })
        
        # Add male voices
        for voice_id in voices.get('male', []):
            language_voices[lang_code].append({
                'id': voice_id,
                'name': f"Male Voice {voice_id[:4]}",
                'gender': 'male'
            })
    
    # Try to get full voice list from API if possible
    try:
        voices_data = get_voices()
        
        # If we got voice data from the API, use it to enrich our mapping
        if voices_data and isinstance(voices_data, dict) and 'voices' in voices_data:
            for voice in voices_data['voices']:
                if not isinstance(voice, dict):
                    continue
                    
                voice_id = voice.get('voice_id', str(uuid.uuid4())[:8])
                voice_name = voice.get('name', f"Voice {voice_id[:4]}")
                voice_gender = voice.get('gender', 'neutral')
                voice_lang = voice.get('language', 'en')
                
                # Add to our mapping
                if voice_lang not in language_voices:
                    language_voices[voice_lang] = []
                
                language_voices[voice_lang].append({
                    'id': voice_id,
                    'name': voice_name,
                    'gender': voice_gender
                })
    except Exception as e:
        logger.warning(f"Could not fetch voice list from API: {str(e)}")
    
    return language_voices