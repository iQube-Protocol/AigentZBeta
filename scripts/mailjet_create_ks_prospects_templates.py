#!/usr/bin/env python3
"""
scripts/mailjet_create_ks_prospects_templates.py

Creates the KS Prospects email sequence templates in Mailjet via the REST API.

Audience: Cold Kickstarter backers who have not yet backed metaKnyt.
Sender:   Marketa (for metaKnyt)
Design:   Editorial / story-first. No investor reward box.

Usage:
  python3 scripts/mailjet_create_ks_prospects_templates.py [--update]

Reads credentials from .env.local (MAILJET_API_KEY / MAILJET_SECRET_KEY).
Skips creation of any template whose name already exists (safe to re-run).

After running, add the printed IDs to Amplify:
  MAILJET_TEMPLATE_KS_PROSPECTS_01
  MAILJET_TEMPLATE_KS_PROSPECTS_02
  MAILJET_TEMPLATE_KS_PROSPECTS_03
  MAILJET_TEMPLATE_KS_PROSPECTS_04
  MAILJET_TEMPLATE_KS_PROSPECTS_05
  MAILJET_TEMPLATE_KS_PROSPECTS_06
  MAILJET_TEMPLATE_KS_PROSPECTS_07
  MAILJET_TEMPLATE_KS_PROSPECTS_08
"""

import argparse
import base64
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

# ── Load env ──────────────────────────────────────────────────────────────────

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
FROM_NAME  = "Dele Atanda"
FROM_EMAIL = os.environ.get("MAILJET_FROM_EMAIL", "dele@metaknyt.com")
KS_URL     = "https://www.kickstarter.com/projects/430245948/metaknyt-the-legend-of-kn0w1-and-the-21-sats?ref=project_build"

# Logo: embed from local file as base64 data URI (no external hosting needed)
# Prefers .png over .jpg
_LOGO_PNG = Path(__file__).parent.parent / "public" / "images" / "metaknyt-logo.png"
_LOGO_JPG = Path(__file__).parent.parent / "public" / "images" / "metaknyt-logo.jpg"
if _LOGO_PNG.exists():
    _logo_b64 = base64.b64encode(_LOGO_PNG.read_bytes()).decode()
    LOGO_SRC  = f"data:image/png;base64,{_logo_b64}"
elif _LOGO_JPG.exists():
    _logo_b64 = base64.b64encode(_LOGO_JPG.read_bytes()).decode()
    LOGO_SRC  = f"data:image/jpeg;base64,{_logo_b64}"
else:
    LOGO_SRC  = os.environ.get("METAKNYT_LOGO_URL", "")

if not API_KEY or not SECRET_KEY:
    sys.exit("ERROR: MAILJET_API_KEY / MAILJET_SECRET_KEY not set in .env.local or environment.")

AUTH     = "Basic " + base64.b64encode(f"{API_KEY}:{SECRET_KEY}".encode()).decode()
BASE_URL = "https://api.mailjet.com/v3/REST"

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

# ── HTML shell — editorial / story-first ──────────────────────────────────────

