#!/usr/bin/env python3
"""
scripts/mailjet_create_templates.py

Creates all four KNYT Wheel email templates in Mailjet via the REST API,
then prints the template IDs to add to Amplify env vars.

Usage:
  python3 scripts/mailjet_create_templates.py

Reads credentials from .env.local (MAILJET_API_KEY / MAILJET_SECRET_KEY).
Skips creation of any template whose name already exists (safe to re-run).

After running, add the printed IDs to Amplify:
  MAILJET_TEMPLATE_TOP_SHELF
  MAILJET_TEMPLATE_ZERO_KNYT
  MAILJET_TEMPLATE_REACTIVATION
  MAILJET_TEMPLATE_GENERAL
"""

import argparse
import base64
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

# ── Load env from .env.local ──────────────────────────────────────────────────

def load_dotenv(path: str = ".env.local") -> None:
    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)

load_dotenv()

API_KEY    = os.environ.get("MAILJET_API_KEY", "")
SECRET_KEY = os.environ.get("MAILJET_SECRET_KEY", "")
FROM_NAME  = os.environ.get("MAILJET_FROM_NAME", "KNYT Wheel")

if not API_KEY or not SECRET_KEY:
    sys.exit("ERROR: MAILJET_API_KEY / MAILJET_SECRET_KEY not set in .env.local or environment.")

AUTH = "Basic " + base64.b64encode(f"{API_KEY}:{SECRET_KEY}".encode()).decode()

BASE_URL = "https://api.mailjet.com/v3/REST"

# ── Logo (shared with KS Prospects templates) ─────────────────────────────────
_LOGO_PNG = Path(__file__).parent.parent / "public" / "images" / "metaknyt-logo.png"
_LOGO_JPG = Path(__file__).parent.parent / "public" / "images" / "metaknyt-logo.jpg"

def _encode_logo(path: Path, mime: str) -> str:
    try:
        from PIL import Image
        import io
        img = Image.open(path).convert("RGBA" if mime == "image/png" else "RGB")
        img.thumbnail((560, 400), Image.LANCZOS)
        buf = io.BytesIO()
        if mime == "image/png":
            img.save(buf, format="PNG", optimize=True)
        else:
            img.convert("RGB").save(buf, format="JPEG", quality=85)
        return f"data:{mime};base64,{base64.b64encode(buf.getvalue()).decode()}"
    except ImportError:
        return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"

if _LOGO_PNG.exists():
    LOGO_SRC = _encode_logo(_LOGO_PNG, "image/png")
elif _LOGO_JPG.exists():
    LOGO_SRC = _encode_logo(_LOGO_JPG, "image/jpeg")
else:
    LOGO_SRC = ""

# ── HTTP helpers ──────────────────────────────────────────────────────────────

