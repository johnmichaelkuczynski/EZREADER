# TTS Functionality Removal

This document outlines all the text-to-speech (TTS) functionality that has been removed from the application.

## Removed Components

1. **API Endpoints**:
   - `/text_to_speech` - Converting text to speech (ElevenLabs API)
   - `/get_audio_file/<filename>` - Serving audio files
   - `/download_audio_file/<filename>` - Downloading audio files
   - `/get_available_voices` - Getting ElevenLabs voices
   - `/create_audiobook` - Creating audiobooks with Google Cloud TTS
   - `/get_language_voices` - Getting available voices by language

2. **UI Elements**:
   - Removed TTS controls panel from the main interface
   - Removed TTS tabs, voice selector, and audio player

3. **JavaScript**:
   - Removed reference to `text-to-speech.js` from index.html
   - The file itself appears to have been removed in a previous update

## Files That Can Be Safely Removed

1. **Google Cloud Credentials File**:
   - `bot-jxgn-788f531bfb83.json` - This credential file was used for Google Cloud Text-to-Speech and can be removed if no other Google Cloud services are being used.

2. **Python Modules**:
   - Any TTS-specific Python modules have already been removed.

## Dependencies That Can Be Removed

If the application no longer needs audio processing in general, the following dependencies can potentially be removed from `pyproject.toml`:

```
"speechrecognition>=3.14.2"  # Used for audio file transcription
"pydub>=0.25.1"              # Used for audio file processing
"langdetect>=1.0.9"          # Used for language detection
"nltk>=3.9.1"                # Used for text chunking/processing
"google-cloud-texttospeech>=2.26.0"
```

Note: Some of these dependencies may still be needed for other functionality like audio transcription.

## Environment Variables No Longer Needed

- `ELEVENLABS_API_KEY` - If no other ElevenLabs services are used

## Next Steps

1. Test the application thoroughly to ensure that removal of TTS functionality hasn't affected other features.
2. Consider removing unused dependencies if confirmed they are not needed elsewhere.
3. Consider removing the Google Cloud credentials file if no other Google Cloud services are used.