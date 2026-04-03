#!/usr/bin/env python3
"""
scripts/generate_crm_diff_sql.py

Reads the investor CSV (TSV) and writes crm_diff.sql — a read-only
diff script you paste into Supabase SQL Editor.

Usage:
  python3 scripts/generate_crm_diff_sql.py \
    --csv path/to/nakamoto_investors.csv \
    --output crm_diff.sql
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from collections import defaultdict
from pathlib import Path


# ── helpers ───────────────────────────────────────────────────────────────────

def esc(s) -> str:
    if s is None or str(s).strip() == "":
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def esc_num(v) -> str:
    try:
        f = float(v)
        return "NULL" if f == 0 else str(round(f, 2))
    except (TypeError, ValueError):
        return "NULL"


def normalize_phone(raw: str) -> str:
    s = str(raw).strip()
    try:
        if "E" in s.upper():
            return str(int(float(s)))
    except (ValueError, OverflowError):
        pass
    return re.sub(r"[^\d+]", "", s)


def clean_name(raw: str) -> str:
    s = re.sub(r"^\S+@\S+\s+", "", str(raw).strip())
    s = re.sub(r"^\w[\w._%+-]*@\w[\w.-]+\.\w+\s*", "", s)
    parts = s.split()
    if len(parts) >= 2 and parts[-1] == parts[-2]:
        parts = parts[:-1]
    return " ".join(parts).strip()


def is_empty(v) -> bool:
    return v is None or str(v).strip() in ("", "null", "None")


def parse_amount(v) -> float:
    if is_empty(v):
        return 0.0
    try:
        return float(re.sub(r"[,$\s]", "", str(v)))
    except ValueError:
        return 0.0


# ── CSV aggregation ───────────────────────────────────────────────────────────

def aggregate_csv(csv_path: str) -> tuple[list[dict], list[str]]:
    issues: list[str] = []
    raw_rows: list[dict] = []

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        # Auto-detect delimiter
        sample = f.read(2048)
        f.seek(0)
        delimiter = "\t" if sample.count("\t") > sample.count(",") else ","
        reader = csv.DictReader(f, delimiter=delimiter)
        for row in reader:
            raw_rows.append(dict(row))

    # Remove exact duplicate rows
    seen: set[str] = set()
    deduped: list[dict] = []
    dup_count = 0
    for row in raw_rows:
        k = json.dumps(row, sort_keys=True)
        if k in seen:
            dup_count += 1
        else:
            seen.add(k)
            deduped.append(row)
    if dup_count:
        issues.append(f"{dup_count} exact-duplicate rows removed")

    aggregated: dict[str, dict] = {}

    for row in deduped:
        name_raw = row.get("Name", "").strip()
        email_raw = row.get("Email", "").strip()

        if not email_raw:
            issues.append(f"Blank email — name: {repr(name_raw)}")
            continue

        email = email_raw.lower()

        if "@" in name_raw:
            cleaned = clean_name(name_raw)
            if cleaned != name_raw:
                issues.append(f"Email-in-name cleaned: {repr(name_raw)} → {repr(cleaned)}")
            name_raw = cleaned

        parts = name_raw.split()
        if len(parts) >= 2 and parts[-1] == parts[-2]:
            issues.append(f"Doubled surname cleaned: {repr(name_raw)}")
            name_raw = " ".join(parts[:-1])

        phone_raw = row.get("Phone No", "").strip()
        if phone_raw and ("E" in phone_raw.upper()):
            issues.append(f"Scientific-notation phone: {repr(phone_raw)} ({name_raw})")
        phone = normalize_phone(phone_raw)

        amount = parse_amount(row.get("Investment Total (including investor fees)", ""))
        address = (row.get("Address") or "").strip()
        pub_key = (row.get("Public Key") or "").strip()
        knyt = (row.get("Knyt Handle") or "").strip()
        meta_nfts = (row.get("metaKnyts NFTs Collected") or "").strip()
        other_nfts = (row.get("No of Other NFTs Collected") or "").strip()
        discord = (row.get("Discord Handle") or "").strip()
        inv_status = (row.get("Investment Status") or "").strip()
        transfer = (row.get("Funds Transfer Method") or "").strip()
        date_committed = (row.get("Date Committed") or "").strip()
        date_disbursed = (row.get("Date Disbursed") or "").strip()

        if email not in aggregated:
            aggregated[email] = {
                "email": email,
                "name": name_raw,
                "phone": phone,
                "address": address,
                "pub_key": pub_key,
                "knyt": knyt,
                "discord": discord,
                "meta_nfts": meta_nfts,
                "other_nfts": other_nfts,
                "total_invested": amount,
                "inv_status": inv_status,
                "transfers": {transfer} if transfer else set(),
                "date_first": date_committed,
                "date_last": date_disbursed,
                "tx_count": 1,
            }
        else:
            r = aggregated[email]
            r["total_invested"] = max(r["total_invested"], amount)
            r["tx_count"] += 1
            for field, val in [("phone", phone), ("address", address), ("pub_key", pub_key),
                                ("knyt", knyt), ("discord", discord),
                                ("meta_nfts", meta_nfts), ("other_nfts", other_nfts)]:
                if val and not r[field]:
                    r[field] = val
            if transfer:
                r["transfers"].add(transfer)
            if date_committed and (not r["date_first"] or date_committed < r["date_first"]):
                r["date_first"] = date_committed
            if date_disbursed and (not r["date_last"] or date_disbursed > r["date_last"]):
                r["date_last"] = date_disbursed

    investors = []
    for r in aggregated.values():
        investors.append({**r, "transfers": "|".join(sorted(r["transfers"]))})

    return investors, issues


# ── SQL generation ────────────────────────────────────────────────────────────

def generate_sql(investors: list[dict]) -> str:
    rows = []
    for r in investors:
        rows.append(
            f"  ({esc(r['email'])}, {esc(r['name'])}, {esc(r['phone'])}, "
            f"{esc(r['address'])}, {esc(r['pub_key'])}, {esc(r['knyt'])}, "
            f"{esc(r['discord'])}, {esc_num(r['total_invested'])}, "
            f"{esc(r['inv_status'])}, {esc(r['date_first'])}, "
            f"{esc(r['date_last'])}, {esc(r['transfers'])}, {r['tx_count']})"
        )

    values_block = ",\n".join(rows)

    return f"""-- =============================================================
