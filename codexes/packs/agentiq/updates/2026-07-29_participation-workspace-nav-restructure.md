# Participation ← Workspace nav restructure (Research Workspace relocation)

**Date:** 2026-07-29
**Branch:** `claude/tokenqube-minting-integration-ms2yjd`
**Scope:** IRL cartridge navigation only (`data/codex-configs.ts` → `IRL_CARTRIDGE`); no change to the Venture Lab, no change to any access model beyond the deliberate nav prune described below.

## What changed

1. **"Research Workspace" is no longer a top-level tab group.** It was a sixth sibling beside Participation (`order: 3.5`); that group is gone.
2. **A new tab, `irl-workspace` (label "Workspace"), lives inside the Participation group.** It carries the icon `LayoutGrid` — the exact icon the Companion's own "Workspace" nav item uses (`services/companion/companionNavigation.ts:COMPANION_NAV_ICON.workspace`), reused verbatim rather than approximated.
3. **The Overview view's icon changed from `LayoutDashboard` to `Compass`** (`services/research/researchWorkspaceViews.ts`) so the parent tab and its default child no longer read as near-duplicates of each other now that the parent owns the grid icon.
4. **The former nine top-level "workspace"-group tabs are now `irl-workspace`'s `subTabs`** — one tier deeper, the same nesting `irl-passport-steward` already uses for its own KNYT sub-items. Locker and Participants are **pruned from that subTab row** (operator instruction — Participation already has its own Locker tab and the two views are still real SPEC-IRL-WORKSPACE-001 §7 views; they are just not offered as clickable tabs here). QubeTalk and Administration are kept.
5. **The horizontal "programme chip" selector is replaced by a grouped, vertical left-hand nav** for the research entrance only (`ResearchProgrammeNav` in `PartnerProgrammesTab.tsx`), mirroring the Laboratory → Experiments sidebar's section pattern. Four sections: **Autonomi**, **Lehigh**, **MFE Capstone**, **CS Capstone**. The Venture Lab's workspace entrance is untouched — it keeps its existing horizontal selector, unchanged pixel-for-pixel.
6. **Non-Autonomi programme titles (Lehigh / MFE Capstone / CS Capstone) are inline-renameable** via a pencil affordance in the left nav; Autonomi's items are not.

## How the open questions were resolved

**(a) Overview / Activity tier placement.** Both stay exactly where the operator's default suggested: Overview remains the parent tab's default `initialSurface` and the first offered subTab; Activity (the `evidence` view) is unaffected and stays in the subTab row. Neither was removed — only Locker and Participants were pruned, per the explicit instruction.

