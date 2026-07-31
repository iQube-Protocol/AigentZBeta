/**
 * The joined evidence chain, projected for DISPLAY.
 *
 * Operator ruling, 2026-07-28 (Slice B): *"Surface the joined evidence chain in
 * the Partner Workspace. The demonstrable object should show:*
 *
 *     Horizen agent identity
 *   + Horizen proof/validation
 *   + DVN ingestion receipt
 *   + passport-backed delegation
 *   → Attributable constitutional evidence
 *
 * *The UI should not expose raw T2 identifiers. It should show safe status and
 * commitments. That is the actual differentiator to demonstrate to Horizen."*
 *
 * ── WHY A SERVER-SIDE PROJECTION AND NOT A CLIENT RENDERER ──────────────────
 *
 * Every status below is a DECISION about identity and authority. Slice A
 * already owns those decisions — `isStandingEligible`, the four
 * `AgentAuthorityFacets`, `resolveBinding`'s four-valued verdict. A client that
 * assembled "eligible" from parts would be a SECOND implementation of the same
 * gate, free to drift from the first the moment either changed
 * (inv.engineering.036/037). So this module PROJECTS those decisions into
 * display-ready statuses and the surface renders them verbatim; the client
 * maps `state` to a colour and does no logic at all.
 *
 * That is also why every link carries a three-valued `state` rather than a
 * boolean: the client needs a tone to render, and computing "is this good?"
 * from a status word would put the decision back where it must not live.
 *
 * ── WHAT MAY CROSS THE BOUNDARY ────────────────────────────────────────────
 *
 * NOTHING that identifies a metaMe principal — not T0 (`personaId`,
 * `passportId`, `delegationGrantId`, `agentRootDid`), and NOT EVEN the T2
 * commitments (`principalRef`/`passportRef`/`delegationRef`/`agentBindingRef`).
 * The refs are safe for a DVN receipt, but the operator's ruling is that the UI
 * shows *status derived from them*, so this projection converts each ref into a
 * boolean PRESENCE and drops the value. `tests/horizen-evidence-chain.test.ts`
 * scans the serialised view for all four raw ids AND all four ref strings.
 *
 * What DOES cross is Horizen's own public record — network, chainId, canonical
 * tokenId, registry alias, identity class, validation tag, zkVerify attestation
 * id, adapter tx hash. Those are the partner's published chain data, they name
 * no person, and without them the claim "Horizen proof: validated" would be
 * unverifiable by the partner it is being demonstrated to. The `validatorAddress`
 * is deliberately reduced to `gatewayAttested: boolean` — the only thing a
 * reader needs from it is §3.3's attested-vs-self-reported distinction.
 *
 * ── BOUNDED BY CONSTRUCTION ────────────────────────────────────────────────
 *
 * No Agent Card body, no evidence prose, no stored text of unbounded size: only
 * enum-ish statuses, fixed-length chain identifiers, four timestamps, and a
 * capped list of correlation notes. Two 413s on 2026-07-28 came from routes
 * returning unbounded stored text; this shape cannot grow with the data.
 *
 * ── PURE ───────────────────────────────────────────────────────────────────
 *
 * No clock, no network, no database. The receipt's anchoring state arrives as
 * an explicit `ReceiptAnchor` because reading it is I/O — and because `none`
 * ("no receipt exists") and `unreadable` ("we could not check") are different
 * facts, exactly as `unbound` and `binding_unresolvable` are. The same honesty
 * discipline, applied one layer down.
 */

import {
  type AgentIdentityBinding,
  type BindingResolution,
  type EvidenceBindingState,
} from './agentBinding';
import type { HorizenEvidenceRecord } from './evidence';

// ───────────────────────────────────────────────────────────────────────────
// 1. The link vocabulary
// ───────────────────────────────────────────────────────────────────────────

/**
 * The seven links of the operator's chain, in the order the ruling states
 * them. `standing` is NOT a link — it is the verdict the chain produces, and
 * modelling it as an eighth row would invite a reader to treat it as one more
 * input rather than the conclusion.
 */
export type ChainLinkId =
  | 'agent-identity'
  | 'operator-relationship'
  | 'passport-backing'
  | 'delegation'
  | 'authority-scope'
  | 'horizen-proof'
  | 'dvn-receipt';

export const CHAIN_LINK_IDS: readonly ChainLinkId[] = [
  'agent-identity',
  'operator-relationship',
  'passport-backing',
  'delegation',
  'authority-scope',
  'horizen-proof',
  'dvn-receipt',
] as const;

