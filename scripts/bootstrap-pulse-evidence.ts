/**
 * Bootstrap receipted Pulse evidence for an ALREADY-CONFIRMED authorization
 * whose historical partnerStatus snapshot predates structured extraction —
 * the case `scripts/materialize-pulse-evidence.ts` correctly refuses
 * (NO_HISTORICAL_SNAPSHOT). This makes the ONE live get_onboarding_status
 * call that case needs, once, to establish receipted evidence for the first
 * time (operator directive, 2026-08-08).
 *
 * NEVER SIGNS, SUBMITS, OR RE-ENROLLS, AND NEVER TOUCHES AUTHORIZATION STATE.
 * Idempotent — a row that already carries receipted evidence is reported as
 * such and nothing further is written or called. After a successful run,
 * ordinary reconciliation (POST /api/journey/moneypenny-horizen/verify/reconcile)
 * is the only external reread mechanism this row needs going forward.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-pulse-evidence.ts --agent=nakamoto --actorPersonaId=<your persona uuid>
 *
 * Requires the same Supabase env vars the app itself uses
 * (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) in .env.local at the
 * repo root — loaded via dotenv, matching this repo's other standalone
 * operator scripts (e.g. scripts/apply-content-rls-fix.ts).
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { resolveRegistrableAgent } from '../services/horizen/registrableAgents';
import { bootstrapPulseEvidenceFromLiveReread } from '../services/horizen/authorizationClient';
import type { HorizenNetwork } from '../services/horizen/identity';
import { getSupabaseServer } from '../app/api/_lib/supabaseServer';

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

async function main() {
  const agentSlug = arg('agent') ?? 'nakamoto';
  const actorPersonaId = arg('actorPersonaId');
  if (!actorPersonaId) {
    console.error('Usage: npx tsx scripts/bootstrap-pulse-evidence.ts --agent=nakamoto --actorPersonaId=<your persona uuid>');
    console.error('actorPersonaId is required — the receipt this writes is attributed to whoever ran it, never a guessed or default persona.');
    process.exit(1);
  }

  const agent = resolveRegistrableAgent(agentSlug);
  if (!agent) {
    console.error(`"${agentSlug}" is not a registrable agent.`);
    process.exit(1);
  }

  const admin = getSupabaseServer();
  if (!admin) {
    console.error('Supabase configuration missing — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');
    process.exit(1);
  }

  const { resolveHorizenRegistrationBinding } = await import('../services/horizen/agentRegistrationBinding');
  const { binding } = await resolveHorizenRegistrationBinding(admin, agent);
  if (!binding?.token_id) {
    console.error(`${agent.displayName} has no Horizen tokenId yet — Register has not completed, so there is no authorization to bootstrap evidence for.`);
    process.exit(1);
  }
  const network = (binding.network ?? 'base-sepolia') as HorizenNetwork;
  const authorizationId = `horizen-pulse-auth-${agent.aigentQubeId}-${binding.token_id}-${network}`;

  console.log(`Bootstrapping Pulse evidence for ${agent.displayName} (${authorizationId}) via a live get_onboarding_status reread…`);
  const result = await bootstrapPulseEvidenceFromLiveReread(authorizationId, {
    actorPersonaId,
    registry: { network, tokenId: binding.token_id },
    runtimeAgentId: agent.runtimeAgentId,
  });

  if (!result.ok) {
    console.error(`Refused: ${result.refusalCode} — ${result.detail}`);
    process.exit(1);
  }

  if (result.alreadyBootstrapped) {
    console.log(`Already bootstrapped — receiptRef ${result.enrollmentReceiptRef} already carries structured evidence. Nothing written, no live call made.`);
  } else {
    console.log(`Bootstrapped. Enrollment receiptRef: ${result.enrollmentReceiptRef}${result.commitmentReceiptRef ? `, commitment receiptRef: ${result.commitmentReceiptRef}` : ' (no commitment evidence in this read)'}`);
  }
  console.log('Evidence:', JSON.stringify(result.evidence, null, 2));
  console.log('\nNow reload the Journey and confirm the Ratify/Transparency section renders green from this receipt.');
}

main().catch((err) => {
  console.error('Bootstrap script failed:', err);
  process.exit(1);
});
