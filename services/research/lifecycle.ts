/**
 * Research lifecycle service — CFS-019 §4, Phase C.
 *
 * Two honest mechanisms, never conflated:
 *  - deriveOverview(): the FLOOR state of every experiment, COMPUTED from
 *    canonical publications (experiment_results) — published/replicated are
 *    facts of the record, never asserted.
 *  - recordExperimentTransition(): operator-initiated lifecycle moves
 *    (protocol ratification, evaluation sign-off) receipted as
 *    `research_lifecycle_transition` (DVN-anchorable) with the experiment's
 *    governing invariants carried as invariants_used.
 *
 * Phase C2.2 additions (persistence + receipted approvals, CFS-019):
 *  - listResearchObjects()/upsertResearchObject(): the durable lab record for
 *    approved copilot proposals (research_objects table).
 *  - recordResearchObjectCreated(): create-kind approvals (experiment design,
 *    finding, publication draft) receipted through the SAME receipt
 *    constructor as recordExperimentTransition — creation IS the entry
 *    transition of a lifecycle; one receipt path, no fork.
 *
 * Server-only.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { getInvariantsBySeedIds } from '@/services/invariants/store';
import {
  EXPERIMENT_REGISTRY,
  isLegalExperimentTransition,
  type ExperimentLifecycleState,
  type ResearchExperiment,
  type ResearchOverviewEntry,
} from '@/types/research';

/** Floor lifecycle from the canonical record: any published run ⇒ at least
 * `published`; runs across ≥2 distinct providers ⇒ `replicated` (independent
 * substitution is the replication signal we can compute honestly today);
 * no runs ⇒ `running` for experiments whose runners ship (all registry
 * members do), since the machinery exists and is exercised operator-paced. */
export async function deriveOverview(): Promise<ResearchOverviewEntry[]> {
  const client = getSupabaseServer();
  const rows: Array<{ experiment: string; provider: string; created_at: string }> = [];
  if (client) {
    const { data } = await client
      .from('experiment_results')
      .select('experiment, provider, created_at')
      .order('created_at', { ascending: true });
    for (const r of data ?? []) {
      rows.push({
        experiment: String(r.experiment),
        provider: String(r.provider),
        created_at: String(r.created_at),
      });
    }
  }

  return EXPERIMENT_REGISTRY.map((experiment) => {
    const runs = rows.filter((r) => r.experiment === experiment.id);
    const providers = new Set(runs.map((r) => r.provider));
    let lifecycle: ExperimentLifecycleState = 'running';
    if (providers.size >= 2) lifecycle = 'replicated';
    else if (runs.length > 0) lifecycle = 'published';
    return {
      experiment,
      lifecycle,
      publishedRuns: runs.length,
      distinctProviders: providers.size,
      latestRunAt: runs.length > 0 ? runs[runs.length - 1].created_at : null,
    };
  });
}

/**
 * The ONE receipt constructor for research lifecycle events — used by both
 * recordExperimentTransition (advances) and recordResearchObjectCreated
 * (entry-state creations). NEVER fork this: every research approval, however
 * initiated, must ride the same `research_lifecycle_transition` action type
 * (DVN-anchorable) with governing invariants carried as invariants_used.
 */
async function writeLifecycleReceipt(input: {
  personaId: string;
  summary: string;
  invariantSeedIds: string[];
}): Promise<{ ok: boolean; receiptId: string | null }> {
  const invariantRows = await getInvariantsBySeedIds(input.invariantSeedIds).catch(() => []);
  const receipt = await createActivityReceipt({
    personaId: input.personaId,
    activeCartridge: 'ccrl',
    actionType: 'research_lifecycle_transition',
    summary: input.summary,
    contextShared: ['ccrl-research'],
    ...(invariantRows.length > 0 ? { invariantsUsed: invariantRows.map((r) => r.id) } : {}),
  }).catch(() => null);
  return { ok: Boolean(receipt), receiptId: receipt?.id ?? null };
}

