CLASSIC EZ READER — COMPLETE APPLICATION BLUEPRINT

================================================================================ PART 1: APPLICATION OVERVIEW
CLASSIC EZ READER is a Flask-based, single-page AI text-processing platform. It routes user text through six LLM providers (OpenAI, Anthropic, Perplexity, DeepSeek, Venice AI, Azure OpenAI) with automatic key rotation, health tracking, and failover. The app supports rewriting, translation, style-cloning humanization, AI-detection scoring, fiction/non-fiction conversion, quality and intelligence assessment+maximization, AI chat, audiobook/podcast generation, PDF/DOCX/image OCR ingestion, and — as of May 2026 — a Cross-Chunk Coherence (CC) reconstruction engine for coherent long-document generation backed by an external Neon Postgres database.

Stack: Frontend — Jinja2 templates + Bootstrap 5 + vanilla JavaScript (no framework), with progressive Server-Sent Events streaming for long-running operations. Backend — Python 3.11, Flask, Flask-Login, Flask-SQLAlchemy 3.x, gunicorn with gevent workers. Database — dual: (a) SQLAlchemy on PostgreSQL (Neon) for user/document/sample state; (b) raw psycopg2 on the same Neon instance for the CC reconstruction engine's `reconstruction_jobs` / `reconstruction_chunks` tables. Build — no build step (templates served directly). Math/rendering — plain HTML; the app strips `$` (dollar sign) characters from every input and output via `preprocess_dollar_signs()` and prompt-level instructions.

Authentication: Flask-Login session-based. `User` (id, username, email, password_hash 256) lives in SQLAlchemy. Sessions are filesystem-backed with a 24-hour `PERMANENT_SESSION_LIFETIME`. `SESSION_SECRET` must be set in env. The `_user_id` / `user_id` session keys are read by all reconstruction routes to enforce owner-only access on the CC job endpoints.

Run command: `gunicorn --worker-class gevent --workers 2 --bind 0.0.0.0:5000 --timeout 120 main:app` (configured in the `Production Server` workflow). `main.py` simply imports `app` and patches the `MultiProviderProcessor` with chat/translation helpers via `multi_provider_processor_extension.patch_multi_provider_processor()`.

================================================================================ PART 2: THE CORE FEATURES

────────────────────────────────────────────────────────────────────────────── FEATURE 1 — REWRITE (CHUNKED, MULTI-PROVIDER) ──────────────────────────────────────────────────────────────────────────────
Location: Home page (`/`) — LEFT input box → RIGHT output box. Purpose: rewrite an input document with provider failover, two-level chunking, and length-preserving prompts.

