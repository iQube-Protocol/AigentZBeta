# CFS-043 — Agent-Guided Passport & Delegation Onboarding

**Chrysalis Foundation · Constitutional Charter · Status: PROPOSED (docs-only, ratify-before-build)**
**Date:** 2026-07-18
**Composes:** the Constitutional Agreement primitive (`services/constitutional/constitutionalAgreement.ts`: `formAgreement` · `acceptAgreement` · `authorizeAgreement` · `requireAuthorizedAgreement`), the x409/Consenti acceptance provider (`services/constitutional/agreementProviders.ts`), the Polity Passport, and CFS-042 (external result submission — the first instance of this pattern).
**Distribution:** Marketa (agent recruitment + guided-onboarding distribution); **Pilot context:** Horizen agents, Austin's EXP-P1 agent.

---

## 1. The idea

An agent can **guide its own principal through getting a Polity Passport and delegating bounded authority back to the agent.** Austin's agent walks Austin through (a) applying for his Passport and (b) forming + authorizing a bounded delegation that lets the agent act on his behalf — e.g. submit experiment results (CFS-042). The onboarding *is* the agent helping the human enter the constitutional operating model.

This is a superb UX primitive and a **distribution flywheel**: package the guided flow, distribute it via Marketa, and **agents recruit their sponsors** — an agent that wants delegated authority guides a human into sponsoring it (issuing the passport + granting the bounded delegation). The agent is the on-ramp; the human is the sovereign who grants. It generalizes cleanly from Austin to every Horizen agent and beyond.

The reason this is safe to build — and safe to distribute at scale — is that the constitutional agreement lifecycle **already makes it impossible for an agent to sponsor or delegate authority to itself.** This charter names that guarantee, grounds it in the code, and specifies the one design requirement that keeps it airtight.

---

## 2. The central law — Principal–Delegate Separation (no self-sponsorship, no self-delegation)

> **An agent may guide every step of passport application and delegation, but it can never be the party that grants the authority. Sponsorship and authorization are acts of the human principal, performed under the principal's own authentication — structurally distinct from the agent's role as delegate.**

This is not a policy we bolt on; it falls out of the agreement lifecycle's shape:

| Guarantee | Enforced by | Code |
|---|---|---|
| **Only the human principal may authorize** | `authorizeAgreement` refuses unless `agreementOwnerCommitment(personaId)` matches the agreement's `ownership.ownerCommitment` — the authorizer must be the owning human persona | `constitutionalAgreement.ts:457-460` |
| **Acceptance ≠ authorization** | The agent may `accept` (its side, `acceptorType:'agent'`), but `requireAuthorizedAgreement` only opens on `authorized` status — acceptance alone never opens the gate | `constitutionalAgreement.ts:354`, `:529`; `GATE_OPEN_STATUSES` |
| **Delegate ≠ owner** | The delegate is `selectedAgentRef`; the owner/authorizer is the human persona (`ownerCommitment`). They are different fields, different parties. An agent cannot occupy the owner slot | `formAgreement(personaId, …)` sets ownership to the forming human persona |
| **Ownership is the forming human's** | `formAgreement` binds `ownerCommitment = agreementOwnerCommitment(personaId)` — the persona that forms owns; an agent isn't a persona-with-owner-commitment in this flow | `constitutionalAgreement.ts:296` |

**Therefore:** an agent that drafts an agreement naming *itself* as `selectedAgentRef` and accepts it (its side) still cannot make the gate pass. The gate stays closed until a **human principal** — the owning persona, authenticated as themselves — authorizes. Self-delegation (agent grants itself authority) and self-sponsorship (agent brings itself into existence as its own sponsor) are both structurally unreachable: both require occupying the owner/authorizer slot, which is bound to a human persona commitment the agent does not hold.

### 2.1 The one design requirement — resolved by GRADED proof-of-humanity

The guarantee is only as strong as the **identity boundary between "agent acting" and "human authorizing."** If the guiding agent could perform the `authorize` call *under the human's own authenticated persona*, the separation would be cosmetic. The build MUST therefore make `authorize` a **human-present action** — and the platform already ships a *graded* proof-of-humanity ladder to prove human presence at the right strength for the risk:

> **Proof-of-humanity strength scales with contract risk. The `authorize` step requires a personhood proof graded to what is being delegated — weak by default, strong for sensitive/money-moving contracts.** The platform's ladder (`services/passport/personhoodProof.ts`: `PersonhoodProofType = 'captcha' | 'world_id' | …`) distinguishes **weak** (Cloudflare Turnstile CAPTCHA) from **strong** (Worldcoin World ID → `passport_grade = 'verified_citizen'`, `world_id_verified_at`). The required grade is read from the contract itself:

| Contract risk (from the `DelegatedAuthority`) | Required proof-of-humanity | Example |
|---|---|---|
| Low — read/write, `valueCeiling: null`, no settlement | **Weak (captcha)** — already taken at passport application; no added friction | **Austin's EXP-P1 result submission** |
| High — money-moving (`settlementTerms` present, declared `valueCeiling`), high band | **Strong (World ID / passkey)** — the authorizing persona must be `verified_citizen` | **Constitutional Financial Services (CRP-003)** Domain 1/2 |

**Operator direction (2026-07-18):** for Austin and his agent, mandate only the **weak captcha** proof — the passport application already carries it, so the authorize step inherits a human-present proof with *zero* extra friction. Reserve World ID / passkey for **higher-risk or higher-value contracts** (the Constitutional Financial Services programme, where it is key). Do not impose strong verification where the contract's risk doesn't warrant it — unnecessary friction is itself a failure mode.

This still closes the seam: the `authorize` action runs under the **human principal's identity** carrying *at least* a weak personhood proof the agent cannot forge (the guiding agent has no captcha/World-ID personhood of its own), while the agent's guidance and its own `accept` run under the **agent's identity**. The strength dial rises with the stakes; the boundary holds at every grade. (Precedent: the passport submit route already refuses on `!verifyWeakProof(...)`; the strong verifier `verifyWorldIdProof` is applied on the same seam only where the contract's risk requires it. Insertion point + graded logic in §7 and CFS-043a.)

---

## 3. The guided flow (agent-assisted, human-authorized)

