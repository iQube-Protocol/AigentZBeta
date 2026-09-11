/**
 * VL-CT-001 — the DEPLOYMENT GATE for venture receipt emission (operator
 * RULING 1, 2026-07-29).
 *
 *   > `ventureReceiptDeploymentCheck()` is exported and unused. Wire it into
 *   > the Amplify deployment pipeline: after migrations, before application
 *   > promotion. Deployment must FAIL on incompatibility.
 *
 * ─── Why a build step and not only a runtime guard ─────────────────────────
 *
 * The nine venture action types are declared twice — the TypeScript
 * `ActivityActionType` union and the `activity_receipts` CHECK constraint. A
 * build carrying the types against a database that has not had the migration
 * applied typechecks, passes every canary, and deploys green. The breakage
 * surfaces later, as a check violation inside a receipt write that several call
 * sites in this repo wrap in an empty catch: the row is discarded, its DVN
 * anchor with it, and the provenance gap is discovered during the audit that
 * needed the provenance.
 *
 * Promoting an artifact that cannot write its own receipts is the failure. This
 * step refuses to promote it.
 *
 * ─── Two layers, different frequencies ─────────────────────────────────────
 *
 *   deploy-time (HERE)  — the gate. Runs ONCE per build, exits non-zero on any
 *                         incompatibility, so the artifact is never promoted.
 *   emission-time       — the backstop. `persistVentureReceipt` /
 *                         `anchorVentureReceipt` re-check before the writer,
 *                         memoised per process, for the window in which a
 *                         running deployment outlives the schema it was
 *                         promoted against. Deliberately NOT a per-request or
 *                         cold-start probe.
 *
 * ─── FAIL CLOSED ───────────────────────────────────────────────────────────
 *
 * Probe missing, probe revoked, credentials absent, network unreachable,
 * constraint absent, vocabulary short — every one of them exits 1. "Could not
 * tell" is not "compatible"; a gate that passes on uncertainty is the quiet
 * failure it was built to replace, one layer up.
 *
 * There is no bypass flag. A gate with an escape hatch is a gate that gets
 * escaped, and the thing on the far side of this one is the integrity of the
 * receipt trail.
 *
 * ─── It adds no logic of its own ───────────────────────────────────────────
 *
 * The decision is `ventureReceiptDeploymentCheck()` in
 * `services/venture/trading/receiptCompatibility.ts`, called with its default
 * service-role probe. This file is credentials, an exit code, and an operator
 * message — nothing about compatibility is decided here.
 *
 * Run:  npx tsx scripts/check-venture-receipt-constraint.ts
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';

// The Amplify build writes .env.production immediately before this step
// (scripts/create-env-production.js). Amplify's own env vars also reach Node
// directly, so either source is enough; loading the file as well means the
// gate reads exactly the configuration the promoted artifact will run with.
for (const file of ['.env.production', '.env.local']) {
  const path = join(process.cwd(), file);
  // dotenv does not overwrite an already-set variable, so an Amplify-injected
  // value always wins over the file.
  if (existsSync(path)) dotenv.config({ path });
}

async function main(): Promise<void> {
  const { ventureReceiptDeploymentCheck, VENTURE_RECEIPT_CONSTRAINT_PROBE } = await import(
    '@/services/venture/trading/receiptCompatibility'
  );

  console.log('=== VL-CT-001 venture receipt constraint gate ===');

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Named separately from the generic failure because it is the one cause
    // with a different fix: the probe is service-role-only since
    // 20260929000200, so an anon key cannot verify anything.
    console.error(
      `[VENTURE RECEIPT GATE] SUPABASE_SERVICE_ROLE_KEY is not set in this build environment. ` +
        `public.${VENTURE_RECEIPT_CONSTRAINT_PROBE}() is executable by service_role ONLY ` +
        `(supabase/migrations/20260929000200_venture_receipt_probe_lockdown.sql), so the deployed ` +
        `receipt vocabulary cannot be verified without it. Set SUPABASE_SERVICE_ROLE_KEY in the ` +
        `Amplify branch environment variables and rebuild.`,
    );
    process.exit(1);
  }

  const compatibility = await ventureReceiptDeploymentCheck();

  if (!compatibility.compatible) {
    console.error('[VENTURE RECEIPT GATE] DEPLOYMENT REFUSED');
    console.error(`  reason:  ${compatibility.reason}`);
    console.error(`  missing: ${compatibility.missingActionTypes.join(', ') || '(none reported)'}`);
    console.error(`  remedy:  ${compatibility.remedy}`);
    console.error(
      '  Apply the migrations in the Supabase SQL editor, then re-run this build. ' +
        'The verification query is in codexes/packs/agentiq/updates/2026-07-29_vl-ct-001-deployment-gate-and-probe-lockdown.md.',
    );
    process.exit(1);
  }

  console.log(
    `[VENTURE RECEIPT GATE] OK — the deployed activity_receipts constraint accepts all nine venture ` +
      `action types at ${compatibility.requiredVersion}.`,
  );
}

main().catch((error: unknown) => {
  // An unexpected throw is still a failure to verify, and a failure to verify
  // is a refusal. Nothing about this path may fall through to exit 0.
  console.error(
    '[VENTURE RECEIPT GATE] DEPLOYMENT REFUSED — the gate itself failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
