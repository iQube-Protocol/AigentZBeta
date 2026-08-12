/**
 * STAGE TRUTH vs STAGE EVIDENCE, and the monotonic Journey.
 *
 * ── THE OPERATOR'S RULING (2026-08-03), verbatim ──────────────────────────
 *
 *   > "Once a stage's canonical outcome has been established, later stages
 *   >  consume that outcome. They do not re-run, reinterpret or invalidate the
 *   >  earlier ceremony because an incidental receipt, migration or observer
 *   >  path is incomplete."
 *
 * ── THE DEFECT THIS CLOSES ────────────────────────────────────────────────
 *
 * `resolveJourneyState` has exactly one notion of a stage: every field of
 * `completionEvidence` present ⇒ COMPLETE, otherwise not. That collapses two
 * genuinely different facts into one boolean:
 *
 *   STAGE TRUTH      did the ceremony happen? (Nakamoto IS registered:
 *                    tokenId 8798, confirmed tx, persisted binding, settled.)
 *   STAGE EVIDENCE   how much of the expected receipt trail can we SEE?
 *
 * Nakamoto's Register stage was the proof. The registration succeeded
 * completely; several of the ten `completionEvidence` receipts predate the
 * Wallet Signing Topology ruling that introduced them, so they do not exist
 * and never will for that registration. Under a single boolean, an
 * unrecoverable historical receipt gap renders as "not registered" — the
 * ceremony re-litigated because its paperwork is thin.
 *
 * So a stage may legitimately be:
 *
 *   { status: 'COMPLETE', canonicalOutcome: true,
 *     evidenceCompleteness: 'partial', auditGaps: [...] }
 *
 * and the one thing this module forbids is collapsing "evidence incomplete"
 * into "outcome absent".
 *
 * ── MONOTONICITY ──────────────────────────────────────────────────────────
 *
 *   REGISTERED → VERIFIED | VERIFIED_WITH_EXCEPTION → CLAIMED
 *              → PASSPORT_ISSUED → DELEGATED
 *
 * A later-stage failure cannot erase an earlier-stage canonical success.
 * Later state may ADD exceptions; it may never silently revert earlier state.
 * Enforced in three independent places so no single caller mistake can undo
 * it: the ratchet below unions rather than replaces, the persistence helper
 * unions rather than replaces, and only `settledFacts`' five listed
 * invalidation events can ever subtract.
 *
 * ── WHAT THIS IS NOT ──────────────────────────────────────────────────────
 *
 * It is NOT a second journey resolver. `resolveJourneyState` remains the ONE
 * place that knows about prerequisites, BLOCKED, and stage ordering
 * (inv.engineering.036/037) — this module calls it TWICE with two different
 * evidence views and reads the difference, rather than forking its logic. A
 * forked prerequisite chain is precisely how five observers of one fact came
 * to give five answers (RES-2026-08-03-HORIZEN-OBSERVER-RECONCILIATION-001).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  JourneyDefinition,
  JourneyMilestone,
  JourneyRuntimeState,
  JourneyStageState,
} from '@/types/journey';
import { resolveJourneyState, type AuthoritativePlatformState, type StageEvidenceRecord } from './resolveJourneyState';
import type { ExceptionRecord, ExecutableAct, ExecutableActKind } from '@/services/research/exceptionIsolation';

// ── The act every blocker terminates in ─────────────────────────────────────

/**
 * The one next thing the operator can DO, bound to where they do it.
 *
 * `stageId` is what makes this executable rather than descriptive: an act
 * that cannot say which stage performs it is a diagnosis wearing a button.
 */
export interface JourneyAct extends ExecutableAct {
  /** The stage this act is performed on. Never absent. */
  stageId: string;
}

/**
 * A genuine prerequisite failure — something that must be resolved before the
 * act may proceed.
 *
 *   > "Every blocker terminates in an act. Not 'partner_authorization_requests
 *   >  table missing' but 'Local authorization store unavailable
 *   >  [Apply migration] [Refresh schema] [Re-check]'."
 *
 * `acts` is a non-empty tuple, so a blocker with nothing to do about it does
 * not compile. `summary` states what is TRUE, never what is broken — the
 * difference between "Awaiting Horizen registration" (false, and useless) and
 * "Registration complete — token 8798 · 2 historical receipt gaps remain".
 */
