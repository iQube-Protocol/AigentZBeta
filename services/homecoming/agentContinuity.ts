/**
 * agentContinuity — the continuity ASSESSMENT substrate (SPEC-HMC-001 Phase 1).
 *
 * Given a Homecoming delegate, answer one question honestly: which of the five
 * continuity dimensions (types/homecoming.ts `AGENT_CONTINUITY_DIMENSIONS`) are
 * currently satisfiable from REAL platform state, and which are not — and where
 * a dimension has no platform state to assess against at all, say exactly that
 * rather than manufacture a score.
 *
 * Three disciplines, all inherited (not invented) from the shipped substrate:
 *
 *  1. READ-ONLY. This module performs no write of any kind — no insert, update,
 *     upsert, delete, receipt, grant, or agreement call. A continuity assessment
 *     is an observation; it never advances a migration.
 *
 *  2. NO AUTO-AUTHORIZATION, structurally. SPEC-HMC-001 §9.2 component 6 and
 *     CFS-043's Principal–Delegate Separation: the delegate's bounded authority
 *     is re-granted by the HUMAN principal on the new host, freshly, every time.
 *     So this module never imports the Constitutional Agreement primitive or the
 *     guided-onboarding module, never touches their form/accept/authorize verbs,
 *     and the lifecycle stage it resolves is HARD-CAPPED at
 *     `ASSESSABLE_STAGE_CEILING` (stage 4). Reporting stage 5 reached would be
 *     asserting a human act that did not happen. The canary in
 *     tests/homecoming.test.ts greps this file's RAW source for those identifiers
 *     — deliberately including comments, so even naming them here would fail the
 *     build. That strictness is the point: there is no "just documenting it".
 *
 *  3. SOFT-FAIL + HONEST, exactly like constitutionalPresence.ts: every read is
 *     independent and best-effort; a failed read degrades ONE dimension to
 *     `pending` ("could not determine"), never fakes it satisfiable, never throws.
 *
 * Composition, never duplication: Constitutional Presence comes from the existing
 * scorer (`assessDelegate`), standing from the existing Standing loop
 * (`delegateStanding.ts`), artefacts from the existing Artifact Runtime store
 * (`listArtifactRecords`), constitutionalized knowledge from the existing
 * `homecoming` KB domain + `invariants` substrate. Nothing here re-derives any of
 * those; there is no parallel continuity table and no new store.
 *
 * The ASSEMBLY is pure and canary-tested; only the table reads are impure.
 */

import { getKnowledgeBaseService } from '@/services/content/knowledgeBaseService';
import { listInvariants } from '@/services/invariants/store';
import { listArtifactRecords } from '@/services/artifact/artifactRecordStore';
import { assessDelegate } from '@/services/homecoming/constitutionalPresence';
import { resolveDelegateAgentId, readDelegateStanding } from '@/services/homecoming/delegateStanding';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  AGENT_CONTINUITY_DIMENSIONS,
  ASSESSABLE_STAGE_CEILING,
  CONTINUITY_DIMENSION_SPEC,
  MIGRATION_LIFECYCLE_STAGES,
  MIGRATION_STAGE_SIGNAL,
  migrationStageIndex,
  resolveMigrationStage,
  type AgentContinuityDimension,
  type HomecomingDelegateId,
  type MigrationLifecycleStage,
  type PresenceLevel,
} from '@/types/homecoming';

/**
 * The seed-id namespace `services/homecoming/constitutionalize.ts` stamps on every
 * principle it proposes out of imported operator memory (`candidateSeedId`).
 * Derived here as a prefix constant rather than re-spelling the literal in a
 * query — parity is canary-pinned so a rename cannot silently orphan this read.
 */
export const HOMECOMING_SEED_PREFIX = 'hc:';

/**
 * A dimension outcome.
 *   `satisfiable`    — real platform state supports this dimension for this delegate
 *   `unsatisfied`    — the state was read successfully and is genuinely absent
 *   `not-assessable` — NO platform state exists to assess against (a real gap, stated)
 *   `pending`        — a read failed; could not determine (never assumed either way)
 */
