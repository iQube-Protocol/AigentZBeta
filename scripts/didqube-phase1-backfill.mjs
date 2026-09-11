#!/usr/bin/env node
/**
 * didqube-phase1-backfill.mjs — Phase 1 DiDQube supertype backfill.
 *
 * Operator-approved 2026-09-07 (see
 * codexes/packs/agentiq/updates/2026-09-07_didqube-canonical-resolver-execution-plan.md,
 * "Phase 1"). Populates `didqubes`/`human_didqubes`/`agent_didqubes` (added in
 * migration 20260930270000_didqube_canonical_supertype.sql) from the existing
 * authoritative anchor tables — `kybe_identity` and `agent_root_identity`.
 * Neither anchor table is modified; this only adds rows to the new,
 * additive supertype tables.
 *
 * ── Non-negotiable invariants this script honors ────────────────────────────
 *
 *   - Backfills EVERY kybe_identity row unconditionally — never conditioned
 *     on an existing/active root_identity (operator ruling: a RootDID is a
 *     reissuable instrument beneath personhood, not a precondition for the
 *     DiDQube itself). Backfills EVERY agent_root_identity row.
 *   - IDEMPOTENT: re-running this script is always safe. Before backfilling
 *     an anchor, it checks whether a human_didqubes/agent_didqubes row
 *     already references that anchor and skips it if so — never creates a
 *     duplicate binding, and never leaves an orphaned `didqubes` row behind
 *     from a partial retry (the didqubes insert and its subtype binding
 *     insert happen back-to-back per anchor, and a failure on the subtype
 *     insert is reported as an exception for that one anchor rather than
 *     silently leaving a dangling row — see the per-row error handling below).
 *   - Reports ambiguous/failed rows explicitly. Never guesses, never retries
 *     with a relaxed check.
 *   - Counts are computed DYNAMICALLY against the live pre-backfill
 *     population at run time — never hardcoded.
 *   - Does not touch personas.root_did, Passport tables, DVN, or any
 *     consumer — this script's only writes are to the three new tables.
 *
 * Usage: node scripts/didqube-phase1-backfill.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required — refusing to guess a connection.');
  process.exit(1);
}
const dryRun = process.argv.includes('--dry-run');
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function backfillAnchorClass({ label, anchorTable, subtypeTable, anchorColumn, subjectClass }) {
  const { data: anchors, error: anchorErr } = await supabase.from(anchorTable).select('id');
  if (anchorErr) throw new Error(`${label}: failed to read ${anchorTable}: ${anchorErr.message}`);
  const preCount = anchors.length; // dynamic — the live population at run time, never hardcoded

  const { data: existingBindings, error: bindingErr } = await supabase.from(subtypeTable).select(anchorColumn);
  if (bindingErr) throw new Error(`${label}: failed to read existing ${subtypeTable}: ${bindingErr.message}`);
  const alreadyBound = new Set((existingBindings ?? []).map((r) => r[anchorColumn]));

  const missing = anchors.filter((a) => !alreadyBound.has(a.id));

  console.log(`[${label}] live ${anchorTable} rows: ${preCount}; already bound: ${alreadyBound.size}; to backfill: ${missing.length}`);

  const exceptions = [];
  let created = 0;
  for (const anchor of missing) {
    if (dryRun) {
      created += 1;
      continue;
    }
    // Insert the supertype row first, then its subtype binding. If the
    // subtype insert fails (e.g. a genuinely ambiguous/duplicate anchor
    // slipped past the pre-check due to a race with another writer), the
    // orphaned didqubes row is deleted immediately so re-running the
    // script never accumulates dangling supertype rows — the anchor is
    // reported as an exception instead, never silently retried with a
    // relaxed check.
    const { data: created_didqube, error: didqubeErr } = await supabase
      .from('didqubes')
      .insert({ subject_class: subjectClass })
      .select('didqube_id')
      .single();
    if (didqubeErr) {
      exceptions.push({ anchorId: anchor.id, stage: 'didqubes insert', error: didqubeErr.message });
      continue;
    }
    const { error: subtypeErr } = await supabase
      .from(subtypeTable)
      .insert({ didqube_id: created_didqube.didqube_id, [anchorColumn]: anchor.id });
    if (subtypeErr) {
      await supabase.from('didqubes').delete().eq('didqube_id', created_didqube.didqube_id);
      exceptions.push({ anchorId: anchor.id, stage: `${subtypeTable} insert`, error: subtypeErr.message });
      continue;
    }
    created += 1;
  }

  // Dynamic post-check — re-read the live subtype table, never assume the
  // loop above accounts for everything (e.g. a concurrent writer).
  const { count: postCount, error: postErr } = dryRun
    ? { count: alreadyBound.size + created, error: null }
    : await supabase.from(subtypeTable).select('*', { count: 'exact', head: true });
  if (postErr) throw new Error(`${label}: failed to verify post-backfill count: ${postErr.message}`);

  return { label, preCount, created, exceptions, postCount };
}

async function main() {
  console.log(dryRun ? '=== DiDQube Phase 1 backfill (DRY RUN — no writes) ===' : '=== DiDQube Phase 1 backfill ===');

  const humanResult = await backfillAnchorClass({
    label: 'human_didqubes (kybe_identity)',
    anchorTable: 'kybe_identity',
    subtypeTable: 'human_didqubes',
    anchorColumn: 'kybe_identity_id',
    subjectClass: 'natural_person',
  });

  const agentResult = await backfillAnchorClass({
    label: 'agent_didqubes (agent_root_identity)',
    anchorTable: 'agent_root_identity',
    subtypeTable: 'agent_didqubes',
    anchorColumn: 'agent_root_identity_id',
    subjectClass: 'agent',
  });

  for (const result of [humanResult, agentResult]) {
    console.log(`\n[${result.label}]`);
    console.log(`  live anchor rows (pre-backfill):  ${result.preCount}`);
    console.log(`  newly created this run:           ${result.created}`);
    console.log(`  subtype table row count (post):   ${result.postCount}`);
    if (result.exceptions.length > 0) {
      console.log(`  EXCEPTIONS (${result.exceptions.length}) — NOT silently skipped:`);
      for (const ex of result.exceptions) {
        console.log(`    - anchor ${ex.anchorId} at ${ex.stage}: ${ex.error}`);
      }
    }
    if (!dryRun && result.postCount !== result.preCount) {
      console.warn(
        `  WARNING: ${result.label} post-count (${result.postCount}) does not equal live anchor count ` +
          `(${result.preCount}) — ${result.exceptions.length} exception(s) above account for the gap, or a ` +
          'concurrent write happened during this run. Re-run this script (idempotent) after investigating.',
      );
    }
  }

  const totalExceptions = humanResult.exceptions.length + agentResult.exceptions.length;
  if (totalExceptions > 0) {
    console.error(`\n${totalExceptions} anchor(s) could not be backfilled — see EXCEPTIONS above. Exiting nonzero.`);
    process.exit(1);
  }
  console.log('\nBackfill complete. Every live kybe_identity and agent_root_identity row now has a didqubes binding.');
}

main().catch((err) => {
  console.error('didqube-phase1-backfill FAILED:', err.message);
  process.exit(1);
});
