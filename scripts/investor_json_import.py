#!/usr/bin/env python3
"""
scripts/investor_json_import.py

Import the consolidated investor JSON ledger into nakamoto_knyt_personas.
Uses direct PostgREST HTTP calls — no supabase-py dependency required.

Usage:
  # Dry run — see what will change, no writes
  python3 scripts/investor_json_import.py --json data/investors/consolidated_investors.json

  # Apply enrichment to Supabase
  python3 scripts/investor_json_import.py --json data/investors/consolidated_investors.json --apply

  # Apply + set investment_amount_band from totals
  python3 scripts/investor_json_import.py --json data/investors/consolidated_investors.json --apply --apply-bands

  # Write report to file
  python3 scripts/investor_json_import.py --json data/investors/consolidated_investors.json --apply --output /tmp/import_report.json

Prerequisites:
  pip install requests python-dotenv
  .env.local must contain NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

# ── dotenv ────────────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or ""
)

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set", file=sys.stderr)
    sys.exit(1)

REST_URL = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey":          SUPABASE_KEY,
    "Authorization":   f"Bearer {SUPABASE_KEY}",
    "Content-Type":    "application/json",
    "Prefer":          "return=minimal",
}

PAGE_SIZE  = 1000
BATCH_SIZE = 50


# ── PostgREST helpers ─────────────────────────────────────────────────────────

def pg_get(table: str, params: dict) -> list[dict]:
    resp = requests.get(f"{REST_URL}/{table}", headers={**HEADERS, "Prefer": "count=none"}, params=params)
    resp.raise_for_status()
    return resp.json()


_patch_error_printed = 0

def pg_patch(table: str, row_id: str, payload: dict) -> bool:
    global _patch_error_printed
    resp = requests.patch(
        f"{REST_URL}/{table}",
        headers=HEADERS,
        params={"id": f"eq.{row_id}"},
        data=json.dumps(payload),
    )
    if not resp.ok and _patch_error_printed < 3:
        print(f"\n  PATCH {resp.status_code} — body: {resp.text[:500]}", file=sys.stderr)
        print(f"  payload keys sent: {list(payload.keys())}", file=sys.stderr)
        _patch_error_printed += 1
    return resp.ok


# ── Fetch all CRM rows (paginated) ────────────────────────────────────────────

def fetch_crm_records() -> list[dict]:
    all_records: list[dict] = []
    offset = 0
    while True:
        batch = pg_get("nakamoto_knyt_personas", {
            "select": "*",
            "offset": offset,
            "limit":  PAGE_SIZE,
            "order":  "id.asc",
        })
        all_records.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return all_records


# ── Helpers ───────────────────────────────────────────────────────────────────

def norm_email(e) -> str:
    return (e or "").strip().lower()

def is_empty(val) -> bool:
    if val is None:
        return True
    if isinstance(val, str):
        return val.strip() in {"", "0", "0.0"}
    if isinstance(val, (int, float)):
        return val == 0
    return False

def investment_band(amount: float) -> str:
    if amount >= 5000:  return "5000+"
    if amount >= 2000:  return "2000-4999"
    if amount >= 500:   return "500-1999"
    return "<500"


# ── Build diff ────────────────────────────────────────────────────────────────

def build_diff(investors: list[dict], crm_records: list[dict]) -> dict:
    crm_by_email: dict[str, dict] = {}
    for rec in crm_records:
        email = norm_email(rec.get("Email"))
        if email:
            crm_by_email[email] = rec

    inv_by_email = {norm_email(inv["email"]): inv for inv in investors if inv.get("email")}

    json_emails = set(inv_by_email.keys())
    crm_emails  = set(crm_by_email.keys())
    matched     = json_emails & crm_emails
    json_only   = json_emails - crm_emails
    crm_only    = crm_emails  - json_emails

    enrichment_details: list[dict] = []
    field_opportunities: dict[str, int] = {}

    for email in matched:
        inv = inv_by_email[email]
        crm = crm_by_email[email]
        changes: dict[str, dict] = {}

        def maybe(json_val, crm_key: str):
            if not is_empty(json_val) and is_empty(crm.get(crm_key)):
                changes[crm_key] = {"crm": crm.get(crm_key), "json": json_val}
                field_opportunities[crm_key] = field_opportunities.get(crm_key, 0) + 1

        maybe(inv.get("first_name"),     "First-Name")
        maybe(inv.get("last_name"),      "Last-Name")
        maybe(inv.get("phone"),          "Phone-Number")
        maybe(inv.get("address"),        "Address")
        maybe(inv.get("public_key"),     "EVM-Public-Key")
        maybe(inv.get("knyt_handle"),    "KNYT-ID")
        maybe(inv.get("discord_handle"), "Discord-Handle")

        # Total-Invested: update if JSON is larger or CRM is empty
        json_total = round(float(inv.get("total_amount_committed") or 0), 2)
        crm_total_raw = crm.get("Total-Invested") or ""
        try:
            crm_total = float(str(crm_total_raw).replace(",", "").replace("$", "")) if crm_total_raw else 0.0
        except ValueError:
            crm_total = 0.0
        if json_total > 0 and (is_empty(crm_total_raw) or abs(json_total - crm_total) > 0.01):
            changes["Total-Invested"] = {"crm": crm_total_raw, "json": str(json_total)}
            field_opportunities["Total-Invested"] = field_opportunities.get("Total-Invested", 0) + 1

        # Metaiye-Shares-Owned
        json_shares = int(inv.get("total_equity_shares") or 0)
        crm_shares_raw = crm.get("Metaiye-Shares-Owned") or ""
        try:
            crm_shares = int(float(crm_shares_raw)) if crm_shares_raw else 0
        except ValueError:
            crm_shares = 0
        if json_shares > 0 and (is_empty(crm_shares_raw) or crm_shares != json_shares):
            changes["Metaiye-Shares-Owned"] = {"crm": crm_shares_raw, "json": str(json_shares)}
            field_opportunities["Metaiye-Shares-Owned"] = field_opportunities.get("Metaiye-Shares-Owned", 0) + 1

        # csv_* columns — always populate from JSON
        investments  = inv.get("investments") or []
        statuses     = [t.get("status", "") for t in investments if t.get("status")]
        methods      = sorted({t.get("payment_method", "") for t in investments if t.get("payment_method")})
        dates_c      = sorted([t["date_committed"]  for t in investments if t.get("date_committed")])
        dates_d      = sorted([t["date_disbursed"]  for t in investments if t.get("date_disbursed")])
        status_rank  = {"invested": 2, "committed": 1}
        best_status  = max(statuses, key=lambda s: status_rank.get(s.lower(), 0), default="")

        changes["csv_investment_status"]    = {"crm": None, "json": best_status}
        changes["csv_transaction_count"]    = {"crm": None, "json": inv.get("investment_count", len(investments))}
        changes["csv_first_committed_date"] = {"crm": None, "json": dates_c[0] if dates_c else ""}
        changes["csv_last_disbursed_date"]  = {"crm": None, "json": dates_d[-1] if dates_d else ""}
        changes["csv_transfer_methods"]     = {"crm": None, "json": ",".join(methods)}

        if changes:
            enrichment_details.append({
                "email":   email,
                "crm_id":  crm.get("id"),
                "changes": changes,
            })

    return {
        "summary": {
            "json_unique_investors":      len(json_emails),
            "crm_total_records":          len(crm_records),
            "matched_by_email":           len(matched),
            "crm_records_with_changes":   len(enrichment_details),
            "json_investors_not_in_crm":  len(json_only),
            "crm_records_not_in_json":    len(crm_only),
        },
        "field_enrichment_opportunities": field_opportunities,
        "enrichment_details":             enrichment_details,
        "json_investors_not_in_crm":      sorted(json_only),
    }


# ── Apply ─────────────────────────────────────────────────────────────────────

def apply_enrichment(report: dict) -> dict:
    details = report.get("enrichment_details", [])
    total   = len(details)
    applied = 0
    errors: list[str] = []

    print(f"\n→ Applying {total} record updates…", file=sys.stderr)

    for i, detail in enumerate(details):
        crm_id = detail.get("crm_id")
        if not crm_id:
            continue
        payload = {field: delta["json"] for field, delta in detail["changes"].items()}
        ok = pg_patch("nakamoto_knyt_personas", crm_id, payload)
        if ok:
            applied += 1
        else:
            errors.append(crm_id)

        if (i + 1) % BATCH_SIZE == 0 or (i + 1) == total:
            print(f"  {i + 1}/{total}…", file=sys.stderr, end="\r")

        # small pause every 100 rows to avoid rate limiting
        if (i + 1) % 100 == 0:
            time.sleep(0.3)

    print(f"\n✓ Apply complete: {applied}/{total} rows updated, {len(errors)} errors", file=sys.stderr)
    for e in errors[:10]:
        print(f"  ✗ {e}", file=sys.stderr)

    return {"applied": applied, "total": total, "errors": errors}


def insert_missing(investors: list[dict], json_only_emails: set, inv_by_email: dict) -> dict:
    """
    Insert new nakamoto_knyt_personas rows for investors in the JSON
    who have no CRM record yet (matched by email).
    """
    to_insert = [inv_by_email[e] for e in json_only_emails if e in inv_by_email]
    total   = len(to_insert)
    inserted = 0
    errors: list[str] = []

    print(f"\n→ Inserting {total:,} missing investors into CRM…", file=sys.stderr)

    for i, inv in enumerate(to_insert):
        investments = inv.get("investments") or []
        statuses    = [t.get("status", "") for t in investments if t.get("status")]
        methods     = sorted({t.get("payment_method", "") for t in investments if t.get("payment_method")})
        dates_c     = sorted([t["date_committed"] for t in investments if t.get("date_committed")])
        dates_d     = sorted([t["date_disbursed"]  for t in investments if t.get("date_disbursed")])
        status_rank = {"invested": 2, "committed": 1}
        best_status = max(statuses, key=lambda s: status_rank.get(s.lower(), 0), default="")
        amount      = float(inv.get("total_amount_committed") or 0)

        row = {
            "Email":                  inv.get("email", ""),
            "First-Name":             inv.get("first_name") or "",
            "Last-Name":              inv.get("last_name") or "",
            "Phone-Number":           inv.get("phone") or "",
            "Address":                inv.get("address") or "",
            "EVM-Public-Key":         inv.get("public_key") or "",
            "KNYT-ID":                inv.get("knyt_handle") or "",
            "Discord-Handle":         inv.get("discord_handle") or "",
            "Total-Invested":         str(round(amount, 2)) if amount > 0 else "",
            "Metaiye-Shares-Owned":   str(int(inv.get("total_equity_shares") or 0)),
            "csv_investment_status":  best_status,
            "csv_transaction_count":  inv.get("investment_count", len(investments)),
            "csv_first_committed_date": dates_c[0] if dates_c else "",
            "csv_last_disbursed_date":  dates_d[-1] if dates_d else "",
            "csv_transfer_methods":   ",".join(methods),
            "investment_amount_band": investment_band(amount) if amount > 0 else None,
        }
        # Drop empty-string values for cleanliness (keep falsy only for genuinely empty)
        row = {k: v for k, v in row.items() if v != "" and v is not None}
        # Email is required
        if not row.get("Email"):
            continue

        resp = requests.post(
            f"{REST_URL}/nakamoto_knyt_personas",
            headers={**HEADERS, "Prefer": "return=minimal"},
            data=json.dumps(row),
        )
        if resp.ok:
            inserted += 1
        else:
            errors.append(f"{inv.get('email')}: {resp.status_code} {resp.text[:150]}")
            if len(errors) <= 3:
                print(f"\n  INSERT error {resp.status_code}: {resp.text[:300]}", file=sys.stderr)

        if (i + 1) % 100 == 0 or (i + 1) == total:
            print(f"  {i + 1}/{total}…", file=sys.stderr, end="\r")

        if (i + 1) % 200 == 0:
            time.sleep(0.5)

    print(f"\n✓ Insert complete: {inserted:,}/{total:,} rows created, {len(errors)} errors", file=sys.stderr)
    for e in errors[:10]:
        print(f"  ✗ {e}", file=sys.stderr)

    return {"inserted": inserted, "total": total, "errors": errors}


def apply_investment_bands(investors: list[dict], crm_records: list[dict]) -> dict:
    crm_by_email = {
        norm_email(r.get("Email", "")): r
        for r in crm_records if r.get("Email")
    }
    applied = 0
    for inv in investors:
        email = norm_email(inv.get("email", ""))
        crm   = crm_by_email.get(email)
        if not crm:
            continue
        amount = float(inv.get("total_amount_committed") or 0)
        if amount <= 0:
            continue
        band = investment_band(amount)
        ok = pg_patch("nakamoto_knyt_personas", crm["id"], {"investment_amount_band": band})
        if ok:
            applied += 1

    print(f"✓ Investment bands set: {applied}", file=sys.stderr)
    return {"applied": applied}


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Import consolidated investor JSON into nakamoto_knyt_personas")
    parser.add_argument("--json",           required=True,      help="Path to consolidated investor JSON")
    parser.add_argument("--apply",         action="store_true", help="Write enrichment changes to Supabase (default: dry run)")
    parser.add_argument("--apply-bands",   action="store_true", help="Also set investment_amount_band (requires --apply)")
    parser.add_argument("--insert-missing",action="store_true", help="Insert new CRM rows for investors not yet in DB (requires --apply)")
    parser.add_argument("--output",        default="",         help="Write JSON report to file (default: stdout)")
    args = parser.parse_args()

    if not os.path.exists(args.json):
        print(f"ERROR: JSON file not found: {args.json}", file=sys.stderr)
        sys.exit(1)

    print(f"→ Loading {args.json}…", file=sys.stderr)
    with open(args.json, encoding="utf-8") as f:
        data = json.load(f)

    investors: list[dict] = data.get("investors", [])
    meta = data.get("meta", {})

    print(f"  Investors in JSON:  {len(investors):,}", file=sys.stderr)
    print(f"  Total capital:      ${meta.get('total_capital_committed', 0):,.2f}", file=sys.stderr)
    print(f"  Total shares:       {meta.get('total_equity_shares_issued', 0):,}", file=sys.stderr)

    print("\n→ Fetching CRM records from Supabase…", file=sys.stderr)
    crm_records = fetch_crm_records()
    print(f"  CRM records fetched: {len(crm_records):,}", file=sys.stderr)

    print("\n→ Computing diff…", file=sys.stderr)
    report = build_diff(investors, crm_records)
    report["source_meta"] = meta

    if args.apply:
        apply_result = apply_enrichment(report)
        report["apply_result"] = apply_result
        if args.apply_bands:
            band_result = apply_investment_bands(investors, crm_records)
            report["apply_bands_result"] = band_result
        if args.insert_missing:
            json_only_emails = set(report["json_investors_not_in_crm"])
            inv_by_email = {norm_email(inv["email"]): inv for inv in investors if inv.get("email")}
            insert_result = insert_missing(investors, json_only_emails, inv_by_email)
            report["insert_missing_result"] = insert_result
    elif args.apply_bands or args.insert_missing:
        print("WARNING: --apply-bands and --insert-missing require --apply. Skipping.", file=sys.stderr)

    output_json = json.dumps(report, indent=2, default=str)
    if args.output:
        with open(args.output, "w") as f:
            f.write(output_json)
        print(f"\n✓ Report written to {args.output}", file=sys.stderr)
    else:
        print(output_json)

    s = report["summary"]
    print("\n╔══ IMPORT SUMMARY ════════════════════════════════╗", file=sys.stderr)
    print(f"  JSON unique investors:       {s['json_unique_investors']:>6,}", file=sys.stderr)
    print(f"  CRM total records:           {s['crm_total_records']:>6,}", file=sys.stderr)
    print(f"  Matched by email:            {s['matched_by_email']:>6,}", file=sys.stderr)
    print(f"  Records with changes:        {s['crm_records_with_changes']:>6,}", file=sys.stderr)
    print(f"  In JSON but not in CRM:      {s['json_investors_not_in_crm']:>6,}", file=sys.stderr)
    print(f"  In CRM but not in JSON:      {s['crm_records_not_in_json']:>6,}", file=sys.stderr)
    if "insert_missing_result" in report:
        ins = report["insert_missing_result"]
        print(f"  New rows inserted:           {ins['inserted']:>6,}", file=sys.stderr)
    print("╚══════════════════════════════════════════════════╝", file=sys.stderr)

    if report.get("field_enrichment_opportunities"):
        print("\nField enrichment opportunities:", file=sys.stderr)
        for field, count in sorted(
            report["field_enrichment_opportunities"].items(), key=lambda x: -x[1]
        ):
            print(f"  {field:<30} {count:>5,} records", file=sys.stderr)


if __name__ == "__main__":
    main()
