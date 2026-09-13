# Vela Accelerator — Multi-Agent Namespace Investigation (Build-Order Item 3)

**Date:** 13 September 2026
**Status:** Investigation + additive, tested code. One item is a HARD BLOCKER for the next
build-order item (Use Case Zero vertical slice) and requires an operator/Vela-team decision —
see §5.
**Scope:** `docs/vela/accelerator/constitutional-financial-services/09_CLAUDE_IMPLEMENTATION_HANDOFF_v0.2.md`
"Phase 5 — multi-agent isolation." Build-order item 3 of 4 (P-521 derivation [done] →
asset-neutrality widening [done] → **this item** → Use Case Zero vertical slice [next]).

## 1. Preflight — resolution records and invariants reviewed

- `codexes/packs/agentiq/updates/2026-09-11_vela-accelerator-phase0-code-inventory.md` §2.3 (the
  open question this item answers), §1.1–§1.10 (what already exists and is correctly modeled).
- `RES-2026-09-11-VELA-AGENT-P521-CUSTODY-DERIVATION-001` / `CI-2026-09-11-EXISTING-CUSTODY-DERIVES-PROTOCOL-KEYS-NO-NEW-STORE-001`
  (build-order item 1 — read to confirm what identity/comms plumbing is already in place and not
  duplicate it).
- `RES-2026-09-13-VELA-ASSET-NEUTRALITY-TRANSPORT-001` / `CI-2026-09-13-VELA-ASSET-BEARING-REQUEST-ADDITIVE-001`
  (build-order item 2 — same reason; confirmed this item's work does not touch the transport layer
  those records own).
