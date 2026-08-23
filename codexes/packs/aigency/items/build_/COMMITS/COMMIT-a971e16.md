# Commit Brief: `a971e16` — update smoke test expected asset ids after Qriptopian cover re-upload

| Field | Value |
|-------|-------|
| SHA | [`a971e16`](https://github.com/iQube-Protocol/AigentZBeta/commit/a971e161fe689f0c721dd2e28595f969c550f613) |
| Author | Claude |
| Date | 2026-08-22T09:38:21Z |
| Branch | dev (direct push) |
| Type | `chore` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
update smoke test expected asset ids after Qriptopian cover re-upload

Essays 002, 003, 004 had their corrupt cover source images re-uploaded
through the fixed pipeline (isShareable fix + base64/image validation) and
correctly rebound to new asset ids. Updates the smoke script's drift-detection
constant so it stops warning on the expected rebind and instead protects the
new canonical ids going forward.

Live-verified: 0 failures across 001-005 via
npx tsx scripts/smoke-qriptopian-essay-covers.ts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

Essays 002, 003, 004 had their corrupt cover source images re-uploaded
through the fixed pipeline (isShareable fix + base64/image validation) and
correctly rebound to new asset ids. Updates the smoke script's drift-detection
constant so it stops warning on the expected rebind and instead protects the
new canonical ids going forward.

Live-verified: 0 failures across 001-005 via
npx tsx scripts/smoke-qriptopian-essay-covers.ts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `scripts/smoke-qriptopian-essay-covers.ts` |

## Stats

 1 file changed, 10 insertions(+), 5 deletions(-)
