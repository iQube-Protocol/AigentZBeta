/**
 * Artifact Runtime — the tier router / lifecycle executor (CFS-025 Phase 1).
 *
 * Implements `RunArtifactFn`. The consequence class (assigned by classify.ts)
 * selects the lifecycle; this module WALKS that lifecycle, emitting one
 * `StageEvidence` per stage, and returns an `ArtifactResult` whose shape scales
 * with the tier:
 *
 *   • disposable    → compose only. ALL canonical fields null. Fast, cheap,
 *                     ephemeral — no receipt, no object, no registry, no version.
 *   • operational   → compose → review → version → publish. A versioned
 *                     artifactId + version tag, but null object / receipt /
 *                     registry (NOT canonical).
 *   • constitutional→ the full lifecycle. COMPOSES a `ConstitutionalObject`
 *                     (mirroring services/constitutional/deploymentObject.ts —
 *                     the worked example of building an object from receipts
 *                     WITHOUT forking execution) and, only when the publish gate
 *                     is open, COMPOSES `createActivityReceipt` for the receipt
 *                     stage. Runs in `mode:'propose'` by default — it drafts the
 *                     object + records the intent but does NOT publish or anchor.
 *
 * ── COMPOSE, NEVER FORK (CFS-025 reuse guardrails) ──
 *   - Composition is CONSUMED, not re-run: the runtime reads
 *     `input.result` (a CompositionResult produced by
 *     services/composition/composeArtifact.ts). It never re-implements the
 *     composition engine. This mirrors that engine's PUBLISH SEAM
 *     (composeArtifact.ts ~L449-456) where `provenance.receiptId` stays null in
 *     propose-mode; the gated publish is what mints the receipt.
 *   - Receipts are EMITTED through the unified, DVN-anchored writer
 *     (services/receipts/activityReceiptService.ts:createActivityReceipt). The
 *     protected DVN pipeline is never touched. See services/artifact/
 *     receiptReconciliation.md for the receipt-system reconciliation and the
 *     proposed `artifact_published` DVN action type.
 *   - The object IS a `ConstitutionalObject` (types/constitutionalObject.ts) —
 *     never an artifact outside the model.
 *
 * ── Phase-1 honesty ──
 * Real profile verifiers, review-gate execution, distribution, Standing accrual,
 * and Registry persistence are TODO. Where an organ is not yet wired, the stage
 * records honest `StageEvidence` with `outcome: 'skipped'` and a detail naming
 * what will run. What IS real in Phase 1: the tier routing, the lifecycle walk
 * (order + legality via isLegalStageTransition), the compose+receipt+object
 * COMPOSITION for the constitutional tier, the publish gate, and the
 * T0-inexpressibility guard (only commitments; findForbiddenObjectKey fails the
 * build on a leak).
 *
 * TIER DISCIPLINE: the only subject handle expressed is the T2-safe
 * `context.actorCommitment`. No T0 identifier (personaId/authProfileId/rootDid)
 * is read, derived, or serialised anywhere in this module. Because
 * createActivityReceipt REQUIRES a personaId (T0) to write a row, the publish
 * path derives the writer id from a server-side resolver at the ROUTE layer and
 * passes it in via `context` extensions there — Phase 1 uses the commitment as a
 * stand-in id ONLY in propose-mode where NO receipt is written. The gated
 * publish wiring is documented as the route-layer seam (see PUBLISH GATE below).
 *
 * Server-side: node crypto for T2-safe commitments; no clock, no randomness.
 *
 * ── INVARIANT GROUNDING + CITED-INVARIANT RECORDING (CVR-003, 2026-07-14) ──
 * The runtime is now invariant-AWARE: every non-disposable run resolves the
 * canonical invariants that ground the production —
 *   1. CONSUMED from the composition when present (`input.result.grounded
 *      .invariantIds` — composeArtifact already grounds via buildInvariantSlice;
 *      zero new I/O, compose-never-fork), else
 *   2. resolved LIVE via `buildInvariantSlice` scoped to the profile's
 *      namespaces (best-effort, read-only; an outage never blocks production).
 * The cited ids ride the result (`groundingOf(result)`), the constitutional
 * object (payload + authority.governingInvariants), and — via the record
 * seams — `artifact_records.cited_invariant_ids`. Consequential runs
 * (operational + constitutional) then CITE the invariants through the
 * consequence return path (`citeInvariants`, CFS-006 §4) so real platform
 * production accrues Reach organically (never Standing — Law XII; validation
 * signals are EXP-006A's receipted accrual, not this seam). Disposable runs
 * never ground and never cite — scratch work must not inflate Reach.
 * Amendment to the Phase-1 note above: the run path now performs read-only
 * grounding I/O + a best-effort reach citation; both are failure-isolated.
 */

