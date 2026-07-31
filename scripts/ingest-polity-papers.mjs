#!/usr/bin/env node
/**
 * ingest-polity-papers.mjs — convert the Qriptopian Polity Paper series (PDFs)
 * into machine-readable constitutional commentary inside Polity Core.
 *
 * The published papers are image/vector PDFs with NO text layer (pdf-parse
 * yields ~1 word for a 12-page paper), so extraction is hybrid:
 *   1. Try pdf-parse (fast) — used when the PDF has a real text layer.
 *   2. Otherwise VISION TRANSCRIBE the PDF to Markdown:
 *      - Anthropic (preferred): send the PDF directly as a document block to
 *        claude-sonnet-4-6 — NO page-rendering / no poppler needed. Claude reads
 *        image/scanned PDFs natively with built-in vision.
 *      - OpenAI fallback: render pages to PNG with poppler (pdftoppm) and
 *        transcribe each with gpt-4o-mini. (Only this path needs poppler.)
 *
 * Runs on a machine with network access (not the sandbox; not Lambda).
 *
 * Requirements for the vision path:
 *   - an API key exported locally:
 *       export ANTHROPIC_API_KEY=sk-ant-...   (preferred — needs nothing else)
 *       export OPENAI_API_KEY=sk-...          (fallback — also needs: brew install poppler)
 *
 * Usage:
 *   node scripts/ingest-polity-papers.mjs --host=https://dev-beta.aigentz.me --dry-run
 *   node scripts/ingest-polity-papers.mjs --host=https://dev-beta.aigentz.me --limit=1
 *   node scripts/ingest-polity-papers.mjs --host=https://dev-beta.aigentz.me
 *
 * --dry-run : enumerate + decide pdf-parse vs vision per paper; NO vision calls,
 *             NO files written (free, instant — use it to preview the plan).
 * --limit=N : only process the first N in-scope papers (validate quality/cost).
 * --dpi=N   : page render DPI for vision (default 150).
 *
 * After a real run: review the diff, commit the generated markdown + JSON,
 * deploy, then POST /api/admin/kb/ingest-polity-commentary.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, mkdtempSync,
} from 'node:fs';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const PACK = join(REPO, 'codexes/packs/polity-core');
const COMMENTARY_DIR = join(PACK, 'items/commentary');
const COLLECTIONS = join(PACK, 'collections.json');
const COMMENTARY_JSON = join(REPO, 'services/polity/frameworks/polity-papers-commentary.v1.json');
const CONSTITUTION_JSON = join(REPO, 'services/polity/frameworks/constitution-agentic-polity.v1.json');
const CONSTITUTION_MD = join(PACK, 'items/CONSTITUTION_OF_AGENTIC_POLITY.md');

const ARGS = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const HOST = (ARGS.host || '').toString().replace(/\/$/, '');
const DRY = !!ARGS['dry-run'];
const LIMIT = ARGS.limit ? Number(ARGS.limit) : Infinity;
const DPI = ARGS.dpi ? Number(ARGS.dpi) : 150;
if (!HOST) {
  console.error('Missing --host. e.g. node scripts/ingest-polity-papers.mjs --host=https://dev-beta.aigentz.me');
  process.exit(1);
}

const SERIES = {
  'papers/experience-sovereignty': { id: 'experience-sovereignty', dir: 'experience-sovereignty', collection: 'col_commentary_experience_sovereignty' },
  'papers/coyn-thesis':            { id: 'coyn-thesis',            dir: 'coyn-thesis',            collection: 'col_commentary_coyn_thesis' },
  'papers/polity':                 { id: 'polity',                dir: 'polity',                 collection: 'col_commentary_polity' },
};

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const VENICE_KEY = process.env.VENICE_API_KEY;
const VISION_MODEL = process.env.VISION_MODEL || 'claude-sonnet-4-6';
const OPENAI_BASE = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
const VENICE_BASE = process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1';
const VENICE_MODEL = process.env.VENICE_MODEL || 'qwen-2.5-vl';
const providerOrder = [ANTHROPIC_KEY && 'anthropic', OPENAI_KEY && 'openai', VENICE_KEY && 'venice'].filter(Boolean);
// Output cap for a whole-document transcription. Sonnet 4.x supports a large
// output window; long papers (20–30pp) need it to avoid truncation. Override
// with VISION_MAX_TOKENS if your model rejects this value.
const VISION_MAX_TOKENS = Number(process.env.VISION_MAX_TOKENS || 32000);
const TEXT_LAYER_MIN_WORDS_PER_PAGE = 20; // below this ⇒ treat as image PDF

const TRANSCRIBE_PROMPT =
  'Transcribe this document page to clean Markdown. Preserve headings, lists, ' +
  'paragraphs, block quotes, and reading order (handle multiple columns top-to-bottom, ' +
  'left-to-right). Do not add commentary, page numbers, or anything not on the page. ' +
  'Omit purely decorative graphics. Output ONLY the Markdown for this page.';

const DOC_TRANSCRIBE_PROMPT =
  'Transcribe this ENTIRE document to clean, faithful Markdown — every page, in order. ' +
  'Preserve headings, lists, paragraphs, block quotes, and tables; keep reading order ' +
  '(handle multi-column layouts top-to-bottom, left-to-right). Do not summarise, do not ' +
  'add commentary or page numbers, and do not invent text that is not present. Omit purely ' +
  'decorative graphics. Output ONLY the Markdown.';

function slugify(s) {
  return s.toLowerCase().replace(/^\s*\d{1,4}\s*[.\-:)]?\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'paper';
}
function leadingNumber(title) {
  const m = title.match(/^\s*(\d{1,4})\s*[.\-:)]?\s+/);
  return m ? Number(m[1]) : null;
}
function cleanText(raw) {
  return raw.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function wordCount(t) { return t.split(/\s+/).filter(Boolean).length; }
function extractArticles(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (/^(preamble|article\s+[ivxlcdm0-9]+|section\s+[0-9]+|chapter\s+[ivxlcdm0-9]+)\b/i.test(t) && t.length < 120) out.push(t);
  }
  return out.slice(0, 60);
}

function havePoppler() {
  try { execFileSync('pdftoppm', ['-v'], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

/** Verify the Anthropic key up front so a bad key fails clearly (not per-paper). */
async function preflightAnthropicKey() {
  if (!ANTHROPIC_KEY) return { ok: true };
  if (/your-real-key|\.\.\.|REPLACE|PASTE|sk-ant-\.\.\./i.test(ANTHROPIC_KEY)) {
    return { ok: false, msg: `ANTHROPIC_API_KEY looks like the placeholder ("${ANTHROPIC_KEY.slice(0, 14)}…"). Export your REAL key from console.anthropic.com → API Keys, in THIS terminal.` };
  }
  try {
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    }, 20000);
    if (res.status === 401) {
      return { ok: false, msg: 'ANTHROPIC_API_KEY was rejected (401 invalid x-api-key). Check `echo $ANTHROPIC_API_KEY` in THIS terminal shows your real sk-ant-… key (export is per-shell — set it in the same window you run node from).' };
    }
    if (!res.ok) return { ok: true, warn: `Anthropic /models returned ${res.status} (continuing).` };
    return { ok: true };
  } catch (e) {
    return { ok: true, warn: `Anthropic /models check failed (${e.message}); continuing.` };
  }
}

