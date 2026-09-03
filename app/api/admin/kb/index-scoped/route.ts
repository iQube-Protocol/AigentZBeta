/**
 * POST /api/admin/kb/index-scoped — explicit-scope chunk + embed indexing
 * (2026-09-03 scoped-indexing repair, closeout item 3).
 *
 * The existing embedding drain (services/content/embeddingService.ts's
 * `processUnembeddedChunks`, reachable unscoped from
 * app/api/admin/kb/ingest-polity-commentary/route.ts) has NO domain or
 * document filter at all — it processes chunks across every domain,
 * including the private `homecoming` KB. This route is the safe
 * alternative for indexing a specific, explicitly-named, already-eligible
 * set of documents:
 *
 *   - `documentIds` (or `documents[].id`) is REQUIRED and non-empty — there
 *     is no "index everything" mode.
 *   - Every id is resolved against the REAL `codex_kb_documents` row and its
 *     ACTUAL `domain` column is checked server-side against
 *     ALLOWED_DOMAINS below — never the caller's claimed domain, never a
 *     cartridge/URL/label string. Any id resolving to a domain outside the
 *     allowlist (in particular `homecoming`, the private operator KB) fails
 *     the WHOLE request before anything is written.
 *   - Chunking goes through knowledgeBaseService.chunkExistingDocument(),
 *     which chunks an EXISTING row IN PLACE and refuses to touch a document
 *     that already has chunks — it never deletes/reinserts a document row,
 *     so existing ids/provenance are preserved. The caller supplies the
 *     text per document (this route has no opinion on where verified
 *     manuscript text comes from — that is the caller's responsibility,
 *     kept separate so this route never itself re-derives or guesses text).
 *   - Embedding goes through embeddingService.processUnembeddedChunksForDocuments(),
 *     scoped to the SAME explicit id list, bounded by `batchSize` and
 *     resumable (call again to continue; already-embedded chunks are
 *     skipped, so this is idempotent).
 *
 * Auth: ADMIN_OPS_TOKEN bearer OR an admin persona — same pattern as
 * ingest-polity-commentary/route.ts.
 *
 * GET returns, for a given `documentIds` query param (comma-separated),
 * each document's current chunk/embedding readiness — for verifying state
 * before or after a POST, without indexing anything.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getKnowledgeBaseService, type ContentDomain } from '@/services/content/knowledgeBaseService';
import { getEmbeddingService } from '@/services/content/embeddingService';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * The only domains this route will ever index. Deliberately narrower than
 * ContentDomain's full union — this route exists to safely index the
 * PUBLIC knowledge-bridge corpus (currently: Qriptopian), never the private
 * `homecoming` KB. Widening this list is an explicit, reviewed decision,
 * not a default.
 */
const ALLOWED_DOMAINS: ContentDomain[] = ['qriptopian'];

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

