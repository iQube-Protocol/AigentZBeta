/**
 * PROVENANCE COHORT PREPARATION — Track 2 Stage 5's "Classify Provenance"
 * bulk-preparation step (2026-09-03), built to the same shape as Stage 2's
 * `services/corpusScout/admissionPreparation.ts` (mirrors its
 * disposition/exception vocabulary and its `computeCohortHash`-bound
 * ratification pattern — `tests/track2-admission-cohort-ratification.test.ts`
 * is the reference precedent). Never a parallel authority: every write this
 * module's output ultimately feeds still runs through
 * `applyProvenanceReclassification` (services/research/
 * experimentalPopulations.ts) with every one of its existing refusals intact.
 *
 * ── The question this closes (operator brief, 2026-09-03) ───────────────────
 *
 * "Determine whether each invariant can be tied unambiguously to a source
 * that was previously admitted with evidence provenance such as
 * 'external-established'. If yes, this is not 55 independent scientific
 * judgements."
 *
 * Live diagnostic against the 55 unclassified successor-scoped invariants
 * (Supabase project bsjhfvctmduxhohtllly, 2026-09-03): ZERO resolve to a
 * source ever admitted through Corpus Scout (`corpus_candidate_sources`) or
 * planned via `corpus_acquisition_seeds` — every one of their evidence rows
 * was added through the ad-hoc `add-evidence` action, bypassing admission
 * review entirely. So the LITERAL test the brief asked for returns "no prior
 * admission exists for any of them" — a real, honest negative result, not
 * something this module papers over.
 *
 * But the 55 invariants' evidence collapses onto only SEVEN distinct source
 * documents (`discovery_evidence.source_ref`, deduplicated) — many
 * sub-domain-scoped invariants were independently compressed from the SAME
 * small shared evidence pool. THAT fact — which invariants share which
 * source documents — is 100% mechanical (a join, no judgment). So the
 * genuine reduction this module offers is not "propagate an existing
 * decision" (none exists) but "shrink 55 independent judgments down to the
 * handful the lineage graph actually requires": one call to the EXISTING
 * `suggestProvenanceClass` per DISTINCT resolved-source signature (never per
 * invariant), reused across every invariant that shares it, with the
 * Steward ratifying the proposal for the whole cohort in one act rather than
 * retyping the same evidence 48 times.
 *
 * ── What is isolated as an exception, and why, deterministically ────────────
 *
 *   no-evidence           — the invariant records no evidence ids at all.
 *   incomplete-lineage     — an evidence id could not be resolved, or a
 *                            resolved row carries no source_ref.
 *   repo-internal-citation — ANY resolved source ref is self-authored
 *                            (`looksSelfAuthored`/`looksInternal`,
 *                            services/research/experimentalPopulations.ts) —
 *                            this platform's own deployed host or a private
 *                            Google Docs/Drive draft. Observed live: 7 of the
 *                            55 (the `qriptocent` sub-domain's founder-
 *                            authored working documents) resolve to NOTHING
 *                            BUT this — never proposed 'external-established',
 *                            full stop, regardless of confidence.
 *   suggestion-unavailable — the shared per-signature call to
 *                            `suggestProvenanceClass` failed or returned no
 *                            suggestion (model error, no resolved sources to
 *                            reason from). Isolated rather than retried
 *                            silently or defaulted.
 *
 * A candidate with a MIXED source set (some self-authored, some not) is also
 * isolated — never proposed, even though `applyProvenanceReclassification`'s
 * own write-time gate would tolerate it (it only requires ONE non-internal
 * ref). That gate is a last-resort backstop against outright laundering, not
 * a design target for what this module should silently auto-propose; a
 * mixed lineage genuinely needs a human to look at what is actually being
 * claimed.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { suggestClassification } from '@/services/invariants/discoveryEngine';
import { suggestProvenanceClass, type ProvenanceClassSuggestion } from '@/services/invariants/provenanceSuggestion';
import { looksSelfAuthored } from '@/services/research/experimentalPopulations';
import type { ProvenanceClass } from '@/services/corpusScout/types';

export type ProvenanceRecommendationDisposition = 'ready' | 'exception';

export type ProvenanceExceptionCause =
  | 'no-evidence'
  | 'incomplete-lineage'
  | 'repo-internal-citation'
  | 'suggestion-unavailable';

export const PROVENANCE_EXCEPTION_LABEL: Record<ProvenanceExceptionCause, string> = {
  'no-evidence': 'No evidence rows recorded',
  'incomplete-lineage': 'Evidence lineage is incomplete or unresolved',
  'repo-internal-citation': 'Cites only repo-internal or self-authored material',
  'suggestion-unavailable': 'A provenance-class suggestion could not be produced',
};

/** ONE invariant's proposed provenance disposition. Never asserts a class for
 *  an exception — `proposedClass` is populated ONLY for `disposition: 'ready'`. */
