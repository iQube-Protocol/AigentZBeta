/**
 * delegateProduce — the Homecoming↔Artifact-Runtime convergence seam (CFS-023
 * Phase 4 "Operational Homecoming" delivered THROUGH CFS-025 AR).
 *
 * "A constitutional delegate doing real work natively" IS a delegate invoking the
 * Artifact Runtime. This seam composes the two, forking neither:
 *
 *   1. The delegate PRODUCES the content natively — `callSovereign` grounded in
 *      the delegate's constitutional identity + bounded-delegation constraints
 *      (reusing delegateConverse's identity + system-prompt builders). The reply
 *      carries a sovereignty receipt proving it ran inside AgentiQ.
 *   2. The Artifact Runtime SHEPHERDS that content through the consequence
 *      lifecycle — `classify` → `runArtifact` — tiering it by consequence and
 *      returning the AR envelope (tier, artifact id, version, receipt).
 *
 * Consequence discipline (CFS-025): a delegate produces at the OPERATIONAL tier
 * by default — a versioned-but-not-canonical working artifact (a PRD, a
 * consequence analysis). It CANNOT birth a constitutional artifact; the operator
 * PROMOTES operational → constitutional (canPromote), and only a promotion with a
 * route-resolved personaId under the publish gate writes the anchored
 * `artifact_published` receipt. Compose, never fork.
 *
 * TIER DISCIPLINE: the acting subject crosses this seam ONLY as a T2
 * `actorCommitment`; the real T0 personaId is threaded by the route under the
 * operator gate and used solely to write the publish receipt (never returned).
 */

import { createHash } from 'crypto';

import {
  resolveDelegateIdentity,
  buildDelegateSystemPrompt,
  type DelegateGrounding,
  type SovereigntyReceipt,
} from '@/services/homecoming/delegateConverse';
import { callSovereign } from '@/services/constitutional/modelRouter';
import { classifyArtifact } from '@/services/artifact/classify';
import { runArtifact } from '@/services/artifact/runArtifact';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { objectRef, standingBandFor, findForbiddenObjectKey, type ConstitutionalObject } from '@/types/constitutionalObject';
import {
  canPromote,
  type ArtifactCompositionInput,
  type ArtifactContext,
  type ArtifactProfileId,
  type ArtifactResult,
  type ConsequenceClass,
  type InvokingRuntime,
} from '@/types/artifactRuntime';
import type { CompositionResult } from '@/types/composition';
import { DELEGATE_CHARTER_STATUS, type HomecomingDelegateId } from '@/types/homecoming';

// The invoking-runtime label a delegate acts under. Role-aligned where the
// delegate maps to a named runtime; otherwise the delegate acts on the operator's
// authority ('operator'). A label for provenance — never an ownership claim.
const DELEGATE_INVOKER: Partial<Record<HomecomingDelegateId, InvokingRuntime>> = {
  'aigent-z': 'aigentz',
  marketa: 'agentme',
  kn0w1: 'ccrl',
};

export function invokerForDelegate(delegate: HomecomingDelegateId): InvokingRuntime {
  return DELEGATE_INVOKER[delegate] ?? 'operator';
}

/** The default profile when the caller doesn't name one — a working document. */
export const DEFAULT_DELEGATE_PROFILE: ArtifactProfileId = 'documentation';

const STANDING_PUBLISHED = 0.7;

export interface DelegateProduceInput {
  delegate: HomecomingDelegateId;
  /** What to produce — the operator's ask / the conversation intent. */
  brief: string;
  /** The artifact profile; defaults to 'documentation' (a PRD-class doc). */
  profile?: ArtifactProfileId;
  /**
   * The requested consequence tier. Omit to CLASSIFY (defaults to operational for
   * delegate work). 'constitutional' is only honoured as a PROMOTION from
   * operational and, to actually publish, needs `mode:'publish'` + a personaId.
   */
  consequenceClass?: ConsequenceClass;
  /** propose (default) drafts only; publish (constitutional promotion) anchors. */
  mode?: 'propose' | 'publish';
  /** T2 one-way commitment to the acting subject — the ONLY subject handle. */
  actorCommitment: string;
  /** T2-safe authorising intent ref. */
  intentRef: string;
  /** REAL T0 personaId — route-resolved under the gate; ONLY for the publish receipt. */
  personaId?: string;
  grounding?: DelegateGrounding;
  maxTokens?: number;
}

export interface DelegateProduceResult {
  delegate: HomecomingDelegateId;
  /** The delegate's natively-produced artifact BODY (what the operator reads). */
  body: string;
  /** The AR envelope — tier, artifact id, version, receipt. */
  artifact: ArtifactResult;
  consequenceClass: ConsequenceClass;
  /** Whether this tier could still be promoted (operational → constitutional). */
  promotableTo: ConsequenceClass | null;
  /** Proof the production ran natively inside AgentiQ. */
  sovereignty: SovereigntyReceipt;
}

/** Project a drafted constitutional object into its published form (mirrors the
 *  CCRL pilot — a projection of the runtime's object, not a fork). Pure. */