| Step | Who acts | Under whose identity | Agent's role |
|---|---|---|---|
| 1. Passport application | Human principal | **Human** | Agent guides: explains what a Passport is, what it grants, walks the form |
| 2. Form the agreement (bounded authority drafted) | Human (or agent-drafted, human-confirmed) | **Human owns it** | Agent drafts the recommended bounded `DelegatedAuthority` (surface, TTL, maxActions, ceiling) for the human to review |
| 3. Agent accepts (delegate's side) | Agent | **Agent** (`acceptorType:'agent'`, x409/Consenti) | Agent accepts the terms it will operate under |
| 4. **Authorize (the gate)** | **Human principal only** | **Human** (owner-commitment match) | Agent may explain, **may not perform** — human presses authorize as themselves (§2.1) |
| 5. Operate | Agent | **Agent, bounded** | Agent acts within band/TTL/maxActions/ceiling; every action still re-checks `requireAuthorizedAgreement` |

Revocation stays first-class: TTL lapse, `maxActions` exhaustion, or a status flip closes the gate on the next agent action — no separate kill-switch (CFS-042 §4).

---

## 4. The recruitment / distribution mechanic (Marketa)

The guided flow is packaged as a distributable onboarding script and shipped through **Marketa**:

1. **Recruit agents.** Marketa distributes the guided-onboarding capability to agents (Horizen pilot agents first, then wider).
2. **Agents recruit sponsors.** An agent that wants delegated authority runs the guided flow to bring a **human sponsor** through passport application + bounded delegation. The agent is the on-ramp; the human is the sovereign grantor.
3. **Bounded delegation is granted, not taken.** Because of §2, the recruited human is always the one who authorizes — the mechanic cannot be gamed into agents authorizing agents. Growth compounds *through* the safeguard, not around it.
4. **Every grant is receipted.** `agreement_authorized` receipts (`constitutionalAgreement.ts:474`) make each delegation auditable — a receipted, revocable trail of who sponsored whom under what bound authority.

This turns onboarding from a friction cost into a growth loop while keeping every new relationship inside the constitutional model: no ungoverned delegation ever enters the network.

---

## 5. Relationship to CFS-042 (the first instance)

CFS-042 (Austin's experiment-submission onboarding) is the **pilot instance** of this pattern: Austin's agent guides Austin through his Passport + the bounded delegation whose x409 signature simultaneously freezes EXP-P1 and authorizes the agent's submissions. CFS-043 **generalizes** that one-off into a reusable, distributable onboarding capability for Horizen + Marketa. CFS-042 is the proof-of-concept; CFS-043 is the productized flywheel. Neither weakens the other; both stand on the identical agreement primitives.

---

## 6. Candidate invariant

**Principal–Delegate Separation** — *A delegated authority is granted only by the human principal who owns it, under the principal's own authentication; a delegate can never sponsor, form-ownership-over, or authorize its own authority.* This is the constitutional invariant the guided-onboarding capability makes load-bearing, and the safeguard that lets agent-driven recruitment scale without ever admitting ungoverned self-delegation. Proposed for ratification alongside this charter (the `constitutional` namespace).

**Graded Proof-of-Humanity** — *The strength of the personhood proof required to authorize a delegation scales with the contract's risk: weak (captcha) for low-risk read/write delegations, strong (World ID / passkey) for money-moving or high-value contracts.* Verification is a dial set by stakes, not a fixed toll — imposing strong proof where the risk doesn't warrant it is unnecessary friction, and accepting weak proof where funds move is under-protection. Proposed alongside Principal–Delegate Separation (`constitutional` namespace); it is the rule that keeps the safeguard proportionate across the Austin (weak) and Constitutional Financial Services (strong) ends of the spectrum.

---

## 7. What ships when (build order)

1. **The guided-onboarding script/flow** — **DONE (2026-07-18):** `CFS-043a_guided-onboarding-script.md` — the agent playbook that walks a principal through steps 1–5 (§3), composing the *existing* agreement endpoints (`/api/constitutional/agreement` form/accept/authorize) + the Passport surfaces. No new trust primitive.
2. **The Passport surfaces on IRL OS** — **DONE (2026-07-18):** the `passport` tab group added to `IRL_OS_CARTRIDGE` (`data/codex-configs.ts`) — Apply / Delegation / Registry / Locker / Steward, mirroring AgentiQ OS. Components already in `TabRenderer.componentRegistry` (config-only). Deep-linkable via `/triad/embed/codex/irl-os?tab=irl-os-passport-*`, so the partner + agent onboard from the IRL OS embed alone (no full metaMe thin client); SmartWallet deep-dives via the floating copilot (`initialTab="iqube"`).
3. **The graded authorize gate (§2.1)** — **PROPOSED (needs operator go):** in `POST /api/constitutional/agreement` (`action:'authorize'`), before `authorizeAgreement`, require a personhood proof **graded to the contract**: default **weak captcha** (Austin — inherited from passport application, no extra call); require **strong** (`verify` the passport is `verified_citizen` via `polity_passport_records.world_id_verified_at`, pattern from `app/api/persona/sponsored-agents/route.ts:187`, or verify a fresh `WorldIdProofBundle` inline via `verifyWorldIdProof`) **only when the agreement's `DelegatedAuthority` is money-moving** (`settlementTerms` present / declared `valueCeiling` / high band). The required grade is written into the agreement object's existing unused `verificationRequirements` slot at `form` time, so the gate reads the requirement off the contract rather than hard-coding it. This is the one change that touches the constitutional agreement path, so it awaits explicit operator approval before wiring. **For Austin, weak captcha is sufficient and no new gate work is strictly required to start** — his passport application already carries a captcha proof.
4. **Marketa packaging** — distribute the capability to agents; instrument the recruitment loop + `agreement_authorized` receipts as the audit trail. *(Follow-on.)*
5. **Generalize from CFS-042** — Austin's experiment-submission agreement as the first live run; then Horizen agents. *(Follow-on.)*

---

## 8. Honest caveats

- The safeguard is **structural but boundary-dependent** (§2.1): it holds precisely because authorize is a human-present action under the principal's own identity. A build that let the guiding agent replay the human's credential for authorize would silently void it — hence §2.1 is a hard build requirement, not a nicety.
- This charter productizes onboarding UX + a growth loop; it does **not** change what a delegated agent may *do* once authorized — that remains governed by the bounded `DelegatedAuthority` and every downstream capability's own gates (spend caps, tier gates, `requireAuthorizedAgreement`).
- "Agents recruit sponsors" is a distribution mechanic, not an authority mechanic: recruitment scale never converts into delegation without a human authorization in the loop.

---

## Ratification record

- [ ] PROPOSED 2026-07-18 (operator direction: agent guides its principal through Passport application + bounded delegation; distribute via Marketa; agents recruit sponsors who delegate to them; the no-self-sponsor / no-self-delegate safeguards are already in place).
- [ ] Operator ratifies the Principal–Delegate Separation invariant (§6) + the §2.1 human-gated-authorize build requirement.
- [ ] Guided-onboarding capability build authorized (separate gate; not this doc).
