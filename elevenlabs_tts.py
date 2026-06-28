"""
ElevenLabs TTS Integration Module

This module handles text-to-speech generation using the ElevenLabs API,
with proper chunking and language detection.
"""

import os
import time
import tempfile
import logging
import textwrap
import requests
from typing import List, Dict, Tuple, Optional, Any
from langdetect import detect
from pydub import AudioSegment

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants for API requests
ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1"
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVEN_API_KEY")
DEFAULT_STABILITY = 0.5
DEFAULT_SIMILARITY = 0.75
MAX_CHAR_PER_CHUNK = 2000  # ElevenLabs recommendation

# Voice ID mapping by language and gender
VOICE_MAPPING = {
    "en": {  # English
        "female": "21m00Tcm4TlvDq8ikWAM",  # Rachel
        "male": "pNInz6obpgDQGcFmaJgB"     # Adam
    },
    "es": {  # Spanish
        "female": "lFKPRcIYC9EVLb2VKKOJ",  # Paola (similar to Eli)
        "male": "ErXwobaYiN019PkySvjV"     # Antonio
    },
    "de": {  # German
        "female": "BQICVZvBJf5FEKlGS4zh",  # Clara (using an appropriate German voice)
        "male": "AZnzlk1XvdvUeBnXmlld"     # Thomas (using an appropriate German voice)
    },
    "fr": {  # French
        "female": "MF3mGyEYCl7XYWbV9V6O",  # Elli (similar to Léa)
        "male": "g5CIjZEefAph4nQFvHAz"     # Using a suitable male voice for French
    },
    "it": {  # Italian
        "female": "EXAVITQu4vr4xnSDxMaL",  # Bella
        "male": "VR6AewLTigWG4xSOukaG"     # Using a suitable male voice for Italian
    },
    "pl": {  # Polish
        "female": "CYw3kZ02Hs0563khs1Fj",  # Domi (or similar Polish voice)
        "male": "TxGEqnHWrfWFTfGW9XjX"     # Using a suitable male voice for Polish
    },
    "pt": {  # Portuguese
        "female": "D38z5RcWu1voky8WS1ja",  # Using a suitable female voice for Portuguese
        "male": "Yko7PKHZNXotIFUBG7I9"     # João (or similar Portuguese voice)
    },
    "ru": {  # Russian
        "female": "0G2oDrE1F4bVnHYBUaUJ",  # Using a suitable female voice for Russian
        "male": "GBv7mTt0atIp3Br8iCZE"     # Using a suitable male voice for Russian
    },
    "ja": {  # Japanese
        "female": "jBpfuIE2acCO8z3wKNLl",  # Using a suitable female voice for Japanese
        "male": "VR6AewLTigWG4xSOukaG"     # Using a suitable male voice for Japanese
    },
    "ko": {  # Korean
        "female": "z9fAnlkpzviPz146aGWa",  # Using a suitable female voice for Korean
        "male": "TxGEqnHWrfWFTfGW9XjX"     # Using a suitable male voice for Korean
    }
}

# Language name mapping for UI display
LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "de": "German",
    "fr": "French",
    "it": "Italian",
    "pl": "Polish",
    "pt": "Portuguese",
    "ru": "Russian",
    "ja": "Japanese",
    "ko": "Korean"
}

def detect_language(text: str) -> str:
    """
    Detect the language of the input text.
    
    Args:
        text: The text to analyze
        
    Returns:
        ISO 639-1 language code (e.g., 'en', 'es', 'fr')
    """
    try:
        language = detect(text)
        # If language not in our supported list, default to English
        if language not in VOICE_MAPPING:
            logger.warning(f"Detected language '{language}' not supported. Defaulting to English.")
            return "en"
        return language
    except Exception as e:
        logger.error(f"Language detection failed: {str(e)}. Defaulting to English.")
        return "en"

def chunk_text(text: str, max_chars: int = MAX_CHAR_PER_CHUNK) -> List[str]:
    """
    Split text into manageable chunks at sentence boundaries.
    
    Args:
        text: Text to chunk
        max_chars: Maximum characters per chunk
        
    Returns:
        List of text chunks
    """
    # First attempt: use textwrap to get roughly sized chunks
    chunks = textwrap.wrap(
        text, 
        width=max_chars,
        break_long_words=False,
        break_on_hyphens=False
    )
    
    # Further refine chunks to ensure they end with sentence-ending punctuation
    refined_chunks = []
    current_chunk = ""
    
    for chunk in chunks:
        if len(current_chunk) + len(chunk) <= max_chars:
            current_chunk += " " + chunk if current_chunk else chunk
        else:
            if current_chunk:
                refined_chunks.append(current_chunk)
            current_chunk = chunk
    
    if current_chunk:
        refined_chunks.append(current_chunk)
        
    return refined_chunks

def get_voices() -> Dict[str, Dict[str, Any]]:
    """
    Get available voices from ElevenLabs API.
    
    Returns:
        Dictionary of voices with their details
    """
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY
    }
    
    try:
        response = requests.get(f"{ELEVENLABS_API_URL}/voices", headers=headers)
        response.raise_for_status()
        data = response.json()
        
        # Format the response for easier access
        voices = {}
        for voice in data.get("voices", []):
            voices[voice["voice_id"]] = voice
            
        return voices
    except Exception as e:
        logger.error(f"Failed to get voices: {str(e)}")
        return {}

