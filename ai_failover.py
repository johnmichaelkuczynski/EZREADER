"""
Unified AI text generation with automatic key + provider failover.

If one API key fails (bad key, rate limit, quota, outage), this automatically
switches to the next key for that provider, and if every key for a provider
fails, it moves on to the next provider entirely. The app only errors out if
EVERY key of EVERY provider fails.

Keys and their health (cooldowns / failure counts) are tracked by the shared
ApiKeyManager singleton so repeated failures are skipped on later calls.
"""

import os
import json
import time
import logging

from api_key_manager import api_key_manager

logger = logging.getLogger(__name__)

# Model id used for each provider (verified working ids).
PROVIDER_MODELS = {
    "openai": "gpt-4o",
    "anthropic": "claude-sonnet-4-5-20250929",
    "deepseek": "deepseek-chat",
    "perplexity": "sonar",
    "venice": "llama-3.3-70b",
    "azure": "gpt-4",
}

# Max output tokens each provider can safely handle.
PROVIDER_MAX_TOKENS = {
    "openai": 16000,
    "anthropic": 16000,
    "azure": 16000,
    "deepseek": 8000,
    "perplexity": 4000,
    "venice": 4000,
}

# Base URLs for the OpenAI-compatible providers.
PROVIDER_BASE_URLS = {
    "deepseek": "https://api.deepseek.com",
    "perplexity": "https://api.perplexity.ai",
}

# Default order to try providers in (most reliable / capable first).
DEFAULT_ORDER = ["openai", "anthropic", "deepseek", "azure", "venice", "perplexity"]

REQUEST_TIMEOUT = 120


def _call_openai_compatible(api_key, base_url, model, prompt, system, max_tokens, temperature):
    from openai import OpenAI
    client = OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI(api_key=api_key)
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    resp = client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return resp.choices[0].message.content


def _call_anthropic(api_key, model, prompt, system, max_tokens, temperature):
    from anthropic import Anthropic
    client = Anthropic(api_key=api_key)
    kwargs = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        kwargs["system"] = system
    resp = client.messages.create(**kwargs)
    return resp.content[0].text


def _call_venice(api_key, model, prompt, system, max_tokens, temperature):
    import requests
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    data = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    r = requests.post(
        "https://api.venice.ai/api/v1/chat/completions",
        headers=headers,
        data=json.dumps(data),
        timeout=REQUEST_TIMEOUT,
    )
    if r.status_code != 200:
        raise Exception(f"Venice API error {r.status_code}: {r.text[:200]}")
    return r.json()["choices"][0]["message"]["content"]


def _call_azure(prompt, system, max_tokens, temperature):
    from openai import AzureOpenAI
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    key = os.environ.get("AZURE_OPENAI_API_KEY")
    if not endpoint or not key:
        raise Exception("Azure OpenAI not configured")
    client = AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=key,
        api_version="2024-02-15-preview",
    )
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    resp = client.chat.completions.create(
        model=PROVIDER_MODELS["azure"],
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return resp.choices[0].message.content


def _dispatch(provider, api_key, prompt, system, max_tokens, temperature):
    """Route a single generation attempt to the right provider client."""
    model = PROVIDER_MODELS[provider]
    eff_tokens = min(max_tokens, PROVIDER_MAX_TOKENS.get(provider, 4000))

    if provider == "openai":
        return _call_openai_compatible(api_key, None, model, prompt, system, eff_tokens, temperature)
    if provider in ("deepseek", "perplexity"):
        return _call_openai_compatible(
            api_key, PROVIDER_BASE_URLS[provider], model, prompt, system, eff_tokens, temperature
        )
    if provider == "anthropic":
        return _call_anthropic(api_key, model, prompt, system, eff_tokens, temperature)
    if provider == "venice":
        return _call_venice(api_key, model, prompt, system, eff_tokens, temperature)
    if provider == "azure":
        return _call_azure(prompt, system, eff_tokens, temperature)
    raise ValueError(f"Unsupported provider: {provider}")


def _provider_keys(provider):
    """Return [(key_id, api_key)] for a provider, available (not in cooldown) first."""
    now = time.time()
    items = []
    for key_id, status in api_key_manager.key_status.items():
        if status["provider"] == provider:
            healthy = status["available"] and now > status["cooldown_until"]
            items.append((key_id, status["key"], healthy))
    # Healthy keys first, but still keep cooled-down keys as a last resort.
    items.sort(key=lambda x: 0 if x[2] else 1)
    return [(kid, key) for kid, key, _ in items]


def generate_with_failover(
    prompt,
    system=None,
    max_tokens=4000,
    temperature=0.7,
    preferred_order=None,
    _simulate_bad_primary=False,
):
    """
    Generate text, automatically switching keys/providers on any failure.

    Returns a dict: {"text", "provider", "key_id", "attempts"}.
    Raises RuntimeError only if every key of every provider fails.

    _simulate_bad_primary: for diagnostics only - forces the very first attempt
    to use a deliberately invalid key so failover can be observed end to end.
    """
    order = preferred_order or DEFAULT_ORDER
    attempts = []
    last_error = None
    force_bad = _simulate_bad_primary

    for provider in order:
        if provider == "azure":
            if not (os.environ.get("AZURE_OPENAI_ENDPOINT") and os.environ.get("AZURE_OPENAI_API_KEY")):
                continue
            keylist = [("azure_env", os.environ.get("AZURE_OPENAI_API_KEY"))]
        else:
            keylist = _provider_keys(provider)

        for key_id, api_key in keylist:
            use_key = api_key
            sabotaged = False
            if force_bad:
                use_key = "sk-INVALID-FAILOVER-SELFTEST"
                force_bad = False  # only sabotage the first attempt
                sabotaged = True

            try:
                text = _dispatch(provider, use_key, prompt, system, max_tokens, temperature)
                if not text or not text.strip():
                    raise Exception("Empty response from provider")
                if provider != "azure":
                    api_key_manager.reset_key_failure(key_id)
                attempts.append({"provider": provider, "key_id": key_id, "ok": True})
                logger.info(f"Failover: generated with {provider} (key {key_id}) after {len(attempts)} attempt(s)")
                return {"text": text, "provider": provider, "key_id": key_id, "attempts": attempts}
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Failover: {provider} key {key_id} failed: {str(e)[:200]}")
                # Never penalize a real key for a deliberately sabotaged self-test attempt.
                if provider != "azure" and not sabotaged:
                    api_key_manager.mark_key_unavailable(key_id)
                attempts.append({
                    "provider": provider, "key_id": key_id, "ok": False,
                    "error": str(e)[:200], "simulated": sabotaged,
                })
                continue

    raise RuntimeError(f"All providers failed. Last error: {last_error}")
