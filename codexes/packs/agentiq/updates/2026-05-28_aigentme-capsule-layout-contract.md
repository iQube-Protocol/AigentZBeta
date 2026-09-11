# aigentMe Capsule ↔ Layout Contract

**Date:** 2026-05-28
**Surface:** aigentMe split tab (`app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx`) + right-pane layout registry
**Status:** Hardened. See guardrails section.

---

## Background

The aigentMe right pane uses a layout registry (`stack | brief | decision-board | venture-cockpit | composer | approval-interrupt | ledger | kpi-detail | active-work-detail | specialists`). Four of those layouts are paired with the four Capsule templates — Brief, Move forward, Venture progress, Ask specialists — each Capsule being a bounded "engaged" surface the operator works inside before moving to the next.

Two pieces of state drive what renders on the right:

| State | Role |
|---|---|
| `activeCapsuleId: "brief" \| "move-forward" \| "venture-progress" \| "ask-specialists" \| null` | Which Capsule template the operator is engaged in. Drives the session-history chip strip + per-Capsule rendering inside the stack pane. |
| `activeLayoutId: RightPaneLayoutId` | Which layout the foreground mounts. The registry resolves the component. |

The contract: **for every Capsule, `activeCapsuleId` and `activeLayoutId` move in lockstep**. Activating a Capsule MUST also mount its dedicated layout; dismissing the Capsule MUST also return the layout to `stack`. Drift between the two surfaces the operator on the manual/stack fallback while parent state thinks a Capsule is engaged — capsule data lives in state and is invisible, CTAs render in the wrong pane, suggested-artifact chips fire but the drafted artifact lands at the bottom of the stack pane instead of nested inside the Capsule.

---

## Canonical mapping

```ts
const CAPSULE_LAYOUT: Record<CapsuleId, RightPaneLayoutId> = {
  "brief":            "brief",
  "move-forward":     "decision-board",
  "venture-progress": "venture-cockpit",
  "ask-specialists":  "specialists",
};
```

Defined once at `AigentMeWelcomeSplitTab.tsx` (search for `CAPSULE_LAYOUT`). Adding a fifth Capsule means extending both this constant and the `CapsuleId` type union.

## Activator helper

```ts
const engageCapsuleAndMount = useCallback((next: CapsuleId) => {
  engageCapsule(next);
  setActiveLayoutId(CAPSULE_LAYOUT[next]);
}, [engageCapsule]);
```

Every Capsule activator routes through `engageCapsuleAndMount`. Call sites:

- **Left-pane chip strip** — `handleCtaClick` for `brief-me`, `move-this-forward`, `review-venture-progress`, `ask-specialists`.
- **Chat-copilot quick prompts** — `copilotQuickPrompts[].onSelect` for `brief`, `move`, `venture`, `ask-specialists`.

Both paths use the same helper. Never call `engageCapsule` alone, and never `setActiveLayoutId('brief' | 'decision-board' | 'venture-cockpit' | 'specialists')` without also engaging the Capsule.

## ComposerLayout is an overlay, not a foreground

`ComposerLayout` is mounted by `AigentMeWelcomeSplitTab.tsx` as an absolute-positioned overlay (`z-30` + backdrop) on top of `ForegroundLayout` whenever `composerKind !== null`. The Capsule foreground stays mounted underneath so the operator can return to it after compose. The overlay condition: `composerKind && activeLayoutId !== 'composer'`.

ComposerLayout's dismiss/close/onCreate/cancel handlers MUST call `onComposerClose?.()` ONLY — never `onRequestLayout(...)` and never any other layout swap. The legacy `onRequestLayout('stack')` lines were vestigial from when ComposerLayout was a foreground surface, before the overlay refactor. Calling them now unmounts the underlying Capsule and the operator's work vanishes.

## Pill lifecycle props (every dedicated layout)

Brief, Move-forward, Venture, and Specialists layouts each need this full set of props threaded through to their card components:

```
artifacts, actionPendingArtifactId, actionErrors,
secondTierApproval, onSendArtifact, onDismissArtifact,
onApproveSecondTier, onCancelSecondTier,
onDismissQueued, onMarkPillComplete
```

When a queued intent exists for an NBA, render `ExpandedNBEPill` (with the drafted artifact + second-tier approval folded inline) — never `NextBestActionCard queued={true}` (the legacy "Queued" badge bombs without lifecycle props wired).

