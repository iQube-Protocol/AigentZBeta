# Commit Brief: `2a84318` — Harden EXP-001 harness JSON parsing against OSS-judge output

| Field | Value |
|-------|-------|
| SHA | [`2a84318`](https://github.com/iQube-Protocol/AigentZBeta/commit/2a8431886d01bb43f57418cf5e2d044b4beb3a13) |
| Author | Claude |
| Date | 2026-07-04T07:51:02Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Harden EXP-001 harness JSON parsing against OSS-judge output

Run 1 with venice/llama-3.3-70b failed on the first answer pass with
malformed JSON. Fix: strict output rules in the answer instruction
(quoted citation strings, one-line answers), a string-aware repairJson
pass (escapes literal newlines/tabs inside strings, quotes bare C-NNN
tokens and strips trailing commas in structural runs ONLY — prose
markers like [C-011] inside answers stay intact), and a one-retry-with-
stricter-reminder wrapper on every answer and judge call. Repair path
unit-tested against the four observed failure shapes.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Run 1 with venice/llama-3.3-70b failed on the first answer pass with
malformed JSON. Fix: strict output rules in the answer instruction
(quoted citation strings, one-line answers), a string-aware repairJson
pass (escapes literal newlines/tabs inside strings, quotes bare C-NNN
tokens and strips trailing commas in structural runs ONLY — prose
markers like [C-011] inside answers stay intact), and a one-retry-with-
stricter-reminder wrapper on every answer and judge call. Repair path
unit-tested against the four observed failure shapes.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `scripts/evaluate-exp001.mjs` |

## Stats

 1 file changed, 81 insertions(+), 9 deletions(-)
