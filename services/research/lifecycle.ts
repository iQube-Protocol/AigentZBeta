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
 * Server-only.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { getInvariantsBySeedIds } from '@/services/invariants/store';
import {
  EXPERIMENT_REGISTRY,
  isLegalExperimentTransition,
  type ExperimentLifecycleState,
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

export async function recordExperimentTransition(input: {
  personaId: string;
  experimentId: string;
  from: ExperimentLifecycleState;
  to: ExperimentLifecycleState;
  evidence: string;
}): Promise<{ ok: boolean; error?: string; receiptId?: string | null }> {
  const experiment = EXPERIMENT_REGISTRY.find((e) => e.id === input.experimentId);
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

  const invariantRows = await getInvariantsBySeedIds(experiment.governingInvariants).catch(() => []);
  const receipt = await createActivityReceipt({
    personaId: input.personaId,
    activeCartridge: 'ccrl',
    actionType: 'research_lifecycle_transition',
    summary: `${experiment.id} ${input.from} → ${input.to} — ${input.evidence.slice(0, 140)}`,
    contextShared: ['ccrl-research'],
    ...(invariantRows.length > 0 ? { invariantsUsed: invariantRows.map((r) => r.id) } : {}),
  }).catch(() => null);

  return { ok: Boolean(receipt), receiptId: receipt?.id ?? null, ...(receipt ? {} : { error: 'receipt write failed' }) };
}