/**
 * THREE values, never two.
 *
 *  - `affirmed`      — the fact holds.
 *  - `negative`      — we established that it does NOT hold. A FACTUAL claim.
 *  - `indeterminate` — we could not establish it either way. An admission.
 *
 * The third member is the whole point. Collapsing `indeterminate` into
 * `negative` is the same defect `binding_unresolvable` → `unbound` would be,
 * one layer up: it manufactures a factual claim out of a failed lookup.
 */
export type ChainLinkState = 'affirmed' | 'negative' | 'indeterminate';

export interface ChainLink {
  id: ChainLinkId;
  /** Operator-facing name of the link, e.g. "Operator relationship". */
  label: string;
  /** The word to render, e.g. "claimed" / "unclaimed" / "unknown". */
  status: string;
  /** The tone the client maps to a colour. The client's ONLY branch. */
  state: ChainLinkState;
  /** Why the status is what it is. Derived here, never written beside it. */
  detail: string;
}

// ───────────────────────────────────────────────────────────────────────────
// 2. Standing — the verdict, always with its reason
// ───────────────────────────────────────────────────────────────────────────

/**
 * A stable machine token per binding state. Distinct from `reason`, which is
 * the binding resolution's own prose: the code is what a canary, a log line or
 * a future gate can key on without string-matching English.
 */
export type StandingReasonCode =
  | 'constitutionally-bound'
  | 'no-constitutional-binding'
  | 'binding-unresolvable'
  | 'binding-revoked';

const STANDING_REASON_CODE: Record<EvidenceBindingState, StandingReasonCode> = {
  constitutionally_bound: 'constitutionally-bound',
  unbound: 'no-constitutional-binding',
  binding_unresolvable: 'binding-unresolvable',
  binding_revoked: 'binding-revoked',
};

export interface StandingVerdict {
  eligible: boolean;
  /** 'eligible' | 'ineligible' — the word to render. */
  status: 'eligible' | 'ineligible';
  state: ChainLinkState;
  reasonCode: StandingReasonCode;
  /**
   * The binding resolution's OWN reason, carried through verbatim.
   *
   * "ineligible" with no reason is the Terminal Outcome defect (Invariant A):
   * an outcome the operator can only diagnose by opening a SQL console is
   * unobservable. And the reason has to come from the resolution rather than
   * from prose written next to the badge, or the two drift and the explanation
   * stops describing the decision.
   */
  reason: string;
}

// ───────────────────────────────────────────────────────────────────────────
// 3. The receipt's anchoring state — supplied, because reading it is I/O
// ───────────────────────────────────────────────────────────────────────────

export type ReceiptAnchor =
  /** No attributable receipt has been written for this evidence. A FACT. */
  | { kind: 'none' }
  /** A receipt exists but its anchoring state could not be read. IGNORANCE. */
  | { kind: 'unreadable'; detail: string }
  /** Read: the receipt's own `receipt_status` from the DVN state machine. */
  | { kind: 'read'; receiptStatus: string };

// ───────────────────────────────────────────────────────────────────────────
// 4. The view
// ───────────────────────────────────────────────────────────────────────────

export interface EvidenceChainView {
  /**
   * Horizen's public record. Every field here is the partner's own published
   * chain/service data; none of it names a metaMe principal.
   */
  agent: {
    network: string;
    chainId: number;
    /** Canonical decimal tokenId (§3.1 join key). */
    tokenId: string;
    /** The registry's hex rendering of the same number (§2.4.1). */
    registryAlias: string;
    /** on-chain | service-onboarded | catalogue | unknown (§2.4.2/§2.4.3). */
    identityClass: string;
    /** The chain the ERC-8004 identity is claimed on — NOT merged with above. */
    erc8004IdentityChain: string;
    /** The chain the PROOF was recorded on. Null when there is no PnL record. */
    proofChain: string | null;
    /** `parsed` | `unresolved` | … — the card STATUS, never the card. */
    agentCardStatus: string;
    pulseEnrolled: boolean;
    correlationVerified: boolean;
    /** Capped — see MAX_CORRELATION_NOTES. */
    correlationNotes: string[];
    /** §5.1 — false means a read reported a warming cache. */
    ready: boolean;
  };
  /** The four-valued verdict, surfaced so the four states stay distinguishable. */
  bindingState: EvidenceBindingState;
  links: ChainLink[];
  standing: StandingVerdict;
  /** Ruling 4 — four distinct instants, never collapsed into "now". */
  temporal: {
    actionOccurredAt: string | null;
    proofRecordedAt: string | null;
    ingestedAt: string;
    receiptCreatedAt: string | null;
  };
  /** Horizen's proof identifiers. Public; fixed length; no address rendered. */
  proof: {
    validationTag: string | null;
    /** The partner's own status string, reported, never re-interpreted. */
    partnerReportedStatus: string | null;
    /** §3.3 — came through ValidationGatewayV2, i.e. not a self-report. */
    gatewayAttested: boolean;
    zkVerifyAttestationId: string | null;
    adapterTxHash: string | null;
  };
  /**
   * PRESENCE of each T2 commitment — never the commitment itself (ruling:
   * the UI shows status derived from the refs, not the refs).
   */
  commitments: {
    principal: boolean;
    passport: boolean;
    delegation: boolean;
    agentBinding: boolean;
  };
}