export type ContinuityStatus = 'satisfiable' | 'unsatisfied' | 'not-assessable' | 'pending';

export interface ContinuityDimensionAssessment {
  dimension: AgentContinuityDimension;
  status: ContinuityStatus;
  /** The lifecycle stage that owns this dimension (SPEC-HMC-001 §10). */
  stage: MigrationLifecycleStage;
  /** Which §9.2 Reconstitution component(s) this dimension realises. */
  reconstitutionComponents: readonly number[];
  /**
   * Whether the observed evidence is attributable to THIS delegate, or only to
   * the shared corpus. `corpus` is not a weaker score — it is a narrower claim,
   * and conflating the two would be the dishonesty this module exists to avoid.
   */
  scope: 'delegate' | 'corpus' | 'none';
  /** What was actually observed. Never a claim beyond the read. */
  evidence: string;
  /** Present iff `not-assessable` — the concrete reason, never hand-waved. */
  gap?: string;
  /** True when the dimension additionally turns on a human act no read can supply. */
  requiresHumanAct: boolean;
}

export interface AgentContinuityAssessment {
  delegate: HomecomingDelegateId;
  /** Straight from the existing scorer — never re-derived here. */
  presenceLevel: PresenceLevel | null;
  presenceIndex: number;
  dimensions: ContinuityDimensionAssessment[];
  /** Highest CONTIGUOUS lifecycle stage the OBSERVED state supports. Capped. */
  lifecycleStage: MigrationLifecycleStage | null;
  lifecycleStageIndex: number;
  /** The ceiling above — restated on every response so no consumer infers more. */
  assessableStageCeiling: MigrationLifecycleStage;
  /** The stages this assessment can never resolve, and why. */
  humanActStages: Array<{ stage: MigrationLifecycleStage; proof: string }>;
  summary: {
    total: number;
    satisfiable: number;
    unsatisfied: number;
    notAssessable: number;
    pending: number;
  };
}

// ─── Pure assembly (deterministic — canary-tested) ───────────────────────────

/** What the impure reads produce. `ok:false` on any read ⇒ that dimension pends. */
export interface ContinuityObservations {
  /** From `assessDelegate` — the contiguous presence index (-1 when below L0). */
  presenceIndex: number;
  /** `homecoming` KB domain corpus stats (shared, not delegate-scoped). */
  kb: { ok: boolean; documentCount: number };
  /** Principles constitutionalized out of imported memory (`hc:` seed ids). */
  invariants: { ok: boolean; proposed: number; ratified: number };
  /** artifact_records attributed to this delegate slug. */
  artefacts: { ok: boolean; total: number; receiptAnchored: number };
  /** The Standing loop's view of this delegate. */
  standing: {
    ok: boolean;
    rootSeeded: boolean;
    overall: number | null;
    trustBandCeiling: string | null;
    reason?: string;
  };
}

/**
 * The two dimensions with NO platform state to assess against today, and the
 * concrete schema reason for each. Stated as data so the honest gap travels with
 * the contract instead of living in prose someone can forget to update.
 *
 * Root cause for both: `journey_states` is keyed on `persona_id` — a row in
 * `personas`, i.e. a HUMAN persona. A delegate's identity lives in
 * `agent_root_identity`/`agent_persona`, which are not journey subjects. So a
 * delegate has no current-intent / in-flight-commitment record anywhere. The
 * human principal's own journey row EXISTS but is the principal's context, not
 * the delegate's — reporting it here would attribute the human's working state
 * to the agent, which is precisely the kind of invented completeness
 * SPEC-HMC-001 §11 and CLAUDE.md's no-guessing doctrine forbid.
 */
