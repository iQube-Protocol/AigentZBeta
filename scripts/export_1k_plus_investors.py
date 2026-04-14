#!/usr/bin/env python3
"""
scripts/export_1k_plus_investors.py

Exports all investors with Total-Invested >= 1000, sorted by:
  1. Investment size descending (largest first)
  2. First committed date ascending (earliest first, tiebreaker)

Catches investors regardless of whether investment_amount_band is set.
Prints: #  First Name  Last Name  Amount  Date  Band  Cohort  State

Usage:
  python3 scripts/export_1k_plus_investors.py
  python3 scripts/export_1k_plus_investors.py --threshold 5000
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

THRESHOLD = float(sys.argv[sys.argv.index("--threshold") + 1]) if "--threshold" in sys.argv else 1000.0

HEADERS = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"}


def pg_get(path: str) -> list:
    req = urllib.request.Request(f"{SB_URL}/rest/v1{path}", headers=HEADERS, method="GET")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Supabase error {e.code}: {e.read().decode()[:400]}")


# Fetch all rows with Total-Invested >= threshold (paginated)
rows: list = []
offset = 0
COLS = "id,First-Name,Last-Name,Total-Invested,csv_first_committed_date,investment_amount_band,campaign_cohort,campaign_state,Email"
while True:
    # gte filter — cast as double precision
    path = (
        f"/nakamoto_knyt_personas"
        f'?select={urllib.parse.quote(COLS)}'
        f'&"Total-Invested"=gte.{THRESHOLD}'
        f"&offset={offset}&limit=500"
    )
    chunk = pg_get(path)
    rows.extend(chunk)
    if len(chunk) < 500:
        break
    offset += 500


# Sort: investment desc, date asc
def sort_key(r):
    inv = float(r.get("Total-Invested") or 0)
    date = r.get("csv_first_committed_date") or "9999"
    return (-inv, date)


rows.sort(key=sort_key)

print(f"\nInvestors with Total-Invested >= ${THRESHOLD:,.0f}   ({len(rows)} total)\n")
print(f"{'#':<4} {'First Name':<20} {'Last Name':<25} {'Invested':>10}  {'Date':<12}  {'Band':<12}  {'Cohort':<15}  State")
print("-" * 120)
for i, r in enumerate(rows, 1):
    fn = (r.get("First-Name") or "").strip()
    ln = (r.get("Last-Name") or "").strip()
    inv = float(r.get("Total-Invested") or 0)
    date = (r.get("csv_first_committed_date") or "")[:10]
    band = r.get("investment_amount_band") or "NULL"
    cohort = r.get("campaign_cohort") or ""
    state = r.get("campaign_state") or ""
    print(f"{i:<4} {fn:<20} {ln:<25} ${inv:>9,.0f}  {date:<12}  {band:<12}  {cohort:<15}  {state}")

print()

# Also check for Haft / Stiel specifically
print("── Name check ─────────────────────────────────────────────────────────")
for name in ["Haft", "Stiel"]:
    matches = [r for r in rows if name.lower() in (r.get("Last-Name") or "").lower()]
    if matches:
        for r in matches:
            print(f"  FOUND {name}: {r.get('First-Name')} {r.get('Last-Name')} — ${float(r.get('Total-Invested') or 0):,.0f} — cohort={r.get('campaign_cohort')}")
    else:
        print(f"  NOT IN RESULTS: {name}")

# If Haft missing, check if they exist in DB at all regardless of investment
print()
for name in ["Haft"]:
    path = f'/nakamoto_knyt_personas?select=id,"First-Name","Last-Name","Total-Invested",investment_amount_band,campaign_cohort,Email&"Last-Name"=ilike.*{name}*'
    found = pg_get(path)
    if found:
        print(f"DB search for '{name}': {found}")
    else:
        print(f"DB search for '{name}': NOT FOUND IN DATABASE AT ALL")
