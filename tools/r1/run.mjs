#!/usr/bin/env node
/**
 * R1 — Classic EZ Reader synthetic user agent.
 * Single-file Playwright harness. See README.md for usage.
 */

import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { writeFile, readFile, mkdir, appendFile, stat } from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// CONFIG
// ============================================================================
const APP_URL = (process.env.APP_URL || 'http://localhost:5000').replace(/\/$/, '');
const HEADLESS = process.env.HEADLESS === 'true';
const TYPE_DELAY_MS = parseInt(process.env.TYPE_DELAY_MS || '15', 10);
const LIVE_VIEW_PORT = parseInt(process.env.LIVE_VIEW_PORT || '7777', 10);
const SKIP_FUNCTIONS = new Set((process.env.SKIP_FUNCTIONS || '').split(',').map(s => s.trim()).filter(Boolean));
const REWRITE_TIMEOUT_MS = parseInt(process.env.REWRITE_TIMEOUT_MS || '300000', 10);
const ASSESSMENT_TIMEOUT_MS = parseInt(process.env.ASSESSMENT_TIMEOUT_MS || '900000', 10);
const CC_TIMEOUT_MS = parseInt(process.env.CC_TIMEOUT_MS || '1800000', 10);
const CC_PACING_MIN = parseInt(process.env.CC_PACING_MIN_SECONDS_PER_CHUNK || '8', 10);
const PARA_THRESH = parseInt(process.env.PARAGRAPH_VIOLATION_THRESHOLD_SENTENCES || '6', 10);
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';

const RUN_TS = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = resolve(__dirname, `runs/${RUN_TS}`);
const FIX = resolve(__dirname, 'fixtures');

// ============================================================================
// STATE (shared with live view)
// ============================================================================
const state = {
  status: 'starting',
  startedAt: Date.now(),
  finishedAt: null,
  currentFunction: null,
  currentStep: null,
  currentApproach: null,
  currentUrl: APP_URL,
  latestScreenshot: null,
  ezState: {
    page: '/', mode: null, provider: null, lastElapsed: null,
    lastSseSeq: [], lastDollarScan: null, lastParaScan: null,
    lastDetectionScores: { input: null, output: null, humanizerStyle: null, humanizerOutput: null },
    lastInvariantSummary: null
  },
  ccProgress: { skeleton: null, chunks: { current: 0, total: 0, timings: [], avgSec: null }, stitch: null },
  interactions: [],
  recentSse: [],
  recentNetwork: [],
  latestJudge: null,
  invariantViolations: [],
  judgeConcerns: [],
  harnessSanity: [],
  consoleLines: [],
  liveKeystrokes: ''
};

// ============================================================================
// LOGGING
// ============================================================================
function log(...args) {
  const line = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  const ts = new Date().toISOString();
  const formatted = `[${ts}] ${line}`;
  console.log(formatted);
  state.consoleLines.push(formatted);
  if (state.consoleLines.length > 2000) state.consoleLines.shift();
}

async function appendJsonl(path, obj) {
  await appendFile(path, JSON.stringify(obj) + '\n');
}

async function ensureDirs() {
  const dirs = [
    OUT, `${OUT}/screenshots`, `${OUT}/sse-streams`,
    `${OUT}/outputs`, `${OUT}/outputs/rewrites`, `${OUT}/outputs/provider-parity`,
    `${OUT}/outputs/humanizer`, `${OUT}/outputs/assessments`, `${OUT}/outputs/cc`,
    `${OUT}/outputs/audio`, `${OUT}/outputs/exports`, `${OUT}/outputs/invariant-scans`,
    `${OUT}/outputs/ui-state-captures`
  ];
  for (const d of dirs) await mkdir(d, { recursive: true });
}

let screenshotCounter = 0;
async function shot(page, label) {
  screenshotCounter += 1;
  const num = String(screenshotCounter).padStart(4, '0');
  const safeLabel = label.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60);
  const file = `${num}_${safeLabel}.png`;
  const path = `${OUT}/screenshots/${file}`;
  try {
    await page.screenshot({ path, fullPage: false });
    state.latestScreenshot = file;
  } catch (e) {
    log(`[screenshot] failed: ${e.message}`);
  }
  return file;
}

// ============================================================================
// BINARY FIXTURES (generated on startup)
// ============================================================================
async function ensureBinaryFixtures() {
  const pdfPath = `${FIX}/sample.pdf`;
  const docxPath = `${FIX}/sample.docx`;
  const pngPath = `${FIX}/sample-image.png`;

  if (!existsSync(pdfPath)) {
    const text = await readFile(`${FIX}/short-input.txt`, 'utf8');
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const wrap = (s, max) => {
      const out = []; let line = '';
      for (const w of s.split(/\s+/)) {
        if ((line + ' ' + w).length > max) { out.push(line); line = w; } else { line = line ? line + ' ' + w : w; }
      }
      if (line) out.push(line); return out;
    };
    const lines = text.split('\n').flatMap(p => p ? wrap(p, 90) : ['']);
    let page = pdf.addPage([612, 792]);
    let y = 760;
    for (const line of lines) {
      if (y < 50) { page = pdf.addPage([612, 792]); y = 760; }
      page.drawText(line, { x: 40, y, size: 11, font });
      y -= 14;
    }
    await writeFile(pdfPath, await pdf.save());
    log(`[fixtures] generated sample.pdf (${(await stat(pdfPath)).size} bytes)`);
  }

  if (!existsSync(docxPath)) {
    const text = await readFile(`${FIX}/short-input.txt`, 'utf8');
    const doc = new Document({
      sections: [{
        children: text.split('\n').map(p => new Paragraph({ children: [new TextRun(p || ' ')] }))
      }]
    });
    const buf = await Packer.toBuffer(doc);
    await writeFile(docxPath, buf);
    log(`[fixtures] generated sample.docx (${(await stat(docxPath)).size} bytes)`);
  }

  if (!existsSync(pngPath)) {
    // 1x1 PNG placeholder; OCR test will note "fixture is placeholder, OCR text empty is acceptable"
    const png1x1 = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da6300010000000500010d0a2db40000000049454e44ae426082',
      'hex'
    );
    await writeFile(pngPath, png1x1);
    log(`[fixtures] generated sample-image.png placeholder (${png1x1.length} bytes; OCR will return empty — acceptable)`);
  }
}

// ============================================================================
// ANTHROPIC: BRAIN + JUDGE
// ============================================================================
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

async function callClaude(systemPrompt, userPrompt, maxTokens = 800) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return '[ANTHROPIC_API_KEY not set — brain/judge call skipped]';
  }
  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
    return resp.content.map(b => b.text || '').join('').trim();
  } catch (e) {
    // Fall back to a known-good Sonnet model if the configured model is unavailable.
    if (ANTHROPIC_MODEL !== 'claude-3-5-sonnet-20241022') {
      try {
        const resp = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        });
        return resp.content.map(b => b.text || '').join('').trim();
      } catch (e2) {
        log(`[claude] both ${ANTHROPIC_MODEL} and sonnet fallback failed: ${e2.message}`);
        return `[claude call failed: ${e2.message}]`;
      }
    }
    log(`[claude] ${ANTHROPIC_MODEL} failed: ${e.message}`);
    return `[claude call failed: ${e.message}]`;
  }
}

async function brainComposeInput(context) {
  // Used when R1 needs to invent input rather than use a fixture.
  return callClaude(
    'You are R1, a synthetic beta-tester. Compose realistic user input for the described scenario. Output ONLY the input text, no preamble.',
    context,
    400
  );
}

async function judge(interaction) {
  const sys = `You are R1's judge. Critique the interaction functionally and qualitatively. Output a prose critique of at least 60 words covering: (1) did the rewrite/transformation substantively change the input, (2) are there dollar signs in the output, (3) are any paragraphs longer than 4 sentences, (4) is anything broken or off. End with one line "CONCERNS: <comma list>" or "CONCERNS: none".`;
  const body = JSON.stringify({
    function: interaction.function,
    step: interaction.step,
    approach: interaction.approach,
    r1_input: (interaction.r1_input || '').slice(0, 2000),
    expected_routes: interaction.expected_routes,
    network_routes_observed: interaction.network_calls?.map(c => `${c.method} ${c.route} ${c.status}`).slice(0, 20),
    output_excerpt: (interaction.app_output || '').slice(0, 2500),
    sse_event_types: interaction.sse_events?.map(e => e.type).slice(0, 50),
    dollar_sign_scan: interaction.dollar_sign_scan,
    paragraph_length_scan: interaction.paragraph_length_scan,
    detection_scores_observed: interaction.detection_scores_observed,
    error: interaction.error
  }, null, 2);
  const critique = await callClaude(sys, `Interaction record:\n\n${body}`, 700);
  const concerns = /CONCERNS:\s*(.+)$/im.exec(critique);
  return {
    text: critique,
    concerns: concerns && concerns[1].trim().toLowerCase() !== 'none' ? concerns[1].split(',').map(s => s.trim()) : []
  };
}

// ============================================================================
// INVARIANT SCANNERS
// ============================================================================
function scanDollarSigns(text) {
  if (!text) return { count: 0, locations: [], violation: false };
  const matches = [...text.matchAll(/\$/g)];
  return {
    count: matches.length,
    locations: matches.slice(0, 20).map(m => ({ index: m.index, context: text.slice(Math.max(0, m.index - 20), m.index + 20) })),
    violation: matches.length > 0
  };
}

function scanParagraphLength(text) {
  if (!text) return { paragraphs: [], maxSentences: 0, violations: [], violation: false };
  // Prefer double-newline paragraphing (the app's force_paragraph_formatting target).
  // If the text appears to have no blank-line separators but contains multiple single-newline
  // breaks (some AIs collapse to \n), fall back to single-newline splitting so we still see
  // violations rather than treating the whole output as one paragraph.
  let paras = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  if (paras.length === 1 && /\n/.test(text)) {
    const single = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
    if (single.length >= 3) paras = single;
  }
  const results = paras.map((p, i) => {
    // Split on sentence terminator followed by space/end. Avoid splitting on "Mr.", "Dr.", etc.
    const sentences = p.split(/(?<=[.!?])\s+(?=[A-Z"'(])/).filter(Boolean);
    return { index: i, sentenceCount: sentences.length, excerpt: p.slice(0, 200) };
  });
  const violations = results.filter(r => r.sentenceCount >= PARA_THRESH);
  return {
    paragraphs: results,
    maxSentences: Math.max(0, ...results.map(r => r.sentenceCount)),
    violations,
    violation: violations.length > 0
  };
}

function logInvariantViolation(invariant, interactionIdx, detail) {
  state.invariantViolations.push({
    invariant,
    interaction_index: interactionIdx,
    detail,
    function: state.currentFunction,
    step: state.currentStep,
    timestamp: Date.now()
  });
  log(`[CRITICAL VIOLATION] Invariant ${invariant}: ${JSON.stringify(detail).slice(0, 200)}`);
}

// ============================================================================
// LIVE VIEW
// ============================================================================
function startLiveView() {
  const server = createServer(async (req, res) => {
    if (req.url === '/' || req.url.startsWith('/?')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(LIVE_VIEW_HTML);
      return;
    }
    if (req.url === '/state.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...state,
        recentInteractions: state.interactions.slice(-15).reverse(),
        consoleLines: state.consoleLines.slice(-80)
      }));
      return;
    }
    if (req.url.startsWith('/screenshot/')) {
      const file = req.url.slice('/screenshot/'.length);
      try {
        const data = await readFile(`${OUT}/screenshots/${file}`);
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(data);
      } catch {
        res.writeHead(404); res.end();
      }
      return;
    }
    res.writeHead(404); res.end('not found');
  });
  server.listen(LIVE_VIEW_PORT);
  log(`[live-view] http://localhost:${LIVE_VIEW_PORT}`);
  return server;
}

