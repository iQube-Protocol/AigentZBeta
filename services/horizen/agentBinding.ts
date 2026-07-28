/**
 * The ERC-8004 identity binding — a FIRST-CLASS CONSTITUTIONAL RECORD.
 *
 * Operator ruling, 2026-07-28 (Slice A): *"Do not place an unverified token ID
 * directly on a delegation row and call that a binding."*
 *
 * ── THE CHAIN THIS RECORD CLOSES ───────────────────────────────────────────
 *
 *   Passport holder
 *     → delegation grant
 *       → agent_root_did
 *         → ERC-8004 identity binding   ← THIS MODULE
 *           → network + chainId + tokenId
 *
 * `services/delegation/delegationGrantStore.ts` already carries the first three
 * links; `services/horizen/identity.ts` already carries the last. The gap this
 * module fills is the arrow between them, and the operator's ruling is that the
 * arrow is a RECORD, not a column: it has to be able to say who owned the token
 * when the claim was made, how the claim was proven, when it took effect,
 * whether ownership has been re-checked recently enough to carry new authority,
 * and whether it is still in force — none of which a `token_id TEXT` field on a
 * delegation row can express.
 *
 * ── TWO ORTHOGONAL VOCABULARIES. DO NOT COLLAPSE THEM ──────────────────────
 *
 * This module carries TWO state models that describe different questions, and
 * the operator ratified both separately:
 *
 *  1. `EvidenceBindingState` (§1) — the four-valued verdict a RECEIPT carries:
 *     is this external evidence attributable to a metaMe passport at all?
 *  2. `AgentAuthorityFacets` (§2) — four INDEPENDENT facets of authority:
 *     ownership verified, operator relationship claimed, delegation active,
 *     runtime admission eligible.
 *
 * They are not the same enum and neither derives from the other. The operator's
 * reasoning for keeping (2) uncompressed: an agent can be *"wallet-controlled
 * but not passport-claimed; passport-claimed but not delegated; delegated but
 * suspended after transfer; fully bound but not admitted to the Financial
 * Services Runtime."* A single `verified` boolean would force Slices E and G to
 * undo an overcompressed model.
 *
 * ── NETWORK-QUALIFIED, ALWAYS ──────────────────────────────────────────────
 *
 * Ruling: *"Identity key stays network-qualified (network, chainId, tokenId).
 * Do NOT bind to tokenId alone."* identity.ts §4.4 explains the consequence:
 * tokenId 7866 exists on Base Sepolia AND Base Mainnet and names DIFFERENT
 * agents. So the binding embeds a whole `HorizenAgentIdentity` (which has no
 * network-less constructor) and every lookup goes through `identityKey`, the
 * one join key in the codebase, rather than comparing tokenIds.
 *
 * ── OFFLINE BY CONSTRUCTION ────────────────────────────────────────────────
 *
 * Slice A does no chain RPC, no wallet signing, and holds no private keys.
 * Everything here is a pure function over data the caller supplies — the
 * `ownerOf(tokenId)` read, the wallet signature and their verification live at
 * the route layer in Slice E. That is what makes the claim-message builder and
 * verifier testable offline, and it is why this module imports nothing that
 * touches a network or a database.
 */

import {
  identityKey,
  HORIZEN_NETWORK_FACTS,
  type HorizenAgentIdentity,
  type HorizenNetwork,
} from './identity';
import { personaPublicRef, constitutionalRef } from '@/services/identity/personaReferences';

// ───────────────────────────────────────────────────────────────────────────
// 1. The four EVIDENCE-record binding states (operator ruling 2)
// ───────────────────────────────────────────────────────────────────────────

/**
 * EXACTLY these four. The operator enumerated them and the set is closed.
 *
 * The distinction that matters most is `unbound` vs `binding_unresolvable`:
 *
 *  - `unbound` ASSERTS a fact — we looked, and no binding exists. The agent is
 *    still perfectly valid external evidence; it simply is not attributable to
 *    a metaMe passport or delegation.
 *  - `binding_unresolvable` ADMITS IGNORANCE — a binding may or may not exist,
 *    but this read could not establish which (the store was unreadable, or a
 *    binding exists but is not currently in force). Reporting that as `unbound`
 *    would manufacture a factual claim out of a failed lookup.
 *
 * Both are honest; conflating them is the defect. Neither is Standing-eligible.
 */
export type EvidenceBindingState =
  | 'constitutionally_bound'
  | 'unbound'
  | 'binding_unresolvable'
  | 'binding_revoked';

export const EVIDENCE_BINDING_STATES: readonly EvidenceBindingState[] = [
  'constitutionally_bound',
  'unbound',
  'binding_unresolvable',
  'binding_revoked',
] as const;

/**
 * Ruling 2: *"An unbound Horizen agent is still valid external evidence. It is
 * simply not attributable to a metaMe passport or delegation, and must not
 * generate personhood-bound Standing."*
 *
 * So ingestion succeeds in all four states — only ATTRIBUTION is gated. One
 * state, and only one, can carry personhood-bound Standing.
 */
export function isStandingEligible(state: EvidenceBindingState): boolean {
  return state === 'constitutionally_bound';
}

