/**
 * POST /api/skills/crm/import
 *
 * AgentiQ Platform Native Skill — CRM Import
 *
 * Accepts a batch of CRM records (typically parsed from a CSV client-side)
 * and prepares them for the KNYT experience matrix by importing into the
 * canonical `nakamoto_knyt_personas` table.
 *
 * Pipeline:
 *   1. Validate each record (email or name required)
 *   2. Map source columns → canonical schema (auto-detects common headers)
 *   3. Detect duplicates by normalised email
 *   4. Apply on_duplicate strategy: skip | merge | overwrite
 *   5. Optionally chain matrix-prep to assign bands, cohorts, and y-stage
 *
 * Safe by default — dry_run:true returns a preview without any writes.
 *
 * Request body:
 *   dry_run              boolean  Default: true. Set false to apply.
 *   records              array    Required. Array of record objects to import.
 *   column_map           object   Optional. Map source→canonical column names.
 *   on_duplicate         string   "skip" | "merge" | "overwrite". Default: "skip".
 *   default_cohort       string   Optional. Fallback campaign_cohort for new records.
 *   default_source_tag   string   Optional. Tag for campaign_tags (default: "crm_import").
 *   chain_matrix_prep    boolean  Default: true. Run crm-matrix-prep after import.
 *   experience_matrix_id string   Default: "knyt-experience-matrix".
 *
 * Response:
 *   {
 *     dry_run: boolean,
 *     experience_matrix_id: string,
 *     total_records: number,
 *     inserted: number,
 *     updated: number,
 *     skipped: number,
 *     invalid: number,
 *     inserted_would: number,      // dry_run preview
 *     updated_would: number,
 *     sample_inserts: [{ email, name, band? }],
 *     sample_updates: [{ id, email, fields_changed }],
 *     errors: [{ row, reason }],
 *     matrix_prep?: { ... pass-through result from chained skill }
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCrmClient } from "@/services/crm/crmDataAccess";

export const dynamic = "force-dynamic";

// Canonical columns on nakamoto_knyt_personas that the skill writes to.
// (Hyphenated ones match the legacy schema; the rest are snake_case additions.)
const CANONICAL_COLS = [
  "First-Name", "Last-Name", "Email", "KNYT-ID",
  "Profession", "Local-City", "Age", "Phone-Number",
  "Twitter-Handle", "Telegram-Handle", "Discord-Handle",
  "Instagram-Handle", "LinkedIn-ID", "LinkedIn-Profile-URL",
  "OM-Tier-Status", "Total-Invested", "Metaiye-Shares-Owned", "KNYT-COYN-Owned",
  "Motion-Comics-Owned", "Paper-Comics-Owned", "Digital-Comics-Owned",
  "KNYT-Posters-Owned", "KNYT-Cards-Owned", "Characters-Owned",
  "EVM-Public-Key", "BTC-Public-Key",
  "campaign_cohort", "campaign_state", "campaign_notes",
  "investment_amount_band", "preferred_channel_primary",
  "matrix_y_stage",
];

// Default header normalisation: "First Name" | "first_name" | "firstname" → "First-Name"
const HEADER_ALIASES: Record<string, string> = {
  "first name": "First-Name", "firstname": "First-Name", "first_name": "First-Name", "fname": "First-Name",
  "last name":  "Last-Name",  "lastname":  "Last-Name",  "last_name":  "Last-Name",  "lname": "Last-Name",  "surname": "Last-Name",
  "email":      "Email",      "email_address": "Email",  "e-mail": "Email",
  "name":       "__name__",   // special: split into first/last
  "full name":  "__name__",
  "full_name":  "__name__",
  "knyt id":    "KNYT-ID",    "knyt_id":   "KNYT-ID",    "knytid": "KNYT-ID",
  "profession": "Profession", "role":      "Profession", "job_title": "Profession",
  "city":       "Local-City", "local_city": "Local-City", "local city": "Local-City",
  "age":        "Age",
  "phone":      "Phone-Number", "phone number": "Phone-Number", "phone_number": "Phone-Number", "mobile": "Phone-Number",
  "twitter":    "Twitter-Handle",  "twitter handle": "Twitter-Handle",
  "telegram":   "Telegram-Handle", "telegram handle": "Telegram-Handle",
  "discord":    "Discord-Handle",
  "instagram":  "Instagram-Handle",
  "linkedin":   "LinkedIn-ID",     "linkedin id": "LinkedIn-ID",
  "linkedin url": "LinkedIn-Profile-URL", "linkedin_profile_url": "LinkedIn-Profile-URL",
  "tier":            "OM-Tier-Status",  "om_tier":   "OM-Tier-Status", "om tier": "OM-Tier-Status", "om_tier_status": "OM-Tier-Status",
  "total invested":  "Total-Invested",  "invested":  "Total-Invested", "amount": "Total-Invested", "total_invested": "Total-Invested",
  "shares":          "Metaiye-Shares-Owned", "metaiye shares": "Metaiye-Shares-Owned",
  "coyn":            "KNYT-COYN-Owned", "knyt coyn": "KNYT-COYN-Owned", "knyt_coyn": "KNYT-COYN-Owned",
  "evm":             "EVM-Public-Key",  "evm wallet": "EVM-Public-Key", "evm_wallet": "EVM-Public-Key",
  "btc":             "BTC-Public-Key",  "btc wallet": "BTC-Public-Key",
  "cohort":          "campaign_cohort",
  "campaign state":  "campaign_state",
  "channel":         "preferred_channel_primary",
};

function normaliseHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapRow(row: Record<string, unknown>, columnMap: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [srcKey, srcVal] of Object.entries(row)) {
    if (srcVal === null || srcVal === undefined || srcVal === "") continue;

    const key = normaliseHeader(srcKey);
    // 1. User-supplied column map wins
    let target = columnMap[srcKey] ?? columnMap[key];
    // 2. Canonical passthrough (exact column name already)
    if (!target && CANONICAL_COLS.includes(srcKey)) target = srcKey;
    // 3. Alias table
    if (!target) target = HEADER_ALIASES[key];
    if (!target) continue;

    if (target === "__name__") {
      const full = str(srcVal);
      const parts = full.split(/\s+/);
      if (parts.length >= 2) {
        out["First-Name"] = out["First-Name"] ?? parts[0];
        out["Last-Name"]  = out["Last-Name"]  ?? parts.slice(1).join(" ");
      } else if (parts.length === 1 && parts[0]) {
        out["First-Name"] = out["First-Name"] ?? parts[0];
      }
      continue;
    }

    out[target] = srcVal;
  }
  return out;
}

function isValid(mapped: Record<string, unknown>): { ok: boolean; reason?: string } {
  const hasName  = !!(str(mapped["First-Name"]) || str(mapped["Last-Name"]));
  const hasEmail = !!str(mapped["Email"]);
  if (!hasName && !hasEmail) return { ok: false, reason: "no name or email" };
  return { ok: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun            = body.dry_run !== false;                         // default true
    const records           = Array.isArray(body.records) ? body.records : [];
    const columnMap         = (body.column_map ?? {}) as Record<string, string>;
    const onDuplicate       = (body.on_duplicate ?? "skip") as "skip" | "merge" | "overwrite";
    const defaultCohort     = typeof body.default_cohort === "string" ? body.default_cohort : null;
    const defaultSourceTag  = typeof body.default_source_tag === "string" ? body.default_source_tag : "crm_import";
    const chainMatrixPrep   = body.chain_matrix_prep !== false;               // default true
    const experienceMatrixId = typeof body.experience_matrix_id === "string"
      ? body.experience_matrix_id
      : "knyt-experience-matrix";

    if (records.length === 0) {
      return NextResponse.json(
        { error: "records array is required and must not be empty" },
        { status: 400 }
      );
    }

    const errors: Array<{ row: number; reason: string }> = [];
    const mapped: Array<{ row: number; payload: Record<string, unknown>; emailKey: string }> = [];

    // ── 1. Map + validate each row ────────────────────────────────────────────
    records.forEach((raw: unknown, idx: number) => {
      if (!raw || typeof raw !== "object") {
        errors.push({ row: idx, reason: "not an object" });
        return;
      }
      const payload = mapRow(raw as Record<string, unknown>, columnMap);
      const v = isValid(payload);
      if (!v.ok) {
        errors.push({ row: idx, reason: v.reason ?? "invalid" });
        return;
      }
      const emailKey = normaliseEmail(str(payload["Email"]));
      mapped.push({ row: idx, payload, emailKey });
    });

    const client = getCrmClient();

    // ── 2. Look up existing rows by email ─────────────────────────────────────
    const emailsToCheck = mapped.map((m) => m.emailKey).filter((e) => e);
    const existingByEmail = new Map<string, Record<string, unknown>>();

    if (emailsToCheck.length > 0) {
      // Chunk into batches of 500 emails to respect query size limits
      const CHUNK = 500;
      for (let i = 0; i < emailsToCheck.length; i += CHUNK) {
        const batch = emailsToCheck.slice(i, i + CHUNK);
        const { data, error } = await client
          .from("nakamoto_knyt_personas")
          .select("*")
          .in("Email", batch);
        if (error) {
          return NextResponse.json({ error: `Lookup failed: ${error.message}` }, { status: 500 });
        }
        (data ?? []).forEach((r) => {
          const e = normaliseEmail(str((r as Record<string, unknown>)["Email"]));
          if (e) existingByEmail.set(e, r as Record<string, unknown>);
        });
      }
    }

    // ── 3. Plan inserts and updates ───────────────────────────────────────────
    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: Array<{ id: string; fields: Record<string, unknown>; changed: string[] }> = [];
    let skipped = 0;

    for (const m of mapped) {
      const existing = m.emailKey ? existingByEmail.get(m.emailKey) : undefined;

      // Enrich with defaults for new inserts
      const enriched = { ...m.payload };
      if (!existing) {
        if (defaultCohort && !enriched.campaign_cohort) enriched.campaign_cohort = defaultCohort;
        if (!enriched.campaign_state) enriched.campaign_state = "unsent";
        enriched.campaign_tags = [defaultSourceTag];
      }

      if (!existing) {
        toInsert.push(enriched);
        continue;
      }

      if (onDuplicate === "skip") {
        skipped++;
        continue;
      }

      // merge = only fill fields that are currently null/empty; overwrite = replace every provided field
      const updateFields: Record<string, unknown> = {};
      const changed: string[] = [];
      for (const [k, v] of Object.entries(m.payload)) {
        if (v === null || v === undefined || v === "") continue;
        const current = existing[k];
        if (onDuplicate === "merge") {
          if (current === null || current === undefined || current === "") {
            updateFields[k] = v;
            changed.push(k);
          }
        } else {
          // overwrite
          if (current !== v) {
            updateFields[k] = v;
            changed.push(k);
          }
        }
      }
      if (changed.length === 0) {
        skipped++;
        continue;
      }
      toUpdate.push({ id: str(existing["id"]), fields: updateFields, changed });
    }

    // ── 4. Apply (or preview) ─────────────────────────────────────────────────
    let inserted = 0;
    let updated = 0;

    if (!dryRun) {
      if (toInsert.length > 0) {
        const BATCH = 500;
        for (let i = 0; i < toInsert.length; i += BATCH) {
          const batch = toInsert.slice(i, i + BATCH);
          const { error } = await client.from("nakamoto_knyt_personas").insert(batch);
          if (error) {
            errors.push({ row: -1, reason: `Insert batch ${i}: ${error.message}` });
          } else {
            inserted += batch.length;
          }
        }
      }
      for (const u of toUpdate) {
        const { error } = await client
          .from("nakamoto_knyt_personas")
          .update(u.fields)
          .eq("id", u.id);
        if (error) {
          errors.push({ row: -1, reason: `Update ${u.id}: ${error.message}` });
        } else {
          updated++;
        }
      }
    }

    // ── 5. Optionally chain matrix-prep to assign bands/cohorts/y-stage ──────
    let matrixPrep: unknown = null;
    if (chainMatrixPrep && !dryRun && (inserted > 0 || updated > 0)) {
      try {
        const origin = new URL(request.url).origin;
        const res = await fetch(`${origin}/api/skills/crm/matrix-prep`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dry_run: false,
            assign_bands: true,
            assign_cohorts: true,
            compute_y_stage: true,
          }),
        });
        matrixPrep = await res.json().catch(() => null);
      } catch (err) {
        errors.push({ row: -1, reason: `matrix-prep chain failed: ${(err as Error).message}` });
      }
    }

    return NextResponse.json({
      dry_run:              dryRun,
      experience_matrix_id: experienceMatrixId,
      on_duplicate:         onDuplicate,
      total_records:        records.length,
      valid_records:        mapped.length,
      invalid:              errors.filter((e) => e.row >= 0).length,
      inserted:             dryRun ? 0 : inserted,
      updated:              dryRun ? 0 : updated,
      inserted_would:       toInsert.length,
      updated_would:        toUpdate.length,
      skipped,
      sample_inserts: toInsert.slice(0, 5).map((r) => ({
        email: str(r["Email"]),
        name:  `${str(r["First-Name"])} ${str(r["Last-Name"])}`.trim(),
        cohort: r.campaign_cohort ?? null,
      })),
      sample_updates: toUpdate.slice(0, 5).map((u) => ({
        id:             u.id,
        fields_changed: u.changed,
      })),
      errors,
      matrix_prep: matrixPrep,
    });
  } catch (err) {
    console.error("[skills/crm/import] error:", err);
    return NextResponse.json(
      { error: `Import failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
