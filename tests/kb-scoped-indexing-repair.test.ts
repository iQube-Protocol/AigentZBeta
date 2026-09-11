/**
 * Scoped indexing repair (2026-09-03, closeout item 3) — the existing
 * embeddingService.processUnembeddedChunks() has NO domain/document filter
 * at all and is reachable unscoped from the admin ingest-polity-commentary
 * route, meaning it can drain the private `homecoming` KB as a side effect
 * of indexing public Qriptopian content. This suite covers the safe
 * alternative: explicit document-id scope, server-side domain validation
 * against the REAL database row (never a caller-supplied label), no
 * accidental global fallback, and never deleting/reinserting an existing
 * document row (which would mint a new id and break "preserve existing
 * document IDs, provenance, and verified text").
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stripComments, readSource } from './_lib/sourceAuthority';

describe('embeddingService.ts — processUnembeddedChunksForDocuments requires an explicit, non-empty scope', () => {
  const src = stripComments(readSource('services/content/embeddingService.ts'));

  it('refuses an empty or missing documentIds array before touching the database', () => {
    const fn = src.match(/async processUnembeddedChunksForDocuments\(documentIds: string\[\], batchSize: number = 20\): Promise<BatchEmbeddingResult> \{([\s\S]*?)\n  \}/)?.[1] ?? '';
    expect(fn).not.toBe('');
    expect(fn).toMatch(/if \(!Array\.isArray\(documentIds\) \|\| documentIds\.length === 0\)/);
    expect(fn).toMatch(/there is no unscoped mode/);
  });

  it('filters chunks by .in(\'document_id\', documentIds) — never an unscoped query', () => {
    const fn = src.match(/async processUnembeddedChunksForDocuments\(documentIds: string\[\], batchSize: number = 20\): Promise<BatchEmbeddingResult> \{([\s\S]*?)\n  \}/)?.[1] ?? '';
    expect(fn).toMatch(/\.in\('document_id', documentIds\)/);
    expect(fn).toMatch(/\.is\('embedding', null\)/);
  });

  it('the original unscoped processUnembeddedChunks is untouched (additive repair, not a rewrite of the existing hazard)', () => {
    expect(src).toMatch(/async processUnembeddedChunks\(batchSize: number = 20\): Promise<BatchEmbeddingResult>/);
  });
});

describe('knowledgeBaseService.ts — chunkExistingDocument never deletes/reinserts, preserving the document id', () => {
  const src = stripComments(readSource('services/content/knowledgeBaseService.ts'));
  const fn = src.match(/async chunkExistingDocument\(\s*documentId: string,\s*text: string,\s*\): Promise<\{ success: boolean; chunkCount\?: number; error\?: string \}> \{([\s\S]*?)\n  \}/)?.[1] ?? '';

  it('the function body is found', () => {
    expect(fn).not.toBe('');
  });

  it('never calls deleteDocument or registerDocument — it operates on the EXISTING row only', () => {
    expect(fn).not.toMatch(/deleteDocument/);
    expect(fn).not.toMatch(/registerDocument/);
  });

  it('refuses to re-chunk a document that already has chunks', () => {
    expect(fn).toMatch(/if \(document\.chunk_count > 0\)/);
    expect(fn).toMatch(/refusing to re-chunk in place/);
  });

  it('updates status/counts on the SAME documentId via updateDocumentStatus(documentId, ...)', () => {
    expect(fn).toMatch(/updateDocumentStatus\(documentId, 'processing'\)/);
    expect(fn).toMatch(/updateDocumentStatus\(documentId, 'completed'/);
  });
});

describe('app/api/admin/kb/index-scoped/route.ts — server-side scope validation, admin-gated, no unscoped mode', () => {
  const src = stripComments(readSource('app/api/admin/kb/index-scoped/route.ts'));

  it('requires admin auth (ADMIN_OPS_TOKEN or an admin persona) — same pattern as ingest-polity-commentary', () => {
    expect(src).toMatch(/ADMIN_OPS_TOKEN/);
    expect(src).toMatch(/cartridgeFlags\?\.isAdmin/);
  });

  it('POST refuses an empty documents[] with no fallback to "index everything"', () => {
    expect(src).toMatch(/documents\.length === 0/);
    expect(src).toMatch(/there is no unscoped mode/);
  });

  it('resolves every document id\'s ACTUAL domain from the database and checks it against ALLOWED_DOMAINS — never trusts a caller-supplied domain string', () => {
    expect(src).toMatch(/const ALLOWED_DOMAINS: ContentDomain\[\] = \['qriptopian'\];/);
    expect(src).toMatch(/\.from\('codex_kb_documents'\)\s*\n\s*\.select\('id, domain, chunk_count'\)\s*\n\s*\.in\('id', documentIds\)/);
    expect(src).toMatch(/disallowed = \(rows \?\? \[\]\)\.filter\(\(r\) => !ALLOWED_DOMAINS\.includes\(r\.domain as ContentDomain\)\)/);
  });

  it('rejects the WHOLE request (never a partial index) when any id is missing or disallowed', () => {
    expect(src).toMatch(/refusing the whole request rather than partially indexing/);
    expect(src).toMatch(/refusing the whole request\.'/);
  });

  it('calls the SCOPED embedding function with the exact same documentIds, never the unscoped processUnembeddedChunks', () => {
    expect(src).toMatch(/embeddings\.processUnembeddedChunksForDocuments\(documentIds, batchSize\)/);
    expect(src).not.toMatch(/embeddings\.processUnembeddedChunks\(/);
  });

  it('honestly reports when no embedding provider is configured, never fabricating readiness', () => {
    expect(src).toMatch(/No embedding provider is configured on this server/);
  });
});
