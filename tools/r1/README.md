# R1 — Classic EZ Reader Synthetic User Agent

R1 is a standalone Playwright-driven beta tester for Classic EZ Reader. It exercises every documented feature end-to-end and produces **raw reviewable evidence** — exact text typed, exact response bodies, exact SSE event sequences, exact screenshots — not green-checkmark summaries.

## Quick start

```bash
cd tools/r1
npm install                          # installs Playwright + Chromium + Anthropic SDK + pdf-lib + docx
export ANTHROPIC_API_KEY=sk-ant-...  # R1's brain + judge both call Claude
export APP_URL=http://localhost:5000 # default; override if testing a deployed instance
npm start
```

Open the live view at **http://localhost:7777** while R1 runs. At completion the harness writes a self-contained `runs/<ISO-timestamp>/` directory containing `report.html`, `failures.md`, `network.log`, `transcript.jsonl`, `sse-streams/`, `outputs/`, `screenshots/`, and `console.log`.

## What R1 verifies

Twenty-three numbered functions cover every documented Classic EZ Reader surface: app startup, dollar-sign and paragraph invariants, ONE CLICK and CUSTOMIZED rewrites, six-provider parity, humanizer + AI detection, cross-module sends, translation, style transfer, AI chat, the full assessment + maximization suite, Devil's Advocate / Convert to Fiction conversions, all upload routes, the full Cross-Chunk Coherence (CC) reconstruction pipeline including pacing, state machine, and owner-only access, key rotation reset, audio (TTS / audiobook / podcast), comprehensive search, share + export, the CLEAR ALL flow, the floating ACTION buttons, and a final aggregate invariant scan.

Ten product invariants escalate to **CRITICAL VIOLATION** if breached:

- **A** — No `$` characters in any output (input or post-transform)
- **B** — No paragraph exceeds 4 sentences (with up to 6 leniency)
- **C** — CC SSE event sequence appears in documented order
- **D** — CC pacing averages ≥8 seconds per chunk (protective pauses intact)
- **E** — CC state machine never reports `complete` while any chunk is `failed`
- **F** — CC `status`/`result` endpoints reject cross-context (unauthenticated) reads
- **G** — Six providers produce non-identical outputs for the same input
- **H** — `POST /reset_api_keys` does not break the next provider call
- **I** — GPTZero "X% HUMAN" badges populate on all four boxes after humanize
- **J** — Content Source upload hits `/api/content_source/upload`, not `/upload`

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `APP_URL` | `http://localhost:5000` | Target Classic EZ Reader instance |
| `ANTHROPIC_API_KEY` | (required) | Powers R1's brain + judge |
| `ANTHROPIC_MODEL` | `claude-opus-4-7` | Claude model for brain + judge (override if model unavailable) |
| `HEADLESS` | `false` | Run Chromium headless |
| `TYPE_DELAY_MS` | `15` | Per-keystroke delay (skipped for >2000-char fixtures via `fill`) |
| `LIVE_VIEW_PORT` | `7777` | Live view HTTP server port |
| `SKIP_FUNCTIONS` | (empty) | Comma-separated function numbers to skip (e.g. `5,11,14,17` for smoke test) |
| `REWRITE_TIMEOUT_MS` | `300000` (5 min) | Short rewrite SSE timeout |
| `ASSESSMENT_TIMEOUT_MS` | `900000` (15 min) | Assessment/maximization SSE timeout |
| `CC_TIMEOUT_MS` | `1800000` (30 min) | CC reconstruction SSE timeout |
| `CC_PACING_MIN_SECONDS_PER_CHUNK` | `8` | Invariant D threshold |
| `PARAGRAPH_VIOLATION_THRESHOLD_SENTENCES` | `6` | Invariant B threshold (with leniency) |

## Exit codes

- **0** — Clean run, no judge concerns, no invariant violations
- **1** — Judge concerns raised (quality issues, not invariant breaches)
- **2** — One or more CRITICAL INVARIANT VIOLATIONS detected
- **3** — Harness sanity check failed (R1 produced incomplete evidence — these are *R1* bugs, not app bugs)

## Anti-theater design

Every interaction record contains R1's exact input verbatim, every network call's request and response body, three screenshots for interactive steps (before / after typing / after response), the full SSE event sequence with timestamps, the invariant scan results, and the judge's prose critique (≥30 words). PASS/FAIL exists only as a filter for `failures.md` — it is never a substitute for the raw evidence.

The HTML report has no collapsed sections. You can review the entire run in under 30 minutes.