export const NOT_ASSESSABLE_TODAY: Partial<Record<AgentContinuityDimension, string>> = {
  'working-context':
    "no delegate-scoped working-context store exists: `journey_states` is keyed on `persona_id` (a human persona in `personas`), and `agent_persona` rows are not journey subjects — a delegate's current intent and in-flight commitments have no platform representation to read. The human principal's journey row is the PRINCIPAL's context, not the delegate's, and is deliberately not substituted here.",
  project:
    'same root gap as working-context, one scope narrower: `journey_states` is keyed on a human `persona_id`, so with no delegate-scoped working-context store there is also no venture/intent scoping key for a delegate — project-scoped continuity has nothing to assess against.',
};

function dimensionBase(dimension: AgentContinuityDimension) {
  const spec = CONTINUITY_DIMENSION_SPEC[dimension];
  return {
    dimension,
    stage: spec.stage,
    reconstitutionComponents: spec.reconstitutionComponents,
    requiresHumanAct: MIGRATION_STAGE_SIGNAL[spec.stage].humanAct,
  };
}

/**
 * Assemble the five dimension assessments + the contiguous lifecycle stage from
 * observations. Pure and total: every dimension always appears, in ladder order.
 */
export function assembleContinuity(obs: ContinuityObservations): {
  dimensions: ContinuityDimensionAssessment[];
  lifecycleStage: MigrationLifecycleStage | null;
  lifecycleStageIndex: number;
  summary: AgentContinuityAssessment['summary'];
} {
  const dimensions: ContinuityDimensionAssessment[] = AGENT_CONTINUITY_DIMENSIONS.map((dimension) => {
    const base = dimensionBase(dimension);

    // ── behavioural — the reasoning substrate (Personal + Domain Invariants).
    // Corpus-scoped by construction: neither `codex_kb_documents` (domain
    // `homecoming`) nor `invariants` carries a delegate binding, so the strongest
    // honest claim is about the shared substrate, never "this delegate's memory".
    if (dimension === 'behavioural') {
      if (!obs.kb.ok || !obs.invariants.ok) {
        return { ...base, status: 'pending' as const, scope: 'corpus' as const, evidence: 'could not read the `homecoming` KB domain and/or the invariants substrate — undetermined, not assumed' };
      }
      const { documentCount } = obs.kb;
      const { proposed, ratified } = obs.invariants;
      if (documentCount === 0) {
        return { ...base, status: 'unsatisfied' as const, scope: 'corpus' as const, evidence: 'no constitutionalized source material observed in the `homecoming` KB domain — stage 1/2 not reached for any host' };
      }
      if (ratified === 0) {
        return {
          ...base,
          status: 'unsatisfied' as const,
          scope: 'corpus' as const,
          evidence: `${documentCount} constitutionalized document(s), ${proposed} principle(s) proposed, 0 ratified — stage 3 (principal-ratified) not reached. Per SPEC-HMC-001 §3 this is an IMPORT, not continuity; only the human principal can advance it (Law XI).`,
        };
      }
      return {
        ...base,
        status: 'satisfiable' as const,
        scope: 'corpus' as const,
        evidence: `${documentCount} constitutionalized document(s) in the \`homecoming\` KB domain; ${ratified} of ${proposed + ratified} extracted principle(s) ratified by the human principal. Corpus-scoped: no delegate attribution exists on either store.`,
      };
    }

    // ── working-context / project — no platform state exists. Stated, not scored.
    const gap = NOT_ASSESSABLE_TODAY[dimension];
    if (gap) {
      return { ...base, status: 'not-assessable' as const, scope: 'none' as const, evidence: 'not assessable from platform state today', gap };
    }

    // ── artefact — provenance stays bound to the SAME delegate identity.
    if (dimension === 'artefact') {
      if (!obs.artefacts.ok) {
        return { ...base, status: 'pending' as const, scope: 'delegate' as const, evidence: 'could not read artifact_records — undetermined' };
      }
      if (obs.artefacts.total === 0) {
        return { ...base, status: 'unsatisfied' as const, scope: 'delegate' as const, evidence: 'no artifact_records attributed to this delegate observed (the store soft-fails to empty, so this is "none observed", not a proof that none exist)' };
      }
      return {
        ...base,
        status: 'satisfiable' as const,
        scope: 'delegate' as const,
        evidence: `${obs.artefacts.total} artifact_record(s) attributed to this delegate, ${obs.artefacts.receiptAnchored} receipt-anchored — attribution survives a host change because it is keyed on the delegate identity, not the host.`,
      };
    }

    // ── relationship — earned standing carries forward; authority does NOT.
    // §9.2 splits this: component 3 (standing) is assessable and IS carried
    // forward; component 6 (authority) is deliberately never carried forward —
    // it is freshly re-granted by the human every time. The prior active grant
    // the presence scorer reads is NOT that fresh re-authorization, so it is
    // never counted here as satisfying this dimension.
    if (!obs.standing.ok) {
      return { ...base, status: 'pending' as const, scope: 'delegate' as const, evidence: 'could not read delegate standing — undetermined' };
    }
    if (!obs.standing.rootSeeded) {
      return { ...base, status: 'unsatisfied' as const, scope: 'delegate' as const, evidence: 'no seeded RootDID for this delegate — there is no standing to carry forward yet; stand the delegate up first' };
    }
    if (obs.standing.overall === null) {
      return {
        ...base,
        status: 'unsatisfied' as const,
        scope: 'delegate' as const,
        evidence: `RootDID seeded but no standing readable${obs.standing.reason ? ` — ${obs.standing.reason}` : ' (the delegate has no CRM persona yet, so accrual is skipped, never faked)'}. Re-authorization (component 6) remains a human act regardless.`,
      };
    }
    return {
      ...base,
      status: 'satisfiable' as const,
      scope: 'delegate' as const,
      evidence: `earned standing ${obs.standing.overall} (trust-band ceiling ${obs.standing.trustBandCeiling ?? 'unknown'}) carries forward across a host change. Component 6 (bounded authority) is NOT carried forward by design — the human principal re-authorizes freshly on the destination host.`,
    };
  });

  // ── Contiguous lifecycle stage, HARD-CAPPED at ASSESSABLE_STAGE_CEILING.
  // Stages 5–6 are passed as unsatisfied unconditionally: they turn on a human
  // act this read cannot observe, and asserting them would be the backdoor
  // around human re-authorization that SPEC-HMC-001 §9.2 component 6 forbids.
  const satisfiedStages: Partial<Record<MigrationLifecycleStage, boolean>> = {
    'origin-observed': obs.kb.ok && obs.kb.documentCount > 0,
    constitutionalized: obs.invariants.ok && obs.invariants.proposed + obs.invariants.ratified > 0,
    'principal-ratified': obs.invariants.ok && obs.invariants.ratified > 0,
    // L2 (reasoning-connected) is the rung that proves the delegate genuinely
    // routes through sovereign inference on THIS host — the honest floor for
    // calling presence reconstituted here.
    'presence-reconstituted': obs.presenceIndex >= 2,
    'delegation-reauthorized': false,
    native: false,
  };
  let lifecycleStage = resolveMigrationStage(satisfiedStages);
  const ceiling = migrationStageIndex(ASSESSABLE_STAGE_CEILING);
  if (lifecycleStage && migrationStageIndex(lifecycleStage) > ceiling) {
    lifecycleStage = ASSESSABLE_STAGE_CEILING; // belt-and-braces; the flags above already prevent this
  }

  const count = (s: ContinuityStatus) => dimensions.filter((d) => d.status === s).length;
  return {
    dimensions,
    lifecycleStage,
    lifecycleStageIndex: lifecycleStage ? migrationStageIndex(lifecycleStage) : -1,
    summary: {
      total: dimensions.length,
      satisfiable: count('satisfiable'),
      unsatisfied: count('unsatisfied'),
      notAssessable: count('not-assessable'),
      pending: count('pending'),
    },
  };
}

