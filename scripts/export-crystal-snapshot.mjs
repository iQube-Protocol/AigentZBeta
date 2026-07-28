#!/usr/bin/env node
/**
 * export-crystal-snapshot.mjs — freeze an immutable experimental snapshot from
 * the AUTHORITATIVE Live Invariant Corpus (the database).
 *
 * ── Vocabulary (operator ruling, 2026-07-28) ────────────────────────────────
 *
 *   Live Invariant Corpus   the authoritative, mutable DB state
 *   Seed Corpus             codexes/packs/irl/foundation/canonical-invariants.seed.json
 *                           — bootstrap/import material ONLY. Not the crystal.
 *   Crystal vP1             the immutable snapshot this script produces
 *   Fixed Slice vP1         the exact subset handed to an arm, built AFTER the
 *                           freeze by the standard slice procedure
 *
 * The seed file is one-way input (`ingest-canonical-invariants.mjs` writes
 * file → DB and nothing writes back), so it drifts the moment the IDE creates
 * an invariant. It must never be used directly as an experimental freeze.
 *
 * ── What this records, and what it refuses to do ────────────────────────────
 *
 *   > "The snapshot should record reality, not repair or promote it."
 *
 * Freezing a `proposed` invariant does not validate it. Freezing a
 * zero-Standing invariant does not grant it Standing. This script therefore
 * writes `status`, `times_validated` and `standing` EXACTLY as observed, and
 * has no flag that could alter them. Synthetic promotion is not an option the
 * tool offers.
 *
 * ── Eligibility ─────────────────────────────────────────────────────────────
 *
 * Membership in the corpus is not eligibility for an experiment. Eligibility
 * is decided per experiment by (domain boundary × experiment-relative
 * independence), per services/research/experimentRelation.ts. Contaminated
 * invariants are NOT deleted and NOT silently dropped — they are recorded in
 * the manifest as excluded, with their reason and stratum, because an
 * exclusion that leaves no trace is indistinguishable from an oversight.
 *
 * Usage:
 *   node scripts/export-crystal-snapshot.mjs --version=vP1 --dry-run
 *   node scripts/export-crystal-snapshot.mjs --version=vP1
 *   node scripts/export-crystal-snapshot.mjs --version=vP1 \
 *        --relations=path/to/relations.json
 *
 * `--relations` is a JSON map of `{ "<invariant id or seed_id>": "<relation>" }`
 * from the independence review. Any invariant absent from it is `unknown`,
 * which FAILS CLOSED — it is excluded from the confirmatory population and
 * reported as such. That is deliberate: an unreviewed corpus produces a small,
 * visibly-incomplete crystal rather than a large, quietly-contaminated one.
 *
 * Run against the canonical iQube-Protocol database, never a stale clone
 * (CLAUDE.md, "Canonical Repo vs the Operator's Local Clone").
 */

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(REPO, 'codexes/packs/irl/foundation/crystals');

// The EXP-P1 domain corpus boundary. `finance` is inside it by the 2026-07-28
// ruling — the 25 finance invariants were created expressly to enlarge the
// crystal for this experiment, so leaving them outside would make the
// enlargement meaningless. This declaration is experiment-scoped: it does NOT
// admit all future finance invariants to every experiment.
const EXP_P1_NAMESPACES = new Set([
  'constitutional', 'reasoning', 'epistemology', 'polity', 'sovereignty',
  'cybernetics', 'engineering', 'representation', 'interaction', 'capability',
  'experience', 'narrative', 'style', 'commercialisation',
  'finance',
]);

const SNAPSHOT_COLUMNS = [
  'id', 'seed_id', 'statement', 'namespace', 'ontology_class_id', 'semantic_type',
  'status', 'confidence', 'confidence_basis', 'standing', 'reach',
  'times_validated', 'times_contradicted', 'times_referenced', 'times_used',
  'version', 'supersedes_id', 'ratified_source', 'provenance',
  'created_at', 'updated_at',
];

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}
const DRY_RUN = process.argv.includes('--dry-run');
// --survey answers "how many COULD be eligible, and how big is the review?"
// without freezing anything and without inferring a single relationship. It
// reports the UPPER BOUND (in-boundary rows) and the review workload. The
// bound is a ceiling, never a forecast: the review can only ever remove from it.
const SURVEY = process.argv.includes('--survey');
const VERSION = arg('version', 'vP1');
const RELATIONS_PATH = arg('relations');

// Stable stringify — key order must not change the hash, or the same corpus
// snapshotted twice produces two different commitments.
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function readEvidenceProvenance(provenance) {
  if (!provenance || typeof provenance !== 'object') return null;
  for (const k of ['provenanceClass', 'evidenceProvenance', 'provenance_class']) {
    if (typeof provenance[k] === 'string') return provenance[k];
  }
  return null;
}

