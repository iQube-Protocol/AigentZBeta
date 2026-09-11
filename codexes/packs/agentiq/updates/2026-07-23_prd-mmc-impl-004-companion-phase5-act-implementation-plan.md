# PRD-MMC-IMPL-004 — metaMe Companion Phase 5 Implementation Plan (Movement III — Act)

**Status: DESIGN — docs-first, ratify-before-build.** Follows the same discipline as PRD-MMC-IMPL-001/002/003.

**Companion to:** `codexes/packs/irl/foundation/SPEC-MMC-001_constitutional-flow.md` (DESIGN) — operationalizes **Movement III — Act**: "Once constitutionalized, the runtime can: delegate, summarize, research, classify, create tasks, create intents, attach to ventures, publish, request approval, anchor, earn standing" (SPEC §3).

**Origin:** operator instruction, 2026-07-23 ("Go"), continuing MMC Flow after Movement I (Capture, PRD-MMC-IMPL-003, shipped) — builder's own recommendation for the next increment, since Capture now produces real Intents/Ventures with nothing yet to act on them beyond what already existed.

---

## §0 Reconciliation — SPEC-MMC-001's own framing of Movement III is materially wrong about what exists, and the real gap is much smaller than it implies

### 0.1 Most of Movement III's named verbs already exist — only 4 of 11 are genuinely missing

SPEC §3 lists eleven things "the runtime can" do once something is constitutionalized. Checked against the actual codebase, not assumed:

| Verb | Status |
|---|---|
| create intents | **EXISTS** — `createIntentQube` (used by Capture's assign route, PRD-MMC-IMPL-003) |
| attach to ventures | **EXISTS** — `createVentureQube` (same) |
| request approval | **EXISTS** — `POST /api/assistant/intent-advance` (`action: 'approve'`) |
| anchor | **EXISTS** — the DVN pipeline (infrastructure-level, applies to any receipted action) |
| earn standing | **EXISTS** — Standing accrual (infrastructure-level) |
| create tasks | **EXISTS** — same as "create intents" |
| publish | **Movement IV's job** (Project), not III — SPEC's own §3 groups it here loosely but its substance is the Legacy-Internet-facing push, not an Act verb |
| **delegate** | **MISSING** as a distinct, operator-triggered action |
| **summarize** | **MISSING** |
| **research** | **MISSING** |
| **classify** | **MISSING** |

**Only four verbs are genuinely new work.** This section exists because a plan that took SPEC §3's list at face value would have scoped a much larger build than is actually needed.

### 0.2 SPEC-MMC-001's own claim that Act "is itself an extension of `services/constitutional/constitutionalAgreement.ts`" does not hold today — corrected, not silently inherited

SPEC §3 states Movement III "is the workbench... itself an extension of `services/constitutional/constitutionalAgreement.ts` (bounded delegation)." Verified false as a description of what exists: `app/api/assistant/ask-agent/route.ts` (the actual "ask a specialist about X" route) is spine-authenticated only — it never imports `constitutionalAgreement.ts`, never calls `requireAuthorizedAgreement`, and has no x409 409-gate anywhere in its 387 lines. **Every specialist consultation today is ungated by the bounded-delegation engine.** This is consistent with `askSpecialist`'s own nature (an advisory consult, not a delegated execution with settlement/fund-movement stakes) — the engine's N1 scope was chartered for money-adjacent/consequential delegation (CRP-003a), not general-purpose "ask a specialist" traffic, and retrofitting a 409 gate onto every specialist consult would be a materially bigger, cross-cutting architectural decision than this plan should make unilaterally (mirroring the discipline PRD-MMC-IMPL-003 §0.3 already applied to Capture's destination gap). **This plan does not add a constitutionalAgreement gate to Act** — it is flagged as an open question (§5.1), not silently either added or ignored.

### 0.3 The load-bearing finding: the missing four verbs are ALREADY fully wired end-to-end — the only real gap is a UI surface

`POST /api/assistant/ask-agent` (read in full) already accepts `{ specialistId, intentId, prompt }`. When `intentId` is present, it pulls the real `IntentQube` server-side (`getIntentQube`), threads its `rationale` into the specialist's context, grounds the consult in relevant invariants, calls the specialist, and emits a `specialist_consulted` receipt tagged to that `intentId`. **A capture-originated Intent (`rationale` = the capture's own content, set by PRD-MMC-IMPL-003's assign route) already flows into this path with zero new backend code required.** The only genuine gap is that `components/metame/workbench/IntentChainPanel.tsx` — the component that renders an Intent's action row in `MyWorkspaceTab`'s Active Intents list, exactly where a capture-originated Intent appears — does not call `ask-agent` at all today. (That call currently lives only in a sibling surface, `AigentMeWelcomeTab.tsx`'s `handleAskSpecialist`, not in the workbench panel.) **This plan is therefore almost entirely a UI addition, not a new capability.**

### 0.4 Venture-level Act has no existing hook and is out of scope for this pass

Checked `services/venture/*` in full: no function composes `askSpecialist`, and `SpecialistContext` (`services/agents/specialistRouter.ts`) has no venture-shaped field — only `intentName`/`intentRationale`. Wiring a Venture-level Act flow would require either extending `SpecialistContext` (a shared-type change touching every specialist caller) or building a parallel venture-context path — both bigger decisions than this pass makes. **Movement III's first increment is Intent-level Act only.** A capture assigned to Venture (PRD-MMC-IMPL-003's other destination) has no Act affordance from this plan; flagged as a real, named gap (§4), not silently dropped.