// ─── Impure reads (best-effort; each degrades to ok:false) ───────────────────

async function readKb(): Promise<ContinuityObservations['kb']> {
  try {
    const stats = await getKnowledgeBaseService().getStats('homecoming');
    return { ok: true, documentCount: Number(stats.documentCount ?? 0) };
  } catch {
    return { ok: false, documentCount: 0 };
  }
}

/**
 * Count the principles constitutionalize.ts proposed out of imported memory,
 * split by whether the human principal has ratified them.
 *
 * `draft`/`proposed` are the un-ratified statuses — Law XI: an agent may only
 * put a principle FORWARD. Only `validated`/`canonical` required a human
 * decision, so only those count as ratified. `rejected` is counted as NEITHER:
 * the human ruled on it and ruled it out, so it is neither pending ratification
 * nor evidence of preserved substrate.
 */
async function readHomecomingInvariants(): Promise<ContinuityObservations['invariants']> {
  try {
    const rows = await listInvariants({ status: ['draft', 'proposed', 'validated', 'canonical'], limit: 500 });
    const hc = rows.filter((r) => typeof r.seedId === 'string' && r.seedId.startsWith(HOMECOMING_SEED_PREFIX));
    const ratified = hc.filter((r) => r.status === 'validated' || r.status === 'canonical').length;
    return { ok: true, proposed: hc.length - ratified, ratified };
  } catch {
    return { ok: false, proposed: 0, ratified: 0 };
  }
}