export interface ProvenanceCandidateRecommendation {
  invariantId: string;
  label: string;
  disposition: ProvenanceRecommendationDisposition;
  /** The exact resolved source refs this invariant's evidence traces to — the
   *  ONLY `evidenceRefs` a downstream write may use (never invented). */
  evidenceRefs: string[];
  /** Sorted, joined `evidenceRefs` — the grouping key so invariants sharing
   *  the identical resolved source set share ONE `suggestProvenanceClass`
   *  call rather than paying for 48 nearly-identical ones. */
  signature: string;
  proposedClass: ProvenanceClass | null;
  confidence: number | null;
  primarySource: string | null;
  supportingSources: string[];
  reason: string | null;
  exceptionCause: ProvenanceExceptionCause | null;
  exceptionDetail: string | null;
}

export interface ProvenanceCohortPreparation {
  recommendations: ProvenanceCandidateRecommendation[];
  /** How many distinct `suggestProvenanceClass` calls this preparation made
   *  (one per distinct signature among `ready` candidates) — disclosed so a
   *  caller can see the reduction: N invariants classified from far fewer
   *  underlying judgments. */
  distinctSignaturesClassified: number;
}

const label = (statement: string): string => (statement.length > 140 ? `${statement.slice(0, 140)}…` : statement);

/** The `ready` subset's invariant ids — what a ratification act writes. Named
 *  the same way `eligibleAdmissionCohortIds` is at Stage 2, so both cohort
 *  flows read identically at a glance. */
export function eligibleProvenanceCohortIds(recs: readonly ProvenanceCandidateRecommendation[]): string[] {
  return recs.filter((r) => r.disposition === 'ready').map((r) => r.invariantId);
}

export interface TriagedProvenanceRecord {
  invariantId: string;
  statement: string;
  /** 'candidate' — deterministically eligible for a proposed class (not yet
   *  proposed; that step calls the model). 'exception' — isolated, never a
   *  class proposal, for one of the four deterministic causes. */
  disposition: 'candidate' | 'exception';
  evidenceRefs: string[];
  signature: string;
  exceptionCause: ProvenanceExceptionCause | null;
  exceptionDetail: string | null;
}

/**
 * ONE batched `discovery_evidence` read across every input invariant's
 * `provenance.evidence_ids`, keyed by evidence row id — was N sequential
 * `suggestClassification()` calls (one Supabase round-trip per invariant),
 * which made this deterministic, no-model-call triage the dominant cost of
 * the full Track 2 programme-state composition once Stage 5 held 50+
 * unclassified members (2026-09-04 profiling — see that day's resolution
 * record). `suggestClassification` itself is untouched and still used by
 * every per-invariant caller (the manual ClassificationQueue UI, and
 * `prepareProvenanceCohort` below's per-signature-representative calls,
 * which need its full source/candidate-title enrichment for the model
 * prompt this function never builds).
 */
