#!/usr/bin/env node
/**
 * seed-irl-ax-001.mjs — create the IRL-AX-001 (CI/IRL × OCSGA Independent
 * Architecture Exchange) reciprocal exchange record — the first dogfood
 * instance of the generic Reciprocal Artifact Exchange primitive
 * (PRD-IRL-AX-001).
 *
 * WHY THIS IS A SCRIPT AND NOT A SQL SEED MIGRATION: the exchange's
 * `initiator_persona_id` (Party A / MetaProof/IRL/Dele) is a REAL, T0
 * persona UUID that must be supplied by the operator — CLAUDE.md's
 * "No Guessing or Hallucinating" rule forbids fabricating or guessing it,
 * and a SQL migration baked into the repo would either need to hardcode a
 * fake value (a lie) or hold up every future migration on knowing it. This
 * script requires the real value as an explicit CLI argument every time.
 *
 * Party A's artifact fingerprint is NOT guessed either — this script reads
 * the actual frozen file from disk and computes its real SHA-256, exactly
 * the way `sha256sum` would, at the exact commit this script's own repo
 * checkout has pinned. It never invents a hash.
 *
 * Party B (Ian/OCSGA) is deliberately left unset — the PRD requires his
 * artifact to be genuinely supplied later, through his own accession
 * (invitation → Passport/persona → deposit), never fabricated here.
 *
 * Idempotent: re-running finds the existing DRAFT/A_DEPOSITED exchange by
 * its unique title + initiator and does not create a duplicate.
 *
 * Requires (from .env.local or the environment):
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/seed-irl-ax-001.mjs --initiator-public-ref=<16-hex> [--dry-run]
 *   node scripts/seed-irl-ax-001.mjs --initiator-persona-id=<real-uuid> [--dry-run]   (debug override)
 *
 * PERSONA-PUBLIC-REF-001 (2026-08-24): `--initiator-public-ref` is the
 * normal way to run this — the operator's own Persona Public Reference
 * (16 hex chars, e.g. from the wallet self-view's "Copy public reference"),
 * resolved here via the persisted `personas.public_ref` column. Passing the
 * raw `--initiator-persona-id` UUID directly still works, for an operator
 * debugging this exact script from a local shell with service-role
 * credentials already in hand — but it is no longer the documented path.
 */

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const ARTIFACT_PATH = 'codexes/packs/irl/foundation/experiments/ci-irl-native-architecture-baseline-v1.0.md';
const DRY_RUN = process.argv.includes('--dry-run');

const publicRefArg = process.argv.find((a) => a.startsWith('--initiator-public-ref='));
const initiatorPublicRef = publicRefArg ? publicRefArg.split('=')[1]?.trim().toLowerCase() : null;
const uuidArg = process.argv.find((a) => a.startsWith('--initiator-persona-id='));
const initiatorPersonaIdArg = uuidArg ? uuidArg.split('=')[1] : null;