async function readArtefacts(delegate: HomecomingDelegateId): Promise<ContinuityObservations['artefacts']> {
  try {
    const records = await listArtifactRecords({ delegate, limit: 200 });
    return { ok: true, total: records.length, receiptAnchored: records.filter((r) => !!r.receipt_id).length };
  } catch {
    return { ok: false, total: 0, receiptAnchored: 0 };
  }
}

async function readStanding(delegate: HomecomingDelegateId): Promise<ContinuityObservations['standing']> {
  try {
    const agentId = await resolveDelegateAgentId(delegate);
    if (!agentId) return { ok: true, rootSeeded: false, overall: null, trustBandCeiling: null };
    const standing = await readDelegateStanding(agentId);
    if (!standing) {
      return {
        ok: true,
        rootSeeded: true,
        overall: null,
        trustBandCeiling: null,
        reason: 'the delegate has no CRM persona / reputation row yet — standing accrues once it does (never faked)',
      };
    }
    return { ok: true, rootSeeded: true, overall: standing.overall, trustBandCeiling: standing.trustBandCeiling };
  } catch {
    return { ok: false, rootSeeded: false, overall: null, trustBandCeiling: null };
  }
}

/**
 * Assess one delegate's continuity. READ-ONLY: nothing here writes, grants,
 * authorizes, or advances a migration. Every read is independent and best-effort.
 */
export async function assessAgentContinuity(
  delegate: HomecomingDelegateId,
): Promise<AgentContinuityAssessment> {
  const presence = await assessDelegate(getSupabaseServer(), delegate).catch(() => null);

  const [kb, invariants, artefacts, standing] = await Promise.all([
    readKb(),
    readHomecomingInvariants(),
    readArtefacts(delegate),
    readStanding(delegate),
  ]);

  const assembled = assembleContinuity({
    presenceIndex: presence?.presenceIndex ?? -1,
    kb,
    invariants,
    artefacts,
    standing,
  });

  return {
    delegate,
    presenceLevel: presence?.presenceLevel ?? null,
    presenceIndex: presence?.presenceIndex ?? -1,
    ...assembled,
    assessableStageCeiling: ASSESSABLE_STAGE_CEILING,
    humanActStages: MIGRATION_LIFECYCLE_STAGES.filter((s) => MIGRATION_STAGE_SIGNAL[s].humanAct).map((stage) => ({
      stage,
      proof: MIGRATION_STAGE_SIGNAL[stage].proof,
    })),
  };
}
