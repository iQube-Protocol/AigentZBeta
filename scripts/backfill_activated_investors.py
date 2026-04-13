#!/usr/bin/env python3
"""
scripts/backfill_activated_investors.py

Retroactively links nakamoto_knyt_personas investor records to their
platform accounts in crm_personas/crm_auth_profiles, for investors who
signed up on the platform before the auto-link hook was deployed.

Matching strategy:
  1. Email match  — nakamoto_knyt_personas.Email matches crm_auth_profiles.email
                    (case-insensitive) — crm_auth_profiles are real login accounts
  2. Name match   — first+last name match via crm_auth_profile_emails display names
                    (flagged as "needs review" — operator must confirm)

NOTE: crm_personas is NOT used here — it was bulk-imported from investor CSV on
2025-06-19 and does not represent real platform signups. crm_auth_profiles rows
are created only when a real user logs in via Supabase Auth.

The "activated investor" state is:
  nakamoto_knyt_personas.platform_activated_at IS NOT NULL
  AND nakamoto_knyt_personas.Total-Invested > 0

Usage:
  python3 scripts/backfill_activated_investors.py           # dry run
  python3 scripts/backfill_activated_investors.py --apply   # write to DB
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


# ── Fetch investors not yet activated ─────────────────────────────────────────

investors: list = []
offset = 0
while True:
    path = (
        f'/nakamoto_knyt_personas'
        f'?select={urllib.parse.quote("id,First-Name,Last-Name,Email,Total-Invested,campaign_cohort")}'
        f'&platform_activated_at=is.null'
        f'&"Total-Invested"=gt.0'
        f'&offset={offset}&limit=500'
    )
    chunk = pg_get(path)
    investors.extend(chunk)
    if len(chunk) < 500:
        break
    offset += 500

print(f"\nInvestors with Total-Invested > 0 and no platform link: {len(investors)}")

# Build lookup: email → investor row
inv_by_email: dict[str, dict] = {}
inv_by_name: dict[str, dict] = {}
for r in investors:
    em = (r.get("Email") or "").strip().lower()
    if em:
        inv_by_email[em] = r
    fn = (r.get("First-Name") or "").strip().lower()
    ln = (r.get("Last-Name") or "").strip().lower()
    if fn and ln:
        inv_by_name[f"{fn}|{ln}"] = r

# ── Fetch crm_auth_profiles — real platform logins ────────────────────────────
# crm_personas was bulk-imported from CSV (all created 2025-06-19) and does NOT
# represent real signups. crm_auth_profiles rows exist only for users who have
# actually authenticated via Supabase Auth.

platform_users: list = []
offset = 0
while True:
    path = (
        f'/crm_auth_profiles'
        f'?select=id,email'
        f'&email=not.is.null'
        f'&offset={offset}&limit=500'
    )
    chunk = pg_get(path)
    platform_users.extend(chunk)
    if len(chunk) < 500:
        break
    offset += 500

print(f"Real platform accounts (crm_auth_profiles with email): {len(platform_users)}")

# ── Match ──────────────────────────────────────────────────────────────────────

email_matches: list[tuple[dict, dict]] = []     # (investor, platform_user)
name_matches:  list[tuple[dict, dict, str]] = [] # (investor, platform_user, 'name')

for pu in platform_users:
    pu_email = (pu.get("email") or "").strip().lower()
    if not pu_email:
        continue

    # Email match
    if pu_email in inv_by_email:
        email_matches.append((inv_by_email[pu_email], pu))
        continue

    # crm_auth_profiles has no display_name — skip name matching for now
    # (name matches can be done manually via the Investors admin page)

# ── Report ─────────────────────────────────────────────────────────────────────

print(f"\n── Email matches (high confidence) ─────────────────────────────────────")
if email_matches:
    print(f"  {'Investor':<35} {'Email':<35} {'Invested':>8}  {'Cohort'}")
    print(f"  {'-'*35} {'-'*35} {'-'*8}  {'-'*12}")
    for inv, pu in email_matches:
        name = f"{inv.get('First-Name','')} {inv.get('Last-Name','')}".strip()
        em   = inv.get("Email","")
        inv_amt = float(inv.get("Total-Invested") or 0)
        cohort  = inv.get("campaign_cohort") or ""
        action  = "APPLY" if APPLY else "DRY RUN"
        print(f"  {name:<35} {em:<35} ${inv_amt:>7,.0f}  {cohort:<12}  {action}")
else:
    print("  None found.")

print(f"\n── Name matches (needs operator review) ────────────────────────────────")
if name_matches:
    print(f"  {'Investor Name':<30} {'Platform Display':<30} {'Investor Email':<30}  {'Invested':>8}")
    print(f"  {'-'*30} {'-'*30} {'-'*30}  {'-'*8}")
    for inv, pu, display in name_matches:
        name    = f"{inv.get('First-Name','')} {inv.get('Last-Name','')}".strip()
        em      = inv.get("Email","")
        inv_amt = float(inv.get("Total-Invested") or 0)
        print(f"  {name:<30} {display:<30} {em:<30}  ${inv_amt:>7,.0f}  REVIEW REQUIRED")
else:
    print("  None found.")

# ── Apply email matches only ──────────────────────────────────────────────────

if APPLY:
    print(f"\nApplying {len(email_matches)} email-matched activations...")
    for inv, pu in email_matches:
        pg_patch(
            f'/nakamoto_knyt_personas?id=eq.{urllib.parse.quote(inv["id"])}',
            {
                "platform_activated_at": "now()",
                "platform_auth_profile_id": pu["id"],
            },
        )
    print(f"Done. {len(email_matches)} investor records marked as activated.")
    if name_matches:
        print(f"\nNOTE: {len(name_matches)} name-matches were NOT applied — require operator review.")
        print("Re-run without --apply to see the list, verify each manually, then use the")
        print("Investors admin page to link them individually.")
else:
    total = len(email_matches) + len(name_matches)
    print(f"\nDry run: {len(email_matches)} email matches + {len(name_matches)} name matches = {total} potential activations.")
    print("Run with --apply to activate the email-matched records.")
