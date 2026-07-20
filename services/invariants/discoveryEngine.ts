/**
 * Invariant Discovery Engine (IDE) — CFS-048 Phase 0 (constitutional arm).
 *
 * The UPSTREAM primitive: build a candidate invariant library for a cold
 * domain from evidence, then feed the EXISTING lifecycle + validation harness.
 * This is an orchestration layer — it composes primitives that already ship,
 * it does not re-implement them (charter §3):
 *
 *   Stage 1 Evidence Collection  → discovery_evidence (this module)
 *   Stage 2 Candidate Extraction → callSovereign (invariant-aware inference)
 *   Stage 3 Synthesis            → compression prompt (Phase 1 adds mergeInvariants)
 *   Stage 4 Validation           → the experiment harness (unchanged)
 *   Stage 5 Canonical Publication→ discoverInvariant → validate → canonize
 *
 * Discipline (canon): discovery-not-generation (inv.reasoning.334); evidence-
 * first provenance (335); a candidate is `proposed` until validated, never
 * auto-canonical (337). Promotion here lands a candidate at status `proposed`
 * ONLY — canonisation stays a separate, earned act.
 *
 * T0/T2: added_by is a one-way commitment; server-internal only.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callSovereign } from '@/services/constitutional/modelRouter';
import { discoverInvariant } from '@/services/invariants/lifecycle';
import type { InvariantNamespace, InvariantSemanticType } from '@/types/invariants';

export type DiscoveryClass = 'constitutional' | 'structural' | 'experiential';
export type EvidenceKind =
  | 'legislation' | 'regulation' | 'compliance' | 'standard' | 'contract' | 'policy' | 'other';

export interface EvidenceRow {
  id: string;
  domain: string;
  title: string;
  sourceKind: EvidenceKind;
  content: string;
  sourceRef: string | null;
  createdAt: string;
}

export interface CandidateRow {
  id: string;
  domain: string;
  discoveryClass: DiscoveryClass;
  statement: string;
  rationale: string;
  evidenceIds: string[];
  confidence: number;
  status: 'candidate' | 'promoted' | 'rejected';
  promotedInvariantId: string | null;
  createdAt: string;
}

function committer(personaId: string): string {
  return createHash('sha256').update(`discovery:${personaId}`).digest('hex').slice(0, 16);
}

// ── Stage 1 · Evidence ──────────────────────────────────────────────────────

export async function addEvidence(
  admin: SupabaseClient,
  input: { domain: string; title: string; sourceKind: EvidenceKind; content: string; sourceRef?: string; personaId: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const content = input.content.trim();
  if (!input.title.trim() || !content) return { ok: false, error: 'title and content are required' };
  const { data, error } = await admin
    .from('discovery_evidence')
    .insert({
      domain: input.domain,
      title: input.title.trim(),
      source_kind: input.sourceKind,
      content: content.slice(0, 200_000), // sane cap for a single artefact
      source_ref: input.sourceRef?.trim() || null,
      added_by_commitment: committer(input.personaId),
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' };
  return { ok: true, id: String(data.id) };
}

export async function listEvidence(admin: SupabaseClient, domain: string): Promise<EvidenceRow[]> {
  const { data, error } = await admin
    .from('discovery_evidence')
    .select('id, domain, title, source_kind, content, source_ref, created_at')
    .eq('domain', domain)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => ({
    id: String(r.id), domain: String(r.domain), title: String(r.title),
    sourceKind: String(r.source_kind) as EvidenceKind,
    content: String(r.content), sourceRef: (r.source_ref as string | null) ?? null,
    createdAt: String(r.created_at),
  }));
}

// ── Stage 2-3 · Constitutional candidate extraction + synthesis ─────────────

const CONSTITUTIONAL_SYSTEM = `You are an Invariant Discovery agent for the constitutional class.
An INVARIANT is a fundamental, reusable structure that stays constant across implementations — an
obligation, permission, prohibition, right, governance rule, or accountability constraint that recurs
across a domain. You DISCOVER candidates from evidence; you never invent them.

Rules:
- Compress, don't summarise: state the SMALLEST reusable normative structure that explains RECURRING
  patterns across the supplied evidence (e.g. KYC + AML + CDD + sanctions + travel-rule → "Financial
  actions require verifiable accountability").
- Each candidate MUST be grounded in specific evidence items (cite their indices).
- A candidate is a single declarative sentence in the present tense — normative, implementation-independent.
- Do NOT restate a regulation verbatim; extract the invariant beneath many regulations.
- Prefer 3-8 high-quality candidates over many shallow ones.

Output STRICT JSON: {"candidates":[{"statement":"...","rationale":"why this is invariant across the evidence","evidenceIndices":[0,2],"confidence":0.0-1.0}]}`;

interface ExtractionResult {
  candidates: { statement: string; rationale?: string; evidenceIndices?: number[]; confidence?: number }[];
}

/**
 * Run constitutional discovery over the domain's evidence. Composes the
 * invariant-aware sovereign router (we dogfood our own inference for
 * discovery). Persists candidates; returns them. Idempotency is the operator's
 * call — a re-run adds a fresh discovery pass (dedup happens at promotion via
 * discoverInvariant's duplicate check).
 */
