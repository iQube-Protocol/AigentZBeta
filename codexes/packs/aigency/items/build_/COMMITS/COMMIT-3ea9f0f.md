# Commit Brief: `3ea9f0f` — feat(aigentme): downloadable VentureQube schema + downloads menu

| Field | Value |
|-------|-------|
| SHA | [`3ea9f0f`](https://github.com/iQube-Protocol/AigentZBeta/commit/3ea9f0fb8a5076c21eb5ff4161daea7d8aa45196) |
| Author | Claude |
| Date | 2026-06-03T16:23:08Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat(aigentme): downloadable VentureQube schema + downloads menu

aigentMe's lower-right compose strip now exposes a Download icon
alongside the Upload icon. Tapping it opens a DownloadsMenu listing
assets the operator can share with an off-platform agent (ChatGPT,
Claude, etc.) so the agent can prepare content that uploads cleanly
back into aigentMe.

v1 deliverables:

1. public/downloads/ventureQube-schema.json — hand-authored JSON
   Schema Draft-07 spec mirroring services/iqube/ventureQubeSchema.ts
   (v0.4). Includes an `_agent_briefing` block with system overview,
   sovereignty principles, refresh cadence ("snapshot, re-upload
   anytime"), why-safer commentary vs sharing raw notes with an
   off-platform agent, and a dedicated experience-guide explainer
   since the guide is derived at runtime rather than declared
   literally in the schema. Embedded worked example covers operator
   / strategy / one venture with myCartridge block / all five plan
   horizons / KPI board.

2. components/metame/downloads/DownloadsMenu.tsx — modal popover
   surfaced from the new Download icon. Lists items with title,
   description, expand-to-purpose, and a download anchor that
   triggers the browser download dialog. Two placeholders queued
   for the Agent Runbook + Experience Operator Manual once the
   operator drops the assets under public/downloads/.

3. ComposeQuickActionsStrip — Wallet button removed (operator
   flagged it as redundant with wallet access from elsewhere).
   Download button added next to Upload. Prop renamed
   onWalletOpen → onDownloadsOpen.

4. AigentMeWelcomeSplitTab — AgentWalletDrawer mount + walletOpen
   state dropped (no other trigger in this surface). DownloadsMenu
   wired with downloadsOpen state.

.gitignore — the bare `downloads/` rule (leftover Python install-
tooling exclusion) was swallowing the new app-facing paths. Added
explicit !public/downloads/** and !components/metame/downloads/**
overrides so the Python guard stays in place but the app surfaces
are tracked.
```

## Body

aigentMe's lower-right compose strip now exposes a Download icon
alongside the Upload icon. Tapping it opens a DownloadsMenu listing
assets the operator can share with an off-platform agent (ChatGPT,
Claude, etc.) so the agent can prepare content that uploads cleanly
back into aigentMe.

v1 deliverables:

1. public/downloads/ventureQube-schema.json — hand-authored JSON
   Schema Draft-07 spec mirroring services/iqube/ventureQubeSchema.ts
   (v0.4). Includes an `_agent_briefing` block with system overview,
   sovereignty principles, refresh cadence ("snapshot, re-upload
   anytime"), why-safer commentary vs sharing raw notes with an
   off-platform agent, and a dedicated experience-guide explainer
   since the guide is derived at runtime rather than declared
   literally in the schema. Embedded worked example covers operator
   / strategy / one venture with myCartridge block / all five plan
   horizons / KPI board.

2. components/metame/downloads/DownloadsMenu.tsx — modal popover
   surfaced from the new Download icon. Lists items with title,
   description, expand-to-purpose, and a download anchor that
   triggers the browser download dialog. Two placeholders queued
   for the Agent Runbook + Experience Operator Manual once the
   operator drops the assets under public/downloads/.

3. ComposeQuickActionsStrip — Wallet button removed (operator
   flagged it as redundant with wallet access from elsewhere).
   Download button added next to Upload. Prop renamed
   onWalletOpen → onDownloadsOpen.

4. AigentMeWelcomeSplitTab — AgentWalletDrawer mount + walletOpen
   state dropped (no other trigger in this surface). DownloadsMenu
   wired with downloadsOpen state.

.gitignore — the bare `downloads/` rule (leftover Python install-
tooling exclusion) was swallowing the new app-facing paths. Added
explicit !public/downloads/** and !components/metame/downloads/**
overrides so the Python guard stays in place but the app surfaces
are tracked.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.gitignore` |
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `components/metame/copilot/ComposeQuickActionsStrip.tsx` |
| Added | `components/metame/downloads/DownloadsMenu.tsx` |
| Added | `public/downloads/ventureQube-schema.json` |

## Stats

 5 files changed, 883 insertions(+), 18 deletions(-)
