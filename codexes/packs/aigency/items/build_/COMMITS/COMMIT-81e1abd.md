# Commit Brief: `81e1abd` — fix Invariant Registry: register polity namespace + raise public cap so all 319 invariants surface

| Field | Value |
|-------|-------|
| SHA | [`81e1abd`](https://github.com/iQube-Protocol/AigentZBeta/commit/81e1abd635d7f72561823d21200bc62fa83cfcaf) |
| Author | Claude |
| Date | 2026-07-18T00:45:49Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix Invariant Registry: register polity namespace + raise public cap so all 319 invariants surface

The 136 operator-ratified polity invariants (+ genesis) were live in the DB but
invisible in the Invariant Registry due to three drift bugs, one level up from
the DB CHECK constraint fixed earlier:
- types/invariants.ts: add 'polity' to InvariantNamespace union, INVARIANT_NAMESPACES,
  and COMPOSITION_LAWS (distributive, as the constitutional family) — the exhaustive
  Record + the public route's namespace validation both need it.
- invariantViewShared.ts: the UI NAMESPACES list was still the original 7 (so chips
  summed to ~74, omitting sovereignty/cybernetics/interaction/epistemology/
  representation/polity) — added all six with colour/fill/hex ramps.
- public/irl/invariants route: raise PUBLIC_LIMIT_CAP 250 -> 500 (substrate is 319;
  250 + Standing-desc sort silently truncated the zero-Standing new canon).
- Registry header now states the chips are per-namespace totals (not standing-filtered)
  and that newly-canonized invariants begin at Standing 0 / Reach 0 until validated.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The 136 operator-ratified polity invariants (+ genesis) were live in the DB but
invisible in the Invariant Registry due to three drift bugs, one level up from
the DB CHECK constraint fixed earlier:
- types/invariants.ts: add 'polity' to InvariantNamespace union, INVARIANT_NAMESPACES,
  and COMPOSITION_LAWS (distributive, as the constitutional family) — the exhaustive
  Record + the public route's namespace validation both need it.
- invariantViewShared.ts: the UI NAMESPACES list was still the original 7 (so chips
  summed to ~74, omitting sovereignty/cybernetics/interaction/epistemology/
  representation/polity) — added all six with colour/fill/hex ramps.
- public/irl/invariants route: raise PUBLIC_LIMIT_CAP 250 -> 500 (substrate is 319;
  250 + Standing-desc sort silently truncated the zero-Standing new canon).
- Registry header now states the chips are per-namespace totals (not standing-filtered)
  and that newly-canonized invariants begin at Standing 0 / Reach 0 until validated.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/public/irl/invariants/route.ts` |
| Modified | `app/triad/components/codex/tabs/InvariantRegistryTab.tsx` |
| Modified | `app/triad/components/codex/tabs/invariantViewShared.ts` |
| Modified | `types/invariants.ts` |

## Stats

 4 files changed, 48 insertions(+), 4 deletions(-)
