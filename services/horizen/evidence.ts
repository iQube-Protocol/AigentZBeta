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
 * Mainnet registry profile alongside `erc8004Chain: "base-sepolia"`. Collapsing
 * them would bake in an assumption the operator explicitly refused to make:
 * "Do not infer that they are equal. Do not merge two records solely because
 * their token IDs or names look related."
 *
 * ── RULING, PARTNER CONTACT JOHN CAMARDO (CTO), 2026-07-29 ─────────────────
 *
 * The Mainnet/Sepolia discrepancy in the brief's own PnL example above was
 * **sample ambiguity in the brief's worked example — not confirmed intended
 * behavior.** The ruling: ERC-8004 identity on this pilot is **primarily
 * Base-native**. Base Sepolia is the test environment; Base Mainnet is the
 * production environment. There is no special cross-network ERC-8004 identity
 * architecture to infer or build from that one example.
 *
 * This does NOT change anything above: the three fields stay separate,
 * defensively, exactly as ruling §2 required — the operator's caution about
 * not merging identity spaces was correct discipline regardless of why the
 * example diverged, and nothing here proves the fields will always agree in
 * every future case. What the ruling closes is narrower: do not read that one
 * discrepancy as evidence the pilot requires cross-network identity
 * resolution. It does not, today. See `codexes/packs/agentiq/updates/
 * 2026-07-29_horizen-partner-rulings-base-network-and-interfaces.md`.
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
 *
 * Slice A adds the CONSTITUTIONAL ATTRIBUTION block, and the same discipline
 * governs it absolutely: attribution enters as the four T2 commitments from
 * `bindingRefs` (operator ruling 3) and NEVER as a raw personaId, passport id,
 * grant id, or agent DID. `tests/horizen-agent-binding.test.ts` scans the
 * serialised record for every one of those and fails the build if one appears.
 *
 * ── TEMPORAL HONESTY (operator ruling 4) ───────────────────────────────────
 *
 * *"Do not pretend ingestion time is action time."* Four distinct instants are
 * carried separately, because for externally-observed evidence they genuinely
 * differ and a reader deciding how much weight to give a proof needs the gap:
 *
 *   actionOccurredAt  — when the external agent DID the thing (SLA period end)
 *   proofRecordedAt   — when the partner attested it (validation timestamp)
 *   ingestedAt        — when metaMe took it into its own record
 *   receiptCreatedAt  — when the attributable receipt was written
 *
 * The first two are DERIVED from the correlated record rather than accepted
 * from the caller — they are facts about the partner's data, and a caller-
 * supplied value would be an assertion about someone else's timeline. Both are
 * null when the partner published none: absent is not "now".
 *
 * This is also why the pilot reuses `partner_agent_evidence_recorded` rather
 * than minting a new action type — the operator's ruling permits the reuse
 * precisely because the payload preserves this distinction.
 */

import { createHash } from 'crypto';

import type { HorizenAgentRecord } from './correlate';
import {
  isStandingEligible,
  type BindingResolution,
  type EvidenceBindingState,
} from './agentBinding';
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

  // ── Identity, unflattened (ruling §2). Kept as three separate fields
  // defensively — per John Camardo's 2026-07-29 ruling, ERC-8004 identity on
  // this pilot is primarily Base-native (Sepolia=test, Mainnet=production);
  // the earlier divergence between these fields in the brief's PnL example was
  // sample ambiguity, not confirmed intended behavior, and is not treated as a
  // requirement for cross-network identity architecture. ──
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

  // ── Constitutional attribution (ruling 2 + 3) ──
  /**
   * One of EXACTLY four states. Always present — an omitted field would let a
   * reader default it, and the operator's ruling is that the state is explicit.
   */
  bindingState: EvidenceBindingState;
  /** Why the state is what it is. Distinguishes a suspension from an
   *  unreadable store, both of which land on `binding_unresolvable`. */
  bindingStateReason: string;
  /**
   * Ruling 2: an unbound agent *"must not generate personhood-bound Standing"*.
   * Derived from `bindingState`, never set independently — a second switch here
   * is how the two would drift apart. Slice C consumes this; it does not
   * recompute it.
   */
  standingEligible: boolean;
  /** T2 commitments — null when there is no binding to commit to. */
  principalRef: string | null;
  passportRef: string | null;
  delegationRef: string | null;
  agentBindingRef: string | null;

  // ── Temporal honesty (ruling 4) ──
  /** When the external agent acted. Null when the partner published no period. */
  actionOccurredAt: string | null;
  /** When the partner attested it. Null when there is no validation receipt. */
  proofRecordedAt: string | null;
  /** When metaMe took this into its own record. Caller-supplied. */
  ingestedAt: string;
  /** When the attributable receipt was written. Null until it is. */
  receiptCreatedAt: string | null;

  // ── Provenance of the read itself ──
  correlationVerified: boolean;
  correlationNotes: string[];
  /** Caller-supplied ISO timestamp — never invented here (testability). */
  retrievedAt: string;
  sourceEndpoints: string[];
  /** §5.1 — false means a read reported a warming cache. */
  ready: boolean;
}

