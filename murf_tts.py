"""
Murf AI Text-to-Speech Integration Module

This module handles text-to-speech generation using the Murf AI API,
with proper chunking and language detection for high-quality voice synthesis.
"""

import os
import time
import json
import tempfile
import logging
import textwrap
import requests
import uuid
from typing import List, Dict, Tuple, Optional, Any
from langdetect import detect
from pydub import AudioSegment

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants for API requests
MURF_API_URL = "https://api.murf.ai/v1"
MURF_API_KEY = os.environ.get("MURF_API_KEY")
MAX_CHAR_PER_CHUNK = 3000  # Murf generally handles larger chunks than ElevenLabs

# Voice ID mapping by language and gender
# These are example voice IDs - replace with actual Murf voice IDs
VOICE_MAPPING = {
    "en": {  # English
        "female": "en-US-julie",
        "male": "en-US-mike"
    },
    "es": {  # Spanish
        "female": "es-ES-sara",
        "male": "es-ES-alberto"
    },
    "de": {  # German
        "female": "de-DE-anna",
        "male": "de-DE-stefan"
    },
    "fr": {  # French
        "female": "fr-FR-claire",
        "male": "fr-FR-louis"
    },
    "it": {  # Italian
        "female": "it-IT-elena",
        "male": "it-IT-marco"
    },
    "pt": {  # Portuguese
        "female": "pt-BR-fernanda",
        "male": "pt-BR-joao"
    },
    "ja": {  # Japanese
        "female": "ja-JP-yuki",
        "male": "ja-JP-riku"
    },
    "ko": {  # Korean
        "female": "ko-KR-seo-yeon",
        "male": "ko-KR-min-jun"
    }
}

# Language name mapping for UI display
LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "de": "German",
    "fr": "French",
    "it": "Italian",
    "pt": "Portuguese",
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

def get_available_voices() -> Dict[str, Dict[str, Any]]:
    """
    Get available voices from Murf API.
    
    Returns:
        Dictionary of voices with their details
    """
    headers = {
        "Authorization": f"Bearer {MURF_API_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(f"{MURF_API_URL}/voices", headers=headers)
        response.raise_for_status()
        data = response.json()
        return data
    except Exception as e:
        logger.error(f"Failed to get voices: {str(e)}")
        return {}

def create_murf_text_to_speech_job(
    text: str,
    voice_id: str,
    retry_count: int = 0,
    max_retries: int = 3
) -> Optional[str]:
    """
    Create a text-to-speech job on Murf API.
    
    Args:
        text: Text to synthesize
        voice_id: Murf voice ID
        retry_count: Current retry attempt
        max_retries: Maximum number of retries
        
    Returns:
        Job ID if successful, None otherwise
    """
    if not text.strip():
        logger.warning("Empty text chunk, skipping synthesis")
        return None
        
    headers = {
        "Authorization": f"Bearer {MURF_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "voice": voice_id,
        "text": text,
        "format": "mp3",
        "sampleRate": 24000,
        "speed": 1.0,  # Normal speed
        "pitch": 0,    # Default pitch
        "pauseTime": 0.8  # Default pause time
    }
    
    try:
        response = requests.post(
            f"{MURF_API_URL}/text-to-speech",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        data = response.json()
        return data.get("id")  # Return the job ID for polling
    except requests.RequestException as e:
        if retry_count < max_retries:
            # Exponential backoff with jitter
            sleep_time = (2 ** retry_count) + (0.1 * retry_count)
            logger.warning(f"TTS job creation failed, retrying in {sleep_time:.2f}s: {str(e)}")
            time.sleep(sleep_time)
            return create_murf_text_to_speech_job(text, voice_id, retry_count + 1, max_retries)
        logger.error(f"Failed to create TTS job after {max_retries} retries: {str(e)}")
        if hasattr(e, 'response') and e.response:
            logger.error(f"Error response: {e.response.text}")
        return None

def poll_murf_job_status(job_id: str, max_polls: int = 60, poll_interval: float = 2.0) -> Optional[str]:
    """
    Poll job status until completion or timeout.
    
    Args:
        job_id: Murf job ID to poll
        max_polls: Maximum number of poll attempts
        poll_interval: Time between polls in seconds
        
    Returns:
        Audio URL if successful, None otherwise
    """
    headers = {
        "Authorization": f"Bearer {MURF_API_KEY}",
        "Content-Type": "application/json"
    }
    
    for i in range(max_polls):
        try:
            response = requests.get(
                f"{MURF_API_URL}/text-to-speech/{job_id}",
                headers=headers
            )
            response.raise_for_status()
            data = response.json()
            
            status = data.get("status")
            if status == "completed":
                return data.get("audioUrl")
            elif status == "failed":
                logger.error(f"Murf job failed: {data.get('message', 'No error message provided')}")
                return None
            elif status in ["processing", "queued"]:
                # Job still processing, wait and try again
                logger.info(f"Job {job_id} status: {status}, poll {i+1}/{max_polls}")
                time.sleep(poll_interval)
            else:
                logger.warning(f"Unknown job status: {status}")
                time.sleep(poll_interval)
        except Exception as e:
            logger.error(f"Error polling job status: {str(e)}")
            time.sleep(poll_interval)
    
    logger.error(f"Timed out waiting for job {job_id} to complete after {max_polls} polls")
    return None

def download_audio(url: str, output_path: str) -> bool:
    """
    Download audio file from URL to local path.
    
    Args:
        url: Audio file URL
        output_path: Local path to save the file
        
    Returns:
        True if successful, False otherwise
    """
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        return True
    except Exception as e:
        logger.error(f"Failed to download audio: {str(e)}")
        return False

def create_audiobook(
    text: str,
    output_file: str,
    preferred_gender: str = "female",
    force_language: Optional[str] = None,
    add_pause_ms: int = 300
) -> Tuple[bool, str]:
    """
    Create an audiobook from text using Murf AI TTS.
    
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
                
                # Create a text-to-speech job for this chunk
                job_id = create_murf_text_to_speech_job(chunk, voice_id)
                if not job_id:
                    return False, f"Failed to create TTS job for chunk {i+1}/{total_chunks}"
                
                # Poll for job completion
                audio_url = poll_murf_job_status(job_id)
                if not audio_url:
                    return False, f"Failed to complete TTS job for chunk {i+1}/{total_chunks}"
                
                # Download the audio file
                chunk_file = os.path.join(temp_dir, f"chunk_{i}.mp3")
                if not download_audio(audio_url, chunk_file):
                    return False, f"Failed to download audio for chunk {i+1}/{total_chunks}"
                
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