-- Nakamoto investor CSV ↔ nakamoto_knyt_personas CRM diff
-- Paste ENTIRE script into Supabase SQL Editor → Run All
-- READ-ONLY — no writes.
-- {len(investors)} unique investors from investor ledger CSV
-- =============================================================

-- Step 1: Load CSV data into a temp table
CREATE TEMP TABLE IF NOT EXISTS _csv_investors (
  email              TEXT,
  csv_name           TEXT,
  csv_phone          TEXT,
  csv_address        TEXT,
  csv_pub_key        TEXT,
  csv_knyt           TEXT,
  csv_discord        TEXT,
  csv_total_invested NUMERIC,
  csv_inv_status     TEXT,
  csv_date_first     TEXT,
  csv_date_last      TEXT,
  csv_transfers      TEXT,
  csv_tx_count       INTEGER
);

INSERT INTO _csv_investors VALUES
{values_block}
;

-- Step 2: TOP-LEVEL SUMMARY
SELECT
  (SELECT COUNT(*) FROM _csv_investors)                         AS csv_unique_investors,
  (SELECT COUNT(*) FROM nakamoto_knyt_personas
    WHERE "Email" IS NOT NULL AND trim("Email") <> '')          AS crm_records_with_email,
  (SELECT COUNT(*) FROM nakamoto_knyt_personas)                 AS crm_total_records,
  (SELECT COUNT(*) FROM _csv_investors c
    INNER JOIN nakamoto_knyt_personas crm
      ON lower(trim(crm."Email")) = c.email)                    AS matched,
  (SELECT COUNT(*) FROM _csv_investors c
    LEFT JOIN nakamoto_knyt_personas crm
      ON lower(trim(crm."Email")) = c.email
    WHERE crm."Email" IS NULL)                                  AS csv_only_not_in_crm,
  (SELECT COUNT(*) FROM nakamoto_knyt_personas crm
    LEFT JOIN _csv_investors c ON lower(trim(crm."Email")) = c.email
    WHERE c.email IS NULL
      AND crm."Email" IS NOT NULL
      AND trim(crm."Email") <> '')                              AS crm_only_not_in_csv
;

