# Phase 2: aigentMe right-pane layouts — end-to-end dog-food

> **Status:** in flight (Slice 0 + DIS authored 2026-05-23).
> **Why this doc:** the first real-world workstream where the operator
> uses the platform to deliver a project end-to-end — author the DIS,
> ship slices, run Parity Checker, accept/reject remedies, log receipts.
> Captures the meta-objective: inhabit the system, find friction,
> feed it back.

---

## 1. The project

Replace the Phase 1 right-pane stack (every chip appends a card to one
scrolling column) with dynamic intent-specific layouts. Each left-side
action selects a whole-pane layout designed for that intent — Brief
becomes a reading workspace, Move-forward a decision board, Venture a
cockpit, Compose an editor, Approval a focused interrupt, Receipts a
ledger view.

**Why now:** the operator wants to start using the system to manage their
own ventures. Stacked cards pile up and obscure context. The intent-led
layout model is the smallest change that meaningfully upgrades day-to-day
usability while creating the seam for every future intent-specific
surface.

**Constraint:** design fidelity is a first-class invariant. Same status
as security and privacy. Every slice passes the four-axis test
(symmetry, rhythm, hierarchy, restraint) before promotion.

## 2. The protocol — using our own framework

We are not building Phase 2 with a fresh process. We're using the
platform's existing Design Intent System (DIS) + Parity Checker as the
governing contract. Files:

- `app/services/designParity/DesignIntentSpec.ts` — DIS schema
- `app/services/designParity/ConstraintManifest.ts` — hard constraints
- `app/services/designParity/ParityChecker.ts` — structural + visual scoring
- `app/services/designParity/DesignGapCheck.ts` — surface-level audits
- `components/composer/AgenticDesignParityPanel.tsx` — UI for running reports

Receipt events on DVN: `design_parity_pipeline_run`,
`design_parity_pipeline_error`, `design_parity_remedy_proposed`,
`design_parity_remedy_applied`, `design_parity_remedy_rejected`.

**The DIS lives at:**
`codexes/packs/agentiq/items/dis/aigentme-phase-2.dis.json`

It locks tokens (colors, typography, spacing, radii) to the handbook
§8a tables, declares every layout id with per-modality / per-density
routing, and carries `layoutRules` the Parity Checker treats as
structural constraints. When a slice ships, the parity report is the
receipt; when violations exist, the framework proposes minimal-diff
remedies that the operator accepts or rejects.

## 3. Slice plan

| Slice | Scope | Visual delta | Parity gate |
|---|---|---|---|
| 0 | Layout registry scaffold; `StackLayout` wraps current pane exactly | zero | snapshot identical |
| 1 | `BriefLayout` — focused brief workspace | dedicated pane for brief; chip → layout swap | run `ParityChecker` against `brief-layout-v1` |
| 2 | `DecisionBoardLayout` — hero + alternates in comparable columns | move-forward becomes choosable, not scrollable | parity on 2-column collapse → mobile swipe |
| 3 | `VentureCockpitLayout` — top strip + 3 columns | venture progress upgrades from one card to a workspace | parity on 3 → 2 → 1 column collapse |
| 4 | `ComposerLayout` — thread context / draft / send | drafting opens a clean editor, not an appended card | parity on editor chrome + footer actions |
| 5 | `ApprovalLayout` (interrupt) — overlays current layout | approvals stop interrupting the wrong card | parity on overlay + dismiss-return |
| 6 | `LedgerLayout` — receipts with filters | receipts get a dedicated view | parity on filter strip + chronological list |
| 7 | Contextual chip strip | chips on the copilot reorder/replace by `activeLayoutId` + last NBE plan | parity on chip density (≤5) + animation curve |

**Sequencing:** Slice 0 ships first (pure refactor, zero visual change).
Slice 1 ships only after a design review on the mock or deployed dev
build. Slices 2–7 follow once Slice 1 is clean.

## 4. What we expect to learn (the dog-food point)

This is the first time we're using the DIS + Parity framework on
ourselves rather than on a customer's experience. Things we'll be
watching for and feeding back into the platform:

