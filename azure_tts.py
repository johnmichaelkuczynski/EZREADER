"""
Azure Text-to-Speech Integration Module

This module handles text-to-speech generation using Microsoft Azure Cognitive Services,
with proper chunking and language detection.
"""
import os
import time
import uuid
import logging
import requests
from typing import List, Dict, Tuple, Any, Optional
from langdetect import detect as detect_language_code

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
MAX_CHAR_PER_CHUNK = 5000  # Azure can handle large chunks

# Voice mappings by language - Updated to latest Azure HD Neural and OpenAI voices
VOICE_MAP = {
    "en": "en-US-Ava:DragonHDLatestNeural",  # Latest HD Neural voice - highest quality
    "es": "es-ES-ElviraNeural",  # Proven Spanish neural voice  
    "fr": "fr-FR-DeniseNeural",  # Proven French neural voice
    "de": "de-DE-KatjaNeural",  # Proven German neural voice
    "it": "it-IT-ElsaNeural",  # Proven Italian neural voice
    "pt": "pt-BR-FranciscaNeural",  # Proven Portuguese neural voice
    "pl": "pl-PL-AgnieszkaNeural",  # Proven Polish neural voice
    "ru": "ru-RU-DariyaNeural",  # Proven Russian neural voice
    "ja": "ja-JP-NanamiNeural",  # Proven Japanese neural voice
    "ko": "ko-KR-SunHiNeural",  # Proven Korean neural voice
    "zh": "zh-CN-XiaoxiaoNeural",  # Maintained - excellent quality
    "ar": "ar-SA-ZariyahNeural",  # Proven Arabic neural voice
    "hi": "hi-IN-SwaraNeural",  # Proven Hindi neural voice
    "nl": "nl-NL-ColetteNeural",  # Proven Dutch neural voice
    "tr": "tr-TR-EmelNeural",  # Proven Turkish neural voice
    "sv": "sv-SE-SofieNeural",  # Proven Swedish neural voice
    "da": "da-DK-ChristelNeural",  # Proven Danish neural voice
    "fi": "fi-FI-NooraNeural",  # Proven Finnish neural voice
    "no": "nb-NO-IselinNeural",  # Proven Norwegian neural voice
    "cs": "cs-CZ-VlastaNeural",  # Proven Czech neural voice
    "hu": "hu-HU-NoemiNeural",  # Proven Hungarian neural voice
    "ro": "ro-RO-AlinaNeural",  # Proven Romanian neural voice
    "th": "th-TH-PremwadeeNeural",  # Proven Thai neural voice
    "vi": "vi-VN-HoaiMyNeural",  # Proven Vietnamese neural voice
    "uk": "uk-UA-PolinaNeural",  # Proven Ukrainian neural voice
    "el": "el-GR-AthinaNeural",  # Proven Greek neural voice
    "he": "he-IL-HilaNeural",  # Proven Hebrew neural voice
    "id": "id-ID-GadisNeural"  # Proven Indonesian neural voice
}

# Default voice if language not supported - using the latest HD voice
DEFAULT_VOICE = "en-US-Ava:DragonHDLatestNeural"

# OpenAI voices for special cases (requires different API endpoint)
OPENAI_VOICES = {
    "alloy": "alloy",
    "echo": "echo", 
    "fable": "fable",
    "onyx": "onyx",
    "nova": "nova",
    "shimmer": "shimmer"
}

# Language name mapping
LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "pl": "Polish",
    "ru": "Russian",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese (Mandarin)",
    "ar": "Arabic",
    "hi": "Hindi",
    "nl": "Dutch",
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

def get_azure_credentials() -> Tuple[str, str]:
    """
    Get Azure Speech credentials from environment
    
    Returns:
        Tuple of (key, endpoint)
    """
    key = os.environ.get("AZURE_SPEECH_KEY")
    endpoint = os.environ.get("AZURE_SPEECH_ENDPOINT")
    region = os.environ.get("AZURE_SPEECH_REGION")
    
    # If endpoint is not directly provided, construct it from region
    if not endpoint and region:
        endpoint = f"https://{region}.tts.speech.microsoft.com"
        logger.info(f"Constructed Azure Speech endpoint from region: {endpoint}")
    
    if not key:
        raise ValueError("Azure Speech credentials (AZURE_SPEECH_KEY) must be set in environment variables")
    
    if not endpoint:
        raise ValueError("Either AZURE_SPEECH_ENDPOINT or AZURE_SPEECH_REGION must be set in environment variables")
    
    return key, endpoint

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