export type NonEmptyJourneyActs = readonly [JourneyAct, ...JourneyAct[]];

export interface BlockingReason {
  code: string;
  stageId: string;
  summary: string;
  acts: NonEmptyJourneyActs;
}

/** Build a `JourneyAct` — a small helper so every call site produces the same
 *  shape and no surface invents a fifth field. */
export function journeyAct(
  stageId: string,
  actId: string,
  kind: ExecutableActKind,
  label: string,
  detail?: string,
): JourneyAct {
  return { stageId, actId, kind, label, target: stageId, detail };
}

// ── Stage truth, stage evidence ─────────────────────────────────────────────

/**
 * How much of the expected receipt trail is visible. Deliberately THREE
 * values, not a boolean: 'partial' is the state the whole ruling turns on,
 * and a boolean cannot hold it.
 */
export type EvidenceCompleteness = 'complete' | 'partial' | 'absent';

/** Where a stage's canonical outcome came from. Named so a reader can tell a
 *  settled fact from an inference, which is the distinction that decides
 *  whether a downstream observer may re-derive. */
export type CanonicalAuthority = 'settled-fact' | 'prior-resolution' | 'evidence' | 'none';

export interface StageResolution {
  stageId: string;
  /** What the stepper renders. */
  status: JourneyStageState;
  /** THE STAGE TRUTH — did the ceremony happen? Never inferred from evidence
   *  completeness, and never lowered by a later stage's failure. */
  canonicalOutcome: boolean;
  canonicalAuthority: CanonicalAuthority;
  /** THE STAGE EVIDENCE — separate axis, reported honestly even when the
   *  outcome is canonically true. */
  evidenceCompleteness: EvidenceCompleteness;
  evidencePresent: string[];
  evidenceMissing: string[];
  /**
   * Evidence expected and not found. Audit material — NEVER folded into
   * `canonicalOutcome`. An observer's inability to find evidence has never
   * been evidence that a settled fact stopped being true.
   */
  auditGaps: string[];
  /** Genuine prerequisite failures for THIS stage's act. */
  operationalBlockers: BlockingReason[];
  /** Real, disclosed, and blocking nothing. A warning is not a refusal. */
  nonBlockingExceptions: ExceptionRecord[];
  receiptRefs: string[];
  milestone: JourneyMilestone | null;
}

// ── The milestone ladder ────────────────────────────────────────────────────

/**
 * Rank, not order. `VERIFIED` and `VERIFIED_WITH_EXCEPTION` share rank 1
 * because they are the SAME rung reached two ways — the operator wrote
 * "VERIFIED or VERIFIED_WITH_EXCEPTION", not "VERIFIED then
 * VERIFIED_WITH_EXCEPTION". Giving the exception form a lower rank would make
 * an agent verified-with-a-disclosed-exception permanently behind one whose
 * partner tooling happened to be fully deployed, which is the same defect as
 * blocking Passport on Pulse, expressed as arithmetic.
 */
const MILESTONE_RANK: Record<JourneyMilestone, number> = {
  REGISTERED: 0,
  VERIFIED: 1,
  VERIFIED_WITH_EXCEPTION: 1,
  CLAIMED: 2,
  PASSPORT_ISSUED: 3,
  DELEGATED: 4,
};

export const JOURNEY_MILESTONES: readonly JourneyMilestone[] = [
  'REGISTERED',
  'VERIFIED',
  'VERIFIED_WITH_EXCEPTION',
  'CLAIMED',
  'PASSPORT_ISSUED',
  'DELEGATED',
];

export function milestoneRank(milestone: JourneyMilestone): number {
  return MILESTONE_RANK[milestone];
}

/**
 * THE RATCHET. The union of what was reached before and what is observed now
 * — never the intersection, never a replacement.
 *
 * This function is why a Verify failure cannot un-Register an agent: there is
 * no code path here that removes a milestone. Reopening a milestone requires
 * invalidating its underlying settled fact through one of the five listed
 * `InvalidationEvent`s, which is a deliberate governed act with an authority
 * attached — not something a failed read can do by accident.
 */
