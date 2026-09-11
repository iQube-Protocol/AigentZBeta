/**
 * POST /api/admin/kb/ingest-polity-commentary — ingest the Polity Paper series
 * constitutional commentary (markdown in codexes/packs/polity-core) into the
 * Knowledge Base so agents retrieve it via inference (semantic + keyword).
 *
 * Sequence: run scripts/ingest-polity-papers.mjs first (writes the markdown +
 * populates polity-papers-commentary.v1.json), commit + deploy, THEN call this
 * (the deployed server has Supabase + embedding keys).
 *
 * Reads the paper list from the constitutional commentary index, reads each
 * markdown file from the pack, strips frontmatter, ingests under the
 * 'qriptopian' domain with contentCategory 'constitutional-commentary' (the
 * elevated Constitution paper uses 'constitutional'), then drains the embedding
 * queue. Idempotent — re-ingests by stable source_id.
 *
 * Auth: ADMIN_OPS_TOKEN bearer (scheduled/operator) OR an admin persona.
 *
 * GET returns KB + embedding stats for the qriptopian domain.
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { corpusReadPackFile } from '@/services/knowledge/packCorpusStore';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getKnowledgeBaseService } from '@/services/content/knowledgeBaseService';
import { getEmbeddingService } from '@/services/content/embeddingService';
import {
  getPolityPapersCommentary,
  getConstitutionOfAgenticPolity,
} from '@/services/polity/constitution';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function requireAdmin(req: NextRequest) {
  const expected = process.env.ADMIN_OPS_TOKEN;
  if (expected) {
    const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token === expected) return { ok: true as const };
  }
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return { ok: false as const, status: 401, error: 'Not authenticated' };
  if (!persona.cartridgeFlags?.isAdmin) return { ok: false as const, status: 403, error: 'Admin access required' };
  return { ok: true as const };
}

/** Strip a leading YAML frontmatter block (--- … ---) from markdown. */
function stripFrontmatter(md: string): string {
  if (!md.startsWith('---')) return md;
  const end = md.indexOf('\n---', 3);
  if (end === -1) return md;
  const after = md.indexOf('\n', end + 1);
  return after === -1 ? '' : md.slice(after + 1).trimStart();
}

async function readPackFile(relPath: string): Promise<string | null> {
  // Reject traversal, then read via the pack-corpus seam (local FS in dev; the
  // in-memory corpus hydrated from the remote blob in the SSR Lambda).
  const normalized = path.normalize(relPath);
  if (path.isAbsolute(normalized) || normalized.startsWith('..')) return null;
  return corpusReadPackFile('polity-core', normalized);
}

interface IngestTarget {
  sourceId: string;
  title: string;
  markdownPath: string;
  series: string;
  contentCategory: 'constitutional' | 'constitutional-commentary';
  sourceCid?: string;
  tags: string[];
}

function collectTargets(): IngestTarget[] {
  const targets: IngestTarget[] = [];
  const commentary = getPolityPapersCommentary() as {
    series?: Array<{ id: string; scope: string; papers?: Array<{ id: string; title: string; markdownPath: string; autoDriveCid?: string | null }> }>;
  };
  for (const s of commentary.series ?? []) {
    for (const p of s.papers ?? []) {
      if (!p.markdownPath) continue;
      targets.push({
        sourceId: p.id,
        title: p.title,
        markdownPath: p.markdownPath,
        series: s.scope,
        contentCategory: 'constitutional-commentary',
        sourceCid: p.autoDriveCid ?? undefined,
        tags: ['polity', 'commentary', s.id],
      });
    }
  }
  // The elevated Constitution of the Agentic Polity (ratified).
  const constitution = getConstitutionOfAgenticPolity() as {
    fullTextPath?: string; title?: string; sourceUrl?: string | null; autoDriveCid?: string | null;
  };
  if (constitution.fullTextPath && constitution.title) {
    targets.push({
      sourceId: 'constitution-agentic-polity',
      title: constitution.title,
      markdownPath: constitution.fullTextPath,
      series: 'papers/polity',
      contentCategory: 'constitutional',
      sourceCid: constitution.autoDriveCid ?? undefined,
      tags: ['polity', 'constitution', 'constitutional'],
    });
  }
  return targets;
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  let kb: ReturnType<typeof getKnowledgeBaseService>;
  let embeddings: ReturnType<typeof getEmbeddingService>;
  try {
    kb = getKnowledgeBaseService();
    embeddings = getEmbeddingService();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'KB unavailable (Supabase creds?)' },
      { status: 503 },
    );
  }

  const targets = collectTargets();
  if (targets.length === 0) {
    return NextResponse.json({
      ok: true,
      ingested: 0,
      note: 'No commentary papers found in the index. Run scripts/ingest-polity-papers.mjs (and deploy) first.',
    });
  }

  let ingested = 0;
  let totalChunks = 0;
  let missing = 0;
  const errors: string[] = [];

  for (const t of targets) {
    const raw = await readPackFile(t.markdownPath);
    if (!raw) { missing += 1; errors.push(`missing: ${t.markdownPath}`); continue; }
    const text = stripFrontmatter(raw);
    const res = await kb.ingestTextDocument(text, {
      sourceId: t.sourceId,
      sourceCid: t.sourceCid,
      title: t.title,
      domain: 'qriptopian',
      series: t.series,
      contentCategory: t.contentCategory,
      tags: t.tags,
      metadata: { source: 'polity-core', classification: t.contentCategory },
    });
    if (res.success) { ingested += 1; totalChunks += res.chunkCount ?? 0; }
    else errors.push(`${t.title}: ${res.error}`);
  }

  // Drain the embedding queue so the new chunks are semantically searchable.
  let embedded = 0;
  let embeddingNote: string | undefined;
  if (embeddings.isAvailable()) {
    for (let i = 0; i < 100; i += 1) {
      const r = await embeddings.processUnembeddedChunks(50);
      embedded += r.processed;
      if (r.processed === 0) break;
    }
  } else {
    embeddingNote = 'No embedding provider configured (OPENAI_API_KEY / VOYAGE_API_KEY) — chunks are keyword-searchable; set a key + re-run to enable semantic search.';
  }

  return NextResponse.json({
    ok: true,
    ingested,
    totalChunks,
    embedded,
    missing,
    domain: 'qriptopian',
    contentCategory: 'constitutional-commentary',
    ...(embeddingNote ? { embeddingNote } : {}),
    ...(errors.length ? { errors } : {}),
  });
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  try {
    const kb = getKnowledgeBaseService();
    const embeddings = getEmbeddingService();
    const [kbStats, embStats] = await Promise.all([kb.getStats('qriptopian'), embeddings.getStats()]);
    return NextResponse.json({ ok: true, targets: collectTargets().length, kb: kbStats, embeddings: embStats });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'KB unavailable' }, { status: 503 });
  }
}