### 0.5 Where the Act buttons mount — the file-reading-grounded decision

`IntentChainPanel.tsx`'s `ChainActionRow` (lines 673-811) already renders Approve / Mark complete / Cancel for an intent, POSTing to `/api/assistant/intent-advance` via `personaFetch`, with a `pending`/`error` local-state pattern this plan reuses verbatim rather than inventing a new one. This is the correct, existing mount point for the four new Act buttons — same row, same component, same styling conventions (`baseBtn` + color variants per action) — not a new panel or a new component tree.

---

## §1 Purpose and scope

Give an operator four curated "Act" quick-actions — **Delegate, Summarize, Research, Classify** — on any Intent's action row (`ChainActionRow`), each composing the EXISTING `POST /api/assistant/ask-agent` route with a curated `(specialistId, prompt)` pair and the intent's own `intentId` — never a new route, never a new specialist-invocation mechanism.

**Curated verb → (specialistId, prompt) mapping** (a build-time default, not an architectural commitment — tunable by whoever ships this, per §5.2):

| Verb | `specialistId` | Framing `prompt` |
|---|---|---|
| Delegate | `aigent-z` (the system orchestrator — "routes interactions... selects NBE," `docs/agent-harness/aigent-z-aigent-c-contract.md`) | "Route this to the right specialist and tell me who, and why." |
| Summarize | `aigent-c` (the default customer-guide handler) | "Summarize this in 3-5 concise bullet points." |
| Research | `researcher` (an existing, already-registered `SpecialistId`) | "Research this and report the key findings, with sources where you can." |
| Classify | `aigent-c` | "Classify what kind of work this is, and which domain or venture it best belongs to." |

**In scope:**

- Increment 1 — `ActRow`: four buttons added to `ChainActionRow`, each calling `POST /api/assistant/ask-agent` with `{ specialistId, intentId, prompt }` via `personaFetch`, rendering the returned `SpecialistResponse` inline (reusing the existing receipt-driven re-render: `ask-agent` already emits a `specialist_consulted` receipt tagged to the intent, so calling `onAdvanced()` after a successful Act refreshes the chain and the new consultation appears in the timeline exactly like any other specialist consult — no new rendering path needed).
- Increment 2 — canary tests for Increment 1.

**Explicitly out of scope for this plan** (named, not silently dropped):

