# SPEC-TCP-001 amendment — guided-tour correction, and the Activation / Configuration split

**Date:** 2026-07-25 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Spec:** `codexes/packs/irl/foundation/SPEC-TCP-001_threshold-crossing-programme.md` · **Docs-only, no code changed**

## The correction

SPEC-TCP-001 §0.3 originally asserted that *"there is no guided-tour, walkthrough, spotlight, or coach-mark mechanism anywhere in this repository"* and concluded from that absence that §8, §9 and §10 were **entirely new build**. The operator corrected this: a guided tour ships today in the **metaMe Runtime Shell thin client**.

**The search was right; the conclusion was wrong.** Nothing tour-shaped exists in `iQube-Protocol/AigentZBeta` — that part stands and is retained as §0.3c. The defect was using a **repo-scoped search to license a platform-scoped claim**. "Not in this tree" is a finding; "does not exist" is a conclusion a single-tree search cannot support, and the platform spans at least the main tree, the thin client, and the extension. §0.3 now names that defect class so it isn't repeated: every existence claim in this corpus must state which trees were searched.

Two searches went into establishing this, and the first was weak: `iQube-Protocol/metamert` was cloned and searched, initially with an alternation pattern passed to plain `grep` (a literal-string match, capable of a false negative). Re-run correctly, the conclusion held — metamert has no `src/components/tour/`, no `use-tour-state.ts`, and no `react-joyride` dependency. It is an **earlier sibling** of the thin client, not its current source, and §0.3 says so explicitly so nobody cites it as such later.

## What was audited

The operator supplied five files, read as source: `src/components/tour/{WelcomeModal,VisitorTour,TourHelpButton}.tsx`, `src/hooks/use-tour-state.ts`, `src/pages/Index.tsx`. New **§0.3a** answers the operator's nine questions from that source. The findings that matter:

- **Framework:** `react-joyride`, newer API surface (named `Joyride` export, `options`/`onEvent`, `ACTIONS`/`EVENTS`/`STATUS`).
- **Steps:** a static 12-entry `Step[]` in `useMemo(…, [])` — hardcoded, not derived from any registry or state.
- **Targeting:** `data-tour="…"` attributes — a stable, framework-neutral anchor contract.
- **State:** app-owned (`use-tour-state.ts`), persisted as **two localStorage flags**. Device-local, not persona-bound, no event, no receipt.
- **Completion:** `hasSeen = completed || skipped` — finishing and declining are **conflated**.
- **Navigation:** the tour is an **actor**, not an overlay. `runStepEffect` drives the shell per step (`activateMode`, `setSubmenuType`) and `sendIframeAction` postMessages into a runtime it does not own, holding the surface open with a repeating `pauseIdleTimer`.
- **Voice:** step `title`/`content` are plain strings (directly narratable — an asset), but there is **no step-lifecycle seam**, so narration cannot gate advancement.
- **Portability:** routing coupling is **zero** (single-page, context + postMessage). The couplings that don't travel are the `useShell()` action vocabulary and the anchor contract.

**The part worth preserving verbatim:** Joyride runs in *controlled* mode — every transition runs the step's staging effect, polls for the anchor (`waitForElement`, 2 s / 50 ms, requiring `offsetParent !== null`), scrolls it into view, and waits a settle delay (420 ms for drawer steps, 220 ms otherwise) before handing control back; a missing anchor skips **one** step instead of cascading. Ref-mirroring defeats stale closures; `ensureMode` guards against the tap-active-to-collapse branch folding the menu away. Those are exactly the failure modes naïve tour integrations hit. **A replacement that doesn't solve them is a regression regardless of library.**

## What the audit forced

The gaps are **not evenly distributed**, and that asymmetry is the finding. Everything *experiential* — highlight, narrate, stage the surface, advance safely — is solved. Everything *objective* — durable, attributable, resumable, state-derived progress — is absent, because a localStorage flag is the right engineering choice for a visitor tour and the wrong one for a constitutional record.

That is precisely the operator's split, now adopted as **§1.1**:

| Layer | Question | Nature | Authority |
|---|---|---|---|
| **Constitutional Activation** | Is this citizen constitutionally active? | Objective | Binding; gates §14 |
| **Guided Configuration** | Has this citizen been shown how to operate? | Experiential | **Never gates** |

> **Threshold Crossed** = Constitutional Activation complete **AND** Guided Configuration completed **or** explicitly declined.

**This resolves D-8.** The delegation contradiction existed because one list mixed constitutional facts with experiential completion. Delegation is now a Constitutional Activation criterion, *required-when-an-agent-is-bound* rather than universally — so a direct human arrival with no agent can still complete Activation, and the shipped `optional: true` / "never gates" behaviour is not weakened.

It also fixes a semantic that the reference implementation gets wrong for this purpose: **"declined" must stay distinguishable from "completed."** A citizen who declined may be offered guidance again; one who completed should not be re-prompted. One boolean cannot carry that. And only Activation is receipt-eligible — anchoring "watched the tour" would put a preference into the provenance trail.

## All five refinements applied

1. **§0.3 withdrawn and rewritten** + new §0.3a (nine-question audit) and §0.3b (reusable vs. structural gaps). D-12 rewritten from *"select and implement a guide mechanism"* to *"determine whether the existing mechanism can serve as the shared Guided Experience Framework."*
2. **§9 capabilities labelled Existing / Composable / New** — the spec no longer reads as more green-field than it is.
3. **§9 framework specified by contract, not library** — a seven-point behavioural contract (declarative definitions · stable anchor contract · controlled advancement with anchor verification · staging effects · step-lifecycle seam · externalised copy · state the runtime doesn't own). The shipped implementation satisfies 2, 3, 4; partly 1; not yet 5, 6, 7.
4. **§13 restructured** into 13.1 Activation / 13.2 Guided Configuration / 13.3 Threshold Crossed.
5. **MoneyPenny held as a checkpoint** — §18's 4-B row now states this SPEC consumes the cohesion review's conclusions when writing two guide scripts, and does not restructure the FS surface, alter the Domain 1/2 shadow posture, or reopen PRD-MPY-001.

**Three decisions added:**

| # | Decision | Status |
|---|---|---|
| **D-21** | Adopt the Activation / Guided Configuration split | Open — BLOCKING §13 |
| **D-22** | Reuse before replacement; the shipped tour is the reference implementation | Open — BLOCKING §8, §9 |
| **D-23** | Extract into the main tree, consume from the thin client, or re-express as a shared package | Open — BLOCKING §8 |

**§21 sequencing:** P4 split into **P4a** (audit + disposition — no new framework selected before it completes) and **P4b** (guide runtime, built by extending whatever P4a chose).

**§20.1 additions — not authorised by ratification:** selecting a new tour framework before the audit; **hand-copying the thin client's tour into the main tree** (`inv.engineering.036`/`037`); receipting Guided Configuration progress.

## Scope note

The §0.3a/§0.3b findings describe **those five files and nothing beyond them** — the thin-client tree was not searched directly, and the spec's closing provenance note says so. D-23 exists because the two trees are separate repositories and the ownership question is the operator's, not something to infer.

## Review

- Spec: `codexes/packs/irl/foundation/SPEC-TCP-001_threshold-crossing-programme.md`
- In-app: `https://dev-beta.aigentz.me/triad/embed/codex/agentiq-codex?tab=updates`

No SQL, no code, no schema — docs-only.
