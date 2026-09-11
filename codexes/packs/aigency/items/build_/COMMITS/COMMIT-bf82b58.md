# Commit Brief: `bf82b58` — Replace dev CI fix with a narrow dedicated workflow

| Field | Value |
|-------|-------|
| SHA | [`bf82b58`](https://github.com/iQube-Protocol/AigentZBeta/commit/bf82b58814be6f706ba7bfda5e24f5d60d834922) |
| Author | Claude |
| Date | 2026-08-08T12:18:48Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Replace dev CI fix with a narrow dedicated workflow

Adding dev to ci.yml's and lint.yml's branch triggers (previous commit)
turned on real CI for PRs into dev for the first time -- confirmed live on
PR #92 -- but it also turned on lint.yml's full job matrix, and two of its
jobs failed immediately for reasons with nothing to do with this PR:

- `security`: `npm audit --audit-level=moderate` fails on dev's current
  dependency tree regardless of any given PR (127-128 pre-existing
  vulnerabilities: ~5 critical, ~38 high, ~54 moderate, ~30 low).
- `lint (18.x/20.x)`: `next lint --max-warnings=0` fails on dev today
  across many unrelated files (app/(embed)/triad/embed/codex-closed/page.tsx,
  CodexUploadModal.tsx, mermaidSafe.ts, several others) -- and because each
  step in that job runs with continue-on-error: false, the lint failure
  stops the job before type-check or test:ci (the two steps actually named
  in the ask, "typecheck/tests/canaries") ever run.

Folding dev into lint.yml's branch list would have blocked every future PR
into dev on this pre-existing backlog, with no way for an unrelated PR to
fix it. That's not the smallest durable correction -- it's turning on an
unrelated pre-existing red build.

Reverted ci.yml/lint.yml to their original branch lists and added
dev-integration-checks.yml: a narrow workflow, scoped to pull_request/push
on dev only, running exactly npm run type-check + npm run test:ci -- no
eslint, no prettier, no npm audit, no bundle-size. That backlog is real and
worth fixing, but it's a separate concern from giving dev PRs the coverage
this task asked for.

No changes to the A4/CAP-1 correction from the previous commit.
```

## Body

Adding dev to ci.yml's and lint.yml's branch triggers (previous commit)
turned on real CI for PRs into dev for the first time -- confirmed live on
PR #92 -- but it also turned on lint.yml's full job matrix, and two of its
jobs failed immediately for reasons with nothing to do with this PR:

- `security`: `npm audit --audit-level=moderate` fails on dev's current
  dependency tree regardless of any given PR (127-128 pre-existing
  vulnerabilities: ~5 critical, ~38 high, ~54 moderate, ~30 low).
- `lint (18.x/20.x)`: `next lint --max-warnings=0` fails on dev today
  across many unrelated files (app/(embed)/triad/embed/codex-closed/page.tsx,
  CodexUploadModal.tsx, mermaidSafe.ts, several others) -- and because each
  step in that job runs with continue-on-error: false, the lint failure
  stops the job before type-check or test:ci (the two steps actually named
  in the ask, "typecheck/tests/canaries") ever run.

Folding dev into lint.yml's branch list would have blocked every future PR
into dev on this pre-existing backlog, with no way for an unrelated PR to
fix it. That's not the smallest durable correction -- it's turning on an
unrelated pre-existing red build.

Reverted ci.yml/lint.yml to their original branch lists and added
dev-integration-checks.yml: a narrow workflow, scoped to pull_request/push
on dev only, running exactly npm run type-check + npm run test:ci -- no
eslint, no prettier, no npm audit, no bundle-size. That backlog is real and
worth fixing, but it's a separate concern from giving dev PRs the coverage
this task asked for.

No changes to the A4/CAP-1 correction from the previous commit.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.github/workflows/ci.yml` |
| Added | `.github/workflows/dev-integration-checks.yml` |
| Modified | `.github/workflows/lint.yml` |

## Stats

 3 files changed, 53 insertions(+), 3 deletions(-)
