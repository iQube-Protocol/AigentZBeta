/**
 * Persistence for the Post-Freeze Observer Review capability
 * (services/research/crystalObserverReview.ts).
 *
 * Lives apart from the pure logic module for the same reason
 * `independentReviewStore.ts` sits outside `services/research/review/`: that
 * directory is canaried to import no database client at all, so the pure
 * decision/round/package logic stays reachable by a reviewer with no way of
 * addressing a table.
 *
 * Storage reuses `research_objects` (`object_kind: 'observer_review_round'`)
 * rather than a new table — the same composition discipline PRD-EPI-001's
 * artifacts.ts and independentReviewStore.ts already follow (inv.engineering.036).
 * ONE row per (experimentId, artifactId) round; a round is superseded, never
 * deleted, exactly like `markReviewSuperseded`'s discipline for the R1/R2
 * review queue.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ChangeProposal,
  ObserverDecision,
  ObserverReviewPackage,
  ObserverRoundPolicy,
} from '@/services/research/crystalObserverReview';

const TABLE = 'research_objects';
const OBJECT_KIND = 'observer_review_round';

export type ObserverRoundStatus = 'awaiting-freeze' | 'open' | 'closed-superseded';

export interface ObserverReviewRoundRecord {
  roundId: string;
  experimentId: string;
  artifactId: string;
  status: ObserverRoundStatus;
  /** Null until the artifact this round targets is actually frozen and a
   *  package has been built against it. */
  package: ObserverReviewPackage | null;
  roundPolicy: ObserverRoundPolicy;
  assignedObserverRefs: string[];
  /** Keyed implicitly by observerRef — `upsertObserverDecision` enforces
   *  exactly one live row per observer; this array never carries two
   *  decisions from the same observerRef. */
  decisions: ObserverDecision[];
  changeProposals: ChangeProposal[];
  /** The prior round this one supersedes, when this round exists because a
   *  Change Proposal was accepted and opened a fresh round. */
  supersedes: string | null;
  supersededBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  object_id: string;
  payload: unknown;
  lifecycle_state: string;
  created_at: string;
  updated_at: string;
}

