import { NextRequest, NextResponse } from 'next/server';
import { AgentPurposeWalletService } from '@/services/wallet/agentPurposeWalletService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ops/wallet/provision-owner-wallet
 *
 * Provisions the canonical OWNER/CONTROL wallet — the ONE `agent_keys` row
 * addressed directly by `runtimeAgentId` (never `agent_wallet_bindings`) —
 * used for Horizen Register/Verify/Claim signing (operator directive,
 * 2026-09-05 Factor/Aegis identity provisioning + security correction).
 *
 * This is the REPLACEMENT for `POST /api/admin/register-agent-keys`, which
 * the operator flagged as a security defect: its header comment claims
 * "Requires admin authorization" but the route has NO authorization check
 * at all — any caller who can reach it can create/regenerate/enumerate
 * every agent's wallet. Do not extend that route; it should be retired.
 * This route:
 *   - requires CRON_TRIGGER_TOKEN, same convention as every other
 *     /api/ops/** infra route (fail-closed: 503 if unconfigured, 401 if
 *     the provided token doesn't match);
 *   - requires SUPABASE_SERVICE_ROLE_KEY (AgentPurposeWalletService's own
 *     constructor now fails closed rather than falling back to an anon
 *     key);
 *   - requires AGENT_KEY_ENCRYPTION_SECRET, and refuses if it is unset OR
 *     equals AgentKeyService's known insecure default value;
 *   - is idempotent — an existing wallet is returned as-is, NEVER rotated;
 *   - never returns private key material, never logs it.
 *
 * Body: { runtimeAgentId: string, agentName: string, fioHandle?: string }.
 * No defaults — the caller must name the agent explicitly (unlike the
 * Nakamoto-defaulted purpose-wallet route, this creates a NEW agent's
 * primary identity wallet, which should never happen by accident).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided = request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { runtimeAgentId?: string; agentName?: string; fioHandle?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (!body.runtimeAgentId || !body.agentName) {
    return NextResponse.json({ ok: false, error: 'missing-required-field', detail: 'runtimeAgentId and agentName are required.' }, { status: 400 });
  }

  try {
    const service = new AgentPurposeWalletService();
    const result = await service.provisionOwnerWallet({
      runtimeAgentId: body.runtimeAgentId,
      agentName: body.agentName,
      fioHandle: body.fioHandle,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, refusalCode: result.refusalCode, detail: result.detail }, { status: 400 });
    }

    return NextResponse.json(
      { ok: true, created: result.created, runtimeAgentId: body.runtimeAgentId, address: result.address },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

/** GET shows what this route does — handy for verification without a POST. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      method: 'POST',
      description:
        'Provisions (or returns, if already provisioned) the canonical owner/control wallet for a NEW agent, ' +
        'directly in agent_keys (never agent_wallet_bindings). Body: { runtimeAgentId: string, agentName: string, ' +
        'fioHandle?: string }. Requires x-cron-token header (CRON_TRIGGER_TOKEN). Never returns private key material. ' +
        'Never rotates an existing wallet.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
