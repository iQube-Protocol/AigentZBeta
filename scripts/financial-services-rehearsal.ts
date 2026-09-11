/**
 * Track B — Financial Services Runtime consumer rehearsal (Phase 3 freeze
 * ruling, 2026-08-22). "Prove: consumer A, consumer B, Agent-N all use the
 * same service request/orchestration implementation with no source branch."
 *
 * Runs the FULL, REAL `requestFinancialService()` lifecycle — discover ->
 * request -> eligibility -> orchestration -> result -> receipt ->
 * Standing/evidence — for Aigent Nakamoto, then Aigent Kn0w1, through the
 * IDENTICAL call. No fixture stand-ins, no bypassed gate: this script calls
 * exactly the same functions the production route(s) will call, against a
 * REAL Supabase-backed admin/Standing/capability-registry read where
 * `getSupabaseServer()` resolves credentials.
 *
 * Consumer model (operator ruling, 2026-08-22): the requestingAgentId is
 * ALWAYS an admitted, delegated agent (MoneyPenny/Nakamoto/Kn0w1) — never a
 * human persona. This script rehearses exactly that: an agent consuming a
 * MoneyPenny Financial Service, oversight-console style.
 *
 * Honesty note (mirrors `scripts/vela-slice2g-live-proof.ts`'s own
 * disclosure): this sandbox has NO live Supabase credentials
 * (`docs/vela/VELA_EARLY_ACCESS_HANDOFF.md` §6 already documents this as a
 * data/deployment gap, not a code gap, for the same reason). When
 * `getSupabaseServer()` returns null, this script does NOT fabricate a
 * result — it reports plainly that a live rehearsal requires real dev
 * credentials, and points at the exact test-suite evidence that already
 * proves the mechanism (`tests/financial-services-runtime.test.ts`) as the
 * nearest verifiable proxy available in this environment.
 *
 * Usage (against a real dev environment with SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY set):
 *   npx tsx scripts/financial-services-rehearsal.ts [--out <path>]
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { getSupabaseServer } from '../app/api/_lib/supabaseServer';
import { discoverFinancialServicesForConsumer } from '../services/financialServices/discovery';
import { requestFinancialService } from '../services/financialServices/serviceRequestOrchestrator';
import { MONEYPENNY_ADVISOR } from '../services/financialServices/serviceCatalog';
import type { ConsequenceForecast } from '../types/consequence';

interface RehearsalStepEvidence {
  consumerAgentId: string;
  discovery: Awaited<ReturnType<typeof discoverFinancialServicesForConsumer>> | null;
  requestOutcome: Awaited<ReturnType<typeof requestFinancialService>>['outcome'] | null;
  causalChain: Awaited<ReturnType<typeof requestFinancialService>>['causalChain'] | null;
  error: string | null;
}

function forecast(): ConsequenceForecast {
  return {
    seedInvariantIds: ['inv.finance.001'],
    nodes: [],
    enables: 1,
    constrains: 0,
    contradicts: 0,
    forcesEscalation: false,
    constitutionalConstraint: false,
    constitutionalConstraintIds: [],
    rationale: 'financial-services-rehearsal: no reachable constraint or contradiction',
  };
}

/**
 * 2026-08-23 repair pass (Repair C/F): the caller no longer supplies a
 * synthetic `ConstitutionalAuthority` or a client-asserted
 * `standingPersonaId` — both are resolved server-side, inside
 * `requestFinancialService()`, from the AUTHENTICATED principal directing
 * the agent. This rehearsal script has no real human session to authenticate
 * as, so it passes `actorPersonaId: null` — an honest "no principal" rather
 * than a fabricated one, which the real Supabase-backed run will surface as
 * `NOT_DELEGATED_TO_CURRENT_PRINCIPAL` / a `NONE`-state authority, not a
 * silently-granted one.
 */
async function rehearseConsumer(consumerAgentId: string): Promise<RehearsalStepEvidence> {
  const admin = getSupabaseServer();
  if (!admin) {
    return {
      consumerAgentId,
      discovery: null,
      requestOutcome: null,
      causalChain: null,
      error: 'NO_LIVE_SUPABASE_CREDENTIALS',
    };
  }

  console.log(`\n=== ${consumerAgentId} — discover ===`);
  const discovery = await discoverFinancialServicesForConsumer(consumerAgentId, admin);
  if (discovery.ok) {
    for (const d of discovery.services) {
      console.log(`  ${d.definition.serviceId} (${d.definition.providerMode}/${d.definition.serviceClass}) -> eligible=${d.eligibility.eligible} [${d.eligibility.code}]`);
    }
  } else {
    console.log(`  discovery error: ${discovery.error}`);
  }

  console.log(`=== ${consumerAgentId} — request (${MONEYPENNY_ADVISOR.serviceId}) ===`);
  const { outcome, causalChain } = await requestFinancialService({
    request: {
      requestRef: `rehearsal-${consumerAgentId}-${MONEYPENNY_ADVISOR.serviceId}`,
      serviceId: MONEYPENNY_ADVISOR.serviceId,
      requestingAgentId: consumerAgentId,
      input: { intent: `Rehearsal request from ${consumerAgentId}` },
    },
    publicForecast: forecast(),
    confidentialEvidence: null,
    actorPersonaId: null,
    callerAuthProfileId: null,
    now: new Date().toISOString(),
    admin,
  });
  console.log(`  status=${outcome.status} reason=${outcome.reason}`);
  console.log(`  receipts/Standing: best-effort, see live Supabase activity_receipts / standing tables`);

  return { consumerAgentId, discovery, requestOutcome: outcome, causalChain, error: null };
}

async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outPath = outIdx >= 0 ? args[outIdx + 1] : `${process.cwd()}/scratchpad/financial-services-rehearsal-evidence.json`;

  const admin = getSupabaseServer();
  const live = admin !== null;

  if (!live) {
    console.error(
      '\n[financial-services-rehearsal] No live Supabase credentials found (SUPABASE_URL / ' +
        'SUPABASE_SERVICE_ROLE_KEY unset). This is the same documented gap as ' +
        'docs/vela/VELA_EARLY_ACCESS_HANDOFF.md §6 — a data/deployment gap, not a code gap.\n' +
        'This script calls requestFinancialService()/discoverFinancialServicesForConsumer() ' +
        'UNCHANGED — it will run a genuine live rehearsal the moment it is run in an ' +
        'environment with real dev credentials set.\n' +
        'The nearest verifiable proxy available right now is the test suite, which exercises ' +
        'the identical function with the identical Nakamoto/Kn0w1 consumers against a real ' +
        'constitutional-commerce core and mocked DB seams: ' +
        'npx vitest run tests/financial-services-runtime.test.ts\n',
    );
  }

  const results: RehearsalStepEvidence[] = [];
  for (const agentId of ['aigent-nakamoto', 'aigent-kn0w1'] as const) {
    results.push(await rehearseConsumer(agentId));
  }

  const evidence = {
    generatedBy: 'scripts/financial-services-rehearsal.ts',
    live,
    note: live
      ? 'Live rehearsal against real Supabase-backed admission/Standing/capability state.'
      : 'NOT a live rehearsal — no Supabase credentials were available in this environment. ' +
        'Re-run this script in an environment with SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY set ' +
        'for a genuine live result.',
    results,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(evidence, null, 2));
  console.log(`\nEvidence written to ${outPath}`);

  if (!live) process.exitCode = 2;
}

main().catch((err) => {
  console.error('[financial-services-rehearsal] fatal:', err);
  process.exitCode = 1;
});
