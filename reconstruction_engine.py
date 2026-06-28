"""
Cross-Chunk Coherence (CC) Reconstruction Engine

Three-pass architecture for coherent long-document generation:
  PASS 1: Global skeleton extraction (thesis, outline, key terms, commitments)
  PASS 2: Constrained chunk-by-chunk processing with length enforcement
  PASS 3: Global consistency stitch + final assembly

All intermediate state stored in Neon Postgres (DATABASE_URL).
"""

import os
import re
import math
import json
import time
import logging
import uuid
from typing import Dict, List, Optional, Tuple, Generator

import psycopg2
from psycopg2.extras import RealDictCursor, Json
import anthropic

logger = logging.getLogger(__name__)

ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929"
CHUNK_SIZE_WORDS = 500
SKELETON_MAX_TOKENS = 3000
CHUNK_MAX_TOKENS = 4000
STITCH_MAX_TOKENS = 2000
INTER_CHUNK_DELAY = 3
RETRY_DELAY = 5


# ─────────────────────────────────────────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────────────────────────────────────────

def get_db_connection():
    """Open a fresh connection to the Neon Postgres database.
    Accepts either NEON_DATABASE_URL or DATABASE_URL (matches app.py)."""
    url = os.environ.get("NEON_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("Neither NEON_DATABASE_URL nor DATABASE_URL is set")
    return psycopg2.connect(url)


def init_reconstruction_schema():
    """Create reconstruction_jobs and reconstruction_chunks tables if missing."""
    ddl = """
    CREATE TABLE IF NOT EXISTS reconstruction_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT,
        document_title TEXT,
        original_text TEXT,
        total_input_words INTEGER,
        target_min_words INTEGER,
        target_max_words INTEGER,
        target_mid_words INTEGER,
        length_ratio DECIMAL,
        length_mode TEXT,
        num_chunks INTEGER,
        chunk_target_words INTEGER,
        global_skeleton JSONB,
        custom_instructions TEXT,
        status TEXT DEFAULT 'pending',
        current_chunk INTEGER DEFAULT 0,
        final_output TEXT,
        final_word_count INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reconstruction_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID REFERENCES reconstruction_jobs(id) ON DELETE CASCADE,
        chunk_index INTEGER,
        chunk_input_text TEXT,
        chunk_input_words INTEGER,
        target_words INTEGER,
        min_words INTEGER,
        max_words INTEGER,
        chunk_output_text TEXT,
        actual_words INTEGER,
        chunk_delta JSONB,
        retry_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_rj_status ON reconstruction_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_rc_job_id ON reconstruction_chunks(job_id);
    CREATE INDEX IF NOT EXISTS idx_rc_index ON reconstruction_chunks(job_id, chunk_index);
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(ddl)
        conn.commit()
    logger.info("Reconstruction schema initialized in Neon Postgres")


def _exec(sql: str, params: tuple = (), fetch: str = None):
    """Execute SQL. fetch: None | 'one' | 'all'."""
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            if fetch == "one":
                row = cur.fetchone()
                conn.commit()
                return row
            elif fetch == "all":
                rows = cur.fetchall()
                conn.commit()
                return rows
            conn.commit()
            return None


# ─────────────────────────────────────────────────────────────────────────────
# LENGTH PARSING & MODE
# ─────────────────────────────────────────────────────────────────────────────

def count_words(text: str) -> int:
    return len(text.split()) if text else 0


def parse_target_length(instructions: str, input_words: int) -> Tuple[int, int]:
    """Parse user's length request from custom instructions.
    Returns (target_min, target_max)."""
    if not instructions:
        return (input_words, input_words)
    text = instructions.lower()

    # "X-Y words" range
    m = re.search(r"(\d{2,6})\s*[-–]\s*(\d{2,6})\s*words?", text)
    if m:
        return (int(m.group(1)), int(m.group(2)))

    # "at least X words"
    m = re.search(r"at\s+least\s+(\d{2,6})\s*words?", text)
    if m:
        n = int(m.group(1))
        return (n, int(n * 1.3))

    # "no more than X words" / "at most X words"
    m = re.search(r"(?:no\s+more\s+than|at\s+most|up\s+to)\s+(\d{2,6})\s*words?", text)
    if m:
        n = int(m.group(1))
        return (int(n * 0.7), n)

    # "approximately X words" / "about X words" / "around X words"
    m = re.search(r"(?:approximately|about|around|roughly|~)\s*(\d{2,6})\s*words?", text)
    if m:
        n = int(m.group(1))
        return (int(n * 0.9), int(n * 1.1))

    # plain "X words"
    m = re.search(r"(\d{2,6})\s*words?", text)
    if m:
        n = int(m.group(1))
        return (int(n * 0.9), int(n * 1.1))

    # heuristic verbs
    if re.search(r"\b(expand|enrich|elaborate|develop)\b", text):
        return (int(input_words * 1.3), int(input_words * 1.5))
    if re.search(r"\b(compress|summari[sz]e|shorten|condense)\b", text):
        return (int(input_words * 0.3), int(input_words * 0.5))

    return (input_words, input_words)


def get_length_mode(ratio: float) -> str:
    if ratio < 0.5: return "heavy_compression"
    if ratio < 0.8: return "moderate_compression"
    if ratio < 1.2: return "maintain"
    if ratio < 1.8: return "moderate_expansion"
    return "heavy_expansion"


LENGTH_GUIDANCE = {
    "heavy_compression": """LENGTH MODE: HEAVY COMPRESSION
You must significantly compress this chunk while preserving core arguments.
- Remove examples, keep only the most critical one
- Remove repetition and redundancy
- Convert detailed explanations to concise statements
- Preserve thesis statements and key claims verbatim
- Remove transitional phrases and rhetorical flourishes""",
    "moderate_compression": """LENGTH MODE: MODERATE COMPRESSION
Compress this chunk while preserving argument structure.
- Keep the strongest 1-2 examples, remove weaker ones
- Tighten prose without losing meaning
- Preserve all key claims and their primary support
- Remove redundancy but keep necessary emphasis""",
    "maintain": """LENGTH MODE: MAINTAIN LENGTH
Output should be approximately the same length as input.
- Improve clarity and coherence without changing length significantly
- Replace weak examples with stronger ones of similar length
- Restructure sentences for better flow
- Do not add or remove substantial content""",
    "moderate_expansion": """LENGTH MODE: MODERATE EXPANSION
Expand this chunk while maintaining focus.
- Add 1-2 supporting examples or evidence for key claims
- Elaborate on implications of major points
- Add transitional sentences to improve flow
- Expand terse statements into fuller explanations
- Do NOT add tangential content or padding""",
    "heavy_expansion": """LENGTH MODE: HEAVY EXPANSION
Significantly expand this chunk with substantive additions.
- Add 2-3 concrete examples (historical, empirical, or hypothetical)
- Elaborate on each major claim with supporting analysis
- Add relevant context and background
- Develop implications and consequences of arguments
- Add appropriate qualifications and nuances
- Do NOT add filler or padding — all additions must be substantive""",
}


# ─────────────────────────────────────────────────────────────────────────────
# CHUNKING
# ─────────────────────────────────────────────────────────────────────────────

def split_into_chunks(text: str, target_words: int = CHUNK_SIZE_WORDS) -> List[str]:
    """Split on paragraph boundaries, accumulating ~target_words per chunk."""
    paragraphs = re.split(r"\n\s*\n", text.strip())
    chunks: List[str] = []
    current: List[str] = []
    current_words = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        pw = count_words(para)
        # If single paragraph is larger than 1.5x target, sentence-split it
        if pw > target_words * 1.5:
            if current:
                chunks.append("\n\n".join(current))
                current = []
                current_words = 0
            sentences = re.split(r"(?<=[.!?])\s+", para)
            sub: List[str] = []
            sub_w = 0
            for s in sentences:
                sw = count_words(s)
                if sub_w + sw > target_words and sub:
                    chunks.append(" ".join(sub))
                    sub = [s]
                    sub_w = sw
                else:
                    sub.append(s)
                    sub_w += sw
            if sub:
                chunks.append(" ".join(sub))
            continue

        if current_words + pw > target_words and current:
            chunks.append("\n\n".join(current))
            current = [para]
            current_words = pw
        else:
            current.append(para)
            current_words += pw

    if current:
        chunks.append("\n\n".join(current))

    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# LLM CALL
# ─────────────────────────────────────────────────────────────────────────────

def _get_anthropic_client() -> anthropic.Anthropic:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    return anthropic.Anthropic(api_key=key)


def call_llm(prompt: str, max_tokens: int = 4000, system: str = "") -> str:
    client = _get_anthropic_client()
    msg = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=max_tokens,
        temperature=0.5,
        system=system or "You are a precise text reconstruction engine. Follow all instructions exactly.",
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(b.text for b in msg.content if hasattr(b, "text"))


# ─────────────────────────────────────────────────────────────────────────────
# PROMPT BUILDERS
# ─────────────────────────────────────────────────────────────────────────────

def build_skeleton_prompt(text: str) -> str:
    return f"""You are extracting a structural skeleton from a document. This skeleton will guide coherent processing of individual sections.

Extract the following (total must be under 2000 tokens). Return STRICT JSON with these keys: thesis, outline, key_terms, commitment_ledger, entities.

1. thesis (string, 1-3 sentences): The central argument or purpose.

2. outline (array of strings): 8-20 main sections/claims and their purposes.

3. key_terms (object): Mapping of TERM -> definition. Important terms with specific meanings as used in this document.

4. commitment_ledger (array of strings): What the document asserts, rejects, assumes. Format: "ASSERTS: X" / "REJECTS: Y" / "ASSUMES: Z".

5. entities (array of strings): People, organizations, technical terms requiring consistent reference.

Be precise. Preserve exact terminology. This skeleton constrains all downstream processing — errors here propagate everywhere.

Return ONLY valid JSON, no markdown fences, no preamble.

DOCUMENT TEXT:
{text}"""


def build_chunk_prompt(chunk_text: str, skeleton: dict, custom_instructions: str,
                       target_words: int, min_words: int, max_words: int,
                       length_guidance: str, total_chunks: int, chunk_index: int,
                       chunk_input_words: int) -> str:
    skeleton_str = json.dumps(skeleton, indent=2)
    return f"""You are processing one chunk of a larger document. You must maintain coherence with the document's established structure and commitments.

GLOBAL SKELETON (you must honor this):
{skeleton_str}

CUSTOM INSTRUCTIONS:
{custom_instructions or '(none provided)'}

*** OUTPUT LENGTH REQUIREMENT ***
This is chunk {chunk_index + 1} of {total_chunks}.
Original chunk: {chunk_input_words} words.

YOUR OUTPUT MUST BE: {min_words}-{max_words} words.
TARGET: approximately {target_words} words.

This is a HARD REQUIREMENT. Count your words before finalizing.

{length_guidance}
*** END LENGTH REQUIREMENT ***

CONSTRAINTS:
- Do NOT contradict any commitment in the skeleton.
- Use key terms EXACTLY as defined in the skeleton.
- If you detect a conflict, FLAG IT EXPLICITLY in the DELTA_REPORT.
- Preserve the chunk's contribution to the overall argument.
- MANDATORY PARAGRAPH FORMATTING: Maximum 4 sentences per paragraph. Always break with blank lines.
- Do NOT use the $ symbol anywhere in your output.

CHUNK TEXT:
{chunk_text}

Respond in EXACTLY this format (literal headers, nothing else before or after):

PROCESSED_TEXT:
[Your reconstructed chunk here, {min_words}-{max_words} words, properly paragraphed]

WORD_COUNT: [integer]

DELTA_REPORT:
{{"new_claims": [...], "terms_used": [...], "conflicts": "..." or "none"}}"""


def build_retry_expand_prompt(previous_output: str, actual_words: int,
                              target_words: int, min_words: int) -> str:
    need = max(target_words - actual_words, min_words - actual_words)
    return f"""Your previous output was {actual_words} words, but the target is at least {min_words} words (ideal {target_words}).

You need to ADD approximately {need} more words.

PREVIOUS OUTPUT:
{previous_output}

Expand this with:
- Additional examples or evidence
- More detailed explanations
- Elaboration on implications
- Transitional sentences

Do NOT add filler or padding. All additions must be substantive.
Maintain paragraph formatting (max 4 sentences per paragraph).
Do NOT use the $ symbol.

Respond in EXACTLY this format:

PROCESSED_TEXT:
[expanded version]

WORD_COUNT: [integer]

DELTA_REPORT:
{{"new_claims": [...], "terms_used": [...], "conflicts": "none"}}"""


def build_retry_compress_prompt(previous_output: str, actual_words: int,
                                target_words: int, max_words: int) -> str:
    remove = actual_words - target_words
    return f"""Your previous output was {actual_words} words, but the target is at most {max_words} words (ideal {target_words}).

You need to REMOVE approximately {remove} words.

PREVIOUS OUTPUT:
{previous_output}

Compress by:
- Removing weaker examples
- Tightening prose
- Eliminating redundancy
- Converting detailed explanations to concise statements

Preserve all key claims and the core argument.
Maintain paragraph formatting (max 4 sentences per paragraph).
Do NOT use the $ symbol.

Respond in EXACTLY this format:

PROCESSED_TEXT:
[compressed version]

WORD_COUNT: [integer]

DELTA_REPORT:
{{"new_claims": [...], "terms_used": [...], "conflicts": "none"}}"""


def build_stitch_prompt(skeleton: dict, delta_reports: List[dict]) -> str:
    return f"""You are reviewing processed chunks for cross-chunk coherence.

GLOBAL SKELETON:
{json.dumps(skeleton, indent=2)}

CHUNK DELTA REPORTS:
{json.dumps(delta_reports, indent=2)}

Review for:
1. CONTRADICTIONS: Do any chunks contradict each other or the skeleton?
2. TERM DRIFT: Is any key term used inconsistently across chunks?
3. REDUNDANCIES: Do multiple chunks make the same point unnecessarily?
4. GAPS: Is anything from the skeleton missing from the chunks?

Return STRICT JSON only (no markdown fences):
{{
  "conflicts_found": [{{"chunk_index": int, "issue": str}}, ...],
  "repair_plan": [{{"chunk_index": int, "change": str}}, ...] or [],
  "overall_assessment": "string"
}}"""


# ─────────────────────────────────────────────────────────────────────────────
# RESPONSE PARSING
# ─────────────────────────────────────────────────────────────────────────────

def parse_chunk_response(raw: str) -> Tuple[str, dict]:
    """Extract PROCESSED_TEXT and DELTA_REPORT JSON from LLM response."""
    text = ""
    delta: dict = {}

    pt_match = re.search(
        r"PROCESSED_TEXT:\s*(.*?)(?=\n\s*WORD_COUNT:|\n\s*DELTA_REPORT:|\Z)",
        raw, re.DOTALL | re.IGNORECASE,
    )
    if pt_match:
        text = pt_match.group(1).strip()
    else:
        text = raw.strip()

    dr_match = re.search(r"DELTA_REPORT:\s*(\{.*?\})\s*\Z", raw, re.DOTALL | re.IGNORECASE)
    if dr_match:
        try:
            delta = json.loads(dr_match.group(1))
        except Exception:
            delta = {"raw": dr_match.group(1)}

    # Strip dollar signs and any leaked headers
    text = text.replace("$", "")
    text = re.sub(r"^\s*(WORD_COUNT|DELTA_REPORT):.*$", "", text, flags=re.MULTILINE)
    return text.strip(), delta


def parse_json_strict(raw: str) -> dict:
    """Parse JSON, stripping markdown fences if present."""
    s = raw.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```\s*$", "", s)
    # Find first { and last }
    start = s.find("{")
    end = s.rfind("}")
    if start >= 0 and end > start:
        s = s[start:end + 1]
    return json.loads(s)


# ─────────────────────────────────────────────────────────────────────────────
# ORCHESTRATION
# ─────────────────────────────────────────────────────────────────────────────

def initialize_job(original_text: str, custom_instructions: str,
                   user_id: Optional[str] = None,
                   document_title: Optional[str] = None) -> dict:
    total_input_words = count_words(original_text)
    target_min, target_max = parse_target_length(custom_instructions, total_input_words)
    target_mid = (target_min + target_max) // 2
    length_ratio = target_mid / max(total_input_words, 1)
    length_mode = get_length_mode(length_ratio)

    chunks = split_into_chunks(original_text, CHUNK_SIZE_WORDS)
    num_chunks = len(chunks)
    chunk_target_words = math.ceil(target_mid / max(num_chunks, 1))

    job = _exec("""
        INSERT INTO reconstruction_jobs
            (user_id, document_title, original_text, total_input_words,
             target_min_words, target_max_words, target_mid_words,
             length_ratio, length_mode, num_chunks, chunk_target_words,
             custom_instructions, status)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending')
        RETURNING *;
    """, (user_id, document_title, original_text, total_input_words,
          target_min, target_max, target_mid,
          length_ratio, length_mode, num_chunks, chunk_target_words,
          custom_instructions), fetch="one")

    for i, chunk_text in enumerate(chunks):
        ciw = count_words(chunk_text)
        ctw = math.ceil(ciw * length_ratio)
        _exec("""
            INSERT INTO reconstruction_chunks
                (job_id, chunk_index, chunk_input_text, chunk_input_words,
                 target_words, min_words, max_words, status)
            VALUES (%s,%s,%s,%s,%s,%s,%s,'pending');
        """, (job["id"], i, chunk_text, ciw,
              ctw, max(int(ctw * 0.85), 30), max(int(ctw * 1.15), 50)))

    return dict(job)


def extract_skeleton(job_id: str) -> dict:
    job = _exec("SELECT * FROM reconstruction_jobs WHERE id=%s", (job_id,), fetch="one")
    _exec("UPDATE reconstruction_jobs SET status='skeleton_extraction', updated_at=NOW() WHERE id=%s", (job_id,))

    raw = call_llm(build_skeleton_prompt(job["original_text"]),
                   max_tokens=SKELETON_MAX_TOKENS)
    try:
        skeleton = parse_json_strict(raw)
    except Exception as e:
        logger.warning(f"Skeleton JSON parse failed ({e}); storing raw text.")
        skeleton = {"raw_skeleton": raw, "parse_error": str(e)}

    _exec("UPDATE reconstruction_jobs SET global_skeleton=%s, updated_at=NOW() WHERE id=%s",
          (Json(skeleton), job_id))
    return skeleton


def process_single_chunk(job: dict, chunk: dict) -> dict:
    """Process one chunk with retry-for-length logic. Returns updated chunk record."""
    _exec("UPDATE reconstruction_chunks SET status='processing', updated_at=NOW() WHERE id=%s",
          (chunk["id"],))

    skeleton = job["global_skeleton"] or {}
    guidance = LENGTH_GUIDANCE.get(job["length_mode"], LENGTH_GUIDANCE["maintain"])

    prompt = build_chunk_prompt(
        chunk_text=chunk["chunk_input_text"],
        skeleton=skeleton,
        custom_instructions=job["custom_instructions"] or "",
        target_words=chunk["target_words"],
        min_words=chunk["min_words"],
        max_words=chunk["max_words"],
        length_guidance=guidance,
        total_chunks=job["num_chunks"],
        chunk_index=chunk["chunk_index"],
        chunk_input_words=chunk["chunk_input_words"],
    )

    raw = call_llm(prompt, max_tokens=CHUNK_MAX_TOKENS)
    text, delta = parse_chunk_response(raw)
    actual = count_words(text)
    retries = 0

    # Retry if too short
    if actual < int(chunk["min_words"] * 0.8) and chunk["min_words"] >= 50:
        time.sleep(RETRY_DELAY)
        raw2 = call_llm(build_retry_expand_prompt(
            text, actual, chunk["target_words"], chunk["min_words"]),
            max_tokens=CHUNK_MAX_TOKENS)
        t2, d2 = parse_chunk_response(raw2)
        a2 = count_words(t2)
        if a2 > actual:
            text, delta, actual = t2, (d2 or delta), a2
        retries = 1

    # Retry if too long
    elif actual > int(chunk["max_words"] * 1.2):
        time.sleep(RETRY_DELAY)
        raw2 = call_llm(build_retry_compress_prompt(
            text, actual, chunk["target_words"], chunk["max_words"]),
            max_tokens=CHUNK_MAX_TOKENS)
        t2, d2 = parse_chunk_response(raw2)
        a2 = count_words(t2)
        if a2 < actual:
            text, delta, actual = t2, (d2 or delta), a2
        retries = 1

    updated = _exec("""
        UPDATE reconstruction_chunks
        SET chunk_output_text=%s, actual_words=%s, chunk_delta=%s,
            retry_count=%s, status='complete', updated_at=NOW()
        WHERE id=%s RETURNING *;
    """, (text, actual, Json(delta or {}), retries, chunk["id"]), fetch="one")
    return dict(updated)


def stitch_and_assemble(job_id: str) -> str:
    job = _exec("SELECT * FROM reconstruction_jobs WHERE id=%s", (job_id,), fetch="one")
    _exec("UPDATE reconstruction_jobs SET status='stitching', updated_at=NOW() WHERE id=%s", (job_id,))

    chunks = _exec("""SELECT * FROM reconstruction_chunks
                      WHERE job_id=%s AND status='complete'
                      ORDER BY chunk_index""", (job_id,), fetch="all") or []

    # Stitch pass (best-effort review only; we don't auto-repair in v1)
    deltas = [{"index": c["chunk_index"],
               "actual_words": c["actual_words"],
               "delta": c["chunk_delta"] or {}} for c in chunks]
    try:
        stitch_raw = call_llm(build_stitch_prompt(job["global_skeleton"] or {}, deltas),
                              max_tokens=STITCH_MAX_TOKENS)
        stitch_result = parse_json_strict(stitch_raw)
        logger.info(f"Stitch review: {stitch_result.get('overall_assessment', '(none)')}")
    except Exception as e:
        logger.warning(f"Stitch pass non-fatal failure: {e}")

    # Assemble
    final = "\n\n".join((c["chunk_output_text"] or "").strip() for c in chunks).strip()
    total_words = count_words(final)

    _exec("""UPDATE reconstruction_jobs
             SET final_output=%s, final_word_count=%s,
                 status='complete', updated_at=NOW()
             WHERE id=%s""", (final, total_words, job_id))
    return final


# ─────────────────────────────────────────────────────────────────────────────
# STREAMING ORCHESTRATOR (SSE generator)
# ─────────────────────────────────────────────────────────────────────────────

def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def run_reconstruction_stream(original_text: str, custom_instructions: str,
                              user_id: Optional[str] = None,
                              document_title: Optional[str] = None) -> Generator[str, None, None]:
    """End-to-end orchestrator. Yields SSE events with progress and final output."""
    job_id = None
    try:
        yield _sse({"event": "init", "message": "Initializing reconstruction job..."})
        job = initialize_job(original_text, custom_instructions, user_id, document_title)
        job_id = str(job["id"])
        yield _sse({
            "event": "job_created",
            "job_id": job_id,
            "total_input_words": job["total_input_words"],
            "target_min": job["target_min_words"],
            "target_max": job["target_max_words"],
            "length_mode": job["length_mode"],
            "num_chunks": job["num_chunks"],
            "message": (f"Job created. Input: {job['total_input_words']} words. "
                        f"Target: {job['target_min_words']}-{job['target_max_words']} words "
                        f"({job['length_mode']}). {job['num_chunks']} chunks.")
        })

        yield _sse({"event": "skeleton_start", "message": "PASS 1/3: Extracting global skeleton..."})
        skeleton = extract_skeleton(job_id)
        yield _sse({"event": "skeleton_done",
                    "skeleton_summary": skeleton.get("thesis", "(no thesis extracted)"),
                    "message": "Skeleton extracted. Beginning chunk processing."})
        time.sleep(2)

        # Reload job with skeleton
        job = _exec("SELECT * FROM reconstruction_jobs WHERE id=%s", (job_id,), fetch="one")
        _exec("UPDATE reconstruction_jobs SET status='chunk_processing', updated_at=NOW() WHERE id=%s", (job_id,))

        chunks = _exec("""SELECT * FROM reconstruction_chunks
                          WHERE job_id=%s AND status='pending'
                          ORDER BY chunk_index""", (job_id,), fetch="all") or []
        total = len(chunks)

        yield _sse({"event": "chunks_start", "total": total,
                    "message": f"PASS 2/3: Processing {total} chunks with coherence constraints..."})

        failed_chunks: List[int] = []
        for i, ch in enumerate(chunks):
            time.sleep(2)
            yield _sse({"event": "chunk_processing",
                        "chunk_index": ch["chunk_index"],
                        "total": total,
                        "target_words": ch["target_words"],
                        "message": f"Processing chunk {ch['chunk_index']+1}/{total} (target {ch['target_words']} words)..."})
            try:
                result = process_single_chunk(dict(job), dict(ch))
                _exec("UPDATE reconstruction_jobs SET current_chunk=%s, updated_at=NOW() WHERE id=%s",
                      (ch["chunk_index"] + 1, job_id))
                yield _sse({"event": "chunk_complete",
                            "chunk_index": ch["chunk_index"],
                            "total": total,
                            "actual_words": result["actual_words"],
                            "retry_count": result["retry_count"],
                            "message": (f"Chunk {ch['chunk_index']+1}/{total} complete "
                                        f"({result['actual_words']} words"
                                        f"{', retried' if result['retry_count'] else ''}).")})
            except Exception as ce:
                logger.exception(f"Chunk {ch['chunk_index']} failed")
                _exec("""UPDATE reconstruction_chunks SET status='failed',
                         error_message=%s, updated_at=NOW() WHERE id=%s""",
                      (str(ce), ch["id"]))
                failed_chunks.append(ch["chunk_index"])
                yield _sse({"event": "chunk_error",
                            "chunk_index": ch["chunk_index"],
                            "error": str(ce),
                            "message": f"Chunk {ch['chunk_index']+1} failed: {ce}. Continuing."})
            time.sleep(INTER_CHUNK_DELAY)

        # Strict failure semantics: if any chunks failed, mark job failed and abort
        if failed_chunks:
            msg = f"{len(failed_chunks)} chunk(s) failed (indices {failed_chunks}); reconstruction aborted to avoid silent truncation."
            _exec("""UPDATE reconstruction_jobs SET status='failed',
                     error_message=%s, updated_at=NOW() WHERE id=%s""",
                  (msg, job_id))
            yield _sse({"event": "error", "error": msg, "message": msg, "job_id": job_id})
            return

        yield _sse({"event": "stitch_start", "message": "PASS 3/3: Stitching and global coherence review..."})
        final = stitch_and_assemble(job_id)
        final_words = count_words(final)
        yield _sse({"event": "stitch_done",
                    "final_word_count": final_words,
                    "target_min": job["target_min_words"],
                    "target_max": job["target_max_words"],
                    "message": f"Reconstruction complete: {final_words} words."})

        # Stream the final output in chunks so the client can render progressively
        CHUNK_OUT = 400
        for i in range(0, len(final), CHUNK_OUT):
            yield _sse({"event": "output", "text": final[i:i + CHUNK_OUT]})

        yield _sse({"event": "complete", "job_id": job_id,
                    "final_word_count": final_words,
                    "message": "Done."})
    except Exception as e:
        logger.exception("Reconstruction failed")
        if job_id:
            _exec("""UPDATE reconstruction_jobs SET status='failed',
                     error_message=%s, updated_at=NOW() WHERE id=%s""",
                  (str(e), job_id))
        yield _sse({"event": "error", "error": str(e),
                    "message": f"Reconstruction failed: {e}"})
