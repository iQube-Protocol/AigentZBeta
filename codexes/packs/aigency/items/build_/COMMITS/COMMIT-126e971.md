# Commit Brief: `126e971` — Revert fixed-width journey connectors to equal flex-grow

| Field | Value |
|-------|-------|
| SHA | [`126e971`](https://github.com/iQube-Protocol/AigentZBeta/commit/126e9719e1ef76fcc01895ba5fc19a7b3cb94591) |
| Author | Claude |
| Date | 2026-08-09T06:24:58Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Revert fixed-width journey connectors to equal flex-grow

The previous spacing fix made every inter-stage connector a fixed
16px, which did make them equal but collapsed the whole journey strip
to its min-content width - the stages bunched into the left portion
of the surface with large unused width on the right. Uniform spacing
meant uniform distribution across the available width, not a uniform
pixel gap.

All six connectors (Register through Operate->fork) now share one
flex-1 min-w-[40px] class, so they equally absorb the strip's leftover
width instead of collapsing to a fixed size. The Operate->fork
connector moved out of the fork's fixed-size box into the same
flex-flow position as the ordinary connectors; the box now begins
right at the junction (154px, was 170px). Stage nodes stay shrink-0;
only connectors grow. Strip is explicitly w-full.
```

## Body

The previous spacing fix made every inter-stage connector a fixed
16px, which did make them equal but collapsed the whole journey strip
to its min-content width - the stages bunched into the left portion
of the surface with large unused width on the right. Uniform spacing
meant uniform distribution across the available width, not a uniform
pixel gap.

All six connectors (Register through Operate->fork) now share one
flex-1 min-w-[40px] class, so they equally absorb the strip's leftover
width instead of collapsing to a fixed size. The Operate->fork
connector moved out of the fork's fixed-size box into the same
flex-flow position as the ordinary connectors; the box now begins
right at the junction (154px, was 170px). Stage nodes stay shrink-0;
only connectors grow. Strip is explicitly w-full.

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/journey/JourneyRunSurface.tsx` |
| Modified | `tests/journey-orient-stage.test.ts` |

## Stats

 2 files changed, 117 insertions(+), 32 deletions(-)
