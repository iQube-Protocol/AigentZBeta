#!/usr/bin/env python3
"""
scripts/preview_campaign_email.py

Sends a single preview of a campaign email template to your inbox,
using real investor data from the first (or last) recipient in the cohort.

Usage:
  python3 scripts/preview_campaign_email.py \
    --sequence knyt_zero_v1 \
    --cohort zero_knyt \
    --to your@email.com

  # Preview using the last investor in the cohort instead of the first:
  python3 scripts/preview_campaign_email.py --sequence knyt_zero_v1 --cohort zero_knyt --last

Also reports:
  - Total zero_knyt count
  - State breakdown (NULL / unsent / sent / backed etc.)
  - How many were excluded from the 143 send
"""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

APP_URL = "https://dev-beta.aigentz.me"

KS_REWARDS = {
    "digital_agn":       {"name": "AgentiQ Graphic Novel — Digital",    "investor": 52,   "full": 78},
    "knyt_codex":        {"name": "KNYT Codex",                          "investor": 112,  "full": 168},
    "knyt_codex_addon":  {"name": "KNYT Codex Add-on",                   "investor": 80,   "full": 120},
    "paperback_agn":     {"name": "AgentiQ Graphic Novel — Paperback",   "investor": 124,  "full": 186},
    "hardcover_agn":     {"name": "AgentiQ Graphic Novel — Hardcover",   "investor": 140,  "full": 210},
    "top_shelf":         {"name": "Top KNYT Shelf",                      "investor": 288,  "full": 388},
    "zero_knyt":         {"name": "Zero KNYT",                           "investor": 500,  "full": 1000},
    "satoshi_collection":{"name": "Satoshi KNYT Collection",             "investor": 2100, "full": None},
}

COHORT_REWARD = {
    "top_shelf":   "top_shelf",
    "zero_knyt":   "zero_knyt",
    "reactivation":"knyt_codex",
}

BAND_REWARD = {
    "5000+":     "satoshi_collection",
    "2000-4999": "satoshi_collection",
    "1000-1999": "zero_knyt",
    "500-999":   "top_shelf",
    "100-499":   "knyt_codex",
    "<100":      "digital_agn",
}

TEMPLATE_ENV = {
    "knyt_top_shelf_v1":    "MAILJET_TEMPLATE_TOP_SHELF",
    "knyt_zero_v1":         "MAILJET_TEMPLATE_ZERO_KNYT",
    "knyt_reactivation_v1": "MAILJET_TEMPLATE_REACTIVATION",
    "knyt_general_v1":      "MAILJET_TEMPLATE_GENERAL",
}

MAILJET_API = "https://api.mailjet.com/v3.1/send"


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

SB_URL  = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SB_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
MJ_KEY  = os.environ.get("MAILJET_API_KEY", "")
MJ_SEC  = os.environ.get("MAILJET_SECRET_KEY", "")
FROM_EM = os.environ.get("MAILJET_FROM_EMAIL", "")
FROM_NM = os.environ.get("MAILJET_FROM_NAME", "Metaiye Media")

for var, val in [("NEXT_PUBLIC_SUPABASE_URL", SB_URL), ("SUPABASE_SERVICE_ROLE_KEY", SB_KEY),
                 ("MAILJET_API_KEY", MJ_KEY), ("MAILJET_SECRET_KEY", MJ_SEC),
                 ("MAILJET_FROM_EMAIL", FROM_EM)]:
    if not val:
        raise SystemExit(f"ERROR: {var} not set in .env.local")

SB_HEADERS = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"}

import argparse
parser = argparse.ArgumentParser()
parser.add_argument("--sequence", required=True, choices=list(TEMPLATE_ENV.keys()))
parser.add_argument("--cohort",   required=True)
parser.add_argument("--to",       default=FROM_EM, help="Preview destination email (default: FROM_EMAIL)")
parser.add_argument("--last",     action="store_true", help="Use last investor instead of first")
args = parser.parse_args()


def pg_get(path: str) -> list:
    req = urllib.request.Request(f"{SB_URL}/rest/v1{path}", headers=SB_HEADERS, method="GET")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Supabase error {e.code}: {e.read().decode()[:400]}")


def basic_auth() -> str:
    import base64
    return "Basic " + base64.b64encode(f"{MJ_KEY}:{MJ_SEC}".encode()).decode()


# ── State breakdown report ─────────────────────────────────────────────────────
print(f"\n── {args.cohort} cohort — state breakdown ───────────────────────────────")

