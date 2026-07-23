/**
 * Corpus Scout (PRD-ICA-001) — Provenance Agent (§10 agent F) + the orchestrator
 * that ties retrieval (§10 agent D) and inspection (§10 agent E) together and
 * writes the candidate's own provenance record (§8), `corpus_candidate_sources`.
 *
 * A candidate that fails byte/content verification is still recorded here,
 * flagged `needs_retrieval_fix` — never silently dropped (PRD-ICA-001 §2, §12).
 *
 * `createCandidateSource` is the SAME back half both entry points use:
 * a manual URL submission (`acquisitionMethod` defaults to `'direct-url'`)
 * and Agent B/C's institution-targeted discovery (`institutionNavigator.ts`
 * passes `'institutional-registry'` + a `discoveryUrl`) — no second ingestion
 * mechanism, per the Constitutional Discovery amendment §5's explicit intent.
 * Structural-value classification, relevance scoring, and full duplicate/
 * version resolution (Phase 3, §14) are explicitly out of scope for this
 * build — only a lightweight duplicate-URL check runs here (surfaced, not
 * auto-rejected; a human reviewer decides via the `mark_duplicate` action).
 */

import { randomUUID, createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { retrieveArtifact, sniffMagicBytes } from './retrieval';
import { inspectArtifact } from './inspection';
import { classifyStructuralValue } from './intelligence';
import type { CandidateSourceRow, ResolutionChain, StructuralValueTag } from './types';

export interface CreateCandidateSourceInput {
  url: string;
  campaignDomain: string;
  campaignSubDomain?: string | null;
  title?: string;
  /** §7's already-named tagging field. Defaults to `'direct-url'` (Level 4,
   *  manual submission) — the institution navigator (`institutionNavigator.ts`,
   *  Agent B/C) passes `'institutional-registry'` so the review workspace and
   *  any future audit can always see which acquisition path produced which
   *  evidence. Never `'open-discovery-gap-fill'` from this code path — that
   *  tag belongs to §7 Open Discovery, not yet built. */
  acquisitionMethod?: string;
  /** Where discovery started (an institution's seed/listing URL) when this
   *  candidate wasn't a direct manual submission. Recorded on
   *  `resolutionChain.discoveryUrl`; defaults to `url` when omitted, matching
   *  the existing Level-4-direct-URL behavior exactly. */
  discoveryUrl?: string;
}

export interface CandidateSourceFilter {
  campaignDomain?: string;
  reviewWorkflowStatus?: string;
}

function makeSourceId(url: string): string {
  let slug = 'src';
  try {
    const u = new URL(url);
    const base = (u.pathname.split('/').filter(Boolean).pop() || u.hostname).replace(/\.[a-z0-9]{1,6}$/i, '');
    const cleaned = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '').slice(0, 40);
    slug = cleaned || u.hostname.replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  } catch {
    /* fall back to the generic slug above */
  }
  const unique = randomUUID().replace(/-/g, '').slice(0, 10);
  return `SRC-${slug}-${unique}`;
}

function deriveTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const base = u.pathname.split('/').filter(Boolean).pop();
    return base ? decodeURIComponent(base) : u.hostname;
  } catch {
    return url;
  }
}

