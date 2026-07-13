/**
 * `software` pilot — code as a constitutionally PRODUCED artifact (CFS-025
 * Phase 2, increment 4; D1-safe under CFS-016).
 *
 * This is the `software`-profile consumer of the Artifact Runtime. It shepherds
 * a capability goal into an OPERATIONAL-tier `software` artifact whose BODY is
 * the CFS-015 Implementation Pack: it COMPOSES the pack generator
 * (`services/constitutional/implementationPack.ts:generateImplementationPack`)
 * for the content, then INVOKES the runtime (`runArtifact('operational',
 * 'software', …)`) in PROPOSE mode to tier + version it, and persists the
 * production via `saveArtifactRecord`. It NEVER re-implements the pack
 * generator or the runtime — it composes both (the ccrlResearchPilot pattern).
 *
 * ── Why OPERATIONAL, not constitutional ──
 * Code packs are WORKING artifacts (CFS-025: "software builds" are the
 * operational tier's own example). Constitutionality is EARNED by promotion —
 * the existing promote route matures an operational record upward; this pilot
 * never births a constitutional object. Operational tier ⇒ NO receipt is
 * written here (the runtime's operational runner returns receiptId null by
 * contract); the persisted artifact record is the durable output.
 *
 * ── D1 HOLDS ABSOLUTELY (CFS-016, D1 RATIFIED 2026-07-06) ──
 * Code EXECUTION stays HUMAN. This pilot produces the implementation-pack
 * artifact and (optionally) points at the D1 deployment-proposal route — it
 * executes NOTHING, pushes NOTHING, deploys NOTHING. On `proposeDeployment:
 * true` the pilot does NOT create the proposal itself: the D1 proposal
 * ceremony (the `deployment_proposed` receipt + the Deployment constitutional
 * object) is route-inlined in `app/api/constitutional/deployment-proposal/
 * route.ts` — there is no shared `proposeDeployment()` service to compose, and
 * duplicating the route's receipt/summary logic into this pilot would fork it.
 * The pilot therefore returns the documented pointer
 * `deploymentProposal: 'use /api/constitutional/deployment-proposal'` and the
 * operator (or an admin-gated caller) drives that route with the produced
 * pack id, exactly as at D0/D1 today.
 *
 * TIER DISCIPLINE: the only subject handle expressed is the T2-safe
 * `actorCommitment` supplied by the route. No T0 identifier is accepted,
 * derived, or serialised anywhere in this module (no receipt ⇒ no personaId
 * seam at all). The assembled result is re-guarded with
 * `findForbiddenObjectKey` on the way out.
 *
 * Server-side: composes DB/LLM-bearing organs (generateImplementationPack,
 * saveArtifactRecord) but adds no direct DB access of its own; node crypto for
 * the T2-safe content commitment.
 */

import { createHash } from 'crypto';
import type {
  ArtifactCompositionInput,
  ArtifactContext,
  ArtifactResult,
} from '@/types/artifactRuntime';
import type { CompositionResult } from '@/types/composition';
import type { ObjectRef } from '@/types/constitutionalObject';
import { findForbiddenObjectKey } from '@/types/constitutionalObject';
import { runArtifact } from '@/services/artifact/runArtifact';
import {
  generateImplementationPack,
  type ImplementationPack,
} from '@/services/constitutional/implementationPack';
import { saveArtifactRecord } from '@/services/artifact/artifactRecordStore';

/** The pointer returned instead of an inline D1 proposal (see header — the
 *  proposal ceremony is route-inlined; the pilot refuses to fork it). */
export const DEPLOYMENT_PROPOSAL_POINTER = 'use /api/constitutional/deployment-proposal';

/** The D1 honesty note stamped on every result — execution stays human. */
export const D1_NOTE =
  'D1 (CFS-016): code execution stays HUMAN. This production is the implementation-pack ' +
  'artifact only — nothing was executed, pushed, or deployed. Propose deployment via ' +
  '/api/constitutional/deployment-proposal and push manually after reviewing the chain.';