async function fetchWithTimeout(url, opts = {}, ms = 60000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(id); }
}

/** One OpenAI-compatible chat transcription with a PDF document content block. */
async function openaiCompatPdfTranscribe(base, key, model, fileBlock) {
  const res = await fetchWithTimeout(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: VISION_MAX_TOKENS,
      messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: DOC_TRANSCRIBE_PROMPT }] }],
    }),
  }, 300000);
  if (!res.ok) {
    const e = new Error(`${res.status}: ${(await res.text()).slice(0, 200).replace(/\s+/g, ' ')}`);
    e.status = res.status;
    throw e;
  }
  const data = await res.json();
  return cleanText(data.choices?.[0]?.message?.content || '');
}

/** Upload a PDF to OpenAI Files (for large PDFs) → file_id. */
async function uploadPdfToOpenAI(buf) {
  const fd = new FormData();
  fd.append('purpose', 'user_data');
  fd.append('file', new Blob([buf], { type: 'application/pdf' }), 'paper.pdf');
  const res = await fetchWithTimeout(`${OPENAI_BASE}/files`, { method: 'POST', headers: { Authorization: `Bearer ${OPENAI_KEY}` }, body: fd }, 120000);
  if (!res.ok) throw new Error(`openai files ${res.status}: ${(await res.text()).slice(0, 160).replace(/\s+/g, ' ')}`);
  return (await res.json()).id;
}

/** OpenAI PDF transcription — inline file_data first, Files API for large PDFs. */
async function transcribePdfViaOpenAI(buf) {
  const b64 = buf.toString('base64');
  try {
    return await openaiCompatPdfTranscribe(OPENAI_BASE, OPENAI_KEY, OPENAI_VISION_MODEL, {
      type: 'file', file: { filename: 'paper.pdf', file_data: `data:application/pdf;base64,${b64}` },
    });
  } catch (e) {
    if (!/413|too.large|maximum size/i.test(e.message)) throw e;
  }
  const fileId = await uploadPdfToOpenAI(buf);
  return openaiCompatPdfTranscribe(OPENAI_BASE, OPENAI_KEY, OPENAI_VISION_MODEL, { type: 'file', file: { file_id: fileId } });
}

