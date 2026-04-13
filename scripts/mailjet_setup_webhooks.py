#!/usr/bin/env python3
"""
scripts/mailjet_setup_webhooks.py

Registers (or updates) all required Mailjet Event API webhooks via the REST API.
No manual Mailjet dashboard configuration needed.

Events registered: open, click, bounce, spam, unsub, blocked

Usage:
  python3 scripts/mailjet_setup_webhooks.py

Env vars (from .env.local or environment):
  MAILJET_API_KEY        — Mailjet public API key
  MAILJET_SECRET_KEY     — Mailjet secret API key
  MAILJET_WEBHOOK_SECRET — Shared secret appended as ?secret=... query param
  NEXT_PUBLIC_APP_URL    — Base URL of the deployed app
                           (default: https://dev-beta.aigentz.me)
"""

import base64
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

API_KEY    = os.environ.get("MAILJET_API_KEY", "")
SECRET_KEY = os.environ.get("MAILJET_SECRET_KEY", "")
WH_SECRET  = os.environ.get("MAILJET_WEBHOOK_SECRET", "")
APP_URL    = os.environ.get("NEXT_PUBLIC_APP_URL", "https://dev-beta.aigentz.me").rstrip("/")

if not API_KEY or not SECRET_KEY:
    sys.exit("ERROR: MAILJET_API_KEY / MAILJET_SECRET_KEY not set")

AUTH     = "Basic " + base64.b64encode(f"{API_KEY}:{SECRET_KEY}".encode()).decode()
BASE_URL = "https://api.mailjet.com/v3/REST"

EVENTS = ["open", "click", "bounce", "spam", "unsub", "blocked"]

# ── HTTP ──────────────────────────────────────────────────────────────────────

def mj_request(method: str, path: str, payload: dict | None = None) -> tuple[int, dict]:
    data = json.dumps(payload).encode() if payload else None
    req  = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers={"Authorization": AUTH, "Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"raw": body}

# ── Webhook URL builder ───────────────────────────────────────────────────────

def webhook_url() -> str:
    url = f"{APP_URL}/api/crm/webhooks/mailjet"
    if WH_SECRET:
        url += f"?secret={WH_SECRET}"
    else:
        print("⚠️  MAILJET_WEBHOOK_SECRET not set — webhook will be unauthenticated")
    return url

# ── Register / update ─────────────────────────────────────────────────────────

def get_existing() -> dict[str, int]:
    """Returns {EventType: ID} for all currently registered webhooks."""
    status, body = mj_request("GET", "/eventcallbackurl")
    if status != 200:
        print(f"  ⚠️  Could not list existing webhooks (HTTP {status}) — will create fresh")
        return {}
    return {row["EventType"]: row["ID"] for row in body.get("Data", [])}


def register_event(event: str, url: str, existing: dict[str, int]) -> bool:
    if event in existing:
        wh_id = existing[event]
        status, body = mj_request("PUT", f"/eventcallbackurl/{wh_id}", {
            "EventType":   event,
            "CallbackUrl": url,
            "Status":      "alive",
        })
        ok = status in (200, 201)
        icon = "✅" if ok else "❌"
        print(f"  {icon} {event:8s} — updated  (ID {wh_id})  HTTP {status}")
        return ok
    else:
        status, body = mj_request("POST", "/eventcallbackurl", {
            "EventType":   event,
            "CallbackUrl": url,
            "Status":      "alive",
        })
        ok = status in (200, 201)
        new_id = body.get("Data", [{}])[0].get("ID", "?") if ok else "?"
        icon = "✅" if ok else "❌"
        print(f"  {icon} {event:8s} — created  (ID {new_id})  HTTP {status}")
        if not ok:
            print(f"        {body}")
        return ok

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    url = webhook_url()
    print(f"\n── Mailjet Webhook Setup ────────────────────────────────────────────")
    print(f"   Callback URL : {url}")
    print(f"   Events       : {', '.join(EVENTS)}")
    print()

    existing = get_existing()
    if existing:
        print(f"   {len(existing)} existing webhook(s) found — will update in place\n")
    else:
        print(f"   No existing webhooks — creating fresh\n")

    all_ok = True
    for event in EVENTS:
        ok = register_event(event, url, existing)
        if not ok:
            all_ok = False

    print()
    if all_ok:
        print("✅  All webhooks registered. Mailjet will now POST events to your app.")
        print()
        print("   To verify, open an email from a test send and check:")
        print(f"   https://dev-beta.aigentz.me/api/crm/campaign/metrics")
        print()
        print("   Or watch Mailjet → Event Tracking → Recent events.")
    else:
        print("❌  Some webhooks failed to register. Check errors above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
