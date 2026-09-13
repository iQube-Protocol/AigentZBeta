/**
 * Vela party-namespace reference — Vela accelerator build-order item 3
 * (docs/vela/accelerator/constitutional-financial-services/09_CLAUDE_IMPLEMENTATION_HANDOFF_v0.2.md
 * "Phase 5 — multi-agent isolation").
 *
 * WHAT THIS IS: a deterministic, T0-safe (opaque, one-way) commitment that
 * names WHICH CONTRIBUTOR'S SLICE of private state a confidential-projection
 * request belongs to, inside ONE shared Vela `applicationId`. It exists so
 * that a future STATEFUL multi-party confidential guest (the Use Case Zero
 * liquidity/coverage pilot,
 * `docs/vela/accelerator/constitutional-financial-services/05_ACCELERATOR_USE_CASE_ZERO_SPEC_v0.1.md`
 * §4/§15 — not yet built) has a ready-made, tested key to partition its own
 * internal state map by contributor, without inventing a new identity/IAM
 * system — composing ONLY the identity roles `ConfidentialProjectionIdentitySet`
 * already defines (`types/confidentialProjection.ts`).
 *
 * WHAT THIS IS NOT (yet): this function is NOT wired into
 * `prepareProjection()`/`submitProjection()` (services/vela/velaProjectionProvider.ts),
 * and the WASM guest (services/vela/wasm/projector/app/app.go) does not
 * consume it — today's guest keeps ONE global
 * `ApplicationInternalState{AppID, ProjectionsHandled}` with no per-party
 * subdivision at all, because the current projector is a pure,
 * stateless-per-call comparison (see app.go's own header: "It moves no funds
 * and holds no balances of its own"). Whether the eventual multi-party pilot
 * EXTENDS that guest or ships as a separate one is an open architecture
 * question this module deliberately does not decide (see the accompanying
 * update doc `codexes/packs/agentiq/updates/2026-09-13_vela-accelerator-multi-agent-namespace-investigation.md`
 * for the exact decision the operator/Vela-team needs to make before that
 * guest is built) — this module only proves the KEY DERIVATION half of the
 * problem is solvable additively, today, independent of that decision.
 *
 * WHY sha256/16-hex, not a new hashing scheme: `constitutionalRef()`
 * (services/identity/personaReferences.ts) is the repo's EXISTING, canonical,
 * namespaced one-way commitment helper — the same derivation
 * `personaPublicRef()` uses (sha256 hex, first 16 chars), already reused for
 * passport/delegation/agent-standing refs. Writing a second sha256 wrapper
 * here would be exactly the "parallel implementation of an existing
 * capability" CLAUDE.md's inv.engineering.036/037 forbids — this module
 * composes `constitutionalRef`, it does not reinvent it.
 *
 * WHY (authorityPrincipal, confidentialPrivacyIdentity), not all five roles:
 * of the five `ConfidentialProjectionIdentitySet` roles, `authorityPrincipal`
 * (whose authority the action is taken under) and `confidentialPrivacyIdentity`
 * (who may decrypt the confidential inputs/results — "distinct from the
 * submitter on purpose") are the two that actually identify WHOSE private
 * state this is. `confidentialRequester` and `executionSigner` are technical/
 * submission roles that carry no authority and may legitimately differ call
 * to call for the SAME party (e.g. a rotated signing key); keying the
 * namespace on them would fragment one party's state across multiple
 * namespace refs. `mandateSigner` scopes ONE mandate, not a durable party
 * identity, and is deliberately excluded so the SAME party's namespace stays
 * stable across separate mandates against the same app.
 *
 * WHY the applicationId is folded in: the SAME two identity values must
 * never collide across two DIFFERENT Vela applications — that would let an
 * observer correlate a party's namespace ref between two unrelated
 * deployments (the same BlakQube-compartmentalisation concern CLAUDE.md's HMS
 * Identifier Isolation section states for case-scoped locker refs, applied
 * here to Vela app-scoped party refs).
 *
 * PATTERN PRECEDENT (this is a well-worn shape in this repo, not a novel
 * design): every existing "does this store need composite keying" defect
 * found so far had the SAME root cause — a durable store keyed on fewer axes
 * than its true cardinality, generalized in
 * `CI-2026-08-23-PER-AGENT-AUTHORITY-KEY-001` ("any durable store
 * representing a principal's current state MUST key on [principal, agent] —
 * never the principal alone — whenever the principal may structurally act
 * through more than one agent") and independently re-occurring in
 * `services/factor/useUseCaseZeroReadiness.ts`'s `storageKey()` (tenantId +
 * personaSessionToken + agentSlug, "two different identities never share a
 * resume slot") and `services/financialServices/providers/providerWalletBinding.ts`
 * (tenant_id, agent_runtime_id, provider). This module applies the identical
 * discipline to a NEW substrate (a confidential-execution guest's own
 * internal state), before the substrate exists, rather than after a leak is
 * found in it.
 *
 * Server-side only (imports the same identity-commitment surface the
 * financial-services authority adapter already imports).
 *
 * ---------------------------------------------------------------------
 * ACCEPTANCE PROPERTY (operator-mandated, 2026-09-13) and its boundary
 * ---------------------------------------------------------------------
 *
 * "Party A must be unable to cause Party B's confidential state to be read,
 * combined, disclosed, or emitted unless the exact transaction/disclosure
 * scope authorizes it."
 *
 * `VelaDisclosureScope` + `isVelaCrossPartyAccessAuthorized()` /
 * `assertVelaCrossPartyAccessAuthorized()` below implement this as a
 * fail-closed, per-transaction (`actionRef`-scoped, never a standing grant)
 * gate — the same isSubset/audience-membership SHAPE
 * `services/qubetalk/disclosurePolicy.ts`'s `evaluateDisclosure()` already
 * uses for QubeTalk's own selective-disclosure boundary, generalised here to
 * opaque Vela party-namespace refs rather than QubeTalk participant ids (a
 * literal import from that module was deliberately rejected — see this
 * resolution's rejectedApproaches — because QubeTalk's `sensitivity`
 * vocabulary does not mean anything for Vela evidence; the reusable part is
 * the AUDIENCE-MEMBERSHIP CHECK, not the QubeTalk type).
 *
 * WHAT THIS GATE ACTUALLY PROTECTS, PRECISELY: any TS-SIDE code that reads,
 * combines, or discloses confidential-projection evidence ONCE IT HAS LEFT
 * the guest (e.g. a future multi-party evidence aggregator, a receipt that
 * would otherwise fold two parties' verdicts together). It is tested and
 * enforces the required property completely for that layer — see
 * `tests/vela-party-namespace.test.ts`'s cross-party-disclosure suite for
 * both the denial case and the explicitly-authorized-disclosure case.
 *
 * WHAT THIS GATE CANNOT PROTECT, AND WHY THAT IS A SEPARATE, STILL-OPEN,
 * BLOCKING GAP: today's WASM guest (`app.go`) does not receive ANY
 * disclosure scope as part of its request payload (`prepareProjection()`
 * serialises only `confidentialInputs` + `publicContext` — never
 * `identities` — see this file's own header above), and — being stateless
 * and single-participant — has no concept of "another party's state" to
 * guard in the first place. The MOMENT a stateful multi-party guest is
 * built (Use Case Zero, this repo's NEXT build-order item), if that guest
 * combines or reads more than one contributor's private input WITHOUT
 * itself checking an equivalent authorized-scope list BEFORE combining them
 * INSIDE THE ENCLAVE, this TS-side gate cannot retroactively enforce the
 * required property — by the time evidence leaves the TEE, an
 * unauthorized combination inside it has already happened and cannot be
 * undone by a wrapper outside. Closing that gap requires either (a) a
 * guest-side change so the guest itself receives and enforces an
 * authorized-namespace-refs list before combining any two parties' inputs,
 * or (b) an operator ruling that the first vertical slice never asks a
 * single guest call to combine two parties' confidential inputs at all
 * (each party's state stays in its own guest call, and any legitimate
 * cross-party combination happens only in an already-consented, already-
 * disclosed frozen envelope BEFORE submission). See the accompanying update
 * doc for this decision stated as an explicit, operator-facing question —
 * it is NOT decided by this item and MUST be resolved before Phase 11 can
 * safely proceed with any guest that holds more than one party's state.
 */

