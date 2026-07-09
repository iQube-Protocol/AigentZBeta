/**
 * Deployment as a Constitutional Object (Chrysalis Phase 3 prep, CFS-016).
 *
 * Aigent Z OWNS the deployment lifecycle as a first-class constitutional object
 * — but native deployment EXECUTION stays HUMAN under CFS-016 D1 (the D1→D2 gate
 * is time-gated on D1 operating history). This module advances the OBJECT MODEL
 * + OWNERSHIP, NOT native execution.
 *
 * It is a PURE, COMPOSE-NOT-FORK descriptor source: it reads the deployment
 * state that ALREADY exists at D1 — the `deployment_proposed` /
 * `deployment_authorized` receipts (services/receipts/activityReceiptService.ts
 * ActivityActionType) and the CDE `constitutionalThresholdMet` consequence-test
 * gate (services/devCommandCenter/devLoop.ts) — and expresses it against the P0
 * object model (`types/constitutionalObject.ts`): identity · version · standing ·
 * authority · ownership · provenance · lifecycle · dependencies.
 *
 * CRITICAL — this module RECORDS lifecycle + ownership; it MUST NOT:
 *   - execute a deploy, push a branch, or touch the amplify trigger,
 *   - call a canister, DVN, or any I/O,
 *   - write a receipt (execution + receipts stay in their existing human-gated
 *     paths: the /api/constitutional/deployment-proposal + deployment-
 *     authorization routes, and the human push at D1).
 * The `executed` lifecycle state is GATED ON CFS-016 D2 (`deployment_executed`).
 * Today (D1) a deploy is HUMAN-EXECUTED; the object records the AUTHORIZATION,
 * it does NOT execute. `advanceDeployment(obj, 'executed')` therefore only
 * RECORDS that a human executed — it runs no deploy.
 *
 * Tier discipline: ownership is a platform / Aigent-Z steward COMMITMENT
 * (one-way, T2-safe) — NEVER a personaId. T0 identifiers are structurally
 * inexpressible (findForbiddenObjectKey pins it in the canary).
 *
 * Server-safe: node crypto for the T2-safe commitments; no clock, no
 * randomness, no React, no DB, no network.
 */

import { createHash } from 'crypto';
import type {
  ConstitutionalObject,
  ObjectRef,
  ObjectVersionStatus,
} from '@/types/constitutionalObject';
import {
  objectRef,
  standingBandFor,
  isLegalObjectTransition,
} from '@/types/constitutionalObject';

// ─────────────────────────────────────────────────────────────────────────
// Lifecycle — the CFS-016 deployment authority ladder, expressed as states
// ─────────────────────────────────────────────────────────────────────────

/**
 * The deployment lifecycle, in order. Mirrors the CFS-016 receipt taxonomy:
 *   proposed   → `deployment_proposed`  (D1: the proposal becomes constitutional)
 *   authorized → `deployment_authorized`(D1 CDE: consequence-test-before-deploy)
 *   executed   → `deployment_executed`  (D2+: execution transfers to Aigent Z)
 * At D1 the `executed` state is reached by a HUMAN push; the object only records
 * it. Legality is one-step-forward-or-re-enter (isLegalObjectTransition): a
 * deployment can NEVER jump proposed→executed (skipping authorization) and can
 * NEVER move backward.
 */
export const DEPLOYMENT_LIFECYCLE = ['proposed', 'authorized', 'executed'] as const;
export type DeploymentState = (typeof DEPLOYMENT_LIFECYCLE)[number];

// ─────────────────────────────────────────────────────────────────────────
// Commitments — T2-safe, deterministic, one-way (no T0 ever enters here)
// ─────────────────────────────────────────────────────────────────────────

/** A one-way T2-safe commitment over a namespaced key (canonicalAssets pattern). */
export function deploymentCommitment(namespace: string, key: string): string {
  return createHash('sha256').update(`${namespace}:${key}`).digest('hex').slice(0, 16);
}

/** Deterministic content commitment over a stable, canonically-serialised body. */
function contentCommitment(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16);
}

/**
 * The steward that OWNS the deployment lifecycle — a COMMITMENT, never a
 * personaId. Aigent Z owns the OBJECT (proposal/authorization/lifecycle
 * bookkeeping); it does NOT hold execution authority at D1. Deterministic so
 * re-deriving the same deployment yields the same owner commitment (idempotent).
 */
