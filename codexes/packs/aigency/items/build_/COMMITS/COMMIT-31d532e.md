# Commit Brief: `31d532e` — Homecoming Phase II Gate 0: fix Kickstarter CTA navigation + CI copy

| Field | Value |
|-------|-------|
| SHA | [`31d532e`](https://github.com/iQube-Protocol/AigentZBeta/commit/31d532e40620f40a267139b483be68f779e65541) |
| Author | Claude |
| Date | 2026-08-16T20:06:07Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Homecoming Phase II Gate 0: fix Kickstarter CTA navigation + CI copy

0A: KickstarterFollowCard previously awaited a telemetry POST before
calling window.open(), which most browsers popup-block (no longer
synchronously tied to the click) and which stranded the visitor
entirely if the POST failed. Now resolves the Kickstarter URL
synchronously client-side via the existing
getKnytsBridgeKickstarterUrl(), navigates unconditionally to a new
left-pane iframe view with an always-visible new-tab fallback, and
fires the kickstarter_preview_clicked telemetry fire-and-forget
(void fetch().catch()) so it never gates or blocks navigation.
Reward copy now states the confirmed-follow amount truthfully
("Earn 0.25 Knightcoin (0.25 DVN KNYT) when your follow is
confirmed.") without implying the click itself earned it.

0B: Constitutional Internet Bridge CHOOSE destination label corrected
to "Explore the Mythos of the Polity" (copy only, no behavior change).

Per codexes/packs/agentiq/updates/2026-08-16_homecoming-phase-ii-activation-pack.md
Gate 0. 8 new targeted tests added; 41 pre-existing KNYTS campaign
tests and scoped typecheck confirmed unaffected.
```

## Body

0A: KickstarterFollowCard previously awaited a telemetry POST before
calling window.open(), which most browsers popup-block (no longer
synchronously tied to the click) and which stranded the visitor
entirely if the POST failed. Now resolves the Kickstarter URL
synchronously client-side via the existing
getKnytsBridgeKickstarterUrl(), navigates unconditionally to a new
left-pane iframe view with an always-visible new-tab fallback, and
fires the kickstarter_preview_clicked telemetry fire-and-forget
(void fetch().catch()) so it never gates or blocks navigation.
Reward copy now states the confirmed-follow amount truthfully
("Earn 0.25 Knightcoin (0.25 DVN KNYT) when your follow is
confirmed.") without implying the click itself earned it.

0B: Constitutional Internet Bridge CHOOSE destination label corrected
to "Explore the Mythos of the Polity" (copy only, no behavior change).

Per codexes/packs/agentiq/updates/2026-08-16_homecoming-phase-ii-activation-pack.md
Gate 0. 8 new targeted tests added; 41 pre-existing KNYTS campaign
tests and scoped typecheck confirmed unaffected.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/journey/ConstitutionalInternetBridgeChooseSurface.tsx` |
| Modified | `components/journey/KnytsBridgeChooseSurface.tsx` |
| Added | `tests/homecoming-phase-ii-gate0.test.ts` |

## Stats

 3 files changed, 160 insertions(+), 45 deletions(-)
