"""
OpenAI Text-to-Speech (TTS) Module
High-quality voice synthesis using OpenAI's TTS API with modern voices
"""
import os
import openai
import logging
import uuid
import time
from typing import Tuple, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OpenAITTS:
    """
    OpenAI Text-to-Speech converter with high-quality voices
    """
    
    # OpenAI TTS Voices - Latest high-quality options
    VOICES = {
        "alloy": {"name": "Alloy", "description": "Neutral, balanced voice"},
        "echo": {"name": "Echo", "description": "Male, clear and articulate"}, 
        "fable": {"name": "Fable", "description": "British accent, sophisticated"},
        "onyx": {"name": "Onyx", "description": "Deep male voice, authoritative"},
        "nova": {"name": "Nova", "description": "Female, warm and friendly"},
        "shimmer": {"name": "Shimmer", "description": "Soft female voice, gentle"}
    }
    
    def __init__(self):
        """Initialize OpenAI TTS with API key"""
        self.openai_key = os.environ.get('OPENAI_API_KEY')
        if not self.openai_key:
            raise ValueError("OpenAI API key not found in environment variables")
        
        self.client = openai.OpenAI(api_key=self.openai_key)
        logger.info("OpenAI TTS initialized successfully")
    
    def get_available_voices(self) -> dict:
        """Return available OpenAI TTS voices"""
        return self.VOICES
    
    def convert_to_speech(
        self, 
        text: str, 
        voice: str = "alloy", 
        speed: float = 1.0,
        model: str = "tts-1-hd"
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Convert text to speech using OpenAI TTS with automatic chunking for long texts
        
        Args:
            text: Text to convert to speech
            voice: OpenAI voice name (alloy, echo, fable, onyx, nova, shimmer)
            speed: Speech speed (0.25 to 4.0)
            model: TTS model (tts-1 or tts-1-hd for higher quality)
        
        Returns:
            Tuple of (success, filename_or_error_message, file_path_or_none)
        """
        try:
            if not text.strip():
                return False, "No text provided for speech synthesis", None
            
            if voice not in self.VOICES:
                voice = "alloy"  # Fallback to default
            
            # Ensure both uploads and static/audio directories exist
            os.makedirs('uploads', exist_ok=True)
            os.makedirs('static/audio', exist_ok=True)
            
            # OpenAI TTS has a 4096 character limit, so chunk long texts
            max_chunk_size = 3800  # Leave some buffer
            
            if len(text) <= max_chunk_size:
                # Single chunk - process normally
                return self._process_single_chunk(text, voice, speed, model)
            else:
                # Multiple chunks - split and merge audio
                return self._process_multiple_chunks(text, voice, speed, model, max_chunk_size)
                
        except Exception as e:
            logger.error(f"OpenAI TTS error: {str(e)}")
            return False, f"Speech synthesis failed: {str(e)}", None
    
    def _process_single_chunk(self, text: str, voice: str, speed: float, model: str) -> Tuple[bool, str, Optional[str]]:
        """Process a single chunk of text"""
        # Generate unique filename
        timestamp = int(time.time())
        unique_id = str(uuid.uuid4())[:8]
        filename = f"tts_{timestamp}_{unique_id}.mp3"
        file_path = os.path.join('uploads', filename)
        
        # Also create a public static file for direct download
        static_filename = f"audio_{timestamp}_{unique_id}.mp3"
        static_file_path = os.path.join('static', 'audio', static_filename)
        
        logger.info(f"Converting {len(text)} characters to speech with voice '{voice}'")
        
        # Make OpenAI TTS API call
        response = self.client.audio.speech.create(
            model=model,
            voice=voice,
            input=text,
            speed=speed,
            response_format="mp3"
        )
        
        # Save audio to both uploads and static directories
        with open(file_path, 'wb') as f:
            f.write(response.content)
            
        # Also save to static/audio for direct download
        with open(static_file_path, 'wb') as f:
            f.write(response.content)
        
        logger.info(f"Speech synthesis successful: {filename} ({len(response.content)} bytes)")
        logger.info(f"Static file created: {static_filename}")
        
        # Return both the original filename and the static filename
        return True, {"filename": filename, "static_filename": static_filename}, {"file_path": file_path, "static_file_path": static_file_path}
    
    def _process_multiple_chunks(self, text: str, voice: str, speed: float, model: str, max_chunk_size: int) -> Tuple[bool, str, Optional[str]]:
        """Process multiple chunks and merge them using pydub if available"""
        # Split text into chunks at sentence boundaries
        chunks = self._split_text_into_chunks(text, max_chunk_size)
        logger.info(f"Text too long ({len(text)} chars), splitting into {len(chunks)} chunks")
        
        try:
            from pydub import AudioSegment
            pydub_available = True
        except ImportError:
            logger.warning("pydub not available - will only process first chunk for long texts")
            pydub_available = False
        
        if not pydub_available:
            # Fallback: just process the first chunk
            first_chunk = chunks[0] if chunks else text[:max_chunk_size]
            logger.warning(f"Processing only first chunk ({len(first_chunk)} chars) due to missing pydub")
            return self._process_single_chunk(first_chunk, voice, speed, model)
        
        # Process each chunk and combine
        audio_segments = []
        temp_files = []
        
        for i, chunk in enumerate(chunks):
            success, result, file_paths = self._process_single_chunk(chunk, voice, speed, model)
            
            if not success:
                # Clean up temp files
                for temp_file in temp_files:
                    try:
                        os.remove(temp_file)
                    except:
                        pass
                return False, f"Failed to process chunk {i+1}: {result}", None
            
            # Handle new return format
            if isinstance(result, dict):
                file_path = file_paths['file_path']
            else:
                file_path = file_paths
            
            # Load audio segment
            audio_segment = AudioSegment.from_mp3(file_path)
            audio_segments.append(audio_segment)
            temp_files.append(file_path)
        
        # Combine all audio segments
        combined_audio = audio_segments[0]
        for audio_segment in audio_segments[1:]:
            combined_audio += audio_segment  # Concatenate
        
        # Save combined audio
        timestamp = int(time.time())
        unique_id = str(uuid.uuid4())[:8]
        final_filename = f"tts_combined_{timestamp}_{unique_id}.mp3"
        final_file_path = os.path.join('uploads', final_filename)
        
        # Also create static file for combined audio
        static_final_filename = f"audio_combined_{timestamp}_{unique_id}.mp3"
        static_final_file_path = os.path.join('static', 'audio', static_final_filename)
        
        combined_audio.export(final_file_path, format="mp3")
        combined_audio.export(static_final_file_path, format="mp3")
        
        # Clean up temporary files
        for temp_file in temp_files:
            try:
                os.remove(temp_file)
            except:
                pass
        
        logger.info(f"Combined TTS successful: {final_filename} from {len(chunks)} chunks")
        logger.info(f"Static combined file created: {static_final_filename}")
        
        return True, {"filename": final_filename, "static_filename": static_final_filename}, {"file_path": final_file_path, "static_file_path": static_final_file_path}
    
    def _split_text_into_chunks(self, text: str, max_chunk_size: int) -> list:
        """Split text into chunks at sentence boundaries"""
        sentences = text.replace('!', '.').replace('?', '.').split('.')
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            # Check if adding this sentence would exceed the limit
            if len(current_chunk) + len(sentence) + 1 > max_chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = sentence + "."
                else:
                    # Single sentence is too long, split it
                    while len(sentence) > max_chunk_size:
                        chunks.append(sentence[:max_chunk_size])
                        sentence = sentence[max_chunk_size:]
                    current_chunk = sentence + "."
            else:
                current_chunk += sentence + "."
        
        # Add the last chunk
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def estimate_duration(self, text: str, words_per_minute: int = 150) -> float:
        """Estimate audio duration in seconds based on text length"""
        words = len(text.split())
        minutes = words / words_per_minute
        return minutes * 60

# Singleton instance for global use
openai_tts = None

def get_openai_tts():
    """Get or create OpenAI TTS instance"""
    global openai_tts
    if openai_tts is None:
        try:
            openai_tts = OpenAITTS()
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI TTS: {e}")
            return None
    return openai_tts

def convert_text_to_speech(text: str, voice: str = "alloy", speed: float = 1.0) -> Tuple[bool, str, Optional[str]]:
    """
    Convenience function to convert text to speech
    
    Args:
        text: Text to convert
        voice: OpenAI voice name
        speed: Speech speed
    
    Returns:
        Tuple of (success, result_message, file_path)
    """
    tts_instance = get_openai_tts()
    if tts_instance is None:
        return False, "OpenAI TTS not available", None
    
    return tts_instance.convert_to_speech(text, voice, speed)