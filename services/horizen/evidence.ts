/**
 * Horizen → metaMe constitutional evidence.
 *
 * Operator ruling, 2026-07-28 (Aletheon §7): "Wire `correlateAgent` into the
 * existing DVN evidence pipeline to emit a **metaMe constitutional evidence
 * record**, then surface the normalized object in the Horizen Partner
 * Workspace."
 *
 * NAMING, per the same ruling: **metaProof is the corporate and partnership
 * entity; metaMe is the operating runtime.** The record emitted here is a
 * metaMe constitutional evidence record produced under the metaProof ×
 * Horizen Labs partnership. Do not rename these to each other.
 *
 * ── WHAT THIS CLOSES ───────────────────────────────────────────────────────
 *
 * The attributable chain (Aletheon §9):
 *
 *     Horizen Registry record + Pulse / validation evidence
 *       → normalized network-qualified agent identity
 *       → metaMe constitutional evidence record
 *       → Horizen Partner Workspace
 *
 * ── THE PRESERVATION RULE (ruling §7, non-negotiable) ──────────────────────
 *
 * "Preserve every network, identity, proof and retrieval identifier in the
 * emitted evidence. **Do not flatten the Agent Registry, Pulse and PnL
 * identity spaces.**"
 *
 * Every field the ruling enumerates is carried explicitly and separately:
 * network + chainId, canonical tokenId, registry alias, Pulse alias, identity
 * class, Agent Card commitment, validation tag + status, validator/gateway
 * address, zkVerify tx/attestation ids, Pulse enrollment + commitment status,
 * correlation verdict, retrieval timestamp, source endpoints.
 *
 * `registryProfileNetwork`, `erc8004IdentityChain` and `proofChain` are THREE
 * SEPARATE FIELDS (ruling §2), because the brief's own PnL example shows a
 * Mainnet registry profile alongside `erc8004Chain: "base-sepolia"` and it is
 * not yet established which is authoritative. Collapsing them would bake in an
 * assumption the operator explicitly refused to make: "Do not infer that they
 * are equal. Do not merge two records solely because their token IDs or names
 * look related."
 *
 * ── WHY THE CARD IS A COMMITMENT, NOT A COPY ───────────────────────────────
 *
 * The Agent Card is third-party, user-authored JSON of unbounded size
 * (agentCard.ts caps decoding at 256 KB). A receipt is a durable,
 * DVN-anchorable record, so the card enters as a **sha256 commitment** — it
 * proves WHICH card was seen without copying its bytes into tamper-evident
 * memory, and it is what makes a later card edit (`setAgentURI`, brief §9
 * stage 7) detectable as a change rather than invisible.
 *
 * ── T2 DISCIPLINE ──────────────────────────────────────────────────────────
 *
 * Nothing here carries a personaId. The caller supplies one to
 * `createActivityReceipt`, which is the spine's existing boundary; the
 * evidence PAYLOAD is entirely about the external agent (chain identifiers,
 * public addresses, public tx hashes) and contains no metaMe identifier at
 * all. Owner/validator addresses are public chain data, not PII.
 */

import { createHash } from 'crypto';

import type { HorizenAgentRecord } from './correlate';
import {
  HORIZEN_REGISTRY_API,
  HORIZEN_PULSE_BASE,
  HORIZEN_PNL_BASE,
} from './client';

/**
 * The partnership this evidence is produced under. Recorded on the evidence so
 * a reader can attribute it without consulting a separate table.
 *
 * Contacts are operator-supplied (2026-07-28) and deliberately NOT modelled as
 * a formal escalation matrix — the operator's ruling: "Do not impose a formal
 * escalation matrix; the handoff is intentionally fluid, with Luca escalating
 * to John where appropriate."
 */
export const HORIZEN_PARTNERSHIP = {
  partner: 'Horizen Labs',
  /** metaProof is the partnership entity; metaMe is the runtime (ruling §7). */
  counterparty: 'metaProof',
  pilotId: 'horizen-pilot-series-001',
  contacts: [
    {
      name: 'John Camardo',
      role: 'CTO — primary technical lead',
      scope: 'Registry, Pulse, Verifiable PnL, architecture, integration, infrastructure',
    },
    {
      name: 'Luca Cermelli',
      role: 'Operations Lead — first operational point of contact',
      scope: 'Pilot activities, delivery cadence, scheduling, follow-through; escalates to John where appropriate',
    },
  ],
} as const;

/**
 * The DVN-anchorable action type for this evidence.
 *
 * Adding a member to `ANCHORABLE_ACTION_TYPES` is the ONLY change CLAUDE.md
 * permits in the DVN pipeline without prior operator approval ("It does not
 * modify the submission mechanism, state machine, or canister interaction"),
 * and the operator's ruling §7 explicitly directs this evidence into that
 * pipeline. Nothing else in the pipeline is touched.
 */
export const HORIZEN_EVIDENCE_ACTION_TYPE = 'partner_agent_evidence_recorded';

/** The evidence payload. One field per identifier the ruling requires. */
export interface HorizenEvidenceRecord {
  partner: string;
  pilotId: string;

  // ── Identity, unflattened (ruling §2) ──
  /** The network whose Registry profile was actually read. */
  registryProfileNetwork: string;
  /** The chain the ERC-8004 identity is claimed on. May differ — do not merge. */
  erc8004IdentityChain: string;
  /**
   * The chain the PROOF was recorded on. Null when no PnL correlation exists;
   * §7 of the brief pins PnL proofs to Base Mainnet independently of identity.
   */
  proofChain: string | null;
  chainId: number;
  /** Canonical ERC-8004 tokenId, decimal string (§3.1 join key). */
  tokenId: string;
  registryAlias: string;
  pulseAlias: string;
  pnlUuid: string | null;
  /** on-chain | service-onboarded | catalogue | unknown (§2.4.2/§2.4.3). */
  identityClass: string;