export async function recordExperimentTransition(input: {
  personaId: string;
  experimentId: string;
  from: ExperimentLifecycleState;
  to: ExperimentLifecycleState;
  evidence: string;
  /** C2.2: a session-designed experiment (persisted in research_objects) is
   * not in the pinned registry — the caller may supply the definition it has
   * already verified server-side. The registry stays authoritative whenever
   * it knows the id; the fallback is used only for unknown ids and only when
   * its id matches. */
  fallbackExperiment?: ResearchExperiment;
}): Promise<{ ok: boolean; error?: string; receiptId?: string | null }> {
  const experiment =
    EXPERIMENT_REGISTRY.find((e) => e.id === input.experimentId) ??
    (input.fallbackExperiment?.id === input.experimentId ? input.fallbackExperiment : undefined);
  if (!experiment) return { ok: false, error: `unknown experiment '${input.experimentId}'` };
  if (!isLegalExperimentTransition(input.from, input.to)) {
    return {
      ok: false,
      error: `illegal transition ${input.from} → ${input.to} (one step forward, or re-enter running)`,
    };
  }
  if (!input.evidence.trim()) {
    return { ok: false, error: 'evidence required — a transition without evidence is an assertion' };
  }

  const { ok, receiptId } = await writeLifecycleReceipt({
    personaId: input.personaId,
    summary: `${experiment.id} ${input.from} → ${input.to} — ${input.evidence.slice(0, 140)}`,
    invariantSeedIds: experiment.governingInvariants,
  });
  return { ok, receiptId, ...(ok ? {} : { error: 'receipt write failed' }) };
}

// ─── Phase C2.2 — persisted research objects + create-kind receipts ──────────

export type ResearchObjectKind = 'experiment' | 'finding' | 'publication';

export interface ResearchObjectRecord {
  objectKind: ResearchObjectKind;
  objectId: string;
  payload: Record<string, unknown>;
  lifecycleState: string;
  receiptId: string | null;
  createdAt: string;
  updatedAt: string;
}

const MIGRATION_HINT =
  'research_objects table missing — apply supabase/migrations/20260707100000_research_objects.sql';

/** List the durable lab record (approved research objects). T2-safe rows only
 * — the table carries no persona/identity columns at all. */
export async function listResearchObjects(): Promise<{
  ok: boolean;
  error?: string;
  objects: ResearchObjectRecord[];
}> {
  const client = getSupabaseServer();
  if (!client) return { ok: false, error: 'supabase unavailable', objects: [] };
  const { data, error } = await client
    .from('research_objects')
    .select('object_kind, object_id, payload, lifecycle_state, receipt_id, created_at, updated_at')
    .order('updated_at', { ascending: true });
  if (error) {
    return {
      ok: false,
      error: /does not exist/i.test(error.message) ? MIGRATION_HINT : error.message,
      objects: [],
    };
  }
  return {
    ok: true,
    objects: (data ?? []).map((row) => ({
      objectKind: String(row.object_kind) as ResearchObjectKind,
      objectId: String(row.object_id),
      payload: (row.payload ?? {}) as Record<string, unknown>,
      lifecycleState: String(row.lifecycle_state),
      receiptId: row.receipt_id ? String(row.receipt_id) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })),
  };
}

/** Upsert one research object on (object_kind, object_id) — idempotent
 * re-approve. Callers (the admin-gated objects route) MUST have already
 * re-validated the payload via applyResearchProposal + the T2 guard. */
export async function upsertResearchObject(input: {
  objectKind: ResearchObjectKind;
  objectId: string;
  payload: Record<string, unknown>;
  lifecycleState: string;
  receiptId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseServer();
  if (!client) return { ok: false, error: 'supabase unavailable' };
  const { error } = await client.from('research_objects').upsert(
    {
      object_kind: input.objectKind,
      object_id: input.objectId,
      payload: input.payload,
      lifecycle_state: input.lifecycleState,
      ...(input.receiptId !== undefined ? { receipt_id: input.receiptId } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'object_kind,object_id' },
  );
  if (error) {
    return { ok: false, error: /does not exist/i.test(error.message) ? MIGRATION_HINT : error.message };
  }
  return { ok: true };
}

/**
 * Receipt a CREATE-kind approval (experiment design, finding, publication
 * draft) — the object ENTERING its lifecycle at the entry state is itself a
 * lifecycle transition, so it rides the same `research_lifecycle_transition`
 * receipt path (writeLifecycleReceipt) as operator-initiated advances.
 * Composition, not a parallel receipt mechanism.
 */
export async function recordResearchObjectCreated(input: {
  personaId: string;
  objectKind: ResearchObjectKind;
  objectId: string;
  entryState: string;
  summary: string;
  governingInvariants?: string[];
}): Promise<{ ok: boolean; error?: string; receiptId?: string | null }> {
  if (!input.summary.trim()) {
    return { ok: false, error: 'summary required — a creation without a summary is an assertion' };
  }
  const { ok, receiptId } = await writeLifecycleReceipt({
    personaId: input.personaId,
    summary: `${input.objectId} created at ${input.entryState} (${input.objectKind}) — ${input.summary.slice(0, 140)}`,
    invariantSeedIds: input.governingInvariants ?? [],
  });
  return { ok, receiptId, ...(ok ? {} : { error: 'receipt write failed' }) };
}
