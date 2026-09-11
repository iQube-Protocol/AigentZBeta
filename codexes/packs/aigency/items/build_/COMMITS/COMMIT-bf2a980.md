# Commit Brief: `bf2a980` — Remove RegisterCeremonyReplay surface from Register stage UI

| Field | Value |
|-------|-------|
| SHA | [`bf2a980`](https://github.com/iQube-Protocol/AigentZBeta/commit/bf2a98062739f84c696f29ce9da412161503bbb0) |
| Author | Claude |
| Date | 2026-08-11T02:38:35Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Remove RegisterCeremonyReplay surface from Register stage UI

Register returns to one canonical operational surface
(register-agent-panel) plus the standard Evidence drawer — no
duplicate "historical replay" block. Removed the surface-registry
entry, the Register-stage surfaces[] entry, and PilotJourneyTab's
import/component-map entry/prop-threading ternary arm; deleted the
now-orphaned component file.

Untouched by design: the registerCeremony projection and its generic
JourneyRunSurface thread-through stay in the state route (no other
consumer, but nothing requires removing it either); RegisterAgentPanel,
the mandate/wallet/signing flow, Activity Receipts, and DVN
receipts/finality are unaffected. tests/register-ceremony-replay.test.ts
trimmed to keep only the state-route projection and generic-threading
canaries; the component-source and surface-registration canaries had
nothing left to test.
```

## Body

Register returns to one canonical operational surface
(register-agent-panel) plus the standard Evidence drawer — no
duplicate "historical replay" block. Removed the surface-registry
entry, the Register-stage surfaces[] entry, and PilotJourneyTab's
import/component-map entry/prop-threading ternary arm; deleted the
now-orphaned component file.

Untouched by design: the registerCeremony projection and its generic
JourneyRunSurface thread-through stay in the state route (no other
consumer, but nothing requires removing it either); RegisterAgentPanel,
the mandate/wallet/signing flow, Activity Receipts, and DVN
receipts/finality are unaffected. tests/register-ceremony-replay.test.ts
trimmed to keep only the state-route projection and generic-threading
canaries; the component-source and surface-registration canaries had
nothing left to test.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/journey/moneypenny-horizen/state/route.ts` |
| Modified | `app/triad/components/codex/tabs/PilotJourneyTab.tsx` |
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Deleted | `components/journey/RegisterCeremonyReplay.tsx` |
| Modified | `services/journey/horizenMoneyPennyJourney.ts` |
| Modified | `services/journey/journeySurfaceRegistry.ts` |
| Modified | `tests/register-ceremony-replay.test.ts` |

## Stats

 7 files changed, 27 insertions(+), 302 deletions(-)
