---
name: AI provider model identifiers
description: The app pins exact model IDs per provider; retired IDs cause hard failures even when API keys are valid.
---

# AI provider model identifiers

Every AI feature pins an exact model ID in code (not "latest" aliases). When a provider retires a model, calls return 404/invalid-model errors even though the API key is valid — this looks like "the app is broken / keys not working" but is actually a stale model name.

**Why:** Anthropic returned `404 not_found_error model: claude-3-5-sonnet-20241022`; Perplexity returned `invalid_model llama-3.1-sonar-*-128k-online`. Keys were fine. The original project's model IDs had aged out.

**How to apply:** When AI features fail, first curl the provider's models-list endpoint with the live key to see what IS available, confirm one works with a tiny test call, then mass-replace the model string across ALL files (it appears in many: app.py, multi_provider_processor*.py, simple_translation.py, style_rewrite_passthrough.py, rewrite_enhancer.py, reconstruction_engine.py, ai_processor.py). Working IDs verified for this key set:
- Anthropic sonnet tier: `claude-sonnet-4-5-20250929`; opus tier: `claude-opus-4-5-20251101`
- OpenAI: `gpt-4o` still valid
- Perplexity: `sonar` (old `llama-3.1-sonar-*` retired)
- DeepSeek: `deepseek-chat` valid
- Venice: `llama-3.3-70b` valid