export function advanceMilestones(
  prior: readonly JourneyMilestone[],
  observed: readonly JourneyMilestone[],
): JourneyMilestone[] {
  const union = new Set<JourneyMilestone>([...prior, ...observed]);
  return JOURNEY_MILESTONES.filter((m) => union.has(m));
}

export function highestMilestone(milestones: readonly JourneyMilestone[]): JourneyMilestone | null {
  let best: JourneyMilestone | null = null;
  for (const m of milestones) {
    if (best === null || milestoneRank(m) > milestoneRank(best)) best = m;
  }
  return best;
}

// ── The resolver ────────────────────────────────────────────────────────────

export interface MonotonicResolutionInput {
  /**
   * Canonical outcome per stage, from a SETTLED FACT — the authority, not a
   * hint. A stage absent from this record has no canonical ruling and falls
   * back to its evidence, which is the honest answer for a stage whose
   * ceremony genuinely has not been performed.
   */
  canonicalOutcomes?: Record<string, boolean | undefined>;
  /** Stage ids already canonically established in a previous resolution —
   *  the ratchet's floor. */
  priorCanonicalStages?: readonly string[];
  priorMilestones?: readonly JourneyMilestone[];
  /**
   * Stage ids whose canonical outcome has been INVALIDATED — by one of
   * `settledFacts`' five listed events, or by a governed correction's
   * persisted `StageInvalidationRecord` tombstone (POSIT state model,
   * operator ruling 2026-08-10). The ONLY subtraction this module permits,
   * and it is never inferred — a caller must name it.
   *
   * PERMANENT for the ratchet shortcut, never for the stage itself: a listed
   * stage id is excluded from `priorCanonicalStages` this pass (so it gets no
   * synthesized `prior-resolution` evidence), but it is NOT excluded from
   * `status === 'COMPLETE'` via genuine live evidence below — that is what
   * lets "old assertion → governed invalidation → unresolved → new valid
   * evidence → established again" hold without the caller doing anything
   * beyond continuing to pass the same tombstoned id on every future read.
   */
  invalidatedStages?: readonly string[];
  /**
   * Stages that are INCOMPLETE, and whose incompleteness must not gate any
   * later stage.
   *
   * ── Why this is not a loophole ────────────────────────────────────────────
   *
   * Verify is a real prerequisite of Claim in the journey definition, and it
   * stays one. What this expresses is narrower and is the ratified exception-
   * isolation ruling applied to journey stages: *an exception blocks only the
   * act to which it applies.* When Verify cannot complete because
   * `partner_authorization_requests` is missing from THIS deployment, the
   * thing that is incomplete is a local migration — not the agent's standing.
   * Letting it cascade would mean an unapplied migration had revoked a
   * constitutional relationship, which is the "global stoppage for a local
   * anomaly" the ruling exists to forbid.
   *
   * A stage listed here does NOT become complete: its own
   * `canonicalOutcome` stays false, its blockers stay visible, and it stays
   * the next executable act. Only its power to freeze its dependents is
   * removed. That asymmetry is deliberate — it is the difference between
   * "this still needs doing" and "nothing else may happen until it is done".
   */
  nonBlockingIncompleteStages?: readonly string[];
  auditGaps?: Record<string, string[]>;
  operationalBlockers?: Record<string, BlockingReason[]>;
  nonBlockingExceptions?: Record<string, ExceptionRecord[]>;
}

export interface MonotonicJourneyResolution {
  journeyId: string;
  journeyVersion: string;
  subjectRef: string;
  stages: StageResolution[];
  milestones: JourneyMilestone[];
  highestMilestone: JourneyMilestone | null;
  /** THE ONE NEXT ACT. Never navigation, never "go somewhere else". */
  nextExecutableAct: JourneyAct | null;
  currentStageId: string;
  complete: boolean;
  /** The base resolver's own output, unmodified — kept so every existing
   *  consumer of `JourneyRuntimeState` keeps working unchanged. */
  runtimeState: JourneyRuntimeState;
}