- **Friction in authoring the DIS** — was the schema enough? What did
  we have to extend? (already: `copilotHints` was useful; the layout
  rules array felt thin — likely needs first-class structure later).
- **Parity Checker coverage** — does the visual-difference scoring
  actually catch the violations we care about? If raw-hex slips
  through, the checker needs better lexers; if a 4 px off-grid padding
  passes, the structural rule set needs strengthening.
- **Remedy quality** — when violations exist, are the proposed remedies
  minimal-diff and actually accepted? Or do they cause regressions?
- **DVN receipt usefulness** — when we look at the receipts a week
  later, do they tell the story of the slice? If not, the receipt
  schema needs more context.
- **Composer UX as the operator** — every rough edge we hit inside
  AgenticDesignParityPanel gets logged here as a Studio improvement
  candidate.

Each friction point will be captured in this doc as it's encountered,
with a follow-on issue or PR linked.

## 5. Operating cadence

- DIS authored before any code (✓ done 2026-05-23 — `dis/aigentme-phase-2.dis.json`).
- Slice 0 shipped 2026-05-23 — layout registry scaffold, zero visual
  change. Files: `components/metame/welcome/layouts/{types.ts,
  StackLayout.tsx, registry.ts}` + `WelcomeRightPaneProps` exported +
  `AigentMeWelcomeSplitTab` now routes via `getLayout(activeLayoutId)`.
- DIS fetch endpoint shipped 2026-05-23 — `GET /api/design-parity/dis/[workstreamId]`
  serves DIS JSON from the pack so any in-browser surface can load it
  for the ParityChecker without bundling. Pattern:
  `fetch('/api/design-parity/dis/aigentme-phase-2').then(r => r.json())`.
- DIS amended 2026-05-23 — added `structure.mobileShapes` declaring
  dedicated mobile shapes (full-screen reader for Brief; horizontal
  swipe for DecisionBoard; tabbed sections for VentureCockpit;
  bottom-sheet for Approval interrupts; filter-collapsed list for
  Ledger; full-screen editor for Composer).
- Slice 1 (BriefLayout) ships next; receipt + parity report attached.
- After each slice: parity report → handbook drift check → if intent
  shifted, version the DIS up and link the decision.
- After Phase 2 completes: a closing doc captures (a) what shipped,
  (b) what the operator learned by inhabiting the system, (c) Studio
  platform improvements the workstream identified.

### 5.1 Parity-run path (current, minimal)

The full panel-side wiring lands as a follow-on so it doesn't block dev.
For now, the loop runs as follows:

1. Browse to aigentMe on dev. Mount is unchanged (Slice 0 = no visual diff).
2. Fetch the DIS in DevTools:
   ```js
   const { dis } = await fetch('/api/design-parity/dis/aigentme-phase-2').then(r => r.json());
   ```
3. Import the checker and run it against the right pane:
   ```js
   const { ParityChecker } = await import('/app/services/designParity/ParityChecker.ts');
   const cm = { /* default ConstraintManifest stub */ };
   const el = document.querySelector('[data-aigentme-right-pane]');
   const report = await ParityChecker.generateReport(el, dis, cm);
   ```
4. Inspect the report; structural violations + visual-difference scores
   per breakpoint. Anything flagged `critical` blocks the slice from
   promoting beyond dev (manual gate for now; automated CI gate in a
   follow-on).

The Studio `AgenticDesignParityPanel` integration that surfaces this
report inside the composer is tracked as a Phase 2 follow-on. The
minimal endpoint shipped today is the seam that wiring will use.

## 6. References

- Handbook §8a Design Fidelity Posture — `codexes/packs/agentiq/items/OPERATORS_HANDBOOK.md`
- Handbook §8b Design Intent System & Parity Framework (Studio dog-food)
- DIS — `codexes/packs/agentiq/items/dis/aigentme-phase-2.dis.json`
- Parity framework — `app/services/designParity/`
- Composer panel — `components/composer/AgenticDesignParityPanel.tsx`
- UI parity reviewer subagent — `.claude/agents/ui-parity-reviewer.md`
- Phase 2 plan (this session) — captured in commit history under
  `claude/friendly-lovelace-41Wsn`
