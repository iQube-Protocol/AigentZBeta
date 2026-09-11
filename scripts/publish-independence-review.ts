#!/usr/bin/env npx tsx
/**
 * publish-independence-review.ts — governed publication of a completed,
 * CLI-executed independent review into Supabase (research_objects), the
 * store the Review Result panel actually reads.
 *
 * Deliberately separate from `run-independence-review.ts --execute`:
 * execution and publication are distinct governed acts (operator ruling
 * 2026-07-31). Fixes the incident where the runner's real completed result
 * was written only to local files (it is documented as read-only to the
 * database) while the web UI's Review Result panel could only ever show
 * whatever the web UI itself had written — an empty 'planned' placeholder.
 *
 * Usage:
 *   npx tsx scripts/publish-independence-review.ts \
 *     --review-dir codexes/packs/irl/foundation/reviews \
 *     --review-id review.vP1.4e379af743c8 \
 *     [--supersedes review.vP1.0eeba9fd8910 --supersede-reason "..."]
 *
 * Reads exactly the artifact set run-independence-review.ts writes for one
 * reviewId: <review-dir>/<reviewId>.{package,decisions,resolutions,receipt}.json
 * (the other files that runner writes — pre-run-manifest, raw-outputs,
 * relations, exclusions — are not required for publication).
 *
 * Refuses (exit 2) unless every artifact is present and every hash/tally
 * cross-check in services/research/independentReviewPublish.ts passes.
 * Never partially writes: validation happens entirely before any Supabase
 * call.
 *
 * --supersedes is OPTIONAL and must be supplied explicitly — this script
 * never guesses which prior row is "the stale one" to mark superseded.
 * Omit it if there is no prior placeholder row to supersede.
 *
 * This is a RECEIPT IMPORT, not a governed resolution. It writes NO
 * action/actionReason/actionByRef — accept/revise/defer/reject on the
 * published review remains a separate, later, human act via the Review
 * Result panel.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { validateAndBuildPublishedReview, type CompletedReviewArtifacts } from '@/services/research/independentReviewPublish';
import { upsertReview, markReviewSuperseded, getReview } from '@/services/research/independentReviewStore';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Same inline .env.local/.env.local.temp loader run-independence-review.ts
 * uses — mirrored, not reinvented, so this script picks up the operator's
 * existing local env exactly the way its sibling runner already does. */
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

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

function readRequiredJson(path: string): unknown {
  if (!existsSync(path)) {
    throw new PublishCliRefusal(`required artifact missing: ${path}`);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new PublishCliRefusal(`artifact is not valid JSON: ${path} (${e instanceof Error ? e.message : String(e)})`);
  }
}

class PublishCliRefusal extends Error {}

async function main() {
  loadLocalEnv();

  const reviewDir = arg('review-dir');
  const reviewId = arg('review-id');
  const supersedes = arg('supersedes');
  const supersedeReason = arg('supersede-reason');

  if (!reviewDir || !reviewId) {
    console.error('Usage: publish-independence-review.ts --review-dir <dir> --review-id <reviewId> [--supersedes <reviewId> --supersede-reason "..."]');
    process.exit(2);
  }
  if (supersedes && !supersedeReason) {
    console.error('Refusing: --supersedes requires --supersede-reason (an unexplained supersede is a stray click in the audit trail).');
    process.exit(2);
  }

  const base = join(reviewDir, reviewId);

  let artifacts: CompletedReviewArtifacts;
  try {
    artifacts = {
      package: readRequiredJson(`${base}.package.json`) as CompletedReviewArtifacts['package'],
      decisions: readRequiredJson(`${base}.decisions.json`) as CompletedReviewArtifacts['decisions'],
      resolutions: readRequiredJson(`${base}.resolutions.json`) as CompletedReviewArtifacts['resolutions'],
      receipt: readRequiredJson(`${base}.receipt.json`) as CompletedReviewArtifacts['receipt'],
    };
  } catch (e) {
    if (e instanceof PublishCliRefusal) {
      console.error(`REFUSED: ${e.message}`);
      console.error('The complete artifact set (package, decisions, resolutions, receipt) is required — nothing was written.');
      process.exit(2);
    }
    throw e;
  }

  const importedAt = new Date().toISOString();
  const result = validateAndBuildPublishedReview(artifacts, reviewId, { artifactDir: reviewDir, importedAt });

  if (!result.ok) {
    console.error(`REFUSED (${result.refusalCode}): ${result.message}`);
    console.error('No write was made — a refused import never partially writes.');
    process.exit(2);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(2);
  }
  const admin = createClient(url, key, { auth: { persistSession: false } });

  // Idempotent: re-running with the same artifacts upserts the SAME
  // reviewId to the SAME content — never mints a second row.
  const alreadyPublished = await getReview(admin, reviewId);
  await upsertReview(admin, result.record);

  if (supersedes && supersedeReason) {
    await markReviewSuperseded(admin, supersedes, reviewId, supersedeReason);
    console.log(`Marked ${supersedes} as superseded by ${reviewId}.`);
  }

  console.log(`\n${alreadyPublished ? 'Re-published' : 'Published'} ${reviewId}:`);
  console.log(`  agreed    ${result.record.resolutions.filter((r) => r.status === 'agreed').length}`);
  console.log(`  contested ${result.record.resolutions.filter((r) => r.status === 'contested').length}`);
  console.log(`  rejected  ${result.record.resolutions.filter((r) => r.status === 'rejected').length}`);
  console.log(`  unknown   ${result.record.resolutions.filter((r) => r.status === 'unknown').length}`);
  console.log(`  queueState: ${result.record.queueState}`);
  console.log('\nThis is a receipt import, not a governed resolution. It does not ratify, grant Standing,');
  console.log('change lifecycle state, or freeze anything. accept/revise/defer/reject on this review');
  console.log('remains a separate, later act via the Review Result panel.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