const GENERAL_NS = new Set([
  'constitutional', 'reasoning', 'epistemology', 'polity', 'sovereignty',
  'cybernetics', 'engineering', 'representation', 'interaction', 'capability',
]);
const EXTERNAL_EVIDENCE = new Set(['external-established', 'external-empirical']);
const ELIGIBLE_RELATIONS = new Set(['independent', 'domain-adjacent']);
// `domain-adjacent` is the permissive one, so it carries a burden `independent`
// does not: an explicit reviewer reason. Without it the label becomes a
// convenient home for uncertain material, which is the failure mode the narrow
// definition exists to prevent (ruling 7, 2026-07-28):
//   "Relevant to the experimental domain and predating task construction, but
//    not derived from the target system, task set, expected answers or
//    observed outcomes."
const REQUIRES_INCLUSION_REASON = new Set(['domain-adjacent']);
const RELATION_REASON = {
  'target-derived': 'derived from the system under evaluation — circular',
  'task-derived': 'derived from the task set or expected answers',
  'outcome-informed': 'authored or revised after observing outcomes',
  unknown: 'not yet reviewed for independence — fails closed',
};

function stratumOf(relation, evidenceProvenance, namespace) {
  if (!ELIGIBLE_RELATIONS.has(relation)) return 'T';
  if (GENERAL_NS.has(namespace)) return 'C';
  return evidenceProvenance && EXTERNAL_EVIDENCE.has(evidenceProvenance) ? 'D' : 'I';
}

/**
 * Load `.env.local` / `.env.local.temp` if the caller has not already exported
 * the credentials. `node script.mjs` gets no dotenv (only the vitest config
 * loads it), so without this the script fails on a machine where every other
 * tool works — which reads as a broken script rather than a missing export.
 * Already-set environment variables always win.
 */
