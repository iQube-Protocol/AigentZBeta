/**
 * Invariant Service — lifecycle: validation, canonicalization, evolution,
 * conflicts, merging, standing (CFS-003a §2.2, §2.4–2.7; CFS-001 §4–§7).
 *
 * Receipts: lifecycle transitions emit activity receipts
 * (invariant_discovered / invariant_validated / invariant_canonized /
 * invariant_superseded). validated/canonized/superseded are DVN-anchorable.
 * Receipt emission requires the acting persona's T0 id, which stays inside
 * the route layer → these functions accept it as an opaque parameter and
 * never place it on any returned object.
 *
 * Server-only.
 */

import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type {
  InvariantRecord,
  InvariantStatus,
} from '@/types/invariants';
import { findDuplicates } from './comparison';
import { wouldCreateCycle } from './graph';
import {
  getInvariantById,
  insertEdge,
  insertInvariant,
  listContexts,
  listEdgesForInvariants,
  updateEdgeEndpoints,
  deleteEdge,
  updateInvariant,
  upsertContext,
  type AddEdgeInput,
  type CreateInvariantInput,
} from './store';

// ─────────────────────────────────────────────────────────────────────────
// Statement canonicalization (CFS-003a §2.4)
// ─────────────────────────────────────────────────────────────────────────

export interface CanonicalFormResult {
  canonical: string;
  issues: string[];
}

export function canonicalizeStatement(raw: string): CanonicalFormResult {
  const issues: string[] = [];
  let statement = raw.replace(/\s+/g, ' ').trim();
  if (!statement) {
    return { canonical: '', issues: ['statement is empty'] };
  }
  statement = statement[0].toUpperCase() + statement.slice(1);
  if (!/[.!?]$/.test(statement)) statement = `${statement}.`;

  // Simplest-canonical-form heuristics: one sentence, no compound chains.
  const sentenceCount = (statement.match(/[.!?](\s|$)/g) ?? []).length;
  if (sentenceCount > 1) {
    issues.push('statement contains multiple sentences — split into invariants + composes edges');
  }
  if (statement.length > 200) {
    issues.push('statement exceeds 200 characters — likely not the simplest canonical form');
  }
  return { canonical: statement, issues };
}

// ─────────────────────────────────────────────────────────────────────────
// Discovery (creation with receipt)
// ─────────────────────────────────────────────────────────────────────────

export interface DiscoverInvariantResult {
  invariant: InvariantRecord;
  formIssues: string[];
  duplicates: { id: string; statement: string; similarity: number }[];
}