if (!initiatorPublicRef && !initiatorPersonaIdArg) {
  console.error(
    'Missing --initiator-public-ref=<16-hex> (preferred — see the wallet self-view) or ' +
      '--initiator-persona-id=<uuid> (debug override). This must be Dele/MetaProof/IRL\'s REAL ' +
      'identifier — it must never be guessed (CLAUDE.md "No Guessing").',
  );
  process.exit(1);
}
if (initiatorPublicRef && !/^[0-9a-f]{16}$/.test(initiatorPublicRef)) {
  console.error(`--initiator-public-ref must be exactly 16 hex characters, got "${initiatorPublicRef}".`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
// A public-ref resolution is a READ, needed even in --dry-run so the dry
// run reports the real initiator it would use — so this check is not
// itself gated on DRY_RUN when a ref (rather than a raw uuid) was given.
if ((!DRY_RUN || initiatorPublicRef) && (!url || !key)) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

let initiatorPersonaId = initiatorPersonaIdArg;
if (initiatorPublicRef) {
  const lookupClient = createClient(url, key);
  const { data, error } = await lookupClient
    .from('personas')
    .select('id')
    .eq('public_ref', initiatorPublicRef)
    .maybeSingle();
  if (error) {
    console.error(`Persona public reference lookup failed: ${error.message}`);
    process.exit(1);
  }
  if (!data) {
    console.error(`No persona found for public reference "${initiatorPublicRef}".`);
    process.exit(1);
  }
  initiatorPersonaId = data.id;
  console.log(`Resolved public reference ${initiatorPublicRef} -> persona ${initiatorPersonaId}`);
}

const fullPath = join(REPO, ARTIFACT_PATH);
if (!existsSync(fullPath)) {
  console.error(`Frozen artifact not found at ${ARTIFACT_PATH} — cannot compute a real fingerprint.`);
  process.exit(1);
}
const bytes = readFileSync(fullPath);
const contentHash = createHash('sha256').update(bytes).digest('hex');

let commitSha;
try {
  commitSha = execSync(`git log -1 --pretty=%H -- ${ARTIFACT_PATH}`, { cwd: REPO }).toString().trim();
} catch {
  commitSha = null;
}
if (!commitSha) {
  console.error('Could not resolve the commit that last touched the frozen artifact — refusing to guess a commit SHA.');
  process.exit(1);
}

console.log(`Computed fingerprint: sha256:${contentHash}`);
console.log(`Pinned commit: ${commitSha}`);

if (DRY_RUN) {
  console.log('--dry-run: not writing to Supabase.');
  process.exit(0);
}

const supabase = createClient(url, key);

async function main() {
  const title = 'CI/IRL × OCSGA Independent Architecture Exchange';

  const { data: existing, error: findErr } = await supabase
    .from('reciprocal_exchanges')
    .select('*')
    .eq('title', title)
    .eq('initiator_persona_id', initiatorPersonaId)
    .maybeSingle();
  if (findErr) {
    console.error('Lookup failed:', findErr.message);
    process.exit(1);
  }

  let exchange = existing;
  if (!exchange) {
    const { data, error } = await supabase
      .from('reciprocal_exchanges')
      .insert({
        title,
        purpose:
          'Exchange independently frozen formal architecture maps, establish provenance, and perform neutral ' +
          'boundary comparison before joint experimental design.',
        permitted_purpose: 'Neutral CI/IRL × OCSGA architectural boundary comparison ahead of joint experimental design.',
        initiator_persona_id: initiatorPersonaId,
        disclosure_policy: 'RECIPROCAL_AFTER_BOTH_DEPOSIT',
        comparison_policy:
          'Preserve both source artifacts; classify seams COMPATIBLE / AMBIGUOUS / CONFLICTING / REDUNDANT / ' +
          'UNRESOLVED; distinguish discovered compatibility from created compatibility.',
        confidentiality_class: 'confidential-bilateral',
        ownership_declaration:
          'Each deposited artifact remains owned and governed by its originating party (MetaProof/IRL for the ' +
          'CI/IRL baseline; OCSGA for its own baseline). Recording this exchange confers no ownership transfer.',
        status: 'DRAFT',
      })
      .select('*')
      .single();
    if (error) {
      console.error('Insert failed:', error.message);
      process.exit(1);
    }
    exchange = data;
    console.log(`Created exchange ${exchange.id}`);
  } else {
    console.log(`Exchange already exists: ${exchange.id} (status=${exchange.status}) — not duplicating.`);
  }

  const { data: existingArtifact } = await supabase
    .from('exchange_artifacts')
    .select('*')
    .eq('exchange_id', exchange.id)
    .eq('party', 'A')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingArtifact && existingArtifact.content_hash === contentHash) {
    console.log('Party A artifact already deposited with this exact fingerprint — not duplicating.');
  } else {
    const { data: artifact, error: artErr } = await supabase
      .from('exchange_artifacts')
      .insert({
        exchange_id: exchange.id,
        party: 'A',
        title: 'Constitutional Internet × IRL — Native Architecture Baseline v1.0',
        artifact_class: 'architecture-map',
        version: existingArtifact ? existingArtifact.version + 1 : 1,
        source_type: 'repository-commit',
        source_reference: ARTIFACT_PATH,
        content_hash: contentHash,
        repository_commit: commitSha,
        mime_type: 'text/markdown',
        confidentiality_class: 'confidential-bilateral',
        ownership_declaration: 'MetaProof / Invariant Research Lab retains ownership of this artifact.',
        rights_for_exchange: 'Reciprocal comparison against the OCSGA baseline within this exchange only.',
        supersedes_artifact_id: existingArtifact ? existingArtifact.id : null,
      })
      .select('*')
      .single();
    if (artErr) {
      console.error('Artifact deposit failed:', artErr.message);
      process.exit(1);
    }
    console.log(`Deposited Party A artifact ${artifact.id} (v${artifact.version})`);

    if (exchange.status === 'DRAFT') {
      await supabase.from('reciprocal_exchanges').update({ status: 'A_DEPOSITED' }).eq('id', exchange.id);
      console.log('Exchange advanced to A_DEPOSITED.');
    }
  }

  console.log('');
  console.log('Next steps (NOT performed by this script — each is a constitutional act of its own):');
  console.log('  1. Declare the freeze via POST /api/research/exchanges/{id}/actions {action:"freeze"} as Dele.');
  console.log('  2. Invite Ian via POST /api/research/exchanges/{id}/actions {action:"invite"} — share the returned code privately.');
  console.log('  3. Ian claims via POST /api/research/exchanges/join {code} once his own Passport/persona resolves.');
  console.log('  4. Ian deposits + freeze-declares his own OCSGA artifact — never fabricated by this or any script.');
  console.log('  5. Both sign the Exchange Instrument; the exchange crosses automatically once both signatures land.');
}

main();
