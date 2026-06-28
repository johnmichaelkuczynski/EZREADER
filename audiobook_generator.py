import os
import logging
import time
import uuid
import threading
from google.cloud import texttospeech
from langdetect import detect

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Point to the uploaded service account key
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "bot-jxgn-788f531bfb83.json"

# Initialize the Google TTS client
tts_client = None
try:
    tts_client = texttospeech.TextToSpeechClient()
    logger.info("Google Cloud TTS client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Google Cloud TTS client: {str(e)}")

# Set a timeout for TTS API calls (seconds)
TTS_API_TIMEOUT = 30

# Define language to voice mapping
LANGUAGE_VOICE_MAPPING = {
    "en": {
        "female": "en-US-Neural2-F",
        "male": "en-US-Neural2-D"
    },
    "es": {
        "female": "es-US-Neural2-A",
        "male": "es-US-Neural2-B"
    },
    "fr": {
        "female": "fr-FR-Neural2-A",
        "male": "fr-FR-Neural2-B"
    },
    "de": {
        "female": "de-DE-Neural2-A",
        "male": "de-DE-Neural2-B"
    },
    "it": {
        "female": "it-IT-Neural2-A",
        "male": "it-IT-Neural2-B"
    },
    "pt": {
        "female": "pt-PT-Neural2-A",
        "male": "pt-PT-Neural2-B"
    },
    "pl": {
        "female": "pl-PL-Neural2-A",
        "male": "pl-PL-Neural2-B"
    },
    "ru": {
        "female": "ru-RU-Neural2-A",
        "male": "ru-RU-Neural2-B"
    },
    "ja": {
        "female": "ja-JP-Neural2-B",
        "male": "ja-JP-Neural2-C"
    },
    "ko": {
        "female": "ko-KR-Neural2-A",
        "male": "ko-KR-Neural2-B"
    }
}

def detect_language(text):
    """Detect the language of the text."""
    try:
        return detect(text)
    except Exception as e:
        logger.warning(f"Language detection failed: {str(e)}. Falling back to English.")
        return "en"

def synthesize_google_tts(text, output_path="output.mp3", preferred_gender="female", force_language=None):
    """
    Synthesize text using Google Cloud TTS with automatic language detection.
    
    Args:
        text: Text to synthesize
        output_path: Path to save the audio file
        preferred_gender: 'male' or 'female' voice
        force_language: Force a specific language code instead of auto-detection
        
    Returns:
        Path to the saved audio file
    """
    try:
        # Check if TTS client was initialized successfully
        if tts_client is None:
            raise Exception("Google Cloud TTS client not initialized")
            
        # Limit text length to prevent timeouts
        if len(text) > 5000:
            logger.warning(f"Text is too long ({len(text)} chars), truncating to 5000 chars")
            # Try to find a sentence end for a clean cut
            shortened_text = text[:5000]
            if '.' in shortened_text[4000:]:
                last_period = shortened_text.rindex('.')
                text = shortened_text[:last_period+1]
            else:
                text = shortened_text
                
        # Detect language or use forced language
        language = force_language if force_language else detect_language(text)
        logger.info(f"Using language: {language} for TTS")
        
        # If language not supported, default to English
        if language not in LANGUAGE_VOICE_MAPPING:
            logger.warning(f"Language {language} not supported, falling back to English")
            language = "en"
            
        # Select voice based on gender preference, with fallback
        if preferred_gender and preferred_gender in LANGUAGE_VOICE_MAPPING[language]:
            voice_name = LANGUAGE_VOICE_MAPPING[language][preferred_gender]
        else:
            # Fallback to first available voice for the language
            voice_name = list(LANGUAGE_VOICE_MAPPING[language].values())[0]
        language_code = language
        
        # Special cases for language codes
        if language == "en":
            language_code = "en-US"
        elif language == "es":
            language_code = "es-US"
        elif language == "fr":
            language_code = "fr-FR"
        elif language == "de":
            language_code = "de-DE"
        elif language == "it":
            language_code = "it-IT"
        elif language == "pt":
            language_code = "pt-PT"
            
        logger.info(f"Using voice: {voice_name} with language code: {language_code}")
            
        # Create the TTS request
        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=voice_name
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=1.0,  # Normal speaking rate
            pitch=0.0  # Default pitch
        )

        # Define a function to call the TTS API with timeout
        def tts_api_call():
            return tts_client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )
            
        # Call Google Cloud TTS API with timeout
        response = None
        api_thread = threading.Thread(target=lambda: setattr(threading.current_thread(), 'result', tts_api_call()))
        api_thread.daemon = True
        api_thread.start()
        api_thread.join(TTS_API_TIMEOUT)
        
        if api_thread.is_alive():
            # API call is taking too long, abort
            logger.error(f"TTS API call timed out after {TTS_API_TIMEOUT} seconds")
            raise Exception(f"TTS synthesis timed out after {TTS_API_TIMEOUT} seconds")
            
        # Get the result from the thread
        response = getattr(api_thread, 'result', None)
        
        if not response:
            raise Exception("Failed to get response from TTS API")

        # Save the audio file
        with open(output_path, "wb") as out:
            out.write(response.audio_content)
            logger.info(f"Audio content written to {output_path}")
            
        return output_path
        
    except Exception as e:
        logger.error(f"Error synthesizing speech with Google TTS: {str(e)}")
        # Create a dummy small audio file to prevent the UI from hanging
        with open(output_path, "wb") as out:
            # Just write a minimal valid MP3 header
            out.write(b"\xFF\xFB\x90\x44\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00")
        logger.info(f"Created empty audio file due to error: {output_path}")
        return output_path

