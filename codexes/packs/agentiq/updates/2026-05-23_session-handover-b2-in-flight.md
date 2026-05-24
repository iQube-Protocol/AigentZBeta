# Session handover — aigentMe Phase 2 in flight

> **Status:** Phase 2 + B.1 closed on dev; **B.2 just started** (Active Work
> functional layer). Pick up at §6.
> **Branch:** `claude/friendly-lovelace-41Wsn`
> **Last commit on dev:** `1b8e67bb` (B.1 3/3 — copilot KPI tools)
> **Local path on the operator's machine:** `/Users/hal1/CascadeProjects/AigentZBeta`
> **Repo:** `iqube-protocol/aigentzbeta`

---

## 1. Read these first

Mandatory before writing any code:

1. **CLAUDE.md** — repo-wide dev rules. Includes the push-commit-message
   mandate, identity-spine PARAMOUNT files, Q¢ rule, no-guessing rule.
2. **`codexes/packs/agentiq/items/OPERATORS_HANDBOOK.md`** §8a + §8b — design
   fidelity posture + Studio DIS framework. **Design fidelity is PARAMOUNT —
   same status as security and privacy.** Four-axis test on every UI change.
3. **`codexes/packs/agentiq/items/dis/aigentme-phase-2.dis.json`** — the
   Design Intent Spec governing every right-pane layout. Amend (don't
   silently diverge) when the design evolves.
4. **`codexes/packs/agentiq/updates/2026-05-23_aigentme-phase-2-end-to-end-dogfood.md`** —
   case study; covers slice plan, parity audit results, and what's left.
5. **`data/activation-catalog.ts`** — **single source of truth** for what
   metrics + actions each cartridge activation exposes. Read this before
   touching KPIs or NBAs. New activations / new metrics / new actions are
   one-row edits here — nothing else needs to change in the pipeline.

## 2. Operating realities

- **Auto-merge to dev is broken.** Pushing to `claude/**` no longer
  triggers the GitHub Actions workflow. Manual chase required after every
  session push:
  ```bash
  git push -u origin claude/friendly-lovelace-41Wsn
  git fetch origin dev
  git merge origin/dev -m "merge dev: sync before pushing <what>"
  git push origin HEAD:dev
  git push -u origin claude/friendly-lovelace-41Wsn   # re-sync after merge
  ```
- **Every commit message must name what's being pushed.** CLAUDE.md is
  unambiguous. Use the imperative + a clear noun phrase.
- **Deploy trigger:** `echo "Deploy trigger $(date)" > .amplify-deploy`
  before every commit that should land on dev. Amplify picks up the dev
  branch automatically once pushed.
- **No `--no-edit`. No skipping hooks. No force-push.**
- **No raw hex in components.** Use Tailwind tokens. New design tokens
  require operator approval.

## 3. Hard-won product context (corrections the operator made — internalise)

These were learned the hard way. Don't re-make them.

1. **Activations are the source of truth for KPIs and NBAs.** The
   `data/activation-catalog.ts` declares every activation; each entry
   carries its own `metrics: ActivationMetric[]` and
   `actions: ActivationAction[]`. KPI editor + NBA catalogue read from
   activations the persona has in `active` status — nothing else. New
   metric? Append to the catalog entry. The KPI editor's source picker
   and the resolver pick it up automatically. **Never hardcode metrics
   in a separate registry.**
2. **Metric class matters.** Each metric is `activity | outcome | standing`.
   Outcomes are weighted heaviest (violet+dot in the cockpit chip);
   standings get amber; activity is cyan default. The operator explicitly
   asked for outcome-oriented KPIs to dominate the venture cockpit.
3. **One approval surface only.** The Phase-2 `ApprovalLayout` overlay
   handles BOTH NBE approvals AND second-tier external-action confirms.
   The legacy inline `ApprovalCard` and `SecondTierApprovalCard` mounts
   in `WelcomeRightPane` are dead — DO NOT reintroduce them. The amber
   chrome on the overlay (border + primary CTA) is intentional; mirrors
   the Phase 1 amber treatment.
4. **Compose happens inside ComposerLayout, not in popups.** All 6
   compose modals (Gmail/Calendar/Doc/Sheet/Slides/Marketa) support
   `inline=true` and render inside the layout body. `openComposeByKind`
   sets `activeLayoutId='composer' + composerKind`. **Do not reintroduce
   the popup mounts.**
