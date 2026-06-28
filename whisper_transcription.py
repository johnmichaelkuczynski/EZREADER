"""
Audio Transcription using OpenAI's Whisper model

This module provides audio transcription functionality using OpenAI's Whisper model.
"""

import os
import logging
import tempfile
from openai import OpenAI
from pydub import AudioSegment

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def transcribe_audio_with_whisper(audio_path):
    """
    Transcribe audio using OpenAI's Whisper model
    
    Args:
        audio_path: Path to the audio file
        
    Returns:
        Transcribed text
    """
    try:
        logger.debug(f"Starting Whisper transcription for: {audio_path}")
        
        # Verify file exists and has content
        if not os.path.exists(audio_path):
            raise ValueError(f"Audio file not found: {audio_path}")
            
        file_size = os.path.getsize(audio_path)
        if file_size == 0:
            raise ValueError("Audio file is empty")
            
        logger.debug(f"Audio file size: {file_size} bytes")
        
        # Determine file type
        file_ext = os.path.splitext(audio_path)[1].lower()
        
        # Ensure we have a proper audio file format
        supported_formats = ['.mp3', '.wav', '.m4a', '.mp4', '.mpeg', '.mpga', '.webm', '.flac', '.aac', '.ogg']
        if file_ext not in supported_formats:
            logger.error(f"Unsupported file format: {file_ext}")
            raise ValueError(f"Unsupported audio format: {file_ext}. Please use: {', '.join(supported_formats)}")
        
        # Open the audio file and send to Whisper API
        with open(audio_path, "rb") as audio_file:
            logger.debug("Sending audio to Whisper API")
            response = openai_client.audio.transcriptions.create(
                model="whisper-1", 
                file=audio_file
            )
            
            transcribed_text = response.text
            logger.debug(f"Transcription successful: {transcribed_text[:50]}...")
            return transcribed_text
            
    except Exception as e:
        logger.error(f"Error in Whisper transcription: {str(e)}")
        raise