**(b) "Item levels" for Lehigh / MFE / CS Capstone.** Resolved by **following the existing data model rather than inventing one** (`services/research/researchWorkspace.ts`, already-shipped `parentId` hierarchy):
   - **Lehigh** section is a flat, single entry (`lehigh-capstone-programme`) — it has no sibling items in its own section; its two cohorts each start their *own* section instead.
   - **MFE Capstone** section has REAL sub-items already defined in the registry: the cohort (`lehigh-mfe-capstone`) plus its three student projects (Risk Management, Pricing, Financial Systems) are rendered as one root + three indented children.
   - **CS Capstone** is the same shape: cohort + three student projects (Software Build, Agent Integration, Constitutional Runtime).
   - **Autonomi** section: the Autonomi Independent Review Programme is a root with its three EXP-P1/P2/P3 experiment-workspace children truly `parentId`-nested beneath it. Validation Programme v1 (VP1) is placed in the **same section** per the operator's own instruction, but it is **not** rendered as VP1's child — the registry does not express that membership (VP1 has no `parentId` at all; its members are the *series* EXP-P1–P4, a different relationship than the Autonomi programme's three review-workspaces). VP1 renders as its own section-root sibling, not invented as a nested child it structurally is not.

   New registry field: `ResearchWorkspace.navSection` (declared on the five section-starting workspaces, inherited by descendants via the same nearest-ancestor walk `researchWorkspaceOwner`/`researchWorkspaceLinks` already use), plus `researchWorkspaceNavSection()`, `researchWorkspaceNavDepth()`, and `researchWorkspaceTitleEditable()` derivations, and the `RESEARCH_NAV_SECTIONS` order/label list — all in `services/research/researchWorkspace.ts`, none hand-copied elsewhere.

**(c) Icon choice.** Workspace (parent tab) = `LayoutGrid`, matching the Companion's workspace nav item exactly. Overview = `Compass` (changed from `LayoutDashboard`, which is visually adjacent to `LayoutGrid` — both render as a grid of rectangles — so the two are now clearly distinct). `LayoutGrid` was not previously registered in `app/triad/components/codex/iconMap.ts` and rendered as a blank fallback icon; it is now registered (both the `lucide-react` import and the exported map), and `tests/capability-artefact-home.test.ts`'s "no tab icon is inert" canary confirmed the fix.

**(d) Live verification.** **Not obtained.** No dev server / browser check was performed in this sandbox — I could not start one and click through the new Workspace tab, the programme list, or a programme's subTab row. Verification here is limited to: full `npx tsc --noEmit` diff against the pre-change baseline (identical pre-existing error set, zero new errors in any touched file — see below) and the full `npx vitest run` suite (185 files / 3331 tests, all passing after the test updates described below).

## A disclosed side effect of the Locker/Participants prune

Pruning Locker and Participants from the Workspace subTab row is a **navigation** decision, not a role-authority change — `RESEARCH_WORKSPACE_ROLE_AUTHORITY` and the underlying `satisfiesWorkspaceScope`/data-access checks are untouched. But it has one real, disclosed consequence for the *reachability* canaries in `tests/research-lab-workspace.test.ts`: **Participants was the one view that distinguished Research Steward, Faculty Lead, Principal Investigator and Researcher from each other in that canary's nav-reachability terms.** With Participants no longer offered as a tab to anyone, those four roles now reach an *identical* six-view set through the Workspace nav. This is recorded explicitly in the rewritten test file rather than hidden — the roles' actual administrative authority differences live entirely server-side now (nothing in this restructure removed or widened them), but a reader of that specific canary should know the nav no longer visibly distinguishes them.

## Files touched

- `data/codex-configs.ts` — `IRL_CARTRIDGE.tabGroups` (removed `workspace` group), `IRL_CARTRIDGE.tabs` (new `irl-workspace` tab with `subTabs`, replacing the nine former top-level workspace tabs)
- `services/research/researchWorkspace.ts` — `ResearchWorkspaceNavSection` type, `RESEARCH_NAV_SECTIONS`, `navSection` field + assignments, `researchWorkspaceNavSection()`, `researchWorkspaceNavDepth()`, `researchWorkspaceTitleEditable()`
- `services/research/researchWorkspaceViews.ts` — Overview icon `LayoutDashboard` → `Compass`
- `app/triad/components/codex/tabs/PartnerProgrammesTab.tsx` — new `ResearchProgrammeNav` left-nav component (research kind only), `WorkspaceView` gained `navSection`/`navDepth`/`titleEditable`, outer layout wraps in a flex row with the sidebar for research kind (venture kind unchanged)
- `app/triad/components/codex/iconMap.ts` — registered `LayoutGrid`
- `tests/research-lab-workspace.test.ts`, `tests/research-workspace-spec.test.ts`, `tests/lab-tab-restructure-and-locker-ux.test.ts` — re-pointed at the new nested `subTabs` structure and the Locker/Participants prune (see inline comments for the reasoning behind each changed assertion)

## Not done / explicitly out of scope

- **No server-side persistence** for the inline-renamed programme titles. The rename control writes to `localStorage` only (`research_workspace_title_overrides_v1`), consistent with CLAUDE.md's "localStorage for UX reactivity only" boundary — this is a per-browser override, not a platform-wide edit. If the operator wants a durable rename, that needs its own migration + API route.
- Autonomi's items (VP1, the Autonomi programme, EXP-P1/P2/P3) are **not** editable, per the operator's explicit instruction that these are real, registered experiments.
