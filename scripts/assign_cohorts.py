#!/usr/bin/env python3
"""
scripts/assign_cohorts.py

Auto-assigns campaign_cohort on nakamoto_knyt_personas based on
investment_amount_band + crm_personas presence.

Cohort logic (operator-confirmed):
  top_shelf    — investment_amount_band in ('2000-4999', '5000+')
  zero_knyt    — investment_amount_band = '1000-1999'
  reactivation — investment_amount_band in ('100-499', '500-999')
                 AND has a crm_personas row (identity_persona_id not null)
                 AND campaign_state != 'backed'
  general      — everyone else with email (including <100 investors
                 and those without a persona)

Terminal states (backed, opted_out) are never overwritten.

Usage:
  # Dry-run — show what would be assigned
  python3 scripts/assign_cohorts.py --dry-run

  # Apply
  python3 scripts/assign_cohorts.py --apply

Env vars (from .env.local or environment):
  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

# ── Env ───────────────────────────────────────────────────────────────────────

def load_dotenv(path: str = ".env.local") -> None:
    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

load_dotenv()

SB_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SB_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SB_URL or not SB_KEY:
    sys.exit("ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")

HEADERS = {
    "apikey":        SB_KEY,
    "Authorization": f"Bearer {SB_KEY}",
    "Content-Type":  "application/json",
    "Accept":        "application/json",
}

TERMINAL_STATES = {"backed", "opted_out"}

# ── Cohort mapping ─────────────────────────────────────────────────────────────

TOP_SHELF_BANDS    = {"2000-4999", "5000+"}
ZERO_KNYT_BANDS    = {"1000-1999"}
REACTIVATION_BANDS = {"500-999", "100-499"}

def assign_cohort(band: str | None, has_persona: bool, state: str | None) -> str | None:
    """
    Returns the cohort string, or None if the row should be skipped
    (terminal state or no email-qualified band).
    """
    if state in TERMINAL_STATES:
        return None  # never overwrite terminal states
    if band in TOP_SHELF_BANDS:
        return "top_shelf"
    if band in ZERO_KNYT_BANDS:
        return "zero_knyt"
    if band in REACTIVATION_BANDS:
        return "reactivation"
    return "general"

# ── Supabase helpers ──────────────────────────────────────────────────────────

def sb_get_all(path: str) -> list[dict]:
    """Fetches all rows using Range pagination (1000/page)."""
    rows: list[dict] = []
    page = 0
    page_size = 1000
    while True:
        start = page * page_size
        end   = start + page_size - 1
        req = urllib.request.Request(
            f"{SB_URL}/rest/v1/{path}",
            headers={**HEADERS, "Range": f"{start}-{end}", "Prefer": "count=exact"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                batch = json.loads(resp.read())
                rows.extend(batch)
                if len(batch) < page_size:
                    break
                page += 1
        except urllib.error.HTTPError as e:
            if e.code == 206:
                batch = json.loads(e.read())
                rows.extend(batch)
                if len(batch) < page_size:
                    break
                page += 1
            else:
                sys.exit(f"ERROR fetching {path}: HTTP {e.code} — {e.read().decode()[:200]}")
    return rows


def sb_patch(table: str, row_id: str, updates: dict) -> bool:
    data = json.dumps(updates).encode()
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/{table}?id=eq.{row_id}",
        data=data,
        headers={**HEADERS, "Prefer": "return=minimal"},
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req, timeout=10):
            return True
    except urllib.error.HTTPError as e:
        print(f"  PATCH error for {row_id}: HTTP {e.code} — {e.read().decode()[:120]}")
        return False

# ── Main logic ────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Auto-assign campaign_cohort to KNYT investors")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    parser.add_argument("--apply",   action="store_true", help="Write cohort assignments to DB")
    parser.add_argument("--overwrite", action="store_true",
                        help="Overwrite existing campaign_cohort values (default: skip already-tagged)")
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        parser.print_help()
        sys.exit("\nERROR: pass --dry-run or --apply")

    print("\n── KNYT Wheel — Cohort Assignment ───────────────────────────────────")
    print(f"   Mode: {'DRY RUN' if args.dry_run else 'APPLY'}")
    print(f"   Overwrite existing: {args.overwrite}\n")

    # 1. Fetch all investors
    print("   Fetching nakamoto_knyt_personas…")
    investors = sb_get_all(
        'nakamoto_knyt_personas?select=id,"Email",investment_amount_band,campaign_state,campaign_cohort'
    )
    print(f"   {len(investors)} total rows")

    # 2. Fetch activated emails (crm_personas with identity_persona_id set)
    print("   Fetching activated personas…")
    activated_rows = sb_get_all(
        "crm_personas?select=email&identity_persona_id=not.is.null"
    )
    activated_emails = {(r.get("email") or "").strip().lower() for r in activated_rows}
    print(f"   {len(activated_emails)} activated emails found\n")

    # 3. Compute assignments
    counts: dict[str, int] = {
        "top_shelf": 0, "zero_knyt": 0, "reactivation": 0,
        "general": 0, "skipped_terminal": 0, "skipped_no_email": 0, "skipped_already_tagged": 0,
    }
    to_update: list[tuple[str, str]] = []  # (id, cohort)

    for inv in investors:
        email = (inv.get("Email") or "").strip()
        if not email:
            counts["skipped_no_email"] += 1
            continue

        state  = inv.get("campaign_state") or "unsent"
        band   = inv.get("investment_amount_band")
        existing = inv.get("campaign_cohort")

        if state in TERMINAL_STATES:
            counts["skipped_terminal"] += 1
            continue

        if existing and not args.overwrite:
            counts["skipped_already_tagged"] += 1
            continue

        has_persona = email.lower() in activated_emails
        cohort = assign_cohort(band, has_persona, state)
        if cohort is None:
            counts["skipped_terminal"] += 1
            continue

        counts[cohort] += 1
        to_update.append((inv["id"], cohort))

    # 4. Report
    print("── Assignment preview ────────────────────────────────────────────────")
    print(f"   top_shelf            : {counts['top_shelf']:>5}")
    print(f"   zero_knyt            : {counts['zero_knyt']:>5}")
    print(f"   reactivation         : {counts['reactivation']:>5}")
    print(f"   general              : {counts['general']:>5}")
    print(f"   ─────────────────────────────")
    print(f"   Total to assign      : {len(to_update):>5}")
    print(f"   Skipped (terminal)   : {counts['skipped_terminal']:>5}")
    print(f"   Skipped (no email)   : {counts['skipped_no_email']:>5}")
    print(f"   Skipped (tagged)     : {counts['skipped_already_tagged']:>5}")

    if args.dry_run:
        print("\n   Dry run complete — re-run with --apply to write.\n")
        return

    # 5. Apply
    print(f"\n   Writing {len(to_update)} assignments…")
    ok = 0
    fail = 0
    for i, (row_id, cohort) in enumerate(to_update):
        if sb_patch("nakamoto_knyt_personas", row_id, {"campaign_cohort": cohort}):
            ok += 1
        else:
            fail += 1
        if (i + 1) % 100 == 0:
            print(f"   … {i + 1}/{len(to_update)}")

    print(f"\n✅  Done — {ok} assigned, {fail} failed\n")
    if fail:
        sys.exit(1)


if __name__ == "__main__":
    main()