- `CI-2026-08-23-PER-AGENT-AUTHORITY-KEY-001` (delegation-grant composite-keying — the SAME general
  defect shape this item's namespace-key problem is an instance of, applied to a new substrate) and
  its sibling occurrence in `services/factor/useUseCaseZeroReadiness.ts`'s `storageKey()` and
  `services/financialServices/providers/providerWalletBinding.ts` — all three independently
  converged on "compose every relevant identity axis into the key," which is the same conclusion
  this item reaches for the Vela guest's future state.
- Canary/enforcement reviewed: none pre-existing for this specific gap (confirmed by grep — no
  party/contributor namespace pattern anywhere in `services/vela/`, `services/constitutionalCommerce/`,
  or `services/factor/factorConfidentialWorkload.ts`). This item's own new canary is
  `tests/vela-party-namespace.test.ts`.
- Unresolved risk this item does NOT invalidate, duplicate, bypass, or regress: build-order items 1
  and 2 are untouched (no changes to `agentP521Derivation.ts`, `velaClientAdapter.ts`'s asset-bearing
  path, or their tests — confirmed by the full test run in §6).
- Pre-existing, unrelated gap noticed while running the preflight script (`npm run report:resolutions`):
  it currently throws (`Cannot read properties of undefined (reading 'targets')`) because two
  candidate-invariant records from 2026-09-05 (`CI-2026-09-05-BATCH-PER-ITEM-SUBSTRATE-READS-BY-GROUPING-KEY-001`,
  `CI-2026-09-05-FROZEN-GENERATIONS-IMMUTABLE-LINEAGES-EVOLUTIONARY-001`) are missing a `projections`
  field. Confirmed pre-existing (not introduced by this session's merges) and out of this item's
  scope — flagged here rather than silently worked around.

## 2. The crux fact

**Does the WASM guest currently namespace private state per-contributor, or is it one
undifferentiated blob per `applicationId`?**

**One undifferentiated blob. Confirmed by reading the Go source directly, not inferred from the
TypeScript wrapper**, per this task's own instruction:

- `services/vela/wasm/projector/app/app.go:52-55` —
  `ApplicationInternalState{AppID uint64; ProjectionsHandled uint64}`. A single global counter per
  deployed application. No per-party field, no map, no subdivision of any kind.
- `services/vela/wasm/projector/app/app.go:108-153` (`ProcessRequest`) receives a REAL,
  protocol-given `sender *types.Address` — the on-chain Ethereum/Vela address that submitted the
  request (confirmed against `velaClientAdapter.ts`'s `RequestSubmitted(uint64 indexed applicationId,
  bytes32 indexed requestId, address indexed sender, address facilitator)` event). This is genuine,
  free, per-request contributor identity — Vela's own protocol already gives the guest a real way to
  tell requesters apart. But `app.go` uses `sender` for exactly one thing: addressing the encrypted
  `PlainEvent` verdict back to that caller (`app.go:149`, `Events: []types.PlainEvent{{UserID: sender,
  Data: eventData}}`). It is **never** used to key, read, or write any persisted state.
- This is safe TODAY, not a live leak: `project()` (`app.go:162-205`) is a pure, stateless-per-call
  comparison — no persisted per-user field exists for `sender` to accidentally collide against. The
  gap is structural absence, not an active defect: **there is no mechanism at all**, because nothing
  yet needs one.

## 3. Existing primitives found reusable — no new IAM system needed

Confirms the handoff's own instruction ("do not build a generalized IAM system if existing
iQube/persona/delegation primitives already provide this") was correct in this case:

| Handoff Phase 5 field | Existing primitive | Status |
|---|---|---|
| Contributor/party handle | `ConfidentialProjectionIdentitySet.authorityPrincipal` / `.confidentialPrivacyIdentity` (`types/confidentialProjection.ts:109-120`) — already opaque, T0-safe | Exists, unused for namespacing until this item |
| Ethereum/Vela communication identity | Build-order item 1's `agentP521Derivation.ts` (existing agent custody → P-521) | Already solved |
| Execution context | `ConfidentialProjectionRequest.actionRef`/`.publicContext` | Exists |
| Disclosure recipients | `services/qubetalk/disclosurePolicy.ts`'s `evaluateDisclosure()` — an audience-subset selective-disclosure check, already working for QubeTalk's own Communications Membrane | Pattern reusable; not literally imported (see §4) |
| Authority/mandate ref | `ConstitutionalAuthority.principalRef`/`.mandateRef` (`types/constitutionalCommerce.ts:38-47`) — opaque commitments | Exists |
| Permitted private-state namespace | **Nothing existed.** This item adds it. | New (additive, small) |

The multi-tenant composite-keying pattern this item's namespace-key derivation follows is not novel
either — it is the third independent occurrence of the same shape already found in this repo:
`services/financialServices/providers/providerWalletBinding.ts` keys on `(tenant_id, agent_runtime_id,
provider)`; `services/factor/useUseCaseZeroReadiness.ts`'s `storageKey()` keys on `(tenantId,
personaSessionToken, agentSlug)`; and the general rule was already stated as
`CI-2026-08-23-PER-AGENT-AUTHORITY-KEY-001` ("any durable store representing a principal's current
state must key on [principal, agent], never the principal alone"). This item applies the identical
discipline to a new substrate (a confidential-execution guest's own state) before a leak occurs in
it, rather than after.

The one-way commitment mechanism reused is also existing, not new:
`constitutionalRef(namespace, id)` (`services/identity/personaReferences.ts`) — the same sha256/16-hex
derivation `personaPublicRef()` uses, already the canonical helper for exactly this class of problem
(passport/delegation/agent-standing refs in `services/financialServices/constitutionalAuthorityAdapter.ts`).
Writing a second sha256 wrapper would have been the "parallel implementation of an existing
capability" CLAUDE.md's `inv.engineering.036`/`037` forbids.

## 4. What was built additively

`services/vela/velaPartyNamespace.ts` (new file — genuinely new standalone concern, no existing
home):

- `deriveVelaPartyNamespaceRef(applicationId, {authorityPrincipal, confidentialPrivacyIdentity})` —
  composes those two identity roles (the two that actually identify WHOSE private state this is,
  as opposed to `confidentialRequester`/`executionSigner`, which are technical/rotatable submission
  roles, or `mandateSigner`, which scopes one mandate rather than a durable party) + the
  `applicationId` into one `constitutionalRef('vela-party-namespace', ...)` commitment.
  Deterministic, one-way, fails closed on any missing input.
- `VelaDisclosureScope` + `isVelaCrossPartyAccessAuthorized()` / `assertVelaCrossPartyAccessAuthorized()`
  — added mid-task per the operator's mandatory acceptance-test requirement (§5.1). A fail-closed,
  per-`actionRef` (never standing) gate: self-access always authorized; any other requester
  authorized ONLY when explicitly named in `authorizedPartyNamespaceRefs` for that exact action.
  Reuses the same isSubset/audience-membership SHAPE `evaluateDisclosure()` already established in
  QubeTalk — not a literal import, because QubeTalk's `sensitivity` vocabulary does not mean
  anything for Vela evidence, but the same reusable pattern.

`tests/vela-party-namespace.test.ts` (new file, 15 tests) — determinism, within-app isolation,
cross-app non-correlation, fail-closed inputs, reuse of `constitutionalRef` (asserted directly),
no plaintext leakage, no collisions across 500 samples, plus the 6-test cross-party-disclosure-gate
suite described in §5.1.

**Deliberately NOT touched:** `types/confidentialProjection.ts` (the frozen four-standing-ruling
domain seam — adding a field there before Phase 11 designs the actual multi-party state model risks
locking in a shape that has to be redesigned), and `services/vela/wasm/projector/app/app.go` (see
§5).

## 5. Hard blocker for Phase 11 — operator/Vela-team decision required

Mid-task, the operator added a mandatory, verbatim acceptance test:

> "Party A must be unable to cause Party B's confidential state to be read, combined, disclosed, or
> emitted unless the exact transaction/disclosure scope authorizes it."

### 5.1 What is fully satisfied today

`tests/vela-party-namespace.test.ts`'s cross-party-disclosure-gate suite proves this property BOTH
ways for TS-side evidence handling (code that runs AFTER a request leaves the Vela guest):

- Party B is DENIED reading/combining/disclosing Party A's state with no scope (the default), and
  even with an explicit-but-empty authorized list.
- Party B IS ALLOWED when the exact transaction (`actionRef`) explicitly names Party B as authorized
  — the legitimate multi-party-consent path, proving this is a real scope check, not a blanket
  lockout.
- An authorization for one `actionRef` never carries over to a different one (no standing grant).
- A third, unnamed party never inherits an authorization scoped to a different requester.

### 5.2 What is NOT satisfied, and cannot be satisfied by TS-side code alone

Today's WASM guest receives **no disclosure scope in its payload at all** —
`prepareProjection()` (`services/vela/velaProjectionProvider.ts:125-148`) serialises only
`confidentialInputs` + `publicContext`, never `identities` — and is stateless/single-participant, so
there is currently nothing for a scope to protect. But the INSTANT Phase 11 builds a stateful guest
that combines or reads more than one contributor's private input in a single execution, if that
guest does not itself check an equivalent authorized-scope list **before combining data inside the
enclave**, the required property is violated at the moment of computation — and no wrapper running
outside the TEE can retroactively undo an unauthorized combination that already happened inside it.

**This is a hard blocker for Phase 11 (the Use Case Zero vertical slice) and any underwriting/
multi-party pilot work — not a caveat to note in passing.** It must be resolved, by an explicit
operator/Vela-team decision, before that work proceeds. The two options:

**Option (a) — Guest-side enforcement.** Extend `app.go` (or design the new stateful guest) so the
guest's frozen input envelope carries an explicit authorized-namespace-refs list per contributor,
and the guest itself refuses to combine, read, or emit any data belonging to a party not in that
list — enforced INSIDE the enclave, before any cross-party computation happens. This is real,
non-trivial guest-side engineering (Go), and — per this task's own scoping instruction — is
correctly Phase 11's job, not this item's; attempting it here would be a speculative WASM change
with no concrete multi-party state model yet to enforce against.

**Option (b) — Structural avoidance for the first slice.** Rule that the first Use Case Zero
vertical slice never asks a single guest call to combine more than one party's confidential input.
Each party's state stays in its own guest call/request; any legitimate cross-party combination
(e.g. a shared liquidity pool's aggregate exposure) happens only in an already-consented,
already-disclosed frozen envelope BEFORE submission — i.e. the parties agree what to combine and
how outside the TEE, and the guest only ever evaluates one party's already-authorized inputs per
call. This avoids the in-enclave enforcement problem entirely for v1, at the cost of not supporting
genuine in-enclave multi-party secrecy (e.g. two parties each contributing a number neither
discloses to the other, with only the combined verdict revealed) until option (a) is built.

This decision also determines (and is the SAME decision as) Phase 0's still-open question #2 — does
the multi-party pilot extend the existing stateless `app.go` projector, or ship as a separate guest?
— restated here because it is now load-bearing for the acceptance property, not merely an
architecture-tidiness question.

**This gap is already, independently, a live Vela-team-facing question, not only an internal one.**
`docs/vela/accelerator/constitutional-financial-services/08_VELA_OFFICE_HOURS_QUESTIONS_2026-09-11.md`
Priority A, questions 3–4, ask the Vela team directly: *"For a multi-agent app, what state-namespace
pattern do you recommend for independent organizations using the same app?"* and *"Can one request
safely include contributions from several users/agents if the WASM enforces the logical
authorization and disclosure rules?"* — as of this investigation, that document carries no recorded
Vela-team answer. This means the hard blocker in §5.2 is gated on TWO answers, not one: an internal
operator ruling on option (a) vs (b) above, AND (if option (a) is chosen) Vela's own guidance on
whether/how the platform itself expects multi-party WASM apps to enforce this — do not treat this as
resolved once the operator rules; confirm the office-hours answer lands before Phase 11's guest
design is finalized.

## 6. Test results

Narrow suite:
```
tests/vela-party-namespace.test.ts — 15 passed (15)
```

Broader Vela/constitutional-commerce suite (confirms build-order items 1 and 2, and every
adjacent seam, are untouched and still green):
```
tests/unified-consequence-projection.test.ts             — 50 passed
tests/vela-slice2f-capability-invocation.test.ts          — 20 passed | 1 skipped
tests/vela-slice2g-execution-observation-validation.test.ts — 20 passed | 1 skipped
tests/vela-confidential-projection-provider.test.ts       — 31 passed
tests/qubetalk-confidentiality.test.ts                    — 37 passed
tests/vela-agent-p521-derivation.test.ts                  — 18 passed
tests/factor-vela-confidential-workload.test.ts           — 8 passed
tests/vela-asset-bearing-request.test.ts                  — 12 passed
tests/vela-config-early-access.test.ts                    — 9 passed
tests/vela-party-namespace.test.ts                        — 15 passed
```
Full-repo `npx vitest run` result and noise-floor comparison recorded in this session's final
report.

## 7. Readiness

Investigation complete; namespace-key derivation and the out-of-enclave disclosure gate are built,
tested, and additive (no existing file's behavior changed). **The Use Case Zero vertical slice
(build-order item 4) must NOT proceed until the operator/Vela-team has ruled on §5's option (a) vs
(b)** — proceeding without that ruling risks building a multi-party guest that violates the
mandated acceptance property at the point of computation, which is exactly the failure mode this
investigation exists to prevent.
