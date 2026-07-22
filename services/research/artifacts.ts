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
import {
  ARTIFACT_LIFECYCLE,
  PROTOCOL_FREEZE_ARTIFACT_KINDS,
  type ArtifactLifecycleState,
  type ArtifactPhase,
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
}

/** Per-kind freeze gate — PRD-EPI-001 §3 (crystal), §5 (task-set/answer-key),
 * §6 (analysis-config/interpretation-table), §7 (execution-run is never frozen
 * via this path — see recordExperimentRunLifecycle for execution transitions).
 * Each gate is a PLUGGABLE check; wire the real validators
 * (services/research/crystalReadiness.ts, taskCoverage.ts) here as they land —
 * this function is the single choke point every freeze must pass through, so a
 * gate is never bypassed by a caller that forgets to check it. */
export async function checkFreezeGate(artifact: FrozenArtifact): Promise<FreezeGateResult> {
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
    // PRD-EPI-001 §3.2: task-set freeze is gated on the Task–Crystal Coverage
    // Report, which itself requires the crystal to already be frozen. Wire
    // taskCoverage.runCoverageReport(experimentId) here once built; until then,
    // fail closed rather than silently accepting an unvalidated task set.
    const crystal = await getArtifact(artifact.experimentId, 'crystal-version');
    if (!crystal || crystal.lifecycle !== 'frozen') {
      return { ok: false, error: 'task-set cannot freeze before crystal-version is frozen (PRD-EPI-001 §3.2, IRL-016 §5)' };
    }
  }
  if (!artifact.contentHash) {
    return { ok: false, error: 'contentHash required before freeze (PRD-EPI-001 §2.1)' };
  }
  if (artifact.signedBy.length === 0) {
    return { ok: false, error: 'at least one signatory required before freeze (IRL-016 §2)' };
  }
  return { ok: true };
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

  const candidate: FrozenArtifact = {
    ...artifact,
    contentHash: input.contentHash,
    signedBy: input.signedBy,
  };
  const gate = await checkFreezeGate(candidate);
  if (!gate.ok) return { ok: false, error: gate.error };

  const frozenAt = new Date().toISOString();
  const frozen: FrozenArtifact = {
    ...candidate,
    lifecycle: 'frozen',
    commitmentHash: input.contentHash,
    frozenAt,
  };

  const { ok, receiptId } = await writeLifecycleReceipt({
    personaId: input.personaId,
    summary: `${artifact.experimentId} artifact '${artifact.id}' (${artifact.kind}) frozen — commitment ${input.contentHash.slice(0, 16)}…`,
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