function toCandidateSourceRow(r: Record<string, unknown>): CandidateSourceRow {
  return {
    id: String(r.id),
    sourceId: String(r.source_id),
    campaignDomain: String(r.campaign_domain),
    campaignSubDomain: (r.campaign_sub_domain as string | null) ?? null,
    title: String(r.title ?? ''),
    issuer: (r.issuer as string | null) ?? null,
    authors: Array.isArray(r.authors) ? (r.authors as string[]) : [],
    publicationDate: (r.publication_date as string | null) ?? null,
    retrievedAt: (r.retrieved_at as string | null) ?? null,
    canonicalUrl: String(r.canonical_url),
    artifactHash: (r.artifact_hash as string | null) ?? null,
    normalizedTextHash: (r.normalized_text_hash as string | null) ?? null,
    mimeType: (r.mime_type as string | null) ?? null,
    fileSizeBytes: r.file_size_bytes == null ? null : Number(r.file_size_bytes),
    pageCount: r.page_count == null ? null : Number(r.page_count),
    licenseStatus: String(r.license_status ?? 'unknown'),
    provenanceClass: (r.provenance_class as CandidateSourceRow['provenanceClass']) ?? null,
    reviewWorkflowStatus: r.review_workflow_status as CandidateSourceRow['reviewWorkflowStatus'],
    acquisitionMethod: String(r.acquisition_method ?? 'direct-url'),
    resolutionChain: (r.resolution_chain as ResolutionChain) ?? {},
    extractionStatus: r.extraction_status as CandidateSourceRow['extractionStatus'],
    normalizedText: String(r.normalized_text ?? ''),
    extractionWarnings: Array.isArray(r.extraction_warnings) ? (r.extraction_warnings as string[]) : [],
    structuralTags: Array.isArray(r.structural_tags) ? (r.structural_tags as StructuralValueTag[]) : [],
    duplicateOfSourceId: (r.duplicate_of_source_id as string | null) ?? null,
    humanReviewNotes: (r.human_review_notes as string | null) ?? null,
    evidenceRowId: (r.evidence_row_id as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

/**
 * Retrieve → inspect → persist ONE candidate source (Level 4 discovery only,
 * §2). Always writes a row — a retrieval or content-verification failure is
 * recorded as `needs_retrieval_fix` with the failure class in
 * `extraction_warnings`, never silently dropped.
 */
export async function createCandidateSource(
  admin: SupabaseClient,
  input: CreateCandidateSourceInput,
): Promise<{ ok: boolean; sourceId?: string; error?: string; candidate?: CandidateSourceRow }> {
  const url = input.url.trim();
  if (!url) return { ok: false, error: 'url is required' };
  const campaignDomain = input.campaignDomain?.trim();
  if (!campaignDomain) return { ok: false, error: 'campaignDomain is required' };

  // Lightweight duplicate-URL check (surfaced, not auto-rejected — Phase 3's
  // full dedup/version-resolution machinery is out of scope for this build).
  const { data: existingByUrl } = await admin
    .from('corpus_candidate_sources')
    .select('source_id')
    .eq('canonical_url', url)
    .limit(1)
    .maybeSingle();

  const retrieval = await retrieveArtifact(url, input.discoveryUrl);
  const now = new Date().toISOString();
  const sourceId = makeSourceId(url);
  const baseRow = {
    source_id: sourceId,
    campaign_domain: campaignDomain,
    campaign_sub_domain: input.campaignSubDomain?.trim() || null,
    title: input.title?.trim() || deriveTitleFromUrl(url),
    issuer: null,
    authors: [] as string[],
    publication_date: null,
    retrieved_at: now,
    canonical_url: url,
    license_status: 'unknown',
    provenance_class: null,
    acquisition_method: input.acquisitionMethod?.trim() || 'direct-url',
    resolution_chain: retrieval.resolutionChain,
    duplicate_of_source_id: (existingByUrl?.source_id as string | undefined) ?? null,
    human_review_notes: null,
    evidence_row_id: null,
  };

  if (!retrieval.ok || !retrieval.bytes) {
    const row = {
      ...baseRow,
      artifact_hash: retrieval.artifactHash,
      normalized_text_hash: null,
      mime_type: retrieval.contentType,
      file_size_bytes: retrieval.fileSizeBytes,
      page_count: null,
      review_workflow_status: 'needs_retrieval_fix' as const,
      extraction_status: 'failed' as const,
      normalized_text: '',
      extraction_warnings: [`retrieval failed: ${retrieval.failureClass ?? 'unknown'}`],
      structural_tags: [] as StructuralValueTag[],
    };
    const { data, error } = await admin.from('corpus_candidate_sources').insert(row).select('*').single();
    if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' };
    return { ok: true, sourceId, candidate: toCandidateSourceRow(data) };
  }

  const { isPdf, isHtml } = sniffMagicBytes(retrieval.bytes);
  const effectiveMimeType = isPdf ? 'application/pdf' : isHtml ? 'text/html' : (retrieval.contentType || 'application/octet-stream');
  const inspection = await inspectArtifact(retrieval.bytes, effectiveMimeType);
  const normalizedTextHash = inspection.normalizedText
    ? createHash('sha256').update(inspection.normalizedText).digest('hex')
    : null;
  const passed = inspection.ok && inspection.passesContentPresenceCheck;

  const row = {
    ...baseRow,
    artifact_hash: retrieval.artifactHash,
    normalized_text_hash: normalizedTextHash,
    mime_type: effectiveMimeType,
    file_size_bytes: retrieval.fileSizeBytes,
    page_count: inspection.pageCount,
    review_workflow_status: passed ? ('pending_review' as const) : ('needs_retrieval_fix' as const),
    extraction_status: inspection.ok ? (passed ? ('ok' as const) : ('below-threshold' as const)) : ('failed' as const),
    normalized_text: inspection.normalizedText,
    extraction_warnings: inspection.extractionWarnings,
    // Phase 3 lightweight intelligence (§14.3) — HEURISTIC structural-value
    // tags (§8), advisory review metadata only, never a review decision.
    structural_tags: classifyStructuralValue(inspection.normalizedText).tags,
  };

  const { data, error } = await admin.from('corpus_candidate_sources').insert(row).select('*').single();
  if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' };
  return { ok: true, sourceId, candidate: toCandidateSourceRow(data) };
}

export async function listCandidateSources(
  admin: SupabaseClient,
  filter: CandidateSourceFilter = {},
): Promise<CandidateSourceRow[]> {
  let query = admin.from('corpus_candidate_sources').select('*').order('created_at', { ascending: false });
  if (filter.campaignDomain) query = query.eq('campaign_domain', filter.campaignDomain);
  if (filter.reviewWorkflowStatus) query = query.eq('review_workflow_status', filter.reviewWorkflowStatus);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []).map(toCandidateSourceRow);
}

export async function getCandidateSource(admin: SupabaseClient, sourceId: string): Promise<CandidateSourceRow | null> {
  const { data, error } = await admin
    .from('corpus_candidate_sources')
    .select('*')
    .eq('source_id', sourceId)
    .maybeSingle();
  if (error || !data) return null;
  return toCandidateSourceRow(data);
}

/** Update a candidate's review state — used by the review route. Only the
 *  fields a reviewer action can touch; retrieval/inspection fields are never
 *  mutated here. */
export async function updateCandidateReview(
  admin: SupabaseClient,
  sourceId: string,
  patch: {
    reviewWorkflowStatus: string;
    humanReviewNotes?: string | null;
    provenanceClass?: string | null;
    duplicateOfSourceId?: string | null;
  },
): Promise<{ ok: boolean; error?: string; candidate?: CandidateSourceRow }> {
  const update: Record<string, unknown> = {
    review_workflow_status: patch.reviewWorkflowStatus,
    updated_at: new Date().toISOString(),
  };
  if (patch.humanReviewNotes !== undefined) update.human_review_notes = patch.humanReviewNotes;
  if (patch.provenanceClass !== undefined) update.provenance_class = patch.provenanceClass;
  if (patch.duplicateOfSourceId !== undefined) update.duplicate_of_source_id = patch.duplicateOfSourceId;

  const { data, error } = await admin
    .from('corpus_candidate_sources')
    .update(update)
    .eq('source_id', sourceId)
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'update failed' };
  return { ok: true, candidate: toCandidateSourceRow(data) };
}
