#!/usr/bin/env node
/**
 * export-grounding-slice.mjs — verbatim grounding-slice export for EXP-010
 * Arm C (the Representation Gauntlet, charter §7 prerequisite (i)).
 *
 * The external reviewer's capability probe: "can the Phase 1 grounding slices
 * be exported verbatim for Arm C?" This script is the yes. It exports the
 * EXACT invariant statements an arm would ground on — same source, same
 * ranking (standing → confidence → reach, mirroring
 * services/invariants/grounding.ts buildInvariantSlice and the
 * benchmark-rediscovery.mjs --broad query verbatim), no paraphrase, no
 * machinery — as a frozen, hash-committed pair of artifacts:
 *
 *   <name>.arm-c.txt        — the Arm C text: one invariant statement per
 *                             line, marker-prefixed (decomposition PRESERVED,
 *                             runtime semantics removed — Aletheon's Arm C,
 *                             deliberately NOT rewritten as prose; Arm D's
 *                             expert prompt is authored by humans, not
 *                             generated here)
 *   <name>.manifest.json    — sha256 of the txt file + full generation
 *                             parameters + per-invariant provenance (seed id,
 *                             standing, confidence, reach, status) + a rough
 *                             token estimate for the equal-budget discipline
 *
 * The sha256 in the manifest is the PRE-REGISTRATION commitment: hash the
 * export, register the hash, then run — nobody can quietly swap the slice.
 *
 * Modes:
 *   --collection exp001            the fixed 18-invariant EXP-001 collection
 *                                  (services/experiments/exp001-config.json)
 *   --broad                        the live domain-scoped slice, ranked
 *                                  standing → confidence → reach
 *     [--namespaces a,b,c]         (default: the benchmark's governance set —
 *                                  constitutional,reasoning,epistemology)
 *     [--limit N]                  (default 24, the benchmark's broad limit)
 *   --name <basename>              output basename (default: mode + date)
 *
 * Output dir: codexes/packs/irl/foundation/experiments/
 *             exp-010-representation-gauntlet/exports/
 *
 * Requires (from .env.local or the environment):
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/export-grounding-slice.mjs --collection exp001
 *   node scripts/export-grounding-slice.mjs --broad --limit 24
 */

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const OUT_DIR = join(
  REPO,
  'codexes/packs/irl/foundation/experiments/exp-010-representation-gauntlet/exports',
);

// ── CLI ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i > -1 && argv[i + 1] ? argv[i + 1] : d;
};

const MODE = val('--collection', null) === 'exp001' ? 'exp001' : has('--broad') ? 'broad' : null;
if (!MODE) {
  console.error('usage: export-grounding-slice.mjs (--collection exp001 | --broad [--namespaces a,b,c] [--limit N]) [--name basename]');
  process.exit(1);
}

// The benchmark's governance namespaces + broad limit — same defaults so an
// exported broad slice is byte-comparable with what --broad grounds on.
const NAMESPACES = val('--namespaces', 'constitutional,reasoning,epistemology').split(',').map((s) => s.trim()).filter(Boolean);
const LIMIT = Number(val('--limit', '24'));
const STATUSES = ['validated', 'canonical']; // the groundable statuses
const NAME = val('--name', `${MODE}-${new Date().toISOString().slice(0, 10)}`);

// ── Env (mirrors benchmark-rediscovery.mjs verbatim) ─────────────────────
function loadEnvLocal() {
  for (const file of ['.env.local', '.env.local.temp']) {
    const path = join(REPO, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf-8').split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  }
}

/** inv.constitutional.015 → [C-015] (benchmark markerFor, verbatim). */
function markerFor(seedId) {
  const parts = seedId.split('.');
  return `[${parts[1][0].toUpperCase()}-${parts[2]}]`;
}

async function fetchExp001Collection(supabase) {
  const config = JSON.parse(
    readFileSync(join(REPO, 'services/experiments/exp001-config.json'), 'utf-8'),
  );
  const { data, error } = await supabase
    .from('invariants')
    .select('seed_id, statement, standing, confidence, reach, namespace, status')
    .in('seed_id', config.seedIds);
  if (error) throw new Error(`invariant fetch failed: ${error.message}`);
  // Preserve the config's seed order — the collection is a fixed instrument,
  // not a ranked slice.
  const byId = new Map((data ?? []).map((r) => [r.seed_id, r]));
  return config.seedIds.map((id) => byId.get(id)).filter(Boolean);
}

async function fetchBroadSlice(supabase) {
  const { data, error } = await supabase
    .from('invariants')
    .select('seed_id, statement, standing, confidence, reach, namespace, status')
    .in('status', STATUSES)
    .in('namespace', NAMESPACES)
    .order('standing', { ascending: false })
    .order('confidence', { ascending: false })
    .order('reach', { ascending: false })
    .limit(LIMIT);
  if (error) throw new Error(`broad slice fetch failed: ${error.message}`);
  return (data ?? []).filter((r) => typeof r.seed_id === 'string' && r.seed_id.startsWith('inv.'));
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (checked env + .env.local)');
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const rows = MODE === 'exp001' ? await fetchExp001Collection(supabase) : await fetchBroadSlice(supabase);
  if (rows.length === 0) throw new Error('slice is empty — nothing to export');

  // The Arm C text — VERBATIM statements, decomposition preserved: one
  // invariant per line, marker-prefixed. No headers, no instructions, no
  // machinery — instructions/prompt framing belong to the pre-registered
  // protocol, not to the knowledge artifact.
  const armCText = rows.map((r) => `${markerFor(r.seed_id)} ${r.statement}`).join('\n') + '\n';
  const sha256 = createHash('sha256').update(armCText).digest('hex');

  const manifest = {
    experiment: 'EXP-010',
    arm: 'C (flattened invariant text — decomposition preserved, machinery removed)',
    mode: MODE,
    generatedAt: new Date().toISOString(),
    sha256,
    ranking:
      MODE === 'exp001'
        ? 'fixed collection order (services/experiments/exp001-config.json seedIds)'
        : 'standing DESC → confidence DESC → reach DESC (buildInvariantSlice / benchmark --broad, verbatim)',
    parameters:
      MODE === 'exp001'
        ? { collection: 'exp001' }
        : { namespaces: NAMESPACES, statuses: STATUSES, limit: LIMIT },
    counts: { invariants: rows.length, characters: armCText.length },
    tokenEstimate: Math.ceil(armCText.length / 4),
    invariants: rows.map((r) => ({
      seedId: r.seed_id,
      marker: markerFor(r.seed_id),
      namespace: r.namespace,
      status: r.status,
      standing: r.standing,
      confidence: r.confidence,
      reach: r.reach,
    })),
    note:
      'The sha256 is the pre-registration commitment for this slice. Statements are exported VERBATIM from the ' +
      'live crystal — no paraphrase. Arm D (expert conventional prompt, same budget, no decomposition) is authored ' +
      'separately by humans; this instrument never generates it.',
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const txtPath = join(OUT_DIR, `${NAME}.arm-c.txt`);
  const manifestPath = join(OUT_DIR, `${NAME}.manifest.json`);
  writeFileSync(txtPath, armCText);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`EXP-010 Arm C slice exported (${MODE})`);
  console.log(`  invariants : ${rows.length}`);
  console.log(`  tokens est : ~${manifest.tokenEstimate}`);
  console.log(`  sha256     : ${sha256}`);
  console.log(`  text       : ${txtPath}`);
  console.log(`  manifest   : ${manifestPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
