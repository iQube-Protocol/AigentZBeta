/**
 * POST /api/homecoming/knowledge/import — Knowledge Homecoming intake (CFS-023).
 *
 * Accepts a ChatGPT data export (`conversations.json`, as parsed JSON in the
 * request body under `export`) and ingests each conversation into the
 * Constitutional Knowledge Repository — the `homecoming` domain of the existing
 * Codex KB — via the SAME spine the polity-commentary ingest uses
 * (KnowledgeBaseService.ingestTextDocument, idempotent by source_id), then drains
 * the embedding queue. This is INTEGRATION, not a new store.
 *
 * `dryRun: true` parses + summarises WITHOUT writing — the operator previews how
 * many conversations/turns will land before spending embedding credits.
 *
 * Auth: ADMIN_OPS_TOKEN bearer OR an admin persona (mirrors the polity route).
 * T2-safe: the response carries titles, counts, and source ids — never a T0 id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getKnowledgeBaseService } from '@/services/content/knowledgeBaseService';
import { getEmbeddingService } from '@/services/content/embeddingService';
import { chatGptExportToDocuments } from '@/services/homecoming/chatgptImport';

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

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const bodyRec = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  // Accept either { export: <conversations.json> } or the raw export at the top level.
  const exportPayload = 'export' in bodyRec ? bodyRec.export : body;
  const dryRun = bodyRec.dryRun === true;

  const documents = chatGptExportToDocuments(exportPayload);
  const totalTurns = documents.reduce((n, d) => n + d.turnCount, 0);

  if (documents.length === 0) {
    return NextResponse.json({
      ok: true,
      parsed: 0,
      note: 'No usable conversations found. Expected a ChatGPT conversations.json (array of conversations, each with a mapping).',
    });
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      parsed: documents.length,
      totalTurns,
      domain: 'homecoming',
      preview: documents.slice(0, 20).map((d) => ({ sourceId: d.sourceId, title: d.title, turnCount: d.turnCount })),
    });
  }

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

  let ingested = 0;
  let totalChunks = 0;
  const errors: string[] = [];
  for (const d of documents) {
    const res = await kb.ingestTextDocument(d.text, {
      sourceId: d.sourceId,
      title: d.title,
      domain: 'homecoming',
      contentCategory: 'chatgpt-conversation',
      tags: ['homecoming', 'chatgpt', 'operator-memory'],
      metadata: { source: 'chatgpt-export', turnCount: d.turnCount, createTime: d.createTime },
    });
    if (res.success) {
      ingested += 1;
      totalChunks += res.chunkCount ?? 0;
    } else {
      errors.push(`${d.title}: ${res.error}`);
    }
  }

  // Drain the embedding queue so the new chunks are semantically searchable.
  let embedded = 0;
  let embeddingNote: string | undefined;
  if (embeddings.isAvailable()) {
    for (let i = 0; i < 200; i += 1) {
      const r = await embeddings.processUnembeddedChunks(50);
      embedded += r.processed;
      if (r.processed === 0) break;
    }
  } else {
    embeddingNote =
      'No embedding provider configured (OPENAI_API_KEY / VOYAGE_API_KEY) — chunks are keyword-searchable; set a key + re-run to enable semantic search.';
  }

  return NextResponse.json({
    ok: true,
    parsed: documents.length,
    ingested,
    totalTurns,
    totalChunks,
    embedded,
    domain: 'homecoming',
    contentCategory: 'chatgpt-conversation',
    ...(embeddingNote ? { embeddingNote } : {}),
    ...(errors.length ? { errors } : {}),
  });
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  try {
    const kb = getKnowledgeBaseService();
    const stats = await kb.getStats('homecoming');
    return NextResponse.json({
      ok: true,
      domain: 'homecoming',
      note: 'POST a ChatGPT conversations.json under { export } to import (dryRun:true to preview). Idempotent by source_id.',
      kb: stats,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'KB unavailable' }, { status: 503 });
  }
}