Grouping helper for nesting artifacts under their parent intent:

```ts
const artifactsByIntent = useMemo(() => {
  const map: Record<string, ArtifactCardData[]> = {};
  for (const a of artifacts ?? []) {
    if (!a.intentId) continue;
    (map[a.intentId] ??= []).push(a);
  }
  return map;
}, [artifacts]);
```

---

## How the regressions hit (failure history)

### 2026-05-28 Capsule disappearance after Act

**Symptom:** Operator engages Brief Capsule, Acts on 2nd or 3rd CTA, composes a doc/email, and the Brief Capsule vanishes after the compose modal closes. Brief data persists (clicking "Brief me" chip resurfaces it without refetch) — only the layout is gone.

**Cause:** ComposerLayout's `handleDismiss` and `closeToStack` were calling `onRequestLayout('stack')` in addition to `onComposerClose?.()`. Every compose close unmounted whatever Capsule layout was foreground.

**Fix:** `b226c88a` — drop the layout swap from both paths.

### 2026-05-28 Ask Specialists rendered on stack/manual fallback

**Symptom:** Clicking "Ask specialists" left-pane chip showed the specialist response + suggested-artifact chips on the manual/stack surface (the one with `Update my ExperienceModel` / `Brief me` / `Move goals forward` cards) instead of inside the dedicated Specialists Capsule.

**Cause:** `handleCtaClick('ask-specialists')` called `engageCapsule('ask-specialists')` but skipped `setActiveLayoutId('specialists')`. The other three Capsule chips set both states; this one set only the Capsule.

**Fix:** `e7d79742` — add the missing layout mount.

### 2026-05-28 Move-forward + Venture cockpit rendered legacy NBA cards

**Symptom:** Queued items in Move forward + Venture cockpit rendered as `NextBestActionCard` with a "Queued" badge instead of as `ExpandedNBEPill` (drafted artifact + second-tier approval folded inline). Acting on them bombed.

**Cause:** `DecisionBoardLayout` and `VentureCockpitLayout` had been reverted to use only `NextBestActionCard queued={true}`, with no Pill-lifecycle props wired.

**Fix:** `b226c88a` — restore the `ExpandedNBEPill` branch with all lifecycle props.

---

## Guardrails now in place

1. **Single source of truth for the mapping** — `CAPSULE_LAYOUT` constant in `AigentMeWelcomeSplitTab.tsx`. Type-checked against `CapsuleId` and `RightPaneLayoutId`.
2. **Single activator helper** — `engageCapsuleAndMount(capsuleId)` atomically sets both states. Both chip paths (left strip + chat copilot quickPrompts) route through it.
3. **In-file warning** — `ComposerLayout.tsx` top-of-file docblock carries an "OVERLAY CONTRACT — READ BEFORE EDITING" section calling out the disallowed `onRequestLayout('stack')` pattern and naming the 2026-05-28 regression.
4. **CLAUDE.md rule** — `## aigentMe Capsule ↔ Layout Contract — MUST READ (PARAMOUNT)` section, with the canonical mapping table, the four rules (atomic activator, overlay-only composer, full Pill props, no blanket layout resets), and the failure history.

---

## Repro recipe (for verifying any future regression)

1. Open aigentMe tab.
2. Click "Brief me" left-pane chip. Verify the Brief Capsule (BriefLayout) mounts.
3. Act on the first NBA Pill. Verify it flips Blue → drafts an artifact via composer overlay → the overlay sits on top of the Brief Capsule (Brief Pills still visible underneath).
4. Cancel or Submit the compose modal. **Verify the Brief Capsule remains mounted** (this is the regression-prone moment).
5. Act on a second NBA Pill. Same flow.
6. Repeat for "Move forward", "Venture progress", "Ask specialists" — each chip should mount its dedicated layout (`decision-board` / `venture-cockpit` / `specialists`), not stay on the stack pane.
7. Confirm queued NBAs render as `ExpandedNBEPill` with their drafted artifact nested inside, not as `NextBestActionCard` with a "Queued" badge.

If any step fails, check first: did `engageCapsuleAndMount` route the chip? Did ComposerLayout's dismiss path re-introduce `onRequestLayout(...)`? Did a dedicated layout drop a lifecycle prop?
