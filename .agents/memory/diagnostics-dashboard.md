---
name: Diagnostics dashboard
description: One-button synthetic diagnostic that verifies every API key and core function
---

There is a one-click self-test page at `/diagnostics` (backed by `diagnostics.py` + `/run_diagnostics`).

It runs ~21 checks in parallel: live calls to every AI provider (OpenAI, Anthropic, Perplexity, DeepSeek, Venice, Azure OpenAI), every service (GPTZero, ElevenLabs, Azure Speech, Deepgram, Gladia, Mathpix, SendGrid), plus internal functions (markdown cleaner, paragraph formatter, txt/docx/pdf export, file-processing libs, DB, key manager).

**How to apply:** When the user reports "nothing works" or a specific provider is failing, run this first to isolate which keys/functions are actually broken instead of guessing. `/run_diagnostics` is POST-only with a 15s global cooldown (429 on rapid re-run) because each run makes paid provider calls.
