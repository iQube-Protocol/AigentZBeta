#!/usr/bin/env python3
"""
scripts/export_zero_knyt_investors.py

Exports all investors in the zero_knyt cohort, sorted by:
  1. Investment size descending (largest first)
  2. First committed date ascending (earliest first, tiebreaker)

Prints: #  First Name  Last Name  Amount  Date  Band  State  Activated  Email

Usage:
  python3 scripts/export_zero_knyt_investors.py
  python3 scripts/export_zero_knyt_investors.py --all-cohorts   # ignore cohort filter
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

ALL_COHORTS = "--all-cohorts" in sys.argv

HEADERS = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"}

COLS = ",".join([
    "id", "First-Name", "Last-Name", "Email",
    "Total-Invested", "csv_first_committed_date",
    "investment_amount_band", "campaign_cohort", "campaign_state",
    "platform_activated_at", "OM-Tier-Status",
])


def pg_get(path: str) -> list:
    req = urllib.request.Request(f"{SB_URL}/rest/v1{path}", headers=HEADERS, method="GET")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Supabase error {e.code}: {e.read().decode()[:400]}")


# Fetch all zero_knyt cohort rows (paginated)
rows: list = []
offset = 0
while True:
    cohort_filter = "" if ALL_COHORTS else "&campaign_cohort=eq.zero_knyt"
    path = (
        f"/nakamoto_knyt_personas"
        f"?select={urllib.parse.quote(COLS)}"
        f"{cohort_filter}"
        f"&offset={offset}&limit=500"
    )
    chunk = pg_get(path)
    rows.extend(chunk)
    if len(chunk) < 500:
        break
    offset += 500


# Sort: investment desc, date asc
def sort_key(r):
    inv  = float(r.get("Total-Invested") or 0)
    date = r.get("csv_first_committed_date") or "9999"
    return (-inv, date)


rows.sort(key=sort_key)

label = "all cohorts" if ALL_COHORTS else "zero_knyt cohort"
print(f"\nZero KNYT investors — {label}  ({len(rows)} total)\n")

header = (
    f"{'#':<4} {'First Name':<20} {'Last Name':<22} {'Invested':>10}  "
    f"{'Date':<12}  {'Band':<12}  {'Tier':<8}  {'State':<10}  {'Act':>3}  Email"
)
print(header)
print("-" * 130)

activated = 0
for i, r in enumerate(rows, 1):
    fn    = (r.get("First-Name") or "").strip()
    ln    = (r.get("Last-Name")  or "").strip()
    inv   = float(r.get("Total-Invested") or 0)
    date  = (r.get("csv_first_committed_date") or "")[:10]
    band  = r.get("investment_amount_band") or "NULL"
    tier  = r.get("OM-Tier-Status") or ""
    state = r.get("campaign_state") or ""
    act   = "YES" if r.get("platform_activated_at") else "-"
    email = r.get("Email") or ""

    if r.get("platform_activated_at"):
        activated += 1

    print(
        f"{i:<4} {fn:<20} {ln:<22} ${inv:>9,.0f}  "
        f"{date:<12}  {band:<12}  {tier:<8}  {state:<10}  {act:<3}  {email}"
    )

print()
print(f"── Summary ────────────────────────────────────────────────────────────")
print(f"  Total:               {len(rows)}")
print(f"  Platform activated:  {activated}")
total_invested = sum(float(r.get("Total-Invested") or 0) for r in rows)
print(f"  Total invested:      ${total_invested:,.0f}")
avg = total_invested / len(rows) if rows else 0
print(f"  Average investment:  ${avg:,.0f}")

# Band breakdown
bands: dict[str, int] = {}
for r in rows:
    b = r.get("investment_amount_band") or "NULL"
    bands[b] = bands.get(b, 0) + 1
print(f"\n  By band:")
for b, count in sorted(bands.items()):
    print(f"    {b:<15} {count}")
