/**
 * POST /api/journey/moneypenny-horizen/register/status
 *
 * Register stage, step 3 of 3 (agent-selectable, 2026-07-31,
 * services/horizen/registrationClient.ts). ONE status check against
 * Horizen's get_onboarding_status — never an internal polling loop (a
 * 10-attempt/15s-apart poll, the CLI script's own posture, does not fit a
 * serverless request lifecycle). The Register stage UI re-invokes this on an
 * interval until `confirmed: true`.
 *
 * On confirmation, persists the resolved tokenId/registryAlias onto the
 * agent's canonical AigentQube record (registry_assets, the SAME
 * external_registry_bindings[0] Verify/Claim already read from — never a
 * second source of truth) and writes the horizen_agent_registered receipt
 * the journey `state` route has been checking for since Phase 2 but that no
 * route has ever written until now.
 *
 * Spine-gated: getActivePersona resolves the operator, recorded as the
 * receipt's principal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { resolveRegistrableAgent } from '@/services/horizen/registrableAgents';
import { checkAgentRegistrationStatus } from '@/services/horizen/registrationClient';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type { ExternalAgentRegistryBinding } from '@/types/registry-canonical';
import type { HorizenNetwork } from '@/services/horizen/identity';

export const dynamic = 'force-dynamic';

interface StatusBody {
  agentSlug?: string;
  txHash?: string;
  ownerWalletAddress?: string;
  network?: string;
}

async function updateRegistryAssetBinding(aigentQubeId: string, patch: { tokenId: string; registryAlias: string }) {
  const admin = getSupabaseServer();
  if (!admin) return;
  const { data: row } = await admin.from('registry_assets').select('metadata').eq('asset_id', aigentQubeId).maybeSingle();
  if (!row) return;
  const metadata = (row.metadata ?? {}) as { external_registry_bindings?: ExternalAgentRegistryBinding[] };
  const bindings = Array.isArray(metadata.external_registry_bindings) ? [...metadata.external_registry_bindings] : [];
  if (bindings.length === 0) return;
  bindings[0] = { ...bindings[0], token_id: patch.tokenId, registry_alias: patch.registryAlias, status: 'registered' };
  await admin.from('registry_assets').update({ metadata: { ...metadata, external_registry_bindings: bindings }, updated_at: new Date().toISOString() }).eq('asset_id', aigentQubeId);
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  let body: StatusBody = {};
  try {
    body = (await request.json()) as StatusBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }
  if (!body.agentSlug || !body.txHash || !body.ownerWalletAddress || !body.network) {
    return NextResponse.json({ ok: false, error: 'agentSlug, txHash, ownerWalletAddress and network are all required' }, { status: 400 });
  }
  const agent = resolveRegistrableAgent(body.agentSlug);
  if (!agent) {
    return NextResponse.json({ ok: false, refusalCode: 'UNKNOWN_AGENT', error: `"${body.agentSlug}" is not a registrable agent` }, { status: 400 });
  }

  const result = await checkAgentRegistrationStatus(
    {
      agentSlug: agent.slug,
      txHash: body.txHash,
      ownerWalletAddress: body.ownerWalletAddress,
      network: body.network as HorizenNetwork,
      actorPersonaId: persona.personaId,
    },
    {
      updateRegistryAssetBinding,
      createRegistrationReceipt: async ({ actorPersonaId, agent: a, network, txHash }) => {
        const receipt = await createActivityReceipt({
          personaId: actorPersonaId,
          activeCartridge: 'agentiq',
          actionType: 'horizen_agent_registered',
          summary: `${a.displayName} registered in Horizen's ERC-8004 registry (${network}, tx ${txHash})`,
          agentsInvoked: [a.runtimeAgentId],
          actionInput: { aigentQubeId: a.aigentQubeId, network, txHash },
        });
        return receipt?.id ?? null;
      },
    },
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, refusalCode: result.refusalCode, error: result.detail }, { status: 422 });
  }
  return NextResponse.json({ ok: true, ...result.value });
}