function completenessOf(present: string[], missing: string[]): EvidenceCompleteness {
  if (missing.length === 0) return 'complete';
  if (present.length === 0) return 'absent';
  return 'partial';
}

/**
 * All of a stage's evidence fields asserted true — the injection that lets the
 * SHARED resolver honour a canonical outcome without this module reimplementing
 * prerequisite chaining, BLOCKED, or stage ordering.
 */
function canonicalisedEvidence(fields: readonly string[]): StageEvidenceRecord {
  const record: StageEvidenceRecord = {};
  for (const field of fields) record[field] = true;
  return record;
}

export function resolveMonotonicJourneyState(
  journey: JourneyDefinition,
  platformState: AuthoritativePlatformState,
  input: MonotonicResolutionInput = {},
): MonotonicJourneyResolution {
  // ── Which stages are canonically true? Ratchet first, invalidation last. ──
  const canonical = new Set<string>(input.priorCanonicalStages ?? []);
  const authority = new Map<string, CanonicalAuthority>();
  for (const id of canonical) authority.set(id, 'prior-resolution');
  for (const [stageId, value] of Object.entries(input.canonicalOutcomes ?? {})) {
    if (value) {
      canonical.add(stageId);
      authority.set(stageId, 'settled-fact');
    }
  }
  for (const stageId of input.invalidatedStages ?? []) {
    canonical.delete(stageId);
    authority.delete(stageId);
  }

  // ── PASS 1: what the evidence alone says. Never used for status. ─────────
  const evidencePass = resolveJourneyState(journey, platformState);

  // ── PASS 2: the same resolver, with canonical outcomes injected. ─────────
  const canonicalisedStages: Record<string, StageEvidenceRecord | undefined> = { ...platformState.stages };
  for (const stage of journey.stages) {
    if (canonical.has(stage.id)) canonicalisedStages[stage.id] = canonicalisedEvidence(stage.completionEvidence);
  }
  const truthPass = resolveJourneyState(journey, { ...platformState, stages: canonicalisedStages });

  /*
   * ── PASS 3: the GATING pass. ─────────────────────────────────────────────
   *
   * The same resolver again, with the non-blocking-incomplete stages also
   * satisfied — which answers a different question: "which stages would be
   * BLOCKED if this local anomaly did not exist?" Taking only the BLOCKED
   * answer from it, and only for stages that are not themselves the anomaly,
   * lets an isolated exception stop being contagious without anything
   * pretending it was resolved. Prerequisite chaining is still computed in
   * exactly one place; this asks that one place a second question.
   */
  const nonBlocking = new Set(input.nonBlockingIncompleteStages ?? []);
  const gatingStages: Record<string, StageEvidenceRecord | undefined> = { ...canonicalisedStages };
  for (const stage of journey.stages) {
    if (nonBlocking.has(stage.id)) gatingStages[stage.id] = canonicalisedEvidence(stage.completionEvidence);
  }
  const gatingPass = nonBlocking.size > 0
    ? resolveJourneyState(journey, { ...platformState, stages: gatingStages })
    : truthPass;

  const observedMilestones: JourneyMilestone[] = [];
  const stages: StageResolution[] = journey.stages.map((stage) => {
    const evidence = evidencePass.stages.find((s) => s.stageId === stage.id);
    const truth = truthPass.stages.find((s) => s.stageId === stage.id);
    const present = evidence?.evidencePresent ?? [];
    const missing = evidence?.evidenceMissing ?? [];
    /*
     * A stage is BLOCKED only if it is still blocked once isolated anomalies
     * are set aside. The anomaly's OWN stage never takes this relief — it is
     * the thing that needs doing, and it must keep saying so.
     */
    const gated = gatingPass.stages.find((s) => s.stageId === stage.id);
    const status: JourneyStageState =
      truth?.state === 'BLOCKED' && !nonBlocking.has(stage.id) && gated && gated.state !== 'BLOCKED'
        ? gated.state
        : (truth?.state ?? 'NOT_STARTED');
    const canonicalOutcome = canonical.has(stage.id) || status === 'COMPLETE';
    const canonicalAuthority: CanonicalAuthority = canonical.has(stage.id)
      ? (authority.get(stage.id) ?? 'settled-fact')
      : status === 'COMPLETE'
        ? 'evidence'
        : 'none';

    const auditGaps = [...(input.auditGaps?.[stage.id] ?? [])];
    /*
     * A canonically-true stage with missing receipts records an AUDIT GAP —
     * the one place the two axes meet, and they meet as disclosure, never as
     * demotion. This is the sentence that makes Nakamoto's Register stage
     * render "Registration complete — 2 historical receipt gaps remain"
     * rather than "not registered".
     */
    if (canonicalOutcome && missing.length > 0) {
      auditGaps.push(
        `${missing.length} of ${stage.completionEvidence.length} expected receipts for this stage are not recorded: ` +
          `${missing.join(', ')}. The ceremony's canonical outcome is established independently of them.`,
      );
    }

    if (canonicalOutcome && stage.milestone) {
      const exceptions = input.nonBlockingExceptions?.[stage.id] ?? [];
      /*
       * A stage completed while carrying a disclosed exception reaches its
       * milestone in the EXCEPTION form where the ladder defines one — the
       * same rung, honestly labelled. `VERIFIED_WITH_EXCEPTION` exists so the
       * record says how it was reached without costing the agent progress.
       */
      const withException =
        stage.milestone === 'VERIFIED' && (exceptions.length > 0 || auditGaps.length > 0)
          ? 'VERIFIED_WITH_EXCEPTION'
          : stage.milestone;
      observedMilestones.push(withException as JourneyMilestone);
    }

    return {
      stageId: stage.id,
      status,
      canonicalOutcome,
      canonicalAuthority,
      evidenceCompleteness: completenessOf(present, missing),
      evidencePresent: present,
      evidenceMissing: missing,
      auditGaps,
      operationalBlockers: input.operationalBlockers?.[stage.id] ?? [],
      nonBlockingExceptions: input.nonBlockingExceptions?.[stage.id] ?? [],
      receiptRefs: truth?.receiptRefs ?? [],
      milestone: stage.milestone ?? null,
    };
  });

  const milestones = advanceMilestones(input.priorMilestones ?? [], observedMilestones);
  const nextExecutableAct = resolveNextExecutableAct(journey, stages);

  /*
   * `complete` is read off the stage TRUTHS, not off either pass. The gating
   * pass would call the journey complete while a non-blocking anomaly is
   * still outstanding — relief from gating is not the same as being done, and
   * conflating them would let an unapplied migration graduate the journey.
   */
  const complete = stages.length > 0 && stages.every((s) => s.canonicalOutcome);

  return {
    journeyId: journey.id,
    journeyVersion: journey.version,
    subjectRef: journey.subjectRef,
    stages,
    milestones,
    highestMilestone: highestMilestone(milestones),
    nextExecutableAct,
    // WHERE THE OPERATOR SHOULD BE = where the next act is performed. Never a
    // dashboard, never the stage they just finished.
    currentStageId: nextExecutableAct?.stageId ?? truthPass.currentStageId,
    complete,
    runtimeState: {
      ...truthPass,
      // The stepper consumes `runtimeState`, so the gating relief and the
      // canonical outcomes must reach it — otherwise the bar would render one
      // answer while this module held another, which is the two-observer
      // defect all over again.
      stages: truthPass.stages.map((s) => {
        const resolved = stages.find((r) => r.stageId === s.stageId);
        return resolved ? { ...s, state: resolved.status } : s;
      }),
      currentStageId: nextExecutableAct?.stageId ?? truthPass.currentStageId,
      complete,
    },
  };
}

