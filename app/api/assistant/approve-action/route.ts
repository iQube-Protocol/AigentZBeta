/**
 * POST /api/assistant/approve-action
 *
 * Aigent Me Phase 6.b — second-tier approval issuer.
 *
 * Body: { connectorId: string; sourceIntentId?: string; cartridge?: string }
 *
 * Returns: { approvalToken: string }  — HMAC-signed token bound to
 * (personaId, connectorId, 5-min expiry). The client passes it back to
 * /api/connectors/execute as `approvalToken`; that route now verifies
 * the signature + persona match + connector match + expiry rather than
 * accepting any non-empty string.
 *
 * Also emits an `approval_granted` activity receipt so the action is
 * traceable even before execute runs. The receipt is the durable record;
 * the token is the short-lived runtime grant.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { issueApprovalToken, isApprovalTokenSigningConfigured } from '@/services/access/approvalToken';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

interface PostBody {
  connectorId?: string;
  sourceIntentId?: string;
  cartridge?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (!isApprovalTokenSigningConfigured()) {
    return NextResponse.json(
      {
        error: 'signing-not-configured',
        detail:
          'Set APPROVAL_TOKEN_HMAC_KEY (or PERSONA_SESSION_TOKEN_HMAC_KEY / NEXTAUTH_SECRET) in Amplify env.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  if (!body.connectorId || typeof body.connectorId !== 'string') {
    return NextResponse.json(
      { error: 'missing-connectorId' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const approvalToken = issueApprovalToken({
    personaId: context.personaId,
    connectorId: body.connectorId,
  });

  // Best-effort receipt — durable record of the approval, separate from
  // the short-lived token itself.
  await createActivityReceipt({
    personaId: context.personaId,
    intentId: body.sourceIntentId ?? null,
    activeCartridge: body.cartridge ?? 'metame',
    actionType: 'approval_granted',
    summary: `Approved external action: ${body.connectorId}`,
    agentsInvoked: ['aigent-me'],
    toolsUsed: [body.connectorId],
    iqubesUsed: ['PersonaQube', 'IntentQube'],
    contextShared: ['second-tier-approval'],
  }).catch(() => undefined);

  return NextResponse.json(
    { approvalToken },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
