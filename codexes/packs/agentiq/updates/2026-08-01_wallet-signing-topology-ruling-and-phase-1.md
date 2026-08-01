# Wallet Signing Topology — Operator Ruling (2026-08-01) + Phase 1

## Status: Ruling recorded in full. Phase 1 (Register stage) shipped. Phases 2-5 backlog, scoped below.

---

## 1. The canonical rule (verbatim, operator ruling 2026-08-01)

> The principal wallet signs authority and mandate. The agent wallet signs control,
> acceptance and execution. The Citizen Passport supplies authority context for the
> principal's signature but is not itself a signing key.

## 2. Per-stage signer/role table (verbatim)

| Stage | Signer | Act |
|---|---|---|
| **Register** | Principal wallet | Signs a registration mandate |
| | Agent wallet | Signs the Horizen registry transaction (it is the registered controller) |
| | — | Horizen reread confirms completion |
| **Verify** | Principal wallet | Signs explicit Pulse/P&L disclosure authorization, bound to the Citizen Passport and subject agent |
| | Agent wallet | Signs the partner mutation only where Horizen requires the registered controller |
| | — | Horizen reread confirms activation |
| **Claim** | Agent wallet | Signs a fresh, expiring control challenge |
| | — | Recovered signer must match the Horizen registry controller |
| | — | Marketa FINAL assessment follows only after that proof |
| **Passport** | Principal wallet | Signs application and acceptance |
| | Passport Bureau | Signs the issued Citizen Passport |
| **Delegate** | Principal wallet | Signs bounded delegation |
| | Agent wallet | Countersigns acceptance |
| | Passport Bureau | Signs the Delegate Passport |
| **Activate** | Principal wallet | Signs the activation mandate |
| | Agent wallet | Signs agent-side deployment/execution acts |
| | Aigent Z | Executes only within the mandate and records receipts |

## 3. Governing interaction (verbatim)

> stage prepares the act → correct wallet signs → authoritative system confirms →
> resulting credential, binding or receipt opens in the wallet

Journey buttons must no longer complete consequential stages directly. They prepare
the request and open the appropriate wallet drawer focused on the pending action.

## 4. Bounded Sign capability — required (verbatim requirements)

Add a bounded Sign capability to both principal and agent wallet drawers. **Never
expose arbitrary raw-message signing.** Show purpose-specific pending actions:

- Authorize registration
- Sign registry transaction
- Authorize Pulse/P&L disclosure
- Prove wallet control
- Sign Passport application
- Claim Citizen Passport
- Grant bounded delegation
- Accept delegation
- Sign activation

Each signing request must identify: **signer, signing role, authority credential,
subject, wallet, network, exact consequence, expiry, receipt destination.**

## 5. Citizen Passport journey (verbatim)

```
Class → Account → Personhood → Consents → Submit → Pending → Claim
```

Submit requests a principal-wallet application signature. After approval and issuer
creation, Claim requests principal acceptance and places the Citizen Passport into
the principal wallet. Preserve distinct states for submitted, approved, issued,
available-to-claim, claimed, and active. **Operator clarification: Pending and Claim
can be the same UI stage with just a state change** — not necessarily two screens.

Delegate Passports follow the same lifecycle: principal grants delegation → agent
accepts → issuer creates Delegate Passport → agent wallet binds/claims it.

## 6. Other rules (verbatim)

- Add a Pending actions section to each wallet so prepared signature requests are
  directly visible. Opening a wallet from a Journey stage must focus the exact
  request, not its generic home state.
- Do not treat persona adoption as custody transfer. Resolve principal authority,
  wallet control, and mandate independently before exposing any signature action.
- Canonical product rule: *the Journey explains and orders the act; the wallet
  authorizes or executes it; the resulting authority and evidence live visibly in
  the wallet.*

---

## 7. Current-state audit (Explore-agent research, 2026-08-01, before any code changed)

Full findings preserved here since they shaped every phase-scoping decision below.

### 7.1 SIGNING-SPINE-001 (`2026-07-31_signing-spine-001-deferred-capability.md`)

