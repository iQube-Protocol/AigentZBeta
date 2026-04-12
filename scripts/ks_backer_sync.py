#!/usr/bin/env python3
"""
scripts/ks_backer_sync.py

Syncs a Kickstarter backer export CSV into nakamoto_knyt_personas.

For each backer row:
  - If the email already exists in nakamoto_knyt_personas:
      Sets kickstarter_backed_at (if not already set)
      Advances campaign_state to 'backed' (terminal — never downgrades)
  - If the email is NOT in nakamoto_knyt_personas:
      Inserts a new prospect row tagged 'ks_backer'

Kickstarter CSV columns used:
  Email, Backer Name, Pledge Amount, Pledged At, Reward Title, Status
  (Columns are case-insensitive and whitespace-trimmed)

Usage:
  # Dry run — print what would change (default)
  python3 scripts/ks_backer_sync.py --csv data/ks_backers.csv

  # Write changes to Supabase
  python3 scripts/ks_backer_sync.py --csv data/ks_backers.csv --apply

  # Only process rows with Status = 'collected' (exclude pledged-only)
  python3 scripts/ks_backer_sync.py --csv data/ks_backers.csv --apply --status collected

Prerequisites:
  pip install supabase python-dotenv
  .env.local must contain NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── dotenv ────────────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass

try:
    from supabase import create_client
except ImportError:
    print("ERROR: supabase-py not installed. Run: pip install supabase", file=sys.stderr)
    sys.exit(1)

# ── Supabase client ───────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
)
if not SUPABASE_URL or not SUPABASE_KEY:
    print(
        "ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set",
        file=sys.stderr,
    )
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── KS CSV column aliases ─────────────────────────────────────────────────────
# Kickstarter exports use slightly different column names depending on the export
# version. Normalise them to canonical keys.
_COL_ALIASES: dict[str, str] = {
    "email":         "email",
    "backer email":  "email",
    "backer name":   "name",
    "name":          "name",
    "pledge amount": "pledge_amount",
    "amount":        "pledge_amount",
    "pledged at":    "pledged_at",
    "pledge date":   "pledged_at",
    "backed at":     "pledged_at",
    "reward title":  "reward_title",
    "reward":        "reward_title",
    "status":        "status",
    "pledge status": "status",
}


def normalise_headers(raw_headers: list[str]) -> dict[int, str]:
    """Return {col_index: canonical_key} for known columns."""
    result: dict[int, str] = {}
    for i, h in enumerate(raw_headers):
        key = _COL_ALIASES.get(h.strip().lower())
        if key:
            result[i] = key
    return result


def parse_row(row: list[str], col_map: dict[int, str]) -> dict[str, str]:
    record: dict[str, str] = {}
    for i, val in enumerate(row):
        if i in col_map:
            record[col_map[i]] = val.strip()
    return record


def split_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split(None, 1)
    if len(parts) == 0:
        return ("", "")
    if len(parts) == 1:
        return (parts[0], "")
    return (parts[0], parts[1])


def parse_pledged_at(raw: str) -> str | None:
    """Try to parse a KS date string into ISO format. Return None if unparseable."""
    if not raw:
        return None
    for fmt in (
        "%Y-%m-%d %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%d/%m/%Y",
    ):
        try:
            dt = datetime.strptime(raw.split("+")[0].strip(), fmt)
            return dt.replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            continue
    return None


# ── Load all existing nakamoto emails in one query ────────────────────────────

def load_existing_investors() -> dict[str, dict]:
    """
    Returns {email_lower: row} for all rows in nakamoto_knyt_personas that have an email.
    Paginates past the 1000-row PostgREST cap.
    """
    result: dict[str, dict] = {}
    page_size = 1000
    page = 0
    while True:
        resp = (
            supabase.table("nakamoto_knyt_personas")
            .select('id, "Email", campaign_state, kickstarter_backed_at')
            .range(page * page_size, (page + 1) * page_size - 1)
            .execute()
        )
        rows = resp.data or []
        for row in rows:
            email = (row.get("Email") or "").strip().lower()
            if email:
                result[email] = row
        if len(rows) < page_size:
            break
        page += 1
    return result


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync Kickstarter backer CSV into nakamoto_knyt_personas"
    )
    parser.add_argument("--csv", required=True, help="Path to Kickstarter backer export CSV")
    parser.add_argument(
        "--apply", action="store_true",
        help="Write changes to Supabase (default: dry run)"
    )
    parser.add_argument(
        "--status", default="",
        help="Only process rows matching this Status value (e.g. 'collected'). Leave blank for all."
    )
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"ERROR: CSV file not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    dry_run = not args.apply
    status_filter = args.status.strip().lower()

    print(f"{'[DRY RUN] ' if dry_run else ''}Loading existing investors from Supabase…")
    existing = load_existing_investors()
    print(f"  {len(existing)} existing investor emails loaded")

    updates: list[dict] = []    # rows to update (kickstarter_backed_at + state)
    inserts: list[dict] = []    # new backer rows to insert
    skipped = 0
    bad_email = 0

    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        raw_headers = next(reader, None)
        if raw_headers is None:
            print("ERROR: CSV is empty", file=sys.stderr)
            sys.exit(1)

        col_map = normalise_headers(raw_headers)
        if "email" not in col_map.values():
            print(
                f"ERROR: No email column found. Headers detected: {raw_headers}",
                file=sys.stderr,
            )
            sys.exit(1)

        for i, row in enumerate(reader, start=2):
            record = parse_row(row, col_map)
            email_raw = record.get("email", "").strip()
            if not email_raw or "@" not in email_raw:
                bad_email += 1
                continue

            email_lower = email_raw.lower()
            row_status = record.get("status", "").strip().lower()

            # Apply status filter if provided
            if status_filter and row_status != status_filter:
                skipped += 1
                continue

            pledged_at = parse_pledged_at(record.get("pledged_at", ""))
            backed_at = pledged_at or datetime.now(tz=timezone.utc).isoformat()
            full_name = record.get("name", "")
            first_name, last_name = split_name(full_name)

            if email_lower in existing:
                inv = existing[email_lower]
                # Already backed → skip
                if inv.get("kickstarter_backed_at"):
                    skipped += 1
                    continue
                updates.append({
                    "id": inv["id"],
                    "email": email_raw,
                    "name": full_name or email_raw,
                    "kickstarter_backed_at": backed_at,
                    "campaign_state": "backed",
                })
            else:
                inserts.append({
                    "email": email_raw,
                    "name": full_name or email_raw,
                    "first_name": first_name,
                    "last_name": last_name,
                    "backed_at": backed_at,
                    "reward_title": record.get("reward_title", ""),
                })

    # ── Report ────────────────────────────────────────────────────────────────
    print(f"\nScan complete:")
    print(f"  {len(updates):>4} existing investors to mark backed")
    print(f"  {len(inserts):>4} new backers to insert")
    print(f"  {skipped:>4} skipped (already backed or filtered by status)")
    print(f"  {bad_email:>4} rows skipped (no valid email)")

    if dry_run:
        if updates:
            print("\n── Updates (sample, up to 10) ──")
            for u in updates[:10]:
                print(f"  [{u['id'][:8]}…] {u['email']}  →  backed @ {u['backed_at']}")
        if inserts:
            print("\n── New inserts (sample, up to 10) ──")
            for ins in inserts[:10]:
                print(f"  {ins['email']}  ({ins['name']})  backed @ {ins['backed_at']}")
        print("\nRun with --apply to write changes.")
        return

    # ── Apply updates ─────────────────────────────────────────────────────────
    CHUNK = 100
    updated_count = 0
    for u in updates:
        resp = (
            supabase.table("nakamoto_knyt_personas")
            .update({
                "kickstarter_backed_at": u["kickstarter_backed_at"],
                "campaign_state": "backed",
            })
            .eq("id", u["id"])
            .execute()
        )
        if resp.data:
            updated_count += 1
        else:
            print(f"  WARN: update failed for {u['email']}")

    print(f"\n✓ Updated {updated_count} existing investors → backed")

    # ── Apply inserts ─────────────────────────────────────────────────────────
    inserted_count = 0
    for chunk_start in range(0, len(inserts), CHUNK):
        chunk = inserts[chunk_start : chunk_start + CHUNK]
        payload = [
            {
                "Email":           ins["email"],
                "First-Name":      ins["first_name"] or None,
                "Last-Name":       ins["last_name"] or None,
                "campaign_state":  "backed",
                "kickstarter_backed_at": ins["backed_at"],
                "campaign_tags":   ["ks_backer"],
                "campaign_notes":  ins["reward_title"] or None,
            }
            for ins in chunk
        ]
        resp = (
            supabase.table("nakamoto_knyt_personas")
            .insert(payload)
            .execute()
        )
        inserted_count += len(resp.data or [])

    print(f"✓ Inserted {inserted_count} new KS backers")
    print("\nDone. Refresh the Investors tab and filter by campaign_state=backed to verify.")


if __name__ == "__main__":
    main()
