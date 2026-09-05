/**
 * Frozen Artifact service — PRD-EPI-001 §2 (EXP-P1 Experimental Infrastructure).
 *
 * Persists FrozenArtifact rows (types/research.ts) as `research_objects` rows
 * with object_kind='artifact' — composing the EXISTING durable-lab-record
 * table (services/research/lifecycle.ts) rather than forking a parallel one.
 * Every write rides the ONE receipt path (writeLifecycleReceipt), exactly like
 * recordExperimentTransition / recordResearchObjectCreated.
 *
 * Server-only.
 */

import {
  listResearchObjects,
  upsertResearchObject,
  writeLifecycleReceipt,
  type ResearchObjectRecord,
} from '@/services/research/lifecycle';
import { runCrystalReadinessReport, type CrystalReadinessReport } from '@/services/research/crystalReadiness';
import { runTaskCoverageReport, type TaskDefinition } from '@/services/research/taskCoverage';
import type { HashCoveredMember } from '@/services/research/crystalContentProjection';
import {
  ARTIFACT_LIFECYCLE,
  PROTOCOL_FREEZE_ARTIFACT_KINDS,
  type ArtifactLifecycleState,
  type ArtifactPhase,
  type CrystalExecutionDesignation,
  type FreezeAuthorizationRecord,
  type FreezeScientificDeviation,
  type FrozenArtifact,
  type FrozenArtifactKind,
} from '@/types/research';

function fromRow(row: ResearchObjectRecord): FrozenArtifact {
  const p = row.payload as Partial<FrozenArtifact>;
  return {
    id: row.objectId,
    kind: (p.kind ?? 'crystal-version') as FrozenArtifactKind,
    phase: (p.phase ?? 'protocol') as ArtifactPhase,
    experimentId: String(p.experimentId ?? ''),
    lifecycle: row.lifecycleState as ArtifactLifecycleState,
    contentHash: (p.contentHash as string | null) ?? null,
    commitmentHash: (p.commitmentHash as string | null) ?? null,
    frozenAt: (p.frozenAt as string | null) ?? null,
    signedBy: Array.isArray(p.signedBy) ? p.signedBy : [],
    // From the ROW, not the payload — receiptId is its own column
    // (services/research/lifecycle.ts's ResearchObjectRecord), never
    // duplicated into the JSON blob.
    receiptId: row.receiptId ?? null,
    // Iterative Crystal versioning (2026-09-05) — absent on every artifact
    // frozen before this scheme existed (e.g. 'EXP-P1/crystal-vP1'); `null`
    // is the honest read for those, never a guessed designation.
    executionDesignation: (p.executionDesignation as FrozenArtifact['executionDesignation']) ?? null,
    freezeAuthorization: (p.freezeAuthorization as FrozenArtifact['freezeAuthorization']) ?? null,
    readinessSnapshot: (p.readinessSnapshot as FrozenArtifact['readinessSnapshot']) ?? null,
    memberSnapshot: (p.memberSnapshot as FrozenArtifact['memberSnapshot']) ?? null,
  };
}

function toPayload(artifact: FrozenArtifact): Record<string, unknown> {
  return {
    kind: artifact.kind,
    phase: artifact.phase,
    experimentId: artifact.experimentId,
    contentHash: artifact.contentHash,
    commitmentHash: artifact.commitmentHash,
    frozenAt: artifact.frozenAt,
    signedBy: artifact.signedBy,
    executionDesignation: artifact.executionDesignation,
    freezeAuthorization: artifact.freezeAuthorization,
    readinessSnapshot: artifact.readinessSnapshot,
    memberSnapshot: artifact.memberSnapshot,
    ...('taskSetId' in artifact ? { taskSetId: (artifact as { taskSetId?: string }).taskSetId } : {}),
    ...('taskSetContentHash' in artifact
      ? { taskSetContentHash: (artifact as { taskSetContentHash?: string }).taskSetContentHash }
      : {}),
  };
}

