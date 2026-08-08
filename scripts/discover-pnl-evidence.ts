/**
 * Discover whether Horizen's Verifiable-PnL service has an independent,
 * attributable correlation record for a specific agent — read-only, never
 * submits/registers/signs/re-enrolls (operator directive, 2026-08-08):
 * "First, cheaply inspect the existing Horizen tools, schemas and code for
 * any read-only P&L status/proof/receipt/performance/reserves/disclosure
 * signal... If a read-only query returns a genuine P&L artifact
 * attributable to Nakamoto/8798 and independently verifiable... treat that
 * as sufficient evidence to issue the appropriate P&L DVN receipt... If no
 * such signal exists, stop there. Record P&L as evidence-pending."
 *
 * Idempotent — a genuinely already-verified agent short-circuits with no
 * live call. A negative/unreadable/unattributable result is reported as
 * evidence-pending and mints NOTHING — this never blocks the Journey and
 * never invents a substitute proof.
 *
 * Usage:
 *   npx tsx scripts/discover-pnl-evidence.ts --agent=nakamoto --actorPersonaId=<your persona uuid>
 *
 * Requires the same Supabase env vars the app itself uses
 * (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) in .env.local at the
 * repo root — loaded via dotenv, matching this repo's other standalone
 * operator scripts.
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { resolveRegistrableAgent } from '../services/horizen/registrableAgents';
import { discoverAndReceiptPnlServiceEvidence } from '../services/horizen/pnlServiceVerification';
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
    console.error('Usage: npx tsx scripts/discover-pnl-evidence.ts --agent=nakamoto --actorPersonaId=<your persona uuid>');
    console.error('actorPersonaId is required — the receipt this writes (only if evidence is found) is attributed to whoever ran it.');
    process.exit(1);
  }

  const agent = resolveRegistrableAgent(agentSlug);
  if (!agent) {
    console.error(`"${agentSlug}" is not a registrable agent.`);
    process.exit(1);
  }
  if (!agent.runtimeAgentId) {
    console.error(`${agent.displayName} has no runtimeAgentId configured — this is the required idempotency key and cannot be defaulted.`);
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
    console.error(`${agent.displayName} has no Horizen tokenId yet — Register has not completed, so there is nothing to correlate PnL evidence against.`);
    process.exit(1);
  }
  const network = (binding.network ?? 'base-sepolia') as HorizenNetwork;

  console.log(`Discovering Verifiable-PnL correlation for ${agent.displayName} (token ${binding.token_id}, ${network}) via a read-only Horizen correlation…`);
  const result = await discoverAndReceiptPnlServiceEvidence({
    aigentQubeId: agent.aigentQubeId,
    subjectRegistryAlias: binding.token_id,
    network,
    actorPersonaId,
    runtimeAgentId: agent.runtimeAgentId,
  });

  if (!result.verified) {
    console.log(`Evidence-pending (${result.reason}): ${result.detail}`);
    console.log(`\nOpen Horizen contract question: ${result.openContractQuestion}`);
    console.log('\nNothing was minted. This does NOT block the Journey — Pulse Verified already closes Ratify independently of P&L.');
    return;
  }

  if (result.alreadyVerified) {
    console.log(`Already verified — receiptRef ${result.receiptRef} already carries evidence. Nothing written, no live call made.`);
  } else {
    console.log(`Verified. New receiptRef: ${result.receiptRef}`);
  }
  console.log('Evidence:', JSON.stringify(result.evidence, null, 2));
}

main().catch((err) => {
  console.error('Discovery script failed:', err);
  process.exit(1);
});
