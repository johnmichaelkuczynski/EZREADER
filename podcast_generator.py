"""
Professional Podcast Generator with OpenAI Voices
Creates high-quality podcast content with multiple hosts and conversation modes
"""
import os
import openai
import logging
import uuid
import time
from typing import List, Dict, Tuple, Optional, Any
from pydub import AudioSegment
from pydub.silence import split_on_silence
import io

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PodcastGenerator:
    """
    Professional podcast generator with OpenAI TTS voices
    Supports single host, dual host, and conversational modes
    """
    
    # OpenAI TTS Voices - Latest high-quality options
    VOICES = {
        "alloy": {"name": "Alloy", "type": "Neutral", "gender": "Neutral"},
        "echo": {"name": "Echo", "type": "Male", "gender": "Male"}, 
        "fable": {"name": "Fable", "type": "British Male", "gender": "Male"},
        "onyx": {"name": "Onyx", "type": "Deep Male", "gender": "Male"},
        "nova": {"name": "Nova", "type": "Female", "gender": "Female"},
        "shimmer": {"name": "Shimmer", "type": "Soft Female", "gender": "Female"}
    }
    
    def __init__(self):
        """Initialize the podcast generator with OpenAI client"""
        self.openai_key = os.environ.get('OPENAI_API_KEY')
        if not self.openai_key:
            raise ValueError("OpenAI API key not found in environment variables")
        
        self.client = openai.OpenAI(api_key=self.openai_key)
        logger.info("Podcast generator initialized with OpenAI TTS")
    
    def generate_podcast_script(
        self, 
        content: str, 
        mode: str = "single_host",
        host1_name: str = "Alex",
        host2_name: str = "Sam",
        style: str = "conversational"
    ) -> Dict[str, Any]:
        """
        Generate a podcast script from content using OpenAI
        
        Args:
            content: Source content to create podcast from
            mode: "single_host", "dual_host", or "interview"
            host1_name: Name of first host
            host2_name: Name of second host (for dual host mode)
            style: "conversational", "educational", "news", "casual"
        
        Returns:
            Dict with script segments and metadata
        """
        try:
            if mode == "single_host":
                prompt = f"""Create an engaging podcast script from the following content. 
                
Host: {host1_name}
Style: {style}

Format the output as a natural, engaging monologue that sounds like a professional podcast host discussing the topic. Make it conversational, informative, and engaging.

Content:
{content}

Instructions:
- Make it sound natural and conversational
- Add transitions and commentary that a podcast host would use
- Include engaging introductions and conclusions
- Break complex topics into digestible segments
- Add personality and warmth to the delivery
- Format as: [HOST: dialogue text]

Create a compelling podcast script:"""

            elif mode == "dual_host":
                prompt = f"""Create an engaging two-host podcast conversation from the following content.

Host 1: {host1_name}
Host 2: {host2_name} 
Style: {style}

Format as a natural conversation between two podcast hosts discussing the topic. Make it engaging, informative, and dynamic with good back-and-forth dialogue.

Content:
{content}

Instructions:
- Create natural dialogue between both hosts
- Each host should have distinct perspectives and contributions
- Include reactions, questions, and commentary from both hosts
- Make transitions smooth and natural
- Add personality and chemistry between hosts
- Format as: [{host1_name}: dialogue] and [{host2_name}: dialogue]
- Ensure both hosts contribute meaningfully to the discussion

Create a compelling two-host podcast conversation:"""

            else:  # interview mode
                prompt = f"""Create an engaging podcast interview from the following content.

Interviewer: {host1_name}
Expert/Guest: {host2_name}
Style: {style}

Format as an interview where the host asks insightful questions and the expert provides detailed answers based on the content.

Content:
{content}

Instructions:
- {host1_name} asks thoughtful, engaging questions
- {host2_name} provides expert insights and detailed answers
- Create natural flow with follow-up questions
- Make it informative yet accessible
- Include introductions and wrap-up
- Format as: [{host1_name}: question/comment] and [{host2_name}: expert response]

Create a compelling podcast interview:"""

            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=3000,
                temperature=0.7
            )
            
            script_text = response.choices[0].message.content
            
            # Parse the script into segments
            segments = self._parse_script(script_text, host1_name, host2_name, mode)
            
            return {
                "success": True,
                "script": script_text,
                "segments": segments,
                "mode": mode,
                "host1_name": host1_name,
                "host2_name": host2_name,
                "style": style
            }
            
        except Exception as e:
            logger.error(f"Error generating podcast script: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _parse_script(self, script_text: str, host1_name: str, host2_name: str, mode: str) -> List[Dict]:
        """Parse script text into individual segments for TTS generation"""
        segments = []
        lines = script_text.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Parse different formats
            if line.startswith(f'[{host1_name}:') or line.startswith(f'{host1_name}:'):
                # Extract text after host name
                text = line.split(':', 1)[1].strip().rstrip(']')
                segments.append({
                    "speaker": host1_name,
                    "text": text,
                    "voice": "alloy"  # Default voice for host 1
                })
            elif line.startswith(f'[{host2_name}:') or line.startswith(f'{host2_name}:'):
                text = line.split(':', 1)[1].strip().rstrip(']')
                segments.append({
                    "speaker": host2_name, 
                    "text": text,
                    "voice": "echo"  # Default voice for host 2
                })
            elif mode == "single_host" and line.startswith('[HOST:'):
                text = line.split(':', 1)[1].strip().rstrip(']')
                segments.append({
                    "speaker": host1_name,
                    "text": text,
                    "voice": "alloy"
                })
            elif not line.startswith('[') and len(line) > 10:
                # Plain text, assign to appropriate host
                segments.append({
                    "speaker": host1_name,
                    "text": line,
                    "voice": "alloy"
                })
        
        return segments
    
    def generate_audio_segment(
        self, 
        text: str, 
        voice: str = "alloy", 
        speed: float = 1.0
    ) -> Tuple[bool, bytes]:
        """
        Generate audio for a single text segment using OpenAI TTS
        
        Args:
            text: Text to convert to speech
            voice: OpenAI voice name (alloy, echo, fable, onyx, nova, shimmer)
            speed: Speech speed (0.25 to 4.0)
        
        Returns:
            Tuple of (success, audio_bytes)
        """
        try:
            if voice not in self.VOICES:
                voice = "alloy"  # Fallback to default
            
            logger.info(f"Generating audio with voice '{voice}' for {len(text)} characters")
            
            response = self.client.audio.speech.create(
                model="tts-1-hd",  # High quality model
                voice=voice,
                input=text,
                speed=speed,
                response_format="mp3"
            )
            
            # Get audio bytes
            audio_bytes = response.content
            logger.info(f"Generated {len(audio_bytes)} bytes of audio")
            
            return True, audio_bytes
            
        except Exception as e:
            logger.error(f"Error generating audio segment: {str(e)}")
            return False, b""
    
    def create_podcast(
        self,
        content: str,
        output_path: str,
        mode: str = "dual_host",
        host1_voice: str = "alloy",
        host2_voice: str = "echo", 
        host1_name: str = "Alex",
        host2_name: str = "Sam",
        style: str = "conversational",
        add_intro_music: bool = False
    ) -> Tuple[bool, str]:
        """
        Create a complete podcast from content
        
        Args:
            content: Source content
            output_path: Path to save final podcast MP3
            mode: "single_host", "dual_host", "interview"
            host1_voice: OpenAI voice for host 1
            host2_voice: OpenAI voice for host 2
            host1_name: Name of host 1
            host2_name: Name of host 2
            style: Podcast style
            add_intro_music: Whether to add intro/outro music
        
        Returns:
            Tuple of (success, result_message_or_path)
        """
        try:
            logger.info(f"Creating {mode} podcast with voices {host1_voice}/{host2_voice}")
            
            # Generate script
            script_result = self.generate_podcast_script(
                content, mode, host1_name, host2_name, style
            )
            
            if not script_result["success"]:
                return False, f"Script generation failed: {script_result.get('error', 'Unknown error')}"
            
            segments = script_result["segments"]
            logger.info(f"Generated script with {len(segments)} segments")
            
            # Generate audio for each segment
            audio_segments = []
            
            for i, segment in enumerate(segments):
                voice = host1_voice if segment["speaker"] == host1_name else host2_voice
                
                success, audio_bytes = self.generate_audio_segment(
                    segment["text"], 
                    voice
                )
                
                if success and audio_bytes:
                    # Convert bytes to AudioSegment
                    audio_segment = AudioSegment.from_mp3(io.BytesIO(audio_bytes))
                    
                    # Add brief pause between speakers
                    if i > 0 and segments[i-1]["speaker"] != segment["speaker"]:
                        silence = AudioSegment.silent(duration=500)  # 0.5 second pause
                        audio_segments.append(silence)
                    
                    audio_segments.append(audio_segment)
                    logger.info(f"Added segment {i+1}/{len(segments)}")
                else:
                    logger.warning(f"Failed to generate audio for segment {i+1}")
            
            if not audio_segments:
                return False, "No audio segments generated successfully"
            
            # Combine all audio segments
            logger.info("Combining audio segments...")
            final_audio = AudioSegment.empty()
            for segment in audio_segments:
                final_audio += segment
            
            # Apply audio processing
            final_audio = final_audio.normalize()  # Normalize volume levels
            
            # Export final podcast
            final_audio.export(output_path, format="mp3", bitrate="192k")
            logger.info(f"Podcast saved to {output_path}")
            
            # Generate metadata
            duration = len(final_audio) / 1000  # Duration in seconds
            
            return True, {
                "path": output_path,
                "duration": duration,
                "segments_count": len(segments),
                "script": script_result["script"],
                "mode": mode,
                "hosts": [host1_name, host2_name] if mode != "single_host" else [host1_name]
            }
            
        except Exception as e:
            logger.error(f"Error creating podcast: {str(e)}")
            return False, f"Podcast creation failed: {str(e)}"
    
    def get_available_voices(self) -> Dict[str, Dict]:
        """Return available voices with metadata"""
        return self.VOICES
    
    def estimate_duration(self, text: str, words_per_minute: int = 160) -> float:
        """Estimate podcast duration in seconds based on text length"""
        words = len(text.split())
        minutes = words / words_per_minute
        return minutes * 60