// ───────────────────────────────────────────────────────────────────────────
// 2. The four ORTHOGONAL authority facets (operator addition 1)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Four independent facts, each with its OWN source. None is computed from
 * another, and nothing in this module may make one imply another:
 *
 *  - `ownershipVerified`            ← an ownership check (§5) succeeded and the
 *                                     owner still matches. Set by the check.
 *  - `operatorRelationshipClaimed`  ← the passport-backed constitutional act
 *                                     (proof B, §7). Set by the claim.
 *  - `delegationActive`             ← the delegation grant's own live status,
 *                                     owned by delegationGrantStore. Supplied.
 *  - `runtimeAdmissionEligible`     ← admission to the Financial Services
 *                                     Runtime — a separate act (Slice G).
 *                                     Supplied; defaults to false because
 *                                     admission is granted, never inherited.
 *
 * All 16 combinations are representable, deliberately. The three that look
 * paradoxical are the ones the operator named as real: wallet-controlled but
 * not passport-claimed; passport-claimed but not delegated; fully bound but not
 * runtime-admitted.
 *
 * NOTE the deliberate NON-derivation on transfer: ruling 5 says a transfer
 * makes the delegation *"inactive for new actions"*, and it is tempting to
 * implement that by flipping `delegationActive` to false. That would be wrong —
 * the grant itself is untouched by someone else's token transfer. The transfer
 * clears `ownershipVerified` and suspends the BINDING; the "no new actions"
 * consequence is expressed by `evaluateNewActionAuthority` refusing, not by
 * rewriting a fact about the delegation. See `recheckBindingOwnership`.
 */
export interface AgentAuthorityFacets {
  ownershipVerified: boolean;
  operatorRelationshipClaimed: boolean;
  delegationActive: boolean;
  runtimeAdmissionEligible: boolean;
}

export const AGENT_AUTHORITY_FACETS: readonly (keyof AgentAuthorityFacets)[] = [
  'ownershipVerified',
  'operatorRelationshipClaimed',
  'delegationActive',
  'runtimeAdmissionEligible',
] as const;

// ───────────────────────────────────────────────────────────────────────────
// 3. Lifecycle of the binding RECORD
// ───────────────────────────────────────────────────────────────────────────

/**
 * The record's own lifecycle. Not the same vocabulary as the evidence state:
 * the evidence state is the four-valued verdict a RECEIPT carries, this is the
 * row's status. `suspended` has no evidence-state of its own by design — the
 * operator closed that set at four — so it projects to `binding_unresolvable`
 * with a reason, which is exactly what a suspension means: the link is known
 * but does not currently attribute.
 */
export type AgentBindingStatus = 'active' | 'suspended' | 'revoked' | 'superseded';

/**
 * How the binding was established.
 *
 * ONE member today, deliberately. The operator warned that designing the
 * binding around *"an ad hoc admin association"* would mean replacing it later,
 * so no admin-association method is declared. Any future method must define its
 * own equivalent of BOTH proofs below before it is added here.
 */
export type AgentBindingMethod = 'operator_claim';

/**
 * How an ownership fact was observed.
 *
 * `transfer_event_index` is named now although Slice A cannot produce it: the
 * operator's ruling is that direct Transfer-event indexing later *"shortens the
 * window; it must not change this state model."* Naming it here is what keeps
 * that promise checkable — Phase D adds a source, not a state.
 */
export type OwnershipCheckSource = 'registry_read' | 'chain_read' | 'transfer_event_index';

/**
 * The outcome of an ownership check. `unknown` is NOT `changed`: a check that
 * could not be performed has established nothing, and treating it as a transfer
 * would suspend healthy bindings on every partner outage.
 */
export type OwnershipStatus = 'matches' | 'changed' | 'unknown';

/**
 * PROOF A — proof of agent control.
 *
 * The signature itself is NOT stored: a commitment to it is. The signature is a
 * bearer artifact over a message that names the wallet and the token; keeping
 * the digest proves WHICH signature was verified without keeping a replayable
 * copy in a durable, potentially chain-anchored record.
 */
export interface AgentControlProof {
  /** The wallet `ownerOf(tokenId)` returned when the claim was verified. */
  ownerAddress: string;
  /** How that owner was observed. Slice A can only read the registry REST
   *  profile; a direct chain read is Phase-D work. Recorded, never assumed. */
  ownerObservation: OwnershipCheckSource;
  /** The exact canonical message the wallet signed (byte-for-byte). */
  claimMessage: string;
  /** The single-use nonce carried inside that message. */
  nonce: string;
  /** sha256 of the signature — see above for why not the signature. */
  signatureCommitment: string;
  verifiedAt: string;
}

/**
 * PROOF B — the passport-backed constitutional act.
 *
 * Ruling 6: the holder must *"claim relationship, accept responsibility, define
 * delegation scope, produce attributable receipt."* All four are fields here,
 * because a claim that skipped one of them would be indistinguishable on the
 * record from one that did not.
 *
 * `personaId` and `passportId` are T0 and stay on this server-internal record.
 * Only their commitments cross a network boundary (see `bindingRefs`).
 */