/** All FrozenArtifact rows for one experiment (any lifecycle state). */
export async function listArtifacts(experimentId: string): Promise<FrozenArtifact[]> {
  const listed = await listResearchObjects();
  if (!listed.ok) return [];
  return listed.objects
    .filter((o) => o.objectKind === 'artifact' && (o.payload as { experimentId?: string }).experimentId === experimentId)
    .map(fromRow);
}

/** One FrozenArtifact by (experimentId, kind) — kinds other than `execution-run`
 * are expected to be singular per experiment; execution-run uses `id` directly
 * since a `kind` lookup would collapse multiple repetitions into one row. */
export async function getArtifact(experimentId: string, kind: FrozenArtifactKind): Promise<FrozenArtifact | null> {
  const all = await listArtifacts(experimentId);
  return all.find((a) => a.kind === kind) ?? null;
}

export async function getArtifactById(id: string): Promise<FrozenArtifact | null> {
  const listed = await listResearchObjects();
  if (!listed.ok) return null;
  const row = listed.objects.find((o) => o.objectKind === 'artifact' && o.objectId === id);
  return row ? fromRow(row) : null;
}

/** `EXP-P1/crystal-vP3` -> 3. Non-matching ids (a caller-chosen id that
 *  doesn't follow the vP<N> convention) are simply excluded from generation
 *  arithmetic — they are neither the active candidate nor counted toward the
 *  next generation number. */
const CRYSTAL_VERSION_ID_PATTERN = /\/crystal-vP(\d+)$/;

/**
 * The `crystal-version` artifact id for the CURRENT (active) candidate —
 * never an already-frozen predecessor (operator ruling, 2026-08-27, "Crystal
 * v1/v2 lineage collision": *"A frozen predecessor Crystal must never satisfy
 * the freeze state of a successor Crystal candidate."*).
 *
 * `getArtifact(experimentId, 'crystal-version')`'s first-match `.find()` (and
 * the freeze route's own former hardcoded `${experimentId}/crystal-vP1`
 * default) could not distinguish "the vP1 artifact, now frozen and immutable
 * historical evidence" from "the crystal Track 2 is currently constituting" —
 * both were literally the same object id, so a frozen predecessor's
 * `lifecycle: 'frozen'` was read straight into the successor's Freeze-stage
 * status. This function is the one place that resolves which generation is
 * "current," from the artifact rows that already exist — no new table, no new
 * stored version counter (inv.engineering.036).
 *
 * Walks every `crystal-version` artifact already provisioned for this
 * experiment, ordered by the generation number embedded in its own id
 * (`crystal-vP<N>`, the SAME convention `crystalFreezeCeremony.ts`'s id
 * doc-comment already named but no lookup ever read). Returns:
 *
 *   - the highest-numbered generation that is NOT frozen — the in-progress
 *     candidate, so repeated calls (provisioning, reading state) stay
 *     idempotent and never mint a new generation just for being asked again;
 *   - otherwise (every existing generation is frozen, or none has ever been
 *     provisioned) the NEXT unused generation — `crystal-vP1` when nothing
 *     has ever been provisioned, `crystal-vP2` once vP1 alone is frozen, and
 *     so on.
 *
 * Every reader of "is the crystal-version artifact frozen" for DISPLAY, and
 * every writer that PROVISIONS or FREEZES a new one, must resolve through
 * this — never `getArtifact(experimentId, 'crystal-version')`, which cannot
 * tell an active candidate from a frozen predecessor.
 */
export async function currentCrystalArtifactId(experimentId: string): Promise<string> {
  const all = await listArtifacts(experimentId);
  const versions = all
    .filter((a) => a.kind === 'crystal-version')
    .map((a) => {
      const m = a.id.match(CRYSTAL_VERSION_ID_PATTERN);
      return m ? { artifact: a, generation: Number(m[1]) } : null;
    })
    .filter((v): v is { artifact: FrozenArtifact; generation: number } => v !== null)
    .sort((a, b) => a.generation - b.generation);

  const activeCandidate = [...versions].reverse().find((v) => v.artifact.lifecycle !== 'frozen');
  if (activeCandidate) return activeCandidate.artifact.id;

  const highestGeneration = versions.length > 0 ? versions[versions.length - 1].generation : 0;
  return `${experimentId}/crystal-vP${highestGeneration + 1}`;
}

