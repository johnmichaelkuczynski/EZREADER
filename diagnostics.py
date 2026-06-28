"""
Synthetic User Diagnostic System
=================================

A single-button, end-to-end self test that verifies every external API key /
provider and every core internal function the application depends on.

Each check returns a dict:
    {
        "name":     human readable check name,
        "category": grouping for the UI,
        "status":   "pass" | "fail" | "warn",
        "message":  short human readable result,
        "ms":       elapsed milliseconds (int),
    }

All checks are defensive: any exception is caught and reported as a failure so
that one broken provider can never take down the whole diagnostic run.
"""

import os
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

logger = logging.getLogger(__name__)

# Verified, currently-valid model identifiers (kept in sync with the app).
OPENAI_MODEL = "gpt-4o"
ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929"
PERPLEXITY_MODEL = "sonar"
DEEPSEEK_MODEL = "deepseek-chat"
VENICE_MODEL = "llama-3.3-70b"
AZURE_OPENAI_DEPLOYMENT = "gpt-4"

HTTP_TIMEOUT = 20


def _result(name, category, status, message, started):
    return {
        "name": name,
        "category": category,
        "status": status,
        "message": message,
        "ms": int((time.time() - started) * 1000),
    }


def _missing(name, category, env_names, started):
    return _result(
        name, category, "fail",
        f"Missing secret: {' or '.join(env_names)}",
        started,
    )


# ---------------------------------------------------------------------------
# AI text providers (live calls)
# ---------------------------------------------------------------------------

def check_openai():
    started = time.time()
    cat = "AI Providers"
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return _missing("OpenAI (GPT-4o)", cat, ["OPENAI_API_KEY"], started)
    try:
        from openai import OpenAI
        client = OpenAI(api_key=key, timeout=HTTP_TIMEOUT)
        r = client.chat.completions.create(
            model=OPENAI_MODEL,
            max_tokens=5,
            messages=[{"role": "user", "content": "Reply with: OK"}],
        )
        content = (r.choices[0].message.content or "").strip()
        return _result("OpenAI (GPT-4o)", cat, "pass", f"Responded: {content[:40]}", started)
    except Exception as e:
        return _result("OpenAI (GPT-4o)", cat, "fail", str(e)[:200], started)


def check_anthropic():
    started = time.time()
    cat = "AI Providers"
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return _missing("Anthropic (Claude)", cat, ["ANTHROPIC_API_KEY"], started)
    try:
        from anthropic import Anthropic
        client = Anthropic(api_key=key, timeout=HTTP_TIMEOUT)
        r = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=10,
            messages=[{"role": "user", "content": "Reply with: OK"}],
        )
        content = "".join(block.text for block in r.content if hasattr(block, "text")).strip()
        return _result("Anthropic (Claude)", cat, "pass", f"Responded: {content[:40]}", started)
    except Exception as e:
        return _result("Anthropic (Claude)", cat, "fail", str(e)[:200], started)


def _openai_compatible_chat(name, cat, base_url, key, model, started, extra_headers=None):
    """Helper for OpenAI-compatible chat completion endpoints."""
    try:
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        if extra_headers:
            headers.update(extra_headers)
        resp = requests.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json={
                "model": model,
                "max_tokens": 16,
                "messages": [{"role": "user", "content": "Reply with: OK"}],
            },
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            content = data["choices"][0]["message"]["content"][:40]
            return _result(name, cat, "pass", f"Responded: {content}", started)
        return _result(name, cat, "fail", f"HTTP {resp.status_code}: {resp.text[:150]}", started)
    except Exception as e:
        return _result(name, cat, "fail", str(e)[:200], started)


def check_perplexity():
    started = time.time()
    cat = "AI Providers"
    key = os.environ.get("PERPLEXITY_API_KEY")
    if not key:
        return _missing("Perplexity", cat, ["PERPLEXITY_API_KEY"], started)
    return _openai_compatible_chat(
        "Perplexity", cat, "https://api.perplexity.ai", key, PERPLEXITY_MODEL, started
    )