export interface ConstitutionalAct {
  /** T0 — the persona that performed the act. NEVER serialised outward. */
  personaId: string;
  /** T0 — the passport the act was taken under. NEVER serialised outward. */
  passportId: string;
  /** The delegation grant whose scope this binding operates within. */
  delegationGrantId: string;
  /** "Claim relationship" — the holder states this agent is theirs to speak for. */
  claimedRelationship: boolean;
  /** "Accept responsibility" — for what the agent does under the delegation. */
  acceptedResponsibility: boolean;
  /** "Define delegation scope" — the holder scoped it, rather than inheriting a default. */
  scopeDefined: boolean;
  actedAt: string;
  /** "Produce attributable receipt" — null until the receipt is written. */
  receiptId: string | null;
}

/** The binding record itself. Every field the rulings enumerate, one per field. */
export interface AgentIdentityBinding {
  bindingId: string;
  /** The delegation-side identifier this binding attaches an ERC-8004 identity to. */
  agentRootDid: string;

  /** Network-qualified identity. Never a bare tokenId — see the header. */
  identity: HorizenAgentIdentity;
  /**
   * The IdentityRegistry contract AS OF binding time. Recorded rather than
   * looked up on read: `HORIZEN_NETWORK_FACTS` is today's deployment, and a
   * binding made against a superseded registry must still say so.
   */
  identityRegistry: string;

  /** Owner wallet at binding time (ruling 1) — the anchor for transfer detection. */
  ownerAddressAtBinding: string;
  bindingMethod: AgentBindingMethod;
  agentControlProof: AgentControlProof;
  constitutionalAct: ConstitutionalAct;

  // ── Ownership freshness (operator addition 2) ──
  /** When ownership was last successfully checked. Null = never. */
  ownershipCheckedAt: string | null;
  /** The owner that check observed — kept separately from the binding-time
   *  owner so a transfer is a COMPARISON of two recorded facts, not an
   *  overwrite that destroys the evidence of what changed. */
  ownerWalletAtCheck: string | null;
  ownershipStatus: OwnershipStatus;
  ownershipCheckSource: OwnershipCheckSource | null;

  /** The four orthogonal facets (operator addition 1). */
  facets: AgentAuthorityFacets;

  /** Effective time (ruling 1). `effectiveTo` is set when the binding stops attributing. */
  effectiveFrom: string;
  effectiveTo: string | null;

  /** Revocation / supersession state (ruling 1). */
  status: AgentBindingStatus;
  statusReason: string | null;
  supersededBy: string | null;

  /**
   * Receipt or content commitment (ruling 1) — what ties this binding to the
   * attributable record produced by the constitutional act.
   */
  receiptCommitment: string | null;
}

// ───────────────────────────────────────────────────────────────────────────
// 4. T2-safe commitments (operator ruling 3)
// ───────────────────────────────────────────────────────────────────────────

/**
 * The ONLY identifiers permitted to leave for an evidence record, a DVN
 * receipt, or anything chain-bound. Ruling 3: *"never raw personaId / passport
 * id / grant id."*
 *
 * `agentRootDid` is deliberately absent: CLAUDE.md classifies a delegated agent
 * identifier as T0 and requires a commitment in its place. `agentBindingRef` is
 * that commitment — it identifies the binding (and therefore the agent) without
 * carrying the DID.
 */
export interface BindingRefs {
  principalRef: string;
  passportRef: string;
  delegationRef: string;
  agentBindingRef: string;
}

/**
 * Derive all four. `principalRef` is `personaPublicRef` UNCHANGED — the level-2
 * Polity Public Reference that DVN receipts already carry, so a reader can
 * correlate this evidence with the persona's other receipts. The other three go
 * through `constitutionalRef`, the same sha256/16-hex derivation with a type
 * namespace (CLAUDE.md's HMS rule) so two different id kinds cannot collide.
 *
 * One derivation, one file (`services/identity/personaReferences.ts`). No
 * second hashing scheme is defined here — that would be inv.engineering.037.
 */