/**
 * The `crystal-version` artifact currently under construction — `null` when
 * it has never been provisioned (nothing to read yet, not an error) or when
 * every existing generation is already frozen and no successor has been
 * provisioned. Never returns an already-frozen artifact; see
 * `currentCrystalArtifactId`.
 */
export async function getCurrentCrystalArtifact(experimentId: string): Promise<FrozenArtifact | null> {
  const id = await currentCrystalArtifactId(experimentId);
  return getArtifactById(id);
}

/**
 * Resolve the crystal-version artifact id CURRENTLY being constituted for
 * this experiment (`currentCrystalArtifactId`'s own contract — the
 * highest-numbered non-frozen generation, or the next unused one), and
 * ensure a durable `research_objects` row exists for it — provisioning one
 * at `draft` lifecycle, idempotently, the first time anything needs to
 * stamp membership under this generation.
 *
 * This is what makes a crystal generation a real, first-class object from
 * the moment Track 2 first assigns a member to it, rather than a string
 * computed on the fly and never persisted anywhere (2026-09-05,
 * generation-identity repair,
 * RES-2026-09-05-TRACK2-MEMBERSHIP-RECOVERY-GENERATION-BLIND-001). The
 * Stage 8 assign route is the one caller that needs this; every other
 * reader of "what generation is this" should read the already-persisted
 * `invariant_contexts.crystal_generation_id` value, never re-derive it.
 */
export async function ensureCurrentCrystalGenerationId(experimentId: string): Promise<string> {
  const id = await currentCrystalArtifactId(experimentId);
  const existing = await getArtifactById(id);
  if (!existing) {
    const provisioned = await upsertArtifact({
      id,
      kind: 'crystal-version',
      phase: 'protocol',
      experimentId,
      lifecycle: 'draft',
    });
    if (!provisioned.ok) {
      throw new Error(`could not provision crystal generation object '${id}': ${provisioned.error ?? 'unknown error'}`);
    }
  }
  return id;
}

/**
 * The MOST RECENTLY FROZEN `crystal-version` generation — `null` when none
 * has ever been frozen. The complement of `getCurrentCrystalArtifact`: some
 * callers (observer-round assignment, independent review) deliberately want
 * a FROZEN artifact to review, never the in-progress candidate — but they
 * share the exact same lineage-collision risk `currentCrystalArtifactId`
 * closes, because `getArtifact`'s first-match `.find()` returns whichever
 * generation the underlying list happens to order first (oldest `updated_at`
 * — `listResearchObjects` orders ascending), not the LATEST frozen one. Once
 * a successor generation is itself frozen, a first-match caller would keep
 * reviewing the predecessor forever. Ordered by the same `vP<N>` generation
 * number `currentCrystalArtifactId` reads, never by timestamp.
 */
export async function latestFrozenCrystalArtifact(experimentId: string): Promise<FrozenArtifact | null> {
  const all = await listArtifacts(experimentId);
  const frozenVersions = all
    .filter((a) => a.kind === 'crystal-version' && a.lifecycle === 'frozen')
    .map((a) => {
      const m = a.id.match(CRYSTAL_VERSION_ID_PATTERN);
      return m ? { artifact: a, generation: Number(m[1]) } : null;
    })
    .filter((v): v is { artifact: FrozenArtifact; generation: number } => v !== null)
    .sort((a, b) => a.generation - b.generation);
  return frozenVersions.length > 0 ? frozenVersions[frozenVersions.length - 1].artifact : null;
}

/** Create or update an artifact at `draft`/`validated` — freely editable
 * pre-freeze (IRL-016 §3: everything unsigned remains mutable). Never call
 * this to move an artifact TO `frozen` — use freezeArtifact, which enforces
 * the per-kind gates (PRD-EPI-001 §3, §5, §6). */