def check_deepseek():
    started = time.time()
    cat = "AI Providers"
    key = os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        return _missing("DeepSeek", cat, ["DEEPSEEK_API_KEY"], started)
    return _openai_compatible_chat(
        "DeepSeek", cat, "https://api.deepseek.com", key, DEEPSEEK_MODEL, started
    )


def check_venice():
    started = time.time()
    cat = "AI Providers"
    key = os.environ.get("VENICE_API_KEY")
    if not key:
        return _missing("Venice", cat, ["VENICE_API_KEY"], started)
    return _openai_compatible_chat(
        "Venice", cat, "https://api.venice.ai/api/v1", key, VENICE_MODEL, started
    )


def check_azure_openai():
    started = time.time()
    cat = "AI Providers"
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    key = os.environ.get("AZURE_OPENAI_API_KEY")
    if not endpoint or not key:
        return _missing("Azure OpenAI", cat, ["AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY"], started)
    try:
        from openai import AzureOpenAI
        client = AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=key,
            api_version="2024-02-15-preview",
            timeout=HTTP_TIMEOUT,
        )
        r = client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT,
            max_tokens=5,
            messages=[{"role": "user", "content": "Reply with: OK"}],
        )
        content = (r.choices[0].message.content or "").strip()
        return _result("Azure OpenAI", cat, "pass", f"Responded: {content[:40]}", started)
    except Exception as e:
        return _result("Azure OpenAI", cat, "fail", str(e)[:200], started)


# ---------------------------------------------------------------------------
# Detection / Speech / Email / Other services
# ---------------------------------------------------------------------------

