/**
 * Independent, read-only discovery and receipting of a genuine Verifiable
 * PnL correlation for a specific Horizen agent — deliberately kept as its
 * OWN state machine, separate from Pulse admission (operator directive,
 * 2026-08-08):
 *
 *   "We already have the authority chain for Aigent Nakamoto: Nakamoto ->
 *   token 8798 -> verified owner -> constitutional authorization. What
 *   remains unproven is the independent activation/operation of the P&L
 *   capability... Pulse Verified is sufficient to close Ratify. P&L
 *   verification is an independent, asynchronous capability transition and
 *   can occur when its first valid evidence arrives... Absence of optional
 *   downstream evidence must not invalidate already-proven upstream
 *   constitutional state."
 *
 * NEVER SUBMITS, REGISTERS, SIGNS, OR RE-ENROLLS. Makes exactly the read
 * this codebase already uses everywhere else for Horizen agent correlation
 * — `correlateAgent` (services/horizen/correlate.ts), which itself calls
 * only `fetchRegistryAgent`/`fetchPnlCorrelation` (GET requests, no partner
 * mutation possible — see services/horizen/client.ts's own header). Never a
 * second PnL-reading implementation (inv.engineering.036/037).
 *
 * ── WHY A NEW RECEIPT TYPE, NOT AN EXISTING ONE ─────────────────────────────
 *
 * - `partner_agent_evidence_recorded` (services/horizen/operatorClaim.ts) is
 *   the receipt for an IDENTITY-BINDING claim — a different constitutional
 *   question (who may exercise Standing for this agent) requiring a resolved
 *   attribution binding this function's question does not need. Reusing it
 *   here would overload an already-settled meaning.
 * - `horizen_pnl_transparency_enabled` (services/horizen/agentCardEnrichment.ts)
 *   is issued UNCONDITIONALLY alongside Pulse confirmation — it represents
 *   "disclosure scope was authorized", a materially WEAKER claim than what
 *   this function asserts: that Horizen's own Verifiable-PnL service has
 *   independently produced and correlated a PnL record for this exact
 *   agent/token/chain. Conflating the two would misrepresent an authorization
 *   as an operation.
 *
 * `pnl_service_verified` is therefore additive, alongside both, never
 * replacing either — the same discipline this session's Pulse work already
 * established for `pulse_enrollment_verified`/`pulse_commitment_verified`
 * alongside `horizen_pulse_authorized`.
 *
 * EVIDENCE-PENDING, NEVER A REFUSAL THAT BLOCKS ANYTHING. A negative,
 * unreadable, or unattributable correlation result returns
 * `evidencePending: true` naming which open Horizen contract question is
 * unanswered — it never touches Pulse/Journey state, and it is not treated
 * as a denial of anything already constitutionally established upstream.
 */

import { createHash } from 'crypto';
import { correlateAgent, type HorizenAgentRecord } from './correlate';
import type { HorizenNetwork } from './identity';
import type { HorizenClientOptions } from './client';

const PNL_VERIFIER_POLICY_VERSION = 'gjr-vfy-001-pnl-independent-v1';

export interface PnlServiceEvidence {
  aigentQubeId: string;
  network: HorizenNetwork;
  tokenId: string;
  pnlUuid: string;
  pnlStatus: string | null;
  erc8004Chain: string | null;
  identityClass: string;
  sourceResponseCommitment: string;
  verifiedAt: string;
  verifierPolicyVersion: string;
}

export type PnlServiceVerificationResult =
  | { ok: true; verified: true; alreadyVerified: boolean; receiptRef: string | null; evidence: PnlServiceEvidence }
  | {
      ok: true;
      verified: false;
      evidencePending: true;
      reason: 'NOT_FOUND' | 'READ_FAILED' | 'IDENTITY_UNCONFIRMED' | 'CHAIN_MISMATCH';
      detail: string;
      openContractQuestion: string;
    };

/**
 * "What remains unproven is the independent activation/operation of the P&L
 * capability" — the exact open question this module cannot answer on its
 * own behalf; carried on every evidence-pending result so a reader always
 * sees WHY, not just that nothing was found.
 */
const OPEN_CONTRACT_QUESTION =
  'Whether Horizen\'s single enable_pulse_monitoring call genuinely activates the Verifiable PnL service, or only ' +
  'authorizes disclosure scope while the PnL service itself must be separately onboarded/produced on Horizen\'s side ' +
  '(brief §3.5: a 404 on /v1/erc8004/{tokenId} means "this tokenId has no PnL agent" — not an error, a fact).';

