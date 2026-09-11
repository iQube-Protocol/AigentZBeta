/**
 * POST /api/admin/ingest-knyt-wheel
 *
 * One-shot admin route: reads the 19 KNYT Wheel operator docs from
 * codexes/packs/knyt/items/, registers each in codex_kb_documents,
 * and inserts plain-text chunks into codex_kb_chunks so Marketa
 * can retrieve them via KB search (domain: metaKnyts).
 *
 * Run once per environment. Safe to re-run — uses upsert by source_id.
 *
 * Authorization: requires ADMIN_INGEST_SECRET header matching env var.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { join } from 'path';
import {
  ensureCorpusHydrated,
  corpusReadFile,
  corpusListMarkdown,
} from '@/services/knowledge/packCorpusStore';

export const dynamic = 'force-dynamic';

const DOCS_DIR = join(process.cwd(), 'codexes/packs/knyt/items');
const DOMAIN = 'metaKnyts';
const CONTENT_CATEGORY = 'campaign';
const SERIES = 'knyt_wheel';
const CHUNK_SIZE = 600; // words per chunk

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function chunkMarkdown(content: string): string[] {
  // Split on double newlines (paragraph breaks) to keep semantic units intact
  const paragraphs = content.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';
  let wordCount = 0;

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).length;
    if (wordCount + words > CHUNK_SIZE && current.trim()) {
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

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.md$/, '')
    .replace(/_/g, ' ')
    .replace(/KNYT /i, 'KNYT — ')
    .trim();
}

export async function POST(req: NextRequest) {
  // Authorization gate
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_INGEST_SECRET || secret !== process.env.ADMIN_INGEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const results: Array<{ file: string; status: string; chunks?: number; error?: string }> = [];

  // Read through the pack-corpus seam (local FS in dev; remote in the SSR
  // Lambda). Keep the original flat top-level listing (no nested subdirs).
  await ensureCorpusHydrated();
  const files = corpusListMarkdown(DOCS_DIR, DOCS_DIR).filter((f) => !f.includes('/'));

  for (const filename of files) {
    const sourceId = `knyt_wheel:${filename}`;
    try {
      const content = corpusReadFile(join(DOCS_DIR, filename));
      if (content === null) {
        results.push({ file: filename, status: 'error', error: 'file unavailable' });
        continue;
      }
      const title = titleFromFilename(filename);

      // Upsert document record
      const { data: doc, error: docErr } = await db
        .from('codex_kb_documents')
        .upsert(
          {
            source_type: 'markdown',
            source_id: sourceId,
            title,
            domain: DOMAIN,
            series: SERIES,
            content_category: CONTENT_CATEGORY,
            tags: ['campaign', 'knyt-wheel', 'marketa'],
            extraction_status: 'completed',
          },
          { onConflict: 'source_id' }
        )
        .select('id')
        .single();

      if (docErr || !doc) {
        results.push({ file: filename, status: 'error', error: docErr?.message ?? 'No doc returned' });
        continue;
      }

      // Delete existing chunks before re-inserting (idempotent)
      await db.from('codex_kb_chunks').delete().eq('document_id', doc.id);

      // Chunk and insert
      const chunks = chunkMarkdown(content);
      const chunkRecords = chunks.map((text, idx) => ({
        document_id: doc.id,
        content: text,
        chunk_index: idx,
        chunk_type: 'paragraph',
        word_count: text.split(/\s+/).length,
        token_count: Math.ceil(text.length / 4),
        character_refs: [],
        location_refs: [],
      }));

      if (chunkRecords.length > 0) {
        const { error: chunkErr } = await db.from('codex_kb_chunks').insert(chunkRecords);
        if (chunkErr) {
          results.push({ file: filename, status: 'chunk_error', error: chunkErr.message });
          continue;
        }
      }

      results.push({ file: filename, status: 'ok', chunks: chunkRecords.length });
    } catch (err) {
      results.push({ file: filename, status: 'error', error: String(err) });
    }
  }

  const ok = results.filter(r => r.status === 'ok').length;
  const failed = results.filter(r => r.status !== 'ok').length;

  return NextResponse.json({ indexed: ok, failed, results });
}
