/**
 * CCRL `research` pilot — the ratified CFS-025 Phase 2 pilot (experiment → paper).
 *
 * This is the FIRST production consumer of the Artifact Runtime. It shepherds a
 * CCRL experiment into a constitutional-tier `research` artifact by INVOKING the
 * runtime (`runArtifact('constitutional', 'research', …)`) and COMPOSING the
 * research lifecycle service (`services/research/lifecycle.ts:deriveOverview`)
 * for the experiment record it grounds the artifact in. It NEVER re-implements
 * the runtime or the research lifecycle — it composes both.
 *
 * ── The two modes (mirrors the composition observe-mode discipline) ──
 *   • propose (default) — run the full constitutional lifecycle and return the
 *     DRAFTED ConstitutionalObject. NOTHING is published or anchored: no receipt
 *     is written, receiptId is null. A notebook run with constitutional ceremony.
 *   • publish (gated)   — honoured ONLY when the ROUTE resolved the operator's
 *     real personaId under the admin gate and threaded it in. On publish the
 *     pilot emits EXACTLY ONE `artifact_published` receipt via the unified,
 *     DVN-anchored writer (createActivityReceipt) using the REAL personaId, then
 *     projects the published ConstitutionalObject.
 *
 * ── The T2-seam fix (why the pilot owns the publish receipt) ──
 * `runArtifact`'s publish path composes createActivityReceipt with
 * `context.actorCommitment` as the writer id — but the writer needs the REAL T0
 * personaId to hash a correct on-chain persona ref (activityReceiptDvnPipeline
 * `hashPersonaRef`). `ArtifactContext` is T2-only and MUST stay so, so the pilot
 * always drives `runArtifact` in PROPOSE mode (guaranteeing runArtifact writes no
 * receipt) and emits the single publish receipt itself with the personaId the
 * route resolved. This closes the mismatch `receiptReconciliation.md` flagged
 * WITHOUT touching the protected runtime or widening the T2 context contract.
 *
 * TIER DISCIPLINE: `personaId` (T0) is used ONLY as the createActivityReceipt
 * argument — it is never returned, never placed on the ArtifactContext, never on
 * the ConstitutionalObject. The returned ArtifactResult is T1-projected (the
 * object is re-checked for T0 leaks on the way out).
 *
 * Server-side: composes DB-bearing organs (deriveOverview, createActivityReceipt)
 * but adds no direct DB access of its own; node crypto for T2-safe commitments.
 */

import { createHash } from 'crypto';
import type {
  ArtifactCompositionInput,
  ArtifactContext,
  ArtifactResult,
} from '@/types/artifactRuntime';
import type { CompositionResult } from '@/types/composition';
import type { ConstitutionalObject, ObjectRef } from '@/types/constitutionalObject';
import { objectRef, standingBandFor, findForbiddenObjectKey } from '@/types/constitutionalObject';
import { runArtifact } from '@/services/artifact/runArtifact';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { deriveOverview } from '@/services/research/lifecycle';
import { EXPERIMENT_REGISTRY, type ResearchExperiment } from '@/types/research';

/** The default experiment the pilot grounds an artifact in when none is named. */
export const DEFAULT_PILOT_EXPERIMENT_ID = 'EXP-001';

/** Published-tier standing — mirrors runArtifact STANDING_PUBLISHED (0.7 →
 *  standingBandFor 'canonical'). Kept local so the projection composes the same
 *  object-model helper the runtime does, not a forked band table. */
const STANDING_PUBLISHED = 0.7;

export interface CcrlResearchPilotInput {
  /** The acting subject's T2-safe one-way commitment — the ONLY subject handle
   *  the runtime + object express. Supplied by the route (computed server-side). */
  actorCommitment: string;
  /** T2-safe ref to the authorising intent (an IntentQube ref). */
  intentRef: string;
  /** The experiment to ground the paper in; defaults to DEFAULT_PILOT_EXPERIMENT_ID. */
  experimentId?: string;
  /** propose (default) drafts only; publish emits the single anchored receipt. */
  mode?: 'propose' | 'publish';
  /** The REAL T0 personaId, resolved by the ROUTE under the operator gate.
   *  Used ONLY to write the publish receipt; never returned or serialised.
   *  Required for a publish to actually write a receipt; absent ⇒ propose. */
  personaId?: string;
}

/**
 * Build the composition input the artifact is grounded in, COMPOSING the research
 * lifecycle's derived overview for the experiment record (its floor lifecycle +
 * published-run count). The content commitment is derived from that record so a
 * re-run of the same experiment state yields the same artifact id (idempotent).
 * Best-effort: if the overview read fails, the pilot still grounds on the pinned
 * registry entry.
 */
