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
const VISION_MODEL = process.env.VISION_MODEL || (ANTHROPIC_KEY ? 'claude-sonnet-4-6' : 'gpt-4o-mini');
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

async function fetchWithTimeout(url, opts = {}, ms = 60000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(id); }
}

async function transcribePageImage(b64) {
  if (ANTHROPIC_KEY) {
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
            { type: 'text', text: TRANSCRIBE_PROMPT },
          ],
        }],
      }),
    }, 120000);
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return (data.content || []).map((b) => b.text || '').join('').trim();
  }
  if (OPENAI_KEY) {
    const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: TRANSCRIBE_PROMPT },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
          ],
        }],
      }),
    }, 120000);
    if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || '').trim();
  }
  throw new Error('no vision API key (set ANTHROPIC_API_KEY or OPENAI_API_KEY)');
}

/**
 * Transcribe a whole PDF directly via Anthropic's document support — no
 * page-rendering, no poppler. Claude reads image/scanned PDFs with vision.
 */
async function transcribePdfViaAnthropic(buf, label) {
  const b64 = buf.toString('base64');
  process.stdout.write(`\r[ingest]   transcribing ${label} (PDF → Claude)…  `);
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
          { type: 'text', text: DOC_TRANSCRIBE_PROMPT },
        ],
      }],
    }),
  }, 180000);
  process.stdout.write('\n');
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (data.stop_reason === 'max_tokens') {
    console.warn(`[ingest]   ⚠ ${label}: hit max_tokens — transcription may be truncated (long paper).`);
  }
  return cleanText((data.content || []).map((b) => b.text || '').join(''));
}

/** Dispatch the no-text-layer path: Anthropic PDF (no poppler) or OpenAI images. */
async function extractNonTextLayer(buf, label) {
  if (ANTHROPIC_KEY) return transcribePdfViaAnthropic(buf, label);
  return visionTranscribe(buf, label); // OpenAI image path (requires poppler)
}

/** Render a PDF buffer to page PNGs (poppler) and vision-transcribe each. */
async function visionTranscribe(buf, label) {
  const work = mkdtempSync(join(tmpdir(), 'polity-'));
  const pdfPath = join(work, 'in.pdf');
  writeFileSync(pdfPath, buf);
  try {
    execFileSync('pdftoppm', ['-png', '-r', String(DPI), pdfPath, join(work, 'page')], { stdio: 'ignore' });
    const pages = readdirSync(work)
      .filter((f) => f.startsWith('page') && f.endsWith('.png'))
      .sort((a, b) => (Number(a.match(/(\d+)\.png$/)?.[1] ?? 0)) - (Number(b.match(/(\d+)\.png$/)?.[1] ?? 0)));
    const parts = [];
    for (let i = 0; i < pages.length; i += 1) {
      process.stdout.write(`\r[ingest]   transcribing ${label} page ${i + 1}/${pages.length}  `);
      const b64 = readFileSync(join(work, pages[i])).toString('base64');
      try { const md = await transcribePageImage(b64); if (md) parts.push(md); }
      catch (e) { parts.push(`<!-- page ${i + 1} transcription failed: ${e.message} -->`); }
    }
    process.stdout.write('\n');
    return cleanText(parts.join('\n\n'));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
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

  const popplerOk = havePoppler();
  const keyOk = !!(ANTHROPIC_KEY || OPENAI_KEY);
  if (!DRY) {
    if (!keyOk) { console.error('[ingest] no vision API key. Export ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY.'); process.exit(1); }
    // poppler is ONLY needed for the OpenAI image-rendering fallback.
    if (!ANTHROPIC_KEY && OPENAI_KEY && !popplerOk) {
      console.error('[ingest] OpenAI fallback needs poppler (brew install poppler) — or just set ANTHROPIC_API_KEY (no poppler needed).');
      process.exit(1);
    }
    console.log(`[ingest] vision model: ${VISION_MODEL}${ANTHROPIC_KEY ? ' (PDF→Claude, no poppler)' : ` (OpenAI images, DPI ${DPI})`}`);
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
    if (hasTextLayer) { text = parsedText; textCount++; }
    else { text = await extractNonTextLayer(buf, p.title); visionCount++; }
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
    const readiness = ANTHROPIC_KEY
      ? 'Anthropic key OK — PDF→Claude, no poppler needed'
      : OPENAI_KEY
        ? `OpenAI key OK — needs ${havePoppler() ? 'poppler OK' : 'brew install poppler'}`
        : 'no API key — export ANTHROPIC_API_KEY (preferred)';
    console.log(`[ingest]   vision readiness: ${readiness}`);
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
