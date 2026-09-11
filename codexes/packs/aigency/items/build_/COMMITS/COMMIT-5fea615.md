# Commit Brief: `5fea615` — Move segment-recovery panel above the brief config in EXP-002 runner

| Field | Value |
|-------|-------|
| SHA | [`5fea615`](https://github.com/iQube-Protocol/AigentZBeta/commit/5fea6154100bf631ecf84431105f63c0a2ae25a5) |
| Author | Claude |
| Date | 2026-07-05T20:01:12Z |
| Branch | dev (direct push) |
| Type | `refactor` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Move segment-recovery panel above the brief config in EXP-002 runner

The panel never required a brief, but sitting at the page bottom —
below all the brief config and generated content — it read as if
generating a new brief (a new experiment) were the price of admission
to repair a previous run's failed stitch. It now renders first, before
the Generate Brief controls, so recovery is the first affordance on
the tab.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The panel never required a brief, but sitting at the page bottom —
below all the brief config and generated content — it read as if
generating a new brief (a new experiment) were the price of admission
to repair a previous run's failed stitch. It now renders first, before
the Generate Brief controls, so recovery is the first affordance on
the tab.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/composer/InvariantVideoExperimentRunner.tsx` |

## Stats

 1 file changed, 4 insertions(+), 2 deletions(-)
