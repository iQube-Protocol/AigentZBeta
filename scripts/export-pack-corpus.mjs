#!/usr/bin/env node
/**
 * export-pack-corpus.mjs — build-time exporter for the codex pack corpus.
 *
 * Moves the browsable/searchable pack markdown+JSON OUT of the Amplify SSR Lambda
 * bundle (which had grown past the hard 230686720-byte platform cap, and grew
 * every deploy). It:
 *   1. Walks codexes/packs/**\/*.{md,json} minus the dead/never-read set.
 *   2. Builds one concatenated blob { "<pack-relative-path>": "<content>" }.
 *   3. Uploads it to Supabase Storage bucket `pack-corpus` at `<branch>/corpus.json`
 *      (public-read) — the FAST runtime read path (services/knowledge/packCorpusStore.ts
 *      hydrates it once per Lambda container).
 *   4. Best-effort pins the CANONICAL subset (ratified corpus) to Autonomys
 *      AutoDrive for permanence + provenance, recording the CID in the manifest.
 *      Canonical docs are ALSO in the Supabase blob — AutoDrive is the permanent
 *      anchor, deliberately NOT the hot read path (hybrid, operator-chosen 2026-07-21).
 *   5. Writes codexes/pack-manifest.json (paths + sizes + canonical CID) for provenance.
 *
 * ROBUSTNESS: in an Amplify build (AWS_APP_ID/AWS_BRANCH set) a missing Supabase
 * credential or a failed upload EXITS NONZERO — deploying without the blob would
 * ship a broken copilot. AutoDrive pin failures only warn (provenance is additive).
 * Locally (no AWS env) with no creds it SKIPS cleanly (dev reads the corpus from disk).
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const CWD = process.cwd();
const PACKS_ROOT = path.join(CWD, 'codexes', 'packs');
const BUCKET = 'pack-corpus';
const BRANCH = process.env.PACK_CORPUS_BRANCH || process.env.AWS_BRANCH || 'dev';
const IN_AMPLIFY = Boolean(process.env.AWS_APP_ID || process.env.AWS_BRANCH);

// Canonical (ratified) pack prefixes — pinned to AutoDrive for provenance.
const CANONICAL_PREFIXES = ['irl/foundation/', 'polity-core/'];

// Dead / never-read at runtime — mirror next.config.js outputFileTracingExcludes.
// Keeping these out of the blob holds it lean (~5 MB vs ~9 MB).
function isExcluded(relPath) {
  return (
    relPath.includes('/build_/COMMITS/') ||
    relPath.includes('/build_/PR/') ||
    relPath.endsWith('/build_/changelog.md') ||
    relPath.endsWith('canonical-invariants.seed.json') ||
    relPath.endsWith('memory/retrieval-index.md') ||
    /results.*\.json$/.test(path.basename(relPath)) ||
    relPath.endsWith('operation-metawill-v0.2.json')
  );
}

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...walk(full));
    } else if ((e.name.endsWith('.md') || e.name.endsWith('.json')) && !e.name.startsWith('.')) {
      out.push(full);
    }
  }
  return out;
}

/** Minimal .env.production loader (Amplify injects env into process.env, but this
 *  covers local runs where the file exists). Never overwrites an existing var. */