import { constitutionalRef } from '@/services/identity/personaReferences';
import type { ConfidentialProjectionIdentitySet } from '@/types/confidentialProjection';

/** `constitutionalRef`'s namespace prefix for this ref family. Changing this
 *  changes every previously-derived namespace ref — do not change casually. */
const VELA_PARTY_NAMESPACE_PREFIX = 'vela-party-namespace';

export type VelaPartyNamespaceIdentities = Pick<
  ConfidentialProjectionIdentitySet,
  'authorityPrincipal' | 'confidentialPrivacyIdentity'
>;

/**
 * Deterministically derives the party-namespace ref for one contributor
 * within one Vela application.
 *
 * Deterministic + idempotent: the SAME (applicationId, authorityPrincipal,
 * confidentialPrivacyIdentity) triple always yields the SAME ref, so a
 * future stateful guest (or the TS-side code preparing its request) can
 * re-derive it on demand rather than needing to persist it separately.
 *
 * One-way: per `constitutionalRef`'s own sha256 derivation, the ref cannot be
 * reversed to recover the identity values that produced it — safe to appear
 * in a request's `publicContext` (non-confidential, per
 * `ConfidentialProjectionRequest.publicContext`'s own contract) once this
 * function is actually wired into a caller.
 *
 * Fails closed (throws) on a missing applicationId or identity value rather
 * than silently deriving a ref from a partial/empty input that could collide
 * with another party's — a missing identity must never quietly resolve to
 * "no namespace" (which would look, to a future stateful guest, like shared
 * state was intentional).
 */
