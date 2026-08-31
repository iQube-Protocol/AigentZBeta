/**
 * Repairs ONE invariant's evidence-provenance classification through the
 * SAME canonical service path the live Classify Provenance UI uses
 * (`applyProvenanceReclassification` + `updateInvariant` — never a direct
 * Supabase write) — built for the 2026-08-30 incident: a promoted invariant
 * (EXP-P1 Track 2, "Record 1") had its class land via a pre-fix Accept
 * control with no `classDisposition` ever recorded, which the fix now
 * refuses going forward but cannot retroactively rewrite.
 *
 * This script is the REPAIR DOOR the fix itself opens: `applyProvenance
 * Reclassification` permits ONE same-value re-affirmation of a record whose
 * active classification predates (or bypassed) `classDisposition` — see
 * that function's own "GRANDFATHERED REPAIR" comment. It refuses a second
 * attempt once the record is properly governed, so this is not a standing
 * bypass.
 *
 * Requires live Supabase — this cannot run from a network-restricted
 * sandbox. Run it from an environment with real Supabase access (the
 * operator's machine, or a deployed job), using the operator's OWN
 * `.env.local` credentials (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).
 *
 * YOU (the operator) must supply the confirmed evidence-provenance class,
 * evidence refs, and rationale — this script performs NO independent
 * verification of the underlying evidence. Inspect the record first
 * (scripts/../.. — see the accompanying read-only SQL) and confirm the
 * class is correct before running with --confirm.
 *
 * Usage — dry run (prints what WOULD be written, writes nothing):
 *   npx tsx scripts/repair-classify-provenance-record.ts \
 *     --invariant-id=<uuid> \
 *     --to=external-established \
 *     --evidence-refs="https://www.bis.org/cpmi/publ/d216.htm" \
 *     --rationale="Steward re-inspected the acquired CPMI document and confirms this classification." \
 *     --disposition=operator-selected
 *
 * Then, once you've reviewed the dry-run output and it's correct, append
 * --confirm to actually write:
 *   npx tsx scripts/repair-classify-provenance-record.ts \
 *     --invariant-id=<uuid> --to=external-established \
 *     --evidence-refs="..." --rationale="..." --disposition=operator-selected \
 *     --confirm
 *
 * `--evidence-refs` accepts a comma-separated list for more than one source.
 * `--disposition` is `operator-selected` (default — you are re-affirming
 * the class yourself) or `recommendation-accepted` (you are explicitly
 * endorsing the machine's own current suggestion; requires --confidence and
 * --reason to match what suggestClassification/suggestProvenanceClass
 * currently returns for this invariant — fetch that first via the app's own
 * "suggest-classification" action if you intend to use this disposition).
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyProvenanceReclassification, readEvidenceProvenance, readReclassifications } from '@/services/research/experimentalPopulations';
import { getInvariantById, updateInvariant } from '@/services/invariants/store';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Same inline .env.local/.env.local.temp loader scripts/publish-independence-
 *  review.ts and scripts/run-independence-review.ts already use — mirrored,
 *  not reinvented. A standalone script never gets Next.js's own automatic
 *  .env.local loading (that only happens inside the Next dev/build/start
 *  process), so without this, `getSupabaseServer()` sees an empty
 *  `process.env` even when `.env.local` has real credentials on disk. */
function loadLocalEnv(): void {
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

function parseArgs() {
  const args = process.argv.slice(2);
  const flag = (name: string, fallback?: string) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
  };
  return {
    invariantId: flag('invariant-id'),
    to: flag('to'),
    evidenceRefs: (flag('evidence-refs', '') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    rationale: flag('rationale'),
    disposition: (flag('disposition', 'operator-selected') ?? 'operator-selected') as 'operator-selected' | 'recommendation-accepted',
    confidence: flag('confidence') ? Number(flag('confidence')) : undefined,
    reason: flag('reason'),
    primarySource: flag('primary-source') ?? null,
    confirm: args.includes('--confirm'),
  };
}

async function main() {
  loadLocalEnv();
  const args = parseArgs();
  if (!args.invariantId || !args.to || !args.rationale || args.evidenceRefs.length === 0) {
    console.error(
      'Usage: npx tsx scripts/repair-classify-provenance-record.ts ' +
        '--invariant-id=<uuid> --to=<class> --evidence-refs=<url[,url...]> --rationale="..." ' +
        '[--disposition=operator-selected|recommendation-accepted] [--confidence=N --reason="..."] [--confirm]',
    );
    process.exit(1);
  }
  if (args.disposition === 'recommendation-accepted' && (args.confidence === undefined || !args.reason)) {
    console.error("--disposition=recommendation-accepted requires --confidence=<0-100> and --reason=\"...\" matching the current machine suggestion.");
    process.exit(1);
  }

  const invariant = await getInvariantById(args.invariantId);
  if (!invariant) {
    console.error(`invariant '${args.invariantId}' not found`);
    process.exit(1);
  }

  const currentClass = readEvidenceProvenance(invariant.provenance);
  const priorLog = readReclassifications(invariant.provenance);

  console.log('--- CURRENT STATE ---');
  console.log(`invariant:          ${invariant.id}`);
  console.log(`statement:          ${invariant.statement}`);
  console.log(`namespace:          ${invariant.namespace}`);
  console.log(`status:             ${invariant.status}`);
  console.log(`current class:      ${currentClass ?? '(none — unclassified)'}`);
  console.log(`reclassification log entries: ${priorLog.length}`);
  if (priorLog.length > 0) {
    const latest = priorLog[priorLog.length - 1] as Record<string, unknown>;
    console.log(`latest entry:       to=${latest.to}, at=${latest.at}, actor=${latest.actor}, classDisposition=${latest.classDisposition ?? '(none — the defect shape)'}`);
  }
  console.log('');
  console.log('--- PROPOSED WRITE ---');
  console.log(`to:                 ${args.to}`);
  console.log(`evidenceRefs:       ${JSON.stringify(args.evidenceRefs)}`);
  console.log(`rationale:          ${args.rationale}`);
  console.log(`classDisposition:   ${args.disposition}`);

  const event = {
    to: args.to as Parameters<typeof applyProvenanceReclassification>[1]['to'],
    evidenceRefs: args.evidenceRefs,
    rationale: args.rationale,
    actor: 'operator-repair-script',
    at: new Date().toISOString(),
    classDisposition: args.disposition,
    ...(args.disposition === 'recommendation-accepted'
      ? {
          acceptedRecommendation: {
            suggestedClass: args.to,
            confidence: args.confidence as number,
            primarySource: args.primarySource,
            supportingSources: args.evidenceRefs.slice(1),
            reason: args.reason as string,
          },
        }
      : {}),
  };

  const result = applyProvenanceReclassification(invariant.provenance, event);
  if (!result.ok) {
    console.error(`\nREFUSED by applyProvenanceReclassification: ${result.error}`);
    process.exit(1);
  }

  console.log('\napplyProvenanceReclassification: OK — would set provenanceClass to', result.to);

  if (!args.confirm) {
    console.log('\nDRY RUN — nothing written. Re-run with --confirm to persist this exact write.');
    return;
  }

  await updateInvariant(args.invariantId, { provenance: result.provenance });
  console.log('\nWRITTEN. Re-run the read-only inspection SQL to confirm.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