async function batchResolveEvidenceSourceRefs(
  admin: SupabaseClient,
  invariants: readonly { provenance: Record<string, unknown> | null }[],
): Promise<Map<string, string | null>> {
  const allIds = new Set<string>();
  for (const inv of invariants) {
    const raw = Array.isArray(inv.provenance?.evidence_ids) ? (inv.provenance!.evidence_ids as unknown[]) : [];
    for (const v of raw) {
      if (typeof v === 'string' && v.trim()) allIds.add(v.trim());
    }
  }
  if (allIds.size === 0) return new Map();
  const { data, error } = await admin.from('discovery_evidence').select('id, source_ref').in('id', [...allIds]);
  // Best-effort, fail-closed: a read error leaves the map empty, so every
  // invariant's evidence ids resolve to "unresolved" below — the SAME
  // conservative outcome `suggestClassification`'s own error branch used to
  // produce (never silently treated as resolved).
  if (error) return new Map();
  const map = new Map<string, string | null>();
  for (const row of data ?? []) {
    map.set(String(row.id), typeof row.source_ref === 'string' ? row.source_ref.trim() || null : null);
  }
  return map;
}

/**
 * The DETERMINISTIC half of cohort preparation — no model call, so it is
 * cheap enough to run on every programme-state read (e.g. to decide whether
 * Stage 5 still holds classifiable work or only isolated exceptions, for
 * `unblockedStageIds`). Resolves each invariant's evidence lineage (via the
 * ONE batched read above, never a second, per-invariant resolver call here)
 * and classifies it into 'candidate' or one of the three deterministic
 * exception causes ('no-evidence', 'incomplete-lineage',
 * 'repo-internal-citation') — 'suggestion-unavailable' can only be produced
 * once the model is actually asked, in `prepareProvenanceCohort` below.
 */
export async function triageUnclassifiedProvenance(
  admin: SupabaseClient,
  invariants: readonly { id: string; statement: string; provenance: Record<string, unknown> | null }[],
): Promise<TriagedProvenanceRecord[]> {
  const sourceRefById = await batchResolveEvidenceSourceRefs(admin, invariants);

  const triaged: TriagedProvenanceRecord[] = [];
  for (const inv of invariants) {
    const evidenceIds = Array.isArray(inv.provenance?.evidence_ids)
      ? (inv.provenance!.evidence_ids as unknown[])
          .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
          .map((v) => v.trim())
      : [];
    if (evidenceIds.length === 0) {
      triaged.push({
        invariantId: inv.id, statement: inv.statement, disposition: 'exception',
        evidenceRefs: [], signature: '',
        exceptionCause: 'no-evidence',
        exceptionDetail: 'No evidence ids are recorded on this invariant\'s provenance bag.',
      });
      continue;
    }

    const unresolvedIds: string[] = [];
    const idsWithoutSourceRef: string[] = [];
    const refSet = new Set<string>();
    for (const id of evidenceIds) {
      if (!sourceRefById.has(id)) { unresolvedIds.push(id); continue; }
      const ref = sourceRefById.get(id);
      if (!ref) { idsWithoutSourceRef.push(id); continue; }
      refSet.add(ref);
    }
    const complete = unresolvedIds.length === 0 && idsWithoutSourceRef.length === 0 && refSet.size > 0;
    if (!complete) {
      const notes: string[] = [];
      if (unresolvedIds.length > 0) {
        notes.push(`${unresolvedIds.length} recorded evidence id(s) could not be resolved to a discovery_evidence row: ${unresolvedIds.join(', ')}.`);
      }
      if (idsWithoutSourceRef.length > 0) {
        notes.push(`${idsWithoutSourceRef.length} evidence row(s) carry no source reference and contribute nothing to this suggestion: ${idsWithoutSourceRef.join(', ')}.`);
      }
      const gaps = notes.join(' ') || 'the evidence lineage could not be fully resolved';
      triaged.push({
        invariantId: inv.id, statement: inv.statement, disposition: 'exception',
        evidenceRefs: [], signature: '',
        exceptionCause: 'incomplete-lineage', exceptionDetail: gaps,
      });
      continue;
    }
    const refs = [...refSet].sort();
    const internalRefs = refs.filter((r) => looksSelfAuthored(r));
    if (internalRefs.length > 0) {
      triaged.push({
        invariantId: inv.id, statement: inv.statement, disposition: 'exception',
        evidenceRefs: refs, signature: '',
        exceptionCause: 'repo-internal-citation',
        exceptionDetail:
          `Cites ${internalRefs.length === refs.length ? 'only' : 'among others,'} self-authored/repo-internal ` +
          `source(s): ${internalRefs.join(', ')}. Can never be proposed 'external-established' — requires ` +
          'individual steward review of what this invariant\'s actual evidentiary basis is.',
      });
      continue;
    }
    triaged.push({
      invariantId: inv.id, statement: inv.statement, disposition: 'candidate',
      evidenceRefs: refs, signature: refs.join('|'),
      exceptionCause: null, exceptionDetail: null,
    });
  }
  return triaged;
}

