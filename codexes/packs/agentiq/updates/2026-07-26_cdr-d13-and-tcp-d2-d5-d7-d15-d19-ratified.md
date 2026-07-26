# CDR D-13 authorised; TCP D-2, D-5, D-7, D-15, D-19 ratified

**Date:** 2026-07-26
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Specs amended:** `codexes/packs/irl/foundation/SPEC-CDR-001_constitutional-domain-resolution.md`, `codexes/packs/irl/foundation/SPEC-TCP-001_threshold-crossing-programme.md`
**Nature:** documentation only — ratify-before-build. No code was written for any of these decisions.

---

## 1. A correction recorded first

An earlier statement in this session claimed the operator had already given recommendations for TCP D-2, D-5 and D-7 which merely needed transcribing into the spec. **That was wrong.** A search of the full session transcript found no operator answer on record for any of the three. What had been mistaken for recommendations was the register's own recommendation column, which for those three rows read *"Requires an operator choice. Do not default"* and *"Requires an explicit operator list. Do not infer one."*

The questions were re-posed and answered on 2026-07-26. Nothing was written into either spec on the strength of the earlier mistaken claim.

---

## 2. SPEC-CDR-001 — D-13 AUTHORISED

The Horizen agent-classification pilot (§8.4) is authorised, with a binding advisory-only constraint stated verbatim by the operator:

> Classification, execution/governance-domain assignment and bounded-delegation eligibility are advisory inputs only. They must compose through `requireAuthorizedAgreement` and must never independently grant authority, executability or delegation.

Recorded as **§8.4.1**, which reads the constraint out concretely: an "eligible" classification is a statement about a candidate, never a grant; no P6 slice may introduce a second authority check keyed on classification; `subjectType: 'agent'` does not relax D-11's rule that a profile asserts no `executionDomains`. P6 inherits P4's canary obligation, mirrored for agents.

### Sequencing — instruction recorded, not actioned

The operator asked to "advance the pilot-required P6 slice ahead of P3–P5." **P3, P4 and P5 all shipped on 2026-07-25**, before the instruction was given, so no resequencing was possible or needed. P6 is simply the next unshipped phase. §11 states this explicitly so no later reader concludes a reordering happened that did not; the instruction's intent is preserved as **P6 ahead of P7 and P8**.

---

## 3. SPEC-TCP-001 — five ratifications

| Decision | Ruling | New section |
|---|---|---|
| **D-2** | A **new universal Threshold Welcome surface**, composed from existing design and guide primitives. Not an IRL- or aigentMe-specific tab. Begins **or resumes** Threshold Crossing, hands off to Passport | §5a |
| **D-5** | The **Edge Companion becomes the canonical runtime surface for aigentMe**; `CodexCopilotLayer` is mounted *as* that runtime at full Companion width. Wallet and aigentMe are toggled **peer modes in one overlay**. aigentMe becomes the platform's primary orchestration layer | §6a |
| **D-7** | Initial constitutional configuration = **a minimum viable Personal Experience Qube + one completed meaningful First Task**. Nothing else | §6b |
| **D-15** | **Defer** the completion percentage until D-7 is ratified *and* D-9 establishes observability for every included criterion. Phase 1 uses explicit lifecycle states | §13 |
| **D-19** | An agent may **recommend and prepare**; the principal must confirm through the existing authorization spine before a selection becomes active. No agent-finalised selection, no parallel gate | §14.3a |

### D-5 is wider than the question asked

D-5 offered three hosting options; the ruling replaced the framing. Beyond Stage B hosting it makes aigentMe the primary orchestration layer, with Quick Links, cartridge navigation, Passport workflows and Workspace actions becoming things aigentMe performs on the citizen's behalf, and Runtime Copilot / Companion history / agreements / activity / settings consolidating into one persistent interaction model.

§6a.3 records those consequences and states plainly that **they are not chartered by SPEC-TCP-001**. That scope touches the Companion, the copilot layer, the wallet drawer, platform navigation and the identity spine's session continuity; implementing it as a side effect of §6 would be exactly the unscoped sprawl the programme is structured to avoid.

§6a.4 flags a required **CLAUDE.md amendment at build time**: the Wallet-Over-Cartridge Overlay section currently prescribes the wallet sliding in *alongside* the copilot. D-5 makes them toggled peer modes on one surface. The essential claim (embedded inside the copilot's stacking context, never a standalone slide-over) survives; the side-by-side wording is superseded. CLAUDE.md is deliberately **not** amended yet, because it documents built patterns and nothing is built.

### D-7 creates two definitions that must be pinned before build

1. **"Minimum viable PEQ"** — a specific, observable field set on `services/iqube/experienceQube.ts`, now also carrying the essential preferences and consent that today live in the Preferences module. That is a schema question, not a UI one.
2. **"One meaningful First Task"** — the operator drew the line explicitly (opening the Experience Guide does not count), so `GET /api/wallet/tasks` must distinguish *completed* from *opened*, and a guide-delivered task must report completion of the **task**, not the guide.

Neither is inferred in the spec.

### D-19 forces a two-state write path

A single "selected journey" column cannot express the ruling. §14.3 item 2 now requires a **prepared → active** split: an agent-prepared selection must be durable, visible and revocable without being in force. `select_journey` may only ever prepare, canaried the same structural way `tests/moneypenny-runtime-authority-boundary.test.ts` enforces that the Runtime route can never reach `authorizeAgreement`.

---

## 4. What changed in the critical path

**D-9 (Companion install + pairing observability) is now the long pole for TCP.** It gates §13 criteria 4–5, it is the remaining condition on the completion percentage under D-15, and P3 cannot report a threshold state without it. Of the decisions still open it is the smallest with the largest downstream unblock.

For CDR, nothing blocks any phase; P6 is next.

---

## 5. Still open

**SPEC-TCP-001:** D-1, D-3, D-4 (blocking §8–§10), D-6, D-8 (blocking §4/§13), D-9 (**critical path**), D-10, D-11, D-12 (blocking §8), D-13 *(TCP's own D-13 — the caption tier, unrelated to CDR's D-13)*, D-14, D-16, D-17, D-18, D-20 (blocking §14), D-21 (blocking §13), D-22 (blocking §8/§9).

**SPEC-CDR-001:** no decision blocks any phase.

**New, arising from this pass:** the §6a.3 aigentMe-as-orchestration-layer scope needs its own charter before any of it is built.
