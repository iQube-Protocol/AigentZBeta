/**
 * Corpus Scout (PRD-ICA-001) — Ingestion Broker (§10 agent J). The ONLY module
 * that calls `addEvidence` — no new ingestion API is introduced (§0.2, §6).
 *
 * Refuses (§6, §11, §17) unless:
 *   - reviewWorkflowStatus is an approved value (`approved_exp_p1` or
 *     `approved_general_finance` — the human decided, this broker executes
 *     deterministically; it never approves its own sources, §11);
 *   - evidence_row_id is still null (never double-ingest);
 *   - provenanceClass is set (an evidence-integrity requirement distinct from
 *     the reviewWorkflowStatus axis, §0.3);
 *   - artifactHash and normalizedText are present (the source was actually
 *     verified, not merely recorded).
 *
 * Chunks `normalizedText` into ≤200,000-char pieces if needed — multiple
 * `addEvidence` calls, never truncating (PRD-ICA-001 §6).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { addEvidence, type EvidenceKind } from '@/services/invariants/discoveryEngine';
import { getCandidateSource } from './provenance';
import { APPROVED_FOR_INGESTION, type CandidateSourceRow } from './types';

// addEvidence caps content at 200,000 chars server-side (discoveryEngine.ts).
// Chunk strictly below that cap so a chunk is never itself re-truncated.
const EVIDENCE_CHUNK_MAX_CHARS = 200_000;

export function chunkNormalizedText(text: string, maxLen: number = EVIDENCE_CHUNK_MAX_CHARS): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLen) chunks.push(text.slice(i, i + maxLen));
  return chunks;
}

/** Best-effort EvidenceKind for a candidate — Corpus Scout does not build
 *  structural/relevance classification (Phase 3, out of scope here); 'other'
 *  is the safe default unless the mime type implies a recognizable kind. */
function inferEvidenceKind(_candidate: CandidateSourceRow): EvidenceKind {
  return 'other';
}

export interface IngestApprovedSourceResult {
  ok: boolean;
  error?: string;
  evidenceRowId?: string;
}

export async function ingestApprovedSource(
  admin: SupabaseClient,
  sourceId: string,
  personaId: string,
): Promise<IngestApprovedSourceResult> {
  const candidate = await getCandidateSource(admin, sourceId);
  if (!candidate) return { ok: false, error: `candidate source '${sourceId}' not found` };

  if (!APPROVED_FOR_INGESTION.has(candidate.reviewWorkflowStatus)) {
    return {
      ok: false,
      error:
        `refusing to ingest — reviewWorkflowStatus is '${candidate.reviewWorkflowStatus}', ` +
        `must be one of: ${[...APPROVED_FOR_INGESTION].join(', ')}`,
    };
  }
  if (candidate.evidenceRowId) {
    return { ok: false, error: `already ingested — evidence_row_id '${candidate.evidenceRowId}' exists (no double-ingest)` };
  }
  if (!candidate.provenanceClass) {
    return { ok: false, error: 'provenanceClass is not set — required before ingestion (§0.3)' };
  }
  if (!candidate.artifactHash) {
    return { ok: false, error: 'artifactHash is missing — this source was never byte-verified' };
  }
  if (!candidate.normalizedText || !candidate.normalizedText.trim()) {
    return { ok: false, error: 'normalizedText is empty — nothing to ingest' };
  }

  const chunks = chunkNormalizedText(candidate.normalizedText);
  const sourceKind = inferEvidenceKind(candidate);
  const evidenceIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const titleSuffix = chunks.length > 1 ? ` (part ${i + 1}/${chunks.length})` : '';
    const r = await addEvidence(admin, {
      domain: candidate.campaignDomain,
      subDomain: candidate.campaignSubDomain ?? undefined,
      title: `${candidate.title}${titleSuffix}`,
      sourceKind,
      content: chunks[i],
      sourceRef: candidate.canonicalUrl,
      personaId,
    });
    if (!r.ok) {
      return {
        ok: false,
        error: `add-evidence failed on chunk ${i + 1}/${chunks.length}: ${r.error}` +
          (evidenceIds.length > 0 ? ` (${evidenceIds.length} earlier chunk(s) already ingested as evidence rows: ${evidenceIds.join(', ')})` : ''),
      };
    }
    evidenceIds.push(r.id);
  }

  const primaryEvidenceId = evidenceIds[0];
  const { error: updErr } = await admin
    .from('corpus_candidate_sources')
    .update({ evidence_row_id: primaryEvidenceId, updated_at: new Date().toISOString() })
    .eq('source_id', sourceId);
  if (updErr) {
    return {
      ok: false,
      error: `ingested (${evidenceIds.length} evidence row(s): ${evidenceIds.join(', ')}) but failed to record evidence_row_id back onto the candidate: ${updErr.message}`,
    };
  }

  return { ok: true, evidenceRowId: primaryEvidenceId };
}