export async function discoverAndReceiptPnlServiceEvidence(
  args: {
    aigentQubeId: string;
    /** Decimal tokenId or hex registry alias — correlateAgent/fetchRegistryAgent normalize either. */
    subjectRegistryAlias: string;
    network: HorizenNetwork;
    actorPersonaId: string;
    /** Required — the sole idempotency key (findAgentReceiptRefs by agent). */
    runtimeAgentId: string;
  },
  clientOptions: HorizenClientOptions = {},
): Promise<PnlServiceVerificationResult> {
  const { findAgentReceiptRefs, createActivityReceipt, getActivityReceiptActionInput } = await import(
    '@/services/receipts/activityReceiptService'
  );

  const existing = await findAgentReceiptRefs(args.runtimeAgentId, ['pnl_service_verified'], { limit: 1 });
  if (existing.length > 0) {
    const actionInput = await getActivityReceiptActionInput(existing[0].id);
    const evidence = (actionInput?.evidence ?? null) as PnlServiceEvidence | null;
    if (evidence) {
      return { ok: true, verified: true, alreadyVerified: true, receiptRef: existing[0].id, evidence };
    }
    // A receipt id exists but its evidence could not be read back — fall
    // through to a fresh correlation rather than reporting stale success.
  }

  const correlated = await correlateAgent(args.subjectRegistryAlias, args.network, clientOptions);
  if (!correlated.ok) {
    return {
      ok: true,
      verified: false,
      evidencePending: true,
      reason: 'READ_FAILED',
      detail: `correlateAgent failed: ${correlated.reason} — ${correlated.detail}`,
      openContractQuestion: OPEN_CONTRACT_QUESTION,
    };
  }

  const record: HorizenAgentRecord = correlated.record;
  if (!record.pnl.present) {
    return {
      ok: true,
      verified: false,
      evidencePending: true,
      reason: 'NOT_FOUND',
      detail: `no Verifiable PnL correlation exists for tokenId ${record.identity.tokenId} on ${args.network} (${record.pnl.reason}: ${record.pnl.detail})`,
      openContractQuestion: OPEN_CONTRACT_QUESTION,
    };
  }

  // Provenance: only a confirmed ERC-8004 on-chain identity counts — a
  // service-onboarded/catalogue/unknown identity class is explicitly NOT
  // confirmed as this token, per correlate.ts's own on-chain-confirmation gate.
  if (record.identity.identityClass !== 'on-chain') {
    return {
      ok: true,
      verified: false,
      evidencePending: true,
      reason: 'IDENTITY_UNCONFIRMED',
      detail: `identityClass="${record.identity.identityClass}" — not confirmed as an ERC-8004 on-chain token, so a PnL correlation record cannot be attributed to it with confidence`,
      openContractQuestion: OPEN_CONTRACT_QUESTION,
    };
  }

  // Chain agreement: the PnL service's own erc8004Chain claim, when present,
  // must agree with the network this correlation was read on — a genuine
  // disagreement is a provenance failure, never silently resolved.
  const erc8004Chain = record.pnl.value.erc8004Chain;
  if (erc8004Chain && erc8004Chain !== args.network) {
    return {
      ok: true,
      verified: false,
      evidencePending: true,
      reason: 'CHAIN_MISMATCH',
      detail: `PnL correlation reports erc8004Chain="${erc8004Chain}" but this read was against "${args.network}" — refusing to attribute a cross-chain claim without independent confirmation`,
      openContractQuestion: OPEN_CONTRACT_QUESTION,
    };
  }

  const evidence: PnlServiceEvidence = {
    aigentQubeId: args.aigentQubeId,
    network: args.network,
    tokenId: record.identity.tokenId,
    pnlUuid: record.pnl.value.uuid,
    pnlStatus: record.pnl.value.status,
    erc8004Chain,
    identityClass: record.identity.identityClass,
    sourceResponseCommitment: createHash('sha256').update(JSON.stringify(record)).digest('hex'),
    verifiedAt: new Date().toISOString(),
    verifierPolicyVersion: PNL_VERIFIER_POLICY_VERSION,
  };

  let receiptRef: string | null = null;
  try {
    const receipt = await createActivityReceipt({
      personaId: args.actorPersonaId,
      activeCartridge: 'agentiq',
      actionType: 'pnl_service_verified',
      summary: `Verified independent Verifiable PnL correlation for ${args.aigentQubeId} (token ${record.identity.tokenId}, ${args.network})`,
      agentsInvoked: [args.runtimeAgentId],
      actionInput: { aigentQubeId: args.aigentQubeId, evidence },
    });
    receiptRef = receipt?.id ?? null;
  } catch {
    // Surfaced only via a null receiptRef — never blocks or throws; the
    // caller can retry the discovery, which is idempotent by construction.
  }

  return { ok: true, verified: true, alreadyVerified: false, receiptRef, evidence };
}