/**
 * The attribution context a caller MUST supply.
 *
 * Required, not optional. An optional attribution would need a default, and
 * every available default is a lie: `unbound` asserts a lookup that never
 * happened, and `constitutionally_bound` asserts a binding nobody proved. So
 * the caller has to have resolved the binding (via `resolveBinding`) before it
 * can build evidence at all.
 */
export interface HorizenEvidenceAttribution {
  binding: BindingResolution;
  /** When metaMe committed this to its own record. */
  ingestedAt: string;
  /** The attributable receipt, once written. */
  receiptCreatedAt?: string | null;
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
  attribution: HorizenEvidenceAttribution,
): HorizenEvidenceRecord {
  // The FIRST validation is the most recent (§5.1: validations are
  // newest-first). Absence is normal — §9: most on-chain agents have none.
  const firstValidation = record.validations.present ? record.validations.value[0] ?? null : null;
  const firstProof = record.pulse.present ? record.pulse.value.slaProofs[0] ?? null : null;

  return {
    partner: HORIZEN_PARTNERSHIP.partner,
    pilotId: HORIZEN_PARTNERSHIP.pilotId,

    registryProfileNetwork: record.identity.network,
    // The PnL service's own claim wins for the IDENTITY chain when it exists,
    // and any divergence from registryProfileNetwork is recorded in
    // correlationNotes rather than silently resolved. Per the 2026-07-29
    // partner ruling this is Base-native, not a cross-network merge — the
    // fields stay separate and any disagreement is surfaced, never inferred
    // away.
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

    bindingState: attribution.binding.state,
    bindingStateReason: attribution.binding.reason,
    standingEligible: isStandingEligible(attribution.binding.state),
    // The four T2 commitments, or nothing. `refs` is null exactly when there is
    // no binding record to commit to, so there is no path that emits a partial
    // attribution or substitutes a raw identifier for a missing ref.
    principalRef: attribution.binding.refs?.principalRef ?? null,
    passportRef: attribution.binding.refs?.passportRef ?? null,
    delegationRef: attribution.binding.refs?.delegationRef ?? null,
    agentBindingRef: attribution.binding.refs?.agentBindingRef ?? null,

    // DERIVED from the partner's own data — see the header. `periodEnd` is when
    // the measured activity finished; the validation `timestamp` is when the
    // partner attested it. Neither is our ingestion time and neither is faked.
    actionOccurredAt: firstProof?.periodEnd ?? null,
    proofRecordedAt: firstValidation?.timestamp ?? null,
    ingestedAt: attribution.ingestedAt,
    receiptCreatedAt: attribution.receiptCreatedAt ?? null,

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
    // The attribution verdict belongs in the one-line summary: a reader
    // skimming receipts must not have to open the payload to learn that an
    // agent's evidence is not attributable to any passport.
    `binding=${e.bindingState}`,
  ];
  if (e.pulseEnrolled) parts.push('Pulse enrolled');
  if (e.validationTag) parts.push(`validation=${e.validationTag}/${e.validationStatus ?? 'unknown'}`);
  if (e.adapterTxHash) parts.push(`proof tx ${e.adapterTxHash.slice(0, 10)}…`);
  if (!e.correlationVerified) parts.push(`${e.correlationNotes.length} correlation note(s)`);
  return parts.join(' · ');
}