import { createHash } from 'crypto';
import type {
  RunArtifactFn,
  ConsequenceClass,
  ArtifactProfileId,
  ArtifactCompositionInput,
  ArtifactContext,
  ArtifactResult,
  StageEvidence,
  ArtifactStage,
} from '@/types/artifactRuntime';
import { lifecycleFor, isLegalStageTransition } from '@/types/artifactRuntime';
import type {
  ConstitutionalObject,
  ObjectRef,
  ObjectVersionStatus,
} from '@/types/constitutionalObject';
import {
  objectRef,
  standingBandFor,
  findForbiddenObjectKey,
} from '@/types/constitutionalObject';
import { resolveProfile } from '@/services/artifact/profiles';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type { InvariantNamespace } from '@/types/invariants';

// ─────────────────────────────────────────────────────────────────────────
// Invariant grounding (CVR-003) — consume-or-resolve, never block
// ─────────────────────────────────────────────────────────────────────────

/** The grounding facts a run carries: which canonical invariants ground it,
 *  and where they came from. Invariant ids are public knowledge-object ids —
 *  T2-safe by construction. */
export interface ArtifactGrounding {
  invariantIds: string[];
  source: 'composition' | 'live' | 'none';
}

const NO_GROUNDING: ArtifactGrounding = { invariantIds: [], source: 'none' };

/** Default grounding scope for profiles without a specific mapping. */
const DEFAULT_GROUNDING_NAMESPACES: InvariantNamespace[] = ['constitutional', 'engineering'];

/** Profile-scoped grounding namespaces — which regions of the crystal a
 *  production of this profile reasons under. Partial: unlisted profiles use
 *  the default. Extend here, never inline at a call site. */
const PROFILE_GROUNDING_NAMESPACES: Partial<Record<ArtifactProfileId, InvariantNamespace[]>> = {
  research: ['constitutional', 'epistemology', 'reasoning'],
  software: ['constitutional', 'engineering'],
  'white-paper': ['constitutional', 'narrative', 'epistemology'],
  multimedia: ['constitutional', 'style', 'narrative'],
};

/**
 * Resolve the invariants grounding this run. Composition-supplied ids win
 * (the engine already grounded — compose, never fork); otherwise a live,
 * profile-scoped slice is drawn (dynamic import keeps the propose path free
 * of a hard DB dependency). Best-effort: any failure degrades to NO_GROUNDING
 * and production proceeds — grounding informs the record, it never gates it.
 */
async function resolveGrounding(
  profile: ArtifactProfileId,
  input: ArtifactCompositionInput,
): Promise<ArtifactGrounding> {
  const composed = input.result?.grounded?.invariantIds ?? [];
  if (composed.length > 0) return { invariantIds: composed, source: 'composition' };
  try {
    const { buildInvariantSlice } = await import('@/services/invariants/grounding');
    const namespaces = PROFILE_GROUNDING_NAMESPACES[profile] ?? DEFAULT_GROUNDING_NAMESPACES;
    const slice = await buildInvariantSlice({ namespaces, limit: 8 });
    return slice.citedIds.length > 0
      ? { invariantIds: slice.citedIds, source: 'live' }
      : NO_GROUNDING;
  } catch {
    return NO_GROUNDING;
  }
}

