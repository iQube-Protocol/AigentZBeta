/**
 * POST /api/mvl/send
 *
 * Sends a comms pack to a list of MVL partners via Mailjet.
 * Updates outreach_status + contact timestamps on successful send.
 *
 * Safe by default — dry_run:true returns a preview without sending.
 *
 * Templates support:
 *   {{partner.first_name}}  — First name extracted from contact_name
 *   {{partner.contact}}     — Full contact name
 *   {{partner.name}}        — Organisation name
 *   {{partner.org}}         — Organisation name (alias)
 *   [link text](url)        — Rendered as <a href="url"> in HTML email
 *
 * Request body:
 *   pack_slug     string    Required. Slug from avl_comms_packs.
 *   partner_ids   string[]  Required. IDs from avl_partner_contacts.
 *   dry_run       boolean   Default: true.
 *   subject_index number    Which subject line variant to use (0|1|2). Default: 0.
 *
 * Response:
 *   { ok, dry_run, sent, skipped, failed, errors, preview? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/app/api/_lib/supabaseServer";

export const dynamic = "force-dynamic";

const MAILJET_API_URL = "https://api.mailjet.com/v3.1/send";
const MAILJET_BATCH   = 50;
const CC_EMAIL        = "dele@metame.com";
const CC_NAME         = "Dele Atanda";
// Same URL used by the KS backer investor emails — driven by env var so it stays in sync
const KS_URL =
  process.env.KICKSTARTER_CAMPAIGN_URL ??
  "https://www.kickstarter.com/projects/430245948/metaknyt-the-legend-of-kn0w1-and-the-21-sats";

function basicAuth() {
  const key    = process.env.MAILJET_API_KEY    ?? "";
  const secret = process.env.MAILJET_SECRET_KEY ?? "";
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? key);
}

function pickSubject(subjectLines: unknown, index: number): string {
  const lines = Array.isArray(subjectLines) ? (subjectLines as string[]) : [];
  return lines[index] ?? lines[0] ?? "(no subject)";
}

function firstNameFrom(contactName: string): string {
  return contactName.split(/\s+/)[0] ?? contactName;
}

// Convert plain text with [text](url) markdown links to a simple HTML email.
function toHtml(text: string): string {
  // Convert markdown links → HTML anchors
  let html = text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color:#4F8C98;text-decoration:underline">$1</a>',
  );
  // Split on double newlines → paragraphs; single newlines → <br>
  const paragraphs = html
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 14px 0;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`);
  return [
    '<!DOCTYPE html><html><body style="font-family:Georgia,serif;font-size:17px;color:#1a1a1a;',
    'max-width:580px;margin:0 auto;padding:32px 24px;background:#fff">',
    paragraphs.join(""),
    "</body></html>",
  ].join("");
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "DB unavailable" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as {
    pack_slug?: string;
    partner_ids?: string[];
    dry_run?: boolean;
    subject_index?: number;
  };

  const { pack_slug, partner_ids, subject_index = 0 } = body;
  const dryRun = body.dry_run !== false;

  if (!pack_slug) return NextResponse.json({ ok: false, error: "pack_slug required" }, { status: 400 });
  if (!partner_ids?.length) return NextResponse.json({ ok: false, error: "partner_ids required" }, { status: 400 });

  // ── Fetch comms pack ────────────────────────────────────────────────────────
  const { data: pack, error: packErr } = await supabase
    .from("avl_comms_packs")
    .select("slug, title, template_markdown, subject_lines, active")
    .eq("slug", pack_slug)
    .single();

  if (packErr || !pack) {
    return NextResponse.json({ ok: false, error: `Pack not found: ${pack_slug}` }, { status: 404 });
  }
  if (!pack.active) {
    return NextResponse.json({ ok: false, error: "Pack is inactive" }, { status: 400 });
  }

  // ── Fetch partners ──────────────────────────────────────────────────────────
  const { data: partners, error: partErr } = await supabase
    .from("avl_partner_contacts")
    .select("id, name, org, contact_email, contact_name, assigned_agent, outreach_status, first_contact_at")
    .in("id", partner_ids);

  if (partErr) {
    return NextResponse.json({ ok: false, error: `Partner fetch failed: ${partErr.message}` }, { status: 500 });
  }

  const rows = (partners ?? []) as Array<{
    id: string;
    name: string;
    org: string;
    contact_email: string | null;
    contact_name: string | null;
    assigned_agent: string;
    outreach_status: string;
    first_contact_at: string | null;
  }>;

  const template   = (pack.template_markdown as string) ?? "";
  const subjectRaw = pickSubject(pack.subject_lines, subject_index);
  const fromEmail  = process.env.MAILJET_FROM_EMAIL ?? "";
  const fromName   = process.env.MAILJET_FROM_NAME  ?? "Dele Atanda";

  const errors: string[] = [];
  let sent    = 0;
  let skipped = 0;
  let failed  = 0;
  const preview: Array<{ partner: string; to: string; subject: string; body: string }> = [];

  // ── Build messages ──────────────────────────────────────────────────────────
  type MjMessage = {
    From:     { Email: string; Name: string };
    To:       [{ Email: string; Name: string }];
    Cc:       [{ Email: string; Name: string }];
    Subject:  string;
    HTMLPart: string;
    TextPart: string;
    CustomID: string;
  };

  const toSend: Array<{ partner: typeof rows[0]; message: MjMessage }> = [];

  for (const p of rows) {
    if (!p.contact_email) {
      skipped++;
      continue;
    }
    const contactName = p.contact_name || "there";
    const firstName   = firstNameFrom(contactName);
    const vars: Record<string, string> = {
      "partner.first_name": firstName,
      "partner.contact":    contactName,
      "partner.name":       p.name,
      "partner.org":        p.org,
      "assigned_agent":     p.assigned_agent,
      "ks_url":             KS_URL,
    };
    const subject  = renderTemplate(subjectRaw, vars);
    const bodyText = renderTemplate(template, vars);
    const bodyHtml = toHtml(bodyText);

    if (dryRun) {
      preview.push({ partner: p.name, to: p.contact_email, subject, body: bodyText });
      continue;
    }

    toSend.push({
      partner: p,
      message: {
        From:    { Email: fromEmail, Name: fromName },
        To:      [{ Email: p.contact_email, Name: contactName }],
        Cc:      [{ Email: CC_EMAIL, Name: CC_NAME }],
        Subject: subject,
        HTMLPart: bodyHtml,
        TextPart: bodyText,
        CustomID: `avl|${p.id}|${pack_slug}`,
      },
    });
  }

  if (dryRun) {
    return NextResponse.json({ ok: true, dry_run: true, sent: 0, skipped, failed: 0, errors, preview });
  }

  // ── Send in batches via Mailjet ─────────────────────────────────────────────
  for (let i = 0; i < toSend.length; i += MAILJET_BATCH) {
    const batch = toSend.slice(i, i + MAILJET_BATCH);
    const res   = await fetch(MAILJET_API_URL, {
      method:  "POST",
      headers: { Authorization: basicAuth(), "Content-Type": "application/json" },
      body:    JSON.stringify({ Messages: batch.map((b) => b.message) }),
    });

    if (res.ok) {
      sent += batch.length;
      const now = new Date().toISOString();
      const ids = batch.map((b) => b.partner.id);

      await supabase
        .from("avl_partner_contacts")
        .update({ outreach_status: "contacted", last_contact_at: now })
        .in("id", ids);

      const firstTimers = batch.filter((b) => !b.partner.first_contact_at).map((b) => b.partner.id);
      if (firstTimers.length > 0) {
        await supabase
          .from("avl_partner_contacts")
          .update({ first_contact_at: now })
          .in("id", firstTimers);
      }
    } else {
      const text = await res.text().catch(() => "");
      errors.push(`Mailjet batch ${i}: HTTP ${res.status} — ${text.slice(0, 200)}`);
      failed += batch.length;
    }
  }

  return NextResponse.json({ ok: true, dry_run: false, sent, skipped, failed, errors });
}