function toRecord(row: Row): ObserverReviewRoundRecord {
  const p = (row.payload ?? {}) as Partial<ObserverReviewRoundRecord>;
  return {
    roundId: row.object_id,
    experimentId: String(p.experimentId ?? ''),
    artifactId: String(p.artifactId ?? ''),
    status: (row.lifecycle_state as ObserverRoundStatus) || 'awaiting-freeze',
    package: p.package ?? null,
    roundPolicy: p.roundPolicy ?? 'all-assigned',
    assignedObserverRefs: p.assignedObserverRefs ?? [],
    decisions: p.decisions ?? [],
    changeProposals: p.changeProposals ?? [],
    supersedes: p.supersedes ?? null,
    supersededBy: p.supersededBy ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The round id for one (experimentId, artifactId) pair — deterministic, so
 *  repeated calls resolve the SAME round rather than minting duplicates. */
export function observerRoundId(experimentId: string, artifactId: string): string {
  return `observer-round:${experimentId}:${artifactId}`;
}

export async function getObserverRound(
  admin: SupabaseClient,
  roundId: string,
): Promise<ObserverReviewRoundRecord | null> {
  const { data, error } = await admin
    .from(TABLE)
    .select('object_id,payload,lifecycle_state,created_at,updated_at')
    .eq('object_kind', OBJECT_KIND)
    .eq('object_id', roundId)
    .maybeSingle();
  if (error) throw new Error(`observer round read failed: ${error.message}`);
  return data ? toRecord(data as unknown as Row) : null;
}

/** Every round for one experiment, most-recently-updated first — including
 *  superseded rounds, so a caller can walk the full lineage. */
export async function listObserverRoundsForExperiment(
  admin: SupabaseClient,
  experimentId: string,
): Promise<ObserverReviewRoundRecord[]> {
  const { data, error } = await admin
    .from(TABLE)
    .select('object_id,payload,lifecycle_state,created_at,updated_at')
    .eq('object_kind', OBJECT_KIND)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`observer round list failed: ${error.message}`);
  return ((data ?? []) as unknown as Row[])
    .map(toRecord)
    .filter((r) => r.experimentId === experimentId);
}

/** The CURRENT (not-superseded) round for one artifact lineage, or null. */
export async function getCurrentObserverRound(
  admin: SupabaseClient,
  experimentId: string,
  artifactId: string,
): Promise<ObserverReviewRoundRecord | null> {
  const roundId = observerRoundId(experimentId, artifactId);
  return getObserverRound(admin, roundId);
}

export async function upsertObserverRound(
  admin: SupabaseClient,
  record: Omit<ObserverReviewRoundRecord, 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const { roundId, status, ...payload } = record;
  const { error } = await admin.from(TABLE).upsert(
    {
      object_kind: OBJECT_KIND,
      object_id: roundId,
      payload,
      lifecycle_state: status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'object_kind,object_id' },
  );
  if (error) throw new Error(`observer round write failed: ${error.message}`);
}

/**
 * Record (or replace) ONE observer's decision on a round. Enforces the
 * structural guarantee behind SPEC point 7 — "a delegated agent may submit
 * attributable evidence, but does not create an additional observer vote":
 * the write is keyed by `decision.observerRef`, so any number of
 * agent-assisted resubmissions from the same human observer still resolve to
 * exactly one row for that observer.
 */
export async function upsertObserverDecision(
  admin: SupabaseClient,
  roundId: string,
  decision: ObserverDecision,
): Promise<ObserverReviewRoundRecord> {
  const existing = await getObserverRound(admin, roundId);
  if (!existing) throw new Error(`cannot record a decision — round '${roundId}' does not exist`);
  if (existing.status !== 'open') {
    throw new Error(`round '${roundId}' is '${existing.status}', not 'open' — decisions may only be recorded against an open round`);
  }
  const decisions = [
    ...existing.decisions.filter((d) => d.observerRef !== decision.observerRef),
    decision,
  ];
  await upsertObserverRound(admin, { ...existing, decisions });
  return { ...existing, decisions };
}

export async function appendChangeProposal(
  admin: SupabaseClient,
  roundId: string,
  proposal: ChangeProposal,
): Promise<ObserverReviewRoundRecord> {
  const existing = await getObserverRound(admin, roundId);
  if (!existing) throw new Error(`cannot record a change proposal — round '${roundId}' does not exist`);
  const changeProposals = [...existing.changeProposals, proposal];
  await upsertObserverRound(admin, { ...existing, changeProposals });
  return { ...existing, changeProposals };
}

export async function resolveStoredChangeProposal(
  admin: SupabaseClient,
  roundId: string,
  resolved: ChangeProposal,
): Promise<ObserverReviewRoundRecord> {
  const existing = await getObserverRound(admin, roundId);
  if (!existing) throw new Error(`cannot resolve a change proposal — round '${roundId}' does not exist`);
  const changeProposals = existing.changeProposals.map((p) => (p.proposalId === resolved.proposalId ? resolved : p));
  await upsertObserverRound(admin, { ...existing, changeProposals });
  return { ...existing, changeProposals };
}

/** Mark a round superseded by the fresh round an accepted Change Proposal
 *  opened — never deleted, exactly like `markReviewSuperseded`'s discipline
 *  for the R1/R2 review queue. */
export async function markObserverRoundSuperseded(
  admin: SupabaseClient,
  roundId: string,
  supersededBy: string,
): Promise<void> {
  const existing = await getObserverRound(admin, roundId);
  if (!existing) throw new Error(`cannot mark '${roundId}' superseded — it does not exist`);
  await upsertObserverRound(admin, { ...existing, status: 'closed-superseded', supersededBy });
}