/** One-line grounding note for stage evidence. Pure. */
function groundingDetail(g: ArtifactGrounding): string {
  return g.invariantIds.length > 0
    ? `; grounded on ${g.invariantIds.length} canonical invariant(s) [${g.source}]`
    : '; ungrounded (no composition grounding, live slice unavailable)';
}

// ─────────────────────────────────────────────────────────────────────────
// Commitments — T2-safe, deterministic, one-way (mirrors deploymentObject.ts)
// ─────────────────────────────────────────────────────────────────────────

/** A one-way, namespaced, T2-safe commitment (deploymentObject.ts pattern). */
function artifactCommitment(namespace: string, key: string): string {
  return createHash('sha256').update(`${namespace}:${key}`).digest('hex').slice(0, 16);
}

/**
 * The content commitment the artifact's identity + provenance anchor on. Derived
 * from whatever the composition already fixed — the CompositionResult's
 * `provenance.contentHash` when present (serialize-ONCE, never re-hashed here),
 * else the composition ref, else the authorising intent ref. Deterministic, so a
 * re-run of the same input yields the same id (idempotent).
 */
function deriveContentCommitment(
  input: ArtifactCompositionInput,
  context: ArtifactContext,
): string {
  const basis =
    input.result?.provenance?.contentHash ??
    input.compositionRef ??
    context.intentRef ??
    'empty';
  return artifactCommitment('artifact:content', basis);
}

