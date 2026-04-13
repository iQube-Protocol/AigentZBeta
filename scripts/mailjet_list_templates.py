#!/usr/bin/env python3
"""
scripts/mailjet_list_templates.py

Lists all templates in the Mailjet account linked to the configured API key.
Use this to diagnose which account the templates are in and confirm they exist.

Usage:
  python3 scripts/mailjet_list_templates.py
"""

import base64
import json
import os
import urllib.request
import urllib.error
from pathlib import Path


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

API_KEY    = os.environ.get("MAILJET_API_KEY", "")
SECRET_KEY = os.environ.get("MAILJET_SECRET_KEY", "")

if not API_KEY or not SECRET_KEY:
    raise SystemExit("ERROR: MAILJET_API_KEY / MAILJET_SECRET_KEY not set")

AUTH = "Basic " + base64.b64encode(f"{API_KEY}:{SECRET_KEY}".encode()).decode()

def mj_get(path: str) -> dict:
    req = urllib.request.Request(
        f"https://api.mailjet.com/v3/REST{path}",
        headers={"Authorization": AUTH},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Mailjet API error {e.code}: {e.read().decode()[:300]}")

# Show which sender/account this API key belongs to
print("\n── API Key identity ───────────────────────────────────────────────────")
try:
    info = mj_get("/apikey/current")
    key_data = info.get("Data", [{}])[0]
    print(f"  API Key:    {key_data.get('APIKey')}")
    print(f"  Name:       {key_data.get('Name')}")
    print(f"  Is Master:  {key_data.get('IsMaster')}")
    print(f"  User ID:    {key_data.get('UserID')}")
except Exception as e:
    print(f"  Could not fetch key info: {e}")

# List all templates
print("\n── Templates in this account ──────────────────────────────────────────")
result = mj_get("/template?Limit=100")
templates = result.get("Data", [])

if not templates:
    print("  No templates found under this API key.\n")
    print("  → The templates may have been created under a different Mailjet")
    print("    account/sub-account. Check which account your API key belongs to.")
else:
    print(f"  Found {len(templates)} template(s):\n")
    print(f"  {'ID':<12} {'Name':<40} {'EditMode'}")
    print(f"  {'-'*12} {'-'*40} {'-'*10}")
    for t in templates:
        print(f"  {t.get('ID'):<12} {str(t.get('Name','')):<40} {t.get('EditMode','')}")

print()