/**
 * THE ONE NEXT ACT.
 *
 *   > "After each successful act, take the operator to the next required
 *   >  stage — never back to cartridge home/Lab/dashboard."
 *
 * The first stage that is not canonically complete. If it carries a blocker,
 * the act is the blocker's first remedy — because a stage you cannot start is
 * not the next thing you can DO; clearing what stops it is. If it carries no
 * blocker, the act is the ceremony itself.
 *
 * Returns null only when the journey is complete, which is the one honest
 * reason to offer nothing.
 */
/**
 * Every stage that is NOT on the admission spine — the branch stages
 * themselves plus everything downstream of one.
 *
 * DERIVED, never listed. `standing` carries no `branch` marker of its own; it
 * is off-spine purely because it descends from `deploy`, which is. A
 * hand-maintained list would have to be updated every time a branch grew a
 * second step, and the first person to forget would silently put a Standing
 * stage back on the constitutional line (inv.engineering.036/037).
 */
export function offSpineStageIds(journey: JourneyDefinition): Set<string> {
  const offSpine = new Set<string>();
  // Stage order is topological in every journey definition, so one forward
  // pass reaches every descendant.
  for (const stage of journey.stages) {
    if (stage.branch || stage.prerequisites.some((p) => offSpine.has(p))) offSpine.add(stage.id);
  }
  return offSpine;
}