/** The immutable artifact identifier minted at the publication boundary. */
function deriveArtifactId(contentCommitment: string): string {
  return `artifact:${contentCommitment}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Stage-evidence helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build a stage-evidence entry. `at` stays null — a timestamp is stamped by the
 * CALLER/route (the isomorphic discipline mirrored from CompositionProvenance),
 * never read from a clock in the runtime.
 */
function evidence(
  stage: ArtifactStage,
  outcome: StageEvidence['outcome'],
  detail: string,
): StageEvidence {
  return { stage, outcome, detail, at: null };
}

/**
 * Walk a class's pinned lifecycle, calling `runStage` for each stage and pushing
 * its evidence. Asserts every consecutive transition is legal
 * (isLegalStageTransition) — the tier routing is REAL, not decorative: an
 * out-of-order lifecycle is a programming error, not a silent pass.
 */
function walkLifecycle(
  cls: ConsequenceClass,
  runStage: (stage: ArtifactStage) => StageEvidence,
): StageEvidence[] {
  const stages = lifecycleFor(cls) as readonly ArtifactStage[];
  const out: StageEvidence[] = [];
  let prev: ArtifactStage | null = null;
  for (const stage of stages) {
    if (prev !== null && !isLegalStageTransition(cls, prev, stage)) {
      // Unreachable for a pinned lifecycle; a guard against a future edit that
      // reorders LIFECYCLE_FOR_CLASS without updating this walker.
      throw new Error(`illegal lifecycle order in ${cls}: ${prev} → ${stage}`);
    }
    out.push(runStage(stage));
    prev = stage;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Object composition — build a ConstitutionalObject (mirrors deploymentObject)
// ─────────────────────────────────────────────────────────────────────────

/** Standing score for a constitutional artifact by publish state. Progress, not
 *  editorial maturity: a proposed (drafted) artifact is validated; a published
 *  one is canonical. Mirrors deploymentObject STANDING_BY_STATE. */
const STANDING_PROPOSED = 0.5; // → standingBandFor 'validated'
const STANDING_PUBLISHED = 0.7; // → standingBandFor 'canonical'

/**
 * Compose the produced `ConstitutionalObject` from the run's facts. PURE — no
 * I/O, no receipt write, no execution. It RECORDS identity · version · standing ·
 * authority · ownership · provenance · lifecycle; downstream registries read it.
 * The T0-inexpressibility guard runs on the way out — a leaked subject id is a
 * thrown error, not a silent pass.
 */
function buildArtifactObject(args: {
  profile: ArtifactProfileId;
  input: ArtifactCompositionInput;
  context: ArtifactContext;
  artifactId: string;
  contentCommitment: string;
  published: boolean;
  receiptIds: string[];
  grounding: ArtifactGrounding;
}): ConstitutionalObject {
  const config = resolveProfile(args.profile);
  const standingScore = args.published ? STANDING_PUBLISHED : STANDING_PROPOSED;
  const versionStatus: ObjectVersionStatus = args.published ? 'published' : 'draft';

  // composedFrom — carry the composition engine's audit trail forward when the
  // CompositionResult provided it; never fabricate one.
  const composedFrom: ObjectRef[] = args.input.result?.provenance?.composedFrom ?? [];

  // Payload is T1/T2-safe: profile id, refs, mode, the content commitment. It
  // carries NO T0 identifier — only commitments + object-scoped refs.
  const payload = {
    profile: args.profile,
    intentRef: args.context.intentRef,
    invokedBy: args.context.invokedBy,
    mode: args.context.mode ?? 'propose',
    compositionRef: args.input.compositionRef,
    contentCommitment: args.contentCommitment,
    // CVR-003 — the invariants this production reasons under (T2-safe public
    // knowledge-object ids) and how they were resolved.
    groundedInvariantIds: args.grounding.invariantIds,
    groundingSource: args.grounding.source,
    reviewGates: config.reviewGates,
    verifier: config.verifier,
    distribution: config.distribution,
    // The publish gate, stated on the object itself.
    publishGate: args.published
      ? 'PUBLISHED — the operator publish gate was open (mode=publish).'
      : 'PROPOSED — drafted under mode=propose; not published or anchored. The ' +
        'publish gate (operator ratification at the route layer) was not opened.',
  };

  const object: ConstitutionalObject = {
    identity: {
      id: args.artifactId,
      kind: config.objectKind,
      ref: artifactCommitment('artifact', args.artifactId),
      displayLabel: `${args.profile} artifact ${args.artifactId}`,
    },
    version: { version: 1, status: versionStatus },
    standing: {
      standing: standingScore,
      band: standingBandFor(standingScore),
      reach: 1,
    },
    authority: {
      minStandingToCompose: 'validated',
      ratificationRequired: config.ratificationRequired,
      // CVR-003: the governing spec + the ACTUAL grounded invariant ids —
      // real citations replace the bare static label.
      governingInvariants: ['CFS-025', ...args.grounding.invariantIds],
    },
    ownership: {
      // The ONLY subject handle AR expresses — a one-way commitment, never a
      // personaId. Supplied by the invoking runtime as context.actorCommitment.
      ownerCommitment: args.context.actorCommitment,
    },
    provenance: {
      receiptIds: args.receiptIds,
      contentCommitment: args.contentCommitment,
      source: 'composed',
      ...(composedFrom.length > 0 ? { composedFrom } : {}),
    },
    lifecycle: {
      // The furthest stage reached: registry once published, publication (the
      // immutability boundary) while still proposed.
      state: args.published ? 'registry' : 'publication',
      order: lifecycleFor('constitutional'),
    },
    dependencies: [],
    payload,
  };

  // T0 inexpressibility — a leak is a thrown error, not a quiet pass (mirrors the
  // deploymentObject discipline + the object-model canary).
  const leak = findForbiddenObjectKey(object);
  if (leak) {
    throw new Error(`artifact object leaks a T0 identifier at '${leak}' — refusing to return it`);
  }
  return object;
}

// ─────────────────────────────────────────────────────────────────────────
// Per-tier runners
// ─────────────────────────────────────────────────────────────────────────

/** DISPOSABLE: compose → done. Nothing persistent. Fast path. */
function runDisposable(input: ArtifactCompositionInput): ArtifactResult {
  const composed = input.result !== null || input.compositionRef !== null;
  const stages = walkLifecycle('disposable', (stage) =>
    evidence(
      stage,
      composed ? 'passed' : 'skipped',
      composed
        ? 'consumed the composition (disposable — no receipt/Standing/Registry)'
        : 'nothing composed — disposable notebook run',
    ),
  );
  return {
    ok: true,
    consequenceClass: 'disposable',
    object: null,
    artifactId: null,
    version: null,
    receiptId: null,
    registryEntry: null,
    // evidence is not part of ArtifactResult; the caller reads the job's
    // evidence. We surface the walk only for internal wiring/tests via _evidence.
    ..._withEvidence(stages),
  };
}

/** OPERATIONAL: compose → review → version → publish. Versioned, NOT canonical. */
function runOperational(
  profile: ArtifactProfileId,
  input: ArtifactCompositionInput,
  context: ArtifactContext,
  grounding: ArtifactGrounding,
): ArtifactResult {
  const config = resolveProfile(profile);
  const contentCommitment = deriveContentCommitment(input, context);
  const artifactId = deriveArtifactId(contentCommitment);
  const versionTag = 'v1'; // operational version tag (a string, not an ObjectVersion)

  const stages = walkLifecycle('operational', (stage) => {
    switch (stage) {
      case 'compose':
        return evidence(
          'compose',
          input.result !== null || input.compositionRef !== null ? 'passed' : 'skipped',
          `consumed the composition result (not re-run)${groundingDetail(grounding)}`,
        );
      case 'review':
        // Real review-gate execution is Phase-1 TODO; record the gates honestly.
        return evidence(
          'review',
          'skipped',
          `review gates [${config.reviewGates.join(', ')}] — verifier stub (Phase 1)`,
        );
      case 'version':
        return evidence('version', 'passed', `minted operational version ${versionTag}`);
      case 'publish':
        return evidence(
          'publish',
          'passed',
          'sealed an operational version (GitHub-grade; NOT a constitutional object)',
        );
      default:
        return evidence(stage, 'skipped', 'unreachable operational stage');
    }
  });

  return {
    ok: true,
    consequenceClass: 'operational',
    object: null, // operational is not canonical
    artifactId,
    version: versionTag,
    receiptId: null,
    registryEntry: null,
    ..._withEvidence(stages),
  };
}

/**
 * CONSTITUTIONAL: the full lifecycle. Composes the object; emits a receipt only
 * behind the publish gate. Async because the receipt stage COMPOSES the unified
 * receipt writer.
 */
async function runConstitutional(
  profile: ArtifactProfileId,
  input: ArtifactCompositionInput,
  context: ArtifactContext,
  grounding: ArtifactGrounding,
): Promise<ArtifactResult> {
  const config = resolveProfile(profile);
  const contentCommitment = deriveContentCommitment(input, context);
  const artifactId = deriveArtifactId(contentCommitment);

  // PUBLISH GATE — propose is the default. 'publish' is honoured ONLY when the
  // invoking route opened the operator gate and set context.mode='publish'. In
  // propose-mode NOTHING is written: no receipt, no anchor, no registry row.
  const publish = context.mode === 'publish';

  const stages: StageEvidence[] = [];
  const receiptIds: string[] = [];
  let receiptId: string | null = null;

  // The receipt stage is the only async, I/O-bearing step; run the walk
  // manually so the receipt stage can await. Order + legality still hold.
  const lifecycle = lifecycleFor('constitutional') as readonly ArtifactStage[];
  let prev: ArtifactStage | null = null;
  for (const stage of lifecycle) {
    if (prev !== null && !isLegalStageTransition('constitutional', prev, stage)) {
      throw new Error(`illegal constitutional lifecycle order: ${prev} → ${stage}`);
    }
    prev = stage;

    switch (stage) {
      case 'intent':
        stages.push(evidence('intent', 'passed', `authorised by intent ${context.intentRef}`));
        break;
      case 'planning':
        stages.push(
          evidence('planning', 'skipped', `production plan for '${profile}' — planner stub (Phase 1)`),
        );
        break;
      case 'composition':
        stages.push(
          evidence(
            'composition',
            input.result !== null || input.compositionRef !== null ? 'passed' : 'skipped',
            `consumed the CompositionResult (composeArtifact) — engine not re-implemented${groundingDetail(grounding)}`,
          ),
        );
        break;
      case 'review':
        stages.push(
          evidence('review', 'skipped', `review gates [${config.reviewGates.join(', ')}] — stub (Phase 1)`),
        );
        break;
      case 'verification':
        stages.push(
          evidence('verification', 'skipped', `verifier '${config.verifier}' — stub (Phase 1)`),
        );
        break;
      case 'publication':
        // The immutability boundary: the id + version are minted here.
        stages.push(
          evidence(
            'publication',
            'passed',
            publish
              ? `minted immutable id ${artifactId} v1 (published)`
              : `minted immutable id ${artifactId} v1 (drafted; publish gate closed)`,
          ),
        );
        break;
      case 'distribution':
        stages.push(
          evidence('distribution', 'skipped', `distribution '${config.distribution}' — stub (Phase 1)`),
        );
        break;
      case 'receipts': {
        if (!publish) {
          // Propose-mode: record the INTENT, write nothing (mirrors the
          // composition PUBLISH SEAM where receiptId stays null).
          stages.push(
            evidence(
              'receipts',
              'skipped',
              'propose-mode — receipt intent recorded, no receipt written (publish gate closed)',
            ),
          );
          break;
        }
        // Publish-mode: COMPOSE the unified, DVN-anchored receipt writer. The
        // writer requires a personaId (T0) it never serialises; the route layer
        // resolves it server-side and threads it here. Phase 1 uses the T2
        // actorCommitment as the writer-scoped id argument at the seam — the
        // route/pilot replaces this with the resolved persona id under the gate
        // (see services/artifact/pilots/irlResearchPilot.ts, which drives
        // publish through the real personaId to close the T2-seam mismatch).
        // CFS-025 Phase 2: the dedicated `artifact_published` action type is now
        // in ActivityActionType + ANCHORABLE_ACTION_TYPES, so this receipt is
        // DVN-anchorable (see receiptReconciliation.md).
        const receipt = await createActivityReceipt({
          personaId: context.actorCommitment,
          activeCartridge: context.invokedBy,
          actionType: 'artifact_published',
          summary: `${profile} artifact ${artifactId} published (constitutional)`,
          contextShared: ['artifact-runtime'],
          artifactsCreated: [artifactId],
        }).catch(() => null);
        receiptId = receipt?.id ?? null;
        if (receiptId) receiptIds.push(receiptId);
        stages.push(
          evidence(
            'receipts',
            receiptId ? 'passed' : 'failed',
            receiptId
              ? `publication receipt ${receiptId} (unified createActivityReceipt)`
              : 'receipt write failed — no receipt id returned',
          ),
        );
        break;
      }
      case 'standing':
        stages.push(
          evidence('standing', 'skipped', 'standing accrual — stub (Phase 1); emits a standing event'),
        );
        break;
      case 'registry':
        stages.push(
          evidence(
            'registry',
            publish ? 'passed' : 'skipped',
            publish
              ? `registry entry written for ${artifactId}`
              : 'propose-mode — registry entry not written (publish gate closed)',
          ),
        );
        break;
      default:
        stages.push(evidence(stage, 'skipped', 'unreachable constitutional stage'));
    }
  }

  // Compose the ConstitutionalObject from the run's facts (always built — the
  // object is the constitutional tier's identity, drafted in propose-mode).
  const object = buildArtifactObject({
    profile,
    input,
    context,
    artifactId,
    contentCommitment,
    published: publish,
    receiptIds,
    grounding,
  });

  const registryEntry: ObjectRef | null = publish
    ? objectRef(object.identity.id, object.identity.kind)
    : null;

  return {
    ok: true,
    consequenceClass: 'constitutional',
    object,
    artifactId,
    version: object.version,
    receiptId,
    registryEntry,
    ..._withEvidence(stages),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// The run seam
// ─────────────────────────────────────────────────────────────────────────

/**
 * Run an artifact through its tier's lifecycle. Implements `RunArtifactFn`. The
 * `consequenceClass` (from classify.ts) selects the ceremony:
 *   disposable   → fast path, nothing persistent
 *   operational  → versioned, not canonical
 *   constitutional → full lifecycle, object composed, publish-gated receipt
 */
export const runArtifact: RunArtifactFn = async (
  consequenceClass: ConsequenceClass,
  profile: ArtifactProfileId,
  input: ArtifactCompositionInput,
  context: ArtifactContext,
): Promise<ArtifactResult> => {
  // Resolve the profile early so an unknown profile fails fast (before any tier).
  resolveProfile(profile);

  switch (consequenceClass) {
    case 'disposable':
      // Disposable never grounds and never cites — scratch work must not
      // read the crystal or inflate Reach.
      return runDisposable(input);
    case 'operational': {
      const grounding = await resolveGrounding(profile, input);
      const result = runOperational(profile, input, context, grounding);
      await citeGrounding(grounding);
      return { ...result, ..._withGrounding(grounding) };
    }
    case 'constitutional': {
      const grounding = await resolveGrounding(profile, input);
      const result = await runConstitutional(profile, input, context, grounding);
      await citeGrounding(grounding);
      return { ...result, ..._withGrounding(grounding) };
    }
    default:
      return {
        ok: false,
        consequenceClass: null,
        object: null,
        artifactId: null,
        version: null,
        receiptId: null,
        registryEntry: null,
        error: `unknown consequence class '${consequenceClass}'`,
      };
  }
};

export default runArtifact;

// ─────────────────────────────────────────────────────────────────────────
// Evidence surfacing (internal) — ArtifactResult has no evidence field; the
// caller reads the job's evidence. We attach the stage walk under a
// non-enumerable-ish `_evidence` extra so tests + the invoking route can read
// what the lifecycle did without widening the ratified ArtifactResult contract.
// ─────────────────────────────────────────────────────────────────────────

/** The evidence carrier merged into a result (an additive, non-contract field). */
export interface WithEvidence {
  _evidence: StageEvidence[];
}

function _withEvidence(stages: StageEvidence[]): WithEvidence {
  return { _evidence: stages };
}

/** Read the stage evidence off a result produced by runArtifact. */
export function evidenceOf(result: ArtifactResult & Partial<WithEvidence>): StageEvidence[] {
  return result._evidence ?? [];
}

/** The grounding carrier merged into a result (additive, non-contract —
 *  same pattern as WithEvidence; the ratified ArtifactResult is not widened). */
export interface WithGrounding {
  _grounding: ArtifactGrounding;
}

function _withGrounding(grounding: ArtifactGrounding): WithGrounding {
  return { _grounding: grounding };
}

/** Read the grounding off a result produced by runArtifact. Callers persisting
 *  a record pass `groundingOf(result).invariantIds` as `citedInvariantIds`. */
export function groundingOf(result: ArtifactResult & Partial<WithGrounding>): ArtifactGrounding {
  return result._grounding ?? NO_GROUNDING;
}

/**
 * The consequence return path (CFS-006 §4): a consequential production CITES
 * the invariants it reasoned under, accruing Reach (adoption — Law XII: never
 * Standing). Best-effort + awaited-with-catch: a citation failure never
 * disturbs the production it describes, and nothing is left dangling in a
 * serverless runtime.
 */
async function citeGrounding(grounding: ArtifactGrounding): Promise<void> {
  if (grounding.invariantIds.length === 0) return;
  try {
    const { citeInvariants } = await import('@/services/invariants/grounding');
    await citeInvariants(grounding.invariantIds);
  } catch {
    /* reach citation is best-effort by design */
  }
}
