# Commit Brief: `6131ef3` — add aigentMe split-screen welcome tab with persistent CopilotKit AG-UI bridge

| Field | Value |
|-------|-------|
| SHA | [`6131ef3`](https://github.com/iQube-Protocol/AigentZBeta/commit/6131ef306f8c69c2401b79f1bca20966577f2342) |
| Author | Claude |
| Date | 2026-05-14T23:33:20Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add aigentMe split-screen welcome tab with persistent CopilotKit AG-UI bridge

- New AigentMeWelcomeSplitTab: SmartTriadCopilotLayer (embedded variant)
  fills left ~55%, dynamic action surface on right ~45%
- ComposeQuickActionsStrip mounted in copilot footer slot — 6 compose
  actions (email/event/doc/sheet/slides/marketa) open existing modals
- WelcomeRightPane: identity + CTA pills always visible; live cards
  (brief/NBE/approval/artifact) anchored above-fold; config sections
  collapse into single-open accordion (experience model, specialists,
  cartridges, Google Workspace, activity receipts)
- useAigentMeCopilotBridge: registers useCopilotAction handlers
  (aigentme_open_compose, aigentme_fire_cta, aigentme_expand_section,
  aigentme_focus_card) + useCopilotReadable slots for two-way copilot
  control of the right pane. All readables T1-safe per spine contract
- Registered as new 'aigent-me-split' tab in metame-codex group
  (adminOnly preview); classic AigentMeWelcomeTab untouched
```

## Body

- New AigentMeWelcomeSplitTab: SmartTriadCopilotLayer (embedded variant)
  fills left ~55%, dynamic action surface on right ~45%
- ComposeQuickActionsStrip mounted in copilot footer slot — 6 compose
  actions (email/event/doc/sheet/slides/marketa) open existing modals
- WelcomeRightPane: identity + CTA pills always visible; live cards
  (brief/NBE/approval/artifact) anchored above-fold; config sections
  collapse into single-open accordion (experience model, specialists,
  cartridges, Google Workspace, activity receipts)
- useAigentMeCopilotBridge: registers useCopilotAction handlers
  (aigentme_open_compose, aigentme_fire_cta, aigentme_expand_section,
  aigentme_focus_card) + useCopilotReadable slots for two-way copilot
  control of the right pane. All readables T1-safe per spine contract
- Registered as new 'aigent-me-split' tab in metame-codex group
  (adminOnly preview); classic AigentMeWelcomeTab untouched

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/TabRenderer.tsx` |
| Added | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Added | `components/metame/copilot/ComposeQuickActionsStrip.tsx` |
| Added | `components/metame/welcome/WelcomeRightPane.tsx` |
| Added | `components/metame/welcome/useAigentMeCopilotBridge.ts` |
| Modified | `data/codex-configs.ts` |

## Stats

 6 files changed, 1800 insertions(+)
