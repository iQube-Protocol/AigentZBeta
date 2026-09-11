/**
 * The operator-claim orchestration — I/O layer for the pure ceremony in
 * `services/horizen/agentBinding.ts`.
 *
 * Per that module's own header (§9, "Signature RECOVERY is deliberately not
 * here"): the pure model refuses to touch a network, a database, or a
 * signature-recovery primitive so the whole claim ceremony stays testable
 * offline. This file is the seam that DOES those three things, and does
 * nothing else:
 *
 *   1. Recovers the signer of the presented claim message — reusing
 *      `verifyEvmOwnership` (services/identity/walletAliasService.ts), the
 *      platform's ONE EVM-signature-recovery primitive (the same one
 *      `connectionChallenge.ts`'s `verifyConnectionProof` uses). No second
 *      signature-verification implementation is defined here
 *      (inv.engineering.036/037).
 *   2. Persists the resulting binding via `persistAgentIdentityBinding`
 *      (services/delegation/delegationGrantStore.ts) — the existing durable
 *      home for `agent_identity_bindings` rows.
 *   3. Records the binding as a metaMe constitutional evidence record
 *      (`createActivityReceipt` with `HORIZEN_EVIDENCE_ACTION_TYPE`) and
 *      enqueues the existing DVN anchor pipeline — `enqueueActivityReceiptAnchor`
 *      is called, never modified (CLAUDE.md's DVN Pipeline Protection: the
 *      only unilateral change permitted there is adding an action type to
 *      `ANCHORABLE_ACTION_TYPES`, and `partner_agent_evidence_recorded` is
 *      already present).
 *
 * ── WHAT THIS MODULE DOES NOT DO ────────────────────────────────────────────
 *
 * It does not broadcast a Base Sepolia registration transaction, and it does
 * not read Horizen's live Registry/Pulse/PnL endpoints. The `tokenId` it binds
 * against is a CALLER-SUPPLIED value from an already-completed, real Horizen
 * registration — inventing one here would be exactly the guess CLAUDE.md
 * forbids. See `codexes/packs/agentiq/updates/
 * 2026-07-30_moneypenny-horizen-presence-and-external-agent-admission.md` for
 * the documented, currently-blocked registration step this module composes
 * with once that tokenId exists.
 *
 * ── TWO-PHASE FLOW ──────────────────────────────────────────────────────────
 *
 *   1. `buildOperatorClaimMessage(...)` — server computes the exact byte-for-
 *      byte message (via `buildAgentClaimMessage`) the operator's wallet must
 *      sign. Returned to the caller for signing; nothing is persisted yet.
 *   2. `performOperatorAgentClaim(...)` — caller presents the signature over
 *      that exact message. This function re-verifies the signature, re-runs
 *      `bindAgentIdentity`'s own re-verification of the claim message against
 *      the identity being bound, persists the binding, and writes the
 *      attributable receipt.
 */

import { randomUUID } from 'crypto';
import { verifyEvmOwnership } from '@/services/identity/walletAliasService';
import { personaPublicRef, constitutionalRef } from '@/services/identity/personaReferences';
import {
  bindAgentIdentity,
  currentIdentityRegistry,
  buildAgentClaimMessage,
  AGENT_CLAIM_PURPOSE,
  type AgentClaimMessageInput,
  type AgentControlProof,
  type ConstitutionalAct,
  type AgentIdentityBinding,
  type ClaimRefusal,
  type ClaimMessageFailure,
} from './agentBinding';
import { normalizeAgentIdentity, type HorizenNetwork, type NormalizeFailure } from './identity';
import { persistAgentIdentityBinding } from '@/services/delegation/delegationGrantStore';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { enqueueActivityReceiptAnchor } from '@/services/dvn/activityReceiptDvnPipeline';

