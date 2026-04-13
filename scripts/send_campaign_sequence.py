#!/usr/bin/env python3
"""
scripts/send_campaign_sequence.py

Dispatch a KNYT Wheel campaign sequence to a cohort via the live dispatch API.
Designed to be invoked by an operator, agent (Marketa), or CI.

Usage:
  python3 scripts/send_campaign_sequence.py \\
    --sequence knyt_top_shelf_v1 \\
    --cohort top_shelf \\
    --channel email_mailjet

  # Preview without sending
  python3 scripts/send_campaign_sequence.py \\
    --sequence knyt_top_shelf_v1 --cohort top_shelf --dry-run

  # Send to specific investor IDs instead of a cohort
  python3 scripts/send_campaign_sequence.py \\
    --sequence knyt_general_v1 --ids id1,id2,id3

Arguments:
  --sequence   Required. One of: knyt_top_shelf_v1 | knyt_zero_v1 |
               knyt_reactivation_v1 | knyt_general_v1
  --cohort     Cohort filter: top_shelf | zero_knyt | reactivation |
               general | all
  --channel    Channel adapter: email_mailjet (default) | email_sendgrid |
               make_com
  --ids        Comma-separated list of nakamoto IDs (bypasses cohort query)
  --dry-run    Print recipients without sending
  --state      Only include investors in this campaign_state
               (default: unsent,sent)
  --limit      Max recipients per run (default: unlimited)
  --app-url    Base URL of the deployed app
               (default: https://dev-beta.aigentz.me)

Env vars (read from .env.local or environment):
  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  MARKETA_WEBHOOK_SECRET
  NEXT_PUBLIC_APP_URL
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

VALID_SEQUENCES = {
    "knyt_top_shelf_v1",
    "knyt_zero_v1",
    "knyt_reactivation_v1",
    "knyt_general_v1",
}

VALID_CHANNELS = {"email_mailjet", "email_sendgrid", "make_com"}

# ── HTTP ──────────────────────────────────────────────────────────────────────

def http_post(url: str, payload: dict, headers: dict | None = None) -> tuple[int, dict | str]:
    data = json.dumps(payload).encode()
    h = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(url, data=data, headers=h, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, raw.decode()
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, body

def supabase_request(path: str) -> tuple[int, list | dict]:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

# ── Recipient query ───────────────────────────────────────────────────────────

def fetch_recipients(cohort: str, states: list[str], limit: int | None) -> list[str]:
    """Returns list of nakamoto IDs matching the cohort/state filter."""
    sb_url  = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    sb_key  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not sb_url or not sb_key:
        sys.exit("ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")

    state_filter = ",".join(f'"{s}"' for s in states)
    qs = f'nakamoto_knyt_personas?select=id,"Email"&campaign_state=in.({state_filter})&"Email"=not.is.null'

    if cohort != "all":
        qs += f"&campaign_cohort=eq.{cohort}"

    if limit:
        qs += f"&limit={limit}"

    status, rows = supabase_request(qs)
    if status != 200 or not isinstance(rows, list):
        sys.exit(f"ERROR: Supabase query failed ({status}): {rows}")

    return [r["id"] for r in rows if r.get("id")]

# ── Dispatch ──────────────────────────────────────────────────────────────────

def dispatch(
    sequence_id: str,
    recipient_ids: list[str],
    channel: str,
    cohort: str,
    app_url: str,
) -> dict:
    secret = os.environ.get("MARKETA_WEBHOOK_SECRET", "")
    url    = f"{app_url}/api/marketa/sequence/dispatch"
    if secret:
        url += f"?secret={secret}"

    payload = {
        "sequenceId":   sequence_id,
        "recipientIds": recipient_ids,
        "channel":      channel,
        "context": {
            "campaignName": "KNYT Wheel",
            "cohort":       cohort,
            "source":       "send_campaign_sequence_script",
        },
    }
    status, body = http_post(url, payload)
    return {"status": status, "body": body}

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Send a KNYT Wheel campaign sequence")
    parser.add_argument("--sequence", required=True, choices=sorted(VALID_SEQUENCES),
                        help="Sequence ID to send")
    parser.add_argument("--cohort",   default="all",
                        help="Cohort filter (top_shelf|zero_knyt|reactivation|general|all)")
    parser.add_argument("--channel",  default="email_mailjet", choices=sorted(VALID_CHANNELS),
                        help="Channel adapter to use (default: email_mailjet)")
    parser.add_argument("--ids",      help="Comma-separated nakamoto IDs (bypasses cohort query)")
    parser.add_argument("--state",    default="unsent,sent",
                        help="Comma-separated campaign_states to include (default: unsent,sent)")
    parser.add_argument("--limit",    type=int, help="Max recipients (default: all)")
    parser.add_argument("--dry-run",  action="store_true", help="Preview only — do not send")
    parser.add_argument("--app-url",  default=os.environ.get("NEXT_PUBLIC_APP_URL", "https://dev-beta.aigentz.me"))
    args = parser.parse_args()

    print(f"\n── KNYT Wheel Sequence Dispatch ─────────────────────────────────────")
    print(f"   sequence : {args.sequence}")
    print(f"   cohort   : {args.cohort}")
    print(f"   channel  : {args.channel}")
    print(f"   app_url  : {args.app_url}")
    if args.dry_run:
        print(f"   mode     : DRY RUN (no emails sent)")
    print()

    # Resolve recipient IDs
    if args.ids:
        recipient_ids = [i.strip() for i in args.ids.split(",") if i.strip()]
        print(f"   Using {len(recipient_ids)} explicit ID(s)")
    else:
        states = [s.strip() for s in args.state.split(",") if s.strip()]
        print(f"   Querying cohort='{args.cohort}' state in {states}…")
        recipient_ids = fetch_recipients(args.cohort, states, args.limit)
        print(f"   Found {len(recipient_ids)} eligible recipients")

    if not recipient_ids:
        print("   Nothing to send — exiting.")
        sys.exit(0)

    if args.dry_run:
        print(f"\n── Dry Run — Recipients (first 20) ──────────────────────────────────")
        for rid in recipient_ids[:20]:
            print(f"   {rid}")
        if len(recipient_ids) > 20:
            print(f"   … and {len(recipient_ids) - 20} more")
        print("\n   Re-run without --dry-run to send.")
        sys.exit(0)

    # Send
    confirm = input(f"\n   Send '{args.sequence}' to {len(recipient_ids)} recipient(s) via {args.channel}? [y/N] ")
    if confirm.strip().lower() != "y":
        print("   Aborted.")
        sys.exit(0)

    print(f"\n   Dispatching…")
    result = dispatch(args.sequence, recipient_ids, args.channel, args.cohort, args.app_url)

    status = result["status"]
    body   = result["body"]

    if status in (200, 202):
        dispatched = body.get("dispatched", len(recipient_ids)) if isinstance(body, dict) else "?"
        errors     = body.get("errors", []) if isinstance(body, dict) else []
        print(f"\n✅ Dispatch succeeded — {dispatched} sent")
        if errors:
            print(f"⚠️  Errors: {errors}")
    else:
        print(f"\n❌ Dispatch failed — HTTP {status}")
        print(f"   {body}")
        sys.exit(1)

    print()


if __name__ == "__main__":
    main()
