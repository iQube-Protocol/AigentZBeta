# Dev merge conflict resolution path (2026-08-09)

## The incident

The `claude/constitutional-internet-book-rr40ea` session branch pushed real work — the
Constitutional Internet book's v0.4 manuscript, a Horizen Pulse authorization fix, a CI
agent-edition package, and the KNYTS Bridge campaign feature — across several pushes between
2026-08-08 and 2026-08-09. Every single one of those pushes triggered
`.github/workflows/merge-claude-to-dev.yml`, and every single one **failed silently**: `dev` had
independently evolved the exact Horizen Pulse authorization mechanism the branch's own fix
touched, the merge hit real content conflicts (`.amplify-deploy`, `services/horizen/
authorizationClient.ts`, `tests/horizen-authorization-client.test.ts`), and the workflow — which
had no conflict-resolution path at all — just exited 1 and stopped.

Nothing else happened. No issue, no notification, no durable trace beyond an Actions run log
nobody was watching. The branch's work never reached `dev`, and Amplify never built it. The
failure surfaced two days later only because a freshly-built page (`/bridge/knyts`) 404'd on the
live site — an incident report from the operator, not from the platform's own tooling.

## Root cause

`merge-claude-to-dev.yml`'s merge step was:

```bash
git merge --ff-only origin/${{ github.ref_name }} || \
  git merge origin/${{ github.ref_name }} -m "${SUBJECT} [merge ${{ github.ref_name }}]"
```

The `-m` fallback only helps when git can auto-merge without conflicts (it supplies the commit
message for a clean three-way merge). It does nothing when the merge produces actual conflict
markers — `git merge -m "..."` still exits 1 and leaves the merge unresolved. There was no branch
in the workflow logic that ever handled that case; it fell straight through to a failed job.

## The fix

Two changes to `merge-claude-to-dev.yml`:

1. **Auto-resolve the one conflict that is never real**: `.amplify-deploy` is a single-line
   deploy-trigger timestamp with no semantic content. Two branches touching it is mechanical
   noise, not a decision — if it is the *only* conflicting file, the workflow now regenerates it
   deterministically and continues the merge.

2. **Never guess on anything else — file it, don't fail silently**: if any other file conflicts,
   the workflow aborts the merge (leaving `dev` untouched — never a partial or wrong-side commit)
   and files (or updates, if one is already open for the branch) a GitHub issue titled `dev merge
   conflict: <branch>` naming the conflicting files and the exact manual fallback command sequence
   from CLAUDE.md's "Deployment" section. The job still exits 1, so Actions' own red-X signal is
   unchanged — the issue is additive, a durable trace instead of a log entry that requires someone
   to already be looking.

This was manually verified against three scenarios in a scratch git repo before landing: a real
conflict (correctly aborts + files an issue, `dev` unchanged), an `.amplify-deploy`-only conflict
(correctly auto-resolves, merges, pushes), and a clean fast-forward (unchanged from prior
behavior).

## What this does NOT do

It does not resolve real conflicts automatically. A real conflict — as this incident's own
resolution demonstrated (`dev`'s independently-evolved Horizen Pulse mechanism superseded the
branch's own fix; the correct resolution was to take `dev`'s version wholesale rather than splice
the two) — requires reading both sides and making a judgment call. No CI job should attempt that
silently; the whole point of this fix is that a conflict too complex to auto-resolve becomes
*visible*, not that it becomes automatically resolved by a guess.

## Where this is now documented

- `CLAUDE.md` § "The auto-merge workflow is the enforcement point" — extended with the conflict
  resolution path and the incident reference.
- `AGENTS.md` — mirrors the same section for non-Claude agents working this repo.
- `.github/workflows/merge-claude-to-dev.yml` — the implementation, with inline comments carrying
  the same reasoning.