export async function runConstitutionalDiscovery(
  admin: SupabaseClient,
  domain: string,
): Promise<{ ok: true; candidates: CandidateRow[] } | { ok: false; error: string }> {
  const evidence = await listEvidence(admin, domain);
  if (evidence.length === 0) return { ok: false, error: 'No evidence for this domain — add evidence first (Stage 1).' };

  // Bounded context: cap total chars so the extraction stays within budget.
  const MAX_CHARS = 24_000;
  let used = 0;
  const included: EvidenceRow[] = [];
  for (const e of evidence) {
    const chunk = e.content.slice(0, 6_000);
    if (used + chunk.length > MAX_CHARS) break;
    included.push({ ...e, content: chunk });
    used += chunk.length;
  }
  const user = `DOMAIN: ${domain}\n\nEVIDENCE (cite by index):\n` +
    included.map((e, i) => `[${i}] (${e.sourceKind}) ${e.title}\n${e.content}`).join('\n\n---\n\n');

  let result: ExtractionResult;
  let governing: string[] = [];
  try {
    const call = await callSovereign('analysis', CONSTITUTIONAL_SYSTEM, user, 1400, 0);
    governing = call.governingInvariants ?? [];
    result = JSON.parse(extractJson(call.text)) as ExtractionResult;
  } catch (e) {
    return { ok: false, error: `discovery inference failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  const raw = Array.isArray(result?.candidates) ? result.candidates : [];
  if (raw.length === 0) return { ok: true, candidates: [] };

  const rows = raw
    .filter((c) => c && typeof c.statement === 'string' && c.statement.trim())
    .slice(0, 12)
    .map((c) => {
      const idxs = Array.isArray(c.evidenceIndices) ? c.evidenceIndices : [];
      const evidenceIds = idxs
        .map((i) => included[i]?.id)
        .filter((id): id is string => Boolean(id));
      return {
        domain,
        discovery_class: 'constitutional' as const,
        statement: c.statement.trim(),
        rationale: (c.rationale ?? '').trim(),
        evidence_ids: evidenceIds,
        confidence: typeof c.confidence === 'number' ? Math.max(0, Math.min(1, c.confidence)) : 0.5,
        discovery_provenance: { stage: 'constitutional', governingInvariants: governing, evidenceCount: included.length },
      };
    });
  if (rows.length === 0) return { ok: true, candidates: [] };

  const { data, error } = await admin.from('discovery_candidates').insert(rows).select('*');
  if (error) return { ok: false, error: error.message };
  return { ok: true, candidates: (data ?? []).map(toCandidateRow) };
}

export async function listCandidates(admin: SupabaseClient, domain: string): Promise<CandidateRow[]> {
  const { data, error } = await admin
    .from('discovery_candidates')
    .select('*')
    .eq('domain', domain)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map(toCandidateRow);
}

// ── Stage 5 · Promotion into the canonical lifecycle (lands at `proposed`) ──

/**
 * Promote a candidate into the canonical registry as `proposed` — NEVER
 * canonical (inv.reasoning.337). Composes discoverInvariant (dedup + form +
 * receipt). Carries evidence provenance so the invariant traces back to its
 * sources (inv.reasoning.335).
 */
export async function promoteCandidate(
  admin: SupabaseClient,
  candidateId: string,
  actor: { personaId: string; sessionId?: string },
): Promise<{ ok: true; invariantId: string } | { ok: false; error: string }> {
  const { data: c, error } = await admin
    .from('discovery_candidates')
    .select('*')
    .eq('id', candidateId)
    .maybeSingle();
  if (error || !c) return { ok: false, error: error?.message ?? 'candidate not found' };
  if (c.status !== 'candidate') return { ok: false, error: `candidate is already ${c.status}` };

  // Constitutional-class discoveries land in the 'constitutional' namespace,
  // tagged with the domain context so IRE resolves them for that field.
  try {
    const result = await discoverInvariant(
      {
        statement: String(c.statement),
        namespace: 'constitutional' as InvariantNamespace,
        semanticType: 'constraint' as InvariantSemanticType,
        status: 'proposed',
        confidence: Number(c.confidence) || 0.5,
        // Machine-discovered candidate → the 'agent_verified' rung of the
        // CFS-001 §5 confidence ladder (0.6). It EARNS document/principal
        // confidence only through validation (inv.reasoning.337).
        confidenceBasis: 'agent_verified',
        provenance: {
          source: 'CFS-048 Invariant Discovery Engine (constitutional arm)',
          domain: String(c.domain),
          evidence_ids: (c.evidence_ids as string[]) ?? [],
          rationale: String(c.rationale ?? ''),
          discovery_candidate_id: candidateId,
        },
        contexts: [{ domain: String(c.domain) }],
      },
      actor,
    );
    await admin
      .from('discovery_candidates')
      .update({ status: 'promoted', promoted_invariant_id: result.invariant.id, updated_at: new Date().toISOString() })
      .eq('id', candidateId);
    return { ok: true, invariantId: result.invariant.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'promotion failed' };
  }
}

export async function rejectCandidate(admin: SupabaseClient, candidateId: string): Promise<{ ok: boolean }> {
  const { error } = await admin
    .from('discovery_candidates')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', candidateId)
    .eq('status', 'candidate');
  return { ok: !error };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function toCandidateRow(r: Record<string, unknown>): CandidateRow {
  return {
    id: String(r.id), domain: String(r.domain),
    discoveryClass: String(r.discovery_class) as DiscoveryClass,
    statement: String(r.statement), rationale: String(r.rationale ?? ''),
    evidenceIds: (r.evidence_ids as string[]) ?? [],
    confidence: Number(r.confidence) || 0.5,
    status: String(r.status) as CandidateRow['status'],
    promotedInvariantId: (r.promoted_invariant_id as string | null) ?? null,
    createdAt: String(r.created_at),
  };
}

/** Tolerate a model that wraps JSON in prose/fences. Exported for the canary. */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  return first >= 0 && last > first ? text.slice(first, last + 1) : text;
}