function loadLocalEnv() {
  for (const name of ['.env.local', '.env.local.temp']) {
    const path = join(REPO, name);
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, 'utf-8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      const k = line.slice(0, eq).trim();
      if (process.env[k]) continue;
      process.env[k] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
}

async function main() {
  loadLocalEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Checked the environment, .env.local and .env.local.temp. Export them, or\n' +
      'run from a repo root where one of those files carries both.',
    );
    process.exit(1);
  }
  const admin = createClient(url, key, { auth: { persistSession: false } });

  let relations = {};
  if (RELATIONS_PATH) {
    if (!existsSync(RELATIONS_PATH)) {
      console.error(`--relations file not found: ${RELATIONS_PATH}`);
      process.exit(1);
    }
    relations = JSON.parse(readFileSync(RELATIONS_PATH, 'utf-8'));
    console.log(`Independence review: ${Object.keys(relations).length} classified.`);
  } else {
    console.log('No --relations supplied: every invariant is `unknown` and FAILS CLOSED.');
  }

  // Page through the whole corpus — never a bare .select() that silently caps.
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('invariants')
      .select(SNAPSHOT_COLUMNS.join(','))
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`corpus read failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  console.log(`Live Invariant Corpus: ${rows.length} rows.`);

  const included = [];
  const decisions = [];
  for (const r of rows) {
    const ns = String(r.namespace);
    const evidence = readEvidenceProvenance(r.provenance);
    // A relations entry is either a bare relation string or a full review
    // record. The record form is what a real independence review produces and
    // is what gets hashed alongside the crystal.
    const entry = relations[r.id] ?? relations[r.seed_id] ?? null;
    const review = typeof entry === 'string' ? { relationship: entry } : (entry ?? {});
    const relation = review.relationship ?? 'unknown';
    const reviewReason = review.reason ?? null;
    const reviewer = review.reviewer ?? null;
    const reviewedAt = review.reviewedAt ?? null;
    const sourceRefs = review.sourceRefs ?? null;
    // A domain-adjacent inclusion with no stated reason is not an inclusion.
    const missingReason = REQUIRES_INCLUSION_REASON.has(relation) && !reviewReason;
    const inDomain = EXP_P1_NAMESPACES.has(ns);
    const stratum = stratumOf(relation, evidence, ns);
    const eligible = inDomain && ELIGIBLE_RELATIONS.has(relation) && !missingReason;
    const reason = !inDomain
      ? `namespace '${ns}' is outside the declared ${VERSION} domain boundary`
      : missingReason
        ? "'domain-adjacent' requires an explicit reviewer inclusion reason"
        : (RELATION_REASON[relation] ?? null);

    decisions.push({
      invariant_id: r.id, seed_id: r.seed_id ?? null, namespace: ns,
      status: r.status, eligible, relation, stratum,
      evidence_provenance: evidence,
      inclusion_reason: eligible ? reviewReason : null,
      reason: eligible ? null : reason,
      reviewer, reviewed_at: reviewedAt, source_refs: sourceRefs,
    });
    // Status, times_validated and standing are copied AS OBSERVED. Nothing here
    // may repair or promote them.
    if (eligible) included.push(r);
  }

  const count = (arr, k) => arr.reduce((a, x) => { const v = String(x[k]); a[v] = (a[v] ?? 0) + 1; return a; }, {});
  const crystal = { version: VERSION, invariants: included };
  const crystalJson = canonicalJson(crystal);
  const snapshotHash = sha256(crystalJson);

  const manifest = {
    crystal_version: VERSION,
    export_timestamp: new Date().toISOString(),
    environment: url.replace(/^https?:\/\//, '').split('.')[0],
    eligibility_rule_version: '2026-07-28.1',
    exporter_commit: process.env.COMMIT_SHA ?? null,
    domain_boundary: [...EXP_P1_NAMESPACES].sort(),
    corpus_row_count: rows.length,
    included_row_count: included.length,
    excluded_row_count: rows.length - included.length,
    namespace_counts: count(included, 'namespace'),
    status_counts: count(included, 'status'),
    stratum_counts: decisions.filter((d) => d.eligible)
      .reduce((a, d) => { a[d.stratum] = (a[d.stratum] ?? 0) + 1; return a; }, {}),
    zero_standing_included: included.filter((r) => Number(r.standing ?? 0) === 0).length,
    zero_validation_included: included.filter((r) => Number(r.times_validated ?? 0) === 0).length,
    snapshot_sha256: snapshotHash,
    decisions,
  };

  console.log(`\n  included ${included.length} / ${rows.length}`);
  console.log(`  namespaces: ${JSON.stringify(manifest.namespace_counts)}`);
  console.log(`  statuses:   ${JSON.stringify(manifest.status_counts)}`);
  console.log(`  strata:     ${JSON.stringify(manifest.stratum_counts)}`);
  console.log(`  zero-standing included: ${manifest.zero_standing_included} (recorded, never repaired)`);
  console.log(`  sha256: ${snapshotHash}`);

  if (SURVEY) {
    const inBoundary = decisions.filter((d) => EXP_P1_NAMESPACES.has(d.namespace));
    const reviewed = inBoundary.filter((d) => d.relation !== 'unknown');
    const by = (arr, k) => arr.reduce((a, x) => { const v = String(x[k]); a[v] = (a[v] ?? 0) + 1; return a; }, {});
    console.log('\n── SURVEY — no freeze, no inference ─────────────────────────');
    console.log(`  Live Invariant Corpus            ${rows.length}`);
    console.log(`  outside the vP1 domain boundary  ${rows.length - inBoundary.length}`);
    console.log(`  IN boundary  (UPPER BOUND)       ${inBoundary.length}`);
    console.log(`    already reviewed               ${reviewed.length}`);
    console.log(`    awaiting independence review   ${inBoundary.length - reviewed.length}   <-- the work`);
    console.log('\n  In-boundary by namespace:');
    for (const [k, v] of Object.entries(by(inBoundary, 'namespace')).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(20)} ${String(v).padStart(4)}`);
    }
    console.log('\n  In-boundary by status:      ' + JSON.stringify(by(inBoundary, 'status')));
    console.log('  In-boundary by evidence provenance:');
    for (const [k, v] of Object.entries(by(inBoundary, 'evidence_provenance')).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${(k === 'null' ? '(unclassified)' : k).padEnd(24)} ${String(v).padStart(4)}`);
    }
    console.log('\n  The eligible count is NOT derivable from this. Every in-boundary');
    console.log('  row needs an invariant-level independence decision — namespace is a');
    console.log('  boundary, never a verdict. Upper bound only falls as review proceeds.');
    return;
  }

  if (DRY_RUN) { console.log('\nDry run — nothing written.'); return; }

  mkdirSync(OUT_DIR, { recursive: true });
  const base = join(OUT_DIR, `crystal-${VERSION}`);
  // The exclusions artifact is not a convenience. It is the evidence that
  // omitted invariants were REVIEWED rather than silently dropped — without it
  // an exclusion and an oversight are the same observation.
  const exclusions = decisions.filter((d) => !d.eligible);
  const relationsFrozen = { crystal_version: VERSION, relations };
  const relationsHash = sha256(canonicalJson(relationsFrozen));
  manifest.relations_sha256 = relationsHash;
  manifest.relations_reviewed_count = Object.keys(relations).length;

  writeFileSync(`${base}.json`, `${JSON.stringify(crystal, null, 2)}\n`);
  writeFileSync(`${base}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(`${base}.relations.json`, `${JSON.stringify(relationsFrozen, null, 2)}\n`);
  writeFileSync(`${base}.exclusions.json`, `${JSON.stringify({ crystal_version: VERSION, exclusions }, null, 2)}\n`);
  writeFileSync(`${base}.sha256`, `${snapshotHash}  crystal-${VERSION}.json\n${relationsHash}  crystal-${VERSION}.relations.json\n`);
  console.log(`\nWrote ${base}.{json,manifest.json,relations.json,exclusions.json,sha256}`);
  console.log(`  crystal   sha256 ${snapshotHash}`);
  console.log(`  relations sha256 ${relationsHash}`);
  console.log('Commit these before constructing the Fixed Slice. Task construction follows the slice, never precedes it.');
}

main().catch((e) => { console.error(e); process.exit(1); });
