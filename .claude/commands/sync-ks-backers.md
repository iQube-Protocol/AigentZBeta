# /sync-ks-backers — Sync Kickstarter Backers

Syncs a Kickstarter backer export CSV into `nakamoto_knyt_personas`.

**What it does:**
- Matches backers by email to existing investor rows
- Sets `kickstarter_backed_at` on matched rows (if not already set)
- Advances `campaign_state` to `'backed'` (terminal — never downgrades)
- Inserts new prospect rows (tagged `ks_backer`) for emails not already in the DB

**Prerequisites:**
- Place the Kickstarter backer export CSV at `data/ks_backers.csv`
- CSV must have columns: `Email`, `Backer Name`, `Pledge Amount`, `Pledged At`, `Reward Title`, `Status`
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (loaded from `.env.local`)

**Run:**

```bash
# Step 1 — pull latest code
git pull origin claude/verify-repo-environment-9t2cX

# Step 2 — dry run (preview changes, no writes)
python3 scripts/ks_backer_sync.py --csv data/ks_backers.csv

# Step 3 — apply (write to Supabase)
python3 scripts/ks_backer_sync.py --csv data/ks_backers.csv --apply

# Optional — only sync rows with Status = 'collected'
python3 scripts/ks_backer_sync.py --csv data/ks_backers.csv --apply --status collected
```

**Output fields updated:**
- `kickstarter_backed_at` — timestamp of pledge
- `campaign_state` → `'backed'` (terminal)
- New rows: `campaign_cohort` = `'ks_backer'`, `campaign_state` = `'backed'`