/** True when NO further mechanical classification progress is possible right
 *  now — every currently-unclassified record has resolved to a genuine,
 *  isolated exception. Used by the programme-state composer to distinguish
 *  "Stage 5 still holds classifiable work" (stays `in-progress`) from "Stage
 *  5's remainder is exceptions only" (reads `partially-complete`, so it does
 *  not withhold Stage 6/7 from the members already classified). */
export function isExceptionOnlyRemainder(triaged: readonly { disposition: 'candidate' | 'exception' }[]): boolean {
  return triaged.length > 0 && triaged.every((t) => t.disposition === 'exception');
}

/**
 * Prepare provenance-classification recommendations for a set of unclassified
 * invariants. Read-only — writes nothing, invents no source, and applies no
 * class; every `proposedClass` is exactly what `suggestProvenanceClass`
 * (the EXISTING per-invariant suggester) returned for the invariant's own
 * resolved evidence, reused across every invariant sharing the identical
 * source signature.
 */
export async function prepareProvenanceCohort(
  admin: SupabaseClient,
  invariants: readonly { id: string; statement: string; provenance: Record<string, unknown> | null }[],
): Promise<ProvenanceCohortPreparation> {
  const triaged = await triageUnclassifiedProvenance(admin, invariants);

  // ── One suggestion per distinct signature, reused across every invariant
  //    sharing it — never one call per invariant. ───────────────────────────
  const bySignature = new Map<string, TriagedProvenanceRecord[]>();
  for (const t of triaged) {
    if (t.disposition !== 'candidate') continue;
    const group = bySignature.get(t.signature) ?? [];
    group.push(t);
    bySignature.set(t.signature, group);
  }

  const signatureSuggestion = new Map<string, ProvenanceClassSuggestion | { error: string } | null>();
  for (const [signature, group] of bySignature) {
    const representative = group[0];
    const resolved = await suggestClassification(admin, representative.invariantId, invariants.find((i) => i.id === representative.invariantId)?.provenance ?? null);
    const result = await suggestProvenanceClass({ id: representative.invariantId, statement: representative.statement }, resolved);
    if (!result.ok) {
      signatureSuggestion.set(signature, { error: result.error });
    } else if (!result.suggestion) {
      signatureSuggestion.set(signature, { error: 'no resolved sources to reason from' });
    } else {
      signatureSuggestion.set(signature, result.suggestion);
    }
  }

  const recommendations: ProvenanceCandidateRecommendation[] = triaged.map((t) => {
    const base = {
      invariantId: t.invariantId,
      label: label(t.statement),
      evidenceRefs: t.evidenceRefs,
      signature: t.signature,
    };
    if (t.disposition === 'exception') {
      return {
        ...base,
        disposition: 'exception' as const,
        proposedClass: null, confidence: null, primarySource: null, supportingSources: [], reason: null,
        exceptionCause: t.exceptionCause, exceptionDetail: t.exceptionDetail,
      };
    }
    const suggestion = signatureSuggestion.get(t.signature) ?? null;
    if (!suggestion || 'error' in suggestion) {
      return {
        ...base,
        disposition: 'exception' as const,
        proposedClass: null, confidence: null, primarySource: null, supportingSources: [], reason: null,
        exceptionCause: 'suggestion-unavailable' as const,
        exceptionDetail: suggestion && 'error' in suggestion ? suggestion.error : 'no suggestion produced',
      };
    }
    return {
      ...base,
      disposition: 'ready' as const,
      proposedClass: suggestion.suggestedClass,
      confidence: suggestion.confidence,
      primarySource: suggestion.primarySource,
      supportingSources: suggestion.supportingSources,
      reason: suggestion.reason,
      exceptionCause: null, exceptionDetail: null,
    };
  });

  return { recommendations, distinctSignaturesClassified: bySignature.size };
}