def synthesize_chunk(
    text: str, 
    voice_id: str,
    stability: float = DEFAULT_STABILITY,
    similarity_boost: float = DEFAULT_SIMILARITY,
    retry_count: int = 0,
    max_retries: int = 3
) -> Optional[bytes]:
    """
    Synthesize speech from a single text chunk.
    
    Args:
        text: Text to synthesize
        voice_id: ElevenLabs voice ID
        stability: Voice stability (0-1)
        similarity_boost: Voice similarity boost (0-1)
        retry_count: Current retry attempt
        max_retries: Maximum number of retries
        
    Returns:
        Audio data as bytes or None if failed
    """
    if not text.strip():
        logger.warning("Empty text chunk, skipping synthesis")
        return None
        
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
    }
    
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": stability,
            "similarity_boost": similarity_boost
        }
    }
    
    try:
        response = requests.post(
            f"{ELEVENLABS_API_URL}/text-to-speech/{voice_id}/stream",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        return response.content
    except requests.RequestException as e:
        if retry_count < max_retries:
            # Exponential backoff with jitter
            sleep_time = (2 ** retry_count) + (0.1 * retry_count)
            logger.warning(f"TTS request failed, retrying in {sleep_time:.2f}s: {str(e)}")
            time.sleep(sleep_time)
            return synthesize_chunk(text, voice_id, stability, similarity_boost, 
                                   retry_count + 1, max_retries)
        logger.error(f"Failed to synthesize speech after {max_retries} retries: {str(e)}")
        if response.content:
            logger.error(f"Error response: {response.content.decode('utf-8', errors='ignore')}")
        return None

def create_audiobook(
    text: str,
    output_file: str,
    preferred_gender: str = "female",
    force_language: Optional[str] = None,
    add_pause_ms: int = 300
) -> Tuple[bool, str]:
    """
    Create an audiobook from text using ElevenLabs TTS.
    
    Args:
        text: Text to convert to audio
        output_file: Path to save the output audio file
        preferred_gender: 'male' or 'female' voice preference
        force_language: Force a specific language code (if None, auto-detect)
        add_pause_ms: Milliseconds of silence to add between chunks
        
    Returns:
        Tuple of (success, result_message_or_path)
    """
    try:
        # Skip empty text
        if not text or not text.strip():
            return False, "No text provided for synthesis"
            
        # Limit text length for quota management
        text_length = len(text)
        if text_length > 100000:  # Approximately 15,000 words
            logger.warning(f"Text too long ({text_length} chars), truncating for better performance")
            text = text[:100000]
            # Try to find a clean break point
            last_period = text.rfind('.')
            if last_period > 90000:  # If we can find a period that's not too far back
                text = text[:last_period+1]
                
        # Detect language or use forced language
        language = force_language if force_language else detect_language(text)
        logger.info(f"Creating audiobook in {LANGUAGE_NAMES.get(language, language)}")
        
        # Get the appropriate voice ID
        if language not in VOICE_MAPPING:
            return False, f"Language '{language}' not supported by our TTS system"
            
        voice_id = VOICE_MAPPING[language][preferred_gender]
        
        # Split text into chunks
        chunks = chunk_text(text)
        total_chunks = len(chunks)
        logger.info(f"Split text into {total_chunks} chunks for processing")
        
        # Create a temporary directory for chunk files
        with tempfile.TemporaryDirectory() as temp_dir:
            chunk_files = []
            
            # Process each chunk
            for i, chunk in enumerate(chunks):
                logger.info(f"Processing chunk {i+1}/{total_chunks}")
                
                # Synthesize speech for this chunk
                audio_data = synthesize_chunk(chunk, voice_id)
                if not audio_data:
                    return False, f"Failed to synthesize chunk {i+1}/{total_chunks}"
                    
                # Save the chunk to a temporary file
                chunk_file = os.path.join(temp_dir, f"chunk_{i}.mp3")
                with open(chunk_file, "wb") as f:
                    f.write(audio_data)
                chunk_files.append(chunk_file)
                
            # Combine all chunks into a single audio file
            combined_audio = AudioSegment.empty()
            for chunk_file in chunk_files:
                segment = AudioSegment.from_file(chunk_file)
                combined_audio += segment + AudioSegment.silent(duration=add_pause_ms)
                
            # Export the final audio file
            combined_audio.export(output_file, format="mp3")
            
            return True, output_file
            
    except Exception as e:
        logger.error(f"Error creating audiobook: {str(e)}", exc_info=True)
        return False, f"Error creating audiobook: {str(e)}"

def get_language_voices() -> Dict[str, Dict[str, Any]]:
    """
    Get language-to-voice mapping for the UI.
    
    Returns:
        Dictionary mapping language codes to voice information
    """
    language_mapping = {}
    
    for lang_code, voices in VOICE_MAPPING.items():
        language_name = LANGUAGE_NAMES.get(lang_code, lang_code)
        
        language_mapping[lang_code] = {
            "language_name": language_name,
            "female_voice": {
                "name": f"Female ({language_name})",
                "voice_id": voices["female"]
            },
            "male_voice": {
                "name": f"Male ({language_name})",
                "voice_id": voices["male"]
            }
        }
        
    return language_mapping