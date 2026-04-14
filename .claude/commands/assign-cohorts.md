# assign-cohorts

Auto-assigns `campaign_cohort` on `nakamoto_knyt_personas` based on
`investment_amount_band` and `crm_personas` presence. No manual tagging needed.

## Cohort logic

| Cohort | Condition |
|---|---|
| `top_shelf` | `investment_amount_band` in (`2000-4999`, `5000+`) |
| `zero_knyt` | `investment_amount_band` = `1000-1999` |
| `reactivation` | band in (`500-999`, `100-499`) AND has crm_personas row AND not backed |
| `general` | everyone else with a valid email |

Terminal states (`backed`, `opted_out`) are never overwritten.

## Prerequisites

Run `investor_json_import.py --apply --apply-bands` first to populate
`investment_amount_band` from the consolidated JSON.

## Usage

```bash
# Preview — no writes
python3 scripts/assign_cohorts.py --dry-run

# Apply assignments (skips already-tagged rows)
python3 scripts/assign_cohorts.py --apply

# Re-tag everyone (overwrite existing cohort values)
python3 scripts/assign_cohorts.py --apply --overwrite
```

## Steps to execute

1. Run JSON enrichment first (populates investment_amount_band)
2. Dry-run to preview cohort counts
3. Apply if the numbers look right
4. Re-run smoke test to verify investor counts by cohort

## Related files

- `scripts/assign_cohorts.py` — the script
- `scripts/skills/assign-cohorts.skill.json` — SkillQube manifest
- `scripts/investor_json_import.py` — prerequisite enrichment script
