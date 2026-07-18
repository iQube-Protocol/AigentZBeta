# CFS-043a — The Guided Passport & Delegation Onboarding Script

**Chrysalis Foundation · Agent Playbook · Companion to CFS-043 · Status: READY TO RUN (script) / gate build PROPOSED**
**Date:** 2026-07-18
**Who runs this:** a **delegate agent** (e.g. Austin's EXP-P1 agent) guiding its **human principal** (Austin) through getting a Polity Passport and granting the agent a bounded delegation.
**Governing charter:** `CFS-043_agent-guided-passport-delegation.md` (the pattern + the Principal–Delegate Separation safeguard). **First live use:** CFS-042 (external result submission).

---

## Prime directive (read before running)

> **You (the agent) guide. The human authorizes. You may pre-fill, explain, and recommend every field — but the *authorize* step and the *World ID* step are performed by the human principal, as themselves. You can never grant yourself authority. That is not a limitation to work around; it is the point.**

Concretely, across this whole script:
- **The agent may drive:** framing, navigating the human to each surface, drafting the recommended bounded authority, calling `form`, calling `accept` (the agent's own side), and operating once authorized.
- **The human alone performs:** the World ID proof and the `authorize` action — both under the human's own authenticated persona (`authorizeAgreement` refuses anyone but the owning persona; see CFS-043 §2). If you ever find yourself about to press authorize on the human's behalf, **stop** — that voids the whole safeguard.

---

## The surfaces (deep links)

All passport surfaces are now first-class tabs of the **IRL OS cartridge**, so the human never leaves the IRL OS embed (no full metaMe thin client needed). Append the identity param the embed route already reads (`?pst=<personaSessionToken>` preferred, `?personaId=<id>` legacy) to any link.

| Purpose | Deep link |
|---|---|
| **Apply for a Passport** | `/triad/embed/codex/irl-os?tab=irl-os-passport-apply` |
| **Bounded delegation** | `/triad/embed/codex/irl-os?tab=irl-os-passport-delegation` |
| Registry (public record) | `/triad/embed/codex/irl-os?tab=irl-os-passport-registry` |
| Locker (encrypted vault) | `/triad/embed/codex/irl-os?tab=irl-os-passport-locker` |

Build these with `buildCodexUrl('irl-os', { tab: 'irl-os-passport-apply', personaSessionToken })` (`utils/codex-nav.ts`) so identity + breadcrumb params are attached correctly. The **canonical bureau** (`/triad/embed/codex/polity-passport-bureau?tab=apply`) is the fallback if the human prefers the standalone bureau cartridge — same components, same result.

**Atomic deep-dive (optional):** the floating copilot's SmartWallet opens directly on the passport/persona/delegation surface with `initialTab="iqube"` (`SmartWalletDrawer`). Offer this when the human wants to inspect their PersonaQube / PassportQube / sponsored-agent delegations in place without navigating tabs. (Note: this in-app prop only — the cross-shell iframe envelope does not carry the `iqube` target, so link to the tab above for cross-shell.)

---

## The flow

### Step 0 — Frame it (agent speaks)
> "Before I can act on your behalf, you'll grant me a **bounded, revocable** authority — I'll walk you through it. Three things happen: you get a **Polity Passport** (your sovereign identity), you verify you're human with **World ID**, and then *you* authorize a narrow delegation to me. I draft the terms and explain each one; you're the only one who can approve it. Takes a few minutes."

Set expectations: the human is the sovereign grantor; the agent is the on-ramp.

### Step 1 — Passport application (agent guides, human submits)
- **Link the human to:** `…/irl-os?tab=irl-os-passport-apply`.
- The Apply tab takes a **weak proof of humanity (captcha)** and issues an **`anonymous_citizen`** passport (`app/api/passport/applications/submit` records `personhood_proof_type='captcha'`).
- **Agent role:** explain what a Passport is and what it grants; do **not** submit for them — the application is theirs.

### Step 2 — Proof of humanity, graded to the contract (for Austin: weak captcha — already done)
- The **weak captcha** taken during Step 1's passport application is **sufficient for this contract** (free, read/write, `valueCeiling: null` — low risk). It already gives the Step-5 authorize a human-present proof the agent cannot forge. **No extra verification, no added friction — this is the operator-directed default for Austin (2026-07-18).**
- **Strong proof (World ID / passkey) is NOT required here.** Reserve it for money-moving / high-value contracts (e.g. the Constitutional Financial Services programme). If you are running this script for a *money-moving* delegation, then — and only then — have the human complete **World ID** (`WorldIdButton` → `POST /api/polity-passport/verify-worldid`, upgrading to `verified_citizen`) before Step 5. The required grade is written into the agreement's `verificationRequirements` at Step 3.
- **Agent role:** for Austin, nothing extra — proceed. For a high-risk contract, prompt the human to complete World ID as themselves (you cannot hold or replay their proof). Match the proof strength to the stakes; don't over-verify.

### Step 3 — Form the agreement (agent drafts, human confirms the bounds)
- **Agent drafts** the recommended bounded `DelegatedAuthority` and calls:
  ```
  POST /api/constitutional/agreement
  { action: 'form',
    agreementId: '<stable-slug>',            // idempotent
    displayLabel: 'EXP-P1 result submission',
    capabilityRef: 'irl:experiment-result:submit',   // the capability being delegated
    selectedAgentRef: '<this agent’s ref>',
    delegatedAuthority: {
      band: 'L2',
      allowedActions: ['publish-result'],
      forbiddenActions: ['ratify','flip-authoritative','edit-crystal','read-persona'],
      allowedSurfaces: ['irl:experiment-result:submit'],
      ttlHours: <experiment window>,          // expires — not standing
      maxActions: <# result sets>,            // bounded — cannot spam
      valueCeiling: null                       // free submission (declare a ceiling only if a fee is charged)
    },
    verificationRequirements: ['captcha-verified-authorizer'],   // Austin: weak proof suffices. Use 'world-id-verified-authorizer' for money-moving contracts.
    governingInvariants: ['<principal-delegate-separation inv id>']
  }
  ```
- **Human role:** review the drafted bounds (surface, TTL, action cap) — the agent presents them in plain language. Nothing is granted yet.
- The agreement is **owned by the human** who is logged in (`formAgreement(personaId, …)` binds ownership to their persona). The agent is only `selectedAgentRef`.

### Step 4 — Agent accepts its side (agent acts, as the agent)
- ```
  POST /api/constitutional/agreement
  { action: 'accept', agreementId: '<slug>', acceptorType: 'agent', acceptorId: '<agent id>', provider: 'consenti' }
  ```
- This is the delegate accepting the terms it will operate under (x409/Consenti). **Acceptance does not open the gate** — authorization does.

### Step 5 — Human authorizes (the gate — HUMAN ONLY, World-ID-gated)
- **The human**, as themselves, performs:
  ```
  POST /api/constitutional/agreement
  { action: 'authorize', agreementId: '<slug>' }
  ```
- `authorizeAgreement` refuses unless the caller is the **owning persona** (owner-commitment match) **and** that persona carries the personhood proof graded for this contract (per CFS-043 §2.1). For **Austin this is the weak captcha** already taken at application — so the authorize just works. (For a money-moving contract it would additionally require `verified_citizen` / `world_id_verified_at != null`.) On success: `agreement_authorized` receipt + the `requireAuthorizedAgreement` gate opens.
- **Agent role: none.** You may confirm it succeeded (read the receipt); you may not perform it. If a higher-grade contract's proof is missing, route the human back to Step 2 — do not attempt to bypass.

### Step 6 — Operate within bounds (agent acts, bounded)
- The agent may now exercise the capability (e.g. submit results). **Every action re-checks** `requireAuthorizedAgreement({ capabilityRef, selectedAgentRef, requestingPersonaId })` and decrements the `maxActions` budget. TTL lapse / budget exhaustion / status flip closes the gate — no separate kill-switch.

---

## The safeguard, restated as an operating rule

At no point does the agent occupy the owner or authorizer slot. The agent forms (drafts), the agent accepts (its side), the **human authorizes** (World-ID-gated, owner-commitment-matched). Self-sponsorship and self-delegation are structurally unreachable (CFS-043 §2). This is why the script is safe to distribute at scale via Marketa: **recruitment scale never converts into delegation without a human authorization in the loop.**

---

## Recruitment framing (Marketa distribution)

Package this script as the agent's onboarding capability. An agent that wants delegated authority runs it to bring a **human sponsor** through Steps 1–5. Agents recruit sponsors; sponsors grant bounded, receipted, revocable authority. Every `agreement_authorized` receipt is the audit trail of who sponsored whom under what bound authority.

---

## Build status

- **Script (this doc):** READY TO RUN for Austin — composes only existing surfaces + endpoints. **Weak captcha (from passport application) is the mandated proof for this contract; no new gate work is required to start.**
- **The Passport surfaces on IRL OS:** DONE — `passport` tab group on `IRL_OS_CARTRIDGE` (Apply / Delegation / Registry / Locker / Steward), deep-linked above.
- **The graded authorize gate:** PROPOSED (CFS-043 §7 item 3) — needed only to *enforce* the strong grade for money-moving contracts (Constitutional Financial Services). Exact insertion: in `POST /api/constitutional/agreement` (`action:'authorize'`), read the contract's `verificationRequirements`; if it requires strong proof, verify `polity_passport_records.world_id_verified_at` (pattern: `app/api/persona/sponsored-agents/route.ts:187`) or a fresh `WorldIdProofBundle` via `verifyWorldIdProof`; else the weak captcha carried by the passport suffices. **Austin does not depend on this build.** Awaiting operator go before modifying the authorize path.
