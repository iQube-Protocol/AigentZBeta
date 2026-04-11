# KNYT Campaign — Revision Log

This directory holds **revision snapshots** of the KNYT Campaign bundle.
The genesis set lives in `codexes/packs/knyt/items/` and is the canonical
starting point. Revisions are additive — they never overwrite or replace
the genesis set.

## Purpose

> **Admin gating controls working access.
> AutoDrive secures canonical survivability.
> The revisions directory preserves the evolution.**

The `items/` directory holds the live working bundle surfaced in the
admin-gated **KNYT Campaign** tab. As the campaign evolves (new learning,
copy tweaks, dashboard refinements), **do not silently overwrite the
genesis docs**. Instead, drop a revision snapshot here.

## Naming convention

```
revisions/campaign/YYYY-MM-DD-<short-slug>.md
```

Examples:

- `2026-04-15-copy-pack-refresh.md`
- `2026-04-22-dashboard-spec-v2.md`
- `2026-05-01-launch-day-runbook-post-mortem.md`

## What to include in a revision snapshot

- **Scope** — which doc(s) in the genesis set this revision amends or supersedes
- **Change summary** — what was learned, what changed, why
- **Delta** — either a full revised doc body or a focused diff section
- **Applied by** — operator name / agent ID / PR link
- **Date** — ISO date (matches filename prefix)

## AutoDrive persistence

When the `sync-knyt-codex-to-autodrive.yml` workflow runs, revision files
are uploaded and encrypted alongside the genesis set. The manifest CID in
`codexes/packs/knyt/index.json` covers the whole pack — genesis + revisions.

Genesis bundle name: `knyt_campaign_genesis_set`
Upload prefix: `KnytCodex/repos/AigentZBeta`

## What this directory is NOT

- ❌ NOT a place to edit the genesis docs in-place
- ❌ NOT a branch — revisions stack additively, the genesis set is permanent
- ❌ NOT a drafts folder — drafts go elsewhere; revisions are committed decisions
