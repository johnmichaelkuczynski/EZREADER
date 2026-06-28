# CLASSIC EZ READER - Multi-Provider AI Text Processing Application

## Overview
CLASSIC EZ READER is a Flask-based web application providing advanced AI-driven text processing. It integrates multiple AI providers (OpenAI, Anthropic, Perplexity, DeepSeek) for functionalities like rewriting, translation, style transfer, and comprehensive document processing across various formats including PDFs, Word documents, and audio files. The project aims to deliver robust and versatile AI text manipulation capabilities.

## User Preferences
Preferred communication style: Simple, everyday language.
User satisfaction: HIGH - User confirmed "BETTER" after successful rewrite functionality restoration.
User excitement: MAXIMUM - User confirmed "IT WORKS! NOTE PROGRESS!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" after audio download functionality fully restored.
Latest feedback: "MUCH BETTER!!!!!" - User confirmed AI detection now working perfectly across all boxes.

## System Architecture
### Backend Architecture
The application is built on Flask with SQLAlchemy ORM, designed for SQLite with PostgreSQL compatibility. It features a multi-provider AI processing system with automatic failover, API key management for rotation and rate limiting, and robust file processing. Flask-Login manages session data.

### Frontend Architecture
The frontend uses Jinja2 templates and Bootstrap for a responsive design. It incorporates a drag-and-drop interface for file uploads and utilizes AJAX for real-time, asynchronous processing with progress tracking.

### Core Features
- **Multi-Provider AI Processing**: Implements two-level text chunking, automatic failover, rate limiting, and error handling for rewrite, translate, and summarize functions.
- **API Key Management**: Manages multiple API keys per provider, including health tracking, rotation, rate limit detection, and load balancing.
- **File Processing**: Supports text extraction from PDFs, Word documents, OCR for images, and audio transcription.
- **Translation System**: Provides multi-provider translation with automatic chunking and language detection for 9+ languages.
- **Style Transfer System**: Rewrites text based on user-provided samples (academic, creative, technical styles) using a pass-through architecture.
- **AI Chat**: Offers conversational AI with unlimited dialogue and conversation history.
- **Humanizer/Style Rewriter**: A style-cloning system with a 3-box layout, categorized writing samples, 33 atomic presets, real-time AI detection displaying as "X% HUMAN", and file upload support.
- **Text Assessment & Maximization**: Features for assessing and maximizing the quality of both fiction and non-fiction texts, including converting between the two formats.
- **User Workflow Enhancements**: Includes features like "CUSTOMIZED RE-REWRITE," "SEND TO INPUT BOX," and keyboard shortcuts for improved efficiency.

### UI/UX Decisions
- Responsive design with Bootstrap.
- Intuitive drag-and-drop file upload.
- Real-time processing feedback.
- Clear and simple controls.
- Dollar sign elimination in inputs/outputs for cleaner text processing.

### System Design Choices
- **Data Flow**: Content is uploaded, extracted, chunked, processed by AI, reassembled, and presented.
- **Security**: Includes API key rotation, file upload validation, rate limiting, and secure session management.

## External Dependencies
### AI Providers
- **OpenAI**: GPT-4 models
- **Anthropic**: Claude models
- **Perplexity**: Research and factual content
- **DeepSeek**: High-performance alternative processing
- **Azure OpenAI**: Enterprise-grade OpenAI access

### Third-Party Services
- **ElevenLabs**: Voice synthesis
- **GPTZero**: AI content detection
- **SendGrid**: Email delivery

### Processing Libraries
- **PyPDF2**: PDF text extraction
- **python-docx**: Word document processing
- **Pillow/pytesseract**: Image processing and OCR
- **SpeechRecognition**: Audio transcription
- **pydub**: Audio file manipulation
- **langdetect**: Language identification

## Recent Updates
- October 21, 2025. **ACTION BUTTONS**: Added prominent ACTION buttons to both input and output boxes - Floating green button in input box, red button in output box - Provides psychological reassurance for users who don't realize mode buttons need double-clicking - INPUT ACTION triggers currently selected mode (Homework, Rewrite, etc.) - OUTPUT ACTION triggers re-rewrite on output text - Includes hover animations for visual feedback - Especially helpful for Homework Mode users
- October 21, 2025. **DOCUMENT UPLOAD FIX**: Fixed PDF and Word document uploads for Content Source and Critique boxes - Upload buttons were calling wrong endpoint - Now correctly use /api/content_source/upload and /extract_text endpoints - File processing fully functional
- October 21, 2025. **ABSOLUTE 4-SENTENCE PARAGRAPH LIMIT**: Implemented bulletproof post-processing - NO paragraph can ever exceed 4 sentences - System now collects full AI response and forcibly splits any paragraph longer than 4 sentences - Enhanced prompts with ABSOLUTE MAXIMUM 4 SENTENCES rule - Guarantees readable formatting with no giant text blocks
- October 21, 2025. **ONE CLICK REWRITE FIX**: Fixed "ONE CLICK REWRITE" button - Was calling outdated /process endpoint causing failures - Now uses /customized_rewrite_stream with proper streaming - Automatically chunks at 2000 words for large texts - Includes forced paragraph formatting
- October 21, 2025. **UNIVERSAL 2000-WORD CHUNKING**: Standardized ALL functions to chunk text at 2000 words - Devil's Advocate, Convert to Fiction/Non-Fiction, all assessments, all maximizations, humanizer - Previously inconsistent (500-1500 words) - Now ALL functions handle large documents uniformly with 2000-word chunks
- October 21, 2025. **FORCED PARAGRAPH FORMATTING**: Implemented automatic paragraph break enforcement - System now FORCES blank lines every 4 sentences if AI doesn't provide them - Enhanced prompts with MANDATORY formatting rules (blank line after every 3-5 sentences) - Post-processing ensures output is ALWAYS properly formatted in paragraphs - No more giant blocks of unreadable text
- October 21, 2025. **PROMINENT CLEAR ALL BUTTON**: Added large red "CLEAR ALL" button in top header - Clears all text boxes across entire app - Resets AI detection scores - Confirmation dialog prevents accidental clearing
- October 21, 2025. **CRITICAL ENDPOINT FIX**: Fixed Devil's Advocate, Convert to Fiction, and Convert to Non-Fiction buttons - All three were calling non-existent /process endpoint - Updated to use correct /customized_rewrite_stream streaming endpoint