export async function upsertArtifact(input: {
  id: string;
  kind: FrozenArtifactKind;
  phase: ArtifactPhase;
  experimentId: string;
  lifecycle: Extract<ArtifactLifecycleState, 'draft' | 'validated'>;
  taskSetId?: string;
  taskSetContentHash?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const artifact: FrozenArtifact = {
    id: input.id,
    kind: input.kind,
    phase: input.phase,
    experimentId: input.experimentId,
    lifecycle: input.lifecycle,
    contentHash: null,
    commitmentHash: null,
    frozenAt: null,
    signedBy: [],
    receiptId: null,
    executionDesignation: null,
    freezeAuthorization: null,
    readinessSnapshot: null,
    memberSnapshot: null,
    ...(input.taskSetId ? { taskSetId: input.taskSetId } : {}),
    ...(input.taskSetContentHash ? { taskSetContentHash: input.taskSetContentHash } : {}),
  } as FrozenArtifact;
  return upsertResearchObject({
    objectKind: 'artifact',
    objectId: input.id,
    payload: toPayload(artifact),
    lifecycleState: input.lifecycle,
  });
}

export interface FreezeGateResult {
  ok: boolean;
  error?: string;
  /**
   * The readiness report computed during THIS gate check, for crystal-version
   * artifacts — attached whether or not the gate ultimately passes, so a
   * caller (freezeArtifact) can persist the EXACT measurements without a
   * second, possibly-divergent computation (inv.engineering.036). `undefined`
   * for every other artifact kind.
   */
  readiness?: CrystalReadinessReport;
}

/**
 * Operator authorization for an internal-pilot freeze — see
 * types/research.ts's FreezeAuthorizationRecord for the persisted shape this
 * maps onto. Required only when `executionDesignation === 'internal-pilot'`;
 * refused outright on a `'confirmatory'` freeze (2026-09-05, iterative
 * Crystal versioning — operator ruling: "Frozen generations are immutable;
 * Crystal lineages are evolutionary").
 */
export interface FreezeDeviationAuthorization {
  authorizedBy: string; // T2-safe operator ref
  statement: string; // verbatim rationale
  /** MUST exactly equal the set of scientific-readiness check names failing
   *  right now — no more (can't pre-authorize an unmeasured future failure),
   *  no fewer (can't leave a real failure unacknowledged). */
  acknowledgedCheckNames: string[];
}

/** Per-kind freeze gate — PRD-EPI-001 §3 (crystal), §5 (task-set/answer-key),
 * §6 (analysis-config/interpretation-table), §7 (execution-run is never frozen
 * via this path — see recordExperimentRunLifecycle for execution transitions).
 * Each gate calls the real validators (services/research/crystalReadiness.ts,
 * taskCoverage.ts) — this function is the single choke point every freeze
 * must pass through, so a gate is never bypassed by a caller that forgets to
 * check it. */
export async function checkFreezeGate(
  artifact: FrozenArtifact,
  opts: {
    tasks?: TaskDefinition[];
    /** Defaults to `'confirmatory'` — the unconditional gate below applies
     *  exactly as it always has unless this is explicitly `'internal-pilot'`. */
    executionDesignation?: CrystalExecutionDesignation;
    deviationAuthorization?: FreezeDeviationAuthorization;
  } = {},
): Promise<FreezeGateResult> {
  const executionDesignation = opts.executionDesignation ?? 'confirmatory';
  let readiness: CrystalReadinessReport | undefined;
  if (artifact.kind !== 'crystal-version') {
    if (opts.deviationAuthorization || executionDesignation !== 'confirmatory') {
      return {
        ok: false,
        error: 'executionDesignation / deviationAuthorization apply only to crystal-version artifacts',
      };
    }
  } else {
    // A confirmatory freeze must NEVER carry a deviation record — that is the
    // entire point of the two-designation split. Refused before readiness is
    // even computed, so this can never be reached by accident.
    if (executionDesignation === 'confirmatory' && opts.deviationAuthorization) {
      return {
        ok: false,
        error:
          'a confirmatory freeze must never carry a deviationAuthorization — deviations are permitted only for ' +
          'an explicit internal-pilot execution designation',
      };
    }
    // PRD-EPI-001 §3.1 — Crystal Intrinsic Readiness Report. Honest today: no
    // Track 2 content exists yet, so this will correctly report `ok: false`
    // with zero counts until the crystal is actually enlarged — that is the
    // gate working as designed, not a bug to route around.
    readiness = await runCrystalReadinessReport({ experimentId: artifact.experimentId });
    // `ok` already excludes `scientific-maturity` checks (operator ruling,
    // 2026-08-05 — those are informational, never a freeze blocker); this
    // filter keeps the error message honest about the SAME set, so it never
    // cites structural-diversity/graph-connectivity as "why this failed"
    // when neither is actually gating anything. Computed regardless of
    // `readiness.ok` — an internal-pilot deviation needs the exact failing
    // set even when there is nothing to report for a confirmatory freeze.
    const failedChecks = readiness.checks.filter((c) => c.tier === 'scientific-readiness' && !c.passed);

    if (executionDesignation === 'internal-pilot') {
      // An internal-pilot designation is ALWAYS a deliberate, attributed,
      // stated act — required even when nothing is currently failing (a
      // pilot run chosen for another reason still needs an operator on record
      // for why this is not the confirmatory freeze).
      const deviation = opts.deviationAuthorization;
      if (!deviation?.authorizedBy?.trim() || !deviation?.statement?.trim()) {
        return {
          ok: false,
          error:
            'an internal-pilot freeze requires deviationAuthorization.authorizedBy and .statement — a pilot ' +
            'designation is never a default, only a deliberate, attributed, stated operator act',
          readiness,
        };
      }
      const failedNames = new Set(failedChecks.map((c) => c.name));
      const acknowledgedNames = new Set(deviation.acknowledgedCheckNames ?? []);
      const unacknowledged = [...failedNames].filter((n) => !acknowledgedNames.has(n));
      const overclaimed = [...acknowledgedNames].filter((n) => !failedNames.has(n));
      if (unacknowledged.length > 0) {
        return {
          ok: false,
          error:
            `deviationAuthorization does not acknowledge every currently-failing scientific-readiness check — ` +
            `missing: ${unacknowledged.join(', ')}. Every real failure must be explicitly named; none may pass ` +
            `unacknowledged.`,
          readiness,
        };
      }
      if (overclaimed.length > 0) {
        return {
          ok: false,
          error:
            `deviationAuthorization names check(s) that are not currently failing: ${overclaimed.join(', ')} — a ` +
            `deviation may only acknowledge real, currently-measured failures, never a pre-authorized blanket.`,
          readiness,
        };
      }
      // Accepted: the freeze proceeds despite `!readiness.ok`. Nothing above
      // marks a failing check `passed`, weakens a threshold, or adjusts the
      // measurement — `readiness` (attached below, unmodified) still reports
      // exactly what it always would. Falls through to the shared checks.
    } else if (!readiness.ok) {
      // Confirmatory — the unconditional gate, byte-identical to its
      // pre-2026-09-05 behaviour.
      const failed = failedChecks.map((c) => `${c.name}: ${c.detail}`);
      return {
        ok: false,
        error: `Crystal Intrinsic Readiness Report failed (PRD-EPI-001 §3.1) — ${failed.join('; ')}`,
        readiness,
      };
    }
    // Falls through, `readiness` set above — the shared per-kind checks below
    // (answer-key / task-set / contentHash / signatory) are unaffected by
    // either designation and apply exactly as before.
  }
  if (artifact.kind === 'answer-key') {
    const a = artifact as unknown as { taskSetId?: string; taskSetContentHash?: string };
    if (!a.taskSetId || !a.taskSetContentHash) {
      return { ok: false, error: 'answer-key requires taskSetId + taskSetContentHash (PRD-EPI-001 §5)' };
    }
    const taskSet = await getArtifact(artifact.experimentId, 'task-set');
    if (!taskSet || taskSet.lifecycle !== 'frozen') {
      return { ok: false, error: 'answer-key cannot freeze before its task-set is frozen (PRD-EPI-001 §5)' };
    }
    if (taskSet.contentHash !== a.taskSetContentHash) {
      return {
        ok: false,
        error: 'answer-key.taskSetContentHash does not match the frozen task-set.contentHash — blocked, never silently tolerated (PRD-EPI-001 §5)',
      };
    }
  }
  if (artifact.kind === 'task-set') {
    // PRD-EPI-001 §3.2 — the crystal must already be frozen (IRL-016 §5's
    // sequence gate), THEN the Task–Crystal Coverage Report runs against the
    // caller-supplied draft tasks. No task-set content schema exists yet
    // anywhere in the codebase (Track 2 dependency) — when the caller hasn't
    // supplied `opts.tasks`, this falls back to the crystal-frozen check alone
    // and says so explicitly in the error, rather than silently passing a
    // freeze it never actually validated coverage for.
    const crystal = await getArtifact(artifact.experimentId, 'crystal-version');
    if (!crystal || crystal.lifecycle !== 'frozen') {
      return { ok: false, error: 'task-set cannot freeze before crystal-version is frozen (PRD-EPI-001 §3.2, IRL-016 §5)' };
    }
    if (!opts.tasks || opts.tasks.length === 0) {
      return {
        ok: false,
        error: 'task-set freeze requires opts.tasks for the Task–Crystal Coverage Report (PRD-EPI-001 §3.2) — crystal is frozen, but coverage cannot be assessed without the draft task list',
      };
    }
    const coverage = await runTaskCoverageReport({ experimentId: artifact.experimentId, tasks: opts.tasks });
    if (!coverage.ok) {
      const uncovered = coverage.taskResults.filter((t) => !t.covered).map((t) => t.taskId);
      return {
        ok: false,
        error:
          coverage.blockedReason ??
          `Task–Crystal Coverage Report failed (PRD-EPI-001 §3.2) — uncovered tasks: ${uncovered.join(', ')}`,
      };
    }
  }
  if (!artifact.contentHash) {
    return { ok: false, error: 'contentHash required before freeze (PRD-EPI-001 §2.1)', readiness };
  }
  if (artifact.signedBy.length === 0) {
    return { ok: false, error: 'at least one signatory required before freeze (IRL-016 §2)', readiness };
  }
  return { ok: true, readiness };
}

/** Transition an artifact validated → frozen. Runs checkFreezeGate first;
 * refuses honestly (no partial freeze) on any gate failure. Sets
 * commitmentHash = contentHash at the moment of freeze for protocol-phase
 * artifacts (PRD-EPI-001 §2.1's phase-specific commitmentHash rule). */
export async function freezeArtifact(input: {
  personaId: string;
  id: string;
  contentHash: string;
  signedBy: string[];
  governingInvariants?: string[];
  /** Required to freeze a task-set artifact (PRD-EPI-001 §3.2) — the draft
   * task list the Task–Crystal Coverage Report runs against. Ignored for
   * every other artifact kind. */
  tasks?: TaskDefinition[];
  /**
   * Iterative Crystal versioning (2026-09-05, operator ruling: "Frozen
   * generations are immutable; Crystal lineages are evolutionary").
   * Defaults to `'confirmatory'` — omitting these three fields entirely
   * reproduces the pre-2026-09-05 behaviour byte for byte: the unconditional
   * scientific-readiness gate, no persisted deviation, no snapshot beyond
   * what always persisted. `'internal-pilot'` requires `deviationAuthorization`
   * whenever any scientific-readiness check is currently failing.
   */
  executionDesignation?: CrystalExecutionDesignation;
  deviationAuthorization?: FreezeDeviationAuthorization;
  /**
   * REQUIRED to freeze a crystal-version artifact — the exact hash pre-image
   * `services/research/crystalContentProjection.ts::sortedHashCoveredProjection`
   * produced for `input.contentHash`, persisted verbatim so future
   * verification never depends on re-querying a live domain that may have
   * moved on. Ignored for every other artifact kind.
   */
  memberSnapshot?: HashCoveredMember[];
}): Promise<{ ok: boolean; error?: string; receiptId?: string | null }> {
  const artifact = await getArtifactById(input.id);
  if (!artifact) return { ok: false, error: `unknown artifact '${input.id}'` };
  if (artifact.lifecycle === 'frozen') return { ok: false, error: 'already frozen — freeze is immutable (IRL-016 §4)' };
  if (artifact.lifecycle !== 'validated') {
    return { ok: false, error: `cannot freeze from '${artifact.lifecycle}' — must be 'validated' first` };
  }
  if (input.signedBy.length === 0) {
    return { ok: false, error: 'at least one signatory required (IRL-016 §2)' };
  }
  if (artifact.kind === 'crystal-version' && !input.memberSnapshot) {
    return {
      ok: false,
      error:
        'memberSnapshot is required to freeze a crystal-version artifact — the exact hash pre-image must be ' +
        'persisted so future verification never depends on re-querying a live domain that may have moved on',
    };
  }

  const executionDesignation = input.executionDesignation ?? 'confirmatory';
  const candidate: FrozenArtifact = {
    ...artifact,
    contentHash: input.contentHash,
    signedBy: input.signedBy,
  };
  const gate = await checkFreezeGate(candidate, {
    tasks: input.tasks,
    executionDesignation,
    deviationAuthorization: input.deviationAuthorization,
  });
  if (!gate.ok) return { ok: false, error: gate.error };

  const frozenAt = new Date().toISOString();
  // The scientific-readiness checks failing AT THIS EXACT FREEZE — computed
  // from `gate.readiness`, the SAME report `checkFreezeGate` just verified
  // the deviation against, never re-derived (inv.engineering.036).
  const deviations: FreezeScientificDeviation[] = (gate.readiness?.checks ?? [])
    .filter((c) => c.tier === 'scientific-readiness' && !c.passed)
    .map((c) => ({ checkName: c.name, measuredDetail: c.detail, remedy: c.remedy }));
  const freezeAuthorization: FreezeAuthorizationRecord | null =
    executionDesignation === 'internal-pilot' && input.deviationAuthorization
      ? {
          authorizedBy: input.deviationAuthorization.authorizedBy,
          authorizedAt: frozenAt,
          statement: input.deviationAuthorization.statement,
          executionDesignation,
          deviations,
        }
      : null;

  const frozen: FrozenArtifact = {
    ...candidate,
    lifecycle: 'frozen',
    commitmentHash: input.contentHash,
    frozenAt,
    executionDesignation: artifact.kind === 'crystal-version' ? executionDesignation : null,
    freezeAuthorization,
    readinessSnapshot: (gate.readiness as unknown as Record<string, unknown>) ?? null,
    memberSnapshot: input.memberSnapshot ?? null,
  };

  const { ok, receiptId } = await writeLifecycleReceipt({
    personaId: input.personaId,
    summary:
      `${artifact.experimentId} artifact '${artifact.id}' (${artifact.kind}) frozen — commitment ` +
      `${input.contentHash.slice(0, 16)}…` +
      (executionDesignation === 'internal-pilot' ? ' [executionDesignation: internal-pilot]' : ''),
    invariantSeedIds: input.governingInvariants ?? [],
  });
  if (!ok) return { ok: false, error: 'receipt write failed' };

  const persisted = await upsertResearchObject({
    objectKind: 'artifact',
    objectId: artifact.id,
    payload: toPayload(frozen),
    lifecycleState: 'frozen',
    receiptId,
  });
  if (!persisted.ok) return { ok: false, error: persisted.error };
  return { ok: true, receiptId };
}

/**
 * Whether an experiment's `protocol-ratified` transition is unlocked —
 * PRD-EPI-001 §2.2: every PROTOCOL_FREEZE_ARTIFACT_KINDS artifact for the
 * experiment must be at `frozen`. execution-run and research-package are
 * deliberately excluded (they govern the LATER running/evaluated/published
 * transitions, not this one) — see the macro-transition table in §2.2.
 */
export async function deriveProtocolRatified(experimentId: string): Promise<{
  ready: boolean;
  missing: FrozenArtifactKind[];
  present: FrozenArtifactKind[];
}> {
  const artifacts = await listArtifacts(experimentId);
  const frozenKinds = new Set(artifacts.filter((a) => a.lifecycle === 'frozen').map((a) => a.kind));
  const required = PROTOCOL_FREEZE_ARTIFACT_KINDS as readonly FrozenArtifactKind[];
  const missing = required.filter((k) => !frozenKinds.has(k));
  const present = required.filter((k) => frozenKinds.has(k));
  return { ready: missing.length === 0, missing, present };
}

export { ARTIFACT_LIFECYCLE };