Already on record: wallet signing is fragmented across 4 disparate paths with no
unified custody boundary (`agentKeyService`, persona wallet's `keyService`/
`personaPaymentService`/`sessionService`, the Passport Bureau's env-keyed issuer
signer, and one-off CLI env-key scripts). Deferred pending "a second partner-
authorization flow, a second signing consumer of `agentKeyService`, or an
operator-flagged incident" — **this ruling is exactly that trigger.**

### 7.2 What already matches the target shape

- `services/signing/partnerAuthorizationSigner.ts` — the "resolve inside the
  signing function, key never leaves the stack frame" pattern this ruling should
  generalize to every agent-wallet signature (Verify's authorize route and Claim's
  prove-control route already use it).
- `services/journey/resolveJourneyState.ts` — evidence-only stage completion
  (a stage is COMPLETE only when its `completionEvidence` fields are all present),
  which is compatible with "journey never completes a stage directly" — it just
  needs its evidence populated by real signed receipts, not by a bare button POST.
- `services/passport/passportWizardSteps.ts` / `passportStatusMachine.ts` —
  branching-by-subject Citizen/Delegate step machine with real, separate status
  enums already exists; extending it to the wallet-signed Submit/Claim ceremony is
  additive, not a rewrite.
- `app/components/wallet/UnlockModal.tsx` + `services/wallet/sessionService.ts` +
  `services/wallet/keyService.ts` (`signMessage`/`signTransaction`) — a real,
  already-built, password-derived principal-wallet signing primitive. **Never wired
  to any UI call site.** This is the principal-wallet signer Phase 2+ should surface
  through the wallet drawer's new Pending Actions section — not a new signer to
  invent.

### 7.3 Real structural gaps found

- **(Fixed in Phase 1 below)** Register's prepare/broadcast signed with a static
  per-agent env var (`MONEYPENNY_OWNER_WALLET_PRIVATE_KEY` /
  `NAKAMOTO_OWNER_WALLET_PRIVATE_KEY`), the one stage NOT using the agent's own
  `agent_keys`-custodied wallet Verify/Claim already sign with.
- **Three Passport-stage completion receipts have zero real emitters anywhere in
  the codebase**: `operator_passport_validated`, `agent_sponsorship_recorded`,
  `agent_delegate_passport_issued`. The Passport stage **cannot structurally reach
  COMPLETE today** regardless of any UI work, because `resolveJourneyState` waits on
  evidence nothing ever writes.
- **Two disconnected Delegate Passport implementations, neither wired to the
  journey**: `services/passport/externalAgentAdmission.ts` (deliberately minimal,
  explicitly not the generalized framework, forbids onward delegation) and
  `services/homecoming/issueDelegatePassport.ts` (real, working, but scoped to the
  separate Agent Homecoming/CFS-023 program and its own admin-review path — and it
  emits `passport_issued`, not the `agent_delegate_passport_issued` the journey
  actually watches for).
- **Persona-wallet signing (`personaPaymentService`) is fully unwired from any UI**
  — real backend, zero callers.
- **No "Pending actions" surface exists anywhere** — SmartWalletDrawer has no
  signing UI at all (every "sign" hit in that 5,787-line file is Supabase email
  auth, not cryptographic signing).
- Register/Verify/Claim/Delegate/Activate stage buttons today are **plain API
  button-clicks with no wallet-mediated confirmation step** — exactly the pattern
  this ruling replaces with prepare → sign → confirm → open-in-wallet.
- Claim's control-proof (`controlProofChallenge.ts` + `partnerAuthorizationSigner.ts`)
  IS fresh + expiring + signature-verified-against-the-registered-controller, but
  it is an entirely server-custodial signature (the agent's own key, decrypted
  server-side) — there is no client-side/browser-wallet interaction anywhere in the
  journey today. `services/horizen/operatorClaim.ts` already models an
  operator-external-wallet-signs-a-nonce'd-challenge pattern, but it's wired only to
  Venture workspace agent-claim, not this journey — a second reference pattern worth
  reusing for the Passport/Delegate stages' principal-signature requirements.

---

## 8. Phase plan

### Phase 1 — DONE (2026-08-01, this session)

