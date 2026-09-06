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
import { runCrystalReadinessReport } from '@/services/research/crystalReadiness';
import { runTaskCoverageReport, type TaskDefinition } from '@/services/research/taskCoverage';
import {
  ARTIFACT_LIFECYCLE,
  PROTOCOL_FREEZE_ARTIFACT_KINDS,
  type ArtifactExecutionDesignation,
  type ArtifactLifecycleState,
  type ArtifactPhase,
  type FrozenArtifact,
  type FrozenArtifactKind,
  type ScientificDeviation,
} from '@/types/research';
import type { CrystalReadinessReport } from '@/services/research/crystalReadiness';
import type { HashCoveredMember } from '@/services/research/crystalContentProjection';

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
    // "Frozen generations are immutable; Crystal lineages are evolutionary"
    // (EXP-P1/crystal-vP2 internal-pilot authorization) — see
    // types/research.ts's ArtifactExecutionDesignation doc comment.
    executionDesignation: (p.executionDesignation as ArtifactExecutionDesignation | undefined) ?? 'confirmatory',
    scientificDeviations: Array.isArray(p.scientificDeviations) ? p.scientificDeviations : [],
    freezeRationale: (p.freezeRationale as string | null | undefined) ?? null,
    readinessReportAtFreeze: p.readinessReportAtFreeze ?? null,
    // The exact hash pre-image `commitmentHash` commits to for a
    // crystal-version artifact (2026-09-06) — see FrozenArtifact.memberSnapshot.
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
    // Written unconditionally (defaulted 'confirmatory'/[]/null) so a reader
    // of the raw row never has to distinguish "never set" from "explicitly
    // confirmatory" — the same discipline `fromRow`'s defaults apply on read.
    executionDesignation: artifact.executionDesignation ?? 'confirmatory',
    scientificDeviations: artifact.scientificDeviations ?? [],
    freezeRationale: artifact.freezeRationale ?? null,
    readinessReportAtFreeze: artifact.readinessReportAtFreeze ?? null,
    memberSnapshot: artifact.memberSnapshot ?? null,
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
  /** Populated only for `kind: 'crystal-version'` — the FULL readiness report
   *  computed during this gate check, so `freezeArtifact` can persist exactly
   *  what was measured without a second, possibly-different recomputation. */
  readiness?: CrystalReadinessReport;
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
  opts: { tasks?: TaskDefinition[] } = {},
): Promise<FreezeGateResult> {
  // Carried through to the function's single final `return` so the
  // crystal-version branch below never has to duplicate the generic
  // contentHash/signedBy checks every kind still needs — it only ever
  // returns EARLY on an actual refusal.
  let crystalReadiness: CrystalReadinessReport | undefined;
  if (artifact.kind === 'crystal-version') {
    // PRD-EPI-001 §3.1 — Crystal Intrinsic Readiness Report. Honest today: no
    // Track 2 content exists yet, so this will correctly report `ok: false`
    // with zero counts until the crystal is actually enlarged — that is the
    // gate working as designed, not a bug to route around.
    const readiness = await runCrystalReadinessReport({ experimentId: artifact.experimentId });
    if (!readiness.ok) {
      // `ok` already excludes `scientific-maturity` checks (operator ruling,
      // 2026-08-05 — those are informational, never a freeze blocker); this
      // filter keeps the error message honest about the SAME set, so it never
      // cites structural-diversity/graph-connectivity as "why this failed"
      // when neither is actually gating anything.
      const failing = readiness.checks.filter((c) => c.tier === 'scientific-readiness' && !c.passed);

      /*
       * ── "FROZEN GENERATIONS ARE IMMUTABLE; CRYSTAL LINEAGES ARE
       *    EVOLUTIONARY" — the operator-authorized internal/pilot deviation
       *    (EXP-P1/crystal-vP2, generalized Crystal-wide) ─────────────────
       *
       * `executionDesignation: 'internal-pilot'` does NOT weaken, skip, or
       * mark-passed a single check above — `readiness.ok` stays exactly what
       * it was measured to be, and every failing check's `detail` is still
       * computed by the real instrument. What changes is only whether an
       * OTHERWISE-BLOCKING failure is allowed to proceed to freeze, and ONLY
       * when the operator has individually named that specific check via
       * `scientificDeviations` with its own rationale. A failing check that
       * is NOT named there still blocks the freeze unconditionally — an
       * 'internal-pilot' designation is never a blanket waiver.
       */
      if (artifact.executionDesignation === 'internal-pilot') {
        const deviations = artifact.scientificDeviations ?? [];
        const namedChecks = new Set(deviations.map((d) => d.checkName));
        const uncovered = failing.filter((c) => !namedChecks.has(c.name));
        if (uncovered.length > 0) {
          return {
            ok: false,
            readiness,
            error:
              `internal-pilot execution designation still requires an explicit scientificDeviations entry for ` +
              `every failing scientific-readiness check — uncovered: ` +
              uncovered.map((c) => `${c.name}: ${c.detail}`).join('; '),
          };
        }
        // Every failing check is individually named and acknowledged. The
        // freeze proceeds for a NON-confirmatory (internal/pilot) execution
        // only — `readiness`/`readiness.ok` are UNCHANGED (still `false`), so
        // `freezeArtifact` persists the honest measurement, never a
        // laundered "passed" state. Falls through to the generic
        // contentHash/signedBy checks below, same as any other kind.
        crystalReadiness = readiness;
      } else {
        return {
          ok: false,
          readiness,
          error: `Crystal Intrinsic Readiness Report failed (PRD-EPI-001 §3.1) — ${failing.map((c) => `${c.name}: ${c.detail}`).join('; ')}`,
        };
      }
    } else {
      crystalReadiness = readiness;
    }
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
    return { ok: false, error: 'contentHash required before freeze (PRD-EPI-001 §2.1)' };
  }
  if (artifact.signedBy.length === 0) {
    return { ok: false, error: 'at least one signatory required before freeze (IRL-016 §2)' };
  }
  return { ok: true, readiness: crystalReadiness };
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
  /** The operator's exact stated reason for THIS freeze act. Persisted
   *  verbatim on the frozen artifact (see FrozenArtifact.freezeRationale). */
  freezeRationale?: string;
  /** Defaults to `'confirmatory'` — completely unaffected unless a caller
   *  explicitly asks for `'internal-pilot'`. See the "frozen generations are
   *  immutable; Crystal lineages are evolutionary" note in types/research.ts. */
  executionDesignation?: ArtifactExecutionDesignation;
  /**
   * Required, non-empty, when `executionDesignation === 'internal-pilot'`
   * AND the crystal has any failing `scientific-readiness` check — one entry
   * per failing check being authorized past. Caller supplies `checkName` +
   * `rationale` only; `measuredDetail` is ALWAYS computed here from the real
   * readiness report the gate just ran, never accepted as caller input — see
   * `ScientificDeviation`'s own doc comment.
   */
  scientificDeviations?: Array<{ checkName: string; rationale: string }>;
  /**
   * REQUIRED to freeze a crystal-version artifact (2026-09-06) — the exact
   * hash pre-image `services/research/crystalContentProjection.ts::
   * sortedHashCoveredProjection` produced for `input.contentHash`, persisted
   * verbatim so future verification never depends on re-querying a live
   * domain that may have moved on. Ignored for every other artifact kind.
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

  const executionDesignation: ArtifactExecutionDesignation = input.executionDesignation ?? 'confirmatory';
  if (executionDesignation !== 'confirmatory' && executionDesignation !== 'internal-pilot') {
    return { ok: false, error: `unknown executionDesignation '${String(executionDesignation)}' — must be 'confirmatory' or 'internal-pilot'` };
  }
  const suppliedDeviations = input.scientificDeviations ?? [];
  if (executionDesignation === 'internal-pilot') {
    if (suppliedDeviations.length === 0) {
      return {
        ok: false,
        error:
          'executionDesignation "internal-pilot" requires at least one scientificDeviations entry naming the ' +
          'failing scientific-readiness check(s) this freeze is explicitly authorized to proceed past',
      };
    }
    for (const d of suppliedDeviations) {
      if (!d.checkName?.trim() || !d.rationale?.trim()) {
        return { ok: false, error: 'every scientificDeviations entry requires a non-empty checkName and rationale' };
      }
    }
  } else if (suppliedDeviations.length > 0) {
    return { ok: false, error: 'scientificDeviations is only accepted with executionDesignation "internal-pilot"' };
  }

  // The candidate carries checkName-only deviations so checkFreezeGate can
  // verify every currently-failing check is named — `measuredDetail` is
  // filled in AFTER the gate below, from the SAME readiness report it just
  // computed, never invented ahead of it or accepted from the caller.
  const candidate: FrozenArtifact = {
    ...artifact,
    contentHash: input.contentHash,
    signedBy: input.signedBy,
    executionDesignation,
    scientificDeviations: suppliedDeviations.map((d) => ({
      checkName: d.checkName.trim(),
      rationale: d.rationale.trim(),
      measuredDetail: '',
    })),
  };
  const gate = await checkFreezeGate(candidate, { tasks: input.tasks });
  if (!gate.ok) return { ok: false, error: gate.error };

  const readinessChecksByName = new Map((gate.readiness?.checks ?? []).map((c) => [c.name, c] as const));
  const scientificDeviations: ScientificDeviation[] = suppliedDeviations.map((d) => ({
    checkName: d.checkName.trim(),
    rationale: d.rationale.trim(),
    measuredDetail: readinessChecksByName.get(d.checkName.trim())?.detail ?? '',
  }));

  const frozenAt = new Date().toISOString();
  const frozen: FrozenArtifact = {
    ...candidate,
    lifecycle: 'frozen',
    commitmentHash: input.contentHash,
    frozenAt,
    freezeRationale: input.freezeRationale?.trim() || null,
    executionDesignation,
    scientificDeviations,
    // Full report, exactly as measured — crystal-version only (the field is
    // meaningless for other kinds, which never compute a CrystalReadinessReport).
    readinessReportAtFreeze: artifact.kind === 'crystal-version' ? (gate.readiness ?? null) : null,
    // The exact hash pre-image, persisted verbatim — crystal-version only
    // (required above); null for every other kind.
    memberSnapshot: artifact.kind === 'crystal-version' ? (input.memberSnapshot ?? null) : null,
  };

  const { ok, receiptId } = await writeLifecycleReceipt({
    personaId: input.personaId,
    summary:
      `${artifact.experimentId} artifact '${artifact.id}' (${artifact.kind}) frozen — commitment ${input.contentHash.slice(0, 16)}…` +
      (executionDesignation === 'internal-pilot'
        ? ` [internal-pilot execution designation — ${scientificDeviations.length} acknowledged scientific-readiness ` +
          `deviation(s): ${scientificDeviations.map((d) => d.checkName).join(', ')}]`
        : '') +
      (frozen.freezeRationale ? ` — ${frozen.freezeRationale}` : ''),
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
 * "Run EXP-P1 internally" as a NEXT GOVERNED ACTION, reachable once a
 * crystal-version generation is frozen — generalized (any experiment, any
 * crystal-version artifact), never EXP-P1-specific machinery.
 *
 * This is deliberately an EXPOSED next act, not an execution engine: no
 * execution-run runner exists anywhere in this codebase today (`execution-run`
 * artifacts are only ever read/counted — see services/research/
 * readinessDashboard.ts — never created), and building one is a materially
 * larger, separately-chartered change this function does not attempt. What it
 * DOES do is tell the operator, truthfully, what act is available next and
 * how it composes with the ALREADY-EXISTING generic artifact machinery
 * (`upsertArtifact`) — never inventing a new mechanism, and never silently
 * treating "exposed" as "executed".
 */
export interface NextGovernedCrystalAction {
  label: string;
  detail: string;
  /** Nothing has been executed by calling this function — it only describes
   *  what is available. `false` always, named explicitly so a consumer can
   *  never mistake exposure for execution. */
  executed: false;
}

export function nextGovernedActionForFrozenCrystal(
  artifact: Pick<FrozenArtifact, 'id' | 'kind' | 'lifecycle' | 'executionDesignation' | 'scientificDeviations'>,
): NextGovernedCrystalAction | null {
  if (artifact.kind !== 'crystal-version' || artifact.lifecycle !== 'frozen') return null;

  if (artifact.executionDesignation === 'internal-pilot') {
    const deviations = artifact.scientificDeviations ?? [];
    return {
      label: 'Run EXP-P1 internally (pilot)',
      detail:
        `'${artifact.id}' is frozen under executionDesignation 'internal-pilot' — an explicit, operator-` +
        `authorized, NON-confirmatory freeze. It carries ${deviations.length} acknowledged scientific-` +
        `readiness deviation(s) (${deviations.map((d) => d.checkName).join(', ') || 'none'}), preserved exactly ` +
        `as measured. The next governed action is an INTERNAL/PILOT EXP-P1 execution against this frozen ` +
        `substrate — never a confirmatory result. This function only exposes that act as available; no runner ` +
        `for it exists in this codebase yet (execution-run artifacts are provisioned via the same generic ` +
        `upsertArtifact this module already provides, kind: 'execution-run', phase: 'execution', but no code ` +
        `path drives an actual run). Building that runner is a separate, larger change. If the run demonstrates ` +
        `the substrate is insufficient, the ONLY remediation path is: observe limitation → record finding → ` +
        `expand evidence corpus → constitute a successor generation → readiness → freeze successor → rerun. ` +
        `This frozen generation is never mutated.`,
      executed: false,
    };
  }

  return {
    label: 'Run EXP-P1 (confirmatory)',
    detail:
      `'${artifact.id}' is frozen under executionDesignation 'confirmatory' — every scientific-readiness check ` +
      `passed at freeze time. The next governed action is the confirmatory EXP-P1 execution against this ` +
      `frozen substrate.`,
    executed: false,
  };
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
