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

### 2.1 The one design requirement that keeps this airtight

The guarantee is only as strong as the **identity boundary between "agent acting" and "human authorizing."** If the guiding agent could perform the `authorize` call *under the human's own authenticated persona*, the separation would be cosmetic. So the build MUST enforce:

> **The `authorize` step is a human-gated action.** It requires the principal's own authentication — their Passport signature / a step-up factor / their authenticated session acting as themselves — and is **never delegable to the guiding agent.** The agent may pre-fill, explain, and recommend the terms; the human presses authorize as themselves. Everything else in the flow the agent may drive; this one step it may not.

This is the seam where the guided-onboarding build must be careful: the passport application and the `authorize` action run under the **human principal's identity**; the agent's guidance and its own `accept` run under the **agent's identity**. The two never merge. (Concretely: do not let the guided-onboarding agent hold or replay the human's Supabase/persona credential for the authorize call — authorize is a human-present action, mirroring the in-app PR-merge human execution gate already precedented in this codebase.)

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

---

## 7. What ships when (build order — NOT this doc)

1. **The guided-onboarding script/flow** — an agent skill/capability that walks a principal through steps 1–5 (§3), composing the *existing* agreement endpoints (`/api/constitutional/agreement` form/accept/authorize) + the Passport application surface. No new trust primitive.
2. **The human-gated authorize seam (§2.1)** — ensure `authorize` requires the principal's own authentication and is not performable by the guiding agent (the single security-critical build requirement).
3. **Marketa packaging** — distribute the capability to agents; instrument the recruitment loop + `agreement_authorized` receipts as the audit trail.
4. **Generalize from CFS-042** — Austin's experiment-submission agreement as the first live run; then Horizen agents.

No code lands from *this doc* — the charter is the ratification gate. Steps 1–4 are separately authorized builds.

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
