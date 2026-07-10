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
  EXPERIMENT_LIFECYCLE,
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

// ─── Instruments ↔ institution — runs advance the research-object lifecycle ───

export type ExperimentRunEvent = 'run-started' | 'results-published';

/**
 * The registry-derived FLOOR at which a run auto-materialises a research
 * object. A registry experiment whose runner ships and is being exercised sits
 * at `running` before any run is persisted — the SAME floor deriveOverview
 * computes for a zero-run shipping experiment. Auto-materialisation uses this
 * floor, then applies the run event as a legal transition on top of it.
 */
export const RUN_LIFECYCLE_FLOOR: ExperimentLifecycleState = 'running';

/**
 * Map a run event to the single legal target lifecycle state, given the
 * object's current state. `run-started` moves toward `running` (legality still
 * checked below — from `designed` it is illegal). `results-published` takes the
 * ONE legal step within the evaluate→publish band; it deliberately NEVER drives
 * `replicated` (replication is deriveOverview's computed multi-provider signal,
 * never a single-run assertion). `null` target ⇒ honest refusal, no receipt.
 */
export function nextRunState(
  event: ExperimentRunEvent,
  from: ExperimentLifecycleState,
): { to: ExperimentLifecycleState | null; reason?: string } {
  if (event === 'run-started') return { to: 'running' };
  // results-published: advance one legal step toward `published`, capped there.
  if (from === 'running') return { to: 'evaluated' };
  if (from === 'evaluated') return { to: 'published' };
  if (from === 'published' || from === 'replicated') {
    return { to: null, reason: 'already-published' };
  }
  // designed / protocol-ratified — a run was never recorded to publish from.
  return { to: null, reason: 'run-not-started' };
}

/**
 * Wire an EXP runner's run to its research-object lifecycle (CFS-019 §4 —
 * instruments ↔ institution). Composition only: every state change rides the
 * ONE receipt path (writeLifecycleReceipt, via recordResearchObjectCreated /
 * recordExperimentTransition) as `research_lifecycle_transition`. NO second
 * createActivityReceipt call site is introduced.
 *
 * Honest refusal over silent forcing: when the event maps to no legal step
 * from the object's current state, NOTHING is recorded and
 * `{ ok: false, reason }` is returned. Registry experiments predate C2.2 and
 * carry no research_objects row — the first run auto-materialises the object at
 * RUN_LIFECYCLE_FLOOR (receipted as a creation) BEFORE applying the transition,
 * and the response carries `created: true`.
 *
 * `evidence` is a short T2-safe descriptor (provider/arm labels + counts only,
 * never payloads or T0 identifiers). `personaId` is used server-side for the
 * receipt exactly as recordExperimentTransition does — never echoed, never
 * persisted in research_objects.
 */