async function buildResearchCompositionInput(
  experimentId: string,
): Promise<{ input: ArtifactCompositionInput; experiment: ResearchExperiment | undefined; lifecycle: string }> {
  const overview = await deriveOverview().catch(() => []);
  const entry = overview.find((e) => e.experiment.id === experimentId);
  const experiment = entry?.experiment ?? EXPERIMENT_REGISTRY.find((e) => e.id === experimentId);
  const lifecycle = entry?.lifecycle ?? 'running';
  const publishedRuns = entry?.publishedRuns ?? 0;

  // T2-safe composition ref + content commitment grounded in the experiment record.
  const compositionRef = `ccrl:research:${experimentId}:${lifecycle}`;
  const contentHash = createHash('sha256')
    .update(`${experimentId}:${lifecycle}:${publishedRuns}`)
    .digest('hex')
    .slice(0, 16);
  // The governing invariants become the composed-from audit trail (invariant refs
  // are object refs, not T0 ids — safe on the object).
  const composedFrom: ObjectRef[] = (experiment?.governingInvariants ?? []).map((id) => ({
    id,
    kind: 'invariant' as const,
  }));

  const input: ArtifactCompositionInput = {
    compositionRef,
    result: { provenance: { contentHash, composedFrom } } as unknown as CompositionResult,
  };
  return { input, experiment, lifecycle };
}

/**
 * Project the DRAFTED ConstitutionalObject (from the propose run) into its
 * PUBLISHED form. This is a small projection of the runtime's already-composed
 * object — status → published, standing → canonical, the publish receipt folded
 * into provenance, lifecycle advanced to registry — NOT a fork of the runtime's
 * object-building logic (the identity, ownership, payload, and composed-from
 * trail are carried through unchanged). Re-guards T0 inexpressibility on the way
 * out. Pure.
 */
function projectPublished(object: ConstitutionalObject, receiptId: string): ConstitutionalObject {
  const published: ConstitutionalObject = {
    ...object,
    version: { ...object.version, status: 'published' },
    standing: {
      ...object.standing,
      standing: STANDING_PUBLISHED,
      band: standingBandFor(STANDING_PUBLISHED),
    },
    provenance: {
      ...object.provenance,
      receiptIds: [...object.provenance.receiptIds, receiptId],
    },
    lifecycle: { ...object.lifecycle, state: 'registry' },
  };
  const leak = findForbiddenObjectKey(published);
  if (leak) {
    throw new Error(`published research artifact leaks a T0 identifier at '${leak}' — refusing to return it`);
  }
  return published;
}

/**
 * Produce a CCRL `research` artifact. Propose-mode by default (drafts, writes
 * nothing). Publish-mode (gated: requires `mode==='publish'` AND a route-resolved
 * `personaId`) emits ONE `artifact_published` receipt and returns the published
 * ConstitutionalObject. Returns a T1-projected ArtifactResult — no T0 ids.
 */
export async function produceCcrlResearchArtifact(
  args: CcrlResearchPilotInput,
): Promise<ArtifactResult> {
  const experimentId = args.experimentId ?? DEFAULT_PILOT_EXPERIMENT_ID;
  const { input, experiment } = await buildResearchCompositionInput(experimentId);

  // The publish gate: only when BOTH the mode is publish AND the route threaded a
  // real personaId in. Either alone ⇒ propose (an honest refusal to write a
  // receipt we cannot correctly attribute).
  const publish = args.mode === 'publish' && Boolean(args.personaId);

  // ALWAYS drive the runtime in propose mode: this guarantees runArtifact writes
  // no receipt (the T2-seam-mismatched one), so the pilot owns the single publish
  // receipt with the real personaId. The full constitutional lifecycle still
  // walks; the drafted object + evidence come back on the result.
  const proposeContext: ArtifactContext = {
    invokedBy: 'ccrl',
    intentRef: args.intentRef,
    actorCommitment: args.actorCommitment,
    mode: 'propose',
  };
  const proposeResult = await runArtifact('constitutional', 'research', input, proposeContext);

  // Propose-mode (or a run that failed): return as-is — receiptId null.
  if (!publish || !proposeResult.ok || !proposeResult.object) {
    return proposeResult;
  }

  // Publish-mode: emit the SINGLE artifact_published receipt with the REAL
  // personaId (the T2-seam fix). DVN-anchorable via ANCHORABLE_ACTION_TYPES.
  const receipt = await createActivityReceipt({
    personaId: args.personaId as string,
    activeCartridge: 'ccrl',
    actionType: 'artifact_published',
    summary: `research artifact ${proposeResult.artifactId} published (constitutional) — ${experimentId}`,
    contextShared: ['ccrl-research', 'artifact-runtime'],
    artifactsCreated: proposeResult.artifactId ? [proposeResult.artifactId] : [],
  }).catch(() => null);

  const receiptId = receipt?.id ?? null;
  if (!receiptId) {
    // Receipt write failed — do NOT claim publication. Return the drafted
    // (propose) result with an honest error rather than a half-published object.
    return { ...proposeResult, error: 'publish receipt write failed — artifact left drafted' };
  }

  const publishedObject = projectPublished(proposeResult.object, receiptId);
  return {
    ...proposeResult,
    object: publishedObject,
    version: publishedObject.version,
    receiptId,
    registryEntry: objectRef(publishedObject.identity.id, publishedObject.identity.kind),
    error: undefined,
  };
}

export default produceCcrlResearchArtifact;