def html_template(subject: str, preheader: str, body_html: str, cta_text: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{preheader}</span>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="580" cellpadding="0" cellspacing="0" border="0"
               style="max-width:580px;width:100%;background:#111111;border-radius:6px;overflow:hidden;">

          <!-- Header logo -->
          <tr>
            <td style="background:#ffffff;padding:20px 36px;border-bottom:1px solid #1e1e1e;text-align:left;">
              {'<img src="' + LOGO_SRC + '" alt="metaKnyt" width="200" style="display:block;border:0;max-width:200px;" />' if LOGO_SRC else '<p style="margin:0;color:#888888;font-size:11px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;">metaKnyt</p>'}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              {body_html}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 36px 36px;">
              <a href="{{{{var:ks_url}}}}"
                 style="display:inline-block;background:#f5c842;color:#0a0a0a;font-size:15px;
                        font-weight:700;text-decoration:none;padding:13px 32px;border-radius:3px;
                        letter-spacing:0.3px;">
                {cta_text}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 28px;border-top:1px solid #1e1e1e;">
              <p style="margin:0;color:#555555;font-size:12px;line-height:1.7;">
                Marketa &nbsp;·&nbsp; for metaKnyt<br>
                <a href="{{{{var:unsubscribe_url}}}}"
                   style="color:#555555;text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def text_template(body_lines: list[str], cta_text: str) -> str:
    lines = body_lines + [
        "",
        f"{cta_text}: {{{{var:ks_url}}}}",
        "",
        "—",
        "Marketa, for metaKnyt",
        "",
        "Unsubscribe: {{var:unsubscribe_url}}",
    ]
    return "\n".join(lines)

# ── Paragraph helper ──────────────────────────────────────────────────────────

def p(text: str, style: str = "") -> str:
    base = "margin:0 0 18px;color:#cccccc;font-size:16px;line-height:1.8;"
    return f'<p style="{base}{style}">{text}</p>'


def sig() -> str:
    return '<p style="margin:24px 0 0;color:#888888;font-size:14px;line-height:1.6;">Warmly,<br><strong style="color:#cccccc;">Marketa</strong></p>'

# ── Template definitions ──────────────────────────────────────────────────────

TEMPLATES = [
    {
        "env_key":  "MAILJET_TEMPLATE_KS_PROSPECTS_01",
        "name":     "KS Prospects Email 1 — Introduction v1",
        "subject":  "A graphic novel — and something more",
        "preheader": "A prestige graphic novel, a hidden mystery, and a new kind of entry into story.",
        "html_body": (
            p("Hi {{var:first_name:\"there\"}},")
            + p("We wanted to introduce you to <strong style=\"color:#f0f0f0;\">metaKnyt: The Agentic Graphic Novel</strong>.")
            + p("At one level, it is a beautifully crafted graphic novel: a portal war between physical and digital worlds, a hidden Order, and a mystery thread woven through it asking a haunting question:")
            + p("<em style=\"color:#f0f0f0;\">Why did Satoshi disappear?</em>")
            + p("But the deeper ambition is larger than a book alone.")
            + p("We\u2019re building this as the opening into a story world that can keep unfolding \u2014 one where backing doesn\u2019t just put a finished object in your hands, but gives you entry into a richer media experience built to expand over time.")
            + p("So yes, there is a book.<br>But there is also a world behind it.")
            + p("If that sounds like your kind of project, you can explore it on Kickstarter. And if you\u2019d like a better sense of what makes it distinct, keep an eye out for our next note \u2014 we\u2019ll show you how the project is designed and why we made it this way.")
            + sig()
        ),
        "cta_text": "Explore the campaign",
        "text_body": [
            "Hi {{var:first_name:\"there\"}},",
            "",
            "We wanted to introduce you to metaKnyt: The Agentic Graphic Novel.",
            "",
            "At one level, it is a beautifully crafted graphic novel: a portal war between",
            "physical and digital worlds, a hidden Order, and a mystery thread woven through it",
            "asking a haunting question:",
            "",
            "  Why did Satoshi disappear?",
            "",
            "But the deeper ambition is larger than a book alone.",
            "",
            "We're building this as the opening into a story world that can keep unfolding —",
            "one where backing doesn't just put a finished object in your hands, but gives you",
            "entry into a richer media experience built to expand over time.",
            "",
            "So yes, there is a book.",
            "But there is also a world behind it.",
            "",
            "If that sounds like your kind of project, you can explore it on Kickstarter.",
            "",
            "Warmly,",
            "Marketa",
        ],
    },
    {
        "env_key":  "MAILJET_TEMPLATE_KS_PROSPECTS_02",
        "name":     "KS Prospects Email 2 — Interest v1",
        "subject":  "Why we made metaKnyt this way",
        "preheader": "The project was built as a story object with a larger horizon.",
        "html_body": (
            p("Hi {{var:first_name:\"there\"}},")
            + p("We wanted to show you a little more of what makes metaKnyt different.")
            + p("This project was created because we believe stories can do more than end when the last page is turned.")
            + p("<strong style=\"color:#f0f0f0;\">metaKnyt: The Agentic Graphic Novel</strong> is the canonical spine: a complete master volume with its own identity, visual language, and narrative force.")
            + p("But it is also the opening move in something wider.")
            + p("The world of metaKnyts is designed to keep unfolding through its deeper mystery thread \u2014 21 Sats \u2014 and through a broader media framework that lets the story world continue to develop rather than simply stop at publication.")
            + p("That matters because we think audiences increasingly want more than a passive relationship to story. They want to return to it, move through it, interpret it, collect it, and in some cases help shape where it goes next.")
            + p("That is the spirit in which we built this.")
            + sig()
        ),
        "cta_text": "See the project",
        "text_body": [
            "Hi {{var:first_name:\"there\"}},",
            "",
            "We wanted to show you a little more of what makes metaKnyt different.",
            "",
            "This project was created because we believe stories can do more than end",
            "when the last page is turned.",
            "",
            "metaKnyt: The Agentic Graphic Novel is the canonical spine — a complete master",
            "volume with its own identity, visual language, and narrative force.",
            "",
            "But it is also the opening move in something wider.",
            "",
            "The world of metaKnyts is designed to keep unfolding through its deeper mystery",
            "thread — 21 Sats — and through a broader media framework that lets the story world",
            "continue to develop rather than simply stop at publication.",
            "",
            "That matters because we think audiences increasingly want more than a passive",
            "relationship to story. They want to return to it, move through it, interpret it,",
            "collect it, and in some cases help shape where it goes next.",
            "",
            "That is the spirit in which we built this.",
            "",
            "Warmly,",
            "Marketa",
        ],
    },
    {
        "env_key":  "MAILJET_TEMPLATE_KS_PROSPECTS_03",
        "name":     "KS Prospects Email 3 — Craft v1",
        "subject":  "What makes metaKnyt special",
        "preheader": "Craft, story architecture, and a world designed to expand.",
        "html_body": (
            p("Hi {{var:first_name:\"there\"}},")
            + p("A quick note on what makes metaKnyt feel different in practice.")
            + p("We approached this as a collector-first, world-first project. That means a few things:")
            + """<ul style="margin:0 0 18px;padding-left:20px;color:#cccccc;font-size:16px;line-height:2;">
                <li>the book is designed as a premium story object, not disposable content</li>
                <li>the visual world is built with enough depth to reward close attention</li>
                <li>the mystery at the centre of it is meant to linger and expand</li>
                <li>the project is part of a larger evolving story framework, not a one-off release</li>
              </ul>"""
            + p("What you\u2019re backing is not just a single title. You\u2019re helping open a living story environment \u2014 one that begins with a complete Agentic Graphic Novel, but does not have to end there.")
            + p("We think that\u2019s one of the most exciting frontiers in media right now: not \u201ccontent,\u201d but a world you can enter and keep returning to.")
            + sig()
        ),
        "cta_text": "Back the campaign",
        "text_body": [
            "Hi {{var:first_name:\"there\"}},",
            "",
            "A quick note on what makes metaKnyt feel different in practice.",
            "",
            "We approached this as a collector-first, world-first project. That means:",
            "",
            "- the book is designed as a premium story object, not disposable content",
            "- the visual world is built with enough depth to reward close attention",
            "- the mystery at the centre is meant to linger and expand",
            "- the project is part of a larger evolving framework, not a one-off release",
            "",
            "What you're backing is not just a single title.",
            "You're helping open a living story environment — one that begins with a complete",
            "Agentic Graphic Novel, but does not have to end there.",
            "",
            "Warmly,",
            "Marketa",
        ],
    },
    {
        "env_key":  "MAILJET_TEMPLATE_KS_PROSPECTS_04",
        "name":     "KS Prospects Email 4 — Conversion v1",
        "subject":  "If metaKnyt speaks to you, this is the moment",
        "preheader": "If the world, the mystery, and the craft resonate, we'd love your support.",
        "html_body": (
            p("Hi {{var:first_name:\"there\"}},")
            + p("We wanted to ask you directly:")
            + p("<strong style=\"color:#f0f0f0;\">If metaKnyt feels like the kind of story world you want to see exist, this is the moment to back it.</strong>")
            + p("This campaign is the opening activation of the project. Backing now helps do two things at once:")
            + """<ul style="margin:0 0 18px;padding-left:20px;color:#cccccc;font-size:16px;line-height:2;">
                <li>it helps bring metaKnyt: The Agentic Graphic Novel fully into the world</li>
                <li>it helps open the doorway into the larger media experience growing around it</li>
              </ul>"""
            + p("That second part matters to us.")
            + p("We are not thinking about this as a book alone. We are thinking about it as the beginning of a different kind of relationship between story, audience, and world.")
            + p("If you\u2019d like to be part of that beginning, you can support the campaign at the link below.")
            + p("Thank you for taking the time to look closely.")
            + sig()
        ),
        "cta_text": "Support metaKnyt",
        "text_body": [
            "Hi {{var:first_name:\"there\"}},",
            "",
            "We wanted to ask you directly:",
            "",
            "If metaKnyt feels like the kind of story world you want to see exist,",
            "this is the moment to back it.",
            "",
            "Backing now helps do two things at once:",
            "",
            "- it helps bring metaKnyt: The Agentic Graphic Novel fully into the world",
            "- it helps open the doorway into the larger media experience growing around it",
            "",
            "We are not thinking about this as a book alone.",
            "We are thinking about it as the beginning of a different kind of relationship",
            "between story, audience, and world.",
            "",
            "Thank you for taking the time to look closely.",
            "",
            "Warmly,",
            "Marketa",
        ],
    },
    {
        "env_key":  "MAILJET_TEMPLATE_KS_PROSPECTS_05",
        "name":     "KS Prospects Email 5 — Reminder v1",
        "subject":  "In case you meant to come back to this",
        "preheader": "A quiet reminder, and a note on what this project is opening up.",
        "html_body": (
            p("Hi {{var:first_name:\"there\"}},")
            + p("Just a quick note in case you meant to come back to metaKnyt.")
            + p("What we\u2019re building here is not just a campaign object. It\u2019s the opening of a larger story world and media experience \u2014 one designed to keep unfolding beyond the first release.")
            + p("If you\u2019ve been curious, this is a good time to take another look.")
            + p("And if you\u2019ve already backed it \u2014 thank you. That support means more than you know.")
            + sig()
        ),
        "cta_text": "Take another look",
        "text_body": [
            "Hi {{var:first_name:\"there\"}},",
            "",
            "Just a quick note in case you meant to come back to metaKnyt.",
            "",
            "What we're building is not just a campaign object. It's the opening of a larger",
            "story world and media experience — one designed to keep unfolding beyond the",
            "first release.",
            "",
            "If you've been curious, this is a good time to take another look.",
            "",
            "And if you've already backed it — thank you.",
            "",
            "Warmly,",
            "Marketa",
        ],
    },
    {
        "env_key":  "MAILJET_TEMPLATE_KS_PROSPECTS_06",
        "name":     "KS Prospects Email 6 — 48 Hours v1",
        "subject":  "48 hours left",
        "preheader": "The first wave is closing, but the story is only beginning.",
        "html_body": (
            p("Hi {{var:first_name:\"there\"}},")
            + p("We\u2019re in the final 48 hours of the metaKnyt Kickstarter.")
            + p("If you\u2019ve been considering backing it, this is the clearest moment to act.")
            + p("The campaign may be closing soon, but in another sense this is only the beginning. What is ending is the opening window. What continues beyond it is the story world we\u2019re building around it.")
            + p("That\u2019s part of what makes this feel important to us: this is not a finish line, but the threshold.")
            + sig()
        ),
        "cta_text": "Back before it closes",
        "text_body": [
            "Hi {{var:first_name:\"there\"}},",
            "",
            "We're in the final 48 hours of the metaKnyt Kickstarter.",
            "",
            "If you've been considering backing it, this is the clearest moment to act.",
            "",
            "The campaign may be closing soon, but in another sense this is only the beginning.",
            "What is ending is the opening window.",
            "What continues beyond it is the story world we're building around it.",
            "",
            "This is not a finish line, but the threshold.",
            "",
            "Warmly,",
            "Marketa",
        ],
    },
    {
        "env_key":  "MAILJET_TEMPLATE_KS_PROSPECTS_07",
        "name":     "KS Prospects Email 7 — Final Day v1",
        "subject":  "Final hours",
        "preheader": "This is the last call for the opening campaign wave.",
        "html_body": (
            p("Hi {{var:first_name:\"there\"}},")
            + p("This is the final day of the metaKnyt Kickstarter.")
            + p("If you\u2019ve been watching from the edge, this is your last chance to join this opening wave.")
            + p("We\u2019ve built this as something that begins with a book but points beyond it \u2014 toward a deeper, more participatory relationship with story and world.")
            + p("If that idea has been speaking to you, here is the place to act.")
            + p("Thank you again for your attention and time.")
            + sig()
        ),
        "cta_text": "Back now",
        "text_body": [
            "Hi {{var:first_name:\"there\"}},",
            "",
            "This is the final day of the metaKnyt Kickstarter.",
            "",
            "If you've been watching from the edge, this is your last chance to join",
            "this opening wave.",
            "",
            "We've built this as something that begins with a book but points beyond it —",
            "toward a deeper, more participatory relationship with story and world.",
            "",
            "If that idea has been speaking to you, here is the place to act.",
            "",
            "Thank you again for your attention and time.",
            "",
            "Warmly,",
            "Marketa",
        ],
    },
    {
        "env_key":  "MAILJET_TEMPLATE_KS_PROSPECTS_08",
        "name":     "KS Prospects Email 8 — Continuity v1",
        "subject":  "The campaign closed. The world continues.",
        "preheader": "Kickstarter was the opening wave. metaKnyts continues from here.",
        "html_body": (
            p("Hi {{var:first_name:\"there\"}},")
            + p("The Kickstarter campaign has now closed.")
            + p("Thank you \u2014 whether you backed, watched, shared, or simply paid attention.")
            + p("We wanted to leave you with one important thought:")
            + p("<strong style=\"color:#f0f0f0;\">This was never meant to be the end of the project. It was the beginning of it.</strong>")
            + p("The campaign was the opening wave for metaKnyt. What continues from here is the larger story world, the deeper mystery, and the broader media experience growing around it.")
            + p("If you\u2019d like to stay connected to what comes next, here is where to begin.")
            + sig()
        ),
        "cta_text": "Stay connected to metaKnyts",
        "text_body": [
            "Hi {{var:first_name:\"there\"}},",
            "",
            "The Kickstarter campaign has now closed.",
            "",
            "Thank you — whether you backed, watched, shared, or simply paid attention.",
            "",
            "This was never meant to be the end of the project.",
            "It was the beginning of it.",
            "",
            "The campaign was the opening wave for metaKnyt.",
            "What continues from here is the larger story world, the deeper mystery,",
            "and the broader media experience growing around it.",
            "",
            "If you'd like to stay connected to what comes next, here is where to begin.",
            "",
            "Warmly,",
            "Marketa",
        ],
    },
]

# ── Main ──────────────────────────────────────────────────────────────────────

def get_existing_templates() -> dict[str, int]:
    resp = mj_get("/template?OwnerType=apikey&Limit=200")
    return {t["Name"]: t["ID"] for t in resp.get("Data", [])}


def create_template(tpl: dict, existing: dict[str, int]) -> int:
    name = tpl["name"]
    if name in existing:
        print(f"  ↩  '{name}' already exists (ID {existing[name]})")
        return existing[name]
    resp = mj_post("/template", {
        "Author":      FROM_NAME,
        "Description": f"KS Prospects — {tpl['subject']}",
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
        subject   = tpl["subject"],
        preheader = tpl["preheader"],
        body_html = tpl["html_body"],
        cta_text  = tpl["cta_text"],
    )
    text = text_template(
        body_lines = tpl["text_body"],
        cta_text   = tpl["cta_text"],
    )
    mj_post(f"/template/{template_id}/detailcontent", {
        "Headers": {
            "Subject": tpl["subject"],
            "From":    f"{FROM_NAME} <{FROM_EMAIL}>",
        },
        "Html-part":  html,
        "Text-part":  text,
    })
    print(f"     Content set for ID {template_id}")


def send_test(template_id: int, tpl: dict, to_email: str, to_name: str) -> None:
    """Send a single test email via Mailjet Send API v3.1."""
    payload = {
        "Messages": [{
            "From":     {"Email": FROM_EMAIL, "Name": FROM_NAME},
            "To":       [{"Email": to_email, "Name": to_name}],
            "Subject":  f"[TEST] {tpl['subject']}",
            "TemplateID": template_id,
            "TemplateLanguage": True,
            "Variables": {
                "first_name": to_name.split()[0] if to_name else "there",
                "ks_url": KS_URL,
                "unsubscribe_url": "#",
            },
        }]
    }
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(
        "https://api.mailjet.com/v3.1/send",
        data=data,
        headers={"Authorization": AUTH, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
        status = result["Messages"][0]["Status"]
        print(f"  ✉  Test sent to {to_email} — status: {status}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ✗  Send failed: {e.code} — {body}")


def main() -> None:
    parser = argparse.ArgumentParser(description="KS Prospects — Mailjet Template Creator")
    parser.add_argument("--update", action="store_true",
                        help="Force-update content of existing templates")
    parser.add_argument("--email", type=int, choices=range(1, 9), metavar="N",
                        help="Create/update only Email N (1–8)")
    parser.add_argument("--test", metavar="EMAIL",
                        help="Send a test of --email N to this address")
    parser.add_argument("--test-name", metavar="NAME", default="Test",
                        help="Recipient name for test send (default: Test)")
    args = parser.parse_args()

    print("\n── KS Prospects — Mailjet Template Creator ──────────────────────────")
    print(f"   Account key: {API_KEY[:8]}…")
    mode = "UPDATE" if args.update else "CREATE"
    scope = f"Email {args.email} only" if args.email else "all 8 emails"
    print(f"   Mode: {mode} — {scope}\n")

    existing = get_existing_templates()
    results: list[tuple[str, int]] = []

    targets = TEMPLATES
    if args.email:
        targets = [TEMPLATES[args.email - 1]]

    for tpl in targets:
        print(f"► {tpl['name']}")
        tid = create_template(tpl, existing)
        if args.update or tpl["name"] not in existing:
            set_content(tid, tpl)
        else:
            print(f"     Skipping content update (use --update to refresh)")
        if args.test:
            send_test(tid, tpl, args.test, args.test_name)
        results.append((tpl["env_key"], tid))
        print()

    print("── Amplify env vars to add / update ────────────────────────────────")
    for env_key, tid in results:
        print(f"   {env_key:<42} = {tid}")
    print()
    print("Done. Paste the values above into Amplify → Environment variables,")
    print("then trigger a redeploy.\n")


if __name__ == "__main__":
    main()
