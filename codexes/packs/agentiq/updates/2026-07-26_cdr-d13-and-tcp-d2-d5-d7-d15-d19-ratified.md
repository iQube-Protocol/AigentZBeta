# CDR D-13 authorised; TCP D-2, D-5, D-7, D-15, D-19 ratified — with D-7 superseded and Companion 1.1 chartered

**Date:** 2026-07-26
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Specs amended:** `codexes/packs/irl/foundation/SPEC-CDR-001_constitutional-domain-resolution.md`, `codexes/packs/irl/foundation/SPEC-TCP-001_threshold-crossing-programme.md`
**Spec created:** `codexes/packs/irl/foundation/SPEC-MMC-004_companion-1-1-reconstitution.md`
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
| **D-7** | ~~Minimum viable PEQ + one completed meaningful First Task~~ — **SUPERSEDED later the same day; see §3a** | §6b |
| **D-15** | **Defer** the completion percentage until the threshold criteria are settled *and* observability exists for every included criterion. Phase 1 uses explicit lifecycle states. (D-7's supersession changed which criteria are included — and D-24 has not yet settled it) | §13 |
| **D-19** | An agent may **recommend and prepare**; the principal must confirm through the existing authorization spine before a selection becomes active. No agent-finalised selection, no parallel gate | §14.3a |

### D-5 is wider than the question asked

D-5 offered three hosting options; the ruling replaced the framing. Beyond Stage B hosting it makes aigentMe the primary orchestration layer, with Quick Links, cartridge navigation, Passport workflows and Workspace actions becoming things aigentMe performs on the citizen's behalf, and Runtime Copilot / Companion history / agreements / activity / settings consolidating into one persistent interaction model.

§6a.3 was subsequently rewritten as an explicit **scope limit** on the operator's instruction — see §3b. That scope touches the Companion, the copilot layer, the wallet drawer, platform navigation and the identity spine's session continuity; it is chartered separately as `SPEC-MMC-004`.

§6a.4 flags a required **CLAUDE.md amendment at build time**: the Wallet-Over-Cartridge Overlay section currently prescribes the wallet sliding in *alongside* the copilot. D-5 makes them toggled peer modes on one surface. The essential claim (embedded inside the copilot's stacking context, never a standalone slide-over) survives; the side-by-side wording is superseded. CLAUDE.md is deliberately **not** amended yet, because it documents built patterns and nothing is built.

### D-7 — see §3a

The D-7 row above is struck through because the answer recorded in the morning was withdrawn the same day. §3a carries the governing ruling. The two build-time definitions the first answer created (a "minimum viable PEQ" field set; a task signal distinguishing *completed* from *opened*) went with it.

### D-19 forces a two-state write path

A single "selected journey" column cannot express the ruling. §14.3 item 2 now requires a **prepared → active** split: an agent-prepared selection must be durable, visible and revocable without being in force. `select_journey` may only ever prepare, canaried the same structural way `tests/moneypenny-runtime-authority-boundary.test.ts` enforces that the Runtime route can never reach `authorizeAgreement`.

---

## 3a. D-7 superseded, same day (operator implementation note)

The first D-7 answer was withdrawn hours after it was recorded. The governing ruling:

> Do not gate Threshold Crossing on completion of the ExperienceModel, ExperienceGuide or ExperienceQube. These are personalization assets, not constitutional prerequisites. The constitutional threshold is crossed once Passport, Delegation and Agent Me activation are complete. After crossing, Agent Me should progressively recommend and help populate the ExperienceModel and ExperienceGuide over time, including by deriving their JSON representations from ongoing interaction where appropriate. Manual forms remain available as review and editing surfaces, not mandatory onboarding steps.

**Threshold Crossing = Passport + Delegation + aigentMe activation.** No §6 configuration module gates it. The two build-time definitions the earlier answer created ("minimum viable PEQ" field set; a task signal distinguishing *completed* from *opened*) are dropped with it — recorded in §6b.2 as deliberately withdrawn rather than silently forgotten.

Personalization is not discarded, it is **relocated**: §6b.4 makes it a post-threshold track aigentMe drives, deriving ExperienceModel/ExperienceGuide JSON from ongoing interaction where appropriate, with the manual wizards surviving as **review and editing surfaces** rather than gates. Nothing is deleted; a wizard stops being a gate.

### Three consequences recorded, not assumed

1. **§13 criterion 6 is removed** — it is no longer a Constitutional Activation criterion at all.
2. **D-21 is partially broken.** It made Threshold Crossed the terminal state of *both* Constitutional Activation and Guided Configuration. Guided Configuration is no longer a gate, so it cannot terminate there. §6b.5 records the coherent reading — Threshold Crossed terminates Constitutional Activation only; Guided Configuration becomes an open-ended post-threshold track — and flags it for re-confirmation rather than treating it as settled.
3. **A new open decision, D-24.** The ruling names three criteria; §13 lists six. The other two are **Companion installed** and **Companion paired**. The ruling neither named nor excluded them, so it is genuinely ambiguous whether they survive. **No reading was inferred.** The two diverge materially: if dropped, D-9 leaves the threshold critical path entirely and D-10 becomes the long pole (a threshold turning on "aigentMe activation" cannot rest on a *derived* signal); if retained, D-9 stays the long pole.

**A constraint the derivation track implies (§6b.4):** if aigentMe derives profile content from interaction, derived state must be distinguishable from what the citizen authored or confirmed — otherwise a "review surface" cannot show the citizen what was inferred about them, which is the point of it being reviewable. That is a provenance field, owned by whichever charter builds the derivation.

## 3b. D-5 scope-limited; Companion 1.1 chartered separately

Operator instruction: *"Complete the current implementation programme exactly as scoped. Do not expand D-5 into a Companion redesign."*

§6a.3 was rewritten from "consequences this SPEC records" into an explicit **scope limit**. Inside SPEC-TCP-001, D-5 authorises Stage B hosting and nothing else. The orchestration-layer work moves wholesale to a new charter:

**`codexes/packs/irl/foundation/SPEC-MMC-004_companion-1-1-reconstitution.md`** — Companion 1.1. Purpose: reconstitute the Edge Companion around the **existing** aigentMe Copilot. Companion = container; aigentMe = primary interaction surface. Unified bottom navigation across Runtime, Companion and partner sites. Quick Links become aigentMe actions driving the left-hand runtime while holding one continuous conversation.

**Its governing constraint is §2: no new capabilities — only layout, navigation and interaction consolidation.** Every proposed item must trace to a shipped capability; where consolidation exposes a gap, the charter's answer is to *record* the gap, not fill it. That is why **C0 (the capability inventory) is not optional** — "no new capabilities" is unenforceable without a list of the existing ones, and the no-new-capability canary derives from that inventory rather than being hand-maintained.

Seven decisions are open on it; three block work (D-3 what "unified" means across three surfaces, D-4 whether anything is injected into a partner page, D-6 how far "a single continuous conversation" extends). The charter also inherits the Principal–Delegate constraint explicitly: a Quick Link becoming an aigentMe action MUST NOT convert an authorised step into an automatic one — the most likely way a layout change causes a constitutional regression, and canaried rather than reviewed.

## 4. What changed in the critical path

**The long pole now depends on D-24, which is open.**

- **If D-24 drops Companion installed/paired** (the reading in which the superseding ruling's three named criteria are exhaustive): D-9 leaves the threshold critical path. **D-10 becomes the long pole** — "aigentMe active" is currently *derived* from Passport issuance, and a threshold that turns on aigentMe activation cannot rest on a derived signal without asserting the thing it must observe.
- **If D-24 retains them:** D-9 stays the long pole, gating §13 criteria 4–5 and (per D-15) any completion percentage.

D-15's percentage remains deferred under either reading, because its condition is observability for *every* included criterion — and which criteria are included is precisely what D-24 settles.

For CDR, nothing blocks any phase; P6 is next.

---

## 5. Still open

**SPEC-TCP-001:** D-1, D-3, D-4 (blocking §8–§10), D-6, D-8 (blocking §4/§13), D-9 (**critical path**), D-10, D-11, D-12 (blocking §8), D-13 *(TCP's own D-13 — the caption tier, unrelated to CDR's D-13)*, D-14, D-16, D-17, D-18, D-20 (blocking §14), D-21 (blocking §13), D-22 (blocking §8/§9).

**SPEC-CDR-001:** no decision blocks any phase.

**New, arising from this pass:**

- **TCP D-24** — do Companion installed/paired survive as threshold criteria? Blocking §13; determines the critical path (above).
- **TCP D-21** needs re-confirmation in light of D-7's supersession (§6b.5).
- **SPEC-MMC-004 (Companion 1.1)** is chartered with seven open decisions of its own; D-3, D-4 and D-6 block work.
- A **provenance field** distinguishing aigentMe-derived profile content from citizen-authored content, owned by whichever charter builds the derivation track (§6b.4).