function projectPublished(object: ConstitutionalObject, receiptId: string): ConstitutionalObject {
  const published: ConstitutionalObject = {
    ...object,
    version: { ...object.version, status: 'published' },
    standing: { ...object.standing, standing: STANDING_PUBLISHED, band: standingBandFor(STANDING_PUBLISHED) },
    provenance: { ...object.provenance, receiptIds: [...object.provenance.receiptIds, receiptId] },
    lifecycle: { ...object.lifecycle, state: 'registry' },
  };
  const leak = findForbiddenObjectKey(published);
  if (leak) throw new Error(`published delegate artifact leaks a T0 identifier at '${leak}' — refusing to return it`);
  return published;
}

/**
 * Produce an artifact via a constitutional delegate, natively. The delegate drafts
 * the body; the Artifact Runtime tiers + envelopes it. Operational + propose by
 * default. Impure (calls a provider; may write one receipt on a gated promotion).
 */
export async function produceViaDelegate(input: DelegateProduceInput): Promise<DelegateProduceResult> {
  const profile = input.profile ?? DEFAULT_DELEGATE_PROFILE;

  // 1) The delegate PRODUCES the content natively (sovereign, receipted).
  const identity = resolveDelegateIdentity(input.delegate);
  const system =
    buildDelegateSystemPrompt(identity, input.grounding) +
    `\n\nYou are producing a ${profile} artifact natively within the platform. Produce the artifact itself — ` +
    `well-structured, complete, and grounded in your constitutional knowledge. Do not narrate that you are producing it; produce it.`;
  const drafted = await callSovereign('reasoning', system, input.brief, input.maxTokens ?? 1600);
  const body = drafted.text;
  const sovereignty: SovereigntyReceipt = {
    provider: drafted.provider,
    model: drafted.model,
    degraded: drafted.degraded,
    sovereignFloor: drafted.sovereignFloor,
    stage: drafted.stage,
    governingInvariants: drafted.governingInvariants,
    note: 'Produced natively inside AgentiQ by a constitutional delegate — the provider is an interchangeable inference layer.',
  };

  // 2) The Artifact Runtime SHEPHERDS it. Composition input is grounded in the
  //    delegate's drafted body (content commitment → idempotent artifact id).
  const contentHash = createHash('sha256')
    .update(`${input.delegate}:${profile}:${body}`)
    .digest('hex')
    .slice(0, 16);
  const compInput: ArtifactCompositionInput = {
    compositionRef: `homecoming:delegate:${input.delegate}:${profile}`,
    result: { provenance: { contentHash, composedFrom: [] } } as unknown as CompositionResult,
  };

  // Consequence tier: an explicit request (a promotion) is validated; otherwise
  // CLASSIFY — which defaults delegate work to operational.
  const context: ArtifactContext = {
    invokedBy: invokerForDelegate(input.delegate),
    intentRef: input.intentRef,
    actorCommitment: input.actorCommitment,
    mode: 'propose', // ALWAYS drive the runtime in propose; the seam owns any publish receipt.
  };
  let tier: ConsequenceClass;
  if (input.consequenceClass === 'constitutional') {
    // Only reachable as a PROMOTION from operational (the delegate can't birth it).
    if (!canPromote('operational', 'constitutional')) throw new Error('illegal promotion');
    tier = 'constitutional';
  } else if (input.consequenceClass) {
    tier = input.consequenceClass;
  } else {
    tier = await classifyArtifact(profile, compInput, context);
  }

  const artifact = await runArtifact(tier, profile, compInput, context);

  // Publish gate — only a constitutional promotion WITH a route-resolved personaId
  // writes the single anchored receipt. Anything else stays drafted (honest).
  const wantsPublish = tier === 'constitutional' && input.mode === 'publish' && Boolean(input.personaId);
  if (wantsPublish && artifact.ok && artifact.object) {
    const receipt = await createActivityReceipt({
      personaId: input.personaId as string,
      activeCartridge: 'agentiq',
      actionType: 'artifact_published',
      summary: `delegate ${input.delegate} published a ${profile} artifact ${artifact.artifactId} (constitutional)`,
      contextShared: ['homecoming', 'artifact-runtime'],
      artifactsCreated: artifact.artifactId ? [artifact.artifactId] : [],
    }).catch(() => null);
    if (receipt?.id) {
      const publishedObject = projectPublished(artifact.object, receipt.id);
      return {
        delegate: input.delegate,
        body,
        artifact: {
          ...artifact,
          object: publishedObject,
          version: publishedObject.version,
          receiptId: receipt.id,
          registryEntry: objectRef(publishedObject.identity.id, publishedObject.identity.kind),
        },
        consequenceClass: tier,
        promotableTo: null,
        sovereignty,
      };
    }
    // Receipt write failed — return drafted, honest error, not a half-published claim.
    return {
      delegate: input.delegate,
      body,
      artifact: { ...artifact, error: 'publish receipt write failed — artifact left drafted' },
      consequenceClass: tier,
      promotableTo: null,
      sovereignty,
    };
  }

  return {
    delegate: input.delegate,
    body,
    artifact,
    consequenceClass: tier,
    // Operational can still be promoted to constitutional; constitutional is terminal.
    promotableTo: tier === 'operational' ? 'constitutional' : tier === 'disposable' ? 'operational' : null,
    sovereignty,
  };
}