export interface SoftwarePilotInput {
  /** The acting subject's T2-safe one-way commitment — the ONLY subject handle
   *  the runtime + record express. Supplied by the route (computed server-side). */
  actorCommitment: string;
  /** T2-safe ref to the authorising intent (an IntentQube ref). */
  intentRef: string;
  /** The capability goal the Implementation Pack is generated for. */
  goal: string;
  /** Optional ontology domains threaded to the pack generator's ContextPack. */
  domains?: string[];
  /** Delegate attribution for the persisted record. Defaults to 'operator' —
   *  the delegate-produce path is not wired for this pilot; pass a delegate id
   *  only when one genuinely drove the production. */
  delegate?: string;
  /** When true, the caller wants a D1 deployment proposal too. The pilot does
   *  NOT create it (route-inlined ceremony — see header); it returns the
   *  documented pointer so the caller drives the existing route. */
  proposeDeployment?: boolean;
}

/** T1-safe projection of the generated pack — everything here is either the
 *  operator's own goal text, invariant refs (object refs, not T0 ids), or the
 *  generator's plan fields. */
export interface SoftwarePackProjection {
  packId: string;
  goal: string;
  implementationMechanism: ImplementationPack['implementationMechanism'];
  areasToTouch: string[];
  validationPlan: string[];
  receiptPlan: string[];
  invariantSeedIds: (string | null)[];
  canonVersion: string;
  composedBy: ImplementationPack['composedBy'];
  preflightDisposition: 'proceed' | 'escalate' | null;
}

export interface SoftwarePilotResult {
  /** The runtime's T1-projected ArtifactResult (operational: versioned, no
   *  object/receipt/registry by contract). */
  artifact: ArtifactResult;
  /** Durable artifact_records id, or null (soft-fail until the migration runs,
   *  or the run itself failed). */
  recordId: string | null;
  pack: SoftwarePackProjection;
  /** DEPLOYMENT_PROPOSAL_POINTER when proposeDeployment was requested; null
   *  otherwise. Never an executed/created proposal — D1. */
  deploymentProposal: string | null;
  d1: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Pure helpers (canary-pinned in tests/software-pilot.test.ts)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Render the Implementation Pack as the artifact BODY — a markdown document
 * with the full pack JSON fenced at the end (both the human-readable plan and
 * the machine-readable record travel in one body). PURE + deterministic on the
 * pack's own fields: no clock, no randomness (generatedAt/id come from the
 * pack itself).
 */
export function renderPackMarkdown(pack: ImplementationPack): string {
  const list = (items: string[], empty: string): string =>
    items.length > 0 ? items.map((i) => `- ${i}`).join('\n') : `_${empty}_`;
  const invariants =
    pack.invariantBindings.length > 0
      ? pack.invariantBindings.map((b) => `- ${b.seedId ?? b.id}: ${b.statement}`).join('\n')
      : '_none bound_';

  return [
    `# Implementation Pack — ${pack.goal}`,
    '',
    `Pack \`${pack.id}\` · mechanism **${pack.implementationMechanism}** · composed by ${pack.composedBy} · canon ${pack.canonVersion} · generated ${pack.generatedAt}`,
    '',
    '## Governing invariants',
    invariants,
    '',
    '## Areas to touch',
    list(pack.areasToTouch, 'unknown — never invented'),
    '',
    '## Constitutional validation',
    list(pack.validationPlan, 'none drafted'),
    '',
    '## Constitutional receipt',
    list(pack.receiptPlan, 'none drafted'),
    '',
    '## Pack record (JSON)',
    '```json',
    JSON.stringify(pack, null, 2),
    '```',
    '',
  ].join('\n');
}

/**
 * Build the composition input the runtime consumes, grounding the artifact in
 * the generated pack: the content commitment is derived from the rendered BODY
 * (so the artifact id is deterministic on the pack content — the runtime's
 * idempotency contract), and the pack's governing invariants become the
 * composed-from audit trail (invariant refs are object refs, not T0 ids). PURE.
 */
