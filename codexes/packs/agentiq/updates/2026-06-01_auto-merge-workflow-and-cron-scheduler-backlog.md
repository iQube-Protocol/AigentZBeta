# Ops Backlog — Auto-Merge Workflow Repair + Anchor Cron Scheduler Wiring

**Date:** 2026-06-01
**Status:** Backlog. Filed per operator request after the anchor cron / K/T policy ship-out.

Two independent ops-infra items to pick up.

---

## 1. Auto-merge workflow is broken on `claude/**` → `dev`

### Symptom

Pushes to `claude/<session>` branches no longer trigger the `merge-claude-to-dev` GitHub Actions workflow that should auto-merge them into `dev`. Every Claude Code session in the recent weeks has needed the manual fallback:

```bash
git fetch origin dev
git merge origin/dev -m "merge dev: ..."
git push origin HEAD:dev
```

This is CLAUDE.md-documented friction and silently causes deployments to not fire when an operator pushes a session branch and walks away expecting auto-merge.

### What CLAUDE.md says

> The `merge-claude-to-dev.yml` workflow **must exist on the `main` branch** for GitHub Actions to recognise `claude/**` push triggers. If auto-deploy stops working, check `main` has this file. Branch `fix/add-merge-workflow` contains the fix — merge it to `main` to restore.

### Investigation checklist when picked up

1. Does `.github/workflows/merge-claude-to-dev.yml` exist on `main`?
   - `git ls-tree -r main -- .github/workflows/ | grep merge-claude`
2. If yes, does it have the right trigger (`on: push: branches: ['claude/**']`)?
3. Does the GitHub App / Actions installation have permission to push to `dev`?
4. Are there any recent failing workflow runs that explain the silent failure?
5. Is the branch protection on `dev` blocking the auto-merge bot?

### Fix path

Option A (per CLAUDE.md): merge `fix/add-merge-workflow` → `main`.

Option B (write from scratch): a workflow on `main` that on `push: branches: ['claude/**']` runs `gh pr create --base dev --head ${BRANCH}` followed by `gh pr merge --auto --merge`. Token: a PAT with `repo` scope OR the default `GITHUB_TOKEN` with `contents: write` permission.

### Acceptance criteria

- A new commit on any `claude/<session>` branch lands on `origin/dev` within ≤5 min without any manual `git push origin HEAD:dev`
- Failed auto-merges (e.g. conflicts) surface as a GitHub workflow failure email so the operator knows manual intervention is required

---

## 2. Wire the anchor cron scheduler (production cadence)

### Context

`POST /api/ops/sync/cron-tick` is live + tested. A one-shot curl confirms the full pipeline (cron-token → canister read → K/T decision → anchor_history insert). What remains is wiring an **external scheduler** that fires it every `cron_cadence_seconds`.

Without a scheduler the cron endpoint exists but never fires, so drift can re-accumulate at any time.

### Recommended path: Uptime Robot (or equivalent)

1. Sign up at uptimerobot.com (free tier sufficient for 5-min cadence; paid for 1-min)
2. Add monitor:
   - **Type:** HTTP(s)
   - **URL:** `https://dev-beta.aigentz.me/api/ops/sync/cron-tick`
   - **HTTP Method:** POST
   - **Interval:** 5 min (free) / 1 min (paid)
   - **Custom HTTP Headers:** `X-Cron-Token: <rotated-token>`
3. Wait one cycle; verify ticks appear in `anchor_history`

Equivalent options if Uptime Robot is unavailable: **Better Stack** (3-min free tier), **GitHub Actions cron** (`*/5 * * * *` minimum), **AWS EventBridge → Lambda** (true 1-min, ~$1/mo).

### Acceptance criteria

- `anchor_history` accumulates a tick row at the configured cadence ± 30s tolerance
- After 24h of running, `MAX(drift_before) FROM anchor_history WHERE created_at > now() - interval '24 hours'` stays bounded (< K × 5)
- Failed ticks (`cycle_action = 'failed'`) trigger an alert (Uptime Robot can alert on non-2xx; tighten later)

### Cadence-tuning loop

After 2 weeks of running with the proposed defaults (K=50, T=15min, cron=60s in calibration table; actual scheduler cadence at 5 min if on free Uptime Robot):

1. Review `anchor_history` — what was the average `drift_before`? max?
2. If `MAX(drift_before) > K × 3` sustained → either raise K, drop cron cadence, or raise tier to 1-min scheduler
3. If `drift_before` rarely exceeds 10 → consider raising K to 100 + extending T to 30 for cost reduction
4. Adjust via the Anchor Calibration card on `/ops`; no redeploy needed

See `codexes/packs/agentiq/items/AGENTIQ_NETWORK_COSTS.md` for the cost/SLA matrix.

---

## Out of scope (separate backlog candidates)

- Tiered cron cadence under high drift (auto-escalate 60s → 15s when `drift > K × 5` for N ticks)
- Per-invocation tx ceiling on `pos.batch_now()` (cap how many tx a single tick processes)
- Drift-trend chart on `/ops` (sparkline of drift_before over 24h)
- Cost telemetry (observed BTC fee + LZ gas per anchor, surfaced as a running cost meter)
- Multi-rail audit anchor (OpenTimestamps + second EVM chain) for durability redundancy

These are listed in section 8 of `AGENTIQ_NETWORK_COSTS.md`.

---

**End of backlog.**