-- Step 3: ENRICHMENT OPPORTUNITIES (CRM field empty, CSV has a value)
SELECT
  COUNT(*) FILTER (WHERE (crm."Phone-Number" IS NULL OR trim(crm."Phone-Number"::text) = '')
    AND c.csv_phone IS NOT NULL)                                AS phone_can_fill,
  COUNT(*) FILTER (WHERE (crm."Address" IS NULL OR trim(crm."Address") = '')
    AND c.csv_address IS NOT NULL)                              AS address_can_fill,
  COUNT(*) FILTER (WHERE (crm."EVM-Public-Key" IS NULL OR trim(crm."EVM-Public-Key") = '')
    AND c.csv_pub_key IS NOT NULL)                              AS evm_key_can_fill,
  COUNT(*) FILTER (WHERE (crm."KNYT-ID" IS NULL OR trim(crm."KNYT-ID") = '')
    AND c.csv_knyt IS NOT NULL)                                 AS knyt_id_can_fill,
  COUNT(*) FILTER (WHERE (crm."Discord-Handle" IS NULL OR trim(crm."Discord-Handle") = '')
    AND c.csv_discord IS NOT NULL)                              AS discord_can_fill,
  COUNT(*) FILTER (
    WHERE c.csv_total_invested IS NOT NULL
      AND c.csv_total_invested > COALESCE(crm."Total-Invested"::numeric, 0)
  )                                                             AS total_invested_higher_in_csv,
  COUNT(*) FILTER (WHERE (crm."First-Name" IS NULL OR trim(crm."First-Name") = '')
    AND c.csv_name IS NOT NULL)                                 AS first_name_can_fill,
  COUNT(*) FILTER (WHERE (crm."Last-Name" IS NULL OR trim(crm."Last-Name") = '')
    AND c.csv_name IS NOT NULL)                                 AS last_name_can_fill
FROM _csv_investors c
INNER JOIN nakamoto_knyt_personas crm
  ON lower(trim(crm."Email")) = c.email
;

-- Step 4: INVESTORS IN CSV BUT NOT IN CRM (top 100 by investment)
SELECT
  c.email,
  c.csv_name,
  c.csv_total_invested,
  c.csv_tx_count,
  c.csv_date_first,
  c.csv_phone
FROM _csv_investors c
LEFT JOIN nakamoto_knyt_personas crm
  ON lower(trim(crm."Email")) = c.email
WHERE crm."Email" IS NULL
ORDER BY c.csv_total_invested DESC NULLS LAST
LIMIT 100
;

-- Step 5: CRM RECORDS NOT IN CSV
SELECT
  crm."Email",
  crm."First-Name",
  crm."Last-Name",
  crm."Total-Invested",
  crm."KNYT-ID",
  crm."OM-Tier-Status"
FROM nakamoto_knyt_personas crm
LEFT JOIN _csv_investors c
  ON lower(trim(crm."Email")) = c.email
WHERE c.email IS NULL
  AND crm."Email" IS NOT NULL
  AND trim(crm."Email") <> ''
ORDER BY crm."Last-Name"
;

-- Step 6: CONFLICT CHECK — matched rows where phone or total invested differs
SELECT
  c.email,
  c.csv_name,
  trim(crm."First-Name") || ' ' || trim(COALESCE(crm."Last-Name", ''))  AS crm_name,
  c.csv_phone                                                            AS csv_phone,
  crm."Phone-Number"::text                                               AS crm_phone,
  c.csv_total_invested                                                   AS csv_total,
  crm."Total-Invested"                                                   AS crm_total
FROM _csv_investors c
INNER JOIN nakamoto_knyt_personas crm
  ON lower(trim(crm."Email")) = c.email
WHERE
  (c.csv_phone IS NOT NULL
    AND crm."Phone-Number" IS NOT NULL
    AND regexp_replace(c.csv_phone, '[^0-9]', '', 'g')
      <> regexp_replace(crm."Phone-Number"::text, '[^0-9]', '', 'g'))
  OR
  (c.csv_total_invested IS NOT NULL
    AND crm."Total-Invested" IS NOT NULL
    AND abs(c.csv_total_invested - crm."Total-Invested"::numeric) > 1)
ORDER BY c.email
LIMIT 200
;

-- Cleanup
DROP TABLE IF EXISTS _csv_investors;
"""


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Supabase SQL diff from investor CSV")
    parser.add_argument("--csv", required=True, help="Path to investor TSV/CSV file")
    parser.add_argument("--output", default="crm_diff.sql", help="Output SQL file path")
    args = parser.parse_args()

    print(f"Reading {args.csv} …")
    investors, issues = aggregate_csv(args.csv)
    print(f"  {len(investors)} unique investors")
    if issues:
        print(f"  {len(issues)} data quality issues:")
        for iss in issues[:10]:
            print(f"    • {iss}")
        if len(issues) > 10:
            print(f"    … and {len(issues) - 10} more")

    print(f"Generating SQL …")
    sql = generate_sql(investors)

    out_path = Path(args.output)
    out_path.write_text(sql, encoding="utf-8")
    size_kb = len(sql) / 1024
    print(f"Written: {out_path} ({size_kb:.0f} KB)")
    print(f"\nPaste {out_path} into Supabase SQL Editor → Run All")


if __name__ == "__main__":
    main()