export async function discoverInvariant(
  input: CreateInvariantInput & {
    contexts?: {
      domain: string;
      interpretation?: string | null;
      applicabilityConditions?: Record<string, unknown> | null;
      retrievalTags?: string[];
    }[];
  },
  actor: { personaId: string; sessionId?: string } | null,
): Promise<DiscoverInvariantResult> {
  const { canonical, issues } = canonicalizeStatement(input.statement);
  if (!canonical) throw new Error('invariant statement is required');

  const duplicates = await findDuplicates(canonical, { namespace: input.namespace });
  const exact = duplicates.find((d) => d.exact);
  if (exact) {
    throw new Error(
      `duplicate: an invariant with this statement already exists (${exact.invariant.id})`,
    );
  }

  const invariant = await insertInvariant({ ...input, statement: canonical });

  for (const ctx of input.contexts ?? []) {
    await upsertContext({
      invariantId: invariant.id,
      domain: ctx.domain,
      interpretation: ctx.interpretation ?? null,
      applicabilityConditions: ctx.applicabilityConditions ?? null,
      retrievalTags: ctx.retrievalTags,
    });
  }

  if (actor) {
    await createActivityReceipt({
      personaId: actor.personaId,
      sessionId: actor.sessionId,
      actionType: 'invariant_discovered',
      summary: `Invariant discovered (${invariant.namespace}): ${invariant.statement}`,
      activeCartridge: 'agentiq',
    }).catch((err) => console.error('[invariants] discovery receipt failed', err));
  }

  return {
    invariant,
    formIssues: issues,
    duplicates: duplicates.map((d) => ({
      id: d.invariant.id,
      statement: d.invariant.statement,
      similarity: d.similarity,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Lifecycle transitions (CFS-001 §4)
// ─────────────────────────────────────────────────────────────────────────

const TRANSITIONS: Record<string, InvariantStatus[]> = {
  draft: ['proposed', 'rejected'],
  proposed: ['validated', 'rejected', 'draft'],
  validated: ['canonical', 'proposed', 'deprecated', 'superseded'],
  canonical: ['deprecated', 'superseded'],
};

function assertTransition(from: InvariantStatus, to: InvariantStatus): void {
  if (!(TRANSITIONS[from] ?? []).includes(to)) {
    throw new Error(`invalid lifecycle transition: ${from} → ${to}`);
  }
}

export interface ValidationVerdict {
  ok: boolean;
  checks: { name: string; passed: boolean; detail?: string }[];
}

/**
 * CFS-001 §7 — validation gate. Runs the consistency/groundedness/form
 * checks; on pass transitions proposed → validated and emits the receipt.
 */
export async function validateInvariant(
  invariantId: string,
  actor: { personaId: string; sessionId?: string },
): Promise<{ invariant: InvariantRecord; verdict: ValidationVerdict }> {
  const invariant = await getInvariantById(invariantId);
  if (!invariant) throw new Error('invariant not found');
  assertTransition(invariant.status, 'validated');

  const checks: ValidationVerdict['checks'] = [];

  // 1. Consistency — no contradicts edge touching a canonical invariant.
  const contradictions = await listEdgesForInvariants([invariantId], 'both', ['contradicts']);
  let inconsistent = false;
  for (const edge of contradictions) {
    const otherId =
      edge.fromInvariantId === invariantId ? edge.toInvariantId : edge.fromInvariantId;
    const other = await getInvariantById(otherId);
    if (other?.status === 'canonical') {
      inconsistent = true;
      checks.push({
        name: 'consistency',
        passed: false,
        detail: `contradicts canonical invariant ${otherId}`,
      });
      break;
    }
  }
  if (!inconsistent) checks.push({ name: 'consistency', passed: true });

  // 2. Groundedness — provenance present.
  const grounded =
    Object.keys(invariant.provenance).length > 0 ||
    Object.keys(invariant.reasoningProvenance).length > 0;
  checks.push({
    name: 'groundedness',
    passed: grounded,
    detail: grounded ? undefined : 'no provenance or reasoning_provenance recorded',
  });

  // 3. Canonical form.
  const { issues } = canonicalizeStatement(invariant.statement);
  checks.push({
    name: 'canonical_form',
    passed: issues.length === 0,
    detail: issues.join('; ') || undefined,
  });

  const ok = checks.every((c) => c.passed);
  if (!ok) return { invariant, verdict: { ok, checks } };

  const updated = await updateInvariant(invariantId, {
    status: 'validated',
    times_validated: invariant.timesValidated + 1,
  });
  const withStanding = await recomputeStanding(updated.id);

  await createActivityReceipt({
    personaId: actor.personaId,
    sessionId: actor.sessionId,
    actionType: 'invariant_validated',
    summary: `Invariant validated (${invariant.namespace}): ${invariant.statement}`,
    activeCartridge: 'agentiq',
  }).catch((err) => console.error('[invariants] validation receipt failed', err));

  return { invariant: withStanding, verdict: { ok, checks } };
}

/**
 * CFS-003a §2.4 — canonization. validated → canonical. The route layer
 * enforces that the actor is a human admin (Law XI); the receipt is
 * DVN-anchored (invariant_canonized ∈ ANCHORABLE_ACTION_TYPES).
 */
export async function canonizeInvariant(
  invariantId: string,
  actor: { personaId: string; sessionId?: string },
): Promise<InvariantRecord> {
  const invariant = await getInvariantById(invariantId);
  if (!invariant) throw new Error('invariant not found');
  assertTransition(invariant.status, 'canonical');

  const receipt = await createActivityReceipt({
    personaId: actor.personaId,
    sessionId: actor.sessionId,
    actionType: 'invariant_canonized',
    summary: `Invariant canonized (${invariant.namespace}): ${invariant.statement}`,
    activeCartridge: 'agentiq',
  }).catch((err) => {
    console.error('[invariants] canonization receipt failed', err);
    return null;
  });

  const updated = await updateInvariant(invariantId, {
    status: 'canonical',
    dvn_receipt_id: receipt?.id ?? null,
  });
  return recomputeStanding(updated.id);
}

export async function transitionInvariant(
  invariantId: string,
  to: Extract<InvariantStatus, 'proposed' | 'rejected' | 'deprecated'>,
  actor: { personaId: string; sessionId?: string },
): Promise<InvariantRecord> {
  const invariant = await getInvariantById(invariantId);
  if (!invariant) throw new Error('invariant not found');
  assertTransition(invariant.status, to);
  void actor;
  return updateInvariant(invariantId, { status: to });
}

// ─────────────────────────────────────────────────────────────────────────
// Invariant Standing & Reach (CFS-001 §6, Law XII) — orthogonal dimensions,
// never conflated. The accumulators are the ledger; each score is a derived
// view over its OWN signal class:
//
//   Standing (validation-class only — constitutional confidence):
//     base    = times_validated * 8
//     score   = 100 * base / (base + 40)        — saturating growth
//     penalty = min(0.8, times_contradicted * 0.15)
//     standing = round(score * (1 - penalty), 1)
//
//   Reach (adoption-class only — never a truth signal):
//     base  = times_referenced * 2 + times_used * 0.5
//     reach = round(100 * base / (base + 40), 1)
//
// Truth is never a stored number — validation estimates it, bounded by
// confidence and domain. Tune these formulas by canonization, not ad-hoc edit.
// ─────────────────────────────────────────────────────────────────────────

export function computeStandingScore(input: {
  timesValidated: number;
  timesContradicted: number;
}): number {
  const base = input.timesValidated * 8;
  const score = base <= 0 ? 0 : (100 * base) / (base + 40);
  const penalty = Math.min(0.8, input.timesContradicted * 0.15);
  return Math.round(score * (1 - penalty) * 10) / 10;
}

export function computeReachScore(input: {
  timesReferenced: number;
  timesUsed: number;
}): number {
  const base = input.timesReferenced * 2 + input.timesUsed * 0.5;
  const score = base <= 0 ? 0 : (100 * base) / (base + 40);
  return Math.round(score * 10) / 10;
}

export async function recomputeStanding(invariantId: string): Promise<InvariantRecord> {
  const invariant = await getInvariantById(invariantId);
  if (!invariant) throw new Error('invariant not found');
  const inbound = await listEdgesForInvariants([invariantId], 'in');
  const standing = computeStandingScore({
    timesValidated: invariant.timesValidated,
    timesContradicted: invariant.timesContradicted,
  });
  const reach = computeReachScore({
    timesReferenced: inbound.length,
    timesUsed: invariant.timesUsed,
  });
  return updateInvariant(invariantId, {
    standing,
    reach,
    times_referenced: inbound.length,
  });
}

/**
 * CFS-003a §2.5 — evolution: observed consequence adjusts confidence,
 * accumulators, and standing. Never mutates the statement.
 */
export async function recordConsequence(
  invariantId: string,
  outcome: 'confirmed' | 'contradicted',
  evidence: { ref?: string; note?: string } = {},
): Promise<InvariantRecord> {
  const invariant = await getInvariantById(invariantId);
  if (!invariant) throw new Error('invariant not found');

  const history = Array.isArray(invariant.reasoningProvenance.evolution)
    ? (invariant.reasoningProvenance.evolution as unknown[])
    : [];
  history.push({ outcome, ...evidence, at: new Date().toISOString() });

  const patch: Record<string, unknown> = {
    reasoning_provenance: { ...invariant.reasoningProvenance, evolution: history },
  };
  if (outcome === 'confirmed') {
    patch.confidence = Math.min(1, invariant.confidence + 0.05 * (1 - invariant.confidence));
    patch.times_validated = invariant.timesValidated + 1;
  } else {
    patch.confidence = Math.max(0, invariant.confidence - 0.1);
    patch.times_contradicted = invariant.timesContradicted + 1;
  }
  await updateInvariant(invariantId, patch);
  return recomputeStanding(invariantId);
}

/** Runtime citation hook (grounding/forecasting) — bump usage + standing. */
export async function recordUsage(invariantId: string): Promise<void> {
  const invariant = await getInvariantById(invariantId);
  if (!invariant) return;
  await updateInvariant(invariantId, { times_used: invariant.timesUsed + 1 });
  await recomputeStanding(invariantId).catch(() => undefined);
}

// ─────────────────────────────────────────────────────────────────────────
// Edges with cycle guard (CFS-003 §3) + conflicts (CFS-003a §2.6)
// ─────────────────────────────────────────────────────────────────────────

export async function addEdge(input: AddEdgeInput) {
  if (await wouldCreateCycle(input.fromInvariantId, input.toInvariantId, input.edgeType)) {
    throw new Error(`edge would create a cycle in acyclic edge type '${input.edgeType}'`);
  }
  const edge = await insertEdge(input);
  await recomputeStanding(input.toInvariantId).catch(() => undefined);

  // Conflict handling: a contradicts edge involving a canonical invariant
  // quarantines the non-canonical side back to 'proposed' (CFS-003a §2.6).
  if (input.edgeType === 'contradicts') {
    const [from, to] = await Promise.all([
      getInvariantById(input.fromInvariantId),
      getInvariantById(input.toInvariantId),
    ]);
    const canonicalSide = from?.status === 'canonical' ? from : to?.status === 'canonical' ? to : null;
    const challenger = canonicalSide?.id === from?.id ? to : from;
    if (canonicalSide && challenger && challenger.status === 'validated') {
      await updateInvariant(challenger.id, { status: 'proposed' });
      console.error(
        `[INVARIANT CONFLICT] ${challenger.id} contradicts canonical ${canonicalSide.id} — quarantined to 'proposed'; operator ratification required`,
      );
    }
  }
  return edge;
}

// ─────────────────────────────────────────────────────────────────────────
// Merging (CFS-003a §2.7) — duplicates fold into the survivor; provenance
// and contexts are preserved; merged rows become 'superseded'.
// ─────────────────────────────────────────────────────────────────────────

export async function mergeInvariants(
  survivorId: string,
  mergedIds: string[],
  actor: { personaId: string; sessionId?: string },
): Promise<InvariantRecord> {
  const survivor = await getInvariantById(survivorId);
  if (!survivor) throw new Error('survivor invariant not found');

  for (const mergedId of mergedIds) {
    if (mergedId === survivorId) continue;
    const merged = await getInvariantById(mergedId);
    if (!merged) continue;

    // Redirect edges to the survivor; drop edges that would self-loop or
    // duplicate an existing survivor edge.
    const edges = await listEdgesForInvariants([mergedId], 'both');
    for (const edge of edges) {
      const newFrom = edge.fromInvariantId === mergedId ? survivorId : edge.fromInvariantId;
      const newTo = edge.toInvariantId === mergedId ? survivorId : edge.toInvariantId;
      if (newFrom === newTo) {
        await deleteEdge(edge.id);
        continue;
      }
      try {
        await updateEdgeEndpoints(edge.id, {
          from_invariant_id: newFrom,
          to_invariant_id: newTo,
        });
      } catch {
        await deleteEdge(edge.id); // unique violation → survivor already has this edge
      }
    }

    // Union contexts.
    for (const ctx of await listContexts(mergedId)) {
      await upsertContext({
        invariantId: survivorId,
        domain: ctx.domain,
        interpretation: ctx.interpretation,
        applicabilityConditions: ctx.applicabilityConditions,
        retrievalTags: ctx.retrievalTags,
      });
    }

    await updateInvariant(mergedId, { status: 'superseded' });
    await insertEdge({
      fromInvariantId: survivorId,
      toInvariantId: mergedId,
      edgeType: 'supersedes',
      rationale: 'merged duplicate',
    }).catch(() => undefined);

    await createActivityReceipt({
      personaId: actor.personaId,
      sessionId: actor.sessionId,
      actionType: 'invariant_superseded',
      summary: `Invariant merged into ${survivorId}: ${merged.statement}`,
      activeCartridge: 'agentiq',
    }).catch((err) => console.error('[invariants] merge receipt failed', err));
  }

  return recomputeStanding(survivorId);
}