cols = urllib.parse.quote('id,"Email",campaign_state,"Total-Invested"')
all_rows = pg_get(f'/nakamoto_knyt_personas?select={cols}&campaign_cohort=eq.{args.cohort}&limit=1000')

state_counts: dict = {}
no_email = 0
for r in all_rows:
    state = r.get("campaign_state") or "NULL"
    state_counts[state] = state_counts.get(state, 0) + 1
    if not r.get("Email"):
        no_email += 1

print(f"  Total in cohort: {len(all_rows)}")
for state, count in sorted(state_counts.items()):
    flag = "  ← excluded from send" if state not in ("unsent", "sent") else ""
    print(f"    campaign_state={state:<12} {count:>4}{flag}")
if no_email:
    print(f"    no email address:    {no_email:>4}  ← excluded from send")
print()


# ── Fetch sample investor ──────────────────────────────────────────────────────
cols2 = urllib.parse.quote('id,"First-Name","Last-Name","Email",campaign_cohort,investment_amount_band,"Total-Invested"')
sample_rows = pg_get(
    f'/nakamoto_knyt_personas?select={cols2}'
    f'&campaign_cohort=eq.{args.cohort}'
    f'&"Email"=not.is.null'
    f'&order="Total-Invested".desc'
    f'&limit=200'
)

if not sample_rows:
    raise SystemExit("No investors with email found in this cohort.")

investor = sample_rows[-1] if args.last else sample_rows[0]
position = "last" if args.last else "first (highest invested)"

first = (investor.get("First-Name") or "").strip()
last  = (investor.get("Last-Name")  or "").strip()
email = investor.get("Email", "")
cohort = investor.get("campaign_cohort") or args.cohort
band   = investor.get("investment_amount_band") or ""
inv_id = investor.get("id", "")

# Select reward
reward_id = COHORT_REWARD.get(cohort) or BAND_REWARD.get(band, "digital_agn")
reward = KS_REWARDS[reward_id]
ks_url = (
    f"{APP_URL}/api/crm/track/ks"
    f"?uid={urllib.parse.quote(inv_id)}"
    f"&reward={reward_id}"
    f"&utm_source=knyt_wheel&utm_medium=email_preview"
    f"&utm_content={urllib.parse.quote(cohort)}"
)
savings = f"save ${reward['full'] - reward['investor']:,}" if reward["full"] else ""

# Template ID
tmpl_env_key = TEMPLATE_ENV[args.sequence]
tmpl_id_raw  = os.environ.get(tmpl_env_key, "")
if not tmpl_id_raw:
    raise SystemExit(f"ERROR: {tmpl_env_key} not set in .env.local")
tmpl_id = int(tmpl_id_raw)

print(f"── Preview details ──────────────────────────────────────────────────────")
print(f"  Investor ({position}): {first} {last} <{email}>")
print(f"  Invested:  ${float(investor.get('Total-Invested') or 0):,.0f}   band={band}   cohort={cohort}")
print(f"  Reward:    {reward['name']} — ${reward['investor']:,}  ({savings})")
print(f"  Template:  {tmpl_id}  ({args.sequence})")
print(f"  Sending preview to: {args.to}")
print()

# ── Send preview ───────────────────────────────────────────────────────────────
message = {
    "From":    {"Email": FROM_EM, "Name": FROM_NM},
    "To":      [{"Email": args.to, "Name": "Preview Recipient"}],
    "Subject": f"[PREVIEW] {args.sequence} — as sent to {first} {last}",
    "TemplateID": tmpl_id,
    "TemplateLanguage": True,
    "Variables": {
        "first_name":       first or args.to.split("@")[0],
        "full_name":        f"{first} {last}".strip() or email,
        "ks_url":           ks_url,
        "cohort":           cohort,
        "investment_band":  band,
        "sequence_id":      args.sequence,
        "reward_name":      reward["name"],
        "reward_price":     f"${reward['investor']:,}",
        "reward_full_price":f"${reward['full']:,}" if reward["full"] else "",
        "reward_savings":   savings,
    },
    "CustomID": f"preview|{inv_id}|{args.sequence}",
}

data = json.dumps({"Messages": [message]}).encode()
req  = urllib.request.Request(
    MAILJET_API, data=data,
    headers={"Authorization": basic_auth(), "Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    print(f"✅  Preview sent to {args.to}")
    print(f"    Mailjet message ID: {result.get('Messages', [{}])[0].get('To', [{}])[0].get('MessageID', 'n/a')}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    raise SystemExit(f"❌  Mailjet error {e.code}: {body[:400]}")