/** Everything needed to construct the message the operator's wallet signs. */
export interface OperatorClaimMessageRequest {
  runtime: string;
  environment: string;
  origin: string;
  network: HorizenNetwork;
  /** Decimal tokenId from a real, already-completed Horizen registration. */
  tokenId: string;
  ownerWallet: string;
  /** The caller's OWN persona/passport — spine-resolved, never another's. */
  personaId: string;
  passportId: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

export type BuildClaimMessageResult =
  | { ok: true; message: string; claimExpectation: AgentClaimMessageInput }
  | { ok: false; reason: NormalizeFailure };

/**
 * Phase 1 — build the exact message to present for signing. Pure (no I/O):
 * the caller decides when to actually ask the wallet to sign.
 */
export function buildOperatorClaimMessage(req: OperatorClaimMessageRequest): BuildClaimMessageResult {
  const normalized = normalizeAgentIdentity({ agentId: req.tokenId, network: req.network, source: 'on-chain' });
  if (!normalized.ok) return { ok: false, reason: normalized.reason };

  const claimExpectation: AgentClaimMessageInput = {
    runtime: req.runtime,
    environment: req.environment,
    origin: req.origin,
    purpose: AGENT_CLAIM_PURPOSE,
    network: req.network,
    chainId: normalized.identity.chainId,
    identityRegistry: currentIdentityRegistry(req.network),
    tokenId: normalized.identity.tokenId,
    ownerWallet: req.ownerWallet,
    principalRef: personaPublicRef(req.personaId),
    passportRef: constitutionalRef('passport', req.passportId),
    nonce: req.nonce,
    issuedAt: req.issuedAt,
    expiresAt: req.expiresAt,
  };

  return { ok: true, message: buildAgentClaimMessage(claimExpectation), claimExpectation };
}

/** Phase 2 input — the signed message plus the constitutional-act fields. */
export interface PerformOperatorClaimInput {
  bindingId?: string;
  agentRootDid: string;
  claimExpectation: AgentClaimMessageInput;
  /** The exact message that was presented in phase 1. */
  message: string;
  signature: string;
  delegationGrantId: string;
  claimedRelationship: boolean;
  acceptedResponsibility: boolean;
  scopeDefined: boolean;
  /** From delegationGrantStore — NOT inferred from a successful bind. */
  delegationActive: boolean;
  /** From the Financial Services Runtime — admission is granted, not inherited. */
  runtimeAdmissionEligible?: boolean;
  now: string;
  /** T0 — never serialised past this call. Used to write the receipt. */
  personaId: string;
  passportId: string;
  /** Receipt bookkeeping. */
  sessionId?: string | null;
  activeCartridge?: string;
}

export type PerformClaimFailure =
  | { ok: false; reason: 'signature-recovery-failed' }
  | { ok: false; reason: ClaimRefusal | ClaimMessageFailure }
  | { ok: false; reason: 'receipt-write-failed'; detail: string };

export type PerformClaimResult =
  | { ok: true; binding: AgentIdentityBinding; receiptId: string | null }
  | PerformClaimFailure;

/**
 * Phase 2 — verify the signature, run the pure `bindAgentIdentity` ceremony,
 * persist the binding, and write the attributable receipt (enqueuing the
 * existing DVN anchor pipeline — never modifying it).
 */
export async function performOperatorAgentClaim(
  input: PerformOperatorClaimInput,
): Promise<PerformClaimResult> {
  const { claimExpectation } = input;

  // Step 1 — recover the signer. The ONE EVM signature primitive on the
  // platform (services/identity/walletAliasService.ts), reused rather than
  // forked, per agentBinding.ts's own instruction.
  const signatureValid = verifyEvmOwnership(claimExpectation.ownerWallet, input.message, input.signature);
  if (!signatureValid) return { ok: false, reason: 'signature-recovery-failed' };

  const normalized = normalizeAgentIdentity({
    agentId: claimExpectation.tokenId,
    network: claimExpectation.network,
    source: 'on-chain',
  });
  if (!normalized.ok) return { ok: false, reason: 'claim-message-not-bound' };

  const agentControlProof: AgentControlProof = {
    ownerAddress: claimExpectation.ownerWallet,
    ownerObservation: 'registry_read',
    claimMessage: input.message,
    nonce: claimExpectation.nonce,
    signatureCommitment: constitutionalRef('agent-claim-signature', input.signature),
    verifiedAt: input.now,
  };

  const constitutionalAct: ConstitutionalAct = {
    personaId: input.personaId,
    passportId: input.passportId,
    delegationGrantId: input.delegationGrantId,
    claimedRelationship: input.claimedRelationship,
    acceptedResponsibility: input.acceptedResponsibility,
    scopeDefined: input.scopeDefined,
    actedAt: input.now,
    receiptId: null,
  };

  const bound = bindAgentIdentity({
    bindingId: input.bindingId ?? randomUUID(),
    agentRootDid: input.agentRootDid,
    identity: normalized.identity,
    agentControlProof,
    constitutionalAct,
    claimExpectation,
    delegationActive: input.delegationActive,
    runtimeAdmissionEligible: input.runtimeAdmissionEligible ?? false,
    now: input.now,
  });
  if (!bound.ok) return { ok: false, reason: bound.reason };

  // Persist — best-effort/soft-fail internally (delegationGrantStore's own
  // discipline); a missing migration must not crash the ceremony.
  await persistAgentIdentityBinding(bound.binding);

  // Attributable receipt — T2-safe payload only (bindingRefs' commitments),
  // never the raw personaId/passportId/delegationGrantId/agentRootDid.
  let receiptId: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: input.personaId,
      sessionId: input.sessionId ?? null,
      activeCartridge: input.activeCartridge ?? 'agentiq-os-cartridge',
      actionType: 'partner_agent_evidence_recorded',
      summary: `Operator claim: agent bound to ${claimExpectation.network} tokenId ${claimExpectation.tokenId} (registry ${claimExpectation.identityRegistry})`,
      agentsInvoked: [input.agentRootDid],
    });
    receiptId = receipt?.id ?? null;
    if (receipt && receiptId) {
      enqueueActivityReceiptAnchor(receipt, input.personaId);
    }
  } catch (e) {
    return { ok: false, reason: 'receipt-write-failed', detail: e instanceof Error ? e.message : String(e) };
  }

  return { ok: true, binding: bound.binding, receiptId };
}
