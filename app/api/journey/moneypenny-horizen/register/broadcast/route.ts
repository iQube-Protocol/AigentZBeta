/**
 * POST /api/journey/moneypenny-horizen/register/broadcast
 *
 * Register stage, step 2 of 3 (agent-selectable, 2026-07-31,
 * services/horizen/registrationClient.ts). Signs the EXACT unsigned tx the
 * operator reviewed in step 1 (re-supplied in the body, never re-built here —
 * signing a freshly re-built tx would defeat the review) with the target
 * agent's owner wallet private key, and submits it via Horizen's MCP
 * submit_registry_tx. Requires `confirm: true` — this route refuses to sign
 * or submit without it, mirroring the CLI script's typed-"yes" gate.
 *
 * The owner private key is resolved from the agent's OWN custodied wallet
 * (AgentKeyService, keyed by `agent.runtimeAgentId` — the SAME AGENT_KEY_REF
 * Verify's authorize route and Claim's prove-control route already sign
 * with), never a per-agent env var (operator ruling 2026-08-01, replacing
 * the old MONEYPENNY_OWNER_WALLET_PRIVATE_KEY / NAKAMOTO_OWNER_WALLET_PRIVATE_KEY
 * dependency — "the Register stage must use Aigent Nakamoto's existing agent
 * wallet through the wallet signing boundary"). The decrypted key is read
 * once into this handler's local scope to hand to broadcastAgentRegistration
 * and is never logged, never returned — only the resulting transaction hash
 * leaves this function.
 *
 * Does NOT write a completion receipt — broadcasting is not confirmation
 * ("a successful signature without a successful reread is not completion",
 * the same principle GJR-VFY-001's authorizationClient.ts already enforces).
 * The register/status route writes horizen_agent_registered only once
 * Horizen's own onboarding-status tool and a registry reread both confirm.
 *
 * Spine-gated: getActivePersona resolves the operator, never the agent's own
 * identity — this is the operator authorizing a real, gas-spending,
 * irreversible on-chain transaction on the agent's behalf.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveRegistrableAgent } from '@/services/horizen/registrableAgents';
import { broadcastAgentRegistration } from '@/services/horizen/registrationClient';
import { AgentKeyService } from '@/services/identity/agentKeyService';

export const dynamic = 'force-dynamic';

const DEFAULT_RPC = 'https://sepolia.base.org';

interface BroadcastBody {
  agentSlug?: string;
  confirm?: boolean;
  unsignedTx?: { to?: string; data?: string; value?: string | number; chainId?: string | number };
}

export async function POST(request: NextRequest) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  let body: BroadcastBody = {};
  try {
    body = (await request.json()) as BroadcastBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }

  if (!body.agentSlug) {
    return NextResponse.json({ ok: false, error: 'agentSlug is required' }, { status: 400 });
  }
  const agent = resolveRegistrableAgent(body.agentSlug);
  if (!agent) {
    return NextResponse.json({ ok: false, refusalCode: 'UNKNOWN_AGENT', error: `"${body.agentSlug}" is not a registrable agent` }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json(
      { ok: false, refusalCode: 'CONFIRM_REQUIRED', error: 'confirm must be true — this broadcasts a real, gas-spending, irreversible on-chain transaction' },
      { status: 400 },
    );
  }
  if (!body.unsignedTx?.to || !body.unsignedTx?.data) {
    return NextResponse.json({ ok: false, error: 'unsignedTx (from register/prepare) is required' }, { status: 400 });
  }

  // The agent's own custodied wallet — the SAME agent_keys row Verify's
  // authorize route and Claim's prove-control route already sign with
  // (AGENT_KEY_REF = agent.runtimeAgentId). Never a per-agent env var.
  const agentKeys = await new AgentKeyService().getAgentKeys(agent.runtimeAgentId);
  const ownerPrivateKey = agentKeys?.evmPrivateKey;
  if (!ownerPrivateKey) {
    return NextResponse.json(
      {
        ok: false,
        refusalCode: 'OWNER_KEY_NOT_CONFIGURED',
        error: `${agent.displayName} has no custodied wallet on record (agent_keys, runtimeAgentId "${agent.runtimeAgentId}") — the operator must provision it before ${agent.displayName} can be registered`,
      },
      { status: 409 },
    );
  }

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || DEFAULT_RPC;

  const result = await broadcastAgentRegistration({
    agentSlug: agent.slug,
    unsignedTx: body.unsignedTx,
    confirm: true,
    ownerPrivateKey,
    rpcUrl,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, refusalCode: result.refusalCode, error: result.detail }, { status: 422 });
  }
  return NextResponse.json({ ok: true, ...result.value });
}