- **Venture-level Act** (§0.4) — no hook exists; a follow-on plan's job.
- **A constitutionalAgreement 409 gate on Act** (§0.2) — flagged as an open question (§5.1), not added.
- **"Publish"** — Movement IV (Project)'s job, not this plan's.
- **Any change to `app/api/assistant/ask-agent/route.ts`, `services/agents/specialistRouter.ts`, `services/constitutional/constitutionalAgreement.ts`, or `types/orchestration.ts`** — every increment composes with these, none modifies them.
- **A generic "Act" chip usable outside `ChainActionRow`** (e.g. from `CaptureInboxPanel.tsx` directly, before assignment) — per PRD-MMC-IMPL-003's research finding, Act applies AFTER assignment (once an Intent exists to hang context off), never on a raw, unassigned capture.

---

## §2 Increment-by-increment plan

### Increment 1 — `ActRow` on `ChainActionRow`

**Goal:** Four new buttons, same component, same conventions as Approve/Mark complete/Cancel.

**Files touched:**

| File | New/Modified | Contents |
|---|---|---|
| `components/metame/workbench/IntentChainPanel.tsx` | Modified (additive) | ADD an `ActRow` component (or an inline extension of `ChainActionRow` — builder's call on the cleanest composition, since `ChainActionRow` is already a single cohesive action-row component) rendering four buttons (Delegate/Summarize/Research/Classify) below or beside the existing Approve/Mark complete/Cancel row, each on click: `personaFetch('/api/assistant/ask-agent', { method: 'POST', body: JSON.stringify({ specialistId, intentId, prompt }) })`, then call the existing `onAdvanced()` prop to trigger a chain refetch (the new `specialist_consulted` receipt then renders via the ALREADY-EXISTING receipt-row rendering path — no new UI needed for the response itself, matching how every other specialist consult already displays). Buttons hidden when `isTerminal` (same rule Approve/Complete/Cancel already follow) — acting on a closed intent doesn't make sense. A `pending: 'delegate' \| 'summarize' \| 'research' \| 'classify' \| null` local-state var (mirroring `ChainActionRow`'s own `pending` pattern) disables all four while one is in flight and shows a spinner on the active one. |

**What's reused vs. new:** Reused — `POST /api/assistant/ask-agent` (unmodified), `personaFetch`, the `pending`/`error` local-state pattern, the existing receipt-row rendering for `specialist_consulted`. New — four button definitions + their curated `(specialistId, prompt)` pairs.

**Verification/acceptance:**
- A canary (Increment 2) asserting the four curated prompts/specialistIds are present in source and that the click handler's request body matches `ask-agent`'s expected shape (`specialistId`, `intentId`, `prompt`).
- A canary asserting the file never introduces a new API route or duplicates `askSpecialist`'s logic — it only ever calls the existing endpoint.
- Manual review (no `node_modules`/browser in this authoring sandbox to render it): confirm `personaFetch` only, no raw `fetch`.

**Explicit non-goals:** no new backend route; no Venture-level equivalent; no constitutionalAgreement gate.

**Dependencies:** none (composes only already-shipped, unmodified surfaces).

---

### Increment 2 — Canary tests

**Goal:** Lock the composition-not-duplication guarantee and the curated verb mapping against silent drift.

**Files touched:**

| File | New/Modified | Contents |
|---|---|---|
| `tests/companion-act.test.ts` (**new**) | New | Source-grep canary (mirrors `tests/companion-capture.test.ts`'s structural-check style for files vitest can't functionally import, though this one CAN be functionally imported since `IntentChainPanel.tsx` is a plain `.tsx` React component, not a `chrome.*`-dependent extension file — a lighter-weight structural check is still appropriate here since fully rendering the component needs a DOM test harness this repo's existing test suite doesn't set up for this file elsewhere): asserts the four curated `(specialistId, prompt)` pairs are present in source; asserts `/api/assistant/ask-agent` is the only new fetch target introduced (no new route path string); asserts `personaFetch(` is used and no raw `fetch(`; asserts the Act buttons check `isTerminal` before rendering (same gating as Approve/Complete/Cancel). |

**Dependencies:** Increment 1.

---

## §3 Sequencing rationale

Two increments, sequential — Increment 2 tests what Increment 1 produces. No parallelism needed given the small scope (unlike Capture's five-increment, multi-file build).

---

## §4 Explicit non-goals / deferred work

- **Venture-level Act** (§0.4) — flagged as missing infrastructure (no `SpecialistContext` field, no composing function), not this plan's to build.
- **A constitutionalAgreement/x409 gate on specialist consultations** (§0.2) — a materially bigger, cross-cutting decision; flagged as an open question (§5.1), not resolved here.
- **Any change to the underlying `askSpecialist`/`ask-agent` mechanism** — every increment composes it unmodified.
- **A drag-based or context-menu-driven Act trigger from the Companion browser extension** — Act, per PRD-MMC-IMPL-003's own research finding, applies to an already-assigned Intent inside the Constitutional Runtime (the Workspace), not to a raw browser-context object; no extension-side work is implied by this plan.
- **"Publish"** — Movement IV's job.

---

## §5 Open engineering questions requiring a build-time decision

### 5.1 Should Act ever route through the bounded delegation engine?

§0.2 establishes that it doesn't today, for any specialist consult, Companion-triggered or not. Whether Movement III specifically should introduce a gate (e.g. because "Act" implies more agency than a passive "ask" always has) is a real design question this plan does not resolve — flagged for the operator, not decided unilaterally, since it would change behavior for every existing `ask-agent` caller, not just the four new buttons.

### 5.2 Is the curated verb → specialist mapping (§1) the right default?

`aigent-z` for Delegate, `aigent-c` for Summarize/Classify, `researcher` for Research is a reasonable, honest first mapping grounded in each specialist's own defined role — but it's a UX/product tuning call, not an architectural one. Delegated to whoever builds Increment 1 to confirm or adjust; changing it later requires no re-ratification.

### 5.3 Should the four Act buttons also appear on `AigentMeWelcomeTab.tsx`'s existing ask-specialist surface, for consistency?

That surface already lets an operator pick any specialist freely — the four curated buttons are a workbench-specific shortcut, not a replacement. This plan does not touch `AigentMeWelcomeTab.tsx`; whether the two surfaces should visually reconcile is a follow-on UX question, not blocking this pass.

---

## §6 Ratification record

- [ ] Operator ratifies §0's reconciliation — in particular that only 4 of SPEC-MMC-001 §3's 11 named verbs are genuinely missing, that Act does NOT extend `constitutionalAgreement.ts` today (SPEC's own claim corrected), and that the real gap is a UI addition to `ChainActionRow` composing the already-working `ask-agent` route.
- [ ] Operator ratifies Increment 1's scope (§2) — the four curated Act buttons and their `(specialistId, prompt)` mapping (§1), understanding this mapping is a tunable default (§5.2).
- [ ] Operator ratifies Increment 2's scope (§2) — a structural canary for the new buttons.
- [ ] Operator ratifies that Venture-level Act (§0.4) and a constitutionalAgreement gate on Act (§5.1) are explicitly OUT of scope for this pass, not silently deferred.

---

*Authored docs-only, 2026-07-23. Reconciles `codexes/packs/irl/foundation/SPEC-MMC-001_constitutional-flow.md` (DESIGN) into a Movement-III-only build sequence. Every file reference verified by direct read at authoring time via a dedicated research pass: `app/api/companion/search/route.ts`, `services/companion/searchFederation.ts`, `services/constitutional/constitutionalAgreement.ts`, `types/orchestration.ts`, `services/agents/specialistRouter.ts`, `app/api/assistant/ask-agent/route.ts` (read in full), `components/metame/workbench/IntentChainPanel.tsx` (read in full), `services/venture/*`, `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx`, `components/companion/CaptureInboxPanel.tsx`, `app/api/companion/capture/[captureId]/assign/route.ts`. No code was written; no `npm`/`tsc`/`vitest` command was run. Builds nothing; proposes a build sequence for operator ratification.*