export function deriveVelaPartyNamespaceRef(
  applicationId: string,
  identities: VelaPartyNamespaceIdentities,
): string {
  if (!applicationId) {
    throw new Error('deriveVelaPartyNamespaceRef: applicationId is required');
  }
  if (!identities.authorityPrincipal) {
    throw new Error('deriveVelaPartyNamespaceRef: identities.authorityPrincipal is required');
  }
  if (!identities.confidentialPrivacyIdentity) {
    throw new Error('deriveVelaPartyNamespaceRef: identities.confidentialPrivacyIdentity is required');
  }
  return constitutionalRef(
    VELA_PARTY_NAMESPACE_PREFIX,
    `${applicationId}:${identities.authorityPrincipal}:${identities.confidentialPrivacyIdentity}`,
  );
}

// ── Cross-party disclosure gate ─────────────────────────────────────────

/**
 * A per-transaction disclosure scope: WHO, besides the owning party, may
 * read/combine/receive a disclosure of `ownerPartyNamespaceRef`'s
 * confidential state, FOR THIS EXACT `actionRef` only.
 *
 * Deliberately scoped to one `actionRef`, never a standing/durable grant —
 * mirrors `ConfidentialProjectionRequest.actionRef`/`mandateRef`
 * (types/confidentialProjection.ts) and the handoff's own Phase 2 "permitted
 * output/disclosure class" field (a frozen-envelope concept the handoff
 * names but this repo has not yet implemented as a type — this is a first,
 * narrow, party-namespace-scoped slice of it, not the full field).
 * `authorizedPartyNamespaceRefs` defaults to nothing: an absent or empty
 * list means ONLY the owner may access their own state for this action —
 * the fail-closed default this gate exists to guarantee.
 */
export interface VelaDisclosureScope {
  actionRef: string;
  ownerPartyNamespaceRef: string;
  /** Other parties' namespace refs explicitly authorized to read/combine/
   *  receive disclosure of the owner's state, FOR THIS actionRef only.
   *  Never inferred — only ever populated by an actual, consented
   *  multi-party authorization act (e.g. every participant in a shared
   *  liquidity-portfolio pilot explicitly agreeing to a specific shared
   *  field). Absent/empty by default. */
  authorizedPartyNamespaceRefs?: string[];
}

/**
 * True iff `requestingPartyNamespaceRef` may read/combine/receive disclosure
 * of `scope.ownerPartyNamespaceRef`'s confidential state for `scope.actionRef`.
 *
 * Fail-closed: self-access (the owner reading their own state) is always
 * authorized; every other requester is authorized ONLY when explicitly
 * named in `authorizedPartyNamespaceRefs` for THIS scope. An absent or empty
 * list denies every non-owner requester — there is no default-allow path.
 */
export function isVelaCrossPartyAccessAuthorized(
  scope: VelaDisclosureScope,
  requestingPartyNamespaceRef: string,
): boolean {
  if (requestingPartyNamespaceRef === scope.ownerPartyNamespaceRef) return true;
  return (scope.authorizedPartyNamespaceRefs ?? []).includes(requestingPartyNamespaceRef);
}

/**
 * Same check as `isVelaCrossPartyAccessAuthorized`, as a guard a caller can
 * drop directly in front of any code path that would read, combine,
 * disclose, or emit a party's confidential evidence to another party —
 * throws rather than returning false so an unauthorized combination cannot
 * be accidentally ignored by a caller that forgets to check a boolean.
 */
export function assertVelaCrossPartyAccessAuthorized(
  scope: VelaDisclosureScope,
  requestingPartyNamespaceRef: string,
): void {
  if (!isVelaCrossPartyAccessAuthorized(scope, requestingPartyNamespaceRef)) {
    throw new Error(
      `assertVelaCrossPartyAccessAuthorized: party "${requestingPartyNamespaceRef}" is not authorized ` +
        `to access party "${scope.ownerPartyNamespaceRef}"'s confidential state for action "${scope.actionRef}" — ` +
        'no matching entry in authorizedPartyNamespaceRefs and requester is not the owner.',
    );
  }
}