export const AIGENT_Z_DEPLOYMENT_STEWARD_COMMITMENT = deploymentCommitment(
  'deployment-steward',
  'aigent-z',
);

// ─────────────────────────────────────────────────────────────────────────
// Input — the EXISTING CFS-016 deployment state/receipts (compose, do not fork)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The already-existing D1 deployment facts this module reads. Every field is a
 * T1/T2-safe value produced by the existing CFS-016 surfaces — object ids,
 * receipt ids, commit range, and the CDE consequence-test verdict. NO T0
 * identifier is accepted or expressible here.
 */
export interface DeploymentObjectInput {
  /** A stable OBJECT id for this deployment (e.g. the implementation pack id or
   *  a deployment slug). An object id — NEVER a personaId. */
  deploymentId: string;
  /** T1 display label (optional). */
  displayLabel?: string;
  /** The implementation pack this deployment ships (dependency edge). */
  packId?: string;
  /** The commit range being deployed (T2-safe text). */
  commitRange?: string;
  /** T1 goal excerpt for display. */
  goal?: string;
  /** The `deployment_proposed` receipt id (D1) — present once proposed. */
  proposedReceiptId?: string;
  /** The `deployment_authorized` receipt id (D1 CDE) — present once authorized. */
  authorizedReceiptId?: string;
  /** The `deployment_executed` receipt id (D2+) — present only once a HUMAN
   *  executed the deploy at D1 (or Aigent Z at a ratified D2). Its presence
   *  RECORDS execution; this module never produces it. */
  executedReceiptId?: string;
  /** The CDE consequence-test gate: constitutionalThresholdMet(state). Authoriz-
   *  ation is only legitimate when true (services/devCommandCenter/devLoop.ts). */
  constitutionalThresholdMet: boolean;
  /** CFS-016 hard-boundary-2 flag: does any diff touch protected files? */
  touchesProtectedFiles?: boolean;
  /** Override the steward commitment (still a COMMITMENT, never a persona id).
   *  Defaults to the Aigent Z deployment steward. */
  stewardCommitment?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Derivations — pure mappings from state → object facets
// ─────────────────────────────────────────────────────────────────────────

/** The lifecycle state implied by which receipts exist. Highest reached wins;
 *  legality is enforced separately (advanceDeployment). */
export function deploymentStateFor(input: DeploymentObjectInput): DeploymentState {
  if (input.executedReceiptId) return 'executed';
  if (input.authorizedReceiptId) return 'authorized';
  return 'proposed';
}

/** Standing score by lifecycle progress. Deployment standing is progress, not
 *  editorial maturity: a proposed deploy is experimental; an authorized one has
 *  passed the consequence test (validated); an executed one is canonical. */
const STANDING_BY_STATE: Record<DeploymentState, number> = {
  proposed: 0.2, // standingBandFor → 'experimental'
  authorized: 0.5, // standingBandFor → 'validated'
  executed: 0.7, // standingBandFor → 'canonical'
};

/** Version status by lifecycle state (the ObjectVersion crosswalk). */
const VERSION_STATUS_BY_STATE: Record<DeploymentState, ObjectVersionStatus> = {
  proposed: 'draft',
  authorized: 'active',
  executed: 'published',
};

// ─────────────────────────────────────────────────────────────────────────
// The builder — compose a Deployment ConstitutionalObject from CFS-016 state
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build a Deployment `ConstitutionalObject` from the existing CFS-016 D1 state.
 * Pure — no I/O, no receipt writes, no execution. The returned object RECORDS
 * the lifecycle + ownership; downstream registries/composition read it.
 */
export function buildDeploymentObject(input: DeploymentObjectInput): ConstitutionalObject {
  const state = deploymentStateFor(input);
  const standingScore = STANDING_BY_STATE[state];

  // receiptIds in lifecycle order (only those that exist). These are the
  // provenance the object carries — proof the transitions actually happened.
  const receiptIds = [
    input.proposedReceiptId,
    input.authorizedReceiptId,
    input.executedReceiptId,
  ].filter((r): r is string => typeof r === 'string' && r.length > 0);

  // The payload is T1/T2-safe: object ids, commit range, verdicts, flags. It
  // carries NO T0 identifier and no execution capability — only a record.
  const payload = {
    ladderLevel: 'D1' as const,
    packId: input.packId ?? null,
    commitRange: input.commitRange ?? null,
    goal: input.goal ?? null,
    constitutionalThresholdMet: input.constitutionalThresholdMet,
    touchesProtectedFiles: input.touchesProtectedFiles === true,
    // The human-execution gate, stated on the object itself.
    executionGate:
      'EXECUTION STAYS HUMAN under CFS-016 D1. This object RECORDS the ' +
      'proposal + authorization; it does not execute. The `executed` state is ' +
      'gated on CFS-016 D2 (deployment_executed) — human-executed today.',
  };

  const dependencies: ObjectRef[] = [];
  if (input.packId) dependencies.push(objectRef(input.packId, 'specification'));

  return {
    identity: {
      id: input.deploymentId,
      kind: 'deployment',
      ref: deploymentCommitment('deployment', input.deploymentId),
      displayLabel: input.displayLabel ?? `Deployment ${input.deploymentId}`,
    },
    version: { version: 1, status: VERSION_STATUS_BY_STATE[state] },
    standing: {
      standing: standingScore,
      band: standingBandFor(standingScore),
      reach: 1,
    },
    authority: {
      minStandingToCompose: 'validated',
      // A deploy is a consequence-bearing act (Law XI): authorization ALWAYS
      // requires explicit per-deploy operator ratification, gated on the
      // consequence test (constitutionalThresholdMet). Never blanket, never
      // standing — reflected here as an always-required ratification.
      ratificationRequired: true,
      // The constitutional basis: CFS-016 (the deployment ladder) + the CDE
      // consequence-test gate that authorizes a deploy.
      governingInvariants: ['CFS-016', 'CFS-020'],
    },
    ownership: {
      // Aigent Z OWNS the object — a steward COMMITMENT, never a personaId.
      ownerCommitment: input.stewardCommitment ?? AIGENT_Z_DEPLOYMENT_STEWARD_COMMITMENT,
    },
    provenance: {
      receiptIds,
      contentCommitment: contentCommitment(payload),
      // Composed over the existing CFS-016 receipts — not forked, not authored.
      source: 'composed',
    },
    lifecycle: { state, order: DEPLOYMENT_LIFECYCLE },
    dependencies,
    payload,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// advanceDeployment — pure, legal-only lifecycle transition (records, never executes)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Advance a Deployment object to `toState`. REFUSES an illegal jump (throws):
 * legality is `isLegalObjectTransition` over DEPLOYMENT_LIFECYCLE — one step
 * forward (proposed→authorized→executed) or re-entering the current state. A
 * skip (proposed→executed) or a backward move is refused.
 *
 * CRITICAL — this only RECORDS the transition on the object; it EXECUTES NOTHING.
 * Reaching `executed` at D1 means a HUMAN pushed; the object notes it. The
 * `executed` transition is gated on CFS-016 D2 for AGENT execution — this
 * function never deploys, pushes, or writes a receipt. Pure — returns a new
 * object, does not mutate the input.
 */
export function advanceDeployment(
  obj: ConstitutionalObject,
  toState: DeploymentState,
): ConstitutionalObject {
  const from = obj.lifecycle.state;
  if (!isLegalObjectTransition(DEPLOYMENT_LIFECYCLE, from, toState)) {
    throw new Error(
      `illegal deployment transition: ${from} → ${toState}. Legal moves are one ` +
        `step forward in [${DEPLOYMENT_LIFECYCLE.join(' → ')}] or re-entering the ` +
        `current state. A deployment can never reach 'executed' without an ` +
        `'authorized' predecessor (CFS-016), and never move backward.`,
    );
  }

  const nextState = toState;
  const standingScore = STANDING_BY_STATE[nextState];
  return {
    ...obj,
    version: { ...obj.version, status: VERSION_STATUS_BY_STATE[nextState] },
    standing: {
      ...obj.standing,
      standing: standingScore,
      band: standingBandFor(standingScore),
    },
    lifecycle: { ...obj.lifecycle, state: nextState },
  };
}