interface IndexScopedDocumentInput {
  id: string;
  /** Verified text to chunk. Omit if the document already has chunks (skipped). */
  text?: string;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: 'Platform database is unavailable.' }, { status: 503 });

  let body: { documents?: IndexScopedDocumentInput[]; batchSize?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const documents = Array.isArray(body.documents) ? body.documents.filter((d) => d && typeof d.id === 'string' && d.id.trim()) : [];
  if (documents.length === 0) {
    return NextResponse.json({ error: 'documents[] (each {id, text?}) is required and must be non-empty — there is no unscoped mode.' }, { status: 400 });
  }
  const documentIds = documents.map((d) => d.id);
  const batchSize = typeof body.batchSize === 'number' && body.batchSize > 0 ? Math.min(body.batchSize, 100) : 20;

  // Server-side scope validation: resolve EVERY id's ACTUAL domain from the
  // database — never trust a caller-supplied domain/cartridge label.
  const { data: rows, error: fetchError } = await supabase
    .from('codex_kb_documents')
    .select('id, domain, chunk_count')
    .in('id', documentIds);

  if (fetchError) {
    return NextResponse.json({ error: `Could not resolve document scope: ${fetchError.message}` }, { status: 500 });
  }

  const foundIds = new Set((rows ?? []).map((r) => r.id));
  const missing = documentIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    return NextResponse.json({ error: 'Some document ids do not exist — refusing the whole request rather than partially indexing.', missing }, { status: 400 });
  }

  const disallowed = (rows ?? []).filter((r) => !ALLOWED_DOMAINS.includes(r.domain as ContentDomain));
  if (disallowed.length > 0) {
    return NextResponse.json(
      {
        error: 'Some document ids resolve to a domain outside this route\'s allowlist — refusing the whole request.',
        allowedDomains: ALLOWED_DOMAINS,
        disallowed: disallowed.map((r) => ({ id: r.id, domain: r.domain })),
      },
      { status: 403 },
    );
  }

  const chunkCountById = new Map((rows ?? []).map((r) => [r.id, r.chunk_count as number]));

  const kb = getKnowledgeBaseService();
  const embeddings = getEmbeddingService();

  const chunkResults: Array<{ id: string; chunked: boolean; chunkCount?: number; skippedReason?: string; error?: string }> = [];
  for (const doc of documents) {
    const existingChunkCount = chunkCountById.get(doc.id) ?? 0;
    if (existingChunkCount > 0) {
      chunkResults.push({ id: doc.id, chunked: false, skippedReason: `already has ${existingChunkCount} chunks` });
      continue;
    }
    if (!doc.text || !doc.text.trim()) {
      chunkResults.push({ id: doc.id, chunked: false, skippedReason: 'no chunk_count>0 but no text supplied to chunk it with' });
      continue;
    }
    const result = await kb.chunkExistingDocument(doc.id, doc.text);
    chunkResults.push({ id: doc.id, chunked: result.success, chunkCount: result.chunkCount, error: result.error });
  }

  const embeddingsAvailable = embeddings.isAvailable();
  let embeddingResult: { processed: number; failed: number; errors: string[] } | null = null;
  if (embeddingsAvailable) {
    const r = await embeddings.processUnembeddedChunksForDocuments(documentIds, batchSize);
    embeddingResult = { processed: r.processed, failed: r.failed, errors: r.errors };
  }

  return NextResponse.json({
    ok: true,
    scope: { documentIds, allowedDomains: ALLOWED_DOMAINS },
    chunkResults,
    embeddingsAvailable,
    embeddingResult,
    note: embeddingsAvailable
      ? 'Embedding processed one bounded batch for this exact scope. Call again (same documentIds) to continue — already-embedded chunks are skipped, so this is safely resumable.'
      : 'No embedding provider is configured on this server — chunking (if any text was supplied) completed, but no vectors were generated. Configure EMBEDDING_PROVIDER + the matching API key, then re-call this route with the same documents to embed.',
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const idsParam = req.nextUrl.searchParams.get('documentIds');
  if (!idsParam) return NextResponse.json({ error: 'documentIds query param (comma-separated) is required.' }, { status: 400 });
  const documentIds = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
  if (documentIds.length === 0) return NextResponse.json({ error: 'documentIds must be non-empty.' }, { status: 400 });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: 'Platform database is unavailable.' }, { status: 503 });

  const { data: docs, error: docsError } = await supabase
    .from('codex_kb_documents')
    .select('id, title, domain, extraction_status, chunk_count')
    .in('id', documentIds);
  if (docsError) return NextResponse.json({ error: docsError.message }, { status: 500 });

  const { data: chunkStats, error: chunkError } = await supabase
    .from('codex_kb_chunks')
    .select('document_id, embedding')
    .in('document_id', documentIds);
  if (chunkError) return NextResponse.json({ error: chunkError.message }, { status: 500 });

  const embeddedCountByDoc = new Map<string, number>();
  const totalChunksByDoc = new Map<string, number>();
  for (const row of chunkStats ?? []) {
    totalChunksByDoc.set(row.document_id, (totalChunksByDoc.get(row.document_id) ?? 0) + 1);
    if (row.embedding !== null) embeddedCountByDoc.set(row.document_id, (embeddedCountByDoc.get(row.document_id) ?? 0) + 1);
  }

  return NextResponse.json({
    documents: (docs ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      domain: d.domain,
      extractionStatus: d.extraction_status,
      chunkCount: d.chunk_count,
      actualChunkRows: totalChunksByDoc.get(d.id) ?? 0,
      embeddedChunkRows: embeddedCountByDoc.get(d.id) ?? 0,
    })),
  });
}