export function bindingRefs(binding: AgentIdentityBinding): BindingRefs {
  return {
    principalRef: personaPublicRef(binding.constitutionalAct.personaId),
    passportRef: constitutionalRef('passport', binding.constitutionalAct.passportId),
    delegationRef: constitutionalRef('delegation', binding.constitutionalAct.delegationGrantId),
    agentBindingRef: constitutionalRef('agent-binding', binding.bindingId),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// 5. Ownership freshness — the real pilot invariant (operator addition 2)
// ───────────────────────────────────────────────────────────────────────────

/**
 * THE INVARIANT, in the operator's own reframing:
 *
 *   *"No new consequential action may rely on a binding whose ownership has not
 *   been checked within the permitted freshness window."*
 *
 * Note what this is NOT: it is not "transfers are detected instantly". Slice A
 * polls REST and cannot see a Transfer event, so an instant-detection invariant
 * would be unimplementable and therefore unenforceable. A freshness window is
 * enforceable TODAY with the reads we actually have, and it degrades safely:
 * when the check goes stale the system refuses rather than assuming.
 *
 * PILOT DEFAULT — 24 hours. This is a POLICY CHOICE, not a fact read from the
 * partner brief or any operator instruction, and it is flagged for ratification.
 * It is sized to the REST-polling cadence Slice A can actually sustain. Direct
 * Transfer-event indexing (Phase D) shortens the window; per the ruling it must
 * NOT change the state model, only this number.
 */
export const OWNERSHIP_FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Ruling 5: *"A transfer should not silently transfer constitutional
 * delegation."*
 *
 * The consequence a caller must apply alongside the suspension. Named as data
 * so a route cannot forget half of it: suspending the binding while leaving the
 * delegation live for new actions is exactly the silent transfer the ruling
 * forbids.
 */
export const OWNERSHIP_CHANGE_DELEGATION_EFFECT = 'inactive_for_new_actions' as const;

/** EVM address comparison. Case-insensitive: checksum casing is presentation. */
function sameAddress(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Has ownership been checked recently enough to carry NEW authority?
 *
 * A never-checked binding is stale by definition — `null` is not "fresh enough",
 * it is "no check has ever happened", which is the weakest possible position.
 */
export function isOwnershipFresh(
  binding: AgentIdentityBinding,
  now: string,
  windowMs: number = OWNERSHIP_FRESHNESS_WINDOW_MS,
): boolean {
  if (!binding.ownershipCheckedAt) return false;
  const checked = Date.parse(binding.ownershipCheckedAt);
  const at = Date.parse(now);
  if (!Number.isFinite(checked) || !Number.isFinite(at)) return false;
  return at - checked <= windowMs;
}

export interface OwnershipRecheck {
  /** True when the observed owner differs from the owner at binding time. */
  ownerChanged: boolean;
  /** The binding after applying the rule. */
  binding: AgentIdentityBinding;
  /** What the caller must do to the delegation. Null when nothing changed. */
  delegationEffect: typeof OWNERSHIP_CHANGE_DELEGATION_EFFECT | null;
  /** True when the new owner must run the full two-proof claim again. */
  requiresReclaim: boolean;
}

/**
 * The re-check primitive. PURE — the caller supplies the owner it observed.
 *
 * Slice A cannot watch chain transfer events (REST polling only), so this is
 * the state transition plus the primitive that applies it; **live ownership
 * monitoring is Phase-D work** and is recorded as such rather than stubbed.
 *
 * TWO jobs, and the first is the one that is easy to forget: a check that finds
 * the SAME owner must REFRESH the freshness window. Without that, every binding
 * eventually goes stale no matter how diligently it is polled, and the refusal
 * gate below would deny the entire fleet.
 *
 * HISTORICAL EVIDENCE IS PRESERVED on a transfer: suspension writes `status`,
 * `statusReason`, `effectiveTo`, the ownership-check fields, and clears the
 * `ownershipVerified` FACET ONLY. The proofs, the owner at binding time, the
 * constitutional act, and the other three facets all survive verbatim — a
 * suspended binding must still be able to explain what it once attributed and
 * why, and `delegationActive` is a fact about the grant that a stranger's token
 * transfer does not get to rewrite.
 */
export function recheckBindingOwnership(
  binding: AgentIdentityBinding,
  observedOwner: string,
  observedAt: string,
  source: OwnershipCheckSource,
): OwnershipRecheck {
  const unchanged = sameAddress(observedOwner, binding.ownerAddressAtBinding);

  if (unchanged) {
    return {
      ownerChanged: false,
      binding: {
        ...binding,
        ownershipCheckedAt: observedAt,
        ownerWalletAtCheck: observedOwner,
        ownershipStatus: 'matches',
        ownershipCheckSource: source,
        facets: { ...binding.facets, ownershipVerified: true },
      },
      delegationEffect: null,
      requiresReclaim: false,
    };
  }

  // Only a live binding can be suspended by a transfer; a revoked or superseded
  // one is already not attributing and must not be resurrected into 'suspended'.
  const nextStatus: AgentBindingStatus = binding.status === 'active' ? 'suspended' : binding.status;

  return {
    ownerChanged: true,
    binding: {
      ...binding,
      status: nextStatus,
      statusReason:
        binding.status === 'active'
          ? `ownership changed from ${binding.ownerAddressAtBinding} to ${observedOwner} at ${observedAt} — constitutional delegation does not transfer with the token`
          : binding.statusReason,
      effectiveTo: binding.status === 'active' ? observedAt : binding.effectiveTo,
      ownershipCheckedAt: observedAt,
      ownerWalletAtCheck: observedOwner,
      ownershipStatus: 'changed',
      ownershipCheckSource: source,
      facets: { ...binding.facets, ownershipVerified: false },
    },
    delegationEffect: binding.status === 'active' ? OWNERSHIP_CHANGE_DELEGATION_EFFECT : null,
    requiresReclaim: true,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// 6. The new-action gate — where freshness is actually enforced
// ───────────────────────────────────────────────────────────────────────────

/**
 * Refusal reasons this module can judge from the binding alone.
 *
 * Every one is a SEPARATE member rather than a single `not-eligible`, because
 * the operator's ruling on the Slice-G primitive is that *"the refusal path
 * matters as much as the intersection"* — an operator told only "denied" cannot
 * tell a stale poll from a revoked passport.
 */
export type AgentAuthorityRefusal =
  | 'binding-not-active'
  | 'ownership-unverified'
  | 'ownership-changed'
  | 'ownership-check-stale'
  | 'operator-relationship-unclaimed'
  | 'delegation-inactive'
  | 'runtime-admission-denied';

export interface NewActionAuthority {
  eligible: boolean;
  refusals: AgentAuthorityRefusal[];
}

/**
 * The gate the freshness invariant is enforced by:
 *
 *   active binding + owner still matches + ownership check sufficiently fresh
 *     = eligible for new action
 *
 * DELIBERATELY SEPARATE FROM `resolveBinding`. A stale check does NOT make past
 * evidence unattributable — the binding was in force when the action happened
 * and the receipt that recorded it stays true. Staleness withholds NEW
 * authority only. Collapsing the two would retroactively un-attribute history
 * every time a poll was late, which is the opposite of what a tamper-evident
 * record is for.
 *
 * `requireRuntimeAdmission` is opt-in: admission to the Financial Services
 * Runtime gates FSR actions, not every consequential act, so a caller must ask
 * for it rather than inherit it.
 */
export function evaluateNewActionAuthority(
  binding: AgentIdentityBinding,
  now: string,
  opts: { requireRuntimeAdmission?: boolean; windowMs?: number } = {},
): NewActionAuthority {
  const refusals: AgentAuthorityRefusal[] = [];

  if (binding.status !== 'active') refusals.push('binding-not-active');
  if (binding.ownershipStatus === 'changed') refusals.push('ownership-changed');
  if (!binding.facets.ownershipVerified) refusals.push('ownership-unverified');
  if (!isOwnershipFresh(binding, now, opts.windowMs)) refusals.push('ownership-check-stale');
  if (!binding.facets.operatorRelationshipClaimed) refusals.push('operator-relationship-unclaimed');
  if (!binding.facets.delegationActive) refusals.push('delegation-inactive');
  if (opts.requireRuntimeAdmission && !binding.facets.runtimeAdmissionEligible) {
    refusals.push('runtime-admission-denied');
  }

  return { eligible: refusals.length === 0, refusals };
}

// ───────────────────────────────────────────────────────────────────────────
// 6b. The MoneyPenny primitive — NAMED HERE, IMPLEMENTED IN SLICE G
// ───────────────────────────────────────────────────────────────────────────

/**
 * `resolveEffectiveAgentAuthority` is Slice G's, NOT Slice A's. It is named and
 * typed here so the binding model can be checked today against what that
 * primitive will need, per the operator's instruction: *"only ensure your
 * binding model can SUPPLY the inputs that primitive will need."*
 *
 * Its invariant, for the record: *"An orchestration plan is valid only when
 * every resulting permission is a subset of the agent's independently granted
 * authority and current runtime policy."*
 *
 * Its return shape will be `{ permitted, effectiveScope, exclusions }`. The
 * `Scope` type is deliberately NOT declared here — it belongs to the
 * orchestration/runtime layer that Slice G builds, and inventing it now would
 * be the speculative abstraction CLAUDE.md forbids.
 */
export type EffectiveAuthorityRefusal =
  | AgentAuthorityRefusal
  | 'action-outside-delegation'
  | 'orchestration-plan-wider-than-delegation'
  | 'runtime-policy-denied'
  | 'passport-backed-authority-missing';

/**
 * Everything `resolveEffectiveAgentAuthority` needs FROM THE BINDING. Slice G
 * supplies the rest (the requested action, the orchestration plan, the runtime
 * policy) — those are not facts about a binding and this module must not
 * pretend to know them.
 */
export interface AgentAuthorityInputs {
  /** Network-qualified. Slice G must never match on tokenId alone either. */
  identityKey: string;
  bindingStatus: AgentBindingStatus;
  facets: AgentAuthorityFacets;
  ownershipStatus: OwnershipStatus;
  ownershipCheckedAt: string | null;
  ownershipFresh: boolean;
  /** The grant whose scope bounds every permission Slice G may grant. */
  delegationGrantId: string;
  /** T2 commitments — the only identifiers Slice G may put in a receipt. */
  refs: BindingRefs;
  /** The binding-only refusals, already judged. Slice G appends its own. */
  refusals: AgentAuthorityRefusal[];
}

/** Project a binding into the Slice-G input set. Pure; no policy decisions. */
export function agentAuthorityInputs(
  binding: AgentIdentityBinding,
  now: string,
  opts: { requireRuntimeAdmission?: boolean; windowMs?: number } = {},
): AgentAuthorityInputs {
  return {
    identityKey: identityKey(binding.identity),
    bindingStatus: binding.status,
    facets: binding.facets,
    ownershipStatus: binding.ownershipStatus,
    ownershipCheckedAt: binding.ownershipCheckedAt,
    ownershipFresh: isOwnershipFresh(binding, now, opts.windowMs),
    delegationGrantId: binding.constitutionalAct.delegationGrantId,
    refs: bindingRefs(binding),
    refusals: evaluateNewActionAuthority(binding, now, opts).refusals,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// 7. Resolving an identity to its evidence-record binding state
// ───────────────────────────────────────────────────────────────────────────

export type BindingResolution =
  | { state: 'constitutionally_bound'; reason: string; binding: AgentIdentityBinding; refs: BindingRefs }
  | { state: 'binding_revoked'; reason: string; binding: AgentIdentityBinding; refs: BindingRefs }
  | { state: 'binding_unresolvable'; reason: string; binding: AgentIdentityBinding | null; refs: BindingRefs | null }
  | { state: 'unbound'; reason: string; binding: null; refs: null };

/**
 * THE resolution. Pure: the caller fetches candidate bindings, this decides.
 *
 * `bindings: null` is NOT an empty list. An empty list means "we looked and
 * there are none" (→ `unbound`); null means "we could not look" (→
 * `binding_unresolvable`). Collapsing the two would let an unreadable store
 * silently publish the factual claim that an agent is unattributed.
 *
 * Matching is by `identityKey` — network-qualified. A binding for tokenId 7866
 * on Base Sepolia does NOT resolve an evidence record for tokenId 7866 on Base
 * Mainnet, and the filter is what makes that structural rather than remembered.
 */
export function resolveBinding(input: {
  identity: HorizenAgentIdentity;
  bindings: AgentIdentityBinding[] | null;
  at: string;
}): BindingResolution {
  if (input.bindings === null) {
    return {
      state: 'binding_unresolvable',
      reason: 'binding store could not be read — existence of a binding is unknown, not disproven',
      binding: null,
      refs: null,
    };
  }

  const key = identityKey(input.identity);
  const mine = input.bindings.filter((b) => identityKey(b.identity) === key);
  if (mine.length === 0) {
    return {
      state: 'unbound',
      reason: `no binding record for ${key} — valid external evidence, not attributable`,
      binding: null,
      refs: null,
    };
  }

  const at = Date.parse(input.at);

  const active = mine.find(
    (b) =>
      b.status === 'active' &&
      Date.parse(b.effectiveFrom) <= at &&
      (b.effectiveTo === null || Date.parse(b.effectiveTo) > at),
  );
  if (active) {
    return {
      state: 'constitutionally_bound',
      reason: `active binding ${active.bindingId} in force at ${input.at}`,
      binding: active,
      refs: bindingRefs(active),
    };
  }

  // No binding is in force. WHICH kind of not-in-force it is decides the state,
  // and the most recent record is the one that describes the current situation.
  const latest = [...mine].sort(
    (a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom),
  )[0];

  if (latest.status === 'revoked') {
    return {
      state: 'binding_revoked',
      reason: latest.statusReason ?? `binding ${latest.bindingId} was revoked`,
      binding: latest,
      refs: bindingRefs(latest),
    };
  }

  return {
    state: 'binding_unresolvable',
    reason:
      latest.statusReason ??
      `binding ${latest.bindingId} is '${latest.status}' and not in force at ${input.at}`,
    binding: latest,
    refs: bindingRefs(latest),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// 8. The operator-claim primitive (operator ruling 6 + addition 3)
// ───────────────────────────────────────────────────────────────────────────

/**
 * THE DOMAIN SEPARATOR. First line of every claim message, verbatim.
 *
 * Operator addition 3 fixes this string exactly. It is what makes it impossible
 * to replay a valid claim signature as a Pulse enrollment, a passport
 * connection challenge, or any other ceremony on this platform: no other
 * canonical message on the platform begins with it, and EIP-191 signatures are
 * over the whole message including this line.
 *
 * `v1` is part of the separator, so a future v2 message shape can never be
 * satisfied by a v1 signature and vice versa.
 */
export const AGENT_CLAIM_DOMAIN_SEPARATOR = 'metaMe Agent Claim v1';

/**
 * The claim purpose string. Distinct from the separator: the separator scopes
 * the MESSAGE FORMAT, the purpose scopes what this particular signature
 * authorises.
 */
export const AGENT_CLAIM_PURPOSE = 'bind-erc8004-agent-to-passport-delegation';

/**
 * Everything the claim message binds. Each member closes a replay axis:
 *
 *  - separator + `purpose`                      → across CEREMONIES and VERSIONS
 *  - `runtime` + `environment` + `origin`       → across ENVIRONMENTS
 *  - `network` + `chainId` + `identityRegistry` → across CHAINS
 *  - `tokenId`                                  → across AGENTS
 *  - `ownerWallet`                              → across WALLETS
 *  - `principalRef` + `passportRef`             → across PRINCIPALS
 *  - `nonce` + `issuedAt` + `expiresAt`         → across TIME
 *
 * `principalRef`/`passportRef` are T2 COMMITMENTS, not the raw personaId or
 * passport id: the message is rendered in a wallet UI and pasted into logs and
 * support tickets, so a T0 identifier in it would leak through the most-copied
 * surface in the entire flow.
 */
export interface AgentClaimMessageInput {
  runtime: string;
  environment: string;
  origin: string;
  purpose: string;
  network: HorizenNetwork;
  chainId: number;
  identityRegistry: string;
  /** Canonical DECIMAL tokenId — the same rendering identity.ts normalises to. */
  tokenId: string;
  ownerWallet: string;
  principalRef: string;
  passportRef: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

/**
 * Build the canonical claim message.
 *
 * Line discipline mirrors `buildConnectionChallengeMessage`
 * (`services/passport/connectionChallenge.ts`) — newline-joined `Key: value`
 * lines, EIP-191 personal_sign — deliberately, so the platform has ONE canonical
 * message discipline rather than a second format to audit. What differs is the
 * first line, which is the domain separator that makes the two unconfusable.
 *
 * THE EXACT BYTES ARE THE CONTRACT. `tests/horizen-agent-binding.test.ts` pins
 * the full expected string as a fixture, not a regex, so any drift in spacing,
 * ordering, wording or field set fails loudly rather than silently invalidating
 * every signature ever produced against the old form.
 */
export function buildAgentClaimMessage(input: AgentClaimMessageInput): string {
  return [
    AGENT_CLAIM_DOMAIN_SEPARATOR,
    '',
    `Purpose: ${input.purpose}`,
    `Runtime: ${input.runtime}`,
    `Environment: ${input.environment}`,
    `Origin: ${input.origin}`,
    `Network: ${input.network}`,
    `Chain Id: ${input.chainId}`,
    `Identity Registry: ${input.identityRegistry}`,
    `Token Id: ${input.tokenId}`,
    `Owner Wallet: ${input.ownerWallet}`,
    `Principal: ${input.principalRef}`,
    `Passport: ${input.passportRef}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expires: ${input.expiresAt}`,
    '',
    'Signing proves you control the wallet that owns this agent identity. It does not create a delegation — a separate, Passport-backed act is required for that.',
  ].join('\n');
}

export type ClaimMessageFailure =
  | 'malformed'
  | 'wrong-domain-separator'
  | 'purpose-mismatch'
  | 'runtime-mismatch'
  | 'environment-mismatch'
  | 'origin-mismatch'
  | 'network-mismatch'
  | 'chain-mismatch'
  | 'registry-mismatch'
  | 'token-mismatch'
  | 'wallet-mismatch'
  | 'principal-mismatch'
  | 'passport-mismatch'
  | 'nonce-mismatch'
  | 'issued-at-mismatch'
  | 'expiry-mismatch'
  | 'expired';

export type ClaimMessageResult = { ok: true } | { ok: false; reason: ClaimMessageFailure };

/** Field label → the `AgentClaimMessageInput` key it renders, in message order. */
const CLAIM_FIELDS: ReadonlyArray<
  [label: string, key: keyof AgentClaimMessageInput, failure: ClaimMessageFailure]
> = [
  ['Purpose', 'purpose', 'purpose-mismatch'],
  ['Runtime', 'runtime', 'runtime-mismatch'],
  ['Environment', 'environment', 'environment-mismatch'],
  ['Origin', 'origin', 'origin-mismatch'],
  ['Network', 'network', 'network-mismatch'],
  ['Chain Id', 'chainId', 'chain-mismatch'],
  ['Identity Registry', 'identityRegistry', 'registry-mismatch'],
  ['Token Id', 'tokenId', 'token-mismatch'],
  ['Owner Wallet', 'ownerWallet', 'wallet-mismatch'],
  ['Principal', 'principalRef', 'principal-mismatch'],
  ['Passport', 'passportRef', 'passport-mismatch'],
  ['Nonce', 'nonce', 'nonce-mismatch'],
  ['Issued At', 'issuedAt', 'issued-at-mismatch'],
  ['Expires', 'expiresAt', 'expiry-mismatch'],
];

/**
 * Verify a presented message binds EXACTLY the parameters we expect, and has
 * not expired. Pure — no chain call, no signature check.
 *
 * THREE layers, and all three are needed:
 *  1. The domain separator, checked FIRST. A message from another ceremony is
 *     rejected before any field is even looked at, so a foreign message can
 *     never be coaxed through by coincidental field overlap.
 *  2. Field-by-field comparison, so a caller gets a SPECIFIC reason (an operator
 *     debugging a rejected claim needs to know it was the chainId).
 *  3. A byte-exact reconstruction check, which catches anything the field scan
 *     cannot see — reordered lines, an appended instruction, a changed closing
 *     sentence. Without it, a message could satisfy every `Key: value`
 *     assertion and still carry attacker-authored text the human approved.
 *
 * Signature RECOVERY is deliberately not here. Slice E performs it with
 * `ethers.verifyMessage` via the existing `verifyConnectionProof` path — one
 * signature primitive on the platform, not two.
 */
export function verifyAgentClaimMessage(
  message: string,
  expected: AgentClaimMessageInput,
  now: string,
): ClaimMessageResult {
  const lines = message.split('\n');

  // Layer 1 — domain separation, before anything else.
  if (lines[0] !== AGENT_CLAIM_DOMAIN_SEPARATOR) {
    return { ok: false, reason: 'wrong-domain-separator' };
  }

  const seen = new Map<string, string>();
  for (const line of lines) {
    const idx = line.indexOf(': ');
    if (idx <= 0) continue;
    const label = line.slice(0, idx);
    if (!seen.has(label)) seen.set(label, line.slice(idx + 2));
  }

  // Layer 2 — specific field reasons.
  for (const [label, key, failure] of CLAIM_FIELDS) {
    const presented = seen.get(label);
    if (presented === undefined) return { ok: false, reason: 'malformed' };
    if (presented !== String(expected[key])) return { ok: false, reason: failure };
  }

  // Layer 3 — nothing outside the scanned fields may differ.
  if (message !== buildAgentClaimMessage(expected)) return { ok: false, reason: 'malformed' };

  const expiresAt = Date.parse(expected.expiresAt);
  if (!Number.isFinite(expiresAt)) return { ok: false, reason: 'malformed' };
  if (Date.parse(now) >= expiresAt) return { ok: false, reason: 'expired' };

  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────────────
// 9. Neither proof alone suffices (operator ruling 6)
// ───────────────────────────────────────────────────────────────────────────

export type ClaimRefusal =
  | 'both-proofs-missing'
  | 'agent-control-proof-missing'
  | 'constitutional-act-missing'
  | 'claim-message-not-bound';

export type ClaimEvaluation = { ok: true } | { ok: false; reason: ClaimRefusal };

/**
 * Ruling 6: *"Wallet control alone is not delegation. Passport possession alone
 * is not proof of agent control."*
 *
 * Encoded as a REFUSAL rather than as a caller convention, because a convention
 * is exactly what gets forgotten at the second call site. Both proofs, or no
 * binding — there is no partial-credit path through this function.
 */
export function evaluateOperatorClaim(input: {
  agentControlProof: AgentControlProof | null;
  constitutionalAct: ConstitutionalAct | null;
}): ClaimEvaluation {
  const hasControl = input.agentControlProof !== null;
  const hasAct = input.constitutionalAct !== null;

  if (!hasControl && !hasAct) return { ok: false, reason: 'both-proofs-missing' };
  // Wallet control alone is not delegation.
  if (!hasAct) return { ok: false, reason: 'constitutional-act-missing' };
  // Passport possession alone is not proof of agent control.
  if (!hasControl) return { ok: false, reason: 'agent-control-proof-missing' };

  return { ok: true };
}

export type BindResult =
  | { ok: true; binding: AgentIdentityBinding }
  | { ok: false; reason: ClaimRefusal | ClaimMessageFailure };

/**
 * The constructive path: BOTH proofs in, a binding record out.
 *
 * The claim message is re-verified here against the identity actually being
 * bound. Without that, a caller could present a valid signature over a message
 * naming token A and mint a binding for token B — the proof would be genuine and
 * the binding would still be a forgery.
 *
 * `delegationActive` and `runtimeAdmissionEligible` are REQUIRED INPUTS, not
 * inferences. The delegation's live status belongs to delegationGrantStore and
 * runtime admission belongs to the Financial Services Runtime; deriving either
 * from "we just bound successfully" is precisely the overcompression the
 * operator ruled against.
 *
 * `now` is the caller's clock, never `Date.now()`, so the whole ceremony is
 * reproducible in a test.
 */
export function bindAgentIdentity(input: {
  bindingId: string;
  agentRootDid: string;
  identity: HorizenAgentIdentity;
  agentControlProof: AgentControlProof | null;
  constitutionalAct: ConstitutionalAct | null;
  claimExpectation: AgentClaimMessageInput;
  /** From the delegation grant — NOT inferred from a successful bind. */
  delegationActive: boolean;
  /** From the Financial Services Runtime — admission is granted, not inherited. */
  runtimeAdmissionEligible: boolean;
  receiptCommitment?: string | null;
  now: string;
}): BindResult {
  const evaluated = evaluateOperatorClaim({
    agentControlProof: input.agentControlProof,
    constitutionalAct: input.constitutionalAct,
  });
  if (!evaluated.ok) return { ok: false, reason: evaluated.reason };

  const proof = input.agentControlProof!;
  const act = input.constitutionalAct!;

  // The expectation must describe the identity being bound — otherwise the
  // re-verification below would check the message against whatever the caller
  // felt like claiming.
  if (
    input.claimExpectation.tokenId !== input.identity.tokenId ||
    input.claimExpectation.network !== input.identity.network ||
    input.claimExpectation.chainId !== input.identity.chainId ||
    input.claimExpectation.ownerWallet !== proof.ownerAddress ||
    input.claimExpectation.nonce !== proof.nonce
  ) {
    return { ok: false, reason: 'claim-message-not-bound' };
  }

  const verified = verifyAgentClaimMessage(proof.claimMessage, input.claimExpectation, input.now);
  if (!verified.ok) return { ok: false, reason: verified.reason };

  return {
    ok: true,
    binding: {
      bindingId: input.bindingId,
      agentRootDid: input.agentRootDid,
      identity: input.identity,
      identityRegistry: input.claimExpectation.identityRegistry,
      ownerAddressAtBinding: proof.ownerAddress,
      bindingMethod: 'operator_claim',
      agentControlProof: proof,
      constitutionalAct: act,
      // The binding ceremony IS an ownership check — it read ownerOf and
      // verified a signature from that owner. Recording it as one is what
      // starts the freshness clock rather than leaving a fresh binding stale.
      ownershipCheckedAt: proof.verifiedAt,
      ownerWalletAtCheck: proof.ownerAddress,
      ownershipStatus: 'matches',
      ownershipCheckSource: proof.ownerObservation,
      facets: {
        ownershipVerified: true,
        operatorRelationshipClaimed: true,
        delegationActive: input.delegationActive,
        runtimeAdmissionEligible: input.runtimeAdmissionEligible,
      },
      effectiveFrom: input.now,
      effectiveTo: null,
      status: 'active',
      statusReason: null,
      supersededBy: null,
      receiptCommitment: input.receiptCommitment ?? null,
    },
  };
}

/**
 * The registry address to bind against for a network, as currently deployed.
 * A convenience over `HORIZEN_NETWORK_FACTS` so a claim builder never hand-types
 * a contract address — the binding still RECORDS the value it used, because
 * this constant is today's deployment and the record has to outlive it.
 */
export function currentIdentityRegistry(network: HorizenNetwork): string {
  return HORIZEN_NETWORK_FACTS[network].identityRegistry;
}
