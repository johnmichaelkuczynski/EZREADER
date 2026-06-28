---
name: AI failover (key + provider switching)
description: How automatic key/provider failover works and the diagnostic self-test trap
---

`ai_failover.generate_with_failover()` is the single entry point for resilient text generation. It iterates providers in a preferred order and, per provider, tries every key from the `api_key_manager` singleton (healthy keys first, cooled-down keys as last resort). Success → `reset_key_failure`; failure → `mark_key_unavailable`; raises only when every key of every provider fails. Endpoints route through it instead of instantiating a single-key client.

**Why:** Previously each endpoint called one provider with one key via `os.environ.get(...)` and no fallback, so a single bad/rate-limited key killed the feature — the source of "nothing works".

**How to apply:** When adding/modifying a generation endpoint, call `generate_with_failover` rather than a direct client. Per-provider `max_tokens` caps live in `PROVIDER_MAX_TOKENS`; verified model ids in `PROVIDER_MODELS`.

**Self-test trap:** The diagnostic uses `_simulate_bad_primary=True` to force the first attempt to fail. That sabotaged attempt must NOT call `mark_key_unavailable`, or repeated diagnostic runs will progressively poison healthy keys. The sabotaged attempt is flagged and skips health mutation. Any future change to the self-test must preserve this.
