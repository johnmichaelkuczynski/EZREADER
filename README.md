# 📖 CLASSIC EZ READER

**Multi-Provider AI Text Processing Platform for Rewriting, Humanizing, Assessment, and Document Workflow**

---

## 🧩 Overview

CLASSIC EZ READER is a Flask-based multi-provider AI text processing application designed for serious writers, students, academics, and professionals who need precise, high-quality text transformation. It integrates four top-tier AI providers (Anthropic Claude, OpenAI GPT-4, Perplexity, DeepSeek) with automatic failover, intelligent chunking for large documents, and strict formatting guarantees.

Unlike generic AI writing tools that produce hedged, watered-down output, CLASSIC EZ READER is built around a strict operating principle: every output respects the user's instructions exactly, every paragraph is properly formatted (maximum 4 sentences per paragraph — no exceptions), and every long document is automatically chunked and streamed without token limit errors. No giant walls of text, no preambles, no meta-commentary.

---

## 👥 Who It's For

- **Students and academics** -- need to complete homework assignments, essays, and research papers with thorough, properly formatted output across mathematics, philosophy, literature, history, and science
- **Writers and authors** -- need to rewrite, humanize, or transform fiction and non-fiction texts while preserving voice and meaning
- **Researchers and analysts** -- need to translate, summarize, and assess large documents across 9+ languages with automatic chunking
- **Content creators** -- need to convert between fiction and non-fiction formats, expand short pieces 3x, or refine drafts into polished essays
- **Anyone working with PDFs, Word documents, images, or audio** -- needs reliable extraction, transcription, and AI-driven processing in a single workflow

---

## ⚙️ Core Capabilities

- **Multi-Provider AI Processing** -- Routes text through Anthropic Claude (default), OpenAI GPT-4, Perplexity, or DeepSeek with automatic failover, rate limit detection, and API key rotation. Two-level chunking handles documents of any size.

- **Customized Rewrite** -- Rewrites text according to user-provided instructions with mandatory paragraph formatting (max 4 sentences per paragraph) and 500-word streaming chunks with 10-second pauses to avoid rate limits.

- **One-Click Rewrite** -- Lightweight, fast rewrite that expands short texts 3x and completes incomplete essays or stories with introduction, development, and conclusion.

- **Homework Mode** -- Handles full academic assignments across all subjects (math, philosophy, essays, literature, science) with LaTeX support for mathematical notation and streaming responses to avoid token limit errors on long assignments.

- **Humanizer / Style Rewriter** -- A 3-box style-cloning system with 33 atomic presets and real-time AI detection displaying as "X% HUMAN". Categorized writing samples (academic, creative, technical) allow precise voice matching.

- **Fiction Assessment & Maximization** -- 50-question diagnostic analysis of narrative structure, characterization, dialogue, and thematic depth. Maximize Quality mode recursively rewrites fiction for stronger prose and emotional impact.

- **Non-Fiction Assessment & Maximization** -- Rigorous evaluation of argumentation, evidence, and logical structure. Maximization mode strengthens claims with substantiation and analytical depth.

- **Convert to Fiction / Non-Fiction** -- Transforms expository text into narrative form, or rewrites narrative content as analytical prose, with 2000-word chunking for large documents.

- **Devil's Advocate** -- Generates the strongest possible counter-arguments to any text, helping users stress-test their reasoning before publication.

- **Translation System** -- Multi-provider translation with automatic chunking and language detection across 9+ languages.

- **AI Detection** -- Real-time scoring via GPTZero integration, displayed as a clear "X% HUMAN" indicator on every text box.

- **Math View (LaTeX)** -- KaTeX-powered math rendering toggle on both input and output boxes for proper display of mathematical notation, equations, and proofs.

- **Document Workflow** -- PDF/Word/text upload, image OCR, audio transcription (SpeechRecognition + pydub), voice synthesis (ElevenLabs), and email delivery (SendGrid).

- **AI Chat Assistant** -- Conversational interface with unlimited dialogue, conversation history, and the ability to send any text box's content directly into the chat.

---

## 🚀 What Makes It Different

- **Paragraph formatting is guaranteed** -- The system forcibly splits any paragraph longer than 4 sentences in post-processing. No giant blocks of unreadable text, regardless of what the AI model returns.

- **No token limit errors on long documents** -- Universal 2000-word chunking is applied uniformly across all functions (rewrite, assessment, translation, conversion, humanizer). Streaming with 10-second pauses every 500 words prevents rate limit cascades.

- **Multi-provider failover, not single-vendor lock-in** -- If one provider rate-limits or fails, the system automatically rotates to the next available key or provider. Multiple API keys per provider are managed with health tracking and load balancing.

- **Action buttons reduce ambiguity** -- Prominent ACTION buttons on input and output boxes trigger the currently selected mode directly, eliminating the need for users to double-click mode buttons.

- **Streaming responses, not blocking calls** -- All major processing functions stream output in real time so users see progress immediately, with explicit chunk headers when documents are split.

- **Dollar-sign elimination** -- Automatic stripping of `$` characters from all inputs and outputs prevents formatting collisions with LaTeX math notation.

- **Send-to-anywhere workflow** -- Any output can be sent directly to the input box, the AI chat, the Humanizer, or the Intelligence Assessment with a single click — no copy-paste required.

- **One-click clear all** -- Large red "CLEAR ALL" button in the top header resets every text box across the entire app with a confirmation dialog.

---

## 🛠️ Tech Stack

- **Backend** -- Flask, SQLAlchemy ORM, Gunicorn (gevent workers), PostgreSQL
- **Frontend** -- Jinja2 templates, Bootstrap 5, vanilla JavaScript with AJAX streaming, KaTeX for LaTeX rendering
- **AI Providers** -- Anthropic Claude, OpenAI GPT-4, Perplexity, DeepSeek, Azure OpenAI
- **Third-Party Services** -- GPTZero (AI detection), ElevenLabs (voice synthesis), SendGrid (email)
- **Processing Libraries** -- PyPDF2, python-docx, Pillow/pytesseract (OCR), SpeechRecognition, pydub, langdetect

---

## 📂 File Format Support

- **Documents** -- PDF, DOCX, TXT
- **Images** -- PNG, JPG, JPEG, WEBP (with OCR text extraction)
- **Audio** -- MP3, WAV, M4A, OGG (with transcription)

---

## 🔐 Security

- API key rotation with health tracking and rate limit detection
- File upload validation and size limits
- Secure session management via Flask-Login
- Per-provider rate limiting and load balancing
