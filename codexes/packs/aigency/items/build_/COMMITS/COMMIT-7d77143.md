# Commit Brief: `7d77143` — Ignore vitest's coverage/ output directory

| Field | Value |
|-------|-------|
| SHA | [`7d77143`](https://github.com/iQube-Protocol/AigentZBeta/commit/7d77143225b577caca3bd91ed74852db0ca42124) |
| Author | Claude |
| Date | 2026-08-08T12:47:57Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Ignore vitest's coverage/ output directory

test:ci's --coverage flag previously errored before writing anything
(missing @vitest/coverage-v8, fixed in the previous commit); now that it
actually runs, it writes a coverage/ report directory that git doesn't yet
know to ignore.
```

## Body

test:ci's --coverage flag previously errored before writing anything
(missing @vitest/coverage-v8, fixed in the previous commit); now that it
actually runs, it writes a coverage/ report directory that git doesn't yet
know to ignore.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.gitignore` |

## Stats

 1 file changed, 1 insertion(+)