/** Correlation notes are partner-derived strings; cap them so the payload
 *  cannot grow with a misbehaving upstream (the 413 discipline). */
export const MAX_CORRELATION_NOTES = 8;

// ───────────────────────────────────────────────────────────────────────────
// 5. Availability — the one place `unbound` and `binding_unresolvable` diverge
// ───────────────────────────────────────────────────────────────────────────

/**
 * What the resolution makes available to read facets from.
 *
 *  - `binding` — a record exists; every facet is a real recorded fact.
 *  - `none`    — we LOOKED and there is no binding. The facets are absent as a
 *                matter of fact, so each link renders NEGATIVE.
 *  - `unknown` — we could not look (or a binding exists but is not in force and
 *                carries no readable record). Each link renders INDETERMINATE.
 *
 * This function is the single place the `unbound` / `binding_unresolvable`
 * distinction becomes visible in the UI. Collapsing the two branches here would
 * make an unreadable store render exactly like a genuinely unbound agent —
 * which is the defect `resolveBinding`'s own header calls out, reproduced one
 * layer up where nobody would think to look for it.
 */
type Availability =
  | { kind: 'binding'; binding: AgentIdentityBinding }
  | { kind: 'none' }
  | { kind: 'unknown'; reason: string };

export function bindingAvailability(resolution: BindingResolution): Availability {
  if (resolution.binding) return { kind: 'binding', binding: resolution.binding };
  if (resolution.state === 'unbound') return { kind: 'none' };
  return { kind: 'unknown', reason: resolution.reason };
}

interface LinkWords {
  id: ChainLinkId;
  label: string;
  /** The word when the fact holds — the operator's own vocabulary. */
  affirmed: string;
  /** The word when it does not. */
  negative: string;
  /** The word when we could not establish it. */
  indeterminate: string;
}

function factLink(
  words: LinkWords,
  availability: Availability,
  read: (b: AgentIdentityBinding) => boolean,
  detail: { whenTrue: string; whenFalse: string; whenNoBinding: string },
): ChainLink {
  if (availability.kind === 'unknown') {
    return {
      id: words.id,
      label: words.label,
      status: words.indeterminate,
      state: 'indeterminate',
      detail: availability.reason,
    };
  }
  if (availability.kind === 'none') {
    return {
      id: words.id,
      label: words.label,
      status: words.negative,
      state: 'negative',
      detail: detail.whenNoBinding,
    };
  }
  const holds = read(availability.binding);
  return {
    id: words.id,
    label: words.label,
    status: holds ? words.affirmed : words.negative,
    state: holds ? 'affirmed' : 'negative',
    detail: holds ? detail.whenTrue : detail.whenFalse,
  };
}

/**
 * The one sentence a genuinely unbound agent gets on every constitutional
 * link. It says what happened (we looked, there is none) and that the evidence
 * is still valid — ruling 2: *"An unbound Horizen agent is still valid external
 * evidence."* An unbound agent must render fully and must not look like an
 * error.
 */
const NO_BINDING_DETAIL =
  'no constitutional binding exists for this agent — valid external evidence, not attributable to a metaMe passport';

// ───────────────────────────────────────────────────────────────────────────
// 6. The projection
// ───────────────────────────────────────────────────────────────────────────

export interface EvidenceChainInput {
  evidence: HorizenEvidenceRecord;
  /** The SAME resolution the evidence was built from. */
  binding: BindingResolution;
  /** The receipt's DVN state. `none` / `unreadable` / `read` — see the type. */
  receiptAnchor: ReceiptAnchor;
}

