# Commit Brief: `3fdab36` — Fix terminal-beat drop in narrative mapping (caught by Coherence Engine)

| Field | Value |
|-------|-------|
| SHA | [`3fdab36`](https://github.com/iQube-Protocol/AigentZBeta/commit/3fdab366b9604b092cfc879ff4523bd6781c8b27) |
| Author | Claude |
| Date | 2026-07-04T08:55:58Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix terminal-beat drop in narrative mapping (caught by Coherence Engine)

EXP-002's first production brief scored CCS 93.3 with the narrative
validator warning "arc does not open on the first beat and close on the
last" — a real defect, correctly caught by CFS-014 on its first live
use: the v1 proportional mapping floor(i*beatCount/N) silently dropped
the TERMINAL beat whenever beats exceeded segments, so a 5-beat arc over
4 segments rendered N-001..N-004 and the transformation never resolved.
Replaced with endpoint-anchored round(i*(B-1)/(N-1)): first and last
beats always anchor, interior beats compress first, order stays
monotonic; single-segment productions render the opening beat and let
the validator warn. CFS-012 §4 amended per its own evidence-driven
tuning rule with the full provenance; canary test updated to pin the
corrected mapping; EXP-002 README records the partial production run
(composition + coherence half validated live; final render blocked on
Venice video credits).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

EXP-002's first production brief scored CCS 93.3 with the narrative
validator warning "arc does not open on the first beat and close on the
last" — a real defect, correctly caught by CFS-014 on its first live
use: the v1 proportional mapping floor(i*beatCount/N) silently dropped
the TERMINAL beat whenever beats exceeded segments, so a 5-beat arc over
4 segments rendered N-001..N-004 and the transformation never resolved.
Replaced with endpoint-anchored round(i*(B-1)/(N-1)): first and last
beats always anchor, interior beats compress first, order stays
monotonic; single-segment productions render the opening beat and let
the validator warn. CFS-012 §4 amended per its own evidence-driven
tuning rule with the full provenance; canary test updated to pin the
corrected mapping; EXP-002 README records the partial production run
(composition + coherence half validated live; final render blocked on
Venice video credits).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/foundation/CFS-012_narrative-invariant-specification.md` |
| Modified | `codexes/packs/agentiq/foundation/experiments/exp-002-invariant-video/README.md` |
| Modified | `services/video/invariantVideoBrief.ts` |
| Modified | `tests/video-invariant-brief.test.ts` |

## Stats

 4 files changed, 73 insertions(+), 9 deletions(-)
