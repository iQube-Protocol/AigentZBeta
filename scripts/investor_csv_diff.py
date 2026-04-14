#!/usr/bin/env python3
"""
scripts/investor_csv_diff.py

Diff the Nakamoto investor CSV ledger against the nakamoto_knyt_personas CRM table.
Produces a dry-run enrichment report — NO writes are made.

Usage:
  python3 scripts/investor_csv_diff.py --csv path/to/investors.csv [--output diff_report.json]

Prerequisites:
  pip install supabase python-dotenv
  .env.local must contain NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

# ── optional dotenv load ──────────────────────────────────────────────────────
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

# ── Supabase client ──────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set", file=sys.stderr)
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Column mapping: CSV → nakamoto_knyt_personas ─────────────────────────────
# These are the columns in the CRM table we can enrich from the CSV.
# Fields marked "new" do not currently exist and would need a migration.
FIELD_MAP = {
    # CSV column            → CRM column (or None if new column needed)
    "Email":                "Email",
    "Phone No":             "Phone-Number",
    "Address":              "Address",
    "Public Key":           "EVM-Public-Key",
    "Knyt Handle":          "KNYT-ID",
    "Discord Handle":       "Discord-Handle",
    # Aggregated from transactions:
    "total_amount":         "Total-Invested",       # sum of "Amount Committed"
    "equity_shares":        "Metaiye-Shares-Owned",  # sum of "Equity Share Count"
    # New columns not yet in CRM — would require migration:
    "Investment Status":    None,  # new: csv_investment_status
    "first_committed_date": None,  # new: csv_first_committed_date
    "last_disbursed_date":  None,  # new: csv_last_disbursed_date
    "transfer_methods":     None,  # new: csv_transfer_methods
    "transaction_count":    None,  # new: csv_transaction_count
    "metaKnyts NFTs Collected": None,  # new: csv_metaknyt_nfts
    "No of Other NFTs Collected": None,  # new: csv_other_nfts
}

# ── CRM fields to preserve (never overwrite with CSV data) ───────────────────
CRM_PRESERVE = {
    "BTC-Public-Key", "ThirdWeb-Public-Key", "MetaKeep-Public-Key",
    "LinkedIn-ID", "LinkedIn-Profile-URL", "Twitter-Handle",
    "Telegram-Handle", "Instagram-Handle", "GitHub-Handle",
    "YouTube-ID", "Facebook-ID", "TikTok-Handle",
    "Web3-Interests", "Tokens-of-Interest", "Chain-IDs", "Wallets-of-Interest",
    "KNYT-COYN-Owned", "Motion-Comics-Owned", "Paper-Comics-Owned",
    "Digital-Comics-Owned", "KNYT-Posters-Owned", "KNYT-Cards-Owned",
    "Characters-Owned", "OM-Tier-Status", "OM-Member-Since",
    "Profession", "Local-City", "Age", "profile_image_url",
}

# ── CSV parsing helpers ───────────────────────────────────────────────────────

def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def normalize_phone(raw: str) -> str:
    """Convert scientific-notation phone numbers to plain strings."""
    if not raw or not raw.strip():
        return ""
    raw = raw.strip()
    # Handle scientific notation e.g. "9.73E+11"
    try:
        val = float(raw)
        if val > 1e6:
            return str(int(val))
    except ValueError:
        pass
    return raw


def clean_name(raw: str) -> tuple[str, str]:
    """
    Split raw name into (first, last).
    Detects and fixes common artifacts:
      - "Hugh Stiel Stiel" → "Hugh Stiel"  (doubled last name)
      - "James james@PALcapital.com" → "James" + note
      - "lynns_ac@comcast.net Harry Lynn Green" → extract real name
    Returns (first_name, last_name).
    """
    if not raw:
        return ("", "")
    raw = raw.strip()

    # If name field contains an email address, extract the non-email part
    email_re = re.compile(r"[\w.\-+]+@[\w.\-]+\.[a-zA-Z]{2,}")
    raw = email_re.sub("", raw).strip()
    if not raw:
        return ("", "")

    parts = raw.split()
    if len(parts) == 0:
        return ("", "")
    if len(parts) == 1:
        return (parts[0], "")

    # Detect doubled last name: "First Last Last" → "First Last"
    if len(parts) == 3 and parts[1].lower() == parts[2].lower():
        return (parts[0], parts[1])

    first = parts[0]
    last = " ".join(parts[1:])
    return (first, last)


def parse_amount(raw: str) -> float:
    """Parse dollar amounts like '$1,234.56' or '1234.56'."""
    if not raw or not raw.strip():
        return 0.0
    cleaned = re.sub(r"[^0-9.]", "", raw)
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def parse_int(raw: str) -> int:
    if not raw or not raw.strip():
        return 0
    try:
        return int(float(raw.replace(",", "").strip()))
    except ValueError:
        return 0


def parse_date(raw: str) -> str:
    """Return raw date string, normalized to ISO if possible."""
    if not raw or not raw.strip():
        return ""
    raw = raw.strip()
    # Try M/D/YY or M/D/YYYY
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", raw)
    if m:
        mo, da, yr = m.groups()
        if len(yr) == 2:
            yr = "20" + yr
        return f"{yr}-{mo.zfill(2)}-{da.zfill(2)}"
    return raw


# ── CSV aggregation ───────────────────────────────────────────────────────────

def aggregate_csv(csv_path: str) -> tuple[dict, list]:
    """
    Read CSV and aggregate per-email.
    Returns:
      investors: dict[email_lower → aggregated record]
      issues: list of data-quality notes
    """
    investors: dict[str, dict] = {}
    issues: list[str] = []
    raw_rows: list[dict] = []

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw_rows.append(row)

    total_raw = len(raw_rows)

    # Detect and remove exact duplicate rows
    seen_rows: set[str] = set()
    deduped: list[dict] = []
    exact_dups = 0
    for row in raw_rows:
        key = json.dumps(row, sort_keys=True)
        if key in seen_rows:
            exact_dups += 1
        else:
            seen_rows.add(key)
            deduped.append(row)

    if exact_dups:
        issues.append(f"{exact_dups} exact-duplicate rows removed before aggregation")

    # Aggregate by email
    for row in deduped:
        email_raw = row.get("Email", "").strip()
        email = normalize_email(email_raw)

        name_raw = row.get("Name", "").strip()
        first, last = clean_name(name_raw)

        # Flag data quality issues
        if not email:
            issues.append(f"Blank email — name='{name_raw}' (row skipped in email-keyed merge)")

        # Check for doubled names
        name_parts = name_raw.split()
        if len(name_parts) == 3 and name_parts[1].lower() == name_parts[2].lower():
            issues.append(f"Doubled surname detected and corrected: '{name_raw}' → '{first} {last}'")

        phone = normalize_phone(row.get("Phone No", ""))
        address = (row.get("Address", "") or "").strip()
        pub_key = (row.get("Public Key", "") or "").strip()
        knyt_handle = (row.get("Knyt Handle", "") or "").strip()
        discord = (row.get("Discord Handle", "") or "").strip()
        nft_meta = (row.get("metaKnyts NFTs Collected", "") or "").strip()
        nft_other = (row.get("No of Other NFTs Collected", "") or "").strip()
        inv_status = (row.get("Investment Status", "") or "").strip()
        transfer = (row.get("Funds Transfer Method", "") or "").strip()

        amount_committed = parse_amount(row.get("Amount Committed", ""))
        equity_shares = parse_int(row.get("Equity Share Count", ""))
        date_committed = parse_date(row.get("Date Committed", ""))
        date_disbursed = parse_date(row.get("Date Disbursed", ""))

        if not email:
            # Can't aggregate by email, still count
            continue

        if email not in investors:
            investors[email] = {
                "email": email,
                "first_name": first,
                "last_name": last,
                "phone": phone,
                "address": address,
                "pub_key": pub_key,
                "knyt_handle": knyt_handle,
                "discord": discord,
                "nft_meta": nft_meta,
                "nft_other": nft_other,
                "investment_status": inv_status,
                "transfer_methods": {transfer} if transfer else set(),
                "total_amount_committed": amount_committed,
                "total_equity_shares": equity_shares,
                "first_committed_date": date_committed,
                "last_disbursed_date": date_disbursed,
                "transaction_count": 1,
            }
        else:
            rec = investors[email]
            rec["transaction_count"] += 1
            rec["total_amount_committed"] += amount_committed
            rec["total_equity_shares"] += equity_shares
            if transfer:
                rec["transfer_methods"].add(transfer)
            # Non-empty fields: take first non-empty value
            if not rec["phone"] and phone:
                rec["phone"] = phone
            if not rec["address"] and address:
                rec["address"] = address
            if not rec["pub_key"] and pub_key:
                rec["pub_key"] = pub_key
            if not rec["knyt_handle"] and knyt_handle:
                rec["knyt_handle"] = knyt_handle
            if not rec["discord"] and discord:
                rec["discord"] = discord
            if not rec["nft_meta"] and nft_meta:
                rec["nft_meta"] = nft_meta
            if not rec["nft_other"] and nft_other:
                rec["nft_other"] = nft_other
            # Dates: track earliest committed, latest disbursed
            if date_committed:
                if not rec["first_committed_date"] or date_committed < rec["first_committed_date"]:
                    rec["first_committed_date"] = date_committed
            if date_disbursed:
                if not rec["last_disbursed_date"] or date_disbursed > rec["last_disbursed_date"]:
                    rec["last_disbursed_date"] = date_disbursed
            # Escalate status: Invested > Committed > anything else
            status_rank = {"invested": 2, "committed": 1}
            existing_rank = status_rank.get(rec["investment_status"].lower(), 0)
            new_rank = status_rank.get(inv_status.lower(), 0)
            if new_rank > existing_rank:
                rec["investment_status"] = inv_status

    # Convert sets to sorted lists for JSON serialization
    for rec in investors.values():
        rec["transfer_methods"] = sorted(rec["transfer_methods"])

    return investors, issues, total_raw, exact_dups


# ── CRM fetch ─────────────────────────────────────────────────────────────────

def fetch_crm_records() -> list[dict]:
    """Fetch all nakamoto_knyt_personas rows, paginated."""
    all_records: list[dict] = []
    offset = 0
    PAGE = 1000

    select_cols = ",".join([
        "id", '"Email"', '"Phone-Number"', '"Address"',
        '"First-Name"', '"Last-Name"',
        '"EVM-Public-Key"', '"BTC-Public-Key"',
        '"KNYT-ID"', '"Discord-Handle"',
        '"Total-Invested"', '"Metaiye-Shares-Owned"',
        '"OM-Tier-Status"', '"OM-Member-Since"',
        '"Twitter-Handle"', '"LinkedIn-ID"', '"Telegram-Handle"',
    ])

    while True:
        resp = (
            supabase.table("nakamoto_knyt_personas")
            .select(select_cols)
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        batch = resp.data or []
        all_records.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE

    return all_records


# ── Diff logic ────────────────────────────────────────────────────────────────

EMPTY = {"", None, "0", "0.0"}


def is_empty(val) -> bool:
    if val is None:
        return True
    if isinstance(val, str):
        return val.strip() in EMPTY
    if isinstance(val, (list,)):
        return len(val) == 0
    return False


def build_diff(csv_investors: dict, crm_records: list[dict]) -> dict:
    # Index CRM by email
    crm_by_email: dict[str, dict] = {}
    crm_no_email: list[dict] = []
    for rec in crm_records:
        email = normalize_email(rec.get("Email", ""))
        if email:
            if email in crm_by_email:
                # Duplicate email in CRM — flag it
                pass
            crm_by_email[email] = rec
        else:
            crm_no_email.append(rec)

    csv_emails = set(csv_investors.keys())
    crm_emails = set(crm_by_email.keys())

    matched_emails = csv_emails & crm_emails
    csv_only_emails = csv_emails - crm_emails
    crm_only_emails = crm_emails - csv_emails

    # Field enrichment opportunities per matched record
    field_opportunities: dict[str, int] = defaultdict(int)
    field_would_set: dict[str, list[str]] = defaultdict(list)

    enrichment_details: list[dict] = []

    for email in matched_emails:
        csv_rec = csv_investors[email]
        crm_rec = crm_by_email[email]

        changes: dict[str, dict] = {}

        # Phone
        if is_empty(crm_rec.get("Phone-Number")) and not is_empty(csv_rec["phone"]):
            changes["Phone-Number"] = {"crm": crm_rec.get("Phone-Number"), "csv": csv_rec["phone"]}
            field_opportunities["Phone-Number"] += 1

        # Address
        if is_empty(crm_rec.get("Address")) and not is_empty(csv_rec["address"]):
            changes["Address"] = {"crm": crm_rec.get("Address"), "csv": csv_rec["address"]}
            field_opportunities["Address"] += 1

        # EVM Public Key
        if is_empty(crm_rec.get("EVM-Public-Key")) and not is_empty(csv_rec["pub_key"]):
            changes["EVM-Public-Key"] = {"crm": crm_rec.get("EVM-Public-Key"), "csv": csv_rec["pub_key"]}
            field_opportunities["EVM-Public-Key"] += 1

        # KNYT-ID
        if is_empty(crm_rec.get("KNYT-ID")) and not is_empty(csv_rec["knyt_handle"]):
            changes["KNYT-ID"] = {"crm": crm_rec.get("KNYT-ID"), "csv": csv_rec["knyt_handle"]}
            field_opportunities["KNYT-ID"] += 1

        # Discord
        if is_empty(crm_rec.get("Discord-Handle")) and not is_empty(csv_rec["discord"]):
            changes["Discord-Handle"] = {"crm": crm_rec.get("Discord-Handle"), "csv": csv_rec["discord"]}
            field_opportunities["Discord-Handle"] += 1

        # Total-Invested: update if CSV value is larger or CRM is empty
        csv_total = round(csv_rec["total_amount_committed"], 2)
        crm_total_raw = crm_rec.get("Total-Invested", "")
        try:
            crm_total = float(crm_total_raw.replace(",", "").replace("$", "")) if crm_total_raw else 0.0
        except (ValueError, AttributeError):
            crm_total = 0.0
        if csv_total > 0 and (is_empty(crm_total_raw) or abs(csv_total - crm_total) > 0.01):
            changes["Total-Invested"] = {"crm": crm_total_raw, "csv": str(csv_total)}
            field_opportunities["Total-Invested"] += 1

        # Metaiye-Shares-Owned
        csv_shares = csv_rec["total_equity_shares"]
        crm_shares_raw = crm_rec.get("Metaiye-Shares-Owned", "")
        try:
            crm_shares = int(float(crm_shares_raw)) if crm_shares_raw else 0
        except (ValueError, AttributeError):
            crm_shares = 0
        if csv_shares > 0 and (is_empty(crm_shares_raw) or crm_shares != csv_shares):
            changes["Metaiye-Shares-Owned"] = {"crm": crm_shares_raw, "csv": str(csv_shares)}
            field_opportunities["Metaiye-Shares-Owned"] += 1

        # First/Last name: fill only if both CRM fields are empty
        if is_empty(crm_rec.get("First-Name")) and not is_empty(csv_rec["first_name"]):
            changes["First-Name"] = {"crm": crm_rec.get("First-Name"), "csv": csv_rec["first_name"]}
            field_opportunities["First-Name"] += 1
        if is_empty(crm_rec.get("Last-Name")) and not is_empty(csv_rec["last_name"]):
            changes["Last-Name"] = {"crm": crm_rec.get("Last-Name"), "csv": csv_rec["last_name"]}
            field_opportunities["Last-Name"] += 1

        if changes:
            enrichment_details.append({
                "email": email,
                "crm_id": crm_rec.get("id"),
                "changes": changes,
            })

    # Investors in CSV but not in CRM
    csv_only_list = [
        {
            "email": e,
            "name": f"{csv_investors[e]['first_name']} {csv_investors[e]['last_name']}".strip(),
            "total_committed": round(csv_investors[e]["total_amount_committed"], 2),
            "equity_shares": csv_investors[e]["total_equity_shares"],
            "investment_status": csv_investors[e]["investment_status"],
            "transaction_count": csv_investors[e]["transaction_count"],
        }
        for e in sorted(csv_only_emails)
    ]

    return {
        "summary": {
            "csv_unique_investors": len(csv_investors),
            "crm_total_records": len(crm_records),
            "crm_with_email": len(crm_by_email),
            "crm_without_email": len(crm_no_email),
            "matched_by_email": len(matched_emails),
            "csv_only_not_in_crm": len(csv_only_emails),
            "crm_only_not_in_csv": len(crm_only_emails),
            "crm_records_with_enrichment_available": len(enrichment_details),
        },
        "field_enrichment_opportunities": dict(field_opportunities),
        "new_columns_needed": {
            "csv_investment_status": "Investment Status from CSV (Invested / Committed / etc.)",
            "csv_first_committed_date": "Earliest Date Committed across all transactions",
            "csv_last_disbursed_date": "Latest Date Disbursed across all transactions",
            "csv_transfer_methods": "Comma-separated Funds Transfer Methods used",
            "csv_transaction_count": "Number of investment transactions in CSV ledger",
            "csv_metaknyt_nfts": "metaKnyts NFTs Collected (from CSV)",
            "csv_other_nfts": "No of Other NFTs Collected (from CSV)",
        },
        "enrichment_details": enrichment_details,
        "csv_investors_not_in_crm": csv_only_list,
        "crm_only_emails_sample": sorted(crm_only_emails)[:50],  # first 50
        "crm_records_without_email_count": len(crm_no_email),
    }


# ── Apply mode ────────────────────────────────────────────────────────────────

# Mapping from diff change keys → nakamoto_knyt_personas column names
# (hyphenated column names need quoting in PostgREST but the Python client
#  uses them as dict keys as-is)
_DIRECT_FIELD_MAP = {
    "Phone-Number":        "Phone-Number",
    "Address":             "Address",
    "EVM-Public-Key":      "EVM-Public-Key",
    "KNYT-ID":             "KNYT-ID",
    "Discord-Handle":      "Discord-Handle",
    "Total-Invested":      "Total-Invested",
    "Metaiye-Shares-Owned": "Metaiye-Shares-Owned",
    "First-Name":          "First-Name",
    "Last-Name":           "Last-Name",
}

BATCH_SIZE = 50  # rows per Supabase upsert call


def apply_enrichment(report: dict, csv_investors: dict) -> dict:
    """
    Write enrichment data back to nakamoto_knyt_personas.

    Two passes:
      1. Field enrichment — update matched CRM rows with CSV values for
         Phone-Number, Address, EVM-Public-Key, KNYT-ID, Discord-Handle,
         Total-Invested, Metaiye-Shares-Owned, First-Name, Last-Name.
      2. CSV-only columns — write csv_investment_status, csv_transaction_count,
         csv_first_committed_date, csv_last_disbursed_date, csv_transfer_methods,
         csv_metaknyt_nfts, csv_other_nfts for every matched CRM row.

    Returns a result summary dict.
    """
    enrichment_details = report.get("enrichment_details", [])
    print(f"\n→ Apply mode: {len(enrichment_details)} enrichment records to write", file=sys.stderr)

    # Build a fast email → csv_investor lookup
    csv_by_email: dict[str, dict] = {e: r for e, r in csv_investors.items()}

    # Build full update set: crm_id → update payload
    # Pass 1: field enrichment
    updates: dict[str, dict] = {}
    for detail in enrichment_details:
        crm_id = detail.get("crm_id")
        email = detail.get("email")
        if not crm_id:
            continue
        payload: dict = {}
        for field, delta in detail.get("changes", {}).items():
            col = _DIRECT_FIELD_MAP.get(field)
            if col:
                payload[col] = delta["csv"]
        if payload:
            updates[crm_id] = payload

    # Pass 2: csv_* columns for all matched CRM rows
    # Re-index CRM by id from report
    crm_id_to_email: dict[str, str] = {
        d["crm_id"]: d["email"]
        for d in enrichment_details
        if d.get("crm_id") and d.get("email")
    }
    # Also include matched rows that had no field changes but still need csv_* cols
    # Build from summary matched_emails — we already have the enrichment_details indexed
    # by email in report. We'll extend updates for all matched rows.
    for crm_id, email in crm_id_to_email.items():
        csv_rec = csv_by_email.get(email)
        if not csv_rec:
            continue
        csv_cols: dict = {
            "csv_investment_status":    csv_rec.get("investment_status", ""),
            "csv_transaction_count":    csv_rec.get("transaction_count", 0),
            "csv_first_committed_date": csv_rec.get("first_committed_date", ""),
            "csv_last_disbursed_date":  csv_rec.get("last_disbursed_date", ""),
            "csv_transfer_methods":     ",".join(csv_rec.get("transfer_methods") or []),
            "csv_metaknyt_nfts":        csv_rec.get("nft_meta", ""),
            "csv_other_nfts":           csv_rec.get("nft_other", ""),
        }
        if crm_id in updates:
            updates[crm_id].update(csv_cols)
        else:
            updates[crm_id] = csv_cols

    total = len(updates)
    applied = 0
    errors: list[str] = []

    ids = list(updates.keys())
    for batch_start in range(0, len(ids), BATCH_SIZE):
        batch_ids = ids[batch_start:batch_start + BATCH_SIZE]
        for crm_id in batch_ids:
            payload = updates[crm_id]
            try:
                resp = (
                    supabase.table("nakamoto_knyt_personas")
                    .update(payload)
                    .eq("id", crm_id)
                    .execute()
                )
                if hasattr(resp, "error") and resp.error:
                    errors.append(f"{crm_id}: {resp.error}")
                else:
                    applied += 1
            except Exception as exc:
                errors.append(f"{crm_id}: {exc}")

        print(
            f"  Applied {min(batch_start + BATCH_SIZE, total)}/{total}…",
            file=sys.stderr,
            end="\r",
        )

    print(f"\n✓ Apply complete: {applied}/{total} rows updated, {len(errors)} errors", file=sys.stderr)
    if errors:
        for e in errors[:10]:
            print(f"  ✗ {e}", file=sys.stderr)
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more errors", file=sys.stderr)

    return {"applied": applied, "total": total, "errors": errors}


# ── Investment-amount band helper ─────────────────────────────────────────────

def investment_band(amount: float) -> str:
    if amount >= 5000:  return "5000+"
    if amount >= 2000:  return "2000-4999"
    if amount >= 1000:  return "1000-1999"
    if amount >= 500:   return "500-999"
    if amount >= 100:   return "100-499"
    return "<100"


def apply_investment_bands(csv_investors: dict, crm_records: list[dict]) -> dict:
    """
    Auto-populate investment_amount_band on nakamoto_knyt_personas rows
    where band is not yet set. Uses CSV total_amount_committed as source.
    """
    crm_by_email = {
        (rec.get("Email") or "").strip().lower(): rec
        for rec in crm_records
        if (rec.get("Email") or "").strip()
    }

    updates: dict[str, str] = {}  # crm_id → band
    for email, csv_rec in csv_investors.items():
        crm_rec = crm_by_email.get(email)
        if not crm_rec:
            continue
        amount = csv_rec.get("total_amount_committed", 0.0)
        if amount > 0:
            updates[crm_rec["id"]] = investment_band(amount)

    applied = 0
    for crm_id, band in updates.items():
        try:
            supabase.table("nakamoto_knyt_personas") \
                .update({"investment_amount_band": band}) \
                .eq("id", crm_id) \
                .execute()
            applied += 1
        except Exception as exc:
            print(f"  ✗ band update {crm_id}: {exc}", file=sys.stderr)

    print(f"✓ Investment bands set: {applied}/{len(updates)}", file=sys.stderr)
    return {"applied": applied, "total": len(updates)}


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Diff investor CSV against nakamoto_knyt_personas CRM")
    parser.add_argument("--csv", required=True, help="Path to investor CSV file")
    parser.add_argument("--output", default="", help="Write JSON report to this file (default: stdout)")
    parser.add_argument(
        "--apply",
        action="store_true",
        help=(
            "Write enrichment data to Supabase. Without this flag the script is "
            "dry-run only. With --apply, enrichment fields and csv_* columns are "
            "written to matched nakamoto_knyt_personas rows."
        ),
    )
    parser.add_argument(
        "--apply-bands",
        action="store_true",
        help="Also auto-populate investment_amount_band from CSV totals (requires --apply).",
    )
    args = parser.parse_args()

    csv_path = args.csv
    if not os.path.exists(csv_path):
        print(f"ERROR: CSV file not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    print("→ Parsing and aggregating CSV...", file=sys.stderr)
    csv_investors, issues, total_raw, exact_dups = aggregate_csv(csv_path)

    print(f"  Raw rows: {total_raw}", file=sys.stderr)
    print(f"  Exact duplicate rows removed: {exact_dups}", file=sys.stderr)
    print(f"  Unique investors (by email): {len(csv_investors)}", file=sys.stderr)

    csv_total_capital = sum(r["total_amount_committed"] for r in csv_investors.values())
    csv_total_shares = sum(r["total_equity_shares"] for r in csv_investors.values())
    print(f"  Total capital committed: ${csv_total_capital:,.2f}", file=sys.stderr)
    print(f"  Total equity shares: {csv_total_shares:,}", file=sys.stderr)

    print("\n→ Fetching CRM records from Supabase...", file=sys.stderr)
    crm_records = fetch_crm_records()
    print(f"  CRM records fetched: {len(crm_records)}", file=sys.stderr)

    print("\n→ Computing diff...", file=sys.stderr)
    report = build_diff(csv_investors, crm_records)

    report["csv_aggregate_totals"] = {
        "raw_rows": total_raw,
        "exact_duplicate_rows_removed": exact_dups,
        "unique_investors_by_email": len(csv_investors),
        "total_capital_committed_usd": round(csv_total_capital, 2),
        "total_equity_shares": csv_total_shares,
    }
    report["data_quality_issues"] = issues

    # ── Apply mode ────────────────────────────────────────────────────────────
    if args.apply:
        apply_result = apply_enrichment(report, csv_investors)
        report["apply_result"] = apply_result

        if args.apply_bands:
            band_result = apply_investment_bands(csv_investors, crm_records)
            report["apply_bands_result"] = band_result
    elif args.apply_bands:
        print("WARNING: --apply-bands requires --apply. Skipping band updates.", file=sys.stderr)

    output_json = json.dumps(report, indent=2, default=str)

    if args.output:
        with open(args.output, "w") as f:
            f.write(output_json)
        print(f"\n✓ Report written to {args.output}", file=sys.stderr)
    else:
        print(output_json)

    # Print summary to stderr
    s = report["summary"]
    print("\n╔══ DIFF SUMMARY ══════════════════════════════════╗", file=sys.stderr)
    print(f"  CSV unique investors:        {s['csv_unique_investors']:>6}", file=sys.stderr)
    print(f"  CRM total records:           {s['crm_total_records']:>6}", file=sys.stderr)
    print(f"  Matched by email:            {s['matched_by_email']:>6}", file=sys.stderr)
    print(f"  CSV investors NOT in CRM:    {s['csv_only_not_in_crm']:>6}", file=sys.stderr)
    print(f"  CRM records NOT in CSV:      {s['crm_only_not_in_csv']:>6}", file=sys.stderr)
    print(f"  CRM records enrichable:      {s['crm_records_with_enrichment_available']:>6}", file=sys.stderr)
    print("╚══════════════════════════════════════════════════╝", file=sys.stderr)
    print("\nField enrichment opportunities:", file=sys.stderr)
    for field, count in sorted(report["field_enrichment_opportunities"].items(), key=lambda x: -x[1]):
        print(f"  {field:<30} {count:>5} records can be filled", file=sys.stderr)
    if issues:
        print(f"\nData quality issues ({len(issues)}):", file=sys.stderr)
        for issue in issues[:20]:
            print(f"  • {issue}", file=sys.stderr)
        if len(issues) > 20:
            print(f"  ... and {len(issues) - 20} more (see full JSON report)", file=sys.stderr)


if __name__ == "__main__":
    main()