/** Venice (OpenAI-compatible) PDF transcription — best effort; PDF support varies. */
async function transcribePdfViaVenice(buf) {
  const b64 = buf.toString('base64');
  return openaiCompatPdfTranscribe(VENICE_BASE, VENICE_KEY, VENICE_MODEL, {
    type: 'file', file: { filename: 'paper.pdf', file_data: `data:application/pdf;base64,${b64}` },
  });
}

/** One Anthropic transcription call given a document source block. */
async function anthropicTranscribe(sourceBlock, extraHeaders = {}) {
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: VISION_MAX_TOKENS,
      messages: [{ role: 'user', content: [sourceBlock, { type: 'text', text: DOC_TRANSCRIBE_PROMPT }] }],
    }),
  }, 300000);
  if (!res.ok) {
    const e = new Error(`${res.status}: ${(await res.text()).slice(0, 200).replace(/\s+/g, ' ')}`);
    e.status = res.status;
    throw e;
  }
  const data = await res.json();
  if (data.stop_reason === 'max_tokens') {
    console.warn(`\n[ingest]   ⚠ hit max_tokens — may be truncated (raise VISION_MAX_TOKENS).`);
  }
  return cleanText((data.content || []).map((b) => b.text || '').join(''));
}

/** Upload a PDF to the Anthropic Files API → returns file_id. */
async function uploadPdfToAnthropic(buf) {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'application/pdf' }), 'paper.pdf');
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/files', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'files-api-2025-04-14' },
    body: fd,
  }, 120000);
  if (!res.ok) {
    const e = new Error(`files ${res.status}: ${(await res.text()).slice(0, 200).replace(/\s+/g, ' ')}`);
    e.status = res.status;
    throw e;
  }
  return (await res.json()).id;
}

/**
 * Transcribe a whole PDF via Anthropic — no poppler. Tries delivery methods in
 * order so a size/support limit on one path doesn't block the run:
 *   1. URL source   (PDF fetched by Claude; no request bloat)
 *   2. Files API     (upload → file_id; robust for large image PDFs)
 *   3. base64 inline (works for small PDFs)
 */
async function transcribePdfViaAnthropic(pdfUrl, buf) {
  const errs = [];
  try {
    return await anthropicTranscribe({ type: 'document', source: { type: 'url', url: pdfUrl } });
  } catch (e) { errs.push(`url(${e.message})`); }
  try {
    const fileId = await uploadPdfToAnthropic(buf);
    return await anthropicTranscribe(
      { type: 'document', source: { type: 'file', file_id: fileId } },
      { 'anthropic-beta': 'files-api-2025-04-14' },
    );
  } catch (e) { errs.push(`files(${e.message})`); }
  try {
    return await anthropicTranscribe({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } });
  } catch (e) { errs.push(`base64(${e.message})`); }
  throw new Error(errs.join(' · '));
}

/**
 * Transcribe a no-text-layer PDF via the provider chain (Anthropic → OpenAI →
 * Venice), falling through on any failure (e.g. Anthropic out of credits). All
 * providers take the PDF directly — no poppler / page rendering.
 */
async function extractNonTextLayer(buf, label, url) {
  const errs = [];
  for (const provider of providerOrder) {
    process.stdout.write(`\r[ingest]   transcribing ${label} via ${provider}…            `);
    try {
      const t =
        provider === 'anthropic' ? await transcribePdfViaAnthropic(url, buf)
        : provider === 'openai' ? await transcribePdfViaOpenAI(buf)
        : await transcribePdfViaVenice(buf);
      if (t && t.trim()) { process.stdout.write('\n'); return t; }
      errs.push(`${provider}(empty)`);
    } catch (e) {
      errs.push(`${provider}(${e.message})`);
    }
  }
  process.stdout.write('\n');
  throw new Error(`all vision providers failed — ${errs.join(' | ')}`);
}

