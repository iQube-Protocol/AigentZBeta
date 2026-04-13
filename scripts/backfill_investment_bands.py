#!/usr/bin/env python3
"""
scripts/backfill_investment_bands.py

Backfills investment_amount_band for any row where Total-Invested is set
but investment_amount_band is NULL.

Bands:
  <100       → '<100'        (not currently a CRM band, skipped unless --include-small)
  100-499    → '100-499'
  500-999    → '500-999'
  1000-1999  → '1000-1999'
  2000-4999  → '2000-4999'
  5000+      → '5000+'

Also backfills campaign_cohort if NULL:
  5000+      → 'top_shelf'
  2000-4999  → 'reactivation'
  1000-1999  → 'zero_knyt'
  500-999    → 'reactivation'
  100-499    → 'reactivation'

Accounts where First-Name or Last-Name contains 'Knyt' are skipped
(likely test/system accounts).

Usage:
  python3 scripts/backfill_investment_bands.py           # dry run
  python3 scripts/backfill_investment_bands.py --apply   # write to Supabase
"""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def load_dotenv(path: str = ".env.local") -> None:
    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_dotenv()

SB_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SB_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not SB_URL or not SB_KEY:
    raise SystemExit("ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")

APPLY = "--apply" in sys.argv

HEADERS = {
    "apikey": SB_KEY,
    "Authorization": f"Bearer {SB_KEY}",
    "Content-Type": "application/json",
}


def pg_get(path: str) -> list:
    req = urllib.request.Request(f"{SB_URL}/rest/v1{path}", headers=HEADERS, method="GET")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Supabase GET error {e.code}: {e.read().decode()[:400]}")


def pg_patch(path: str, payload: dict) -> None:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1{path}",
        data=data,
        headers={**HEADERS, "Prefer": "return=minimal"},
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req) as r:
            r.read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Supabase PATCH error {e.code}: {e.read().decode()[:400]}")


def compute_band(amount: float) -> str:
    if amount >= 5000:
        return "5000+"
    if amount >= 2000:
        return "2000-4999"
    if amount >= 1000:
        return "1000-1999"
    if amount >= 500:
        return "500-999"
    if amount >= 100:
        return "100-499"
    return "<100"


BAND_TO_COHORT: dict[str, str] = {
    "5000+":     "top_shelf",
    "2000-4999": "reactivation",
    "1000-1999": "zero_knyt",
    "500-999":   "reactivation",
    "100-499":   "reactivation",
    "<100":      "reactivation",
}

COLS = 'id,"First-Name","Last-Name","Total-Invested",investment_amount_band,campaign_cohort'

# Fetch rows with NULL band but non-null Total-Invested
rows: list = []
offset = 0
while True:
    path = (
        f'/nakamoto_knyt_personas'
        f'?select={urllib.parse.quote(COLS)}'
        f'&investment_amount_band=is.null'
        f'&"Total-Invested"=not.is.null'
        f'&offset={offset}&limit=500'
    )
    chunk = pg_get(path)
    rows.extend(chunk)
    if len(chunk) < 500:
        break
    offset += 500

print(f"\nRows with NULL band but Total-Invested set: {len(rows)}")

updated = 0
skipped = 0

print(f"\n{'ID':<40} {'Name':<35} {'Amount':>10}  {'New Band':<12}  {'New Cohort':<15}  {'Action'}")
print("-" * 125)

for r in rows:
    fn = (r.get("First-Name") or "").strip()
    ln = (r.get("Last-Name") or "").strip()
    full = f"{fn} {ln}".strip()

    # Skip test/system accounts
    if "knyt" in fn.lower() or "knyt" in ln.lower():
        print(f"  {r['id'][:8]}…  {full:<35}  SKIP (test account)")
        skipped += 1
        continue

    amount = float(r.get("Total-Invested") or 0)
    if amount <= 0:
        print(f"  {r['id'][:8]}…  {full:<35}  SKIP (no valid amount)")
        skipped += 1
        continue

    new_band = compute_band(amount)
    new_cohort = BAND_TO_COHORT[new_band]

    # Only set cohort if it's NULL
    update: dict = {"investment_amount_band": new_band}
    if not r.get("campaign_cohort"):
        update["campaign_cohort"] = new_cohort

    action = "APPLY" if APPLY else "DRY RUN"
    print(
        f"  {r['id'][:8]}…  {full:<35}  ${amount:>9,.0f}  {new_band:<12}  {new_cohort:<15}  {action}"
    )

    if APPLY:
        pg_patch(
            f'/nakamoto_knyt_personas?id=eq.{urllib.parse.quote(r["id"])}',
            update,
        )

    updated += 1

print(f"\nSummary: {updated} to update, {skipped} skipped")
if not APPLY:
    print("\nRun with --apply to write changes to Supabase.")
else:
    print(f"\n{updated} rows updated.")