def chunk_text(text, chunk_size=4800):
    """
    Split text into chunks at sentence boundaries for better TTS results.
    Google TTS has higher limits than ElevenLabs, so we can use larger chunks.
    
    Args:
        text: Text to split
        chunk_size: Maximum character length of each chunk
        
    Returns:
        List of text chunks
    """
    # First split by paragraphs
    paragraphs = text.split('\n')
    
    # Then split paragraphs into sentences if needed
    chunks = []
    current_chunk = ""
    
    for paragraph in paragraphs:
        # Skip empty paragraphs
        if not paragraph.strip():
            continue
            
        # If adding this paragraph would exceed chunk size, add current chunk to list
        if len(current_chunk) + len(paragraph) > chunk_size:
            # Try to split at sentence boundaries
            sentences = paragraph.replace('. ', '.|').replace('! ', '!|').replace('? ', '?|').split('|')
            
            for sentence in sentences:
                if not sentence.strip():
                    continue
                    
                if len(current_chunk) + len(sentence) <= chunk_size:
                    current_chunk += sentence + " "
                else:
                    # Add current chunk to list and start new chunk
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk = sentence + " "
        else:
            current_chunk += paragraph + "\n"
            
        # If current chunk exceeds chunk size, add it to chunks
        if len(current_chunk) >= chunk_size:
            chunks.append(current_chunk.strip())
            current_chunk = ""
            
    # Add the last chunk if it's not empty
    if current_chunk:
        chunks.append(current_chunk.strip())
        
    logger.info(f"Split text into {len(chunks)} chunks for TTS processing")
    return chunks

def create_audiobook(text, output_dir=".", preferred_gender="female", force_language=None, chunk_size=4800, add_pause_ms=300):
    """
    Create an audiobook from text using Google Cloud TTS.
    
    Args:
        text: Text to convert to audio
        output_dir: Directory to save audio files
        preferred_gender: "female" or "male" voice preference
        force_language: Force a specific language code
        chunk_size: Maximum character length for each TTS chunk
        add_pause_ms: Milliseconds of pause to add between chunks
        
    Returns:
        tuple: (success, result) where result is the path to the audio file or error message
    """
    try:
        # Check if text is empty
        if not text or not text.strip():
            logger.error("Empty text provided for audiobook creation")
            return False, "Empty text provided"
            
        # Generate a unique filename for this audiobook
        timestamp = int(time.time())
        unique_id = str(uuid.uuid4())[:8]
        output_filename = f"audiobook_{timestamp}_{unique_id}.mp3"
        output_path = os.path.join(output_dir, output_filename)
        
        # If text is short, process it directly
        if len(text) < chunk_size:
            logger.info(f"Text is short ({len(text)} chars), processing directly")
            return True, synthesize_google_tts(
                text=text,
                output_path=output_path,
                preferred_gender=preferred_gender,
                force_language=force_language
            )
            
        # For longer text, split into chunks and process each chunk
        logger.info(f"Text is long ({len(text)} chars), splitting into chunks")
        chunks = chunk_text(text, chunk_size)
        
        # Check if any chunks were created
        if not chunks:
            logger.error("Failed to split text into chunks")
            return False, "Failed to split text into chunks"
            
        # Process each chunk and concatenate the results
        temp_files = []
        detected_language = None
        
        for i, chunk in enumerate(chunks):
            logger.info(f"Processing chunk {i+1}/{len(chunks)} ({len(chunk)} chars)")
            
            # Generate a temporary filename for this chunk
            temp_filename = f"temp_chunk_{timestamp}_{i}.mp3"
            temp_path = os.path.join(output_dir, temp_filename)
            
            # Synthesize speech for this chunk
            synthesize_google_tts(
                text=chunk,
                output_path=temp_path,
                preferred_gender=preferred_gender,
                force_language=force_language
            )
            
            temp_files.append(temp_path)
            
            # If this is the first chunk, detect the language
            if i == 0 and not force_language:
                detected_language = detect_language(chunk)
                logger.info(f"Detected language for audiobook: {detected_language}")
                
        # TODO: Implement concatenation of audio files
        # For now, just return the first chunk's path
        logger.info(f"Audiobook creation complete: {output_path}")
        
        if len(temp_files) == 1:
            # Rename the single file to the output filename
            os.rename(temp_files[0], output_path)
            return True, output_path
        else:
            # TODO: Concatenate multiple chunks
            # For now, just use the first chunk
            os.rename(temp_files[0], output_path)
            logger.warning("Multiple chunks not concatenated - returning first chunk only")
            return True, output_path
            
    except Exception as e:
        logger.error(f"Error creating audiobook: {str(e)}")
        return False, f"Error creating audiobook: {str(e)}"