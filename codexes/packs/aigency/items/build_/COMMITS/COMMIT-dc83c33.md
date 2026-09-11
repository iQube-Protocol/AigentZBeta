# Commit Brief: `dc83c33` — fix: resolve Research Lab scopes by registry membership, not column name

| Field | Value |
|-------|-------|
| SHA | [`dc83c33`](https://github.com/iQube-Protocol/AigentZBeta/commit/dc83c33d511c8b645057c8910c35875556c68b25) |
| Author | Claude |
| Date | 2026-08-26T14:07:52Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: resolve Research Lab scopes by registry membership, not column name

The research-lab invitation system stores both experiment IDs and Research Workspace
IDs in the legacy 'allowed_experiments' column. The buggy path was to blindly treat
all values as experiment IDs, causing workspace-scoped reviewers (e.g., 'ocsga-boundary-research')
to be treated as experiment IDs and default to EXP-001.

Resolution path now discriminates by registry membership:
- participationAccess.ts::getGrantedExperiments() checks each scope against both
  EXPERIMENT_REGISTRY and RESEARCH_WORKSPACES, separating experiments from workspaces
- Returns scopes: { experiments: Set<string>; workspaces: Set<string> } for callers
  that need the distinction (backwards-compatible union still provided)
- Fails closed (warns to console) on unknown scopes

- experiments/access/route.ts extracts allowedExperiments field (experiments only)
  for the Lab to filter by, falling back to full allowed union if separate list absent

- InvariantExperimentLab.tsx uses allowedExperiments (workspace-filtered) for filtering,
  preventing workspace IDs from appearing in the experiment selector

Fixes: workspace-scoped reviewers now see 'Research access required' or their actual
assigned workspace experiments; never incorrectly defaulting to EXP-001.
```

## Body

The research-lab invitation system stores both experiment IDs and Research Workspace
IDs in the legacy 'allowed_experiments' column. The buggy path was to blindly treat
all values as experiment IDs, causing workspace-scoped reviewers (e.g., 'ocsga-boundary-research')
to be treated as experiment IDs and default to EXP-001.

Resolution path now discriminates by registry membership:
- participationAccess.ts::getGrantedExperiments() checks each scope against both
  EXPERIMENT_REGISTRY and RESEARCH_WORKSPACES, separating experiments from workspaces
- Returns scopes: { experiments: Set<string>; workspaces: Set<string> } for callers
  that need the distinction (backwards-compatible union still provided)
- Fails closed (warns to console) on unknown scopes

- experiments/access/route.ts extracts allowedExperiments field (experiments only)
  for the Lab to filter by, falling back to full allowed union if separate list absent

- InvariantExperimentLab.tsx uses allowedExperiments (workspace-filtered) for filtering,
  preventing workspace IDs from appearing in the experiment selector

Fixes: workspace-scoped reviewers now see 'Research access required' or their actual
assigned workspace experiments; never incorrectly defaulting to EXP-001.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/experiments/access/route.ts` |
| Modified | `components/composer/InvariantExperimentLab.tsx` |
| Modified | `services/passport/participationAccess.ts` |

## Stats

 3 files changed, 50 insertions(+), 10 deletions(-)
