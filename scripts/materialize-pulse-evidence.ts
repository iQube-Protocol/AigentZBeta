/**
 * Materialize receipted Pulse evidence for an ALREADY-CONFIRMED authorization
 * — the acceptance test for the receipted-constitutional-state work
 * (operator directive, 2026-08-08): "verify Nakamoto's existing confirmed
 * Pulse evidence can be converted/idempotently materialized into the new
 * pulse_enrollment_verified/pulse_commitment_verified receipts, and the
 * Journey subsequently renders its green state from those receipts without
 * another Horizen call."
 *
 * CALLS NOTHING THAT MUTATES HORIZEN. This never contacts the partner — it
 * reads the historical `partnerStatus` snapshot already persisted on the
 * `partner_authorization_requests` row at confirmation time, extracts its
 * structured fields, and writes the two fine-grained receipts from that.
 * Idempotent — safe to run more than once; a row that already has receipted
 * evidence is reported as such and nothing further is written.
 *
 * Usage:
 *   npx tsx scripts/materialize-pulse-evidence.ts --agent=nakamoto --actorPersonaId=<your persona uuid>
 *
 * Requires the same Supabase env vars the app itself uses
 * (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) in .env.local at the
 * repo root — loaded via dotenv, matching this repo's other standalone
 * operator scripts (e.g. scripts/apply-content-rls-fix.ts), not assumed to
 * already be exported in the shell.
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { resolveRegistrableAgent } from '../services/horizen/registrableAgents';
import { materializePulseEvidenceFromHistoricalConfirmation } from '../services/horizen/authorizationClient';
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
    console.error('Usage: npx tsx scripts/materialize-pulse-evidence.ts --agent=nakamoto --actorPersonaId=<your persona uuid>');
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
    console.error('Supabase configuration missing — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this shell.');
    process.exit(1);
  }

  const { resolveHorizenRegistrationBinding } = await import('../services/horizen/agentRegistrationBinding');
  const { binding } = await resolveHorizenRegistrationBinding(admin, agent);
  if (!binding?.token_id) {
    console.error(`${agent.displayName} has no Horizen tokenId yet — Register has not completed, so there is no authorization to materialize evidence for.`);
    process.exit(1);
  }
  const network = (binding.network ?? 'base-sepolia') as HorizenNetwork;
  const authorizationId = `horizen-pulse-auth-${agent.aigentQubeId}-${binding.token_id}-${network}`;

  console.log(`Materializing Pulse evidence for ${agent.displayName} (${authorizationId})…`);
  const result = await materializePulseEvidenceFromHistoricalConfirmation(authorizationId, {
    actorPersonaId,
    registry: { network, tokenId: binding.token_id },
    runtimeAgentId: agent.runtimeAgentId,
  });

  if (!result.ok) {
    console.error(`Refused: ${result.refusalCode} — ${result.detail}`);
    process.exit(1);
  }

  if (result.alreadyMaterialized) {
    console.log(`Already materialized — receiptRef ${result.receiptRef} already carries structured evidence. Nothing written.`);
  } else {
    console.log(`Materialized. New receiptRef: ${result.receiptRef}`);
  }
  console.log('Evidence:', JSON.stringify(result.evidence, null, 2));
  console.log('\nNow reload the Journey and confirm the Ratify/Transparency section renders green from this — no Horizen call should occur on that read.');
}

main().catch((err) => {
  console.error('Materialization script failed:', err);
  process.exit(1);
});
