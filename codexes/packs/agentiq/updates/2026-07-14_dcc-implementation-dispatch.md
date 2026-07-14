# DCC Implementation Dispatch — the platform drives implementation (copy-paste break closed)

**Date:** 2026-07-14 · **Harness:** Claude Code · **Constitutional frame:** CFS-016 D1 (execution stays human) — preserved at the PR-merge gate

## The operator's report

> "still stuck on implementation pack in AigentZ — there is actually no button or clear
> affordance that progresses this to implement — just copy pack. What seems to be missing here
> is the next phase of actually prompting the implementation to happen in Claude rather than
> having the operator copy and paste this into Claude — that's where the break is and should now
> be at the stage where we can now drive implementation, build and deployment within the platform."

Confirmed by inspection: `ImplementationLayout` ended at **Copy pack** + a D1 deployment
proposal that presumes the pack was already run elsewhere. The operator was the transport
between the platform and Claude.

## Capability Evidence

- EXISTING · server-side `GITHUB_TOKEN` (env-allowlisted; `_lib/github.ts` read viewport +
  the aigentiq write-doc route already COMMITS via the contents API) — the platform can
  drive the GitHub API today. [use_directly]
- EXISTING · `merge-claude-to-dev.yml` auto-merges every `claude/**` push into `dev` (the
  deploy branch). **Constitutional hazard**: a CI implementation branch named `claude/*`
  would auto-deploy — collapsing the D1 human gate. [boundary — drove the branch-name design]
- EXISTING · receipt taxonomy + the permitted unilateral change (add an action type).
- EXISTING · `GitHubLayout` (DCC capsule) already lists open PRs — the natural watch surface
  for the resulting PR. [no new UI needed there]
- MISSING · any mechanism that hands the pack to Claude; any workflow that runs Claude in CI.

## Constitutional Decision (mechanism: `code` + `automation`)

Dispatch the pack to **Claude Code running in GitHub Actions** via `repository_dispatch`:

1. **`.github/workflows/claude-implement.yml`** — receives `claude-implement` dispatches;
   checks out `dev`; **refuses any working branch not matching `aigentz/pack-*`** (defense
   against forged payloads AND the claude/** auto-merge hazard); materializes the pack via
   `toJSON()` → file (injection-safe — payload text never interpolated into shell/prompt);
   runs `anthropics/claude-code-action@v1` with a static prompt: read CLAUDE.md first, respect
   protected files (blocked steps go in the PR body under "Requires operator approval"),
   implement on the current branch, validate honestly, push, `gh pr create --base dev`,
   **never push to dev/main, never merge**.
2. **`POST /api/dev-command-center/implement`** — admin-gated (spine); mints the branch
   deterministically (`dispatchBranchFor`: `aigentz/pack-<slug>-<sha8>`); fires the dispatch
   (204 = accepted); refuses packs over the 55k-char payload ceiling (honest 413, never a
   silent truncation — a truncated pack would have Claude implement half a plan); writes a
   best-effort **`implementation_dispatched`** receipt (new action type, DVN-anchorable per
   the permitted-addition rule) — the initiation record in the development provenance chain
   **pack → dispatch → PR → human merge**.
3. **`ImplementationLayout`** — new primary affordance after pack generation:
   **"Dispatch to Claude"** (emerald box) → dispatch note with branch + receipt + watch
   pointer; the D1 propose box now suggests the dispatched branch for the commit range.
   Dispatch uses single-shot `personaFetch`, NOT `experimentStep` — its automatic retry
   could fire two CI runs on the same branch after an ambiguous failure.

Alternatives rejected: *in-Lambda agentic implementation* (no repo checkout, no git, forks
Claude Code poorly); *GitHub issue + @claude mention* (no claude app workflow in the repo;
dispatch is direct and payload-carrying); *keep copy-paste* (the named break).

### D1 statement (honest)

This increment moves **initiation** of implementation into the platform — the operator's
click is the human authorization, and the receipt records it. **Execution stays human where
D1 put it**: nothing reaches `dev` (deploy) without the operator merging the PR. The CI
branch namespace (`aigentz/pack-*`, enforced by both the route and the workflow) exists
precisely to keep the auto-merge lane closed.

## Validation

- esbuild parse gates 4/4 (route, receipt service, DVN pipeline anchor set, ImplementationLayout).
- Workflow YAML parses clean.
- Stub-bundle drill on `dispatchBranchFor` 7/7: always `aigentz/pack-*`, sanitized,
  deterministic, distinct per pack, degenerate/long ids bounded, **never `claude/**`**.
- DVN pipeline change is exactly the permitted one (an entry in `ANCHORABLE_ACTION_TYPES` +
  the matching union member) — no state-machine/payload/hashing/finalizer change.

## Operator setup (one-time, before first dispatch)

1. **Repo secret** — GitHub → `iQube-Protocol/AigentZBeta` → Settings → Secrets and variables
   → Actions → New repository secret: name `ANTHROPIC_API_KEY`, value = an Anthropic API key.
2. **Workflow on the default branch** — `repository_dispatch` only triggers workflows that
   exist on `main` (same gotcha as `merge-claude-to-dev.yml`). After this session's branch
   auto-merges to dev, get the file onto main:

   ```bash
   git fetch origin dev main && git checkout main && git pull origin main && \
   git checkout origin/dev -- .github/workflows/claude-implement.yml && \
   git commit -m "add claude-implement dispatch workflow (DCC implementation dispatch)" && \
   git push origin main && git checkout dev
   ```

3. **Token scope** — the Amplify `GITHUB_TOKEN` must be able to POST
   `/repos/.../dispatches` (classic PAT `repo` scope covers it; the route returns an honest
   502 with the probable cause if not).

## Addendum (same day) — in-app PR merge: the human gate moves into the platform

Operator: *"Can I merge the PR from within the GitHub viewport or otherwise within the app
as opposed to having to go to github?"* — yes, built:

- **`POST /api/dev-command-center/github/merge`** — admin-gated; reads the PR first and
  refuses anything not open or not targeting `dev` (the deploy lane this surface owns —
  other bases stay a github.com act); merges via GitHub's merge API with a **descriptive
  merge-commit title** (`Merge PR #N: <title> (<headRef>)` — the CLAUDE.md rule); GitHub's
  branch protection + required checks still enforce server-side (405/409 surface honestly);
  receipted as **`deployment_authorized`** — merging to dev IS authorizing the deploy
  (Amplify builds dev on merge).
- **`GitHubLayout`** — PR rows now show `head → base` and, for dev-base PRs, a
  **confirm-then-merge** button (first click arms, second executes — a deploy-triggering act
  never fires on one click). Result line shows merge sha + receipt. Header eyebrow updated
  from "read-only" to "read + merge gate"; `_lib/github.ts` stays read-only (the write is
  route-inlined, documented in both headers). `ghOpenPulls` projection gains `baseRef`.

**D1 statement:** the human execution gate is preserved — it moved *surfaces* (github.com →
the platform), not *authority* (still the operator's deliberate, confirmed click, now
receipted). The full loop is now in-platform: intent → pack → dispatch → Claude implements
in CI → PR → operator merges in the GitHub capsule → Amplify deploys.

Validation: 4/4 esbuild parse gates (merge route, lib, GitHubLayout, read route). First live
merge is the real drill — GitHub's own API enforces mergeability, so the failure modes
(checks pending, conflicts, protection) surface as honest error notes on the PR row.

## Addendum 2 (same day) — merge validation gate + receipted admin override

Operator-ratified after the first live PR (#89): *"we want validated code deployed… We should
include an admin gated override that enables builds to be deployed even if they fail the
validation for some reason — with a warning and dvn receipt of a validation check override."*

**The missing receipt half, found and closed:** nothing in the DCC ever wrote the
`constitutional_validation_recorded` receipt — the validation report lived only in dev-loop
session state, so no server-checkable record of validation existed. Now
`handleApproveProposal` (DevCommandCenterTab) fires the record on `validation_report`
approval: verdict + satisfied/unresolved/unintended counts + **packId** (from the session's
generated pack). The validation-record route accepts `packId` and tags the summary
`pack=<id>` for correlation.

**The gate (merge route):** a PR whose head matches `aigentz/pack-<slug>-<sha8>` merges only
when the merging admin's own receipts contain `constitutional_validation_recorded` with
`verdict=pass` and a `pack=` tag whose slug matches the branch's (same sanitization as
`dispatchBranchFor` — round-trip pinned in the drill). Blocked → 409 with instructions.
Non-pack PRs stay ungated (their validation story predates the DCC loop). Verdicts `partial`
and `fail` do NOT open the gate.

**The override (never silent):** `{ overrideValidation: true, overrideReason (≥10 chars) }`
merges anyway; the act is receipted as **`validation_override_granted`** (new action type,
DVN-anchorable per the permitted-addition rule) naming the PR, branch, merge sha, and the
stated reason; the response and the PR row carry the ⚠ unvalidated-deploy warning; the
`deployment_authorized` receipt records `Validation gate: overridden`. The GitHub capsule
arms a reason-required override form on the blocked PR row.

Validation: 6/6 parse gates; 12/12 gate drill (slug round-trip against PR #89's real packId,
pass/partial/fail verdicts, wrong-pack and untagged records blocked, non-pack branches
ungated, mixed-case id sanitization parity). Honest limits: the gate correlates via the
receipt summary's `pack=` tag (a structured receipt payload field is the cleaner long-term
home); receipts are scanned persona-scoped (the merging admin's own validations — a
second admin's validation doesn't open the first's gate; acceptable single-operator, noted
for multi-admin); validations recorded before this ships carry no `pack=` tag and won't
open the gate (re-approve the validation report or override once).

## Honest limits

- **First live dispatch is the real validation.** The workflow cannot run from this sandbox;
  `anthropics/claude-code-action@v1` input names (`anthropic_api_key`, `prompt`,
  `claude_args`) follow the action's published v1 interface but must be confirmed by the
  first Actions run — if it fails, the run log will name the input mismatch and the fix is
  a one-line workflow edit.
- **No in-card run status yet.** The card confirms the dispatch (branch + receipt); watching
  the run/PR happens in the GitHub capsule (which already lists open PRs) or GitHub itself.
  A status-poll seam (`GET /runs?event=repository_dispatch`) is a clean follow-on.
- **The pack payload ceiling is 55k chars.** Oversized packs are refused honestly; committing
  the pack to a file and dispatching a ref is the follow-on if packs outgrow this.
- **`build` in "drive implementation, build and deployment"**: CI builds whatever the PR
  branch needs via the repo's existing `ci.yml` on the PR; Amplify builds on merge. There is
  no separate platform-driven build step — the PR is the build surface.
- CFS-016 amendment candidacy: "implementation dispatch" (D1.5 — platform-initiated,
  human-merged) should be recorded in the CFS-016 lifecycle at next revision.
