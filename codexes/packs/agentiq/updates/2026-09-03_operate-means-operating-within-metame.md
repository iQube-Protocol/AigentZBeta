# Operate Means Operating Within metaMe — MoneyPenny navigation/viewport correction

**Date:** 2026-09-03
**Scope:** MoneyPenny's presentation across its current hosts — the standalone `moneypenny-codex` cartridge, metaMe (`metame-codex`), and the CI/Knightsbridge/Horizen bridges. No other domain's navigation was refactored.

## The invariant (reusable Operate principle)

> **metaMe is the primary operating environment. MoneyPenny (or any other domain-specific cartridge) is a selected context WITHIN it, never a parallel environment metaMe merely links out to.**
>
> Every host that presents a domain's Operate workspace — a bridge journey stage, metaMe's own cartridge navigation, or the domain's standalone cartridge — must present **the same workspace** through **the same focused/expanded presentation contract**:
>
> - **Focused** keeps the host's own frame (a bridge's stepper, a journey's stage strip) and shows only the domain's own submenu — never the host's unrelated top-level chrome, and never a second, hand-built submenu duplicating the domain's real one.
> - **Expanded** reveals the *host's* own primary shell (metaMe's own top-level navigation) with the domain selected inside it — **never** a jump to a different, standalone shell for that domain. Expanding is lifting chrome suppression on the surface already shown, not swapping the destination.
>
> Different hosts may legitimately differ in **what task they open on** (a bridge stage may deep-link to a specific panel; a normal cartridge entry lands on the domain's own default) and **what capabilities are authorized** (an admin-gated panel is hidden per-host by the same auth check, not by host-specific navigation). Different hosts must **never** differ in **how the domain's own navigation is implemented** — one canonical submenu definition, selection state, and capsule/tab mapping, reused verbatim.

This composes with, and does not replace, the platform's existing "Extend, Don't Duplicate" and "source-of-truth parity" invariants (`CLAUDE.md`, `inv.engineering.036/037`) — it is that same discipline applied specifically to a domain's *navigation surface* rather than its data.

## Why this needed writing down now

Before this pass, MoneyPenny had three genuinely different navigation implementations across its hosts, not three legitimate presentations of one:

1. **The standalone cartridge** (`MONEYPENNY_CARTRIDGE`, `data/codex-configs.ts`) already had the real native submenu — Home / My Money / Plan / Markets / Activity, plus an Admin tab — registered as sibling `CodexTab`s under one `moneypenny` tab group.
2. **metaMe's own MoneyPenny mount** (`METAME_CODEX`'s `moneypenny` group) had exactly **one** tab — a fixed "Orchestration" panel with no siblings — so metaMe's own tier-2 sub-header had nothing to render. Selecting MoneyPenny inside metaMe showed the copilot/orchestration workspace with no domain submenu at all.
3. **Horizen's own embed of MoneyPenny inside metaMe** (`journeySurfaceRegistry.ts`'s `moneypenny-orchestration-focused` descriptor) additionally special-cased its own **expand** affordance to jump to the *standalone* `moneypenny-codex` cartridge, on the reasoning that the metaMe mirror (item 2 above) had no submenu worth expanding into. That was a real bug fixed by pointing at the wrong destination, not by giving metaMe's own mount a real submenu.

Item 3 is a direct illustration of why the principle matters: a real defect (nothing to expand into) was patched by breaking the actual invariant (expand must stay inside the host, metaMe) instead of fixing the underlying cause (metaMe's mount had no real submenu). Once metaMe's mount carries the real submenu, the original problem no longer exists, and the workaround becomes the residual bug.

## What changed to satisfy it

- **`MONEYPENNY_AREA_TABS`** (`data/codex-configs.ts`, defined once, before both cartridges that use it) is now the **single canonical submenu definition** — six `CodexTab` entries (Home, My Money, Plan, Markets, Activity, Admin), each dispatching through `MoneyPennyPanelTab` (or `MoneyPennyAdminTab`) with the same `props`/`slug`/`order` every host shares. `MONEYPENNY_CARTRIDGE.tabs` and `METAME_CODEX`'s MoneyPenny group both spread this array verbatim — neither hand-retypes it.
- **`METAME_CODEX`'s MoneyPenny group** now carries all six tabs (previously one), so CodexPanelDynamic's tier-2 sub-header — the real submenu — renders whenever MoneyPenny is selected inside metaMe, exactly as it does in the standalone cartridge.
- **Horizen's `moneypenny-orchestration-focused` descriptor** no longer declares `expandedCodexSlug`/`expandedTab`. Its `tab` now points at `home` (metaMe's MoneyPenny group's own default landing tab, matching "a normal entry without a specified task lands on Home") instead of the retired single-tab slug, and `focusedNavDepth` moved from `0` to `1` — hiding only metaMe's own top-level chrome in focused view while keeping the submenu navigable, the same depth `MoneyPennyBridgeEmbed.tsx` already uses for CI/Knightsbridge's embed of the standalone cartridge. Expanding now simply lifts that chrome suppression, revealing metaMe's real navigation with MoneyPenny selected and its submenu beneath — never a jump to `moneypenny-codex`.
- **The Admin tab** moved from a standalone, ungrouped top-level tab (rendered *beside* the MoneyPenny group chip) into the group itself, immediately after Activity — so it appears in the submenu, not beside it, consistently across every host, while remaining gated by the same `adminOnly` check every other tab already goes through.
- A `LEGACY_TAB_SLUGS` alias (`'moneypenny-orchestration': 'home'`) keeps any already-stored deep link to the retired single-tab slug resolving correctly, alongside direct fixes to the primary sources that used to declare that slug (`ACTIVATION_CATALOG`, `catalogueDestinationHelper.ts`, the `moneypenny-orchestration-focused` registry entry, and the one non-URL-driven navigation call site in `SpecialistsLayout.tsx` that sets `activeTabSlug` directly and doesn't pass through the alias table).

## What this principle does not cover (deliberately)

- CI and Knightsbridge's own embed of MoneyPenny (`FinancialSovereigntyOperateStage` → `MoneyPennyBridgeEmbed`) is a `kind: 'component'` journey surface, not a `kind: 'embed'` registry descriptor — it does not currently expose an expand-to-metaMe-shell affordance at all (it is always presented focused). The task instruction's explicit expand-target complaint was about Horizen's screenshot specifically; giving CI/Knightsbridge a symmetric expand affordance would be a real, separately-scoped feature addition (converting or wrapping that stage's presentation into the shared embed switch), not a bug fix, and is out of scope for this slice.
- This principle governs MoneyPenny's own navigation surface. It does not, by itself, mandate that every other domain cartridge adopt the same submenu-sharing pattern — but the pattern (one canonical tab array, spread into every host that presents that domain) is the correct one to reach for the next time this shape of problem appears.