**Register stage: agent-wallet signing swap.** `services/horizen/registrableAgents.ts`'s
`ownerPrivateKeyEnvVar` field removed entirely (not left as dead config).
`services/horizen/registrationClient.ts`'s `resolveOwnerWalletAddress` and
`app/api/journey/moneypenny-horizen/register/broadcast/route.ts`'s private-key
resolution now both go through `AgentKeyService`, keyed by `agent.runtimeAgentId`
— the exact same `AGENT_KEY_REF` Verify's authorize route and Claim's prove-control
route already sign with. Register is no longer the one stage with a separate
signing path. Tests: `tests/horizen-registration-client.test.ts`,
`tests/horizen-register-routes.test.ts`, `tests/horizen-registrable-agents.test.ts`
(all updated/extended, full suite green).

**Not yet done in Phase 1** (scoped to Phase 2+ below): the PRINCIPAL-wallet side of
Register ("principal wallet signs registration mandate") — the operator's own
sign-off before the agent-wallet transaction fires — because that requires the
wallet-drawer Pending Actions surface and a real principal-wallet signer wired to
UI, neither of which exist yet (§7.3). Today Register still starts from the
operator's authenticated persona (`getActivePersona`) and an explicit `confirm: true`
click, not a cryptographic principal-wallet signature. Phase 2 below closes this.

### Phase 2 — Wallet Sign capability + Pending Actions (not started)

1. A `SigningRequest` data model (signer role, authority credential, subject,
   wallet, network, consequence, expiry, receipt destination, status) + a
   `signing_requests` store — the "stage prepares the act" object.
2. Wallet drawer: a Pending Actions section (principal AND agent wallets) rendering
   the 9 named purpose-specific actions — never raw message signing. Wires the
   ALREADY-BUILT `UnlockModal`/`sessionService`/`keyService.signMessage` principal
   signer to a UI call site for the first time.
3. Journey stage buttons across Register/Verify/Claim/Passport/Delegate/Activate
   stop completing stages directly; each becomes "prepare the request, open the
   wallet focused on it."
4. Register's principal-mandate signature (the piece Phase 1 deferred) is the
   first real consumer of this new surface.

### Phase 3 — Verify/Claim wiring to the new pattern (not started)

Rewire Verify's disclosure-authorization and Claim's control-proof UI entry points
to go through the Phase 2 Pending Actions surface instead of their current
direct-button-click shape. The underlying signers
(`partnerAuthorizationSigner.ts`/`authorizationClient.ts`) are already correct and
don't need to change — only their UI entry point does.

### Phase 4 — Passport/Delegate lifecycle + the 3 dead receipt emitters (not started)

1. Wire real emitters for `operator_passport_validated`, `agent_sponsorship_recorded`,
   `agent_delegate_passport_issued` — the Passport stage cannot complete without
   these regardless of any signing UX.
2. Extend the Citizen Passport wizard's Submit/Claim steps to request the
   principal-wallet signatures this ruling specifies (§5), using Phase 2's Pending
   Actions surface. Per operator clarification, Pending and Claim may render as one
   UI stage with a state change — no separate screen required.
3. Decide and implement ONE Delegate Passport path (unify or explicitly supersede
   `externalAgentAdmission.ts` vs `issueDelegatePassport.ts` — see §7.3) that emits
   the receipt type the journey actually watches for.

### Phase 5 — Activate stage signing (not started)

Principal activation-mandate signature + agent-side execution signature, per §2's
table — depends on Phases 2 and 4 landing first (the Pending Actions surface and a
working Delegate Passport as activation's prerequisite).

---

## Why phased rather than all-at-once

This ruling's own scope note applies literally: it replaces a security-sensitive,
previously-unverified-in-a-browser signing surface (persona wallet signing has
NEVER been wired to any UI — §7.2) across six journey stages simultaneously. Landing
all of it in one untested pass risks exactly the "fix one thing, break everything
else" failure this session already hit once with the Companion regression (2026-08-01,
same day). Phase 1 is complete, tested, and low-risk (server-side only, mirrors an
already-shipped pattern). Phases 2-5 are recorded here as the explicit, ordered
backlog rather than attempted speculatively.