Components: `templates/index_clean.html` (input/output textareas with IDs `inputText` / `outputText`, action buttons). Endpoints: `POST /process` (legacy single-shot, paginated), `POST /process_chunk` (one macrochunk), `POST /process_all_chunks` (all chunks in one job), `POST /customized_rewrite_stream` (SSE streaming — the canonical modern path used by ONE CLICK REWRITE, CUSTOMIZED REWRITE, REWRITE MODE, Devil's Advocate, Convert to Fiction, Convert to Non-Fiction).

Chunking: `chunk_text()` (single-level, ~1500-word chunks) and `two_level_chunking()` (macrochunks of ~3000 words, subchunks ~750). All long operations are standardized at 2000-word chunks as of October 2025.

Backend: `process_chunk()` in `app.py` dispatches to `MultiProviderProcessor.process_subchunk(text, provider)`, which routes to `process_with_openai` / `process_with_anthropic` / `process_with_perplexity` / `process_with_deepseek` / `process_with_venice`. Each provider call goes through `api_key_manager.get_next_*_key()` for rotation; failure marks the key in `_mark_key_failed()` and the next provider in `FALLBACK_ORDER` is tried.

Length enforcement: prompts include "preserve length", and the post-processor `force_paragraph_formatting()` (in `app.py`, ~line 4709) forcibly splits any paragraph exceeding 4 sentences. The `$` symbol is stripped at input via `preprocess_dollar_signs()` and via every prompt's "Do NOT use the $ symbol" rule.

────────────────────────────────────────────────────────────────────────────── FEATURE 2 — CROSS-CHUNK COHERENCE (CC) RECONSTRUCTION ──────────────────────────────────────────────────────────────────────────────
Location: Home page (`/`) — button `RECONSTRUCT (LONG DOC, COHERENT)` in the left button column, red→purple gradient. Purpose: generate a coherent long document (5k–200k words) without the "Frankenstein" artifacts that ordinary chunked rewriting produces. Implements the architecture documented in `attached_assets/Pasted--COMPLETE-CROSS-CHUN-*.txt`.

Engine: `reconstruction_engine.py` — three sequential passes, all intermediate state in Neon Postgres (NOT in memory, NOT on Replit's filesystem):

  PASS 1 — Global Skeleton Extraction. `extract_skeleton(job_id)` calls Claude (`claude-3-5-sonnet-20241022`, max 3000 tokens) on the FULL input and returns JSON with `thesis`, `outline` (8–20 numbered claims), `key_terms` (term→definition map), `commitment_ledger` (asserts/rejects/assumes), `entities`. Stored as JSONB on `reconstruction_jobs.global_skeleton`.

  PASS 2 — Constrained Chunk Processing. `process_single_chunk(job, chunk)` runs SEQUENTIALLY (never parallel) over ~500-word chunks. Each chunk receives: the chunk text + the FULL skeleton + custom instructions + a hard min/max word target derived from `length_ratio` + a length-mode guidance template (heavy_compression / moderate_compression / maintain / moderate_expansion / heavy_expansion). One retry if output is <80% of min (expand prompt) or >120% of max (compress prompt). 2-second pre-chunk pause + 3-second inter-chunk pause + 5-second pre-retry pause are enforced — these are not bugs, they protect against rate-limit cascades. Each chunk is committed to `reconstruction_chunks` IMMEDIATELY on completion.

  PASS 3 — Stitch and Assemble. `stitch_and_assemble(job_id)` collects all chunk delta reports (not full text), runs one consistency-review pass against the skeleton (logged for visibility — repair execution is a planned future enhancement, see PART 8), then concatenates chunk outputs with paragraph breaks and writes the result to `reconstruction_jobs.final_output`.

Length parsing: `parse_target_length(instructions, input_words)` matches patterns like "approximately 8000 words" (±10%), "at least 5000 words" (min..1.3×min), "no more than 12000 words" (0.7×..max), "4000-6000 words" (range), bare "8000 words" (±10%), and verbs ("expand"→1.3-1.5×, "compress"→0.3-0.5×). Default with no instruction: ratio 1.0 (match input length).

Endpoints: `POST /reconstruction/start_stream` (SSE — emits `init` → `job_created` → `skeleton_start/done` → `chunks_start` → `chunk_processing`/`chunk_complete` per chunk → `stitch_start/done` → `output` events with text → `complete`). `GET /reconstruction/status/<job_id>` (owner-only). `GET /reconstruction/result/<job_id>` (owner-only). Owner check compares the job's stored `user_id` against `session.user_id || session._user_id || 'anonymous'`.

Failure semantics: STRICT. If any chunk fails permanently, the job is marked `failed` (not silently completed with missing content), and an `error` SSE event is emitted. This is intentional and was reinforced after architectural review.

Pacing expectations: ~20 seconds per chunk total (10–15s LLM + 5s pauses + retries). A 35k-word input targeting 15k words = ~70 chunks = 20–40 minutes. "Finishing in under 10 minutes for a long doc means something was skipped." This is a feature, not a bug.

────────────────────────────────────────────────────────────────────────────── FEATURE 3 — HUMANIZER / STYLE REWRITER ──────────────────────────────────────────────────────────────────────────────
Location: Home page (`/`) — Humanizer section with 3-box layout (Style Sample | Output | Custom Instructions + Provider). Purpose: rewrite text in a user-provided style with AI-detection scoring on input AND output to show humanization effectiveness.

Components: `templates/index_clean.html` IDs `humanizerStyleInput`, `humanizerOutput`, `humanizerCustomInstructions`, `humanizerProvider`, `humanizerRewriteBtn`, `humanizerStyleFileInput`, `humanizerStyleDetectionScore`, `humanizerOutputDetectionScore`, `humanizerReRewriteBtn`, plus action sends to MAIN INPUT / AI CHAT / ASSESS.

Endpoints: `POST /humanizer_rewrite_stream` (SSE), `POST /api/humanizer/profile`, `POST /api/humanizer/upload`, `GET /api/humanizer/samples`, `POST /api/humanizer/clear`, `POST /download_humanizer_docx`, `POST /download_humanizer_pdf`, `POST /detect_ai` (the GPTZero call that powers the "X% HUMAN" badges across all three boxes).

Atomic presets (~33): style-cloning toggles rendered as checkboxes with class `humanizer-preset`, including Compression — light/medium/heavy (−15/30/45%), DECREASE BY 50%, INCREASE BY 150%, Mixed cadence, Clause surgery, Front-load claim, Back-load claim, Seam/pivot, Imply one step, etc. Selected preset values are joined into the rewrite prompt.

Provider dropdown (`humanizerProvider`): anthropic (default), openai, deepseek, perplexity, venice (Llama 3.3 70B via `https://api.venice.ai/api/v1/chat/completions`, integrated May 2026).

AI detection: `ai_detector.py` calls GPTZero with `GPTZERO_API_KEY` and returns a "X% HUMAN" score shown next to each box. Displayed in real time during rewrite progress.

────────────────────────────────────────────────────────────────────────────── FEATURE 4 — TRANSLATION ──────────────────────────────────────────────────────────────────────────────
Location: `/translate` route renders `translation_page.html`; also embedded modal `translation_modal.html` / `two_box_translation_modal.html`. Purpose: translate text into 9+ languages with automatic source-language detection (`langdetect`) and multi-provider failover.

Endpoints: `POST /translate` (single-shot), `POST /combine_target_source` (translation with merged source text), `GET /get_language_voices` (used by TTS for voice-language mapping). Backend: `simple_translation.py` and the chat-extension patch in `multi_provider_processor_extension.py`. Same FALLBACK_ORDER as rewrite. Output passes through `force_paragraph_formatting()`.

────────────────────────────────────────────────────────────────────────────── FEATURE 5 — STYLE TRANSFER (PASS-THROUGH) ──────────────────────────────────────────────────────────────────────────────
Location: separate trigger via `POST /style_rewrite_passthrough`. Purpose: rewrite input text in the style of a user-uploaded sample (academic / creative / technical / custom) using a single LLM round-trip — no chunking, no two-stage. Implementation: `style_rewrite_passthrough.py` builds the prompt directly and calls Perplexity (primary) or DeepSeek (fallback) for cost-efficient one-shot transformation.

────────────────────────────────────────────────────────────────────────────── FEATURE 6 — AI CHAT ──────────────────────────────────────────────────────────────────────────────
Location: chat panel within the home page. Endpoints: `POST /chat` (legacy), `POST /chat_with_ai` (current), `GET /history`. Backend: `MultiProviderProcessor.chat()` (added via `multi_provider_processor_extension.patch_multi_provider_processor()` on app boot). Storage: `chat_message` table (SQLAlchemy). Supports unlimited dialogue length with conversation history retrieval, document context injection via the "→ AI CHAT" button on the humanizer output, and provider selection.

────────────────────────────────────────────────────────────────────────────── FEATURE 7 — TEXT ASSESSMENT & MAXIMIZATION ──────────────────────────────────────────────────────────────────────────────
Location: assessment buttons in the action panel. Purpose: score and improve text along multiple dimensions; convert between fiction and non-fiction.

Endpoints: `POST /quality_assessment_stream` (general quality rubric), `POST /quality_writing_assessment_stream` (writing-craft rubric), `POST /fiction_assessment_stream` (fiction-specific rubric), `POST /intelligence_maximization_stream` (rewrite to maximize cognitive depth), `POST /quality_maximization_stream` (rewrite to maximize prose quality), `POST /fiction_maximization_stream` (rewrite to maximize fictional craft). Devil's Advocate, Convert to Fiction, and Convert to Non-Fiction all route through `/customized_rewrite_stream` with mode-specific prompts (fixed October 2025 — they previously called the non-existent `/process` endpoint).

All assessments are SSE-streamed, chunk at 2000 words, and emit incremental output to the front-end output box.

────────────────────────────────────────────────────────────────────────────── FEATURE 8 — FILE PROCESSING & OCR ──────────────────────────────────────────────────────────────────────────────
Location: drag-and-drop upload on input box. Endpoints: `POST /upload`, `POST /extract_text`, `POST /api/content_source/upload` (Content Source box), `POST /api/content_source/save_text`, `POST /api/content_source/get_text`, `POST /api/content_source/delete`. Backend: `extract_text_from_pdf()` (PyPDF2), `extract_text_from_docx()` (python-docx), `extract_text_from_image()` (Pillow + pytesseract OCR), `extract_text_from_audio()` (SpeechRecognition + pydub). Supported: `.pdf .docx .doc .txt .png .jpg .jpeg .tiff .bmp .webp .mp3 .wav .m4a .ogg`. Upload size cap: 300 MB (`MAX_CONTENT_LENGTH = 300 * 1024 * 1024`).

Document upload fix (October 2025): the Content Source and Critique upload buttons were calling the wrong endpoint; both now correctly hit `/api/content_source/upload` and `/extract_text`.

────────────────────────────────────────────────────────────────────────────── FEATURE 9 — AUDIO: TTS, AUDIOBOOK, PODCAST ──────────────────────────────────────────────────────────────────────────────
Location: action buttons in the audio panel. Endpoints: `POST /process_audio` (TTS for the current output), `GET /get_audio_file/<filename>`, `GET /download_audio_file/<filename>`, `GET /download_static_audio/<filename>`, `POST /create_audiobook` (full-document TTS with chunking), `POST /create_podcast` (multi-voice scripted dialogue), `GET /get_podcast_voices`.

Backends: `elevenlabs_tts.py` (primary — ELEVENLABS_API_KEY, voice selection, dialogue), `openai_tts.py` (OpenAI TTS fallback), `azure_tts.py` (Azure cognitive services fallback), `murf_tts.py` and `replica_tts.py` (additional fallbacks), `audiobook_generator.py` (multi-chunk concatenation with `pydub`), `podcast_generator.py` (script parsing + per-speaker voice mapping). Audio files are saved to `static/audio/audio_<timestamp>_<hash>.mp3` and served via `/download/<filename>`.

────────────────────────────────────────────────────────────────────────────── FEATURE 10 — AI DETECTION ("X% HUMAN") ──────────────────────────────────────────────────────────────────────────────
Endpoint: `POST /detect_ai`. Service: `ai_detector.py` calls GPTZero (`GPTZERO_API_KEY`) and returns `{ai_probability, human_probability, ...}`. Displayed inline as "X% HUMAN" in the input box header, output box header, and humanizer style/output box headers. Triggered automatically after every rewrite/humanize cycle, and on demand via badge clicks. October 2025 feedback: working perfectly across all boxes.

────────────────────────────────────────────────────────────────────────────── FEATURE 11 — COMPREHENSIVE SEARCH ──────────────────────────────────────────────────────────────────────────────
Endpoint: `POST /comprehensive_search`. Backend: `comprehensive_search.py` uses Perplexity (the search-capable provider) to perform multi-source web research and return synthesized results. Used for fact-checking and research-mode workflows.

────────────────────────────────────────────────────────────────────────────── FEATURE 12 — UTILITY ENDPOINTS & WORKFLOW ENHANCEMENTS ──────────────────────────────────────────────────────────────────────────────
- `POST /reset_api_keys` — manually clear failed-key flags and re-enable all keys for all providers.
- `POST /share_text` and `POST /share_rewrite` — email output via SendGrid (`SENDGRID_API_KEY`).
- `GET /get_last_email` — retrieve the last email used for sharing (per session).
- `POST /download_document/<format>` — export current output as `.txt`, `.docx`, or `.pdf`.
- "→ MAIN INPUT" / "→ AI CHAT" / "→ ASSESS" buttons on the humanizer output box copy output across modules.
- "CUSTOMIZED RE-REWRITE" — re-runs custom instructions on the existing OUTPUT (not input), via `POST /rewrite_from_output`.
- "SEND TO INPUT BOX" — moves output → input for chained operations.
- Floating green ACTION button in input box + red ACTION button in output box — triggers the currently selected mode (added October 21, 2025 for users unsure mode buttons need a double-click).
- Prominent red "CLEAR ALL" button in the header — wipes all text boxes and detection scores with a confirmation prompt.

================================================================================ PART 3: COMPLETE FILE TREE
```
/
├── CLASSIC_EZ_READER_BLUEPRINT.md     # This document
├── README.md                          # Public overview
├── replit.md                          # Project preferences + agent notes
├── main.py                            # WSGI entry; patches MultiProviderProcessor
├── app.py                             # Flask app + 56 routes (~5440 lines)
├── models.py                          # SQLAlchemy models (User, UserProfile, WritingSample, ContentSource, TextEntry, DocumentChunk, MacroChunk, ChatMessage, ApiKey)
│
├── api_key_manager.py                 # Multi-key rotation, health tracking, fallback order
├── multi_provider_processor.py        # The 6-provider LLM dispatcher (OpenAI / Anthropic / Perplexity / DeepSeek / Venice / Azure)
├── multi_provider_processor_extension.py  # Monkeypatches chat() and translate() onto the processor at boot
├── azure_openai_processor.py          # Azure OpenAI client + chat_with_azure() + process_text_azure()
├── reconstruction_engine.py           # Three-pass CC engine (skeleton/chunk/stitch) on Neon Postgres
│
├── ai_detector.py                     # GPTZero wrapper → "X% HUMAN" score
├── ai_processor.py                    # Legacy single-provider processor (still referenced in fallback paths)
├── humanizer.py                       # Legacy humanizer logic (superseded by /humanizer_rewrite_stream)
├── style_rewrite_passthrough.py       # Single-shot style-clone (Perplexity primary, DeepSeek fallback)
│
├── elevenlabs_tts.py                  # ElevenLabs TTS + voice list + dialogue
├── openai_tts.py                      # OpenAI TTS fallback
├── azure_tts.py                       # Azure cognitive TTS fallback
├── murf_tts.py                        # Murf TTS fallback
├── replica_tts.py                     # Replica TTS fallback
├── audiobook_generator.py             # Multi-chunk audiobook assembly (pydub)
├── podcast_generator.py               # Multi-voice scripted podcast generation
│
├── comprehensive_search.py            # Perplexity-powered research mode
├── simple_translation.py              # Translation orchestration
├── email_service.py                   # SendGrid wrapper
├── rewrite_enhancer.py                # Prompt-quality booster
├── improved_prompts.py                # Prompt templates v1
├── improved_prompts_v2.py             # Prompt templates v2 (current)
├── enhanced_integration.py            # Adapter for processor + enhancer
├── new_openai_processor.py            # Alternative OpenAI path
├── new_emergency_recovery.py          # Emergency fallback when all keys fail
├── auto_activate_keys.py              # Startup key-health reset
├── update_processor_functions.py      # Migration helper
├── update_db.py / update_schema.py / update_content_source_schema.py / reset_db.py / reset_schema.py  # one-off migrations
├── audio_transcription_test.py / test_dollar_elimination.py / test_enhanced_rewrite.py  # ad-hoc tests
├── download_nltk_data.py              # Bootstraps NLTK corpora for chunking
│
├── /templates/
│   ├── base.html                      # Bootstrap shell, common nav, CSRF helpers
│   ├── index_clean.html               # MAIN UI (~4740 lines) — input/output, humanizer, all action buttons
│   ├── translation_page.html          # Standalone translation page
│   ├── translation_modal.html         # Translation modal (embedded)
│   └── two_box_translation_modal.html # Side-by-side translation modal
│
├── /static/
│   ├── /css/                          # Bootstrap overrides
│   └── /audio/                        # Generated TTS / audiobook / podcast .mp3 files
│
├── /attached_assets/                  # User-uploaded reference docs, screenshots, prior code samples; CC spec lives here:
│   ├── Pasted--COMPLETE-CROSS-CHUN-*.txt        # 851-line CC implementation spec
│   ├── Pasted--CROSS-CHUNK-COHEREN-*.txt        # 277-line CC context doc
│   └── BOOK_BUILDER_COMPLETE_APPLICATION_*.txt  # Reference blueprint this one is modeled on
│
└── /uploads/                          # Temp file uploads (PDF/DOCX/images/audio) — cleaned periodically
```

Notes: `app.py` is monolithic by design (~5440 lines, 56 routes). The legacy `humanizer.py` / `ai_processor.py` / `new_openai_processor.py` files coexist with the modern processor; the modern path is `multi_provider_processor.py` + `reconstruction_engine.py`. Do not delete legacy files without grepping for references — several emergency-recovery paths still touch them.

================================================================================ PART 4: DATABASE SCHEMA

The app uses TWO logical schemas in the SAME Neon Postgres database (DATABASE_URL / NEON_DATABASE_URL):

SCHEMA A — SQLAlchemy (managed by `models.py`, created via `db.create_all()` on boot):

Table: user
  id integer PK; username varchar(64) UNIQUE NOT NULL; email varchar(120) UNIQUE NOT NULL; password_hash varchar(256)

Table: user_profile
  id integer PK; email varchar(120) UNIQUE NOT NULL; merged_text text; word_count integer DEFAULT 0; created_at timestamp; last_updated timestamp
  Relationships: uploads → writing_sample, entries → text_entry

Table: writing_sample           # User's style samples for the humanizer
  id integer PK; profile_id FK→user_profile; filename varchar(255); text_content text; word_count integer; file_type varchar(20); created_at timestamp

Table: content_source           # Reference material injected into rewrites
  id integer PK; filename varchar(255); text_content text; word_count integer; file_type varchar(20); usage_instructions text; text_entry_id FK→text_entry (nullable); created_at timestamp

Table: text_entry               # One processing job: input + processed output + settings
  id integer PK; original_text text NOT NULL; processed_text text NOT NULL; action varchar(50) NOT NULL  -- rewrite/summarize/expand
  complexity varchar(100); created_at timestamp; total_chunks integer DEFAULT 1; custom_instructions text;
  preserve_structure boolean DEFAULT true; user_profile_id FK→user_profile (nullable); target_language varchar(50) (nullable)
  Relationships: chunks → document_chunk, content_sources → content_source

Table: document_chunk           # Per-chunk subdivision of a text_entry
  id integer PK; document_id FK→text_entry; chunk_number integer; chunk_text text; processed_text text; status varchar(20)

Table: macro_chunk              # Two-level chunking parent records (rare path)
  id integer PK; document_id FK→text_entry; macro_index integer; text text

Table: chat_message             # AI chat conversation log
  id integer PK; user_email varchar(120); role varchar(20)  -- user/assistant; content text; created_at timestamp; conversation_id integer (nullable)

Table: api_key                  # Optional per-user API key storage (currently unused — keys live in env)
  id integer PK; provider varchar(50); api_key varchar(512); active boolean; created_at timestamp

SCHEMA B — Raw psycopg2 (managed by `reconstruction_engine.init_reconstruction_schema()`, called once at boot):

Table: reconstruction_jobs      # One row per CC reconstruction request
  id UUID PK DEFAULT gen_random_uuid(); user_id text; document_title text; original_text text;
  total_input_words integer; target_min_words integer; target_max_words integer; target_mid_words integer;
  length_ratio decimal; length_mode text  -- heavy_compression | moderate_compression | maintain | moderate_expansion | heavy_expansion
  num_chunks integer; chunk_target_words integer;
  global_skeleton jsonb            -- {thesis, outline[], key_terms{}, commitment_ledger[], entities[]}
  custom_instructions text;
  status text DEFAULT 'pending'    -- pending | skeleton_extraction | chunk_processing | stitching | complete | failed
  current_chunk integer DEFAULT 0;
  final_output text; final_word_count integer; error_message text;
  created_at timestamp DEFAULT NOW(); updated_at timestamp DEFAULT NOW()

Table: reconstruction_chunks    # One row per ~500-word chunk
  id UUID PK DEFAULT gen_random_uuid(); job_id UUID REFERENCES reconstruction_jobs(id) ON DELETE CASCADE;
  chunk_index integer; chunk_input_text text; chunk_input_words integer;
  target_words integer; min_words integer; max_words integer;
  chunk_output_text text; actual_words integer; chunk_delta jsonb  -- {new_claims, terms_used, conflicts}
  retry_count integer DEFAULT 0; status text DEFAULT 'pending'  -- pending | processing | complete | retry | failed
  error_message text; created_at timestamp DEFAULT NOW(); updated_at timestamp DEFAULT NOW()

Indexes: idx_rj_status (reconstruction_jobs.status), idx_rc_job_id (reconstruction_chunks.job_id), idx_rc_index (reconstruction_chunks(job_id, chunk_index))

Cleanup policy (NOT YET AUTOMATED — planned): keep completed jobs 24h, failed jobs 7d, cascade-delete handles chunks.

================================================================================ PART 5: AI MODEL ROUTING

All LLM calls in the modern path go through `MultiProviderProcessor.process_subchunk(text, provider)` in `multi_provider_processor.py`:

  provider = 'anthropic'  → process_with_anthropic()  → claude-3-5-sonnet-20241022
  provider = 'openai'     → process_with_openai()     → gpt-4o (configurable)
  provider = 'deepseek'   → process_with_deepseek()   → deepseek-chat via https://api.deepseek.com/v1
  provider = 'perplexity' → process_with_perplexity() → sonar-pro via https://api.perplexity.ai
  provider = 'venice'     → process_with_venice()     → llama-3.3-70b via https://api.venice.ai/api/v1/chat/completions
  provider = 'azure'      → azure_openai_processor.process_text_azure() → Azure deployment (env-configured)

CC reconstruction (`reconstruction_engine.py`) bypasses the multi-provider dispatcher and calls Anthropic Claude directly via the `anthropic` SDK with the same `claude-3-5-sonnet-20241022` model for all three passes. This is deliberate — coherence quality dominates cost on this path.

Failover order (`api_key_manager.FALLBACK_ORDER`, used when a provider is marked failed): anthropic → openai → deepseek → perplexity → venice → azure.

Key rotation: `api_key_manager.py` `ApiKeyManager` class. `_load_api_keys(env_var_base)` reads `OPENAI_API_KEY`, `OPENAI_API_KEY_2`, `OPENAI_API_KEY_3`, etc., and similarly for `ANTHROPIC_API_KEY*`, `PERPLEXITY_API_KEY*`, `DEEPSEEK_API_KEY*`, `VENICE_API_KEY*`. Each key has a health record: `{key, last_used, failure_count, rate_limited_until}`. `get_next_<provider>_key()` picks the round-robin next healthy key. `_mark_key_failed(key, reason)` increments failure_count and sets a cooldown if rate-limited.

`POST /reset_api_keys` manually clears all `failure_count` and `rate_limited_until` flags — used when API quotas reset or when a key has been replaced.

Environment secrets:
  OPENAI_API_KEY[_N]         — OpenAI + Whisper STT
  ANTHROPIC_API_KEY[_N]      — Claude models + CC reconstruction
  DEEPSEEK_API_KEY[_N]       — DeepSeek chat
  PERPLEXITY_API_KEY[_N]     — Perplexity sonar + comprehensive_search
  VENICE_API_KEY[_N]         — Venice AI (Llama 3.3 70B)
  AZURE_OPENAI_ENDPOINT      — Azure base URL
  AZURE_OPENAI_API_KEY       — Azure key
  AZURE_OPENAI_DEPLOYMENT    — Azure model deployment name
  GPTZERO_API_KEY            — AI detection (all "X% HUMAN" displays)
  ELEVENLABS_API_KEY         — Primary TTS
  SENDGRID_API_KEY           — Email share
  DATABASE_URL               — Neon Postgres connection string (primary)
  NEON_DATABASE_URL          — Optional alias; reconstruction_engine accepts either
  SESSION_SECRET             — Flask session cookie signing (MUST be set)

Rate-limit handling: provider-level cooldowns in `api_key_manager`, plus the CC engine's mandatory 2-3s inter-chunk sleeps. There is NO global token bucket — this is a known scaling limit (see PART 8).

================================================================================ PART 6: KEY SERVICE INTERFACES

── MultiProviderProcessor (multi_provider_processor.py) ──
class MultiProviderProcessor:
    process_subchunk(text: str, provider: str, custom_instructions: str = '', author_style: str = '', content_source: str = '') -> str
    process_with_openai(text, custom_instructions, ...) -> str
    process_with_anthropic(text, custom_instructions, ...) -> str
    process_with_perplexity(text, custom_instructions, ...) -> str
    process_with_deepseek(text, custom_instructions, ...) -> str
    process_with_venice(text, custom_instructions, ...) -> str
    # chat() and translate() are monkeypatched in via multi_provider_processor_extension.patch_multi_provider_processor()

── ApiKeyManager (api_key_manager.py) ──
class ApiKeyManager:
    get_next_openai_key() / get_next_anthropic_key() / get_next_perplexity_key() / get_next_deepseek_key() / get_next_venice_key() -> Optional[str]
    mark_key_failed(provider: str, key: str, reason: str) -> None
    reset_all_keys() -> None
    get_health_report() -> dict

── ReconstructionEngine (reconstruction_engine.py) ──
def init_reconstruction_schema() -> None     # idempotent DDL
def get_db_connection() -> psycopg2.connection  # accepts NEON_DATABASE_URL or DATABASE_URL
def parse_target_length(instructions: str, input_words: int) -> Tuple[int, int]
def get_length_mode(ratio: float) -> str    # → heavy_compression | ... | heavy_expansion
def split_into_chunks(text: str, target_words: int = 500) -> List[str]   # paragraph-boundary aware
def call_llm(prompt: str, max_tokens: int = 4000, system: str = '') -> str
def initialize_job(original_text, custom_instructions, user_id=None, document_title=None) -> dict
def extract_skeleton(job_id: str) -> dict
def process_single_chunk(job: dict, chunk: dict) -> dict   # with one length-retry
def stitch_and_assemble(job_id: str) -> str
def run_reconstruction_stream(original_text, custom_instructions, user_id=None, document_title=None) -> Generator[str, None, None]  # SSE
Constants: ANTHROPIC_MODEL='claude-3-5-sonnet-20241022', CHUNK_SIZE_WORDS=500, SKELETON_MAX_TOKENS=3000, CHUNK_MAX_TOKENS=4000, STITCH_MAX_TOKENS=2000, INTER_CHUNK_DELAY=3, RETRY_DELAY=5

── AzureOpenAI (azure_openai_processor.py) ──
def is_available() -> bool
def process_text_azure(text: str, custom_instructions: str = '', style_instruction: str = '', ...) -> Tuple[bool, str]
def chat_with_azure(message: str, context: str = '') -> Tuple[bool, str]
def clean_ai_response(response_text: str, custom_instructions: str = '', style_instruction: str = '') -> str

── AIDetector (ai_detector.py) ──
def detect_ai_content(text: str) -> dict
  # returns {ai_probability, human_probability, completely_generated_prob, sentences[]}
  # uses GPTZERO_API_KEY

── TTS (elevenlabs_tts.py / openai_tts.py / azure_tts.py) ──
def text_to_speech(text: str, voice_id: str = None, output_path: str = None) -> str   # → filepath
def list_voices() -> List[dict]
def generate_dialogue(script: List[dict], voice_map: dict) -> str

── EmailService (email_service.py) ──
def send_email(to: str, subject: str, body: str, attachments: List[str] = None) -> bool
  # uses SENDGRID_API_KEY

── App-level helpers (app.py) ──
def preprocess_dollar_signs(text: str) -> str            # removes $ symbols site-wide
def force_paragraph_formatting(text: str) -> str         # ABSOLUTE 4-sentence-per-paragraph enforcement
def chunk_text(text: str) -> List[str]                   # single-level ~1500-word chunking
def two_level_chunking(text, macrochunk_size, subchunk_size) -> dict   # macro + sub
def extract_text_from_pdf(file_path) -> str              # PyPDF2
def extract_text_from_docx(file_path) -> str             # python-docx
def extract_text_from_image(image_path) -> str           # Pillow + pytesseract
def extract_text_from_audio(audio_path) -> str           # SpeechRecognition + pydub
def process_chunk(chunk_id, chunk_number, custom_instructions='', ...) -> str   # orchestrates one chunk through MultiProviderProcessor

================================================================================ PART 7: FRONTEND STATE & DATA FLOW

There is no client framework. The frontend is `templates/index_clean.html` — a single ~4740-line Jinja2 template with all UI, CSS, and vanilla JS inline. State lives in DOM elements and a handful of module-scoped JS variables. There is no shared store and no reactivity beyond `addEventListener`.

Key DOM IDs (canonical):
  #inputText           — left input textarea
  #outputText          — right output textarea (readonly)
  #customizedRewriteBtn / #oneClickRewriteBtn / #rewriteModeBtn / #rewriteChunkBtn / #selectPreviewChunkBtn
  #reconstructLongDocBtn  — CC long-doc button (added May 2026)
  #humanizerStyleInput / #humanizerOutput / #humanizerCustomInstructions / #humanizerProvider / #humanizerRewriteBtn
  #humanizerStyleDetectionScore / #humanizerOutputDetectionScore  — "X% HUMAN" badges
  #humanizerSendToInputBtn / #humanizerSendToAiChatBtn / #humanizerSendToAssessmentBtn
  .humanizer-preset    — 33 atomic preset checkboxes

API call pattern (current): `fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(...) })` followed by either `await resp.json()` (one-shot) or `resp.body.getReader()` + `TextDecoder` + manual SSE event splitting on `\n\n` (streaming). The CC button uses the streaming pattern and renders incremental `event: 'output'` chunks directly into `#outputText`.

Loading states: button.disabled + opacity 0.6 during the in-flight request; reset in `finally{}`.

Error states: `alert()` for validation errors before submission; inline `outputText.value += '\n\n[ERROR] ' + msg` for runtime failures during streaming.

AI detection: every rewrite/humanize cycle triggers a follow-up `POST /detect_ai` against both input and output, updating the badge text to "X% HUMAN".

================================================================================ PART 8: KNOWN COMPLEXITY AREAS

`app.py` (~5440 lines, 56 routes) — All HTTP handlers in one file. The largest sections are: rewrite/customized_rewrite_stream (~340 lines), assessment endpoints (quality/quality_writing/fiction × assessment/maximization = 6 endpoints, ~200 lines each), and humanizer_rewrite_stream (~200 lines). There are 65 LSP diagnostics in app.py — all pre-existing, none blocking. Split candidates: assessment endpoints → `assessment_routes.py`, audio endpoints → `audio_routes.py`, content_source endpoints → `content_source_routes.py`.

`templates/index_clean.html` (~4740 lines) — All UI, CSS, and JS inline. The 33 humanizer presets, all button handlers, all modals, and all SSE consumers live here. Split candidates: extract `humanizer.html`, `reconstruction.html`, and `assessment.html` Jinja partials.

CC engine — Three known limitations vs. the full spec:
  1. STITCH PASS IS REVIEW-ONLY. Per the spec, the stitch pass should detect conflicts AND execute repairs on flagged chunks. Current implementation logs the assessment and proceeds straight to assembly. The repair-execution loop is the highest-value next-step enhancement.
  2. DB CONNECTION CHURN. `_exec()` opens a fresh psycopg2 connection per statement (cleanest for gevent's monkey-patched sockets, but creates connection load on Neon under concurrent jobs). A pooled `psycopg2.pool.SimpleConnectionPool` or per-job connection re-use is the right fix at scale.
  3. SKELETON-AT-SCALE. The full skeleton is injected into every chunk prompt. At 200+ chunks, this exceeds practical context windows. Solutions (per the spec): hierarchical skeletons (global compressed + per-section detailed), retrieval-augmented skeleton injection (embed entries, pull top-k per chunk), or compressed deltas.

Provider rotation — `api_key_manager` rotates keys but does NOT track per-minute token budgets. Heavy concurrent traffic can still trip provider rate limits. Add a token-bucket per provider in `api_key_manager` if multi-user concurrency grows.

Dual-database pattern — SQLAlchemy and raw psycopg2 hit the same Neon instance. This works fine but means migrations live in two places: `models.py` + `db.create_all()` for SQLAlchemy tables, and `reconstruction_engine.init_reconstruction_schema()` for the CC tables. Any future ORM migration tool (Alembic) would need to skip the CC tables.

Long-running SSE under gunicorn — `--timeout 120` is per-request idle time. A CC reconstruction emits an SSE event every few seconds so the connection stays alive, but if a single LLM call ever exceeds 120s without a yielded event, gunicorn will kill the worker. The 4000-token CHUNK_MAX_TOKENS keeps individual Claude calls well under this; do not raise it past ~6000 without raising the timeout.

Legacy code paths — `humanizer.py`, `ai_processor.py`, `new_openai_processor.py`, and `new_emergency_recovery.py` predate the multi-provider processor. They are still imported by a handful of fallback paths. Grep before deleting.

================================================================================ PART 9: NAVIGATION MAP

This is a single-page app — almost all functionality lives at `/`. The full route map:

  Page routes:
    GET  /                                  — `index()` → renders index_clean.html (THE app)
    GET  /translate                         — `translation_page()` → translation_page.html
    GET  /clean                             — `clean_design()` → minimal variant (legacy)

  Long-document reconstruction (CC):
    POST /reconstruction/start_stream       — SSE: full three-pass pipeline
    GET  /reconstruction/status/<job_id>    — owner-only status
    GET  /reconstruction/result/<job_id>    — owner-only final output

  Rewrite & assessment (all SSE except /process):
    POST /process                           — legacy paginated single-shot
    POST /process_chunk                     — one macrochunk
    POST /process_all_chunks                — full doc, blocking
    POST /customized_rewrite_stream         — canonical streaming rewrite (used by ONE CLICK, CUSTOMIZED, DEVIL'S ADVOCATE, FICTION/NON-FICTION conversion)
    POST /style_rewrite_passthrough         — single-shot style clone (Perplexity)
    POST /humanizer_rewrite_stream          — humanizer (style-cloning + AI detection)
    POST /quality_assessment_stream
    POST /quality_writing_assessment_stream
    POST /fiction_assessment_stream
    POST /intelligence_maximization_stream
    POST /quality_maximization_stream
    POST /fiction_maximization_stream
    POST /rewrite_from_output               — CUSTOMIZED RE-REWRITE (operates on output)

  Chat:
    POST /chat                              — legacy
    POST /chat_with_ai                      — current AI chat
    GET  /history                           — chat history

  Translation:
    POST /translate                         — translate text
    POST /combine_target_source             — translation with source merge
    GET  /get_language_voices               — language → voice map for TTS

  File I/O:
    POST /upload                            — upload to input
    POST /extract_text                      — extract from PDF/DOCX/image/audio
    POST /api/content_source/upload         — upload reference content
    GET  /api/content_source/get            — list saved content sources
    GET  /api/content_source/get_text       — get one source's text
    POST /api/content_source/save_text      — save edited source text
    POST /api/content_source/save_instructions  — usage instructions for a source
    POST /api/content_source/delete

  Humanizer:
    POST /api/humanizer/profile             — create/update user style profile
    POST /api/humanizer/upload              — upload style sample
    GET  /api/humanizer/samples             — list style samples
    POST /api/humanizer/clear               — clear profile
    POST /download_humanizer_docx
    POST /download_humanizer_pdf

  AI detection:
    POST /detect_ai                         — "X% HUMAN" via GPTZero

  Audio:
    POST /process_audio                     — TTS for current output
    POST /create_audiobook                  — full-doc audiobook
    POST /create_podcast                    — multi-voice podcast
    GET  /get_podcast_voices
    GET  /get_audio_file/<filename>
    GET  /download_audio_file/<filename>
    GET  /download_static_audio/<filename>
    GET  /download/<filename>               — generic download

  Sharing & export:
    POST /share_text
    POST /share_rewrite
    GET  /get_last_email
    POST /download_document/<format>        — txt | docx | pdf

  Comprehensive research:
    POST /comprehensive_search              — Perplexity multi-source research

  Admin:
    POST /reset_api_keys                    — clear all key health flags

  Other:
    POST /get_chunk                         — get a specific chunk's text
    POST /process_chunk                     — process one chunk

================================================================================ PART 10: EXTERNAL API DEPENDENCY MAP

Provider           | Secret(s)                                              | Used in
-------------------|--------------------------------------------------------|--------------------------------------------------------------
OpenAI (GPT-4o)    | OPENAI_API_KEY[_2,_3,...]                              | multi_provider_processor.process_with_openai; Whisper STT
Anthropic (Claude) | ANTHROPIC_API_KEY[_2,_3,...]                           | process_with_anthropic; reconstruction_engine.call_llm (ALL 3 CC passes)
DeepSeek           | DEEPSEEK_API_KEY[_2,_3,...]                            | process_with_deepseek; style_rewrite_passthrough fallback
Perplexity         | PERPLEXITY_API_KEY[_2,_3,...]                          | process_with_perplexity; comprehensive_search; style_rewrite_passthrough primary
Venice AI (Llama)  | VENICE_API_KEY[_2,_3,...]                              | process_with_venice (added May 2026, default fallback at end of FALLBACK_ORDER)
Azure OpenAI       | AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT  | azure_openai_processor.process_text_azure / chat_with_azure
GPTZero            | GPTZERO_API_KEY                                        | ai_detector.detect_ai_content (every "X% HUMAN" badge)
ElevenLabs         | ELEVENLABS_API_KEY                                     | elevenlabs_tts (primary TTS, audiobooks, podcasts, voice list)
OpenAI TTS         | OPENAI_API_KEY                                         | openai_tts (TTS fallback)
Azure TTS          | AZURE_SPEECH_KEY, AZURE_SPEECH_REGION (if configured)  | azure_tts fallback
Murf               | MURF_API_KEY (if configured)                           | murf_tts fallback
Replica            | REPLICA_API_KEY (if configured)                        | replica_tts fallback
SendGrid           | SENDGRID_API_KEY                                       | email_service.send_email (share output, share rewrites)
Tesseract (local)  | none                                                   | extract_text_from_image (no API)
Neon Postgres      | DATABASE_URL or NEON_DATABASE_URL                      | SQLAlchemy (models.py); reconstruction_engine (CC tables)

================================================================================ PART 11: KEY UI/UX CONVENTIONS

- The dollar sign (`$`) is ELIMINATED from every input and output. `preprocess_dollar_signs()` strips it on ingest; every LLM prompt includes "Do NOT use the $ symbol"; post-processing strips any that leak through. This is a hard product requirement.
- The ABSOLUTE 4-sentence paragraph limit applies to ALL outputs. `force_paragraph_formatting()` forcibly splits any paragraph longer than 4 sentences AFTER the LLM responds — this is non-negotiable and overrides anything the model produces.
- Every long-running operation (rewrite, humanize, assess, maximize, reconstruct) uses SSE streaming. Buttons go disabled + 0.6 opacity in flight, and re-enable in `finally{}`.
- The "X% HUMAN" GPTZero score is shown on every text-producing box (input, output, humanizer style, humanizer output) and updated automatically after every transformation.
- The floating green ACTION button in the input box and red ACTION button in the output box exist because users were forgetting that mode buttons require a double-click. They trigger the currently selected mode.
- Mode buttons require DOUBLE-CLICK to activate (legacy quirk). Single-click only selects. The ACTION buttons bypass this.
- The CLEAR ALL button in the top header wipes every text box and resets every detection score after a confirmation prompt — protect against accidental loss.
- Universal 2000-word chunking applies to every batch operation as of October 2025. The CC engine uses 500-word chunks (intentionally tighter for coherence). Do not "harmonize" these — they serve different purposes.

================================================================================ PART 12: SESSION & SECURITY MODEL

- Sessions: Flask filesystem sessions, 24-hour lifetime, signed with `SESSION_SECRET`.
- Flask-Login: `User.query.get(int(user_id))` resolves the session user; protected routes call `current_user.is_authenticated`.
- CC reconstruction owner check: `_current_user_id_for_reconstruction()` returns `str(session.user_id or session._user_id or 'anonymous')`. The same value is written to `reconstruction_jobs.user_id` on create; status/result endpoints compare and 404 on mismatch.
- File uploads: `allowed_file()` whitelist; `MAX_CONTENT_LENGTH = 300 MB`; uploads land in `/uploads/` and are extracted then cleaned.
- API keys are env-only. The `api_key` table exists for future per-user keys but is unused. Do NOT log raw API keys (already enforced in `api_key_manager` log lines, which print counts only).

================================================================================ PART 13: RECENT CHANGES (CHRONOLOGICAL)

May 19, 2026 — Cross-Chunk Coherence (CC) reconstruction system added. New file `reconstruction_engine.py` implements three-pass architecture (skeleton → constrained chunks → stitch+assemble) with all state in Neon Postgres (`reconstruction_jobs`, `reconstruction_chunks`). New routes `/reconstruction/start_stream` (SSE), `/reconstruction/status/<job_id>` (owner-only), `/reconstruction/result/<job_id>` (owner-only). New UI button `RECONSTRUCT (LONG DOC, COHERENT)` in the left action column. Owner-based access control, strict failure semantics (any chunk failure → job failed), and `NEON_DATABASE_URL` fallback added per architectural review. Schema initialized at boot via `init_reconstruction_schema()`.

May 18, 2026 — Venice AI provider integrated. `VENICE_API_KEY` loaded in `api_key_manager.py`; `process_with_venice()` method added to `MultiProviderProcessor` calling `https://api.venice.ai/api/v1/chat/completions` with `llama-3.3-70b`. Added as the 5th option in the humanizer provider dropdown.

October 21, 2025 — ACTION buttons (green in input, red in output) added for users unaware that mode buttons need double-clicking. Document upload fix for Content Source and Critique boxes (now correctly hit `/api/content_source/upload` and `/extract_text`). Absolute 4-sentence paragraph limit enforced via post-processing in `force_paragraph_formatting()`. ONE CLICK REWRITE fixed (was hitting outdated `/process`; now uses `/customized_rewrite_stream` with 2000-word chunking). Universal 2000-word chunking standardized across all batch operations. Forced paragraph formatting (blank line every 3-5 sentences) added to all prompts AND enforced via post-processing. Prominent red CLEAR ALL button added to header. Devil's Advocate / Convert to Fiction / Convert to Non-Fiction buttons fixed (were hitting non-existent `/process`; now use `/customized_rewrite_stream`).
