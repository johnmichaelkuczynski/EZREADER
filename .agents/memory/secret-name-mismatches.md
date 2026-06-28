---
name: Secret name mismatches
description: Env secret names may not match the variable name the code reads
---

Secrets provided in this environment can use shortened/different names than the code expects.

**Why:** ElevenLabs broke because the secret is `ELEVEN_API_KEY` but `elevenlabs_tts.py` read `ELEVENLABS_API_KEY`. The key was valid; the name was wrong. Fixed with an `or` fallback.

**How to apply:** When a provider fails with "missing/empty key" but the secret clearly exists, compare the exact env var name the code reads against the actual secret name. Add a fallback (`os.environ.get("A") or os.environ.get("B")`) rather than assuming the key is bad.