/**
 * Project one correlated, attributed agent into the display object.
 *
 * The four facet links read `AgentAuthorityFacets` and the constitutional act
 * DIRECTLY — never a derived summary — because Slice A's ruling is that the
 * four facets are INDEPENDENT and none may be inferred from another. A
 * projection that computed "operator relationship claimed" from "delegation
 * active" would reintroduce exactly the compression the operator refused.
 */
export function projectEvidenceChain(input: EvidenceChainInput): EvidenceChainView {
  const { evidence, binding, receiptAnchor } = input;
  const availability = bindingAvailability(binding);

  const links: ChainLink[] = [
    factLink(
      {
        id: 'agent-identity',
        label: 'Agent identity',
        affirmed: 'verified',
        negative: 'unverified',
        indeterminate: 'unknown',
      },
      availability,
      (b) => b.facets.ownershipVerified,
      {
        whenTrue:
          'the wallet that owns this ERC-8004 identity was verified against the binding record',
        whenFalse:
          'ownership is not currently verified — the recorded owner no longer matches, or the check has not succeeded',
        whenNoBinding: NO_BINDING_DETAIL,
      },
    ),
    factLink(
      {
        id: 'operator-relationship',
        label: 'Operator relationship',
        affirmed: 'claimed',
        negative: 'unclaimed',
        indeterminate: 'unknown',
      },
      availability,
      (b) => b.facets.operatorRelationshipClaimed,
      {
        whenTrue:
          'a passport holder claimed this agent and accepted responsibility for what it does',
        whenFalse:
          'no passport holder has claimed this agent — wallet control alone is not a relationship',
        whenNoBinding: NO_BINDING_DETAIL,
      },
    ),
    factLink(
      {
        id: 'passport-backing',
        label: 'Passport backing',
        affirmed: 'confirmed',
        negative: 'absent',
        indeterminate: 'unknown',
      },
      availability,
      // The presence of the passport COMMITMENT is the evidence-side fact: a
      // ref exists exactly when the constitutional act named a passport.
      () => evidence.passportRef !== null,
      {
        whenTrue: 'the claim was made under a metaMe passport (commitment recorded, identifier withheld)',
        whenFalse: 'no passport backs this binding',
        whenNoBinding: NO_BINDING_DETAIL,
      },
    ),
    factLink(
      {
        id: 'delegation',
        label: 'Delegation',
        affirmed: 'active',
        negative: 'inactive',
        indeterminate: 'unknown',
      },
      availability,
      (b) => b.facets.delegationActive,
      {
        whenTrue: 'the delegation grant this binding operates within is live',
        whenFalse: 'the delegation grant is not live — the agent may act for nobody',
        whenNoBinding: NO_BINDING_DETAIL,
      },
    ),
    factLink(
      {
        id: 'authority-scope',
        label: 'Authority scope',
        affirmed: 'present',
        negative: 'undefined',
        indeterminate: 'unknown',
      },
      availability,
      // Ruling 6's fourth requirement: the holder DEFINED the scope rather than
      // inheriting a default. That is a recorded fact on the act itself.
      (b) => b.constitutionalAct.scopeDefined,
      {
        whenTrue: 'the passport holder defined the delegation scope this agent operates within',
        whenFalse: 'no scope was defined for this delegation — authority is undefined, not unlimited',
        whenNoBinding: NO_BINDING_DETAIL,
      },
    ),
    horizenProofLink(evidence),
    dvnReceiptLink(receiptAnchor),
  ];

  return {
    agent: {
      network: evidence.registryProfileNetwork,
      chainId: evidence.chainId,
      tokenId: evidence.tokenId,
      registryAlias: evidence.registryAlias,
      identityClass: evidence.identityClass,
      erc8004IdentityChain: evidence.erc8004IdentityChain,
      proofChain: evidence.proofChain,
      agentCardStatus: evidence.agentCardStatus,
      pulseEnrolled: evidence.pulseEnrolled,
      correlationVerified: evidence.correlationVerified,
      correlationNotes: evidence.correlationNotes.slice(0, MAX_CORRELATION_NOTES),
      ready: evidence.ready,
    },
    bindingState: evidence.bindingState,
    links,
    standing: {
      // PROJECTED from the evidence record's own field, which evidence.ts
      // derived with `isStandingEligible`. Calling `isStandingEligible` again
      // here would be a second derivation of the same decision — the exact
      // drift inv.engineering.036 forbids.
      eligible: evidence.standingEligible,
      status: evidence.standingEligible ? 'eligible' : 'ineligible',
      state: evidence.standingEligible ? 'affirmed' : 'negative',
      reasonCode: STANDING_REASON_CODE[evidence.bindingState],
      reason: evidence.bindingStateReason,
    },
    temporal: {
      actionOccurredAt: evidence.actionOccurredAt,
      proofRecordedAt: evidence.proofRecordedAt,
      ingestedAt: evidence.ingestedAt,
      receiptCreatedAt: evidence.receiptCreatedAt,
    },
    proof: {
      validationTag: evidence.validationTag,
      partnerReportedStatus: evidence.validationStatus,
      gatewayAttested: evidence.validatorAddress !== null,
      zkVerifyAttestationId: evidence.zkVerifyAttestationId,
      adapterTxHash: evidence.adapterTxHash,
    },
    commitments: {
      principal: evidence.principalRef !== null,
      passport: evidence.passportRef !== null,
      delegation: evidence.delegationRef !== null,
      agentBinding: evidence.agentBindingRef !== null,
    },
  };
}

