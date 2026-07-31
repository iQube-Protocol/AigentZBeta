#!/usr/bin/env node
/**
 * ingest-canonical-invariants.mjs — seed the Invariant Ontology from
 * Appendix A (Chrysalis Foundation Phase 1).
 *
 * Reads codexes/packs/irl/foundation/canonical-invariants.seed.json and
 * upserts:
 *   1. one root ontology class per namespace (ontology_classes)
 *   2. every seed invariant (invariants, idempotent on seed_id)
 *   3. contexts from each invariant's contexts[] (invariant_contexts)
 *
 * Idempotent: re-running updates statements/provenance in place via the
 * seed_id unique key; it never duplicates and never touches rows the
 * operator has advanced past 'proposed' (status is preserved on re-run).
 *
 * Requires (from .env.local or the environment):
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/ingest-canonical-invariants.mjs --dry-run
 *   node scripts/ingest-canonical-invariants.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const SEED_PATH = join(REPO, 'codexes/packs/irl/foundation/canonical-invariants.seed.json');
const DRY_RUN = process.argv.includes('--dry-run');

// Confidence ladder (CFS-001 §5). Seed entries drawn from ratified Polity
// documents are document-verified; the rest are principal-verified (human-
// authored canon).
const CONFIDENCE = { document_verified: 1.0, principal_verified: 0.85 };

// Standing prior from a seed validation count. MIRRORS computeStandingScore in
// services/invariants/lifecycle.ts (§6, Law XII) — the SoT there. This is only a
// bootstrap: recomputeStanding re-derives standing identically from
// times_validated, so no drift can persist. No contradictions at seed time.
function standingFromValidations(timesValidated) {
  const base = timesValidated * 8;
  const score = base <= 0 ? 0 : (100 * base) / (base + 40);
  return Math.round(score * 10) / 10;
}

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

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (checked env + .env.local)');
    process.exit(1);
  }

  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf-8'));
  console.log(`Seed v${seed.version}: ${seed.invariants.length} invariants, namespaces: ${seed.namespaces.join(', ')}`);
  if (DRY_RUN) {
    for (const inv of seed.invariants) {
      console.log(`  [dry] ${inv.id}  ${inv.namespace}/${inv.semantic_type}  "${inv.statement}"`);
    }
    console.log('Dry run — nothing written.');
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // 1. Root ontology class per namespace.
  const classIdByNamespace = {};
  for (const namespace of seed.namespaces) {
    const { data, error } = await supabase
      .from('ontology_classes')
      .upsert(
        {
          namespace,
          slug: `${namespace}-root`,
          name: `${namespace[0].toUpperCase()}${namespace.slice(1)} (root)`,
          description: `Root class of the ${namespace} namespace (CFS-002 §2). Seeded from Appendix A.`,
        },
        { onConflict: 'slug' },
      )
      .select()
      .single();
    if (error) throw new Error(`ontology class upsert failed (${namespace}): ${error.message}`);
    classIdByNamespace[namespace] = data.id;
    console.log(`  ontology class ${namespace}-root → ${data.id}`);
  }

  // 2. Invariants (idempotent on seed_id; preserve operator-advanced status).
  let created = 0;
  let updated = 0;
  for (const inv of seed.invariants) {
    const basis = inv.ratified_source ? 'document_verified' : 'principal_verified';
    const seedValidations = Number(inv.seed_validations ?? 0);
    const { data: existing } = await supabase
      .from('invariants')
      .select('id,status,times_validated')
      .eq('seed_id', inv.id)
      .maybeSingle();

    const row = {
      seed_id: inv.id,
      statement: inv.statement,
      namespace: inv.namespace,
      semantic_type: inv.semantic_type,
      ontology_class_id: classIdByNamespace[inv.namespace],
      confidence: CONFIDENCE[basis],
      confidence_basis: basis,
      ratified_source: inv.ratified_source ?? null,
      provenance: { ...inv.provenance, seeded_from: 'appendix-a', seed_version: seed.version },
    };

    let invariantId;
    if (existing) {
      const patch = { ...row };
      // Seed the standing prior only when the row hasn't earned real validation
      // yet (times_validated 0/null) — same discipline as status preservation:
      // never clobber evidence the runtime (or operator) has accrued.
      if (seedValidations > 0 && !existing.times_validated) {
        patch.times_validated = seedValidations;
        patch.standing = standingFromValidations(seedValidations);
      }
      const { error } = await supabase.from('invariants').update(patch).eq('id', existing.id);
      if (error) throw new Error(`invariant update failed (${inv.id}): ${error.message}`);
      invariantId = existing.id;
      updated++;
    } else {
      const insertPayload = { ...row, status: inv.status ?? 'proposed' };
      if (seedValidations > 0) {
        insertPayload.times_validated = seedValidations;
        insertPayload.standing = standingFromValidations(seedValidations);
      }
      const { data, error } = await supabase
        .from('invariants')
        .insert(insertPayload)
        .select('id')
        .single();
      if (error) throw new Error(`invariant insert failed (${inv.id}): ${error.message}`);
      invariantId = data.id;
      created++;
    }

    // 3. Contexts.
    for (const domain of inv.contexts ?? []) {
      const { error } = await supabase
        .from('invariant_contexts')
        .upsert(
          { invariant_id: invariantId, domain, retrieval_tags: [domain, inv.namespace] },
          { onConflict: 'invariant_id,domain' },
        );
      if (error) throw new Error(`context upsert failed (${inv.id}/${domain}): ${error.message}`);
    }
  }

  console.log(`Done: ${created} created, ${updated} updated. The seed crystal is planted.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
