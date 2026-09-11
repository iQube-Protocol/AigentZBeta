/**
 * GET /api/signing/requests/agent/[runtimeAgentId]
 *
 * An agent's OWN pending Pending Actions — the agent wallet drawer's Pending
 * Actions section reads this (Wallet Signing Topology, operator ruling
 * 2026-08-01), e.g. "Approve invocation of Aigent Nakamoto's custodied key
 * to sign the Horizen registry transaction."
 *
 * Spine-gated (must be signed in) but not further admin-restricted —
 * mirrors the existing access level of app/(shell)/aigents/[agentKey]/page.tsx,
 * the live surface that already mounts AgentWalletDrawer with no additional
 * gate of its own. Never widens or narrows that existing posture.
 *
 * Deliberately omits `principalPersonaId` from the response — an agent
 * wallet surface should never render a raw persona identifier (CLAUDE.md
 * Identity & Access Spine), even though the underlying record carries it
 * for server-side orchestration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listPendingSigningRequestsForAgent } from '@/services/signing/signingRequestStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ runtimeAgentId: string }> }) {
  const persona = await getActivePersona(request);
  if (!persona) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const { runtimeAgentId } = await params;
  const requests = await listPendingSigningRequestsForAgent(runtimeAgentId);
  const sanitized = requests.map(({ principalPersonaId: _omit, ...rest }) => rest);
  return NextResponse.json({ ok: true, requests: sanitized });
}
