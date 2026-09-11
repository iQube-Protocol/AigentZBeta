# Commit Brief: `9f9f38e` — Add trust-override checkbox to invariant video runner

| Field | Value |
|-------|-------|
| SHA | [`9f9f38e`](https://github.com/iQube-Protocol/AigentZBeta/commit/9f9f38eee39463ecfc10d007c57d47b9ecbff4c1) |
| Author | Claude |
| Date | 2026-07-04T20:17:08Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add trust-override checkbox to invariant video runner

Selecting the community Sora skill (Badge C, composite 52) correctly
fails the 60 hydration gate and asks for trust_override=true — the
trust posture working as designed, but the runner had no way to grant
the waiver. Adds an explicit operator checkbox (off by default, framed
as a per-run waiver, never a stored preference) threaded through
SkillVideoPlayer's existing trust_override prop, included in the
remount key so toggling it resets the gate error and Retry runs with
the new value.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Selecting the community Sora skill (Badge C, composite 52) correctly
fails the 60 hydration gate and asks for trust_override=true — the
trust posture working as designed, but the runner had no way to grant
the waiver. Adds an explicit operator checkbox (off by default, framed
as a per-run waiver, never a stored preference) threaded through
SkillVideoPlayer's existing trust_override prop, included in the
remount key so toggling it resets the gate error and Retry runs with
the new value.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/composer/InvariantVideoExperimentRunner.tsx` |

## Stats

 1 file changed, 18 insertions(+), 1 deletion(-)