export function packToCompositionInput(
  pack: ImplementationPack,
  body: string,
): ArtifactCompositionInput {
  const contentHash = createHash('sha256').update(body).digest('hex').slice(0, 16);
  const composedFrom: ObjectRef[] = pack.invariantBindings.map((b) => ({
    id: b.seedId ?? b.id,
    kind: 'invariant' as const,
  }));
  return {
    compositionRef: `software:pack:${contentHash}`,
    result: { provenance: { contentHash, composedFrom } } as unknown as CompositionResult,
  };
}

/** T1-safe pack projection for the result payload. PURE. */
export function projectPackSummary(pack: ImplementationPack): SoftwarePackProjection {
  return {
    packId: pack.id,
    goal: pack.goal,
    implementationMechanism: pack.implementationMechanism,
    areasToTouch: pack.areasToTouch,
    validationPlan: pack.validationPlan,
    receiptPlan: pack.receiptPlan,
    invariantSeedIds: pack.invariantBindings.map((b) => b.seedId ?? b.id),
    canonVersion: pack.canonVersion,
    composedBy: pack.composedBy,
    preflightDisposition: pack.preflight?.disposition ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// The pilot
// ─────────────────────────────────────────────────────────────────────────

/**
 * Produce a `software` artifact: generate the Implementation Pack for the goal,
 * run it through the Artifact Runtime as an OPERATIONAL production (propose
 * mode, invokedBy 'aigentz'), and persist the record. Writes NO receipt (the
 * operational tier's contract); executes/pushes/deploys NOTHING (D1). Returns
 * a T1-projected result — no T0 identifiers.
 */
export async function produceSoftwareArtifact(
  args: SoftwarePilotInput,
): Promise<SoftwarePilotResult> {
  // 1) COMPOSE the pack generator — the artifact's content organ (never forked).
  const pack = await generateImplementationPack({
    goal: args.goal,
    intentId: args.intentRef,
    context: args.domains && args.domains.length > 0 ? { domains: args.domains } : undefined,
  });

  // 2) The pack IS the body; the content commitment derives from it.
  const body = renderPackMarkdown(pack);
  const input = packToCompositionInput(pack, body);

  // 3) INVOKE the runtime — operational tier, PROPOSE mode (the runtime writes
  //    no receipt in this tier regardless; propose keeps the discipline explicit).
  const context: ArtifactContext = {
    invokedBy: 'aigentz',
    intentRef: args.intentRef,
    actorCommitment: args.actorCommitment,
    mode: 'propose',
  };
  const artifact = await runArtifact('operational', 'software', input, context);

  // 4) Persist the production (operational ⇒ durable record; the record — not a
  //    receipt — is the durable output at this tier). Best-effort/soft-fail.
  let recordId: string | null = null;
  if (artifact.ok && artifact.artifactId) {
    recordId = await saveArtifactRecord({
      artifactId: artifact.artifactId,
      profile: 'software',
      consequenceClass: 'operational',
      delegate: args.delegate?.trim() || 'operator',
      title: `Implementation Pack: ${args.goal.slice(0, 100)}`,
      brief: args.goal,
      body,
      receiptId: null, // operational tier — no receipt by contract
      sovereignty: {
        source: 'implementation-pack',
        packId: pack.id,
        composedBy: pack.composedBy,
        implementationMechanism: pack.implementationMechanism,
        canonVersion: pack.canonVersion,
        preflightDisposition: pack.preflight?.disposition ?? null,
      },
    });
  }

  // 5) D1 deployment proposal — documented pointer, never an inline fork (header).
  const deploymentProposal = args.proposeDeployment === true ? DEPLOYMENT_PROPOSAL_POINTER : null;

  const result: SoftwarePilotResult = {
    artifact,
    recordId,
    pack: projectPackSummary(pack),
    deploymentProposal,
    d1: D1_NOTE,
  };

  // T0 inexpressibility — a leak is a thrown error, not a quiet pass (mirrors
  // the ccrlResearchPilot / deploymentObject discipline).
  const leak = findForbiddenObjectKey(result);
  if (leak) {
    throw new Error(`software pilot result leaks a T0 identifier at '${leak}' — refusing to return it`);
  }
  return result;
}

export default produceSoftwareArtifact;