/**
 * Horizen proof / validation.
 *
 * THREE states, and the middle one matters: brief §3.3 makes the
 * ValidationGatewayV2 proxy the difference between an ATTESTED receipt and a
 * self-reported one. A validation with no `validatorAddress` is present but
 * unattested, which is neither "validated" nor "nothing there".
 *
 * The partner's own `status` string is REPORTED, never re-interpreted: this
 * codebase does not know Horizen's status vocabulary, and mapping an unknown
 * word onto pass/fail would be a guess (CLAUDE.md: no guessing).
 */
function horizenProofLink(e: HorizenEvidenceRecord): ChainLink {
  const label = 'Horizen proof';
  if (e.validationTag === null && e.validationStatus === null) {
    return {
      id: 'horizen-proof',
      label,
      status: 'unvalidated',
      state: 'negative',
      // §9: most on-chain agents have no validation. Absence is a fact about
      // the agent, not a defect in the read — say so, so it does not read as
      // a failure.
      detail:
        'no validation receipt recorded for this agent (Horizen brief §9: a valid agent may have none)',
    };
  }
  if (e.validatorAddress === null) {
    return {
      id: 'horizen-proof',
      label,
      status: 'self-reported',
      state: 'indeterminate',
      detail: `validation ${e.validationTag ?? 'present'} reports status "${e.validationStatus ?? 'unknown'}" but did not come through the validation gateway — attested and claimed are not the same receipt`,
    };
  }
  return {
    id: 'horizen-proof',
    label,
    status: 'validated',
    state: 'affirmed',
    detail: `gateway-attested validation ${e.validationTag ?? 'receipt'}, partner-reported status "${e.validationStatus ?? 'unknown'}"`,
  };
}

/**
 * The DVN ingestion receipt.
 *
 * `pending` is deliberately INDETERMINATE rather than negative: a receipt in
 * `local` or `dvn_pending` is on its way into tamper-evident memory and saying
 * "not recorded" would assert a failure that has not happened. `dvn_failed` IS
 * negative — that one is a real gap in the provenance trail, and CLAUDE.md's
 * DVN escalation contract requires the operator to be able to see it.
 */
function dvnReceiptLink(anchor: ReceiptAnchor): ChainLink {
  const label = 'DVN receipt';
  if (anchor.kind === 'none') {
    return {
      id: 'dvn-receipt',
      label,
      status: 'not-recorded',
      state: 'negative',
      detail: 'no attributable receipt has been written for this evidence yet',
    };
  }
  if (anchor.kind === 'unreadable') {
    return {
      id: 'dvn-receipt',
      label,
      status: 'unknown',
      state: 'indeterminate',
      detail: anchor.detail,
    };
  }
  if (anchor.receiptStatus === 'dvn_recorded') {
    return {
      id: 'dvn-receipt',
      label,
      status: 'recorded',
      state: 'affirmed',
      detail: 'the ingestion receipt is anchored on the Decentralised Verification Network',
    };
  }
  if (anchor.receiptStatus === 'dvn_failed') {
    return {
      id: 'dvn-receipt',
      label,
      status: 'anchor-failed',
      state: 'negative',
      detail:
        'the ingestion receipt exists but DVN anchoring failed — a gap in the provenance trail; retry from the receipts view',
    };
  }
  return {
    id: 'dvn-receipt',
    label,
    status: 'pending',
    state: 'indeterminate',
    detail: `the ingestion receipt is written and awaiting anchoring (receipt status "${anchor.receiptStatus}")`,
  };
}