function loadEnvProduction() {
  const p = path.join(CWD, '.env.production');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function main() {
  loadEnvProduction();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Build the blob from disk.
  const files = walk(PACKS_ROOT).filter((abs) => {
    const rel = path.relative(PACKS_ROOT, abs);
    return !isExcluded(rel);
  });

  const corpus = {};
  const canonical = {};
  let totalBytes = 0;
  for (const abs of files) {
    const rel = path.relative(PACKS_ROOT, abs).split(path.sep).join('/');
    const content = fs.readFileSync(abs, 'utf8');
    corpus[rel] = content;
    totalBytes += Buffer.byteLength(content, 'utf8');
    if (CANONICAL_PREFIXES.some((p) => rel.startsWith(p))) canonical[rel] = content;
  }
  const blob = JSON.stringify(corpus);
  console.log(
    `[export-pack-corpus] ${files.length} files, ${(totalBytes / 1e6).toFixed(2)} MB source, ` +
      `${(Buffer.byteLength(blob) / 1e6).toFixed(2)} MB blob; canonical=${Object.keys(canonical).length}`,
  );

  if (!supabaseUrl || !serviceKey) {
    const msg = 'Supabase credentials (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) not set';
    if (IN_AMPLIFY) {
      console.error(`[export-pack-corpus] FATAL: ${msg} — cannot upload corpus; the SSR copilot would ship broken.`);
      process.exit(1);
    }
    console.log(`[export-pack-corpus] ${msg} — SKIPPING upload (local build reads the corpus from disk).`);
    process.exit(0);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Ensure the public-read bucket exists (idempotent).
  try {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error && !/already exists/i.test(error.message)) {
      console.warn(`[export-pack-corpus] createBucket note: ${error.message}`);
    }
  } catch (e) {
    console.warn(`[export-pack-corpus] createBucket threw (continuing): ${e?.message || e}`);
  }

  // Upload the blob (upsert) — this is the hard dependency.
  const objectPath = `${BRANCH}/corpus.json`;
  let uploaded = false;
  for (let attempt = 1; attempt <= 3 && !uploaded; attempt++) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, Buffer.from(blob, 'utf8'), {
        contentType: 'application/json',
        cacheControl: '60',
        upsert: true,
      });
    if (!error) {
      uploaded = true;
      break;
    }
    console.warn(`[export-pack-corpus] upload attempt ${attempt} failed: ${error.message}`);
  }
  if (!uploaded) {
    console.error('[export-pack-corpus] FATAL: corpus upload to Supabase failed after retries.');
    process.exit(1);
  }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  console.log(`[export-pack-corpus] uploaded → ${pub.publicUrl}`);

  // Best-effort AutoDrive provenance pin of the canonical subset (additive).
  let canonicalCid = null;
  const autonomysKey = process.env.AUTONOMYS_API_KEY;
  if (autonomysKey && Object.keys(canonical).length) {
    try {
      const { createAutoDriveApi } = await import('@autonomys/auto-drive');
      const network = process.env.AUTONOMYS_NETWORK_ID === 'testnet' ? 'testnet' : 'mainnet';
      const api = createAutoDriveApi({ apiKey: autonomysKey, network });
      if (typeof api.uploadObjectAsJSON === 'function') {
        const res = await api.uploadObjectAsJSON(canonical, `pack-canonical-${BRANCH}.json`);
        canonicalCid = typeof res === 'string' ? res : res?.cid || res?.headCid || null;
        console.log(`[export-pack-corpus] canonical pinned to AutoDrive: ${canonicalCid ?? '(cid unknown)'}`);
      }
    } catch (e) {
      console.warn(`[export-pack-corpus] AutoDrive pin skipped (non-fatal): ${e?.message || e}`);
    }
  } else {
    console.log('[export-pack-corpus] AutoDrive pin skipped (no AUTONOMYS_API_KEY or no canonical docs).');
  }

  // Provenance manifest (small; committed-free — generated fresh each build).
  const manifest = {
    generatedForBranch: BRANCH,
    fileCount: files.length,
    blobBytes: Buffer.byteLength(blob),
    corpusPublicUrl: pub.publicUrl,
    canonicalCount: Object.keys(canonical).length,
    canonicalAutoDriveCid: canonicalCid,
    canonicalPrefixes: CANONICAL_PREFIXES,
  };
  fs.writeFileSync(path.join(CWD, 'codexes', 'pack-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('[export-pack-corpus] wrote codexes/pack-manifest.json');
}

main().catch((err) => {
  console.error('[export-pack-corpus] FATAL:', err);
  process.exit(1);
});