export function resolveNextExecutableAct(
  journey: JourneyDefinition,
  stages: readonly StageResolution[],
): JourneyAct | null {
  const offSpine = offSpineStageIds(journey);
  for (const stage of journey.stages) {
    /*
     * BRANCH STAGES ARE NEVER "THE ONE NEXT ACT".
     *
     * A branch runs after the admission spine, in parallel with its sibling,
     * and the operator ruled that neither gates the other. Naming one of them
     * here would silently privilege whichever happens to sit earlier in the
     * stage array — re-imposing an order the reconstitution exists to remove,
     * through nothing more than array position. The pair is offered together
     * by `resolveBranchOffers` (services/journey/agentStateAxes.ts) instead.
     */
    if (offSpine.has(stage.id)) continue;
    const resolution = stages.find((s) => s.stageId === stage.id);
    if (!resolution || resolution.canonicalOutcome) continue;

    const blocker = resolution.operationalBlockers[0];
    if (blocker) {
      const act = blocker.acts[0];
      return { ...act, stageId: stage.id, target: act.target ?? stage.id };
    }
    return journeyAct(
      stage.id,
      `perform:${stage.id}`,
      'perform-ceremony',
      `Continue to ${stage.label}`,
      stage.description,
    );
  }
  return null;
}

// ── Persistence — so refresh, persona change and route change all agree ─────

/**
 * The record that survives a reload.
 *
 *   > "Persist a stage-resolution record so refresh, persona change and route
 *   >  change all resolve the same result."
 *
 * Stored in `registry_assets.metadata.journey_resolutions[journeyId]` — the
 * row that already exists and already holds `settled_facts`. Deliberately NOT
 * a new table, for the reason `settledFacts.ts` gives: this journey is already
 * blocked on one unapplied migration, and adding a second prerequisite in
 * order to fix a continuity problem would raise Time to Repair to buy nothing.
 */
/**
 * A governed-correction TOMBSTONE (Horizen Pilot Closure — POSIT state model,
 * operator ruling 2026-08-10): "State is monotonic only until valid contrary
 * evidence or governed correction occurs. A correction supersedes earlier
 * state evidence; subsequent valid evidence may establish a new state at a
 * later effective time."
 *
 * Recorded by a correction route (never inferred) alongside the settled-fact
 * invalidation it accompanies. Its ONLY effect is to permanently retire the
 * `prior-resolution` RATCHET-SYNTHESIS shortcut for this one stage id — see
 * `resolveMonotonicJourneyState`'s `input.invalidatedStages` consumption.
 * It does NOT block the stage from ever completing again: genuine live
 * evidence on a later read still earns `canonicalOutcome: true` with
 * `canonicalAuthority: 'evidence'`, exactly the same as a stage that was
 * never canonical at all — old assertion → governed invalidation →
 * unresolved → new valid evidence → established again, without rewriting
 * history. Retained forever once written (never cleared) — a stage that has
 * been through a governed correction once must always reprove itself from
 * live evidence rather than regain the ratchet shortcut, which is a
 * deliberately narrower, safer trade than either a positive-only ratchet or a
 * permanent deny-list on the stage itself.
 */
export interface StageInvalidationRecord {
  invalidatedAt: string;
  reason: string;
  correctionReceiptId?: string | null;
  supersededEvidenceIds?: string[];
}

