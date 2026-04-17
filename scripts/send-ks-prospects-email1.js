#!/usr/bin/env node
/**
 * KS Prospects — Send Email 1
 *
 * Reads all active contacts from ks_backers_staging,
 * sends Email 1 (Introduction) via Mailjet template,
 * and updates engagement_status + last_sent_at in staging.
 *
 * Usage:
 *   node scripts/send-ks-prospects-email1.js [--dry-run]
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   MAILJET_API_KEY, MAILJET_SECRET_KEY
 *   MAILJET_TEMPLATE_KS_PROSPECTS_01
 *   MAILJET_FROM_EMAIL  (default: dele@metaknyt.com)
 */

const fs = require("fs");
const path = require("path");

// ── Load .env.local ────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}

const DRY_RUN     = process.argv.includes("--dry-run");
const BATCH_SIZE  = 50;   // Mailjet bulk send limit per request
const KS_URL      = "https://www.kickstarter.com/projects/430245948/metaknyt-the-legend-of-kn0w1-and-the-21-sats?ref=project_build";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MJ_API_KEY    = process.env.MAILJET_API_KEY;
const MJ_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
const TEMPLATE_ID   = parseInt(process.env.MAILJET_TEMPLATE_KS_PROSPECTS_01 || "0", 10);
const FROM_EMAIL    = process.env.MAILJET_FROM_EMAIL || "dele@metaknyt.com";
const FROM_NAME     = "Dele Atanda";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!MJ_API_KEY || !MJ_SECRET_KEY) {
  console.error("Missing MAILJET_API_KEY or MAILJET_SECRET_KEY");
  process.exit(1);
}
if (!TEMPLATE_ID) {
  console.error("Missing MAILJET_TEMPLATE_KS_PROSPECTS_01 — run mailjet_create_ks_prospects_templates.py first");
  process.exit(1);
}

const MJ_AUTH = "Basic " + Buffer.from(`${MJ_API_KEY}:${MJ_SECRET_KEY}`).toString("base64");

// ── Supabase helper ────────────────────────────────────────────────────────

async function supabaseRequest(urlPath, method = "GET", body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${urlPath}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=minimal" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${urlPath} → ${res.status}: ${text}`);
  }
  if (res.status === 204 || res.status === 201) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Mailjet send helper ────────────────────────────────────────────────────

async function mailjetSend(messages) {
  const res = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      Authorization: MJ_AUTH,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ Messages: messages }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mailjet send → ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Load contacts from ks_backers_staging ──────────────────────────────────

async function loadContacts() {
  console.log("Loading contacts from ks_backers_staging…");
  const contacts = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const rows = await supabaseRequest(
      `/ks_backers_staging?select=id,first_name,email&suppression_status=eq.active&engagement_status=eq.not_contacted&limit=${limit}&offset=${offset}`
    );
    if (!rows || rows.length === 0) break;
    contacts.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }
  console.log(`  Loaded ${contacts.length} eligible contacts.`);
  return contacts;
}

// ── Mark sent in staging ───────────────────────────────────────────────────

async function markSent(ids) {
  const idList = ids.map((id) => `"${id}"`).join(",");
  await supabaseRequest(
    `/ks_backers_staging?id=in.(${idList})`,
    "PATCH",
    { engagement_status: "sent", last_sent_at: new Date().toISOString() }
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`KS Prospects — Send Email 1${DRY_RUN ? " [DRY RUN]" : ""}`);
  console.log(`Template ID: ${TEMPLATE_ID}`);
  console.log(`From: ${FROM_NAME} <${FROM_EMAIL}>`);
  console.log("─".repeat(50));

  const contacts = await loadContacts();
  if (contacts.length === 0) {
    console.log("No eligible contacts. Done.");
    return;
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would send to ${contacts.length} contacts.`);
    console.log("Sample:", contacts.slice(0, 3).map((c) => `${c.first_name || "?"} <${c.email}>`));
    return;
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);

    const messages = batch.map((c) => ({
      From:     { Email: FROM_EMAIL, Name: FROM_NAME },
      To:       [{ Email: c.email, Name: c.first_name || "" }],
      TemplateID: TEMPLATE_ID,
      TemplateLanguage: true,
      Variables: {
        first_name:       c.first_name || "there",
        ks_url:           KS_URL,
        unsubscribe_url:  `${SUPABASE_URL}/rest/v1/rpc/unsubscribe?email=${encodeURIComponent(c.email)}`,
      },
    }));

    try {
      const result = await mailjetSend(messages);
      const batchSent  = result.Messages.filter((m) => m.Status === "success").length;
      const batchFailed = result.Messages.filter((m) => m.Status !== "success").length;

      if (batchFailed > 0) {
        const failures = result.Messages.filter((m) => m.Status !== "success");
        console.error(`  Batch ${i}–${i + batch.length}: ${batchFailed} failed:`,
          failures.map((m) => m.Errors).flat().map((e) => e?.ErrorMessage).join(", "));
      }

      // Mark sent contacts in staging
      const sentIds = batch
        .filter((_, idx) => result.Messages[idx]?.Status === "success")
        .map((c) => c.id);
      if (sentIds.length > 0) await markSent(sentIds);

      sent += batchSent;
      failed += batchFailed;
      process.stdout.write(`\r  Sent ${sent}/${contacts.length}…`);
    } catch (err) {
      console.error(`\n  Batch ${i}–${i + batch.length} failed: ${err.message}`);
      failed += batch.length;
    }

    // Respect Mailjet rate limit (200 req/min)
    if (i + BATCH_SIZE < contacts.length) {
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  console.log(`\n\nDone: ${sent} sent, ${failed} failed.`);
  console.log("engagement_status updated to 'sent' for delivered contacts.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
