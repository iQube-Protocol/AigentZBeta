/**
 * POST /api/crm/contacts/upload
 *
 * Accepts a CSV or JSON file of prospect contacts, deduplicates them
 * against ks_backers_staging and nakamoto_knyt_personas, then inserts
 * new records into ks_backers_staging.
 *
 * Works for any crowdfunding or patronage CRM import — Kickstarter, Indiegogo,
 * Patreon, direct newsletter lists, etc. Use cohort_id and campaign_id to
 * namespace the records for the specific campaign.
 *
 * FormData fields:
 *   file        File     required — CSV or JSON (array of {first_name,last_name,email})
 *   cohort_id   string   required — identifies the contact cohort (e.g. "ks_prospects", "patreon_backers")
 *   campaign_id string   required — identifies the campaign (e.g. "knyt_ks_2026", "knyt_patreon_q1")
 *   source_name string   optional — label for the upload source, stored in seed_source (e.g. "ks_export_apr_2026")
 *   dry_run     string   optional — "true" to preview without writing
 *
 * CSV column names accepted (case-insensitive, with or without spaces):
 *   email / Email / EMAIL
 *   first_name / First Name / firstname / FirstName
 *   last_name  / Last Name  / lastname  / LastName
 *
 * Returns:
 *   { ok, data: { inserted, skipped_staged, duplicate_canonical, unique, failed, dry_run } }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

const BATCH_SIZE = 100;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase credentials not configured");
  return createClient(url, key);
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  const header = splitCSVRow(lines[0]).map((h) =>
    h.trim().toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/firstname/, "first_name")
      .replace(/lastname/, "last_name")
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitCSVRow(line);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => { row[h] = (cols[idx] ?? "").trim(); });
    rows.push(row);
  }
  return rows;
}

function splitCSVRow(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cols.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

// ── Normalise ─────────────────────────────────────────────────────────────────

function sanitize(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).replace(/\u0000/g, "").trim();
  return s || null;
}

function normalizeEmail(email: unknown): string | null {
  const s = sanitize(email);
  return s ? s.toLowerCase() : null;
}

interface RawContact { first_name?: string; last_name?: string; email?: string; [k: string]: unknown }

function toRawContact(row: Record<string, string>): RawContact {
  return {
    first_name: row["first_name"] ?? row["firstname"] ?? "",
    last_name:  row["last_name"]  ?? row["lastname"]  ?? "",
    email:      row["email"]      ?? "",
  };
}

// ── Supabase paged fetch ──────────────────────────────────────────────────────

async function fetchAllEmails(
  supabase: ReturnType<typeof getSupabase>,
  table: string,
  emailColumn: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(`id, ${emailColumn}`)
      .range(offset, offset + limit - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    for (const row of data) {
      const ne = normalizeEmail(row[emailColumn]);
      if (ne) map.set(ne, row.id as string);
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return map;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ ok: false, error: "Expected multipart/form-data" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    const cohortId   = (formData.get("cohort_id")   as string | null)?.trim();
    const campaignId = (formData.get("campaign_id") as string | null)?.trim();
    const sourceName = (formData.get("source_name") as string | null)?.trim() ?? "csv_upload";
    const dryRun     = (formData.get("dry_run") as string | null) === "true";

    if (!cohortId || !campaignId) {
      return NextResponse.json(
        { ok: false, error: "cohort_id and campaign_id are required" },
        { status: 400 }
      );
    }

    const text = await file.text();
    const fileName = file.name.toLowerCase();

    let rawContacts: RawContact[];
    if (fileName.endsWith(".json")) {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON file" }, { status: 400 });
      }
      if (!Array.isArray(parsed)) {
        return NextResponse.json({ ok: false, error: "JSON file must be an array of contact objects" }, { status: 400 });
      }
      rawContacts = parsed as RawContact[];
    } else {
      const csvRows = parseCSV(text);
      if (csvRows.length === 0) {
        return NextResponse.json({ ok: false, error: "CSV file is empty or has no data rows" }, { status: 400 });
      }
      rawContacts = csvRows.map(toRawContact);
    }

    if (rawContacts.length === 0) {
      return NextResponse.json({ ok: false, error: "No contacts found in file" }, { status: 400 });
    }

    const supabase = getSupabase();

    // ── Load existing email sets in parallel ──────────────────────────────────

    const [canonicalMap, stagingMap] = await Promise.all([
      fetchAllEmails(supabase, "nakamoto_knyt_personas", "Email"),
      fetchAllEmails(supabase, "ks_backers_staging", "normalized_email"),
    ]);

    // ── Dedup + classify ──────────────────────────────────────────────────────

    const seen = new Set<string>();
    const toInsert: Record<string, unknown>[] = [];
    let skippedStaged = 0;

    for (const r of rawContacts) {
      const ne = normalizeEmail(r.email);
      if (!ne || seen.has(ne)) continue;
      seen.add(ne);

      if (stagingMap.has(ne)) { skippedStaged++; continue; }

      const canonicalId = canonicalMap.get(ne) ?? null;
      toInsert.push({
        first_name:           sanitize(r.first_name),
        last_name:            sanitize(r.last_name),
        email:                sanitize(r.email),
        normalized_email:     ne,
        cohort_id:            cohortId,
        campaign_id:          campaignId,
        seed_source:          sourceName,
        storage_tier:         "staging",
        canonical_dataset:    false,
        dedup_status:         canonicalId ? "duplicate_canonical" : "unique",
        canonical_persona_id: canonicalId,
        enrichment_status:    canonicalId ? "cross_referenced" : "seed_only",
        suppression_status:   "active",
        engagement_status:    "not_contacted",
        imported_by:          "api/crm/contacts/upload",
      });
    }

    const uniqueCount = toInsert.filter((r) => r.dedup_status === "unique").length;
    const dupCount    = toInsert.filter((r) => r.dedup_status === "duplicate_canonical").length;

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        data: {
          dry_run: true,
          total_in_file: rawContacts.length,
          after_dedup: seen.size,
          to_insert: toInsert.length,
          unique: uniqueCount,
          duplicate_canonical: dupCount,
          skipped_staged: skippedStaged,
          inserted: 0,
          failed: 0,
        },
      });
    }

    // ── Batch insert ──────────────────────────────────────────────────────────

    let inserted = 0;
    let failed = 0;

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("ks_backers_staging").insert(batch);
      if (error) {
        failed += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    // Flag matched canonical records (best-effort — graceful if column absent)
    const canonicalIds = toInsert
      .filter((r) => r.canonical_persona_id)
      .map((r) => r.canonical_persona_id as string);
    if (canonicalIds.length > 0) {
      for (let i = 0; i < canonicalIds.length; i += BATCH_SIZE) {
        await supabase
          .from("nakamoto_knyt_personas")
          .update({ ks_backer: true })
          .in("id", canonicalIds.slice(i, i + BATCH_SIZE))
          .then(() => void 0);
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        dry_run: false,
        total_in_file: rawContacts.length,
        after_dedup: seen.size,
        to_insert: toInsert.length,
        unique: uniqueCount,
        duplicate_canonical: dupCount,
        skipped_staged: skippedStaged,
        inserted,
        failed,
      },
    });
  } catch (err) {
    console.error("[crm/contacts/upload] POST error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