const LIVE_VIEW_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>R1 Live View</title>
<style>
body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0; background: #0c0c10; color: #d8d8e0; font-size: 12px; }
header { background: #1a1a24; padding: 8px 14px; border-bottom: 1px solid #2a2a38; display: flex; gap: 20px; align-items: center; }
header h1 { font-size: 13px; margin: 0; color: #88c0d0; }
.status { padding: 2px 8px; border-radius: 3px; background: #2a2a38; }
.status.running { background: #3b8c5c; color: #fff; }
.status.finished { background: #5c8cd6; color: #fff; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 8px; }
.col { display: flex; flex-direction: column; gap: 8px; }
.panel { background: #16161e; border: 1px solid #2a2a38; border-radius: 4px; padding: 10px; }
.panel h2 { font-size: 11px; margin: 0 0 8px 0; color: #ebcb8b; text-transform: uppercase; letter-spacing: 0.5px; }
.kv { display: grid; grid-template-columns: 130px 1fr; gap: 4px 12px; }
.kv b { color: #a3be8c; font-weight: normal; }
.viol { color: #bf616a; }
.ok { color: #a3be8c; }
.warn { color: #ebcb8b; }
pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 11px; line-height: 1.4; max-height: 280px; overflow-y: auto; }
.ix { border-top: 1px solid #2a2a38; padding-top: 6px; margin-top: 6px; }
.ix-head { color: #88c0d0; }
img.shot { max-width: 100%; border: 1px solid #2a2a38; border-radius: 3px; }
.cc-bar { background: #2a2a38; height: 8px; border-radius: 3px; overflow: hidden; }
.cc-bar > div { background: #88c0d0; height: 100%; transition: width 0.3s; }
.tag { display: inline-block; padding: 1px 6px; background: #2a2a38; border-radius: 2px; margin-right: 4px; font-size: 10px; }
.crit { background: #bf616a; color: #fff; padding: 2px 8px; border-radius: 3px; }
</style></head>
<body>
<header>
  <h1>R1 — Classic EZ Reader Synthetic Tester</h1>
  <span class="status" id="status">starting</span>
  <span id="elapsed"></span>
  <span style="margin-left:auto">CRITICAL VIOLATIONS: <span id="viol" class="crit">0</span> | JUDGE CONCERNS: <span id="conc">0</span></span>
</header>
<div class="grid">
  <div class="col">
    <div class="panel">
      <h2>Current Step</h2>
      <div class="kv">
        <b>Function</b><div id="fn">—</div>
        <b>Step</b><div id="step">—</div>
        <b>Approach</b><div id="approach">—</div>
        <b>URL</b><div id="url">—</div>
        <b>Live keystrokes</b><div id="keys" style="color:#88c0d0"></div>
      </div>
    </div>
    <div class="panel">
      <h2>Latest Screenshot</h2>
      <img id="shot" class="shot" />
    </div>
    <div class="panel">
      <h2>EZ Reader State</h2>
      <div class="kv">
        <b>Page</b><div id="ez-page">—</div>
        <b>Mode</b><div id="ez-mode">—</div>
        <b>Provider</b><div id="ez-prov">—</div>
        <b>Last elapsed</b><div id="ez-elapsed">—</div>
        <b>Last SSE seq</b><div id="ez-sse">—</div>
        <b>Dollar-sign scan</b><div id="ez-dol">—</div>
        <b>Max paragraph</b><div id="ez-par">—</div>
        <b>Detection scores</b><div id="ez-det">—</div>
        <b>Last invariant summary</b><div id="ez-inv">—</div>
      </div>
    </div>
    <div class="panel">
      <h2>CC Progress</h2>
      <div class="kv">
        <b>PASS 1 Skeleton</b><div id="cc-sk">—</div>
        <b>PASS 2 Chunks</b><div id="cc-ch">—</div>
        <b>PASS 3 Stitch</b><div id="cc-st">—</div>
      </div>
      <div class="cc-bar" style="margin-top:6px"><div id="cc-bar-fill" style="width:0%"></div></div>
    </div>
  </div>
  <div class="col">
    <div class="panel">
      <h2>Recent SSE Events</h2>
      <pre id="sse">—</pre>
    </div>
    <div class="panel">
      <h2>Recent Network Calls</h2>
      <pre id="net">—</pre>
    </div>
    <div class="panel">
      <h2>Latest Judge Critique</h2>
      <pre id="judge">—</pre>
    </div>
    <div class="panel">
      <h2>Recent Interactions</h2>
      <div id="ixs"></div>
    </div>
    <div class="panel">
      <h2>Console (latest 80)</h2>
      <pre id="console">—</pre>
    </div>
  </div>
</div>
<script>
async function refresh(){
  try{
    const r = await fetch('/state.json');
    const s = await r.json();
    document.getElementById('status').textContent = s.status;
    document.getElementById('status').className = 'status ' + s.status;
    const sec = Math.floor((Date.now() - s.startedAt)/1000);
    document.getElementById('elapsed').textContent = 'elapsed ' + Math.floor(sec/60) + 'm ' + (sec%60) + 's';
    document.getElementById('viol').textContent = s.invariantViolations.length;
    document.getElementById('conc').textContent = s.judgeConcerns.length;
    document.getElementById('fn').textContent = s.currentFunction || '—';
    document.getElementById('step').textContent = s.currentStep || '—';
    document.getElementById('approach').textContent = s.currentApproach || '—';
    document.getElementById('url').textContent = s.currentUrl || '—';
    document.getElementById('keys').textContent = (s.liveKeystrokes || '').slice(-200);
    if (s.latestScreenshot) document.getElementById('shot').src = '/screenshot/' + s.latestScreenshot + '?t=' + Date.now();
    const e = s.ezState;
    document.getElementById('ez-page').textContent = e.page || '—';
    document.getElementById('ez-mode').textContent = e.mode || '—';
    document.getElementById('ez-prov').textContent = e.provider || '—';
    document.getElementById('ez-elapsed').textContent = e.lastElapsed ? (e.lastElapsed + ' ms') : '—';
    document.getElementById('ez-sse').textContent = (e.lastSseSeq || []).slice(-12).join(' → ');
    const ds = e.lastDollarScan;
    document.getElementById('ez-dol').innerHTML = ds ? (ds.violation ? '<span class="viol">VIOLATION: ' + ds.count + '</span>' : '<span class="ok">clean</span>') : '—';
    document.getElementById('ez-par').innerHTML = e.lastParaScan ? (e.lastParaScan.violation ? '<span class="viol">' + e.lastParaScan.maxSentences + ' sentences</span>' : '<span class="ok">' + e.lastParaScan.maxSentences + ' max</span>') : '—';
    const d = e.lastDetectionScores || {};
    document.getElementById('ez-det').textContent = 'in=' + (d.input??'—') + ' out=' + (d.output??'—') + ' hStyle=' + (d.humanizerStyle??'—') + ' hOut=' + (d.humanizerOutput??'—');
    document.getElementById('ez-inv').textContent = e.lastInvariantSummary || '—';
    const cc = s.ccProgress;
    document.getElementById('cc-sk').textContent = cc.skeleton ? ('done ' + cc.skeleton + 's') : (cc.chunks.total ? 'done' : 'waiting');
    document.getElementById('cc-ch').textContent = cc.chunks.total ? (cc.chunks.current + ' of ' + cc.chunks.total + (cc.chunks.avgSec ? ' | avg ' + cc.chunks.avgSec + 's/chunk' : '')) : 'waiting';
    document.getElementById('cc-st').textContent = cc.stitch || 'waiting';
    const pct = cc.chunks.total ? Math.min(100, Math.round(100 * cc.chunks.current / cc.chunks.total)) : 0;
    document.getElementById('cc-bar-fill').style.width = pct + '%';
    document.getElementById('sse').textContent = (s.recentSse || []).map(e => '[' + new Date(e.t).toISOString().slice(11,19) + '] ' + e.type + (e.message ? ' — ' + e.message.slice(0,80) : '')).join('\\n') || '—';
    document.getElementById('net').textContent = (s.recentNetwork || []).map(c => c.method + ' ' + c.route + ' → ' + c.status).join('\\n') || '—';
    document.getElementById('judge').textContent = (s.latestJudge?.text) || '—';
    document.getElementById('ixs').innerHTML = (s.recentInteractions || []).map(i =>
      '<div class="ix"><div class="ix-head">' + (i.function||'') + ' / ' + (i.step||'') + ' <span class="tag">' + (i.approach||'') + '</span>' +
      (i.expected_routes ? '<span class="tag">' + i.expected_routes.join(',') + '</span>' : '') +
      (i.error ? '<span class="viol">error</span>' : '') +
      '</div></div>').join('');
    document.getElementById('console').textContent = (s.consoleLines || []).slice(-50).join('\\n');
  }catch(e){}
  setTimeout(refresh, 1500);
}
refresh();
</script>
</body></html>`;

// ============================================================================
// NETWORK + SSE CAPTURE
// ============================================================================
function attachNetworkCapture(page) {
  page.on('request', req => {
    const url = req.url();
    const u = new URL(url);
    if (u.origin !== APP_URL) return;
    state.recentNetwork.push({ method: req.method(), route: u.pathname, status: '...', t: Date.now() });
    if (state.recentNetwork.length > 60) state.recentNetwork.shift();
  });
  page.on('response', async resp => {
    const url = resp.url();
    let u; try { u = new URL(url); } catch { return; }
    if (u.origin !== APP_URL) return;
    const method = resp.request().method();
    let body = null;
    let truncated = false;
    try {
      const buf = await resp.body();
      if (buf.length > 50 * 1024) { body = buf.slice(0, 50 * 1024).toString('utf8'); truncated = true; }
      else body = buf.toString('utf8');
    } catch (e) {
      body = `[body unavailable: ${e.message}]`;
    }
    const entry = {
      t: Date.now(), method, url, route: u.pathname, status: resp.status(),
      request_body: (() => { try { return resp.request().postData()?.slice(0, 50 * 1024) || null; } catch { return null; } })(),
      response_body: body,
      response_truncated: truncated || undefined,
      content_type: resp.headers()['content-type'] || ''
    };
    state.networkCalls.push(entry);
    await appendJsonl(`${OUT}/network.log`, entry);
    // update recentNetwork status
    for (let i = state.recentNetwork.length - 1; i >= 0; i--) {
      const r = state.recentNetwork[i];
      if (r.method === method && r.route === u.pathname && r.status === '...') {
        r.status = resp.status(); break;
      }
    }
  });
  page.on('console', msg => {
    log(`[browser ${msg.type()}] ${msg.text().slice(0, 300)}`);
  });
  page.on('pageerror', err => {
    log(`[browser pageerror] ${err.message}`);
  });
}

/**
 * Consume an SSE stream from APP_URL using cookies from the Playwright context.
 * Returns { events, finalText, terminalEvent, elapsedMs, raw }.
 */
async function consumeSse(context, path, body, { timeoutMs = REWRITE_TIMEOUT_MS, terminalTypes = ['complete', 'done', 'finished', 'error'], onEvent } = {}) {
  const cookies = await context.cookies();
  const cookieHeader = cookies.filter(c => c.domain === new URL(APP_URL).hostname || c.domain === '.' + new URL(APP_URL).hostname || APP_URL.includes(c.domain)).map(c => `${c.name}=${c.value}`).join('; ');
  const url = APP_URL + path;
  const started = Date.now();
  const events = [];
  let finalText = '';
  let terminalEvent = null;
  let raw = '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (e) {
    clearTimeout(timer);
    return { events, finalText, terminalEvent: { type: 'error', message: e.message }, elapsedMs: Date.now() - started, raw, status: 0, error: e.message };
  }

  if (!resp.ok || !resp.body) {
    let text = '';
    try { text = await resp.text(); } catch {}
    clearTimeout(timer);
    return { events, finalText, terminalEvent: { type: 'error', message: `HTTP ${resp.status}` }, elapsedMs: Date.now() - started, raw: text, status: resp.status, error: `HTTP ${resp.status}: ${text.slice(0, 500)}` };
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    let chunk;
    try {
      const r = await reader.read();
      if (r.done) break;
      chunk = decoder.decode(r.value, { stream: true });
    } catch (e) {
      if (e.name === 'AbortError') {
        events.push({ t: Date.now(), type: 'timeout', message: `Exceeded ${timeoutMs}ms` });
        break;
      }
      events.push({ t: Date.now(), type: 'error', message: e.message });
      break;
    }
    raw += chunk;
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\n\n')) !== -1) {
      const evtBlock = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 2);
      // Parse SSE event: lines like "event: x" / "data: {...}"
      let evtType = 'message';
      let dataLines = [];
      for (const line of evtBlock.split('\n')) {
        if (line.startsWith('event:')) evtType = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      const dataStr = dataLines.join('\n');
      let dataObj = null;
      try { dataObj = JSON.parse(dataStr); } catch { dataObj = { raw: dataStr }; }
      const evt = {
        t: Date.now(),
        type: dataObj?.event || evtType,
        message: dataObj?.message,
        data: dataObj
      };
      events.push(evt);
      state.recentSse.push(evt);
      if (state.recentSse.length > 50) state.recentSse.shift();
      if (onEvent) onEvent(evt);
      // accumulate text from events that look like content
      if (typeof dataObj?.text === 'string') finalText += dataObj.text;
      else if (typeof dataObj?.chunk === 'string') finalText += dataObj.chunk;
      else if (typeof dataObj?.output === 'string' && evt.type === 'output') finalText += dataObj.output;
      else if (typeof dataObj?.final_output === 'string') finalText = dataObj.final_output;
      if (terminalTypes.includes(evt.type)) {
        terminalEvent = evt;
        break;
      }
    }
    if (terminalEvent) break;
  }

  clearTimeout(timer);
  try { reader.cancel(); } catch {}

  return { events, finalText, terminalEvent, elapsedMs: Date.now() - started, raw, status: resp.status };
}

// ============================================================================
// INTERACTION RECORDER
// ============================================================================
async function recordInteraction(rec) {
  rec.idx = state.interactions.length;
  rec.timestamp = Date.now();
  state.interactions.push(rec);
  await appendJsonl(`${OUT}/transcript.jsonl`, rec);

  // Update EZ State panel from this interaction
  if (rec.dollar_sign_scan) state.ezState.lastDollarScan = rec.dollar_sign_scan;
  if (rec.paragraph_length_scan) state.ezState.lastParaScan = rec.paragraph_length_scan;
  if (rec.sse_events) state.ezState.lastSseSeq = rec.sse_events.map(e => e.type);
  if (rec.elapsed_ms) state.ezState.lastElapsed = rec.elapsed_ms;
  if (rec.detection_scores_observed) state.ezState.lastDetectionScores = { ...state.ezState.lastDetectionScores, ...rec.detection_scores_observed };
  if (rec.provider_used) state.ezState.provider = rec.provider_used;
  state.ezState.lastInvariantSummary = `A:${rec.dollar_sign_scan?.count ?? '—'} B:${rec.paragraph_length_scan?.maxSentences ?? '—'}`;

  // Judge
  try {
    const j = await judge(rec);
    rec.judge_critique = j.text;
    rec.judge_concerns = j.concerns;
    state.latestJudge = j;
    if (j.concerns.length) {
      state.judgeConcerns.push({ interaction_index: rec.idx, function: rec.function, step: rec.step, concerns: j.concerns, critique: j.text });
    }
  } catch (e) {
    rec.judge_critique = `[judge call failed: ${e.message}]`;
    rec.judge_concerns = [];
  }

  // Save updated transcript with judge appended (rewrite the line is overkill — just append a judged variant)
  await appendJsonl(`${OUT}/transcript-judged.jsonl`, { idx: rec.idx, judge_critique: rec.judge_critique, judge_concerns: rec.judge_concerns });

  return rec;
}

function autoScanAndApply(rec, output) {
  rec.app_output = output;
  rec.dollar_sign_scan = scanDollarSigns(output);
  rec.paragraph_length_scan = scanParagraphLength(output);
  if (rec.dollar_sign_scan.violation) {
    logInvariantViolation('A', state.interactions.length, {
      step: rec.step, count: rec.dollar_sign_scan.count, sample_locations: rec.dollar_sign_scan.locations.slice(0, 3)
    });
  }
  if (rec.paragraph_length_scan.violation) {
    logInvariantViolation('B', state.interactions.length, {
      step: rec.step, max_sentences: rec.paragraph_length_scan.maxSentences,
      violating_excerpts: rec.paragraph_length_scan.violations.map(v => ({ sentences: v.sentenceCount, excerpt: v.excerpt }))
    });
  }
}

// ============================================================================
// HELPERS — TYPING / CLICKING / DOM
// ============================================================================
async function typeOrFill(page, selector, text, opts = {}) {
  state.liveKeystrokes = '';
  const el = await page.$(selector);
  if (!el) throw new Error(`selector not found: ${selector}`);
  await el.scrollIntoViewIfNeeded();
  await el.click({ clickCount: 3 }).catch(() => {});
  await page.keyboard.press('Delete').catch(() => {});
  if (text.length > 2000) {
    await el.fill(text);
    return 'fill';
  }
  // Type with delay; mirror to live keystroke panel
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: TYPE_DELAY_MS });
    state.liveKeystrokes += ch;
    if (state.liveKeystrokes.length > 400) state.liveKeystrokes = state.liveKeystrokes.slice(-400);
  }
  return 'type';
}

async function getTextSafe(page, selector) {
  try {
    const v = await page.$eval(selector, el => el.value ?? el.innerText ?? el.textContent ?? '');
    return v || '';
  } catch { return ''; }
}

async function captureUiState(page, label) {
  try {
    const ui = await page.evaluate(() => {
      const get = id => { const el = document.getElementById(id); return el ? (el.value ?? el.innerText ?? el.textContent ?? '') : null; };
      return {
        inputText: get('inputText'),
        outputText: get('outputText'),
        humanizerStyleInput: get('humanizerStyleInput'),
        humanizerOutput: get('humanizerOutput'),
        humanizerStyleDetectionScore: get('humanizerStyleDetectionScore'),
        humanizerOutputDetectionScore: get('humanizerOutputDetectionScore'),
        inputDetectionScore: get('inputDetectionScore'),
        outputDetectionScore: get('outputDetectionScore'),
        humanizerProvider: get('humanizerProvider')
      };
    });
    await writeFile(`${OUT}/outputs/ui-state-captures/${label}.json`, JSON.stringify(ui, null, 2));
    return ui;
  } catch (e) {
    return {};
  }
}

function pctFrom(text) {
  if (!text) return null;
  const m = /(\d+(?:\.\d+)?)\s*%/.exec(text);
  return m ? parseFloat(m[1]) : null;
}

function getRoutesCalled(predicate) {
  return state.networkCalls.filter(c => predicate(c)).map(c => ({ method: c.method, route: c.route, status: c.status }));
}

// ============================================================================
// HELPERS — STEP SCAFFOLD
// ============================================================================
async function step(page, { fn, name, approach, expected_routes }, fn_body) {
  state.currentFunction = fn;
  state.currentStep = name;
  state.currentApproach = approach;
  state.currentUrl = page.url();
  log(`[${fn}] ${name}  approach=${approach}`);
  const startNetIdx = state.networkCalls.length;
  const before = await shot(page, `${fn}_${name}_before`);
  let result;
  let error = null;
  try {
    result = await fn_body({ before });
  } catch (e) {
    error = e.message;
    log(`[${fn}/${name}] ERROR: ${e.message}\n${e.stack?.slice(0, 1000) || ''}`);
  }
  const after = await shot(page, `${fn}_${name}_after`);
  const newCalls = state.networkCalls.slice(startNetIdx);
  const rec = {
    function: fn,
    step: name,
    approach,
    expected_routes,
    screenshots: [before, result?.afterTyping, after].filter(Boolean),
    network_calls: newCalls.map(c => ({ method: c.method, route: c.route, status: c.status })),
    elapsed_ms: result?.elapsed_ms,
    r1_input: result?.r1_input,
    r1_input_method: result?.r1_input_method,
    r1_click_method: result?.r1_click_method,
    sse_events: result?.sse_events,
    sse_stream_file: result?.sse_stream_file,
    app_output: result?.app_output,
    detection_scores_observed: result?.detection_scores_observed,
    cc_phases_observed: result?.cc_phases_observed,
    cc_chunk_timings: result?.cc_chunk_timings,
    cc_status_polls: result?.cc_status_polls,
    owner_access_check: result?.owner_access_check,
    provider_used: result?.provider_used,
    route_used: result?.route_used,
    extras: result?.extras,
    error
  };
  // Auto invariant scan if app_output present
  if (rec.app_output && !rec.dollar_sign_scan) {
    rec.dollar_sign_scan = scanDollarSigns(rec.app_output);
    rec.paragraph_length_scan = scanParagraphLength(rec.app_output);
    if (rec.dollar_sign_scan.violation) logInvariantViolation('A', state.interactions.length, { step: name, count: rec.dollar_sign_scan.count, sample: rec.dollar_sign_scan.locations.slice(0, 3) });
    if (rec.paragraph_length_scan.violation) logInvariantViolation('B', state.interactions.length, { step: name, max: rec.paragraph_length_scan.maxSentences });
  }
  // 5xx detection
  for (const c of newCalls) {
    if (c.status >= 500) {
      state.invariantViolations.push({ invariant: '5xx', interaction_index: state.interactions.length, detail: { route: c.route, status: c.status }, function: fn, step: name, timestamp: Date.now() });
    }
  }
  await recordInteraction(rec);
  return rec;
}

// ============================================================================
// AUTH DISCOVERY
// ============================================================================
async function tryAuth(page) {
  await page.goto(APP_URL + '/', { waitUntil: 'domcontentloaded' });
  // Look for login/register links
  const links = await page.$$eval('a', as => as.map(a => ({ href: a.getAttribute('href'), text: a.innerText.trim() })));
  const loginLink = links.find(l => /login|sign[\s-]?in/i.test(l.text) || /login|signin/i.test(l.href || ''));
  const registerLink = links.find(l => /register|sign[\s-]?up|create.*account/i.test(l.text) || /register|signup/i.test(l.href || ''));
  if (!loginLink && !registerLink) {
    log('[auth] no login/register links found — proceeding as anonymous (per blueprint Part 12 #3 session falls through to anonymous)');
    return { mode: 'anonymous' };
  }
  // Try register first
  const u = `r1_${Date.now().toString(36)}`;
  const email = `${u}@r1.test`;
  const pw = 'r1TestPassword!23';
  if (registerLink) {
    try {
      await page.goto(APP_URL + registerLink.href, { waitUntil: 'domcontentloaded' });
      await page.fill('input[name="username"], input[name="user"], input[type="text"]', u).catch(() => {});
      await page.fill('input[name="email"]', email).catch(() => {});
      await page.fill('input[name="password"], input[type="password"]', pw).catch(() => {});
      const submit = await page.$('button[type="submit"], input[type="submit"]');
      if (submit) await submit.click();
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      log(`[auth] registered user ${u}`);
      return { mode: 'registered', username: u, email, password: pw };
    } catch (e) {
      log(`[auth] register failed: ${e.message} — proceeding anonymously`);
    }
  }
  return { mode: 'anonymous' };
}

// ============================================================================
// FUNCTIONS 1–23
// ============================================================================

async function fn01_startup(page) {
  state.ezState.page = '/';
  await step(page, { fn: 'F01', name: 'navigate_root', approach: 'happy_path', expected_routes: ['/'] }, async () => {
    await page.goto(APP_URL + '/', { waitUntil: 'domcontentloaded' });
    const ui = await captureUiState(page, 'F01_initial');
    return { app_output: `[UI loaded: inputText present=${!!ui.inputText || ui.inputText === ''}; outputText present=${ui.outputText !== null}]` };
  });

  await step(page, { fn: 'F01', name: 'verify_dom_ids', approach: 'happy_path', expected_routes: ['/'] }, async () => {
    const ids = await page.evaluate(() => {
      const checks = ['inputText','outputText','customizedRewriteBtn','oneClickRewriteBtn','reconstructLongDocBtn','humanizerStyleInput','humanizerOutput','humanizerProvider'];
      const presets = document.querySelectorAll('.humanizer-preset').length;
      const clearAll = !!document.querySelector('button, [id*="clear" i][id*="all" i], [class*="clear" i][class*="all" i]');
      const out = { presets, clearAll };
      for (const id of checks) out[id] = !!document.getElementById(id);
      return out;
    });
    const missing = Object.entries(ids).filter(([k, v]) => k !== 'presets' && k !== 'clearAll' && !v).map(([k]) => k);
    if (missing.length) state.harnessSanity.push({ check: 'F01 dom_ids', missing });
    if (ids.presets < 20) log(`[F01] WARNING: expected ~33 humanizer presets, found ${ids.presets}`);
    return { app_output: `dom_check: ${JSON.stringify(ids)}` };
  });
}

async function fn02_dollar_sign(page) {
  const input = await readFile(`${FIX}/dollar-sign-input.txt`, 'utf8');
  await step(page, { fn: 'F02', name: 'dollar_sign_baseline', approach: 'probe_invariant_A', expected_routes: ['/customized_rewrite_stream'] }, async () => {
    await page.goto(APP_URL + '/', { waitUntil: 'domcontentloaded' });
    const method = await typeOrFill(page, '#inputText', input);
    const afterTyping = await shot(page, 'F02_after_typing');
    const inputBoxText = await getTextSafe(page, '#inputText');
    const inputDollars = (inputBoxText.match(/\$/g) || []).length;
    if (inputDollars > 0) {
      log(`[F02] input box still shows ${inputDollars} dollar signs — preprocess_dollar_signs may not run on UI input; deferring judgment to output check`);
    }
    const sse = await consumeSse(page.context(), '/customized_rewrite_stream', {
      text: input,
      custom_instructions: 'Rewrite this preserving meaning. Improve clarity.',
      provider: 'anthropic'
    }, { timeoutMs: REWRITE_TIMEOUT_MS });
    await writeFile(`${OUT}/sse-streams/F02_dollar_sign.jsonl`, sse.events.map(e => JSON.stringify(e)).join('\n'));
    await writeFile(`${OUT}/outputs/rewrites/dollar-sign-test.txt`, sse.finalText || sse.raw);
    return {
      r1_input: input, r1_input_method: method, r1_click_method: 'api_direct',
      sse_events: sse.events, sse_stream_file: 'F02_dollar_sign.jsonl',
      app_output: sse.finalText || sse.raw, elapsed_ms: sse.elapsedMs, afterTyping,
      extras: { input_box_dollar_count_after_paste: inputDollars }
    };
  });
}

async function fn03_paragraph(page) {
  const input = await readFile(`${FIX}/paragraph-violation.txt`, 'utf8');
  await step(page, { fn: 'F03', name: 'paragraph_violation_baseline', approach: 'probe_invariant_B', expected_routes: ['/customized_rewrite_stream'] }, async () => {
    await page.goto(APP_URL + '/', { waitUntil: 'domcontentloaded' });
    const method = await typeOrFill(page, '#inputText', input);
    const sse = await consumeSse(page.context(), '/customized_rewrite_stream', {
      text: input,
      custom_instructions: 'Improve the prose quality.',
      provider: 'anthropic'
    }, { timeoutMs: REWRITE_TIMEOUT_MS });
    await writeFile(`${OUT}/sse-streams/F03_paragraph.jsonl`, sse.events.map(e => JSON.stringify(e)).join('\n'));
    await writeFile(`${OUT}/outputs/rewrites/paragraph-test.txt`, sse.finalText || sse.raw);
    return {
      r1_input: input, r1_input_method: method, r1_click_method: 'api_direct',
      sse_events: sse.events, sse_stream_file: 'F03_paragraph.jsonl',
      app_output: sse.finalText || sse.raw, elapsed_ms: sse.elapsedMs
    };
  });
}

async function fn04_one_click(page) {
  const input = await readFile(`${FIX}/short-input.txt`, 'utf8');
  await step(page, { fn: 'F04', name: 'one_click_rewrite', approach: 'happy_path_streaming', expected_routes: ['/customized_rewrite_stream'] }, async () => {
    await page.goto(APP_URL + '/', { waitUntil: 'domcontentloaded' });
    const method = await typeOrFill(page, '#inputText', input);
    // Try clicking the actual button — fall back to direct SSE if double-click doesn't fire
    let clickMethod = 'double';
    let directSseFallback = false;
    const btn = await page.$('#oneClickRewriteBtn');
    if (btn) {
      const sseEvents = [];
      const sseDonePromise = page.waitForResponse(r => r.url().includes('/customized_rewrite_stream'), { timeout: 30000 }).catch(() => null);
      await btn.dblclick().catch(async () => { clickMethod = 'single'; await btn.click().catch(() => { directSseFallback = true; }); });
      const resp = await sseDonePromise;
      if (!resp) directSseFallback = true;
    } else {
      directSseFallback = true;
    }
    let sse;
    if (directSseFallback) {
      sse = await consumeSse(page.context(), '/customized_rewrite_stream', { text: input, custom_instructions: '', provider: 'anthropic' }, { timeoutMs: REWRITE_TIMEOUT_MS });
      clickMethod = 'api_direct_fallback';
    } else {
      // Wait for UI to populate (poll outputText)
      const t0 = Date.now();
      let lastLen = 0;
      while (Date.now() - t0 < REWRITE_TIMEOUT_MS) {
        const cur = await getTextSafe(page, '#outputText');
        if (cur.length > 0 && cur.length === lastLen) break;
        lastLen = cur.length;
        await page.waitForTimeout(800);
      }
      const out = await getTextSafe(page, '#outputText');
      sse = { events: [{ t: Date.now(), type: 'ui_output_observed', message: `${out.length} chars` }], finalText: out, elapsedMs: Date.now() - t0 };
    }
    await writeFile(`${OUT}/sse-streams/F04_one_click.jsonl`, sse.events.map(e => JSON.stringify(e)).join('\n'));
    await writeFile(`${OUT}/outputs/rewrites/one-click.txt`, sse.finalText);
    return {
      r1_input: input, r1_input_method: method, r1_click_method: clickMethod,
      sse_events: sse.events, sse_stream_file: 'F04_one_click.jsonl',
      app_output: sse.finalText, elapsed_ms: sse.elapsedMs
    };
  });
}

async function fn05_provider_parity(page) {
  const input = await readFile(`${FIX}/short-input.txt`, 'utf8');
  const providers = ['anthropic', 'openai', 'deepseek', 'perplexity', 'venice', 'azure'];
  const outputs = {};
  for (const p of providers) {
    await step(page, { fn: 'F05', name: `provider_${p}`, approach: 'invariant_G_probe', expected_routes: ['/customized_rewrite_stream', '/humanizer_rewrite_stream'] }, async () => {
      const sse = await consumeSse(page.context(), '/customized_rewrite_stream', {
        text: input, custom_instructions: 'Rewrite preserving meaning.', provider: p
      }, { timeoutMs: REWRITE_TIMEOUT_MS });
      const out = sse.finalText || sse.raw;
      outputs[p] = out;
      await writeFile(`${OUT}/outputs/provider-parity/${p}.txt`, out);
      await writeFile(`${OUT}/sse-streams/F05_${p}.jsonl`, sse.events.map(e => JSON.stringify(e)).join('\n'));
      return {
        r1_input: input, r1_input_method: 'fill', r1_click_method: 'api_direct',
        sse_events: sse.events, sse_stream_file: `F05_${p}.jsonl`,
        app_output: out, elapsed_ms: sse.elapsedMs, provider_used: p
      };
    });
  }
  // Invariant G aggregate check
  const keys = Object.keys(outputs).filter(k => outputs[k] && outputs[k].length > 50);
  const collisions = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (outputs[keys[i]] === outputs[keys[j]]) collisions.push([keys[i], keys[j]]);
    }
  }
  if (collisions.length) {
    logInvariantViolation('G', state.interactions.length - 1, { byte_identical_pairs: collisions });
  }
  await writeFile(`${OUT}/outputs/provider-parity/_aggregate.json`, JSON.stringify({
    providers_tested: keys, byte_identical_pairs: collisions, output_lengths: Object.fromEntries(keys.map(k => [k, outputs[k].length]))
  }, null, 2));
}

async function fn06_humanizer(page) {
  const styleInput = await readFile(`${FIX}/ai-generated.txt`, 'utf8');
  await step(page, { fn: 'F06', name: 'humanizer_roundtrip', approach: 'invariant_I_probe', expected_routes: ['/humanizer_rewrite_stream', '/detect_ai'] }, async () => {
    await page.goto(APP_URL + '/', { waitUntil: 'domcontentloaded' });
    const method = await typeOrFill(page, '#humanizerStyleInput', styleInput).catch(async (e) => {
      log(`[F06] humanizerStyleInput not present — falling back to API direct: ${e.message}`);
      return 'api_direct';
    });
    // Try to select 3 presets
    let presetsSelected = [];
    try {
      const sel = await page.$$eval('.humanizer-preset', els => els.slice(0, 3).map(e => e.value || e.id));
      presetsSelected = sel;
      for (const v of sel) {
        await page.click(`.humanizer-preset[value="${v}"]`).catch(() => {});
      }
    } catch {}
    // Detect AI on style input first
    const styleDetect = await consumeSse(page.context(), '/detect_ai', { text: styleInput }, { timeoutMs: 60000, terminalTypes: ['complete', 'done'] }).catch(() => null);
    const styleScore = styleDetect?.terminalEvent?.data?.ai_probability ?? null;

    const sse = await consumeSse(page.context(), '/humanizer_rewrite_stream', {
      text: styleInput,
      custom_instructions: 'Rewrite in a conversational human voice.',
      provider: 'anthropic',
      presets: presetsSelected
    }, { timeoutMs: REWRITE_TIMEOUT_MS });
    const out = sse.finalText || sse.raw;
    await writeFile(`${OUT}/outputs/humanizer/before.txt`, styleInput);
    await writeFile(`${OUT}/outputs/humanizer/after.txt`, out);
    await writeFile(`${OUT}/sse-streams/F06_humanizer.jsonl`, sse.events.map(e => JSON.stringify(e)).join('\n'));

    // Detection score on output
    await new Promise(r => setTimeout(r, 8000)); // give UI time to re-score
    const outDetect = await consumeSse(page.context(), '/detect_ai', { text: out }, { timeoutMs: 60000, terminalTypes: ['complete', 'done'] }).catch(() => null);
    const outScore = outDetect?.terminalEvent?.data?.ai_probability ?? null;

    // Read UI badges if present
    const uiScores = await page.evaluate(() => {
      const get = id => { const el = document.getElementById(id); return el ? (el.innerText || el.value || el.textContent || '') : null; };
      return {
        input: get('inputDetectionScore'),
        output: get('outputDetectionScore'),
        humanizerStyle: get('humanizerStyleDetectionScore'),
        humanizerOutput: get('humanizerOutputDetectionScore')
      };
    });
    const detection_scores_observed = {
      input: uiScores.input,
      output: uiScores.output,
      humanizerStyle: uiScores.humanizerStyle ?? (styleScore !== null ? `${(styleScore * 100).toFixed(0)}% AI` : null),
      humanizerOutput: uiScores.humanizerOutput ?? (outScore !== null ? `${(outScore * 100).toFixed(0)}% AI` : null)
    };
    const missing = Object.entries(detection_scores_observed).filter(([k, v]) => v === null || v === '' || v === '—').map(([k]) => k);
    if (missing.length === 4) {
      logInvariantViolation('I', state.interactions.length, { all_boxes_empty: true, ui_scores: uiScores });
    }
    return {
      r1_input: styleInput, r1_input_method: method, r1_click_method: 'api_direct',
      sse_events: sse.events, sse_stream_file: 'F06_humanizer.jsonl',
      app_output: out, elapsed_ms: sse.elapsedMs,
      detection_scores_observed,
      extras: { presetsSelected, styleScoreApi: styleScore, outputScoreApi: outScore }
    };
  });
}

async function fn07_cross_module(page) {
  await step(page, { fn: 'F07', name: 'cross_module_sends', approach: 'happy_path', expected_routes: [] }, async () => {
    await page.goto(APP_URL + '/', { waitUntil: 'domcontentloaded' });
    const results = {};
    // Set humanizerOutput then click → MAIN INPUT
    const test = 'R1 cross-module marker text';
    await page.evaluate(t => { const el = document.getElementById('humanizerOutput'); if (el) { if ('value' in el) el.value = t; else el.innerText = t; } }, test);
    for (const id of ['humanizerSendToInputBtn', 'humanizerSendToAiChatBtn', 'humanizerSendToAssessmentBtn']) {
      const btn = await page.$(`#${id}`);
      if (btn) { await btn.click().catch(() => {}); results[id] = 'clicked'; }
      else results[id] = 'not_present';
    }
    await new Promise(r => setTimeout(r, 500));
    const inputAfter = await getTextSafe(page, '#inputText');
    return { app_output: `cross_module: ${JSON.stringify(results)}; inputText after = ${inputAfter.includes(test) ? 'OK' : 'no marker'}` };
  });
}

async function fn08_translation(page) {
  const input = await readFile(`${FIX}/multi-language.txt`, 'utf8');
  await step(page, { fn: 'F08', name: 'translate_en_to_es', approach: 'happy_path', expected_routes: ['/translate'] }, async () => {
    const r = await page.context().request.post(APP_URL + '/translate', {
      data: { text: input, target_language: 'Spanish' },
      headers: { 'Content-Type': 'application/json' },
      timeout: REWRITE_TIMEOUT_MS
    }).catch(e => ({ ok: () => false, _err: e.message }));
    let body = '';
    if (r._err) body = `[error: ${r._err}]`;
    else {
      try { body = await r.text(); } catch { body = '[unreadable]' }
    }
    let translated = body;
    try { const j = JSON.parse(body); translated = j.translated_text || j.result || j.text || body; } catch {}
    return { r1_input: input, r1_input_method: 'api_direct', app_output: translated };
  });
}

async function fn09_style_passthrough(page) {
  const input = await readFile(`${FIX}/short-input.txt`, 'utf8');
  const style = await readFile(`${FIX}/style-sample.txt`, 'utf8');
  await step(page, { fn: 'F09', name: 'style_passthrough', approach: 'happy_path', expected_routes: ['/style_rewrite_passthrough'] }, async () => {
    const r = await page.context().request.post(APP_URL + '/style_rewrite_passthrough', {
      data: { text: input, style_sample: style },
      headers: { 'Content-Type': 'application/json' },
      timeout: REWRITE_TIMEOUT_MS
    }).catch(e => ({ ok: () => false, _err: e.message }));
    let body = ''; if (r._err) body = `[error: ${r._err}]`; else { try { body = await r.text(); } catch { body = ''; } }
    let out = body;
    try { const j = JSON.parse(body); out = j.output || j.result || j.text || body; } catch {}
    return { r1_input: input.slice(0, 200) + '\n\n[style sample omitted]', r1_input_method: 'api_direct', app_output: out };
  });
}

async function fn10_chat(page) {
  await step(page, { fn: 'F10', name: 'chat_initial', approach: 'happy_path', expected_routes: ['/chat_with_ai', '/chat'] }, async () => {
    const q = 'What are the core themes in 19th century Russian literature?';
    const r = await page.context().request.post(APP_URL + '/chat_with_ai', {
      data: { message: q }, headers: { 'Content-Type': 'application/json' }, timeout: REWRITE_TIMEOUT_MS
    }).catch(e => ({ ok: () => false, _err: e.message }));
    let body = ''; try { body = await r.text(); } catch {}
    let out = body; try { const j = JSON.parse(body); out = j.response || j.message || j.text || body; } catch {}
    return { r1_input: q, r1_input_method: 'api_direct', app_output: out };
  });
  await step(page, { fn: 'F10', name: 'chat_followup', approach: 'happy_path', expected_routes: ['/chat_with_ai'] }, async () => {
    const q = 'Of those, which most influenced Western modernism?';
    const r = await page.context().request.post(APP_URL + '/chat_with_ai', {
      data: { message: q }, headers: { 'Content-Type': 'application/json' }, timeout: REWRITE_TIMEOUT_MS
    }).catch(e => ({ ok: () => false, _err: e.message }));
    let body = ''; try { body = await r.text(); } catch {}
    let out = body; try { const j = JSON.parse(body); out = j.response || j.message || j.text || body; } catch {}
    return { r1_input: q, r1_input_method: 'api_direct', app_output: out };
  });
  await step(page, { fn: 'F10', name: 'chat_history', approach: 'happy_path', expected_routes: ['/history'] }, async () => {
    const r = await page.context().request.get(APP_URL + '/history', { timeout: 30000 }).catch(e => ({ _err: e.message }));
    let body = ''; try { body = await r.text(); } catch {}
    return { app_output: body.slice(0, 4000) };
  });
}

async function fn11_assessments(page) {
  const input = await readFile(`${FIX}/short-input.txt`, 'utf8');
  const endpoints = [
    '/quality_assessment_stream',
    '/quality_writing_assessment_stream',
    '/fiction_assessment_stream',
    '/intelligence_maximization_stream',
    '/quality_maximization_stream',
    '/fiction_maximization_stream'
  ];
  for (const ep of endpoints) {
    await step(page, { fn: 'F11', name: `assessment_${ep.replace(/[^a-z]/g, '_')}`, approach: 'happy_path', expected_routes: [ep] }, async () => {
      const sse = await consumeSse(page.context(), ep, { text: input }, { timeoutMs: ASSESSMENT_TIMEOUT_MS });
      const safe = ep.replace(/[^a-z]/gi, '_');
      await writeFile(`${OUT}/sse-streams/F11${safe}.jsonl`, sse.events.map(e => JSON.stringify(e)).join('\n'));
      await writeFile(`${OUT}/outputs/assessments${safe}.txt`, sse.finalText || sse.raw);
      return { r1_input: input, r1_input_method: 'api_direct', sse_events: sse.events, sse_stream_file: `F11${safe}.jsonl`, app_output: sse.finalText || sse.raw, elapsed_ms: sse.elapsedMs };
    });
  }
}

async function fn12_devils_advocate(page) {
  const input = await readFile(`${FIX}/short-input.txt`, 'utf8');
  for (const mode of ['devils_advocate', 'convert_to_fiction', 'convert_to_nonfiction']) {
    await step(page, { fn: 'F12', name: mode, approach: 'happy_path', expected_routes: ['/customized_rewrite_stream'] }, async () => {
      const instruction = {
        devils_advocate: 'Argue the opposite position. Devil\'s advocate mode.',
        convert_to_fiction: 'Convert this to fiction. Add narrative elements.',
        convert_to_nonfiction: 'Convert this to non-fiction. Make it factual and analytical.'
      }[mode];
      const sse = await consumeSse(page.context(), '/customized_rewrite_stream', {
        text: input, custom_instructions: instruction, provider: 'anthropic', mode
      }, { timeoutMs: REWRITE_TIMEOUT_MS });
      await writeFile(`${OUT}/sse-streams/F12_${mode}.jsonl`, sse.events.map(e => JSON.stringify(e)).join('\n'));
      await writeFile(`${OUT}/outputs/rewrites/${mode}.txt`, sse.finalText || sse.raw);
      // Invariant J cousin: confirm route is /customized_rewrite_stream not /process
      const hitProcess = state.networkCalls.slice(-10).find(c => c.route === '/process' && c.method === 'POST');
      if (hitProcess) {
        logInvariantViolation('J-style', state.interactions.length, { regression: `${mode} hit /process (Oct 2025 fix regressed)` });
      }
      return { r1_input: input, r1_input_method: 'api_direct', sse_events: sse.events, app_output: sse.finalText || sse.raw, elapsed_ms: sse.elapsedMs, route_used: '/customized_rewrite_stream' };
    });
  }
}

async function fn13_uploads(page) {
  // 13a — main input upload
  await step(page, { fn: 'F13', name: 'main_upload_pdf', approach: 'happy_path', expected_routes: ['/upload'] }, async () => {
    const buf = await readFile(`${FIX}/sample.pdf`);
    const r = await page.context().request.post(APP_URL + '/upload', {
      multipart: { file: { name: 'sample.pdf', mimeType: 'application/pdf', buffer: buf } },
      timeout: 60000
    }).catch(e => ({ _err: e.message }));
    let body = ''; try { body = await r.text(); } catch {}
    return { r1_input: '[sample.pdf]', r1_input_method: 'dom_inject', app_output: body.slice(0, 4000), route_used: '/upload' };
  });
  // 13b — extract_text alt route
  await step(page, { fn: 'F13', name: 'extract_text_pdf', approach: 'happy_path', expected_routes: ['/extract_text'] }, async () => {
    const buf = await readFile(`${FIX}/sample.pdf`);
    const r = await page.context().request.post(APP_URL + '/extract_text', {
      multipart: { file: { name: 'sample.pdf', mimeType: 'application/pdf', buffer: buf } },
      timeout: 60000
    }).catch(e => ({ _err: e.message }));
    let body = ''; try { body = await r.text(); } catch {}
    return { r1_input: '[sample.pdf]', r1_input_method: 'dom_inject', app_output: body.slice(0, 4000), route_used: '/extract_text' };
  });
  // 13c — Content Source upload (Invariant J)
  await step(page, { fn: 'F13', name: 'content_source_upload', approach: 'invariant_J_probe', expected_routes: ['/api/content_source/upload'] }, async () => {
    const buf = await readFile(`${FIX}/sample.pdf`);
    const r = await page.context().request.post(APP_URL + '/api/content_source/upload', {
      multipart: { file: { name: 'sample.pdf', mimeType: 'application/pdf', buffer: buf } },
      timeout: 60000
    }).catch(e => ({ _err: e.message }));
    let body = ''; let status = r.status?.() ?? 0;
    try { body = await r.text(); } catch {}
    // Inspect actual route fired (just check most recent network call)
    const recent = state.networkCalls.slice(-5);
    const wrongRoute = recent.find(c => c.method === 'POST' && (c.route === '/upload' || c.route === '/extract_text') && c.t > Date.now() - 5000);
    if (wrongRoute && status !== 200) {
      logInvariantViolation('J', state.interactions.length, { expected: '/api/content_source/upload', actual_recent: recent.map(c => c.route) });
    }
    return { r1_input: '[sample.pdf]', r1_input_method: 'dom_inject', app_output: body.slice(0, 4000), route_used: '/api/content_source/upload' };
  });
  // 13d — docx
  await step(page, { fn: 'F13', name: 'extract_text_docx', approach: 'happy_path', expected_routes: ['/extract_text'] }, async () => {
    const buf = await readFile(`${FIX}/sample.docx`);
    const r = await page.context().request.post(APP_URL + '/extract_text', {
      multipart: { file: { name: 'sample.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: buf } },
      timeout: 60000
    }).catch(e => ({ _err: e.message }));
    let body = ''; try { body = await r.text(); } catch {}
    return { r1_input: '[sample.docx]', r1_input_method: 'dom_inject', app_output: body.slice(0, 4000), route_used: '/extract_text' };
  });
  // 13e — image OCR (placeholder PNG; expected behavior: empty extraction OR graceful error)
  await step(page, { fn: 'F13', name: 'extract_text_image_ocr_placeholder', approach: 'edge_case_no_fixture', expected_routes: ['/extract_text'] }, async () => {
    const buf = await readFile(`${FIX}/sample-image.png`);
    const r = await page.context().request.post(APP_URL + '/extract_text', {
      multipart: { file: { name: 'sample-image.png', mimeType: 'image/png', buffer: buf } },
      timeout: 60000
    }).catch(e => ({ _err: e.message }));
    let body = ''; try { body = await r.text(); } catch {}
    return { r1_input: '[1x1 placeholder PNG — OCR text expected empty]', r1_input_method: 'dom_inject', app_output: body.slice(0, 2000), route_used: '/extract_text' };
  });
  // 13f — audio: skip with logged reason
  await step(page, { fn: 'F13', name: 'audio_upload_skipped', approach: 'skipped_no_fixture', expected_routes: [] }, async () => {
    return { app_output: 'SKIPPED: no audio fixture shipped (spec permits skip with logged reason).' };
  });
}

async function fn14_cc(page) {
  const input = await readFile(`${FIX}/long-input-cc.txt`, 'utf8');
  const inputWords = input.split(/\s+/).filter(Boolean).length;
  log(`[F14] long-input-cc.txt = ${inputWords} words`);
  let jobId = null;
  const phases = [];
  const chunkTimings = [];
  let chunkStart = {};
  // 14a — full CC run with status polling
  const pollAbort = { stop: false };
  const statusPolls = [];

  await step(page, { fn: 'F14', name: 'cc_start_stream', approach: 'flagship_CDE_invariants', expected_routes: ['/reconstruction/start_stream'] }, async () => {
    // Begin status polling in parallel
    (async () => {
      while (!pollAbort.stop) {
        await new Promise(r => setTimeout(r, 5000));
        if (!jobId) continue;
        try {
          const r = await page.context().request.get(APP_URL + `/reconstruction/status/${jobId}`, { timeout: 10000 });
          const body = await r.text();
          try { statusPolls.push({ t: Date.now(), status_code: r.status(), body: JSON.parse(body) }); }
          catch { statusPolls.push({ t: Date.now(), status_code: r.status(), body }); }
        } catch (e) {
          statusPolls.push({ t: Date.now(), error: e.message });
        }
      }
    })();

    const sse = await consumeSse(page.context(), '/reconstruction/start_stream', {
      text: input,
      custom_instructions: 'Rewrite this maintaining a target length of approximately 5000 words.'
    }, {
      timeoutMs: CC_TIMEOUT_MS,
      onEvent: (e) => {
        phases.push(e.type);
        if (e.data?.job_id && !jobId) jobId = e.data.job_id;
        if (e.type === 'job_created' && e.data?.id) jobId = e.data.id;
        if (e.type === 'skeleton_done') state.ccProgress.skeleton = Math.round((e.data?.elapsed_ms || 0) / 1000) || 'done';
        if (e.type === 'chunks_start') state.ccProgress.chunks = { current: 0, total: e.data?.total || 0, timings: [], avgSec: null };
        if (e.type === 'chunk_processing' && typeof e.data?.chunk_index === 'number') chunkStart[e.data.chunk_index] = e.t;
        if (e.type === 'chunk_complete' && typeof e.data?.chunk_index === 'number') {
          const start = chunkStart[e.data.chunk_index];
          if (start) {
            const sec = (e.t - start) / 1000;
            chunkTimings.push({ chunk_index: e.data.chunk_index, seconds: sec });
            state.ccProgress.chunks.timings.push(sec);
            state.ccProgress.chunks.current = chunkTimings.length;
            state.ccProgress.chunks.avgSec = (state.ccProgress.chunks.timings.reduce((a, b) => a + b, 0) / state.ccProgress.chunks.timings.length).toFixed(1);
          }
        }
        if (e.type === 'stitch_start') state.ccProgress.stitch = 'in_progress';
        if (e.type === 'stitch_done') state.ccProgress.stitch = 'done';
      }
    });
    pollAbort.stop = true;

    await writeFile(`${OUT}/sse-streams/F14_cc.jsonl`, sse.events.map(e => JSON.stringify(e)).join('\n'));
    await writeFile(`${OUT}/outputs/cc/job-${jobId || 'unknown'}-result.txt`, sse.finalText || '');
    await writeFile(`${OUT}/outputs/cc/job-${jobId || 'unknown'}-status-poll.json`, JSON.stringify(statusPolls, null, 2));
    await writeFile(`${OUT}/outputs/cc/job-${jobId || 'unknown'}-chunk-timings.json`, JSON.stringify({ chunk_timings: chunkTimings, avg_seconds_per_chunk: chunkTimings.length ? chunkTimings.reduce((a, b) => a + b.seconds, 0) / chunkTimings.length : null, total_chunks: chunkTimings.length }, null, 2));

    // Invariant C — event sequence
    const required = ['init', 'job_created', 'skeleton_start', 'skeleton_done', 'chunks_start', 'chunk_processing', 'chunk_complete', 'stitch_start', 'stitch_done', 'complete'];
    const missing = required.filter(r => !phases.includes(r));
    const skDoneIdx = phases.indexOf('skeleton_done');
    const firstChunkIdx = phases.indexOf('chunk_processing');
    const stitchStartIdx = phases.indexOf('stitch_start');
    const lastChunkCompleteIdx = phases.lastIndexOf('chunk_complete');
    let orderOk = true;
    if (skDoneIdx >= 0 && firstChunkIdx >= 0 && firstChunkIdx < skDoneIdx) orderOk = false;
    if (lastChunkCompleteIdx >= 0 && stitchStartIdx >= 0 && stitchStartIdx < lastChunkCompleteIdx) orderOk = false;
    if (sse.terminalEvent?.type === 'complete' && (missing.length || !orderOk)) {
      logInvariantViolation('C', state.interactions.length, { missing_events: missing, order_ok: orderOk, observed_phases: phases.slice(0, 50) });
    }

    // Invariant D — pacing
    if (chunkTimings.length >= 3) {
      const avg = chunkTimings.reduce((a, b) => a + b.seconds, 0) / chunkTimings.length;
      if (avg < CC_PACING_MIN) {
        logInvariantViolation('D', state.interactions.length, { avg_seconds_per_chunk: avg.toFixed(2), threshold: CC_PACING_MIN, total_chunks: chunkTimings.length });
      }
    } else {
      log(`[F14] only ${chunkTimings.length} chunk timings captured — Invariant D pacing check partial`);
    }

    // Invariant E — state machine: status polls valid + no complete-while-failed
    const validStatuses = new Set(['pending', 'skeleton_extraction', 'chunk_processing', 'stitching', 'complete', 'failed']);
    for (const p of statusPolls) {
      const s = p.body?.status;
      if (s && !validStatuses.has(s)) {
        logInvariantViolation('E', state.interactions.length, { invalid_status: s, poll: p });
      }
    }

    return {
      r1_input: input.slice(0, 500) + '\n... [truncated]',
      r1_input_method: 'fill',
      r1_click_method: 'api_direct',
      sse_events: sse.events,
      sse_stream_file: 'F14_cc.jsonl',
      app_output: sse.finalText,
      elapsed_ms: sse.elapsedMs,
      cc_phases_observed: phases,
      cc_chunk_timings: chunkTimings,
      cc_status_polls: statusPolls,
      extras: { job_id: jobId, input_word_count: inputWords, final_word_count: (sse.finalText || '').split(/\s+/).filter(Boolean).length }
    };
  });

  // 14c — result retrieval
  if (jobId) {
    await step(page, { fn: 'F14', name: 'cc_result_fetch', approach: 'happy_path', expected_routes: [`/reconstruction/result/${jobId}`] }, async () => {
      const r = await page.context().request.get(APP_URL + `/reconstruction/result/${jobId}`, { timeout: 30000 });
      const body = await r.text();
      let parsed; try { parsed = JSON.parse(body); } catch { parsed = { raw: body }; }
      const finalOut = parsed.final_output || '';
      const fwc = parsed.final_word_count || 0;
      const ratio = fwc / Math.max(1, inputWords);
      if (ratio < 0.4 || ratio > 1.6) {
        state.judgeConcerns.push({ interaction_index: state.interactions.length, function: 'F14', step: 'cc_result_fetch', concerns: [`final_word_count ${fwc} vs input ${inputWords} ratio ${ratio.toFixed(2)} — outside ±30% of target 1.0`], critique: 'see length analysis' });
      }
      return { app_output: finalOut.slice(0, 4000), extras: { final_word_count: fwc, ratio } };
    });
  }

  // 14e — owner-only access (Invariant F)
  if (jobId) {
    await step(page, { fn: 'F14', name: 'cc_owner_only_access', approach: 'invariant_F_probe', expected_routes: [`/reconstruction/status/${jobId}`, `/reconstruction/result/${jobId}`] }, async () => {
      const browser2 = await chromium.launch({ headless: true });
      const ctx2 = await browser2.newContext();
      const r1 = await ctx2.request.get(APP_URL + `/reconstruction/status/${jobId}`, { timeout: 15000 });
      const r2 = await ctx2.request.get(APP_URL + `/reconstruction/result/${jobId}`, { timeout: 15000 });
      const b1 = await r1.text();
      const b2 = await r2.text();
      const s1 = r1.status();
      const s2 = r2.status();
      await browser2.close();
      let bodyHasData1 = false; let bodyHasData2 = false;
      try { const j = JSON.parse(b1); bodyHasData1 = !!(j.status || j.job_id || j.num_chunks); } catch {}
      try { const j = JSON.parse(b2); bodyHasData2 = !!(j.final_output || j.status === 'complete'); } catch {}
      const violation = (s1 === 200 && bodyHasData1) || (s2 === 200 && bodyHasData2);
      if (violation) {
        logInvariantViolation('F', state.interactions.length, {
          status_response: { code: s1, body_excerpt: b1.slice(0, 400) },
          result_response: { code: s2, body_excerpt: b2.slice(0, 400) }
        });
      }
      return {
        app_output: `cross-context status ${s1} (has_data=${bodyHasData1}); result ${s2} (has_data=${bodyHasData2})`,
        owner_access_check: { status_code: s1, status_has_data: bodyHasData1, result_code: s2, result_has_data: bodyHasData2, violation }
      };
    });
  }
}

async function fn15_cc_failure_semantics(page) {
  // R1 can't induce a chunk failure directly. Verify state machine via post-completion status poll.
  await step(page, { fn: 'F15', name: 'cc_failure_semantics_partial', approach: 'partial_verification', expected_routes: [] }, async () => {
    // Find the most recent CC job in our interactions
    const cc = state.interactions.find(i => i.function === 'F14' && i.extras?.job_id);
    if (!cc) {
      return { app_output: 'SKIPPED: no F14 job to inspect.' };
    }
    const jid = cc.extras.job_id;
    const r = await page.context().request.get(APP_URL + `/reconstruction/status/${jid}`, { timeout: 15000 });
    const body = await r.text();
    let parsed; try { parsed = JSON.parse(body); } catch { parsed = { raw: body }; }
    return { app_output: `Final status for ${jid}: ${JSON.stringify(parsed)}`, extras: { job_id: jid, final_status: parsed } };
  });
}

async function fn16_key_reset(page) {
  await step(page, { fn: 'F16', name: 'reset_api_keys', approach: 'invariant_H_probe', expected_routes: ['/reset_api_keys'] }, async () => {
    const r = await page.context().request.post(APP_URL + '/reset_api_keys', { headers: { 'Content-Type': 'application/json' }, data: {}, timeout: 15000 });
    const body = await r.text();
    return { app_output: `status=${r.status()} body=${body.slice(0, 500)}` };
  });
  // Then verify next provider call works
  const input = await readFile(`${FIX}/short-input.txt`, 'utf8');
  await step(page, { fn: 'F16', name: 'post_reset_rewrite', approach: 'invariant_H_followup', expected_routes: ['/customized_rewrite_stream'] }, async () => {
    const sse = await consumeSse(page.context(), '/customized_rewrite_stream', {
      text: input, custom_instructions: 'Rewrite preserving meaning.', provider: 'anthropic'
    }, { timeoutMs: REWRITE_TIMEOUT_MS });
    const out = sse.finalText || sse.raw;
    if (sse.terminalEvent?.type === 'error' || /all keys exhausted/i.test(out)) {
      logInvariantViolation('H', state.interactions.length, { terminal: sse.terminalEvent, body_excerpt: out.slice(0, 500) });
    }
    return { r1_input: input, r1_input_method: 'api_direct', sse_events: sse.events, app_output: out, elapsed_ms: sse.elapsedMs };
  });
}

async function fn17_audio(page) {
  const input = await readFile(`${FIX}/short-input.txt`, 'utf8');
  await step(page, { fn: 'F17', name: 'tts_process_audio', approach: 'happy_path', expected_routes: ['/process_audio'] }, async () => {
    const r = await page.context().request.post(APP_URL + '/process_audio', {
      data: { text: input, voice: 'default' }, headers: { 'Content-Type': 'application/json' }, timeout: 300000
    }).catch(e => ({ _err: e.message, status: () => 0, text: async () => '' }));
    let body = ''; try { body = await r.text(); } catch {}
    let parsed; try { parsed = JSON.parse(body); } catch { parsed = { raw: body }; }
    const fname = parsed.filename || parsed.audio_file || parsed.file;
    let mp3OK = false;
    if (fname) {
      const r2 = await page.context().request.get(APP_URL + `/get_audio_file/${fname}`, { timeout: 60000 }).catch(e => ({ _err: e.message }));
      if (r2._err) {
        log(`[F17] get_audio_file failed: ${r2._err}`);
      } else {
        const buf = Buffer.from(await r2.body());
        await writeFile(`${OUT}/outputs/audio/tts.mp3`, buf);
        const sig = buf.slice(0, 3);
        // ID3 header OR mp3 frame sync
        mp3OK = (sig[0] === 0x49 && sig[1] === 0x44 && sig[2] === 0x33) || (sig[0] === 0xFF && (sig[1] === 0xFB || sig[1] === 0xFA));
        if (!mp3OK || buf.length < 5 * 1024) {
          state.judgeConcerns.push({ interaction_index: state.interactions.length, function: 'F17', step: 'tts_process_audio', concerns: [`audio file failed signature/size check (size=${buf.length}, first3=${sig.toString('hex')})`], critique: 'see audio bytes' });
        }
      }
    }
    return { r1_input: input, r1_input_method: 'api_direct', app_output: body.slice(0, 1000), extras: { filename: fname, mp3OK } };
  });
  await step(page, { fn: 'F17', name: 'create_audiobook_probe', approach: 'happy_path', expected_routes: ['/create_audiobook'] }, async () => {
    const r = await page.context().request.post(APP_URL + '/create_audiobook', { data: { text: input.slice(0, 800), voice: 'default' }, headers: { 'Content-Type': 'application/json' }, timeout: 600000 }).catch(e => ({ _err: e.message, status: () => 0, text: async () => `[${e.message}]` }));
    let body = ''; try { body = await r.text(); } catch {}
    return { r1_input: input.slice(0, 800), r1_input_method: 'api_direct', app_output: body.slice(0, 1500) };
  });
  await step(page, { fn: 'F17', name: 'create_podcast_probe', approach: 'happy_path', expected_routes: ['/create_podcast'] }, async () => {
    const script = 'Alice: Welcome to the show.\nBob: Thanks for having me.';
    const r = await page.context().request.post(APP_URL + '/create_podcast', { data: { script }, headers: { 'Content-Type': 'application/json' }, timeout: 600000 }).catch(e => ({ _err: e.message, status: () => 0, text: async () => `[${e.message}]` }));
    let body = ''; try { body = await r.text(); } catch {}
    return { r1_input: script, r1_input_method: 'api_direct', app_output: body.slice(0, 1500) };
  });
}

async function fn18_detection_probe(page) {
  const ai = await readFile(`${FIX}/ai-generated.txt`, 'utf8');
  const human = await readFile(`${FIX}/style-sample.txt`, 'utf8');
  for (const [name, text] of [['ai_text', ai], ['human_text', human]]) {
    await step(page, { fn: 'F18', name: `detect_ai_${name}`, approach: 'happy_path', expected_routes: ['/detect_ai'] }, async () => {
      const r = await page.context().request.post(APP_URL + '/detect_ai', { data: { text }, headers: { 'Content-Type': 'application/json' }, timeout: 60000 }).catch(e => ({ _err: e.message, status: () => 0, text: async () => `[${e.message}]` }));
      let body = ''; try { body = await r.text(); } catch {}
      return { r1_input: text.slice(0, 500), r1_input_method: 'api_direct', app_output: body.slice(0, 2000) };
    });
  }
}

async function fn19_search(page) {
  await step(page, { fn: 'F19', name: 'comprehensive_search', approach: 'happy_path', expected_routes: ['/comprehensive_search'] }, async () => {
    const q = "current research on Wittgenstein's Tractatus";
    const r = await page.context().request.post(APP_URL + '/comprehensive_search', { data: { query: q, text: q }, headers: { 'Content-Type': 'application/json' }, timeout: 120000 }).catch(e => ({ _err: e.message, status: () => 0, text: async () => `[${e.message}]` }));
    let body = ''; try { body = await r.text(); } catch {}
    return { r1_input: q, r1_input_method: 'api_direct', app_output: body.slice(0, 3000) };
  });
}

async function fn20_share_export(page) {
  await step(page, { fn: 'F20', name: 'share_text', approach: 'happy_path', expected_routes: ['/share_text'] }, async () => {
    const r = await page.context().request.post(APP_URL + '/share_text', { data: { text: 'R1 share test', email: 'r1@r1.test' }, headers: { 'Content-Type': 'application/json' }, timeout: 30000 }).catch(e => ({ _err: e.message, status: () => 0, text: async () => `[${e.message}]` }));
    let body = ''; try { body = await r.text(); } catch {}
    return { app_output: `status=${r.status?.()} body=${body.slice(0, 600)}` };
  });
  await step(page, { fn: 'F20', name: 'get_last_email', approach: 'happy_path', expected_routes: ['/get_last_email'] }, async () => {
    const r = await page.context().request.get(APP_URL + '/get_last_email', { timeout: 15000 }).catch(e => ({ _err: e.message, status: () => 0, text: async () => '' }));
    let body = ''; try { body = await r.text(); } catch {}
    return { app_output: body.slice(0, 500) };
  });
  for (const fmt of ['txt', 'docx', 'pdf']) {
    await step(page, { fn: 'F20', name: `download_${fmt}`, approach: 'happy_path', expected_routes: [`/download_document/${fmt}`] }, async () => {
      const r = await page.context().request.post(APP_URL + `/download_document/${fmt}`, { data: { text: 'R1 export test\n\nSecond paragraph.' }, headers: { 'Content-Type': 'application/json' }, timeout: 60000 }).catch(e => ({ _err: e.message, status: () => 0, body: async () => Buffer.alloc(0) }));
      let buf;
      try { buf = Buffer.from(await r.body()); } catch { buf = Buffer.alloc(0); }
      await writeFile(`${OUT}/outputs/exports/sample.${fmt}`, buf);
      let sigOk = true;
      if (fmt === 'pdf') sigOk = buf.slice(0, 5).toString() === '%PDF-';
      if (fmt === 'docx') sigOk = buf.slice(0, 2).toString() === 'PK';
      return { app_output: `size=${buf.length} signature_ok=${sigOk}`, extras: { size: buf.length, signature_ok: sigOk } };
    });
  }
}

async function fn21_clear_all(page) {
  await step(page, { fn: 'F21', name: 'clear_all_button', approach: 'happy_path', expected_routes: [] }, async () => {
    await page.goto(APP_URL + '/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      ['inputText', 'outputText', 'humanizerStyleInput', 'humanizerOutput'].forEach(id => {
        const el = document.getElementById(id); if (el && 'value' in el) el.value = 'preload-content';
      });
    });
    const beforeUi = await captureUiState(page, 'F21_before_clear');
    // Find CLEAR ALL button
    const found = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, [role="button"]'));
      const target = els.find(e => /clear\s*all/i.test(e.innerText || ''));
      if (!target) return { found: false };
      target.scrollIntoView();
      return { found: true, text: target.innerText, id: target.id };
    });
    if (!found.found) {
      return { app_output: 'CLEAR ALL button not found in DOM.' };
    }
    // Accept the confirm dialog
    page.once('dialog', d => d.accept().catch(() => {}));
    await page.click(`button:has-text("CLEAR ALL")`).catch(() => {});
    await new Promise(r => setTimeout(r, 500));
    const afterUi = await captureUiState(page, 'F21_after_clear');
    return { app_output: `before=${JSON.stringify({ in: !!beforeUi.inputText, hOut: !!beforeUi.humanizerOutput })} after=${JSON.stringify({ in: !!afterUi.inputText, hOut: !!afterUi.humanizerOutput })}` };
  });
}

async function fn22_action_buttons(page) {
  await step(page, { fn: 'F22', name: 'action_buttons_present', approach: 'verification', expected_routes: [] }, async () => {
    const found = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, [role="button"]'));
      const matches = all.filter(b => /ACTION/i.test(b.innerText || '')).map(b => ({ text: b.innerText, id: b.id, color: getComputedStyle(b).backgroundColor }));
      return matches;
    });
    return { app_output: `found ${found.length} ACTION buttons: ${JSON.stringify(found)}` };
  });
}

async function fn23_aggregate(page) {
  // Final scan: walk every captured output and accumulate dollar-sign + paragraph violations
  const outputDirs = ['rewrites', 'humanizer', 'assessments', 'cc', 'provider-parity'];
  let totalDollars = 0; let totalParaViols = 0; const violations = [];
  for (const d of outputDirs) {
    const dir = `${OUT}/outputs/${d}`;
    let entries;
    try { const { readdir } = await import('node:fs/promises'); entries = await readdir(dir); }
    catch { continue; }
    for (const f of entries) {
      if (!/\.(txt|md)$/.test(f)) continue;
      const text = await readFile(`${dir}/${f}`, 'utf8').catch(() => '');
      const ds = scanDollarSigns(text);
      const ps = scanParagraphLength(text);
      totalDollars += ds.count;
      totalParaViols += ps.violations.length;
      if (ds.count || ps.violations.length) {
        violations.push({ file: `${d}/${f}`, dollar_count: ds.count, paragraph_violations: ps.violations.length, max_sentences: ps.maxSentences });
      }
    }
  }
  await writeFile(`${OUT}/outputs/invariant-scans/aggregate.json`, JSON.stringify({
    total_dollar_signs: totalDollars, total_over_length_paragraphs: totalParaViols, per_file: violations
  }, null, 2));
  await step(page, { fn: 'F23', name: 'aggregate_invariant_scan', approach: 'aggregate', expected_routes: [] }, async () => {
    return { app_output: `Aggregate: ${totalDollars} dollar signs, ${totalParaViols} over-length paragraphs across ${violations.length} files with at least one issue.`, extras: { totalDollars, totalParaViols, violations } };
  });
}

// ============================================================================
// SANITY + REPORT GENERATION
// ============================================================================
function harnessSanityCheck() {
  for (const ix of state.interactions) {
    const fn = ix.function;
    // 3 screenshots for interactive, 1 for navigation
    const isInteractive = !!(ix.r1_input || ix.sse_events || ix.cc_phases_observed);
    if (isInteractive && (ix.screenshots || []).filter(Boolean).length < 2) {
      state.harnessSanity.push({ idx: ix.idx, check: 'screenshots', detail: `interactive step has ${(ix.screenshots || []).length} screenshots` });
    }
    if (ix.r1_input && ix.r1_input.length < 10 && !['fill', 'dom_inject', 'api_direct'].includes(ix.r1_input_method)) {
      state.harnessSanity.push({ idx: ix.idx, check: 'r1_input', detail: 'short input without explicit method' });
    }
    if (!ix.judge_critique || ix.judge_critique.split(/\s+/).length < 25) {
      state.harnessSanity.push({ idx: ix.idx, check: 'judge_critique', detail: 'fewer than 25 words' });
    }
    if (ix.app_output && !ix.dollar_sign_scan) {
      state.harnessSanity.push({ idx: ix.idx, check: 'invariant_scan_missing', detail: 'output present but no scan' });
    }
    if (fn === 'F14' && (!ix.cc_phases_observed || (ix.cc_chunk_timings || []).length < 1 || (ix.cc_status_polls || []).length < 1)) {
      // Only enforce for the cc_start_stream step (which captures these)
      if (ix.step === 'cc_start_stream') {
        state.harnessSanity.push({ idx: ix.idx, check: 'cc_evidence_missing', detail: `phases=${(ix.cc_phases_observed || []).length} timings=${(ix.cc_chunk_timings || []).length} polls=${(ix.cc_status_polls || []).length}` });
      }
    }
    if (fn === 'F06' && !ix.detection_scores_observed) {
      state.harnessSanity.push({ idx: ix.idx, check: 'detection_scores_missing', detail: 'F06 humanizer requires all 4 box scores' });
    }
    if (fn === 'F13' && !ix.route_used) {
      state.harnessSanity.push({ idx: ix.idx, check: 'route_used_missing', detail: 'F13 upload requires route_used populated' });
    }
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function writeReport() {
  const fn_groups = {};
  for (const ix of state.interactions) {
    (fn_groups[ix.function] = fn_groups[ix.function] || []).push(ix);
  }
  const fnTitles = {
    F01: '1. App startup + auth + initial state',
    F02: '2. Dollar-sign invariant baseline (Invariant A)',
    F03: '3. Paragraph-length invariant baseline (Invariant B)',
    F04: '4. One Click Rewrite',
    F05: '5. Customized Rewrite — Provider parity (Invariant G)',
    F06: '6. Humanizer round-trip + AI detection (Invariant I)',
    F07: '7. Cross-module sends',
    F08: '8. Translation',
    F09: '9. Style Transfer Pass-Through',
    F10: '10. AI Chat',
    F11: '11. Assessment & Maximization Suite',
    F12: "12. Devil's Advocate, Convert Fiction/Non-Fiction",
    F13: '13. File Upload Pipeline (Invariant J)',
    F14: '14. Cross-Chunk Coherence (CC) — Invariants C, D, E, F',
    F15: '15. CC failure semantics (Invariant E hard test)',
    F16: '16. Key rotation reset (Invariant H)',
    F17: '17. Audio: TTS / Audiobook / Podcast',
    F18: '18. AI Detection direct probe',
    F19: '19. Comprehensive Search',
    F20: '20. Share & Export',
    F21: '21. CLEAR ALL button',
    F22: '22. ACTION button workflow',
    F23: '23. Final aggregate invariant scan'
  };

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>R1 Run ${RUN_TS}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; color: #222; line-height: 1.5; }
h1 { border-bottom: 3px solid #333; padding-bottom: 10px; }
h2 { background: #f0f0f0; padding: 8px 12px; margin-top: 30px; border-left: 4px solid #5c8cd6; }
h3 { color: #555; margin-top: 20px; }
.toc { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #ddd; padding: 10px 0; margin-bottom: 20px; z-index: 100; }
.toc a { margin-right: 14px; font-size: 13px; }
.ix { border: 1px solid #ddd; padding: 12px; margin-bottom: 15px; border-radius: 4px; background: #fafafa; }
.ix h4 { margin: 0 0 8px 0; }
.ix .meta { font-size: 12px; color: #666; margin-bottom: 8px; }
.tag { display: inline-block; padding: 2px 8px; background: #e0e0e0; border-radius: 3px; margin-right: 4px; font-size: 11px; }
.viol { background: #d33; color: #fff; }
.ok { background: #3a8; color: #fff; }
.warn { background: #c80; color: #fff; }
pre { background: #f5f5f5; padding: 10px; border-radius: 3px; font-size: 12px; max-height: 400px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
.screenshots { display: flex; gap: 8px; flex-wrap: wrap; }
.screenshots img { max-width: 280px; border: 1px solid #ccc; }
.kv { display: grid; grid-template-columns: 200px 1fr; gap: 4px 12px; font-size: 13px; }
.kv b { color: #555; font-weight: normal; }
table.cmp { border-collapse: collapse; font-size: 12px; width: 100%; }
table.cmp td, table.cmp th { border: 1px solid #ccc; padding: 6px; vertical-align: top; }
table.cmp th { background: #eee; }
.crit-block { background: #fee; border: 2px solid #d33; padding: 12px; margin: 12px 0; }
.crit-block h3 { color: #d33; margin-top: 0; }
.judge { background: #eef; padding: 8px; border-left: 3px solid #5c8cd6; font-size: 13px; }
</style></head><body>
<h1>R1 — Classic EZ Reader Beta-Test Report</h1>
<div class="meta">Run timestamp: ${RUN_TS} | App URL: ${escapeHtml(APP_URL)} | Total interactions: ${state.interactions.length}</div>

<div class="toc">
  ${Object.keys(fnTitles).filter(k => fn_groups[k]).map(k => `<a href="#${k}">${k}</a>`).join('')}
  <a href="#invariants" style="color:#d33;font-weight:bold">⚠ INVARIANTS</a>
</div>

<div class="crit-block" id="invariants">
  <h3>CRITICAL INVARIANT VIOLATIONS (${state.invariantViolations.length})</h3>
  ${state.invariantViolations.length === 0 ? '<p>None.</p>' : state.invariantViolations.map(v => `
    <div class="ix">
      <span class="tag viol">Invariant ${escapeHtml(v.invariant)}</span>
      <span class="tag">${escapeHtml(v.function || '')} / ${escapeHtml(v.step || '')}</span>
      <pre>${escapeHtml(JSON.stringify(v.detail, null, 2))}</pre>
    </div>`).join('')}
  <h3>JUDGE CONCERNS (${state.judgeConcerns.length})</h3>
  ${state.judgeConcerns.length === 0 ? '<p>None.</p>' : state.judgeConcerns.map(c => `
    <div class="ix"><span class="tag warn">${escapeHtml((c.concerns || []).join(', '))}</span> <span class="tag">${escapeHtml(c.function)} / ${escapeHtml(c.step)}</span></div>`).join('')}
  <h3>HARNESS SANITY FAILURES (${state.harnessSanity.length})</h3>
  ${state.harnessSanity.length === 0 ? '<p>None.</p>' : state.harnessSanity.map(s => `<div class="ix"><span class="tag warn">${escapeHtml(s.check)}</span> ix=${s.idx} — ${escapeHtml(s.detail)}</div>`).join('')}
</div>

${Object.keys(fnTitles).filter(k => fn_groups[k]).map(k => `
<h2 id="${k}">${escapeHtml(fnTitles[k])}</h2>
${fn_groups[k].map(ix => `
  <div class="ix">
    <h4>${escapeHtml(ix.step)} <span class="tag">${escapeHtml(ix.approach || '')}</span> ${ix.error ? '<span class="tag viol">ERROR</span>' : ''}</h4>
    <div class="meta">interaction #${ix.idx} | elapsed ${ix.elapsed_ms ?? '—'} ms | input method: ${ix.r1_input_method || '—'} | click method: ${ix.r1_click_method || '—'}</div>
    ${ix.expected_routes?.length ? `<div class="meta"><b>Expected routes:</b> ${ix.expected_routes.map(r => `<span class="tag">${escapeHtml(r)}</span>`).join('')}</div>` : ''}
    ${ix.network_calls?.length ? `<div class="meta"><b>Routes observed:</b> ${ix.network_calls.map(c => `<span class="tag">${escapeHtml(c.method)} ${escapeHtml(c.route)} → ${c.status}</span>`).join('')}</div>` : ''}
    ${ix.r1_input ? `<h5>R1 input</h5><pre>${escapeHtml(ix.r1_input.slice(0, 4000))}</pre>` : ''}
    ${ix.app_output ? `<h5>App output</h5><pre>${escapeHtml(ix.app_output.slice(0, 6000))}</pre>` : ''}
    ${ix.sse_events ? `<h5>SSE event types (${ix.sse_events.length})</h5><pre>${escapeHtml(ix.sse_events.map(e => e.type + (e.message ? ` — ${e.message.slice(0,80)}` : '')).slice(0, 80).join('\n'))}</pre>` : ''}
    ${ix.cc_chunk_timings?.length ? `<h5>CC chunk timings (Invariant D)</h5><table class="cmp"><tr><th>chunk</th><th>seconds</th></tr>${ix.cc_chunk_timings.map(t => `<tr><td>${t.chunk_index}</td><td>${t.seconds.toFixed(2)}</td></tr>`).join('')}</table>` : ''}
    ${ix.cc_status_polls?.length ? `<h5>CC status polls (Invariant E)</h5><pre>${escapeHtml(JSON.stringify(ix.cc_status_polls.slice(0, 20), null, 2))}</pre>` : ''}
    ${ix.owner_access_check ? `<h5>Owner-only access check (Invariant F)</h5><pre>${escapeHtml(JSON.stringify(ix.owner_access_check, null, 2))}</pre>` : ''}
    ${ix.detection_scores_observed ? `<h5>Detection scores (Invariant I)</h5><pre>${escapeHtml(JSON.stringify(ix.detection_scores_observed, null, 2))}</pre>` : ''}
    ${ix.dollar_sign_scan ? `<div class="kv"><b>Invariant A (dollar signs)</b><div><span class="tag ${ix.dollar_sign_scan.violation ? 'viol' : 'ok'}">${ix.dollar_sign_scan.count} found</span></div></div>` : ''}
    ${ix.paragraph_length_scan ? `<div class="kv"><b>Invariant B (max sentences/paragraph)</b><div><span class="tag ${ix.paragraph_length_scan.violation ? 'viol' : 'ok'}">${ix.paragraph_length_scan.maxSentences} max</span></div></div>` : ''}
    ${ix.error ? `<div class="crit-block"><b>ERROR:</b> <pre>${escapeHtml(ix.error)}</pre></div>` : ''}
    ${ix.screenshots?.length ? `<h5>Screenshots</h5><div class="screenshots">${ix.screenshots.filter(Boolean).map(s => `<a href="screenshots/${escapeHtml(s)}"><img src="screenshots/${escapeHtml(s)}" alt="${escapeHtml(s)}"/></a>`).join('')}</div>` : ''}
    ${ix.judge_critique ? `<h5>Judge critique</h5><div class="judge">${escapeHtml(ix.judge_critique)}</div>` : ''}
  </div>
`).join('')}
`).join('')}

</body></html>`;

  await writeFile(`${OUT}/report.html`, html);
}

async function writeFailures() {
  const lines = ['# R1 Run Failures', '', `Run: ${RUN_TS}`, `App: ${APP_URL}`, ''];
  lines.push('## CRITICAL INVARIANT VIOLATIONS');
  if (!state.invariantViolations.length) lines.push('_None._');
  for (const v of state.invariantViolations) {
    lines.push(`\n### Invariant ${v.invariant} — ${v.function} / ${v.step}`);
    lines.push('```json\n' + JSON.stringify(v.detail, null, 2) + '\n```');
  }
  lines.push('\n## JUDGE CONCERNS');
  if (!state.judgeConcerns.length) lines.push('_None._');
  for (const c of state.judgeConcerns) {
    lines.push(`\n### ${c.function} / ${c.step}`);
    lines.push(`- Concerns: ${(c.concerns || []).join(', ')}`);
    lines.push(`- See report.html#${c.function}`);
  }
  lines.push('\n## HARNESS SANITY FAILURES');
  if (!state.harnessSanity.length) lines.push('_None._');
  for (const s of state.harnessSanity) {
    lines.push(`- [ix=${s.idx}] ${s.check}: ${s.detail}`);
  }
  await writeFile(`${OUT}/failures.md`, lines.join('\n'));
}

async function writeRunSummary() {
  const byInv = {};
  for (const v of state.invariantViolations) byInv[v.invariant] = (byInv[v.invariant] || 0) + 1;
  let totalDollars = 0; let totalPara = 0;
  for (const ix of state.interactions) {
    if (ix.dollar_sign_scan) totalDollars += ix.dollar_sign_scan.count;
    if (ix.paragraph_length_scan) totalPara += (ix.paragraph_length_scan.violations || []).length;
  }
  const lines = [
    `INTERACTIONS: ${state.interactions.length}`,
    `JUDGE CONCERNS RAISED: ${state.judgeConcerns.length}`,
    `CRITICAL INVARIANT VIOLATIONS: ${state.invariantViolations.length}`,
    ...['A','B','C','D','E','F','G','H','I','J'].map(k => `  Invariant ${k}: ${byInv[k] || 0}`),
    `AGGREGATE DOLLAR SIGNS FOUND ACROSS ALL OUTPUTS: ${totalDollars}`,
    `AGGREGATE OVER-LENGTH PARAGRAPHS: ${totalPara}`,
    `HARNESS SANITY FAILURES: ${state.harnessSanity.length}`,
    `RUN DIRECTORY: ${OUT}`,
    `STARTED: ${new Date(state.startedAt).toISOString()}`,
    `FINISHED: ${state.finishedAt ? new Date(state.finishedAt).toISOString() : '(in progress)'}`
  ];
  await writeFile(`${OUT}/run-summary.txt`, lines.join('\n'));
  await writeFile(`${OUT}/console.log`, state.consoleLines.join('\n'));
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  await ensureDirs();
  await ensureBinaryFixtures();
  startLiveView();

  log('==================================================');
  log('R1 is running.');
  log(`Live view:    http://localhost:${LIVE_VIEW_PORT}`);
  log(`Output dir:   ${OUT}`);
  log('Watch the live view — especially the EZ Reader State panel.');
  log('Do not trust summary output alone.');
  log('==================================================');

  state.status = 'running';
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  attachNetworkCapture(page);

  const authInfo = await tryAuth(page);
  log(`[auth] mode=${authInfo.mode}`);

  const allFns = [
    ['1', fn01_startup], ['2', fn02_dollar_sign], ['3', fn03_paragraph], ['4', fn04_one_click],
    ['5', fn05_provider_parity], ['6', fn06_humanizer], ['7', fn07_cross_module], ['8', fn08_translation],
    ['9', fn09_style_passthrough], ['10', fn10_chat], ['11', fn11_assessments], ['12', fn12_devils_advocate],
    ['13', fn13_uploads], ['14', fn14_cc], ['15', fn15_cc_failure_semantics], ['16', fn16_key_reset],
    ['17', fn17_audio], ['18', fn18_detection_probe], ['19', fn19_search], ['20', fn20_share_export],
    ['21', fn21_clear_all], ['22', fn22_action_buttons], ['23', fn23_aggregate]
  ];

  for (const [num, fn] of allFns) {
    if (SKIP_FUNCTIONS.has(num)) {
      log(`[skip] Function ${num} (per SKIP_FUNCTIONS)`);
      continue;
    }
    try {
      await fn(page);
    } catch (e) {
      log(`[fn${num}] uncaught: ${e.message}\n${e.stack?.slice(0, 1200)}`);
      state.harnessSanity.push({ idx: -1, check: `fn${num}_uncaught`, detail: e.message });
    }
  }

  state.status = 'finished';
  state.finishedAt = Date.now();
  await browser.close();

  harnessSanityCheck();
  await writeReport();
  await writeFailures();
  await writeRunSummary();

  log('==================================================');
  log('R1 finished.');
  log(`Open the report:        ${OUT}/report.html`);
  log(`Open the failures:      ${OUT}/failures.md`);
  log(`Provider comparison:    ${OUT}/outputs/provider-parity/`);
  log(`CC results:             ${OUT}/outputs/cc/`);
  log(`Invariant scans:        ${OUT}/outputs/invariant-scans/`);
  log(`SSE streams:            ${OUT}/sse-streams/`);
  log(`Raw transcript:         ${OUT}/transcript.jsonl`);
  log(`Raw network log:        ${OUT}/network.log`);
  log('==================================================');

  // Exit code:
  // 0 clean, 1 judge concerns, 2 critical invariant violations, 3 harness sanity failed
  let exit = 0;
  if (state.harnessSanity.length) exit = 3;
  else if (state.invariantViolations.length) exit = 2;
  else if (state.judgeConcerns.length) exit = 1;

  // Keep live view open 60s
  log('Live view will remain open for 60 seconds...');
  await new Promise(r => setTimeout(r, 60000));
  process.exit(exit);
}

main().catch(async (e) => {
  log(`[main] FATAL: ${e.message}\n${e.stack || ''}`);
  state.status = 'finished';
  state.finishedAt = Date.now();
  state.harnessSanity.push({ idx: -1, check: 'fatal', detail: e.message });
  try { await writeRunSummary(); } catch {}
  process.exit(3);
});