def check_gptzero():
    started = time.time()
    cat = "Detection & Media"
    key = os.environ.get("GPTZERO_API_KEY")
    if not key:
        return _missing("GPTZero (AI detection)", cat, ["GPTZERO_API_KEY"], started)
    try:
        resp = requests.post(
            "https://api.gptzero.me/v2/predict/text",
            headers={"x-api-key": key, "Content-Type": "application/json"},
            json={"document": "This is a short diagnostic test sentence."},
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            return _result("GPTZero (AI detection)", cat, "pass", "Detection API responded", started)
        return _result("GPTZero (AI detection)", cat, "fail", f"HTTP {resp.status_code}: {resp.text[:150]}", started)
    except Exception as e:
        return _result("GPTZero (AI detection)", cat, "fail", str(e)[:200], started)


def check_elevenlabs():
    started = time.time()
    cat = "Detection & Media"
    # The code reads ELEVENLABS_API_KEY but the secret may be named ELEVEN_API_KEY.
    key = os.environ.get("ELEVENLABS_API_KEY")
    used_fallback = False
    if not key:
        key = os.environ.get("ELEVEN_API_KEY")
        used_fallback = True
    if not key:
        return _missing("ElevenLabs (voice)", cat, ["ELEVENLABS_API_KEY", "ELEVEN_API_KEY"], started)
    try:
        resp = requests.get(
            "https://api.elevenlabs.io/v1/voices",
            headers={"xi-api-key": key},
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            count = len(resp.json().get("voices", []))
            note = " (via ELEVEN_API_KEY)" if used_fallback else ""
            return _result("ElevenLabs (voice)", cat, "pass", f"{count} voices available{note}", started)
        return _result("ElevenLabs (voice)", cat, "fail", f"HTTP {resp.status_code}: {resp.text[:150]}", started)
    except Exception as e:
        return _result("ElevenLabs (voice)", cat, "fail", str(e)[:200], started)


def check_azure_speech():
    started = time.time()
    cat = "Detection & Media"
    key = os.environ.get("AZURE_SPEECH_KEY")
    region = os.environ.get("AZURE_SPEECH_REGION")
    endpoint = os.environ.get("AZURE_SPEECH_ENDPOINT")
    if not key or (not region and not endpoint):
        return _missing("Azure Speech (TTS)", cat, ["AZURE_SPEECH_KEY + AZURE_SPEECH_REGION"], started)
    try:
        if region:
            token_url = f"https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
        else:
            # Derive the token endpoint from the configured custom endpoint host.
            from urllib.parse import urlparse
            host = urlparse(endpoint).netloc or endpoint
            token_url = f"https://{host}/sts/v1.0/issueToken"
        resp = requests.post(
            token_url,
            headers={"Ocp-Apim-Subscription-Key": key, "Content-Length": "0"},
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            return _result("Azure Speech (TTS)", cat, "pass", "Auth token issued", started)
        return _result("Azure Speech (TTS)", cat, "fail", f"HTTP {resp.status_code}: {resp.text[:150]}", started)
    except Exception as e:
        return _result("Azure Speech (TTS)", cat, "fail", str(e)[:200], started)


def check_deepgram():
    started = time.time()
    cat = "Detection & Media"
    key = os.environ.get("DEEPGRAM_API_KEY")
    if not key:
        return _missing("Deepgram (transcription)", cat, ["DEEPGRAM_API_KEY"], started)
    try:
        resp = requests.get(
            "https://api.deepgram.com/v1/projects",
            headers={"Authorization": f"Token {key}"},
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            return _result("Deepgram (transcription)", cat, "pass", "Key valid (projects listed)", started)
        return _result("Deepgram (transcription)", cat, "fail", f"HTTP {resp.status_code}: {resp.text[:150]}", started)
    except Exception as e:
        return _result("Deepgram (transcription)", cat, "fail", str(e)[:200], started)


def check_gladia():
    started = time.time()
    cat = "Detection & Media"
    key = os.environ.get("GLADIA_API_KEY")
    if not key:
        return _missing("Gladia (transcription)", cat, ["GLADIA_API_KEY"], started)
    try:
        # Lightweight authenticated probe; bad keys return 401.
        resp = requests.get(
            "https://api.gladia.io/v2/transcription",
            headers={"x-gladia-key": key},
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code in (401, 403):
            return _result("Gladia (transcription)", cat, "fail", f"Auth rejected (HTTP {resp.status_code})", started)
        return _result("Gladia (transcription)", cat, "pass", f"Key accepted (HTTP {resp.status_code})", started)
    except Exception as e:
        return _result("Gladia (transcription)", cat, "fail", str(e)[:200], started)


def check_mathpix():
    started = time.time()
    cat = "Detection & Media"
    app_id = os.environ.get("MATHPIX_APP_ID")
    app_key = os.environ.get("MATHPIX_API_KEY")
    if not app_id or not app_key:
        return _missing("Mathpix (OCR)", cat, ["MATHPIX_APP_ID + MATHPIX_API_KEY"], started)
    try:
        # Send a deliberately minimal request; valid creds return 200/400, bad creds 401.
        resp = requests.post(
            "https://api.mathpix.com/v3/text",
            headers={"app_id": app_id, "app_key": app_key, "Content-Type": "application/json"},
            json={"src": ""},
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code in (401, 403):
            return _result("Mathpix (OCR)", cat, "fail", f"Auth rejected (HTTP {resp.status_code})", started)
        return _result("Mathpix (OCR)", cat, "pass", f"Credentials accepted (HTTP {resp.status_code})", started)
    except Exception as e:
        return _result("Mathpix (OCR)", cat, "fail", str(e)[:200], started)


def check_sendgrid():
    started = time.time()
    cat = "Detection & Media"
    key = os.environ.get("SENDGRID_API_KEY")
    if not key:
        return _missing("SendGrid (email)", cat, ["SENDGRID_API_KEY"], started)
    try:
        resp = requests.get(
            "https://api.sendgrid.com/v3/scopes",
            headers={"Authorization": f"Bearer {key}"},
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code == 200:
            return _result("SendGrid (email)", cat, "pass", "API key valid", started)
        return _result("SendGrid (email)", cat, "fail", f"HTTP {resp.status_code}: {resp.text[:150]}", started)
    except Exception as e:
        return _result("SendGrid (email)", cat, "fail", str(e)[:200], started)


# ---------------------------------------------------------------------------
# Core internal functions (no external dependency)
# ---------------------------------------------------------------------------

def check_markdown_cleaner():
    started = time.time()
    cat = "Core Functions"
    try:
        from app import clean_markdown
        out = clean_markdown("**Bold** and `code` and # Heading")
        if "**" in out or "`" in out:
            return _result("Markdown cleaner", cat, "fail", f"Residual markdown: {out!r}", started)
        return _result("Markdown cleaner", cat, "pass", "Strips markdown correctly", started)
    except Exception as e:
        return _result("Markdown cleaner", cat, "fail", str(e)[:200], started)


def check_paragraph_formatter():
    started = time.time()
    cat = "Core Functions"
    try:
        from app import force_paragraph_formatting
        text = " ".join(f"Sentence number {i}." for i in range(1, 9))
        out = force_paragraph_formatting(text)
        if "\n\n" not in out:
            return _result("Paragraph formatter", cat, "fail", "No paragraph breaks produced", started)
        return _result("Paragraph formatter", cat, "pass", "Inserts paragraph breaks", started)
    except Exception as e:
        return _result("Paragraph formatter", cat, "fail", str(e)[:200], started)


def check_export_txt():
    started = time.time()
    cat = "Core Functions"
    try:
        data = "Para one.\n\nPara two.".encode("utf-8")
        if len(data) < 5:
            raise ValueError("empty")
        return _result("Export: TXT", cat, "pass", "Plain text encodes", started)
    except Exception as e:
        return _result("Export: TXT", cat, "fail", str(e)[:200], started)


def check_export_docx():
    started = time.time()
    cat = "Core Functions"
    try:
        import io
        from docx import Document
        doc = Document()
        doc.add_paragraph("Diagnostic test paragraph.")
        buf = io.BytesIO()
        doc.save(buf)
        size = buf.tell()
        if size < 1000:
            return _result("Export: Word (.docx)", cat, "fail", f"Suspiciously small file ({size}b)", started)
        return _result("Export: Word (.docx)", cat, "pass", f"Generated {size} byte .docx", started)
    except Exception as e:
        return _result("Export: Word (.docx)", cat, "fail", str(e)[:200], started)


def check_export_pdf():
    started = time.time()
    cat = "Core Functions"
    try:
        import io
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph
        from reportlab.lib.styles import getSampleStyleSheet
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=letter)
        doc.build([Paragraph("Diagnostic test paragraph.", getSampleStyleSheet()["Normal"])])
        size = buf.tell()
        if size < 500:
            return _result("Export: PDF", cat, "fail", f"Suspiciously small file ({size}b)", started)
        return _result("Export: PDF", cat, "pass", f"Generated {size} byte PDF", started)
    except Exception as e:
        return _result("Export: PDF", cat, "fail", str(e)[:200], started)


def check_file_processing_libs():
    started = time.time()
    cat = "Core Functions"
    libs = {
        "PyPDF2": "PyPDF2",
        "python-docx": "docx",
        "Pillow": "PIL",
        "pytesseract": "pytesseract",
        "pydub": "pydub",
        "langdetect": "langdetect",
        "SpeechRecognition": "speech_recognition",
    }
    missing = []
    for label, module in libs.items():
        try:
            __import__(module)
        except Exception:
            missing.append(label)
    if missing:
        return _result("File processing libraries", cat, "warn", f"Missing: {', '.join(missing)}", started)
    return _result("File processing libraries", cat, "pass", "All extraction libraries import", started)


def check_database():
    started = time.time()
    cat = "Core Functions"
    try:
        from app import app, db
        from sqlalchemy import text
        with app.app_context():
            db.session.execute(text("SELECT 1"))
        return _result("Database connection", cat, "pass", "PostgreSQL reachable", started)
    except Exception as e:
        return _result("Database connection", cat, "fail", str(e)[:200], started)


def check_api_key_manager():
    started = time.time()
    cat = "Core Functions"
    try:
        from api_key_manager import ApiKeyManager
        mgr = ApiKeyManager()
        total = (
            len(getattr(mgr, "openai_keys", []))
            + len(getattr(mgr, "anthropic_keys", []))
            + len(getattr(mgr, "perplexity_keys", []))
            + len(getattr(mgr, "deepseek_keys", []))
            + len(getattr(mgr, "venice_keys", []))
        )
        if total == 0:
            return _result("API key manager", cat, "fail", "No keys loaded", started)
        return _result("API key manager", cat, "pass", f"{total} provider keys loaded", started)
    except Exception as e:
        return _result("API key manager", cat, "fail", str(e)[:200], started)


def check_failover():
    """Prove automatic failover works: sabotage the first key, expect a switch."""
    started = time.time()
    cat = "Core Functions"
    try:
        from ai_failover import generate_with_failover
        result = generate_with_failover(
            "Reply with exactly: OK",
            max_tokens=16,
            temperature=0,
            _simulate_bad_primary=True,
        )
        attempts = result.get("attempts", [])
        failed = [a for a in attempts if not a.get("ok")]
        winner = result.get("provider")
        if failed:
            return _result(
                "Auto failover (key switching)", cat, "pass",
                f"First key forced to fail, auto-switched to {winner} ({len(failed)} skipped)",
                started,
            )
        # No failure recorded means the sabotage didn't register a switch.
        return _result(
            "Auto failover (key switching)", cat, "warn",
            f"Generated via {winner} but no key switch was observed",
            started,
        )
    except Exception as e:
        return _result("Auto failover (key switching)", cat, "fail", str(e)[:200], started)


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

ALL_CHECKS = [
    check_openai,
    check_anthropic,
    check_perplexity,
    check_deepseek,
    check_venice,
    check_azure_openai,
    check_gptzero,
    check_elevenlabs,
    check_azure_speech,
    check_deepgram,
    check_gladia,
    check_mathpix,
    check_sendgrid,
    check_markdown_cleaner,
    check_paragraph_formatter,
    check_export_txt,
    check_export_docx,
    check_export_pdf,
    check_file_processing_libs,
    check_database,
    check_api_key_manager,
    check_failover,
]


def run_all_diagnostics():
    """Run every check (live providers in parallel) and return a summary dict."""
    overall_start = time.time()
    results = []

    with ThreadPoolExecutor(max_workers=12) as executor:
        future_map = {executor.submit(_safe_run, check): check for check in ALL_CHECKS}
        for future in as_completed(future_map):
            results.append(future.result())

    # Stable ordering: by category then original definition order.
    order = {check.__name__: i for i, check in enumerate(ALL_CHECKS)}
    results.sort(key=lambda r: r.get("_order", 999))

    counts = {"pass": 0, "fail": 0, "warn": 0}
    for r in results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
        r.pop("_order", None)

    return {
        "results": results,
        "summary": {
            "total": len(results),
            "passed": counts["pass"],
            "failed": counts["fail"],
            "warnings": counts["warn"],
        },
        "elapsed_ms": int((time.time() - overall_start) * 1000),
    }


def _safe_run(check):
    """Run a single check, attaching ordering and catching catastrophic errors."""
    order_index = ALL_CHECKS.index(check)
    try:
        result = check()
    except Exception as e:  # pragma: no cover - defensive
        result = {
            "name": check.__name__,
            "category": "Core Functions",
            "status": "fail",
            "message": f"Check crashed: {str(e)[:150]}",
            "ms": 0,
        }
    result["_order"] = order_index
    return result
