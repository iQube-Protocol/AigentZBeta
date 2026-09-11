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

## 4a. Phase 2 baseline parity report (Slice C, 2026-05-23)

Ran a static audit against the DIS contract (`dis/aigentme-phase-2.dis.json`)
on all seven layouts after Slice 7 closed. The DOM-level
`ParityChecker.generateReport` runs in-browser; this audit is the static
equivalent (covers structural / token rules from the DIS layoutRules and
handbook §8a four-axis test). Live visual-difference scoring on dev is
a follow-on pass that doesn't change the structural findings below.

### Compliance matrix

| Layout | Shell | Markers | Radius | Body pad | Footer pad | Header 56 | No raw hex | No `hidden md:*` primary | Skeleton | Empty state | Accent tokens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| StackLayout | n/a (wraps WelcomeRightPane verbatim) | ✓¹ | n/a | n/a | n/a | n/a | ✓ | ✓ | n/a | n/a | n/a |
| BriefLayout | ✓ | ✓ via shell | ✓ via shell | ✓ via shell | ✓ via shell | ✓ via shell | ✓ | ✓ | ✓ | ✓ | partial² |
| DecisionBoardLayout | ✓ | ✓ via shell | ✓ via shell | ✓ via shell | ✓ via shell | ✓ via shell | ✓ | ✓ | ✓ | ✓ | ✓ |
| VentureCockpitLayout | ✓ | ✓ via shell | ✓ via shell | ✓ via shell | ✓ via shell | ✓ via shell | ✓ | ✓ | ✓ | ✓ | ✓ |
| ComposerLayout | ✓ | ✓ via shell | ✓ via shell | ✓ via shell | ✓ via shell | ✓ via shell | ✓ | ✓ | n/a³ | ✓ | ✓ |
| LedgerLayout | ✓ | ✓ via shell | ✓ via shell | ✓ via shell | ✓ via shell | ✓ via shell | ✓ | ✓ | ✓ | ✓ | ✓ |
| ApprovalLayout | n/a (interrupt overlay, not a foreground card) | ✓ | ✓ (sheet `rounded-2xl`) | ✓ | ✓ | n/a (no header strip — overlay sheet) | ✓ | ✓ | n/a | n/a | uses amber explicitly |

¹ StackLayout passes the rule through `WelcomeRightPane`'s root which carries
`data-aigentme-right-pane="stack"` / `data-aigentme-layout="stack-layout-v1"`.

² BriefLayout doesn't import `accentTokens` directly — its color accents
(violet eyebrow, amber `Top priorities`) live inside the `BriefCard`
component it composes. Not a violation, but worth a follow-up that lifts
the eyebrow accents into `accentTokens.ts` so the palette stays canonical.

³ ComposerLayout's loading state is delegated to the inline form
(`ComposeXxxModal inline=true`) — the modals already have their own
submitting indicators.

### Findings

**Zero critical violations.** No raw hex anywhere in `components/metame/welcome/layouts/`. No
`hidden md:*` on any primary affordance. Every foreground layout
composes through `LayoutShell`, which carries the canonical chrome
(rounded-2xl outer, 56px header, `p-4 md:p-5 lg:p-6` body,
`p-3 lg:p-4` footer, `data-aigentme-right-pane` + `data-aigentme-layout`
markers).

**One DIS contract drift, documented as a framework finding (§4b below):**

The DIS `layoutRules` includes:
> `"Dismiss X at right-3 top-3 (12px from corner), 24x24 button, identical coordinate across every layout."`

LayoutShell renders dismiss **inside the 56px header strip on the right**
(line 76: `<header className="h-14 ... gap-3 px-4">` with the X as the
last child). Functionally this is identical-coordinate-across-layouts
(every layout's X sits in the same place because the shell owns the
chrome), but the implementation is *not* `absolute right-3 top-3`. The
visual result is correct and consistent; the rule string needs an update
to match.

**Resolution:** treat as a DIS amendment, not a code change. The
header-aligned dismiss is the better pattern (a) because it aligns
vertically with the icon + title in the header row, (b) because it
inherits the shell's symmetry contract, and (c) because absolute
positioning would float over header content on narrow widths.

Amending the DIS rule to:
> "Dismiss X is right-aligned inside the 56px header strip at icon-end
> position; same coordinate across every layout because the shared
> LayoutShell owns the placement."

### Visual-difference scoring (in-browser follow-on)

Static structural audit doesn't catch:
- Loading skeleton dimension drift vs final-state
- Animation curve timing
- Color contrast at the actual rendered surface
- iOS Safari rendering quirks on backdrop-blur

These require the DOM-bound `ParityChecker.generateReport` running on
the deployed dev surface. Capturing as a follow-on item — operator can
trigger from DevTools per the recipe in §5.1.

## 4b. Studio framework friction captured

What the parity loop taught us about the framework itself (the dog-food
point — the platform managing its own project end-to-end). Each row
becomes a candidate Studio improvement:

| # | Friction | Severity | Suggested Studio change |
|---|---|---|---|
| 1 | DIS `layoutRules` are free-form strings, not structured assertions. A rule like *"Dismiss X at right-3 top-3"* can't be machine-checked without bespoke regex per rule. | medium | Promote `layoutRules` from `string[]` to `LayoutRule[]` with `{ id, description, check: RuleCheck }` where `RuleCheck` is a discriminated union (`css-class-present` / `data-attr-present` / `coord-of-element` / `count-of-element` etc). Lets `ParityChecker` map rules → assertions automatically. |
| 2 | No way to express *"this rule applies via composition through LayoutShell, not directly on the layout"*. Static greps for `rounded-2xl` miss layouts that delegate to the shell. | medium | DIS rule entries gain optional `appliesVia: 'shell' \| 'direct'` so the checker walks the right node. |
| 3 | `mobileShapes` is descriptive only — `kind: "horizontal-swipe"` doesn't map to a runtime check. The checker can't verify a layout actually implements its declared mobile shape. | medium | Promote `mobileShapes.kind` to an enum with associated `mobileShapeCheck` selectors (e.g. for `horizontal-swipe`: assert presence of `overflow-x-auto` + `snap-x` + page-dot indicator). |
| 4 | Drift detection between DIS and implementation is manual. When we shipped the LayoutShell-owned dismiss, the DIS still said `right-3 top-3`. Nothing flagged the divergence. | medium | Add a `dis-drift` CI step that runs the parity check on every PR touching `components/metame/welcome/layouts/`. Critical drift fails the build. |
| 5 | Severity `info` rules (per-token compliance) get hidden by the same audit surface as `critical` rules (raw hex, hidden-md). Operator can't see "this is fine, just informational" vs "this blocks promotion" at a glance. | low | `ParityChecker.generateReport` already returns severity per violation; the panel UI should group by severity and surface only criticals to the merge gate. |
| 6 | The framework presumes one DIS per workstream; cross-workstream layouts (e.g. KnytTab shares LayoutShell) would have to fork the DIS. Composition isn't modeled. | low | DIS gains `extends?: string[]` so cartridge-specific DIS files inherit from a base `layout-shell-v1.dis.json`. Phase 3+. |

Each friction becomes an issue in the Studio improvement backlog. The
DIS amendment for #1 (`layoutRules` → `LayoutRule[]`) is the highest-
leverage next change — it unlocks #2, #3, and #4.

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
- Slice 1 (BriefLayout) shipped 2026-05-23 — `components/metame/welcome/layouts/BriefLayout.tsx`.
  - DIS template id: `brief-layout-v1`. Conforms to the symmetry
    contract (header 56 px, body `p-5 lg:p-6`, footer `p-3 lg:p-4`,
    dismiss X at `right-3 top-3`, outer `rounded-2xl`).
  - Desktop: Today / Project / Cartridge switcher in header strip.
    Mobile: switcher moves to a sticky bottom tab strip with iOS
    safe-area inset respected — the full-screen-reader shape declared
    in DIS `mobileShapes.brief-layout-v1`.
  - Loading skeleton preserves final dimensions; designed empty state
    instead of raw "no data".
  - Activator: clicking the Brief chip now sets
    `activeLayoutId = 'brief'` and fires the fetch. Dismiss returns to
    `'stack'` and clears brief state.
  - Other chips (`move-this-forward`, `review-venture-progress`) also
    request their intent-layouts; until Slices 2 + 3 land the registry
    falls back to `StackLayout` so behavior stays correct.
  - Surface markers added: every right-pane root carries
    `data-aigentme-right-pane="<id>"` and
    `data-aigentme-layout="<dis-template-id>"` so the in-browser
    ParityChecker can target it cleanly.

### 5.2 Known trade-offs (after the full Slice 1-6 batch)

- **Intent-owns-the-pane:** while a layout other than `stack` is mounted,
  the other stack cards (specialists, cartridges, Google connectors)
  are not visible in the right pane. Their handlers still fire — they
  re-appear once the user returns to `StackLayout` via dismiss.
- **Composer activator:** v1 surfaces the most recent draft from
  `artifacts[0]`. There is no chip yet to enter Composer directly —
  it's reachable by `setActiveLayoutId('composer')` and renders the
  designed empty state when no draft is present. A "Compose" chip
  lands in a follow-on slice (or via Phase 7 server-driven chips).
- **Contextual chip strip (Slice 7) deferred:** the chip set is still
  static today. Adding the server-side `quickChips` envelope is a
  one-prop API change; tracked as a follow-on so it doesn't block the
  visual review of Slices 0-6.

## 6. Slice 2-6 shipped 2026-05-23

- **`LayoutShell`** — shared chrome that locks the symmetry contract
  (header 56 px, body `p-5 lg:p-6`, footer `p-3 lg:p-4`, dismiss X
  at `right-3 top-3`, outer `rounded-2xl`, mobile sticky strip slot).
  Every layout composes through it; design fidelity violations are
  flagged at one location.
- **DecisionBoardLayout** — desktop 2-column hero + alternates;
  mobile horizontal-swipe with page-dot indicator; rationale trace in
  the footer.
- **VentureCockpitLayout** — desktop sticky top strip + 3-column
  body (KPIs / Active work / Recommended); mobile sticky section tabs
  showing one column at a time.
- **ComposerLayout** — single-pane editor with thread-context chip,
  draft body, send/discard footer. v1 renders the most recent artifact.
- **ApprovalLayout (interrupt)** — overlays the foreground layout;
  desktop centered card with backdrop dim, mobile bottom-sheet with
  drag handle and safe-area inset. Foreground stays mounted underneath.
- **LedgerLayout** — chronological view of activity receipts with
  filter chips (All / Receipts / Approvals / Briefs / Composer).
  Activated by expanding the receipts section.
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
