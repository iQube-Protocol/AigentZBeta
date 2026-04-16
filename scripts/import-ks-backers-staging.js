#!/usr/bin/env node
/**
 * KS Backers Phase-1 Staging Import
 *
 * Reads the 7-part seed cohort from data/knyt/cohorts/staging/,
 * cross-references against canonical CRM tables by normalized email,
 * and inserts into ks_backers_staging (non-canonical, quarantined).
 *
 * Cross-reference results:
 *   unique              → new staging row, dedup_status=unique
 *   duplicate_canonical → staging row created, canonical_persona_id set,
 *                         existing nakamoto_knyt_personas row gets ks_backer=true
 *
 * Usage:
 *   node scripts/import-ks-backers-staging.js [--dry-run]
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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

const DRY_RUN = process.argv.includes("--dry-run");
const STAGING_DIR = path.resolve(__dirname, "../data/knyt/cohorts/staging");
const INDEX_FILE = path.join(STAGING_DIR, "ks_backers_seed_cohort_phase1.json");
const BATCH_SIZE = 100;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function normalizeEmail(email) {
  return (email || "").toLowerCase().trim();
}

async function supabaseRequest(path, method = "GET", body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
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
    throw new Error(`Supabase ${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** Load all records from the 7-part seed files */
function loadSeedRecords() {
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
  const records = [];
  for (const partPath of index.parts) {
    const abs = path.resolve(__dirname, "..", partPath);
    if (!fs.existsSync(abs)) {
      console.warn(`  Part missing: ${partPath} — skipping`);
      continue;
    }
    const part = JSON.parse(fs.readFileSync(abs, "utf-8"));
    records.push(...part);
  }
  return records;
}

/** Build a Set of normalized emails already in nakamoto_knyt_personas */
async function loadCanonicalEmailMap() {
  console.log("Loading canonical email index from nakamoto_knyt_personas…");
  const map = new Map(); // normalized_email → { id, ks_backer }
  let offset = 0;
  const limit = 1000;
  while (true) {
    const rows = await supabaseRequest(
      `/nakamoto_knyt_personas?select=id,"Email","ks_backer"&limit=${limit}&offset=${offset}`
    );
    if (!rows || rows.length === 0) break;
    for (const row of rows) {
      const ne = normalizeEmail(row["Email"]);
      if (ne) map.set(ne, { id: row.id, ks_backer: row.ks_backer });
    }
    if (rows.length < limit) break;
    offset += limit;
  }
  console.log(`  Indexed ${map.size} canonical emails.`);
  return map;
}

/** Build a Set of normalized emails already in ks_backers_staging */
async function loadExistingStagingEmails() {
  console.log("Loading existing staging emails…");
  const set = new Set();
  let offset = 0;
  const limit = 1000;
  while (true) {
    const rows = await supabaseRequest(
      `/ks_backers_staging?select=normalized_email&limit=${limit}&offset=${offset}`
    );
    if (!rows || rows.length === 0) break;
    for (const row of rows) set.add(row.normalized_email);
    if (rows.length < limit) break;
    offset += limit;
  }
  console.log(`  Found ${set.size} existing staging records.`);
  return set;
}

async function main() {
  console.log(`KS Backers Staging Import${DRY_RUN ? " [DRY RUN]" : ""}`);
  console.log("─".repeat(50));

  const rawRecords = loadSeedRecords();
  console.log(`Loaded ${rawRecords.length} seed records from 7 parts.`);

  const canonicalMap = await loadCanonicalEmailMap();
  const existingStaging = await loadExistingStagingEmails();

  // Deduplicate within seed file itself by normalized email
  const seen = new Set();
  const deduped = [];
  for (const r of rawRecords) {
    const ne = normalizeEmail(r.email);
    if (!ne || seen.has(ne)) continue;
    seen.add(ne);
    deduped.push({ ...r, normalized_email: ne });
  }
  console.log(`After intra-seed dedup: ${deduped.length} unique emails.`);

  const toInsert = [];
  const canonicalUpdates = []; // IDs of canonical records to set ks_backer=true
  let skippedAlreadyStaged = 0;

  for (const r of deduped) {
    if (existingStaging.has(r.normalized_email)) {
      skippedAlreadyStaged++;
      continue;
    }
    const canonical = canonicalMap.get(r.normalized_email);
    const row = {
      first_name: r.first_name || null,
      last_name: r.last_name || null,
      email: r.email,
      cohort_id: "ks_backers",
      campaign_id: "knyt_ks_campaign",
      seed_source: "ks_backers_seed_phase1",
      storage_tier: "staging",
      canonical_dataset: false,
      dedup_status: canonical ? "duplicate_canonical" : "unique",
      canonical_persona_id: canonical ? canonical.id : null,
      enrichment_status: canonical ? "cross_referenced" : "seed_only",
      imported_by: "import-ks-backers-staging.js",
    };
    toInsert.push(row);
    if (canonical && !canonical.ks_backer) {
      canonicalUpdates.push(canonical.id);
    }
  }

  const uniqueCount = toInsert.filter((r) => r.dedup_status === "unique").length;
  const dupCount = toInsert.filter((r) => r.dedup_status === "duplicate_canonical").length;

  console.log(`\nReady to insert: ${toInsert.length} staging records`);
  console.log(`  unique (new to canonical):     ${uniqueCount}`);
  console.log(`  duplicate_canonical (matched): ${dupCount}`);
  console.log(`  skipped (already staged):      ${skippedAlreadyStaged}`);
  console.log(`  canonical rows to flag ks_backer=true: ${canonicalUpdates.length}`);

  if (DRY_RUN) {
    console.log("\n[DRY RUN] — no writes performed.");
    return;
  }

  // ── Insert staging rows in batches ────────────────────────────────────────
  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    try {
      await supabaseRequest("/ks_backers_staging", "POST", batch);
      inserted += batch.length;
      process.stdout.write(`\r  Inserted ${inserted}/${toInsert.length}…`);
    } catch (err) {
      console.error(`\n  Batch ${i}–${i + BATCH_SIZE} failed: ${err.message}`);
      failed += batch.length;
    }
  }
  console.log(`\n  Done: ${inserted} inserted, ${failed} failed.`);

  // ── Flag matched canonical records with ks_backer=true ────────────────────
  if (canonicalUpdates.length > 0) {
    console.log(`\nFlagging ${canonicalUpdates.length} canonical records ks_backer=true…`);
    let flagged = 0;
    for (let i = 0; i < canonicalUpdates.length; i += BATCH_SIZE) {
      const batch = canonicalUpdates.slice(i, i + BATCH_SIZE);
      const ids = batch.map((id) => `"${id}"`).join(",");
      try {
        await supabaseRequest(
          `/nakamoto_knyt_personas?id=in.(${ids})`,
          "PATCH",
          { ks_backer: true }
        );
        flagged += batch.length;
      } catch (err) {
        console.error(`  Batch flag failed: ${err.message}`);
      }
    }
    console.log(`  Flagged ${flagged} canonical records.`);
  }

  console.log("\nImport complete.");
  console.log(`Staging table: ks_backers_staging`);
  console.log(`All records canonical_dataset=false — safe from canonical CRM.`);
  console.log(`Run Phase 2 canonization only after hygiene gate passes (doc 31).`);
}

main().catch((err) => {
  console.error("Import error:", err);
  process.exit(1);
});
