/**
 * POST /api/connectors/execute
 *
 * Aigent Me Phase 6.b — Execute a registered Google connector.
 *
 * Body:
 *   {
 *     connectorId: 'google.gmail.draft' | 'google.gmail.send' | ...
 *     input: <connector-specific input>,
 *     sourceIntentId?: string,
 *     cartridge?: string,
 *     /// Second-tier approval gate — required for connectors with
 *     /// requiresApproval=true. The client supplies the ApprovalCard's
 *     /// approval id (created by Phase 3.5's intent approval).
 *     approvalToken?: string,
 *   }
 *
 * Privacy contract:
 *   - personaId resolved from the spine
 *   - The connector handles its own scope check via getValidAccessToken;
 *     callers see a clean { ok: false, code: 'not-connected' } when the
 *     persona hasn't opted-in to that source.
 *   - Approval-required connectors refuse to execute without
 *     `approvalToken`. The Phase 6.b second-tier ApprovalCard supplies
 *     it after the user confirms; without it, the route returns
 *     { ok: false, code: 'requires-approval', hint: ... } and the UI
 *     opens the ApprovalCard.
 *
 * Every successful execution emits an activity_receipt of action_type
 * 'artifact_sent' (approval-required connectors) or 'artifact_created'
 * (no-approval connectors).
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getGoogleConnector, type GoogleConnectorId } from '@/services/google/connectors';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { getOAuthConfig } from '@/services/google/oauth';

export const dynamic = 'force-dynamic';

interface PostBody {
  connectorId?: GoogleConnectorId;
  input?: Record<string, unknown>;
  sourceIntentId?: string;
  cartridge?: string;
  approvalToken?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const cfg = getOAuthConfig();
  if (!cfg.configured) {
    return NextResponse.json(
      {
        ok: false,
        code: 'oauth-not-configured',
        reason: cfg.reason,
        missing: cfg.missing,
        hint:
          'Operator action — set GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI in Amplify env.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json(
      { error: 'invalid-json' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as PostBody;
  if (!body.connectorId) {
    return NextResponse.json(
      { error: 'missing-connectorId' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const connector = getGoogleConnector(body.connectorId);
  if (!connector) {
    return NextResponse.json(
      { error: 'unknown-connector', detail: `connectorId ${body.connectorId} not registered` },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Second-tier approval gate.
  if (connector.requiresApproval && !body.approvalToken) {
    return NextResponse.json(
      {
        ok: false,
        code: 'requires-approval',
        reason: `${connector.label} requires explicit approval before execution.`,
        hint:
          'Surface the Phase 6.b second-tier ApprovalCard; pass the approval id back as approvalToken.',
      },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Execute.
  let result;
  try {
    result = await connector.execute(body.input ?? {}, {
      personaId: context.personaId,
      intentId: body.sourceIntentId ?? null,
      cartridge: body.cartridge ?? 'metame',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, code: 'execute-threw', reason: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!result.ok) {
    return NextResponse.json(result, {
      status: result.code === 'not-connected' ? 409 : 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // Emit receipt.
  await createActivityReceipt({
    personaId: context.personaId,
    intentId: body.sourceIntentId ?? null,
    activeCartridge: body.cartridge ?? 'metame',
    actionType: connector.requiresApproval ? 'artifact_sent' : 'artifact_created',
    summary: `${connector.label} executed`,
    agentsInvoked: ['aigent-me'],
    toolsUsed: [connector.id],
    iqubesUsed: ['PersonaQube', 'ExperienceQube', 'IntentQube'],
    contextShared: ['connector-input-summary'],
    artifactsCreated: [connector.id],
    approvalsGranted: body.approvalToken ? [body.approvalToken] : [],
  }).catch(() => undefined);

  return NextResponse.json(
    { ok: true, connectorId: connector.id, output: result.output },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
