#!/usr/bin/env python3
"""
scripts/investor_csv_diff_requests.py

Same logic as investor_csv_diff.py but uses requests (not supabase-py)
to bypass the broken cffi/cryptography chain in this sandbox.

Dry-run only — NO writes.
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

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass

import requests

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set", file=sys.stderr)
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "count=exact",
}

TABLE = "nakamoto_knyt_personas"

# ── helpers ───────────────────────────────────────────────────────────────────

def normalize_phone(raw: str) -> str:
    if not raw:
        return ""
    s = str(raw).strip()
    # scientific notation e.g. 9.73E+11
    try:
        if "E" in s.upper() or "e" in s:
            n = int(float(s))
            return str(n)
    except (ValueError, OverflowError):
        pass
    return re.sub(r"[^\d+]", "", s)

def clean_name(raw: str) -> str:
    """Remove email-prefix artifacts and doubled surnames."""
    s = str(raw).strip()
    # Pattern: "email@domain.com John Smith" or "john_ac@domain.com John Smith"
    s = re.sub(r"^\S+@\S+\s+", "", s)
    # Also strip leading "word_ac@" patterns without TLD (e.g. lynns_ac@comcast.net)
    s = re.sub(r"^\w[\w._%+-]*@\w[\w.-]+\.\w+\s*", "", s)
    parts = s.split()
    # Detect doubled last name: ["Hugh","Stiel","Stiel"] → ["Hugh","Stiel"]
    if len(parts) >= 2 and parts[-1] == parts[-2]:
        parts = parts[:-1]
    return " ".join(parts).strip()

def is_empty(val) -> bool:
    if val is None:
        return True
    return str(val).strip() in ("", "null", "None")

def parse_amount(val) -> float:
    if is_empty(val):
        return 0.0
    s = re.sub(r"[,$\s]", "", str(val))
    try:
        return float(s)
    except ValueError:
        return 0.0

# ── CRM fetch ─────────────────────────────────────────────────────────────────

def fetch_crm_records() -> list[dict]:
    records = []
    page_size = 1000
    offset = 0
    while True:
        url = f"{SUPABASE_URL}/rest/v1/{TABLE}"
        params = {
            "select": "*",
            "offset": offset,
            "limit": page_size,
        }
        resp = requests.get(url, headers=HEADERS, params=params)
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        records.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return records

# ── CSV parse ─────────────────────────────────────────────────────────────────

def aggregate_csv(csv_path: str) -> tuple[dict, list]:
    """
    Returns:
      aggregated: {email_lower: merged_record_dict}
      issues:     list of quality issue strings
    """
    issues: list[str] = []
    raw_rows: list[dict] = []

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            raw_rows.append(dict(row))

    total_raw = len(raw_rows)

    # Deduplicate exact rows
    seen_rows: set[str] = set()
    deduped: list[dict] = []
    dup_count = 0
    for row in raw_rows:
        key = json.dumps(row, sort_keys=True)
        if key in seen_rows:
            dup_count += 1
        else:
            seen_rows.add(key)
            deduped.append(row)

    if dup_count:
        issues.append(f"{dup_count} exact-duplicate transaction rows removed")

    aggregated: dict[str, dict] = {}

    for row in deduped:
        name_raw = row.get("Name", "").strip()
        email_raw = row.get("Email", "").strip()

        # Blank email rows
        if not email_raw:
            issues.append(f"Blank email row — name: {repr(name_raw)}")
            continue

        email = email_raw.lower()

        # Email-in-name artifact
        if "@" in name_raw:
            cleaned = clean_name(name_raw)
            if cleaned != name_raw:
                issues.append(f"Email artifact in name: {repr(name_raw)} → {repr(cleaned)}")
            name_raw = cleaned

        # Doubled surname
        parts = name_raw.split()
        if len(parts) >= 2 and parts[-1] == parts[-2]:
            cleaned = " ".join(parts[:-1])
            issues.append(f"Doubled surname: {repr(name_raw)} → {repr(cleaned)}")
            name_raw = cleaned

        amount = parse_amount(row.get("Investment Total (including investor fees)", "") or row.get("Amount Committed", ""))
        committed = parse_amount(row.get("Amount Committed", ""))
        date_committed = (row.get("Date Committed") or "").strip()
        date_disbursed = (row.get("Date Disbursed") or "").strip()
        transfer = (row.get("Funds Transfer Method") or "").strip()
        phone = normalize_phone(row.get("Phone No", "") or "")
        address = (row.get("Address") or "").strip()
        pub_key = (row.get("Public Key") or "").strip()
        knyt_handle = (row.get("Knyt Handle") or "").strip()
        meta_nfts = (row.get("metaKnyts NFTs Collected") or "").strip()
        other_nfts = (row.get("No of Other NFTs Collected") or "").strip()
        discord = (row.get("Discord Handle") or "").strip()
        inv_status = (row.get("Investment Status") or "").strip()
        eq_shares = (row.get("Equity Share Count") or "").strip()

        if email not in aggregated:
            parts2 = name_raw.split()
            first = parts2[0] if parts2 else ""
            last = " ".join(parts2[1:]) if len(parts2) > 1 else ""
            aggregated[email] = {
                "email": email,
                "raw_name": name_raw,
                "first_name": first,
                "last_name": last,
                "total_invested": amount,
                "amount_committed": committed,
                "phone": phone,
                "address": address,
                "pub_key": pub_key,
                "knyt_handle": knyt_handle,
                "meta_nfts": meta_nfts,
                "other_nfts": other_nfts,
                "discord": discord,
                "inv_status": inv_status,
                "eq_shares": eq_shares,
                "first_committed_date": date_committed,
                "last_disbursed_date": date_disbursed,
                "transfer_methods": {transfer} if transfer else set(),
                "transaction_count": 1,
            }
        else:
            rec = aggregated[email]
            rec["total_invested"] = max(rec["total_invested"], amount)
            rec["amount_committed"] = max(rec["amount_committed"], committed)
            rec["transaction_count"] += 1
            if phone and is_empty(rec["phone"]):
                rec["phone"] = phone
            if address and is_empty(rec["address"]):
                rec["address"] = address
            if pub_key and is_empty(rec["pub_key"]):
                rec["pub_key"] = pub_key
            if knyt_handle and is_empty(rec["knyt_handle"]):
                rec["knyt_handle"] = knyt_handle
            if meta_nfts and is_empty(rec["meta_nfts"]):
                rec["meta_nfts"] = meta_nfts
            if other_nfts and is_empty(rec["other_nfts"]):
                rec["other_nfts"] = other_nfts
            if discord and is_empty(rec["discord"]):
                rec["discord"] = discord
            if transfer:
                rec["transfer_methods"].add(transfer)
            # Track date range
            if date_committed and (not rec["first_committed_date"] or date_committed < rec["first_committed_date"]):
                rec["first_committed_date"] = date_committed
            if date_disbursed and (not rec["last_disbursed_date"] or date_disbursed > rec["last_disbursed_date"]):
                rec["last_disbursed_date"] = date_disbursed

    # Serialise sets
    for rec in aggregated.values():
        rec["transfer_methods"] = "|".join(sorted(rec["transfer_methods"]))

    return aggregated, issues

# ── diff ─────────────────────────────────────────────────────────────────────

FIELD_MAP = {
    # csv_key: crm_column
    "phone": "Phone-Number",
    "address": "Address",
    "pub_key": "EVM-Public-Key",
    "knyt_handle": "KNYT-ID",
    "discord": "Discord-Handle",
    "total_invested": "Total-Invested",
    "first_name": "First-Name",
    "last_name": "Last-Name",
}

def build_diff(csv_agg: dict, crm_records: list[dict]) -> dict:
    crm_by_email: dict[str, dict] = {}
    for rec in crm_records:
        email = (rec.get("Email") or "").strip().lower()
        if email:
            crm_by_email[email] = rec

    matched: list[dict] = []
    csv_only: list[dict] = []

    enrichment_counts: dict[str, int] = defaultdict(int)
    overwrite_counts: dict[str, int] = defaultdict(int)

    for email, csv_rec in csv_agg.items():
        crm_rec = crm_by_email.get(email)
        if crm_rec is None:
            csv_only.append(csv_rec)
            continue

        ops: list[dict] = []

        for csv_key, crm_col in FIELD_MAP.items():
            csv_val = csv_rec.get(csv_key)
            crm_val = crm_rec.get(crm_col)

            if csv_key == "total_invested":
                csv_amount = float(csv_val or 0)
                crm_amount = parse_amount(crm_val)
                if csv_amount > crm_amount:
                    ops.append({
                        "field": crm_col,
                        "crm": crm_val,
                        "csv": csv_amount,
                        "action": "update_higher" if not is_empty(crm_val) else "fill_empty",
                    })
                    enrichment_counts[crm_col] += 1
            else:
                if not is_empty(csv_val) and is_empty(crm_val):
                    ops.append({
                        "field": crm_col,
                        "crm": crm_val,
                        "csv": csv_val,
                        "action": "fill_empty",
                    })
                    enrichment_counts[crm_col] += 1
                elif not is_empty(csv_val) and not is_empty(crm_val) and str(csv_val).strip() != str(crm_val).strip():
                    ops.append({
                        "field": crm_col,
                        "crm": crm_val,
                        "csv": csv_val,
                        "action": "conflict",
                    })
                    overwrite_counts[crm_col] += 1

        # New columns (csv_* fields)
        new_col_ops: list[dict] = []
        for csv_key, crm_col in [
            ("inv_status", "csv_investment_status"),
            ("first_committed_date", "csv_first_committed_date"),
            ("last_disbursed_date", "csv_last_disbursed_date"),
            ("transfer_methods", "csv_transfer_methods"),
            ("transaction_count", "csv_transaction_count"),
            ("meta_nfts", "csv_metaknyt_nfts"),
            ("other_nfts", "csv_other_nfts"),
        ]:
            csv_val = csv_rec.get(csv_key)
            crm_val = crm_rec.get(crm_col)
            if not is_empty(csv_val) and (is_empty(crm_val) or str(crm_val) == "0"):
                new_col_ops.append({
                    "field": crm_col,
                    "crm": crm_val,
                    "csv": csv_val,
                    "action": "fill_new_col",
                })

        matched.append({
            "email": email,
            "crm_name": f"{crm_rec.get('First-Name','')} {crm_rec.get('Last-Name','')}".strip(),
            "csv_name": csv_rec["raw_name"],
            "ops": ops,
            "new_col_ops": new_col_ops,
        })

    # CRM records not in CSV
    crm_only_emails = [e for e in crm_by_email if e not in csv_agg]

    return {
        "summary": {
            "csv_unique_investors": len(csv_agg),
            "crm_total_records": len(crm_records),
            "matched": len(matched),
            "csv_only": len(csv_only),
            "crm_only": len(crm_only_emails),
        },
        "enrichment_opportunities": dict(enrichment_counts),
        "conflict_fields": dict(overwrite_counts),
        "matched_with_ops": [m for m in matched if m["ops"] or m["new_col_ops"]],
        "csv_only_investors": csv_only,
        "crm_only_emails": crm_only_emails,
    }

# ── main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="Path to investor CSV (TSV)")
    parser.add_argument("--output", default="scripts/data/diff_report.json")
    args = parser.parse_args()

    print("Parsing CSV …")
    csv_agg, issues = aggregate_csv(args.csv)
    print(f"  {len(csv_agg)} unique investors after aggregation")
    print(f"  {len(issues)} data quality issues")

    print("Fetching CRM records …")
    crm_records = fetch_crm_records()
    print(f"  {len(crm_records)} records in {TABLE}")

    print("Building diff …")
    report = build_diff(csv_agg, crm_records)
    report["data_quality_issues"] = issues

    with open(args.output, "w") as f:
        json.dump(report, f, indent=2, default=str)

    s = report["summary"]
    print("\n=== DIFF REPORT ===")
    print(f"CSV unique investors : {s['csv_unique_investors']}")
    print(f"CRM total records    : {s['crm_total_records']}")
    print(f"Matched (both)       : {s['matched']}")
    print(f"CSV only (not in CRM): {s['csv_only']}")
    print(f"CRM only (not in CSV): {s['crm_only']}")
    print()
    print("Enrichment opportunities (fill-empty):")
    for field, count in sorted(report["enrichment_opportunities"].items(), key=lambda x: -x[1]):
        print(f"  {field:30s}: {count}")
    print()
    print("Conflict fields (CSV vs CRM mismatch):")
    for field, count in sorted(report["conflict_fields"].items(), key=lambda x: -x[1]):
        print(f"  {field:30s}: {count}")
    print()
    print(f"Data quality issues: {len(issues)}")
    for iss in issues[:20]:
        print(f"  • {iss}")
    if len(issues) > 20:
        print(f"  … and {len(issues)-20} more (see JSON report)")
    print(f"\nFull report saved to: {args.output}")

if __name__ == "__main__":
    main()