async function main() {
  console.log(`[ingest] enumerating papers from ${HOST}/api/codex/qripto/papers`);
  const res = await fetchWithTimeout(`${HOST}/api/codex/qripto/papers?group=papers`, {}, 30000);
  if (!res.ok) throw new Error(`papers API ${res.status}`);
  const { papers = [] } = await res.json();
  let inScope = papers.filter((p) => SERIES[p.scope]);
  if (Number.isFinite(LIMIT)) inScope = inScope.slice(0, LIMIT);
  console.log(`[ingest] ${papers.length} papers total · processing ${inScope.length} in the three constitutional series`);
  if (inScope.length === 0) { console.warn('[ingest] nothing in scope.'); return; }

  const keyOk = providerOrder.length > 0;
  if (!DRY) {
    if (!keyOk) { console.error('[ingest] no vision provider key. Export ANTHROPIC_API_KEY, OPENAI_API_KEY, or VENICE_API_KEY.'); process.exit(1); }
    // Preflight Anthropic — non-fatal if a fallback provider is configured.
    const pf = await preflightAnthropicKey();
    if (!pf.ok) {
      const fallbacks = [OPENAI_KEY && 'OpenAI', VENICE_KEY && 'Venice'].filter(Boolean);
      if (fallbacks.length) console.warn(`[ingest] Anthropic unavailable (${pf.msg}) — falling back to ${fallbacks.join(' → ')}.`);
      else { console.error(`[ingest] ${pf.msg}`); process.exit(1); }
    } else if (pf.warn) {
      console.warn(`[ingest] ${pf.warn}`);
    }
    console.log(`[ingest] vision providers (fallback order): ${providerOrder.join(' → ')} · models: anthropic=${VISION_MODEL} openai=${OPENAI_VISION_MODEL} venice=${VENICE_MODEL}`);
    for (const s of Object.values(SERIES)) {
      const d = join(COMMENTARY_DIR, s.dir);
      if (existsSync(d)) rmSync(d, { recursive: true, force: true });
    }
  }

  const commentary = JSON.parse(readFileSync(COMMENTARY_JSON, 'utf8'));
  const collections = JSON.parse(readFileSync(COLLECTIONS, 'utf8'));
  const seriesPapers = { 'experience-sovereignty': [], 'coyn-thesis': [], 'polity': [] };
  const collectionItems = { col_commentary_experience_sovereignty: [], col_commentary_coyn_thesis: [], col_commentary_polity: [] };
  let constitutionFilled = false;
  let visionCount = 0;
  let textCount = 0;

  for (const p of inScope) {
    const cfg = SERIES[p.scope];
    const num = leadingNumber(p.title);
    const slug = slugify(p.title);
    const relPath = `items/commentary/${cfg.dir}/${String(num ?? 0).padStart(2, '0')}-${slug}.md`;

    let buf;
    let pages = 0;
    try {
      const pdfRes = await fetchWithTimeout(p.pdfUrl, {}, 90000);
      if (!pdfRes.ok) throw new Error(`pdf ${pdfRes.status}`);
      buf = Buffer.from(await pdfRes.arrayBuffer());
      const parsed = await pdfParse(buf).catch(() => ({ text: '', numpages: 0 }));
      pages = parsed.numpages ?? 0;
      var parsedText = cleanText(parsed.text || '');
    } catch (e) {
      console.log(`[ingest] ${p.scopeLabel} · ${p.title} … DOWNLOAD FAILED (${e.message}) — skipping`);
      continue;
    }

    const wc = wordCount(parsedText);
    const hasTextLayer = pages > 0 && wc >= pages * TEXT_LAYER_MIN_WORDS_PER_PAGE;
    const method = hasTextLayer ? 'pdf-parse' : 'vision';
    console.log(`[ingest] ${p.scopeLabel} · ${p.title} … ${pages} pages, ${wc} words → ${method}`);

    if (DRY) { (method === 'vision' ? visionCount++ : textCount++); continue; }

    let text;
    try {
      text = hasTextLayer ? parsedText : await extractNonTextLayer(buf, p.title, p.pdfUrl);
    } catch (e) {
      console.log(`[ingest]   extraction failed (${e.message}) — skipping this paper`);
      continue;
    }
    if (hasTextLayer) textCount++; else visionCount++;
    if (!text.trim()) { console.log(`[ingest]   (empty after ${method}) — skipping`); continue; }

    const wcFinal = wordCount(text);
    const fm = [
      '---',
      `title: ${JSON.stringify(p.title)}`,
      `series: ${cfg.id}`,
      `scope: ${p.scope}`,
      `scopeLabel: ${JSON.stringify(p.scopeLabel)}`,
      num != null ? `paperNumber: ${num}` : null,
      `classification: ${p.scope === 'papers/polity' && num === 4 ? 'constitutional' : 'commentary'}`,
      `sourceUrl: ${JSON.stringify(p.pdfUrl)}`,
      `extraction: ${method}`,
      `wordCount: ${wcFinal}`,
      `extractedAt: ${JSON.stringify(new Date().toISOString())}`,
      'extractedBy: scripts/ingest-polity-papers.mjs',
      '---', '',
      `# ${p.title}`, '',
      `> Machine-readable extraction of a Polity Paper (${p.scopeLabel} series), held as constitutional commentary. Source PDF: ${p.pdfUrl}`,
      '', text, '',
    ].filter((l) => l !== null).join('\n');

    mkdirSync(join(COMMENTARY_DIR, cfg.dir), { recursive: true });
    writeFileSync(join(PACK, relPath), fm, 'utf8');

    seriesPapers[cfg.id].push({
      id: `${cfg.id}-${slug}`, paperNumber: num, title: p.title, scope: p.scope,
      markdownPath: relPath, sourceUrl: p.pdfUrl, autoDriveCid: p.autoDriveCid ?? null,
      extraction: method, wordCount: wcFinal,
    });
    collectionItems[cfg.collection].push(relPath);

    const isConstitution = p.scope === 'papers/polity' && (num === 4 || /constitution of the agentic polity/i.test(p.title));
    if (isConstitution && !constitutionFilled) {
      const md = [
        '---', `title: ${JSON.stringify(p.title)}`, 'classification: constitutional', 'status: ratified',
        `sourceUrl: ${JSON.stringify(p.pdfUrl)}`, `extraction: ${method}`, `wordCount: ${wcFinal}`,
        `extractedAt: ${JSON.stringify(new Date().toISOString())}`, '---', '',
        `# ${p.title}`, '',
        '> The foundational constitution of the Agentic Polity — the 4th paper of the Polity series, elevated to ratified constitutional status in Polity Core. The operative Agent Passport binding triple still references constitution.v1.json; binding this document is a separate governance act.',
        '', text, '',
      ].join('\n');
      writeFileSync(CONSTITUTION_MD, md, 'utf8');
      const cj = JSON.parse(readFileSync(CONSTITUTION_JSON, 'utf8'));
      cj.summary = text.slice(0, 600).replace(/\n+/g, ' ').trim();
      cj.articles = extractArticles(text);
      cj.sourceUrl = p.pdfUrl;
      cj.autoDriveCid = p.autoDriveCid ?? null;
      cj.wordCount = wcFinal;
      cj.generatedAt = new Date().toISOString();
      writeFileSync(CONSTITUTION_JSON, JSON.stringify(cj, null, 2) + '\n', 'utf8');
      constitutionFilled = true;
      console.log(`[ingest]   ↑ elevated to constitutional: ${p.title}`);
    }
  }

  if (DRY) {
    console.log(`\n[ingest] DRY RUN — no files written, no vision calls.`);
    console.log(`[ingest]   would use pdf-parse: ${textCount} · would vision-transcribe: ${visionCount}`);
    console.log(`[ingest]   vision providers (fallback order): ${providerOrder.length ? providerOrder.join(' → ') : 'NONE — export ANTHROPIC_API_KEY / OPENAI_API_KEY / VENICE_API_KEY'}`);
    return;
  }

  for (const s of commentary.series) s.papers = seriesPapers[s.id] ?? [];
  commentary.generatedAt = new Date().toISOString();
  writeFileSync(COMMENTARY_JSON, JSON.stringify(commentary, null, 2) + '\n', 'utf8');

  for (const col of collections.collections) {
    if (collectionItems[col.id]) {
      col.items = collectionItems[col.id].length > 0 ? collectionItems[col.id] : ['items/commentary/README.md'];
    }
  }
  writeFileSync(COLLECTIONS, JSON.stringify(collections, null, 2) + '\n', 'utf8');

  const total = Object.values(seriesPapers).reduce((a, b) => a + b.length, 0);
  console.log(`\n[ingest] done: ${total} papers ingested (${textCount} text-layer, ${visionCount} vision).`);
  console.log(`[ingest]   Experience Sovereignty: ${seriesPapers['experience-sovereignty'].length} · COYN Thesis: ${seriesPapers['coyn-thesis'].length} · The Polity: ${seriesPapers['polity'].length}`);
  console.log(`[ingest]   Constitution elevated: ${constitutionFilled ? 'yes' : 'NO (paper #4 not found)'}`);
  console.log('\n[ingest] Next steps:');
  console.log('[ingest]   1. Review the diff, commit the generated markdown + JSON, and deploy.');
  console.log('[ingest]   2. Ingest into the Knowledge Base:');
  console.log(`[ingest]        curl -X POST -H "Authorization: Bearer $ADMIN_OPS_TOKEN" ${HOST}/api/admin/kb/ingest-polity-commentary`);
}

main().catch((e) => { console.error('[ingest] error:', e); process.exit(1); });