def get_voice_for_language(language_code: str, gender: str = "female") -> str:
    """
    Get the appropriate voice for a language and gender
    
    Args:
        language_code: ISO 639-1 language code
        gender: 'male' or 'female' (note: Azure voices have gender in their naming)
        
    Returns:
        Azure voice name
    """
    # For now, we're just using the female voices from our map
    # Azure does have male voices, but we'd need to create a separate mapping
    if language_code in VOICE_MAP:
        return VOICE_MAP[language_code]
    
    # If language not supported, use default English voice
    logger.warning(f"No voice found for language {language_code}, using default")
    return DEFAULT_VOICE

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
    voice_name: str,
    output_path: str,
    retry_count: int = 0,
    max_retries: int = 3
) -> Tuple[bool, str]:
    """
    Synthesize speech from text using Azure TTS API
    
    Args:
        text: Text to synthesize
        voice_name: Azure voice name (e.g., 'en-US-AriaNeural')
        output_path: Path to save the audio file
        retry_count: Current retry count
        max_retries: Maximum number of retries
        
    Returns:
        Tuple of (success, result_message_or_path)
    """
    try:
        # Get Azure credentials
        key, endpoint = get_azure_credentials()
        
        # Get region from endpoint
        region = endpoint.split('//')[1].split('.')[0]
        
        # Set up endpoint URL for Azure Speech - Using the correct format for the Text-to-Speech REST API
        # Endpoint format should be: https://<region>.tts.speech.microsoft.com/cognitiveservices/voices/list
        # For synthesis: https://<region>.tts.speech.microsoft.com/cognitiveservices/v1
        url = f"{endpoint}/cognitiveservices/v1"
        logger.info(f"Using Azure TTS endpoint: {url}")
        
        # Set up headers with latest high-quality audio format
        headers = {
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-24khz-160kbitrate-mono-mp3",  # Highest quality MP3
            "User-Agent": "RewriteApp-AzureTTS-Latest"
        }
        
        # Prepare SSML with enhanced settings for latest neural voices
        language_code = voice_name.split('-')[0] + '-' + voice_name.split('-')[1]
        ssml = f"""<speak version='1.0' xml:lang='{language_code}'>
            <voice name='{voice_name}'>
                <prosody rate="0.9" pitch="+0%">
                    {text}
                </prosody>
            </voice>
        </speak>"""
        
        # Make API request
        logger.info(f"Requesting speech synthesis for {len(text)} characters of text")
        response = requests.post(url, headers=headers, data=ssml.encode('utf-8'))
        
        # Check for errors
        if response.status_code != 200:
            logger.error(f"Speech synthesis error: {response.status_code} - {response.text}")
            error_message = f"Error from Azure TTS API: {response.status_code}"
            
            # Handle rate limiting or transient errors
            if response.status_code in [429, 500, 502, 503, 504] and retry_count < max_retries:
                wait_time = (2 ** retry_count) * 3  # Exponential backoff
                logger.warning(f"Transient error, retrying in {wait_time}s...")
                time.sleep(wait_time)
                return synthesize_speech(text, voice_name, output_path, retry_count + 1, max_retries)
                
            return False, error_message
        
        # Save the audio file
        with open(output_path, 'wb') as f:
            f.write(response.content)
        
        logger.info(f"Audio saved to {output_path}")
        return True, output_path
        
    except Exception as e:
        logger.error(f"Error in synthesize_speech: {str(e)}")
        
        # Retry on general errors
        if retry_count < max_retries:
            wait_time = (2 ** retry_count) * 2
            logger.warning(f"Error occurred, retrying in {wait_time}s...")
            time.sleep(wait_time)
            return synthesize_speech(text, voice_name, output_path, retry_count + 1, max_retries)
        
        return False, f"Error creating audio: {str(e)}"

def create_audiobook(
    text: str,
    output_file: str,
    preferred_gender: str = "female",
    force_language: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Create an audiobook from text using Azure TTS
    
    Args:
        text: Text to convert to audio
        output_file: Path to save the audio file
        preferred_gender: 'male' or 'female' voice preference (note: currently female only)
        force_language: Force a specific language (if None, auto-detect)
        
    Returns:
        Tuple of (success, result_message_or_path)
    """
    try:
        # Auto-detect language if not specified
        language_code = force_language if force_language else detect_language(text)
        
        # Get appropriate voice
        voice_name = get_voice_for_language(language_code, preferred_gender)
        
        # For longer texts, we need to chunk and process separately
        if len(text) > MAX_CHAR_PER_CHUNK:
            logger.info(f"Long text detected ({len(text)} chars), chunking...")
            chunks = chunk_text(text)
            
            # Process each chunk and create temp files
            temp_files = []
            for i, chunk in enumerate(chunks):
                temp_output = f"{output_file}.part{i}.mp3"
                success, result = synthesize_speech(chunk, voice_name, temp_output)
                
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
            return synthesize_speech(text, voice_name, output_file)
    
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
    
    # Build a simple representation from our voice map
    for lang_code, voice_name in VOICE_MAP.items():
        if lang_code not in language_voices:
            language_voices[lang_code] = []
        
        display_name = voice_name.split('-')[-1].replace('Neural', '')
        gender = 'female'  # We're only using female voices for now
        
        language_voices[lang_code].append({
            'id': voice_name,
            'name': f"{display_name} ({LANGUAGE_NAMES.get(lang_code, lang_code)})",
            'gender': gender
        })
    
    return language_voices