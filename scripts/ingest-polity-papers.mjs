#!/usr/bin/env node
/**
 * ingest-polity-papers.mjs — convert the Qriptopian Polity Paper series (PDFs)
 * into machine-readable constitutional commentary inside Polity Core.
 *
 * Why a script (not a Lambda route): PDF text extraction (pdf-parse / pdfjs)
 * is unreliable on AWS Lambda (see CLAUDE.md "Grids of PDF Assets"), and the
 * Claude Code sandbox has no outbound network. This runs on a machine with
 * network access (your laptop or CI) and commits the generated markdown + JSON.
 *
 * What it does:
 *   1. Enumerates papers via the PUBLIC API GET {host}/api/codex/qripto/papers
 *      (no auth; PDF URLs returned are public Supabase storage URLs).
 *   2. Filters to the three constitutional series:
 *        papers/experience-sovereignty, papers/coyn-thesis, papers/polity
 *   3. Downloads each PDF and extracts text via pdf-parse.
 *   4. Writes machine-readable markdown (with YAML frontmatter) to
 *        codexes/packs/polity-core/items/commentary/<series>/<NN-slug>.md
 *   5. Regenerates the machine-readable index
 *        services/polity/frameworks/polity-papers-commentary.v1.json
 *      and rewrites the three commentary collections in
 *        codexes/packs/polity-core/collections.json
 *   6. Elevates "The Constitution of the Agentic Polity" (Polity series,
 *      paper #4): writes items/CONSTITUTION_OF_AGENTIC_POLITY.md and fills
 *      services/polity/frameworks/constitution-agentic-polity.v1.json.
 *
 * Usage:
 *   node scripts/ingest-polity-papers.mjs --host=https://dev-beta.aigentz.me
 *   node scripts/ingest-polity-papers.mjs --host=... --dry-run
 *
 * After it runs, review the diff and commit the generated markdown + JSON.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
// Require the lib entry directly — pdf-parse's index.js runs debug code that
// reads a bundled test PDF when module.parent is falsy (true under ESM
// createRequire), which would crash on import.
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
if (!HOST) {
  console.error('Missing --host. Example: node scripts/ingest-polity-papers.mjs --host=https://dev-beta.aigentz.me');
  process.exit(1);
}

// The three series we treat as constitutional commentary, mapped to the
// commentary collection ids + output sub-directory + framework series id.
const SERIES = {
  'papers/experience-sovereignty': { id: 'experience-sovereignty', dir: 'experience-sovereignty', collection: 'col_commentary_experience_sovereignty' },
  'papers/coyn-thesis':            { id: 'coyn-thesis',            dir: 'coyn-thesis',            collection: 'col_commentary_coyn_thesis' },
  'papers/polity':                 { id: 'polity',                dir: 'polity',                 collection: 'col_commentary_polity' },
};

function slugify(s) {
  return s.toLowerCase().replace(/^\s*\d{1,4}\s*[.\-:)]?\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'paper';
}
function leadingNumber(title) {
  const m = title.match(/^\s*(\d{1,4})\s*[.\-:)]?\s+/);
  return m ? Number(m[1]) : null;
}
function cleanText(raw) {
  return raw
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function extractArticles(text) {
  // Heuristic: lines that read like constitutional headings.
  const out = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (/^(preamble|article\s+[ivxlcdm0-9]+|section\s+[0-9]+|chapter\s+[ivxlcdm0-9]+)\b/i.test(t) && t.length < 120) {
      out.push(t);
    }
  }
  return out.slice(0, 60);
}

async function main() {
  console.log(`[ingest] enumerating papers from ${HOST}/api/codex/qripto/papers`);
  const res = await fetch(`${HOST}/api/codex/qripto/papers?group=papers`);
  if (!res.ok) throw new Error(`papers API ${res.status}`);
  const { papers = [] } = await res.json();
  const inScope = papers.filter((p) => SERIES[p.scope]);
  console.log(`[ingest] ${papers.length} papers total · ${inScope.length} in the three constitutional series`);
  if (inScope.length === 0) {
    console.warn('[ingest] no papers in scope — nothing to do (are the papers uploaded + the host correct?)');
    return;
  }

  // Regenerate commentary markdown — wipe prior generated sub-dirs first so
  // re-runs are idempotent (keeps README.md).
  for (const s of Object.values(SERIES)) {
    const d = join(COMMENTARY_DIR, s.dir);
    if (existsSync(d) && !DRY) rmSync(d, { recursive: true, force: true });
  }

  const commentary = JSON.parse(readFileSync(COMMENTARY_JSON, 'utf8'));
  const collections = JSON.parse(readFileSync(COLLECTIONS, 'utf8'));
  const seriesPapers = { 'experience-sovereignty': [], 'coyn-thesis': [], 'polity': [] };
  const collectionItems = {
    col_commentary_experience_sovereignty: [],
    col_commentary_coyn_thesis: [],
    col_commentary_polity: [],
  };
  let constitutionFilled = false;

  for (const p of inScope) {
    const cfg = SERIES[p.scope];
    const num = leadingNumber(p.title);
    const slug = slugify(p.title);
    const fileName = `${String(num ?? 0).padStart(2, '0')}-${slug}.md`;
    const relPath = `items/commentary/${cfg.dir}/${fileName}`;

    process.stdout.write(`[ingest] ${p.scopeLabel} · ${p.title} … `);
    let text = '';
    let pages = null;
    try {
      const pdfRes = await fetch(p.pdfUrl);
      if (!pdfRes.ok) throw new Error(`pdf ${pdfRes.status}`);
      const buf = Buffer.from(await pdfRes.arrayBuffer());
      const parsed = await pdfParse(buf);
      text = cleanText(parsed.text || '');
      pages = parsed.numpages ?? null;
      console.log(`${text.split(/\s+/).length} words, ${pages} pages`);
    } catch (e) {
      console.log(`FAILED (${e.message}) — skipping`);
      continue;
    }
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    const frontmatter = [
      '---',
      `title: ${JSON.stringify(p.title)}`,
      `series: ${cfg.id}`,
      `scope: ${p.scope}`,
      `scopeLabel: ${JSON.stringify(p.scopeLabel)}`,
      num != null ? `paperNumber: ${num}` : null,
      `classification: ${p.scope === 'papers/polity' && num === 4 ? 'constitutional' : 'commentary'}`,
      `sourceUrl: ${JSON.stringify(p.pdfUrl)}`,
      p.autoDriveCid ? `autoDriveCid: ${JSON.stringify(p.autoDriveCid)}` : null,
      `wordCount: ${wordCount}`,
      `extractedAt: ${JSON.stringify(new Date().toISOString())}`,
      `extractedBy: scripts/ingest-polity-papers.mjs`,
      '---',
      '',
      `# ${p.title}`,
      '',
      `> Machine-readable extraction of a Polity Paper (${p.scopeLabel} series), held as constitutional commentary. Source PDF: ${p.pdfUrl}`,
      '',
      text,
      '',
    ].filter((l) => l !== null).join('\n');

    if (!DRY) {
      mkdirSync(join(COMMENTARY_DIR, cfg.dir), { recursive: true });
      writeFileSync(join(PACK, relPath), frontmatter, 'utf8');
    }

    seriesPapers[cfg.id].push({
      id: `${cfg.id}-${slug}`,
      paperNumber: num,
      title: p.title,
      scope: p.scope,
      markdownPath: relPath,
      sourceUrl: p.pdfUrl,
      autoDriveCid: p.autoDriveCid ?? null,
      wordCount,
    });
    collectionItems[cfg.collection].push(relPath);

    // Elevate the Constitution of the Agentic Polity (Polity series, #4 OR
    // title match) to ratified constitutional status.
    const isConstitution =
      p.scope === 'papers/polity' &&
      (num === 4 || /constitution of the agentic polity/i.test(p.title));
    if (isConstitution && !constitutionFilled) {
      const articles = extractArticles(text);
      const summary = text.slice(0, 600).replace(/\n+/g, ' ').trim();
      if (!DRY) {
        const md = [
          '---',
          `title: ${JSON.stringify(p.title)}`,
          'classification: constitutional',
          'status: ratified',
          `sourceUrl: ${JSON.stringify(p.pdfUrl)}`,
          p.autoDriveCid ? `autoDriveCid: ${JSON.stringify(p.autoDriveCid)}` : null,
          `wordCount: ${wordCount}`,
          `extractedAt: ${JSON.stringify(new Date().toISOString())}`,
          '---',
          '',
          `# ${p.title}`,
          '',
          '> The foundational constitution of the Agentic Polity — the 4th paper of the Polity series, elevated to ratified constitutional status in Polity Core. The operative Agent Passport binding triple still references constitution.v1.json; binding this document is a separate governance act.',
          '',
          text,
          '',
        ].filter((l) => l !== null).join('\n');
        writeFileSync(CONSTITUTION_MD, md, 'utf8');

        const cj = JSON.parse(readFileSync(CONSTITUTION_JSON, 'utf8'));
        cj.summary = summary;
        cj.articles = articles;
        cj.sourceUrl = p.pdfUrl;
        cj.autoDriveCid = p.autoDriveCid ?? null;
        cj.wordCount = wordCount;
        cj.generatedAt = new Date().toISOString();
        writeFileSync(CONSTITUTION_JSON, JSON.stringify(cj, null, 2) + '\n', 'utf8');
      }
      constitutionFilled = true;
      console.log(`[ingest]   ↑ elevated to constitutional: ${p.title}`);
    }
  }

  // Rewrite the commentary index (framework JSON).
  for (const s of commentary.series) {
    s.papers = seriesPapers[s.id] ?? [];
  }
  commentary.generatedAt = new Date().toISOString();
  if (!DRY) writeFileSync(COMMENTARY_JSON, JSON.stringify(commentary, null, 2) + '\n', 'utf8');

  // Rewrite the three commentary collections' items (fall back to README when empty).
  for (const col of collections.collections) {
    if (collectionItems[col.id]) {
      col.items = collectionItems[col.id].length > 0 ? collectionItems[col.id] : ['items/commentary/README.md'];
    }
  }
  if (!DRY) writeFileSync(COLLECTIONS, JSON.stringify(collections, null, 2) + '\n', 'utf8');

  const total = Object.values(seriesPapers).reduce((a, b) => a + b.length, 0);
  console.log(`\n[ingest] done${DRY ? ' (dry-run, no files written)' : ''}: ${total} papers ingested across ${Object.keys(SERIES).length} series.`);
  console.log(`[ingest]   Experience Sovereignty: ${seriesPapers['experience-sovereignty'].length}`);
  console.log(`[ingest]   COYN Thesis:            ${seriesPapers['coyn-thesis'].length}`);
  console.log(`[ingest]   The Polity:             ${seriesPapers['polity'].length}`);
  console.log(`[ingest]   Constitution elevated:  ${constitutionFilled ? 'yes' : 'NO (paper #4 not found — check the Polity series)'}`);
  console.log('\n[ingest] Next steps:');
  console.log('[ingest]   1. Review the diff, commit the generated markdown + JSON, and deploy.');
  console.log('[ingest]   2. Ingest into the Knowledge Base (semantic + keyword retrieval for agents):');
  console.log(`[ingest]        curl -X POST -H "Authorization: Bearer $ADMIN_OPS_TOKEN" \\`);
  console.log(`[ingest]          ${HOST}/api/admin/kb/ingest-polity-commentary`);
  // Touch the README check so an empty run doesn't leave a dangling dir.
  void readdirSync(COMMENTARY_DIR);
}

main().catch((e) => { console.error('[ingest] error:', e); process.exit(1); });