5. **No auto-open of external tabs.** `autoOpenArtifact` is a no-op now.
   The ArtifactCard's Gmail/Drive link is gated to `approved | sent |
   published` status — the operator clicks it post-send if they want.
6. **The right-pane layout owns its chrome via `LayoutShell`.** Header
   strip 56 px, body `p-4 md:p-5 lg:p-6`, footer `p-3 lg:p-4`, dismiss X
   right-aligned in the header (not absolute-positioned), outer
   `rounded-2xl`. Sub-cards `rounded-lg`. Per-layout markers via
   `data-aigentme-right-pane` + `data-aigentme-layout`. Don't bypass
   `LayoutShell` unless writing an interrupt overlay
   (ApprovalLayout is the only one).
7. **iOS / mobile MUST render every primary affordance.** Never put
   `hidden md:*` on first-class controls. The Welcome badge and the
   chip strip were both broken on iOS at different points — fixed and
   codified in the DIS.

## 4. Where Phase 2 is (closed unless noted)

| Slice | Status | Files |
|---|---|---|
| 0 Layout registry scaffold | ✓ | `components/metame/welcome/layouts/{types,registry,StackLayout,LayoutShell}.ts(x)` |
| 1 BriefLayout | ✓ | `layouts/BriefLayout.tsx` |
| 2 DecisionBoardLayout (vertical stack) | ✓ | `layouts/DecisionBoardLayout.tsx` |
| 3 VentureCockpitLayout (3 rows + carousels + glass accents) | ✓ | `layouts/VentureCockpitLayout.tsx` |
| 4 ComposerLayout (compose-in-layout) | ✓ | `layouts/ComposerLayout.tsx`; 6 modals have `inline=true` |
| 5 ApprovalLayout (interrupt, unified, amber) | ✓ | `layouts/ApprovalLayout.tsx` |
| 6 LedgerLayout (filter chips, JSON expand) | ✓ | `layouts/LedgerLayout.tsx` |
| 7 Dual-dispatch chip strip + server seam | ✓ | `useAigentMeCopilotBridge.ts` + tab |
| **A** parity audit | ✓ | case-study §4a/§4b; one DIS amendment landed |
| **B.1** KPI source pipeline (activation-bound) | ✓ | `services/strategy/{kpiTypes,kpiResolver}.ts` + `data/activation-catalog.ts` + cockpit `KpiChip` + `KpiDetailLayout` + copilot tools |
| **B.2** Active Work functional layer | **IN FLIGHT — pick up here** | see §6 |
| **B.3** Live `surfaceUpdate` over copilot SSE stream | pending | not started |

## 5. The activation catalog — orient yourself before B.2

Each entry in `data/activation-catalog.ts` carries:

```ts
{
  id, label, description, longDescription,
  gate: 'open' | 'gated',
  tabSlug, sourceCartridge, icon, color,
  metrics: ActivationMetric[],   // KPIs (B.1 wired)
  actions: ActivationAction[],   // NBAs (B.2 will wire)
}
```

`ActivationAction`:

```ts
{
  action: string,                          // unique per activation
  label: string,                           // 'Draft partner outreach'
  rationale: string,                       // one-line why
  specialist?: 'marketa' | 'quill' | ...,  // who takes the handoff
  approvalRequired?: boolean,
}
```

Helpers already exported:

- `metricsForActiveActivations(activeIds)` — used by B.1 KPI editor
- `actionsForActiveActivations(activeIds)` — **B.2 will use this**

## 6. B.2 — what to ship next (Active Work functional layer)

**Mirror of B.1 but for actions instead of KPIs.** Two halves:

### B.2 (1/2) — Catalogue-driven NBAs in the cockpit Recommended row

Today `ventureProgressBuilder.ts` produces `recommendedActions` from
`selectNbeCandidates()` against `services/orchestration/nbeCatalog.ts`.
That catalogue is a separate global list — **NOT activation-driven**.
Replace with activation-driven NBAs.

**Server-side changes in `services/orchestration/ventureProgressBuilder.ts`:**

1. After resolving active activations (already done for B.1 in
   `kpiResolver.ts` via `getActiveActivationIds`), call
   `actionsForActiveActivations(activeIds)` to get every NBA exposed
   by the persona's active activations.
2. Map each to a `BriefNextBestAction` shape (the existing one used by
   `recommendedActions`). Keep the catalog `selectNbeCandidates`
   output as a *fallback / secondary* set so AVL-tier candidates
   still surface when nothing else applies.
3. Add `catalogueActions: BriefNextBestAction[]` to the venture-progress
   shape (or replace `recommendedActions` outright — prefer replace,
   document the migration in the case-study doc).

**Client-side changes:**

- Cockpit Row 3 (Recommended) already reads `data.recommendedActions`
  — no change needed if you replace in place.
- Each card already routes through `handleNbeAct` which fires the
  approval overlay. Confirm the catalogue actions carry
  `approvalRequired` correctly so the gate applies.

**Files to touch:**

- `services/orchestration/ventureProgressBuilder.ts` (call `actionsForActiveActivations`)
- `components/metame/cards/VentureProgressCard.tsx` (no change expected — same shape)

### B.2 (2/2) — Active Work cards become actionable

Current Active Work row shows in-flight intents read-only (intentName /
cartridge / status). Make them clickable with a context menu.

**Schema additions (`services/iqube/intentQube.ts` IntentRow):**

```ts
canResume?: boolean
canHandOff?: boolean
canCancel?: boolean
nextAction?: string | null
blockers?: string[]
lastReceiptId?: string | null
```

Best to compute these server-side at query time from intent status +
specialist routing state, not store new columns.

**New layout: `ActiveWorkDetailLayout`** (mirrors `KpiDetailLayout`):

- Opens when an Active Work card is clicked
- Shows intent name, cartridge, status, owning specialist, last
  receipt, blockers
- Footer actions: `Open intent details` / `Hand off to specialist` /
  `Mark blocked` / `Cancel intent`
- Dismiss returns to `venture-cockpit`

Register in `layouts/registry.ts` as `active-work-detail`. Add to
`RightPaneLayoutId` union in `types.ts`. DIS template id
`active-work-detail-layout-v1` — append a mobile-shape entry +
layoutRules update.

**State plumbing in the tab:**

- Add `selectedIntentId: string | null` (mirror `selectedKpiId`)
- Pass through to `VentureCockpitLayout` via `layoutProps` as
  `onSelectActiveWork(intentId)`
- ActivityChip becomes a `<button>` (currently `<div>`)

**API for the actions:**

- `cancel` / `mark-blocked` / `hand-off` need server endpoints under
  `app/api/assistant/intents/[id]/...` or via the existing
  `/api/connectors/execute` pipeline. Stub these with todo comments
  if the routes don't exist yet — the layout shell can ship first.

### B.2 copilot tools (parallel to B.1's KPI tools)

Add to `useAigentMeCopilotBridge.ts`:

- `aigentme_list_actions` — readable already covered if we add
  `availableActions` like `availableKpiSources`
- `aigentme_start_action` — fire an action by `{ activationId, action }`;
  goes through `handleNbeAct` path
- `aigentme_cancel_active_work({ intentId })` — cancel intent
- `aigentme_open_active_work_detail({ intentId })`

Same guardrails: refuse actions whose activation is not currently
active; refuse to cancel intents that are already complete.

## 7. After B.2 — B.3 (live updates)

When the copilot starts a tool that produces a KPI receipt or moves
an intent, the cockpit currently only sees the change on the next
fetch. B.3 adds a `surfaceUpdate` event on the copilot SSE stream:

- Server: emit `surfaceUpdate: { kind: 'kpi-incremented' | 'intent-status-changed' | 'artifact-created', payload }`
  events alongside the existing copilot tokens
- Client: subscriber in the tab patches `ventureProgress.activeKpis`
  / `ventureProgress.recentActivity` / `artifacts` in place — no
  full refetch
- Optimistic updates from chip dispatch (mark intent as `running`
  before the server confirms)

Out of scope for B.2.

## 8. Operating ethos the operator expects

- **Play back your understanding before coding** when in doubt. The
  operator caught two consecutive misses earlier in the session by
  asking me to articulate the design intent first.
- **Activation-driven thinking.** Whenever you find yourself
  hardcoding "what KPIs / NBAs / surfaces does X have", check the
  activation catalog first. If it should be configurable per persona,
  it lives on the catalog.
- **Outcomes > activity.** Across every cartridge, the operator wants
  outcomes (replies, conversions, completions) weighted heavier than
  activity (sends, drafts, clicks). The `class` field on metrics
  drives this; the visual treatment in `KpiChip` (violet+dot for
  outcomes) is canon.
- **One pane, one intent.** The right-pane layout owns the operator's
  focus. No popups, no fragmented surfaces, no Phase-1 inline cards
  mixed in with Phase-2 chrome. If you're about to mount something
  outside `LayoutShell` and it's not the `ApprovalLayout` interrupt
  overlay, stop and reconsider.
- **Design fidelity reviewer is the user.** They have a strong visual
  eye and call out symmetry / rhythm / restraint issues. Run the
  four-axis test (handbook §8a) before declaring a slice done.
- **Use the system to manage the project.** The dog-food posture is
  explicit. The DIS, the parity report, the case-study log, the
  operators handbook, the persona injections — all are part of the
  loop the user wants to feel friction in.

## 9. Quick orientation commands

```bash
# Confirm where you are
git branch --show-current   # should be claude/friendly-lovelace-41Wsn
git log --oneline -10

# Compare to dev
git fetch origin dev
git log --oneline origin/dev..HEAD

# Find any in-flight uncommitted work
git status --short

# Find Phase 2 layout files
ls components/metame/welcome/layouts/

# Find activation catalog
sed -n '/^export const ACTIVATION_CATALOG/,/^];/p' data/activation-catalog.ts | head -50
```

## 10. Where this handover came from

Written at the end of a long session that:
- Closed Phase 2 (Slices 0–7)
- Shipped Slice A (dual-dispatch chip strip)
- Shipped Slice C (parity validation)
- Shipped B.1 (KPI source pipeline, 3 parts, activation-driven)
- Started B.2 (Active Work functional layer — see §6)

Last operator message before this note was a request for handover
notes, before B.2 (1/2) code landed.

When the next session reads this, the first thing to do is start
B.2 (1/2): wire `actionsForActiveActivations` into
`ventureProgressBuilder.ts` and confirm the cockpit Row 3 picks up
activation-driven NBAs. Small commit. Then move to B.2 (2/2) with
the actionable Active Work cards + new detail layout.
