import { NextRequest, NextResponse } from 'next/server';
import { AgentPurposeWalletService, type AgentWalletRole } from '@/services/wallet/agentPurposeWalletService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ops/wallet/provision-agent-wallet
 *
 * Provisions a purpose-bound agent wallet through the generic
 * `agent_wallet_bindings` binding (Horizen Pilot Closure part 2/3,
 * operator directive 2026-08-09). Generic across agent + role — this pass
 * is used for exactly one case: `aigent-nakamoto` / `trading`, for
 * Horizen's Verifiable-PnL requirement that the trading wallet differ from
 * the ERC-8004 owner wallet.
 *
 * Idempotent: if a binding already exists for (agentRuntimeId, walletRole)
 * it is returned as-is — never regenerated, never overwritten. Refuses the
 * 'owner' role outright (see agentPurposeWalletService.ts) — that wallet
 * stays solely in `agent_keys`, addressed directly by runtimeAgentId.
 *
 * Requires the `agent_wallet_bindings` table (migration
 * 20260930001300_agent_wallet_bindings.sql) to already exist live — this
 * route does not create it; DDL is applied by the operator via the
 * Supabase SQL editor, per this repo's established pattern (no exec_sql
 * RPC on this project).
 *
 * Returns the wallet's PUBLIC address only. The private key never leaves
 * AgentKeyService's custody boundary.
 *
 * Auth: CRON_TRIGGER_TOKEN, same convention as the other /api/ops/** infra
 * routes.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_TRIGGER_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'cron_token_not_configured' }, { status: 503 });
  }
  const provided =
    request.headers.get('x-cron-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { agentRuntimeId?: string; walletRole?: AgentWalletRole; network?: string; chainId?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const agentRuntimeId = body.agentRuntimeId || 'aigent-nakamoto';
  const walletRole: AgentWalletRole = body.walletRole || 'trading';
  const network = body.network || 'base-mainnet';
  const chainId = body.chainId ?? 8453;

  try {
    const service = new AgentPurposeWalletService();
    const result = await service.provisionPurposeWallet({ agentRuntimeId, walletRole, network, chainId });

    if (!result.ok) {
      return NextResponse.json({ ok: false, refusalCode: result.refusalCode, detail: result.detail }, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: true,
        created: result.created,
        binding: {
          agentRuntimeId: result.binding.agentRuntimeId,
          walletRole: result.binding.walletRole,
          address: result.binding.address,
          network: result.binding.network,
          chainId: result.binding.chainId,
          status: result.binding.status,
        },
      },
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
        'Provisions (or returns, if already provisioned) a purpose-bound agent wallet via agent_wallet_bindings. ' +
        'Body: { agentRuntimeId?: string, walletRole?: "trading"|"settlement"|"treasury", network?: string, chainId?: number }. ' +
        'Defaults to aigent-nakamoto/trading/base-mainnet/8453. Requires x-cron-token header (CRON_TRIGGER_TOKEN). ' +
        'Never returns private key material.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