  // ── The card ──
  /** sha256 of the parsed card, or null when unresolved/invalid. */
  agentCardCommitment: string | null;
  agentCardStatus: string;

  // ── Proof + validation ──
  validationTag: string | null;
  validationStatus: string | null;
  /** §3.3 — the gateway proxy, i.e. NOT a self-report. */
  validatorAddress: string | null;
  zkVerifyTxHash: string | null;
  zkVerifyBlockHash: string | null;
  /** §3.4 — the zkVerify aggregation id from the SLA proof. */
  zkVerifyAttestationId: string | null;
  /** §3.4 — the Base tx that recorded the SLA proof. */
  adapterTxHash: string | null;

  // ── Pulse ──
  pulseEnrolled: boolean;
  /** §3.3 — what lets SLA proofs finalise at all. */
  pulseCommitmentRecorded: boolean | null;

  // ── Provenance of the read itself ──
  correlationVerified: boolean;
  correlationNotes: string[];
  /** Caller-supplied ISO timestamp — never invented here (testability). */
  retrievedAt: string;
  sourceEndpoints: string[];
  /** §5.1 — false means a read reported a warming cache. */
  ready: boolean;
}

/** sha256 of a stable JSON projection of the parsed card. */
function commitCard(record: HorizenAgentRecord): string | null {
  const card = record.registry.card;
  if (card.status !== 'parsed') return null;
  // Key order is fixed by construction, so the same card always commits to the
  // same digest — a commitment that varied with key order would report a false
  // "card changed" on every read.
  return createHash('sha256').update(JSON.stringify(card.card)).digest('hex');
}

/**
 * Project a correlated agent into the evidence payload. PURE — no clock, no
 * network, no DB — so the whole shape is testable offline and the retrieval
 * timestamp is the caller's, not a hidden `Date.now()`.
 */
export function buildHorizenEvidence(
  record: HorizenAgentRecord,
  retrievedAt: string,
): HorizenEvidenceRecord {
  // The FIRST validation is the most recent (§5.1: validations are
  // newest-first). Absence is normal — §9: most on-chain agents have none.
  const firstValidation = record.validations.present ? record.validations.value[0] ?? null : null;
  const firstProof = record.pulse.present ? record.pulse.value.slaProofs[0] ?? null : null;

  return {
    partner: HORIZEN_PARTNERSHIP.partner,
    pilotId: HORIZEN_PARTNERSHIP.pilotId,

    registryProfileNetwork: record.identity.network,
    // Until Horizen answers which field is authoritative (ruling §2), the PnL
    // service's own claim wins for the IDENTITY chain when it exists, and the
    // divergence is already recorded in correlationNotes rather than resolved.
    erc8004IdentityChain: record.pnl.present && record.pnl.value.erc8004Chain
      ? record.pnl.value.erc8004Chain
      : record.identity.network,
    proofChain: record.pnl.present ? 'base-mainnet' : null,
    chainId: record.identity.chainId,
    tokenId: record.identity.tokenId,
    registryAlias: record.identity.registryAlias,
    pulseAlias: record.identity.pulseAlias,
    pnlUuid: record.pnl.present ? record.pnl.value.uuid : null,
    identityClass: record.identity.identityClass,

    agentCardCommitment: commitCard(record),
    agentCardStatus: record.registry.card.status,

    validationTag: firstValidation?.tag ?? null,
    validationStatus: firstValidation?.status ?? null,
    validatorAddress: firstValidation?.validatorAddress ?? null,
    zkVerifyTxHash: firstValidation?.zkTxHash ?? null,
    zkVerifyBlockHash: firstValidation?.zkBlockHash ?? null,
    zkVerifyAttestationId: firstProof?.zkverifyAttestationId ?? null,
    adapterTxHash: firstProof?.adapterTxHash ?? null,

    pulseEnrolled: record.pulse.present,
    pulseCommitmentRecorded: record.pulse.present ? record.pulse.value.commitmentRecorded : null,

    correlationVerified: record.correlationVerified,
    correlationNotes: record.correlationNotes,
    retrievedAt,
    sourceEndpoints: [HORIZEN_REGISTRY_API, HORIZEN_PULSE_BASE, HORIZEN_PNL_BASE],
    ready: record.ready,
  };
}

/**
 * The human-readable receipt summary. Kept factual and non-committal: it
 * reports what was READ, never asserts the agent is trustworthy. An identity
 * that is not `on-chain` says so, because §2.4.2 makes that the difference
 * between a verified chain identity and a catalogue row.
 */
export function summariseHorizenEvidence(e: HorizenEvidenceRecord): string {
  const parts = [
    `Horizen agent ${e.registryAlias} (tokenId ${e.tokenId}) on ${e.registryProfileNetwork}`,
    `class=${e.identityClass}`,
  ];
  if (e.pulseEnrolled) parts.push('Pulse enrolled');
  if (e.validationTag) parts.push(`validation=${e.validationTag}/${e.validationStatus ?? 'unknown'}`);
  if (e.adapterTxHash) parts.push(`proof tx ${e.adapterTxHash.slice(0, 10)}…`);
  if (!e.correlationVerified) parts.push(`${e.correlationNotes.length} correlation note(s)`);
  return parts.join(' · ');
}