def mj_post(path: str, payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers={"Authorization": AUTH, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        sys.exit(f"Mailjet API error {e.code} on {path}: {body}")


def mj_get(path: str) -> dict:
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        headers={"Authorization": AUTH},
        method="GET",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

# ── HTML builder ──────────────────────────────────────────────────────────────

def html_template(subject: str, preheader: str, body_html: str, cta_text: str) -> str:
    """Wraps body_html in a clean responsive email shell with investor reward section."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <!-- preheader (hidden) -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{preheader}</span>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:#111111;border-radius:8px;overflow:hidden;">

          <!-- Header logo -->
          <tr>
            <td style="background:#ffffff;padding:20px 32px;border-bottom:1px solid #2a2a2a;text-align:left;">
              {('<img src="' + LOGO_SRC + '" alt="metaKnyt" width="508" style="display:block;border:0;width:100%;max-width:508px;" />') if LOGO_SRC else '<p style="margin:0;color:#f5c842;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">KNYT Wheel · Metaiye Media</p>'}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              {body_html}
            </td>
          </tr>

          <!-- Investor Reward Tier -->
          <tr>
            <td style="padding:0 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#0f0f0f;border:1px solid #f5c842;border-radius:6px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 6px;color:#f5c842;font-size:10px;font-weight:700;
                              letter-spacing:1.5px;text-transform:uppercase;">
                      Your investor-only price
                    </p>
                    <p style="margin:0 0 6px;color:#f0f0f0;font-size:20px;font-weight:700;line-height:1.2;">
                      {{{{var:reward_name}}}} &mdash; {{{{var:reward_price}}}}
                    </p>
                    <p style="margin:0;color:#888888;font-size:13px;">
                      Public price: {{{{var:reward_full_price}}}}
                      &nbsp;&nbsp;|&nbsp;&nbsp;
                      <span style="color:#f5c842;">You {{{{var:reward_savings}}}}</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:0 32px 32px;">
              <a href="{{{{var:ks_url}}}}"
                 style="display:inline-block;background:#f5c842;color:#0a0a0a;font-size:16px;
                        font-weight:700;text-decoration:none;padding:14px 36px;border-radius:4px;
                        letter-spacing:0.5px;">
                {cta_text}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #2a2a2a;">
              <p style="margin:0;color:#666;font-size:12px;line-height:1.6;">
                You are receiving this as a Metaiye Media investor.<br>
                <a href="{{{{var:ks_url}}}}" style="color:#888;text-decoration:underline;">
                  Unsubscribe
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def text_template(greeting: str, body_lines: list[str], cta_text: str) -> str:
    lines = [greeting, ""] + body_lines + ["", f"{cta_text}: {{{{var:ks_url}}}}",
             "", "—", "Metaiye Media · KNYT Wheel"]
    return "\n".join(lines)

# ── Template definitions ──────────────────────────────────────────────────────

TEMPLATES = [
    {
        "env_key":  "MAILJET_TEMPLATE_TOP_SHELF",
        "name":     "KNYT Top Shelf v1",
        "subject":  "It's live now — your investor access starts here",
        "preheader": "Only 21 Top KNYT Shelf slots available across the full investor base.",
        "html_body": """
          <h1 style="margin:0 0 20px;color:#f0f0f0;font-size:26px;font-weight:700;line-height:1.3;">
            Hi {{var:first_name:"there"}},
          </h1>
          <p style="margin:0 0 16px;color:#cccccc;font-size:16px;line-height:1.7;">
            The metaKnyt Kickstarter campaign has now been cleared, which means we can move
            from pre-campaign buildup into real activation.
          </p>
          <p style="margin:0 0 16px;color:#cccccc;font-size:16px;line-height:1.7;">
            If you are a Metaiye Media investor, this is the moment that matters.
          </p>
          <p style="margin:0 0 16px;color:#cccccc;font-size:16px;line-height:1.7;">
            We have created two special investor-only Kickstarter tiers to acknowledge your
            early belief while helping build the momentum this campaign needs right now.
          </p>

          <!-- Tier box -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:#1e1e1e;border:1px solid #f5c842;border-radius:6px;margin:24px 0;">
            <tr>
              <td style="padding:20px 24px;">
                <p style="margin:0 0 8px;color:#f5c842;font-size:13px;font-weight:700;
                           letter-spacing:1.5px;text-transform:uppercase;">
                  Top KNYT Shelf Investor
                </p>
                <p style="margin:0 0 12px;color:#e0e0e0;font-size:15px;line-height:1.6;">
                  Paperback AGN + Digital AGN Upgrade + KNYT Codex<br>
                  <strong style="color:#f5c842;">$288</strong>
                  <span style="color:#888;text-decoration:line-through;margin-left:8px;">$388</span>
                </p>
                <p style="margin:0;color:#999;font-size:13px;">Only 21 available across the full investor base.</p>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 16px;color:#cccccc;font-size:16px;line-height:1.7;">
            The KNYT Codex includes 13 original still digital comics (world debut), 13 canonical
            motioncomics including 8 world-debut versions of Episodes #6–#12, and all assets as iQubes.
          </p>
          <p style="margin:0 0 24px;color:#f0f0f0;font-size:16px;font-weight:600;line-height:1.7;">
            The Kickstarter is the moment to act.
          </p>
        """,
        "cta_text":  "Secure your Top Shelf slot →",
        "text_body": [
            "The metaKnyt Kickstarter campaign is now live.",
            "",
            "As a Metaiye Media investor you have exclusive access to:",
            "",
            "TOP KNYT SHELF INVESTOR",
            "Paperback AGN + Digital AGN Upgrade + KNYT Codex",
            "$288 (was $388) — only 21 available across the full investor base.",
            "",
            "The KNYT Codex includes 13 original still digital comics (world debut),",
            "13 canonical motioncomics, and all assets as iQubes.",
            "",
            "The Kickstarter is the moment to act.",
        ],
    },
    {
        "env_key":  "MAILJET_TEMPLATE_ZERO_KNYT",
        "name":     "KNYT Zero KNYT v1",
        "subject":  "Choose your investor tier before momentum begins",
        "preheader": "Top Shelf or Zero KNYT — only 21 of each available.",
        "html_body": """
          <h1 style="margin:0 0 20px;color:#f0f0f0;font-size:26px;font-weight:700;line-height:1.3;">
            Hi {{var:first_name:"there"}},
          </h1>
          <p style="margin:0 0 16px;color:#cccccc;font-size:16px;line-height:1.7;">
            There are two investor-only Kickstarter tiers, and only <strong style="color:#f5c842;">21 of each</strong>
            are available across the entire investor base.
          </p>

          <!-- Tier comparison -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
            <tr>
              <td width="48%" valign="top"
                  style="background:#1e1e1e;border:1px solid #333;border-radius:6px;padding:20px;">
                <p style="margin:0 0 8px;color:#f5c842;font-size:12px;font-weight:700;
                           letter-spacing:1.5px;text-transform:uppercase;">Top KNYT Shelf</p>
                <p style="margin:0 0 8px;color:#e0e0e0;font-size:14px;line-height:1.6;">
                  Paperback AGN<br>
                  Digital AGN Upgrade<br>
                  KNYT Codex
                </p>
                <p style="margin:0;color:#f5c842;font-size:16px;font-weight:700;">$288</p>
              </td>
              <td width="4%"></td>
              <td width="48%" valign="top"
                  style="background:#1e1e1e;border:1px solid #f5c842;border-radius:6px;padding:20px;">
                <p style="margin:0 0 8px;color:#f5c842;font-size:12px;font-weight:700;
                           letter-spacing:1.5px;text-transform:uppercase;">Zero KNYT</p>
                <p style="margin:0 0 8px;color:#e0e0e0;font-size:14px;line-height:1.6;">
                  Author Signed Hardback AGN<br>
                  Digital AGN<br>
                  KNYT Codex Upgrade<br>
                  Zero KNYT Order access<br>
                  Name in Zero KNYT credits
                </p>
                <p style="margin:0;color:#f5c842;font-size:16px;font-weight:700;">See KS</p>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 16px;color:#cccccc;font-size:16px;line-height:1.7;">
            The KNYT Codex is not duplicate ownership. It includes materially more than most
            legacy investors already own — 13 original still digital comics (world debut),
            8 world-debut motioncomic episodes, all as iQubes.
          </p>
          <p style="margin:0 0 16px;color:#cccccc;font-size:16px;line-height:1.7;">
            Campaign-only shelf advantages are ring-fenced to Kickstarter.
            After the campaign, they are gone.
          </p>
          <p style="margin:0 0 24px;color:#f0f0f0;font-size:16px;font-weight:600;line-height:1.7;">
            21 slots. Both tiers. Act before they fill.
          </p>
        """,
        "cta_text":  "View both investor tiers →",
        "text_body": [
            "There are two investor-only Kickstarter tiers.",
            "Only 21 of each are available across the full investor base.",
            "",
            "TOP KNYT SHELF — $288",
            "Paperback AGN + Digital AGN Upgrade + KNYT Codex",
            "",
            "ZERO KNYT",
            "Author Signed Hardback AGN + Digital AGN + KNYT Codex Upgrade",
            "+ Zero KNYT Order access + name in Zero KNYT credits",
            "",
            "The KNYT Codex is not duplicate ownership —",
            "it includes 13 world-debut still comics and 8 world-debut motioncomic episodes.",
            "",
            "Campaign-only shelf advantages do not continue after Kickstarter.",
        ],
    },
    {
        "env_key":  "MAILJET_TEMPLATE_REACTIVATION",
        "name":     "KNYT Reactivation v1",
        "subject":  "We are live — back metaKnyt now",
        "preheader": "Investor-only tiers are open. Kickstarter-exclusive shelf advantages won't last.",
        "html_body": """
          <h1 style="margin:0 0 20px;color:#f0f0f0;font-size:26px;font-weight:700;line-height:1.3;">
            Hi {{var:first_name:"there"}},
          </h1>
          <p style="margin:0 0 16px;color:#f5c842;font-size:20px;font-weight:700;line-height:1.4;">
            We are live.
          </p>
          <p style="margin:0 0 16px;color:#cccccc;font-size:16px;line-height:1.7;">
            The metaKnyt Kickstarter campaign is now officially open, and your
            investor-only tiers are available right now.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:#1e1e1e;border-left:3px solid #f5c842;margin:24px 0;">
            <tr>
              <td style="padding:16px 20px;">
                <ul style="margin:0;padding:0 0 0 18px;color:#cccccc;font-size:15px;line-height:2;">
                  <li>Investor shelf perks are <strong>Kickstarter-exclusive</strong></li>
                  <li>The KNYT Codex includes major <strong>unreleased</strong> still and motioncomic material</li>
                  <li>Only <strong>21 slots of each tier</strong> across the full investor base</li>
                  <li>The strongest collector and Order-positioning advantages are available <strong>now</strong></li>
                </ul>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 24px;color:#f0f0f0;font-size:16px;line-height:1.7;">
            After the campaign, investor benefits continue. But the campaign-only shelf
            advantages do not. This window closes with the campaign.
          </p>
        """,
        "cta_text":  "Back metaKnyt now →",
        "text_body": [
            "We are live.",
            "",
            "The metaKnyt Kickstarter campaign is now officially open.",
            "Your investor-only tiers are available right now.",
            "",
            "Key points:",
            "- Investor shelf perks are Kickstarter-exclusive",
            "- The KNYT Codex includes major unreleased still and motioncomic material",
            "- Only 21 slots of each tier across the full investor base",
            "- Strongest collector and Order-positioning advantages available now",
            "",
            "After the campaign, investor benefits continue.",
            "But the campaign-only shelf advantages do not.",
        ],
    },
    {
        "env_key":  "MAILJET_TEMPLATE_GENERAL",
        "name":     "KNYT General v1",
        "subject":  "metaKnyt is live on Kickstarter",
        "preheader": "The KNYT Wheel is turning — secure your place now.",
        "html_body": """
          <h1 style="margin:0 0 20px;color:#f0f0f0;font-size:26px;font-weight:700;line-height:1.3;">
            Hi {{var:first_name:"there"}},
          </h1>
          <p style="margin:0 0 16px;color:#cccccc;font-size:16px;line-height:1.7;">
            The metaKnyt Kickstarter campaign is live, and Kickstarter is the moment to act.
          </p>
          <p style="margin:0 0 16px;color:#cccccc;font-size:16px;line-height:1.7;">
            The KNYT Wheel brings together the KNYT Codex, investor tiers, and the Order of Metaiye
            in a single campaign window. What's available now won't be available after.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:#1e1e1e;border-left:3px solid #f5c842;margin:24px 0;">
            <tr>
              <td style="padding:16px 20px;">
                <ul style="margin:0;padding:0 0 0 18px;color:#cccccc;font-size:15px;line-height:2;">
                  <li>The campaign is live and ready</li>
                  <li>Kickstarter is the moment — campaign advantages end with it</li>
                  <li>Only <strong>21 of each investor tier</strong> available</li>
                  <li>The KNYT Codex materially expands what legacy investors own</li>
                </ul>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 24px;color:#f0f0f0;font-size:16px;font-weight:600;line-height:1.7;">
            Your slot is waiting.
          </p>
        """,
        "cta_text":  "Go to Kickstarter →",
        "text_body": [
            "The metaKnyt Kickstarter campaign is live.",
            "",
            "Kickstarter is the moment to act.",
            "",
            "- The campaign is live and ready",
            "- Campaign advantages end when Kickstarter ends",
            "- Only 21 of each investor tier available",
            "- The KNYT Codex materially expands what legacy investors own",
            "",
            "Your slot is waiting.",
        ],
    },
]

# ── Main ──────────────────────────────────────────────────────────────────────

def get_existing_templates() -> dict[str, int]:
    """Returns {name: id} for all templates already in the account."""
    resp = mj_get("/template?OwnerType=apikey&Limit=100")
    return {t["Name"]: t["ID"] for t in resp.get("Data", [])}


def create_template(tpl: dict, existing: dict[str, int]) -> int:
    name = tpl["name"]
    if name in existing:
        print(f"  ↩  '{name}' already exists (ID {existing[name]})")
        return existing[name]

    resp = mj_post("/template", {
        "Author":      FROM_NAME,
        "Description": f"KNYT Wheel — {tpl['subject']}",
        "EditMode":    2,
        "IsStarred":   False,
        "Name":        name,
        "Purposes":    [],
    })
    template_id = resp["Data"][0]["ID"]
    print(f"  ✓  Created '{name}' → ID {template_id}")
    return template_id


def set_content(template_id: int, tpl: dict) -> None:
    html = html_template(
        subject    = tpl["subject"],
        preheader  = tpl["preheader"],
        body_html  = tpl["html_body"],
        cta_text   = tpl["cta_text"],
    )
    text = text_template(
        greeting   = f"Hi {{{{var:first_name:\"there\"}}}},",
        body_lines = tpl["text_body"],
        cta_text   = tpl["cta_text"].rstrip(" →"),
    )
    mj_post(f"/template/{template_id}/detailcontent", {
        "Headers": {"Subject": tpl["subject"], "From": f"{FROM_NAME}"},
        "Html-part": html,
        "Text-part": text,
    })
    print(f"     Content set for ID {template_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description="KNYT Wheel — Mailjet Template Creator")
    parser.add_argument(
        "--update", action="store_true",
        help="Force-update content of existing templates (adds investor reward section)"
    )
    args = parser.parse_args()

    print("\n── KNYT Wheel — Mailjet Template Creator ────────────────────────────")
    print(f"   Account key: {API_KEY[:8]}…")
    if args.update:
        print("   Mode: UPDATE existing templates\n")
    else:
        print("   Mode: CREATE new templates (skip existing)\n")

    existing = get_existing_templates()
    results: list[tuple[str, int]] = []

    for tpl in TEMPLATES:
        print(f"► {tpl['name']}")
        tid = create_template(tpl, existing)
        if args.update or tpl["name"] not in existing:
            set_content(tid, tpl)
        else:
            print(f"     Skipping content update (use --update to refresh)")
        results.append((tpl["env_key"], tid))
        print()

    print("── Amplify env vars to add / update ────────────────────────────────")
    for env_key, tid in results:
        print(f"   {env_key:<38} = {tid}")

    print()
    print("Done. Paste the values above into Amplify → Environment variables,")
    print("then trigger a redeploy.\n")


if __name__ == "__main__":
    main()
