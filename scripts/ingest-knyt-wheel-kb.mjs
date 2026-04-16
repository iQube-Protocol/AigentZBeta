/**
 * ingest-knyt-wheel-kb.mjs
 *
 * One-shot script: reads the 19 KNYT Wheel operator docs from
 * codexes/packs/knyt/items/, registers each in codex_kb_documents,
 * and inserts plain-text chunks into codex_kb_chunks so Marketa
 * can retrieve them via KB search (domain: metaKnyts).
 *
 * Usage (from repo root):
 *   node scripts/ingest-knyt-wheel-kb.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load .env.local manually
const envPath = join(ROOT, '.env.local');
let envVars = {};
try {
  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    envVars[key] = val;
  }
} catch {
  console.error('Could not read .env.local — ensure it exists at repo root');
  process.exit(1);
}

const SUPABASE_URL = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY  = envVars['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const DOCS_DIR     = join(ROOT, 'codexes/packs/knyt/items');
const DOMAIN       = 'metaKnyts';
const SERIES       = 'knyt_wheel';
const CATEGORY     = 'campaign';
const CHUNK_WORDS  = 600;

function chunkMarkdown(content) {
  const paragraphs = content.split(/\n{2,}/);
  const chunks = [];
  let current = '';
  let wordCount = 0;

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).length;
    if (wordCount + words > CHUNK_WORDS && current.trim()) {
      chunks.push(current.trim());
      current = para;
      wordCount = words;
    } else {
      current = current ? `${current}\n\n${para}` : para;
      wordCount += words;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 20);
}

function titleFromFilename(filename) {
  return filename
    .replace(/\.md$/, '')
    .replace(/_/g, ' ')
    .trim();
}

async function run() {
  const files = readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
  console.log(`Found ${files.length} docs in ${DOCS_DIR}\n`);

  let ok = 0, failed = 0;

  for (const filename of files) {
    const sourceId = `knyt_wheel:${filename}`;
    const title    = titleFromFilename(filename);
    process.stdout.write(`  Indexing: ${title} ... `);

    try {
      const content = readFileSync(join(DOCS_DIR, filename), 'utf-8');

      // Check if document already exists
      const { data: existing } = await db
        .from('codex_kb_documents')
        .select('id')
        .eq('source_id', sourceId)
        .maybeSingle();

      let docId;
      if (existing?.id) {
        // Update existing record
        const { error: updateErr } = await db
          .from('codex_kb_documents')
          .update({
            title,
            domain:           DOMAIN,
            series:           SERIES,
            content_category: CATEGORY,
            tags:             ['campaign', 'knyt-wheel', 'marketa'],
            extraction_status:'completed',
          })
          .eq('id', existing.id);
        if (updateErr) {
          console.log(`FAIL (update): ${updateErr.message}`);
          failed++;
          continue;
        }
        docId = existing.id;
      } else {
        // Insert new record
        const { data: doc, error: docErr } = await db
          .from('codex_kb_documents')
          .insert({
            source_type:      'markdown',
            source_id:        sourceId,
            title,
            domain:           DOMAIN,
            series:           SERIES,
            content_category: CATEGORY,
            tags:             ['campaign', 'knyt-wheel', 'marketa'],
            extraction_status:'completed',
          })
          .select('id')
          .single();
        if (docErr || !doc) {
          console.log(`FAIL (doc): ${docErr?.message ?? 'no doc'}`);
          failed++;
          continue;
        }
        docId = doc.id;
      }

      // Delete existing chunks (idempotent re-run)
      await db.from('codex_kb_chunks').delete().eq('document_id', docId);

      // Chunk + insert
      const chunks = chunkMarkdown(content);
      const records = chunks.map((text, idx) => ({
        document_id:   docId,
        content:       text,
        chunk_index:   idx,
        chunk_type:    'paragraph',
        word_count:    text.split(/\s+/).length,
        token_count:   Math.ceil(text.length / 4),
        character_refs:[],
        location_refs: [],
      }));

      if (records.length) {
        const { error: chunkErr } = await db.from('codex_kb_chunks').insert(records);
        if (chunkErr) {
          console.log(`FAIL (chunks): ${chunkErr.message}`);
          failed++;
          continue;
        }
      }

      console.log(`OK (${chunks.length} chunks)`);
      ok++;
    } catch (err) {
      console.log(`ERROR: ${err}`);
      failed++;
    }
  }

  console.log(`\nDone — ${ok} indexed, ${failed} failed`);
}

run().catch(err => { console.error(err); process.exit(1); });