export interface PersistedJourneyResolution {
  journeyId: string;
  journeyVersion: string;
  subjectRef: string;
  canonicalStages: string[];
  /** Governed-correction tombstones, keyed by stage id. See `StageInvalidationRecord`. */
  invalidatedStages?: Record<string, StageInvalidationRecord>;
  milestones: JourneyMilestone[];
  highestMilestone: JourneyMilestone | null;
  recordedAt: string;
}

type ResolutionMap = Record<string, PersistedJourneyResolution>;

export async function readJourneyResolution(
  admin: SupabaseClient,
  aigentQubeId: string,
  journeyId: string,
): Promise<PersistedJourneyResolution | null> {
  const { data } = await admin.from('registry_assets').select('metadata').eq('asset_id', aigentQubeId).maybeSingle();
  const map = (data?.metadata as { journey_resolutions?: ResolutionMap } | null)?.journey_resolutions;
  return map?.[journeyId] ?? null;
}

export type RecordResolutionResult =
  | { ok: true; record: PersistedJourneyResolution }
  | { ok: false; reason: 'no-write-target' | 'write-failed'; detail: string };

/**
 * Record the resolution — MONOTONICALLY.
 *
 * The merge is a UNION of what is already stored with what is being written,
 * so this function has no code path that can shrink a stored resolution. A
 * caller that computed a regressed state (a failed read, a partial refresh, a
 * persona whose receipts are not visible) cannot persist that regression even
 * by trying. Monotonicity that depends on every caller being correct is not
 * monotonicity.
 */
export async function recordJourneyResolution(
  admin: SupabaseClient,
  aigentQubeId: string,
  resolution: Omit<PersistedJourneyResolution, 'recordedAt'> & { recordedAt?: string },
): Promise<RecordResolutionResult> {
  const { data } = await admin.from('registry_assets').select('metadata').eq('asset_id', aigentQubeId).maybeSingle();
  if (!data) {
    return { ok: false, reason: 'no-write-target', detail: `no registry_assets row for "${aigentQubeId}"` };
  }
  const metadata = (data.metadata as Record<string, unknown> | null) ?? {};
  const map = ((metadata.journey_resolutions as ResolutionMap | undefined) ?? {}) as ResolutionMap;
  const existing = map[resolution.journeyId];

  const canonicalStages = Array.from(new Set([...(existing?.canonicalStages ?? []), ...resolution.canonicalStages]));
  const milestones = advanceMilestones(existing?.milestones ?? [], resolution.milestones);
  /*
   * Tombstones are carried forward on EVERY write, never dropped — this
   * function's caller (the ordinary journey `/state` read) never invalidates
   * anything itself, so it never passes `resolution.invalidatedStages`, but
   * it still overwrites the whole `journey_resolutions[journeyId]` record on
   * every call; without this merge, the very next ordinary read after a
   * governed correction would silently erase the tombstone the correction
   * just wrote. A caller that DOES pass new tombstones (a correction route)
   * gets them unioned in, keyed by stage id — never destructive, matching
   * `canonicalStages`' own union discipline above.
   */
  const invalidatedStages = { ...(existing?.invalidatedStages ?? {}), ...(resolution.invalidatedStages ?? {}) };
  const record: PersistedJourneyResolution = {
    journeyId: resolution.journeyId,
    journeyVersion: resolution.journeyVersion,
    subjectRef: resolution.subjectRef,
    canonicalStages,
    ...(Object.keys(invalidatedStages).length > 0 ? { invalidatedStages } : {}),
    milestones,
    highestMilestone: highestMilestone(milestones),
    recordedAt: resolution.recordedAt ?? new Date().toISOString(),
  };

  const { error } = await admin
    .from('registry_assets')
    .update({ metadata: { ...metadata, journey_resolutions: { ...map, [resolution.journeyId]: record } } })
    .eq('asset_id', aigentQubeId);
  if (error) {
    // Named, never swallowed — the discipline settledFacts.ts records.
    console.error('[JOURNEY RESOLUTION] failed to persist', { aigentQubeId, journeyId: resolution.journeyId, error: error.message });
    return { ok: false, reason: 'write-failed', detail: error.message };
  }
  return { ok: true, record };
}