export async function recordExperimentRunLifecycle(input: {
  personaId: string;
  experimentId: string;
  event: ExperimentRunEvent;
  evidence: string;
}): Promise<{
  ok: boolean;
  reason?: string;
  experimentId: string;
  event: ExperimentRunEvent;
  from: ExperimentLifecycleState;
  to: ExperimentLifecycleState | null;
  state: ExperimentLifecycleState;
  created: boolean;
  receiptId?: string | null;
}> {
  const { experimentId, event } = input;
  const evidence = input.evidence.trim();

  // Resolve the object's definition + current state from the persisted record;
  // the pinned registry is authoritative for its own ids.
  const listed = await listResearchObjects();
  if (!listed.ok) {
    return {
      ok: false,
      reason: listed.error ?? 'research objects unavailable',
      experimentId,
      event,
      from: RUN_LIFECYCLE_FLOOR,
      to: null,
      state: RUN_LIFECYCLE_FLOOR,
      created: false,
    };
  }
  const persistedRow = listed.objects.find(
    (o) => o.objectKind === 'experiment' && o.objectId === experimentId,
  );
  const registry = EXPERIMENT_REGISTRY.find((e) => e.id === experimentId);

  // Establish the definition (payload) used for persistence + receipt invariants.
  const definition: ResearchExperiment | undefined =
    registry ??
    (persistedRow ? (persistedRow.payload as unknown as ResearchExperiment) : undefined);
  if (!definition || definition.id !== experimentId) {
    return {
      ok: false,
      reason: `unknown experiment '${experimentId}'`,
      experimentId,
      event,
      from: RUN_LIFECYCLE_FLOOR,
      to: null,
      state: RUN_LIFECYCLE_FLOOR,
      created: false,
    };
  }
  const payload = (persistedRow?.payload ?? (definition as unknown as Record<string, unknown>)) as Record<
    string,
    unknown
  >;
  const governingInvariants = definition.governingInvariants ?? [];

  // Materialise the row at the registry floor when this experiment predates
  // C2.2 (no persisted row) — the creation is itself receipted, one path.
  let created = false;
  let current: ExperimentLifecycleState = persistedRow
    ? (persistedRow.lifecycleState as ExperimentLifecycleState)
    : RUN_LIFECYCLE_FLOOR;
  if (!persistedRow) {
    if (!evidence) {
      return {
        ok: false,
        reason: 'evidence required — a run event without evidence is an assertion',
        experimentId,
        event,
        from: current,
        to: null,
        state: current,
        created: false,
      };
    }
    await upsertResearchObject({
      objectKind: 'experiment',
      objectId: experimentId,
      payload,
      lifecycleState: RUN_LIFECYCLE_FLOOR,
    });
    const creation = await recordResearchObjectCreated({
      personaId: input.personaId,
      objectKind: 'experiment',
      objectId: experimentId,
      entryState: RUN_LIFECYCLE_FLOOR,
      summary: `auto-materialised for run — ${evidence.slice(0, 100)}`,
      governingInvariants,
    });
    if (creation.ok && creation.receiptId) {
      await upsertResearchObject({
        objectKind: 'experiment',
        objectId: experimentId,
        payload,
        lifecycleState: RUN_LIFECYCLE_FLOOR,
        receiptId: creation.receiptId,
      });
    }
    created = true;
    current = RUN_LIFECYCLE_FLOOR;
  }

  // Map the event to its single legal target; refuse honestly when there is none.
  const { to, reason } = nextRunState(event, current);
  if (!to) {
    return { ok: false, reason, experimentId, event, from: current, to: null, state: current, created };
  }
  if (!isLegalExperimentTransition(current, to)) {
    return {
      ok: false,
      reason: 'illegal-transition',
      experimentId,
      event,
      from: current,
      to,
      state: current,
      created,
    };
  }

  // Record the transition through the ONE receipt path, then persist the
  // advanced lifecycle state onto the durable row.
  const transition = await recordExperimentTransition({
    personaId: input.personaId,
    experimentId,
    from: current,
    to,
    evidence: evidence || `${experimentId} ${event}`,
    fallbackExperiment: definition,
  });
  if (!transition.ok) {
    return {
      ok: false,
      reason: transition.error ?? 'receipt write failed',
      experimentId,
      event,
      from: current,
      to,
      state: current,
      created,
    };
  }
  await upsertResearchObject({
    objectKind: 'experiment',
    objectId: experimentId,
    payload,
    lifecycleState: to,
    receiptId: transition.receiptId ?? null,
  });

  return {
    ok: true,
    experimentId,
    event,
    from: current,
    to,
    state: to,
    created,
    receiptId: transition.receiptId ?? null,
  };
}

/**
 * Overlay the persisted (receipted) experiment lifecycle state onto each
 * derived overview entry. Two honest mechanisms, never conflated: deriveOverview
 * computes the floor from the canonical record; this attaches the receipted
 * research-object state (what runs advance through the lifecycle) so surfaces
 * can show the institution's own record beside the derived floor. Returns the
 * entries unchanged (persistedLifecycle: null) when no persisted rows exist.
 */
export async function overviewWithPersistedLifecycle(): Promise<
  Array<ResearchOverviewEntry & { persistedLifecycle: ExperimentLifecycleState | null }>
> {
  const [derived, listed] = await Promise.all([deriveOverview(), listResearchObjects()]);
  const byId = new Map<string, ExperimentLifecycleState>();
  if (listed.ok) {
    for (const row of listed.objects) {
      if (row.objectKind !== 'experiment') continue;
      if ((EXPERIMENT_LIFECYCLE as readonly string[]).includes(row.lifecycleState)) {
        byId.set(row.objectId, row.lifecycleState as ExperimentLifecycleState);
      }
    }
  }
  const order = EXPERIMENT_LIFECYCLE as readonly string[];
  return derived.map((entry) => {
    const persisted = byId.get(entry.experiment.id) ?? null;
    // The displayed (receipted) state must NEVER fall below the derived floor:
    // the floor is a canonical FACT (published runs exist; ≥2 providers ⇒
    // replicated). A research_object stuck below its evidence — e.g. oscillated
    // back to `running` by a later run-started while `results-published` only
    // reaches `evaluated` — is clamped UP to the floor so every surface (this
    // dashboard, Publications, the report) reflects what the record proves.
    const clamped =
      persisted !== null && order.indexOf(persisted) < order.indexOf(entry.lifecycle)
        ? entry.lifecycle
        : persisted;
    return { ...entry, persistedLifecycle: clamped };
  });
}
