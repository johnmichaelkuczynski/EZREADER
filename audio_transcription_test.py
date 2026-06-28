"""
Audio Transcription Test Script

This script tests the audio transcription functionality without going through the web interface.
"""

import os
import logging
import argparse
import speech_recognition as sr
from pydub import AudioSegment
import tempfile

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def extract_text_from_audio(audio_path):
    """Extract text from audio file using speech recognition"""
    try:
        logger.debug(f"Starting audio transcription from {audio_path}")
        
        # Determine file type and convert if needed
        file_ext = os.path.splitext(audio_path)[1].lower()
        temp_wav = None
        
        # If MP3, convert to WAV first (SpeechRecognition needs WAV)
        if file_ext == '.mp3':
            logger.debug("Converting MP3 to WAV")
            temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
            try:
                sound = AudioSegment.from_mp3(audio_path)
                sound.export(temp_wav, format="wav")
                logger.debug(f"Conversion successful, temporary WAV file: {temp_wav}")
                audio_path_for_recognition = temp_wav
            except Exception as e:
                logger.error(f"Error converting MP3 to WAV: {str(e)}")
                raise ValueError(f"MP3 conversion failed: {str(e)}")
        else:
            audio_path_for_recognition = audio_path
            
        # Initialize recognizer
        recognizer = sr.Recognizer()
        
        # Load audio file
        logger.debug(f"Loading audio from {audio_path_for_recognition}")
        try:
            with sr.AudioFile(audio_path_for_recognition) as source:
                # Adjust for ambient noise
                logger.debug("Adjusting for ambient noise")
                recognizer.adjust_for_ambient_noise(source)
                
                # Record audio
                logger.debug("Recording audio from file")
                audio = recognizer.record(source)
                
                logger.debug(f"Audio duration: {len(audio.frame_data) / (audio.sample_rate * audio.sample_width)} seconds")
                logger.debug(f"Audio sample rate: {audio.sample_rate}")
                logger.debug(f"Audio sample width: {audio.sample_width}")
        except Exception as e:
            logger.error(f"Error loading audio file: {str(e)}")
            raise ValueError(f"Failed to load audio file: {str(e)}")
            
        # Try different recognition services, falling back as needed
        try:
            # First try Google's service (requires internet)
            logger.debug("Attempting Google speech recognition")
            try:
                text = recognizer.recognize_google(audio)
                logger.debug(f"Google speech recognition successful: {text}")
                return text
            except sr.RequestError as e:
                logger.warning(f"Google speech recognition service unavailable: {str(e)}")
                logger.warning("Falling back to Sphinx")
                
                # Try Sphinx (offline recognition)
                try:
                    text = recognizer.recognize_sphinx(audio)
                    logger.debug(f"Sphinx speech recognition successful: {text}")
                    return text
                except Exception as sphinx_error:
                    logger.error(f"Sphinx recognition failed: {str(sphinx_error)}")
                    raise ValueError(f"Both Google and Sphinx recognition failed. Last error: {str(sphinx_error)}")
            except sr.UnknownValueError:
                logger.warning("Google could not understand audio")
                
                # Try Sphinx as fallback
                try:
                    logger.debug("Attempting Sphinx speech recognition")
                    text = recognizer.recognize_sphinx(audio)
                    logger.debug(f"Sphinx speech recognition successful: {text}")
                    return text
                except Exception as sphinx_error:
                    logger.error(f"Sphinx recognition failed: {str(sphinx_error)}")
                    raise ValueError("Audio was not clear enough to transcribe with any available engine")
        finally:
            # Clean up temp file if created
            if temp_wav and os.path.exists(temp_wav):
                logger.debug(f"Cleaning up temporary WAV file: {temp_wav}")
                os.remove(temp_wav)
                
    except Exception as e:
        logger.error(f"Error in audio transcription: {str(e)}")
        # Clean up temp file if there was an error
        if 'temp_wav' in locals() and temp_wav and os.path.exists(temp_wav):
            try:
                os.remove(temp_wav)
            except:
                pass
        raise

def main():
    parser = argparse.ArgumentParser(description="Test audio transcription functionality")
    parser.add_argument("audio_file", help="Path to audio file to transcribe")
    args = parser.parse_args()
    
    if not os.path.exists(args.audio_file):
        print(f"Error: Audio file '{args.audio_file}' not found")
        return 1
        
    try:
        print(f"Attempting to transcribe: {args.audio_file}")
        text = extract_text_from_audio(args.audio_file)
        print(f"Transcription successful!")
        print(f"Transcribed text: \"{text}\"")
        return 0
    except Exception as e:
        print(f"Transcription failed: {str(e)}")
        return 1

if __name__ == "__main__":
    exit(main())