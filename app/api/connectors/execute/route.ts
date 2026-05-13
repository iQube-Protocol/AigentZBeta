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
import { getMarketaConnector } from '@/services/marketa/marketaConnector';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import { getOAuthConfig } from '@/services/google/oauth';
import {
  verifyApprovalToken,
  isApprovalTokenSigningConfigured,
} from '@/services/access/approvalToken';

export const dynamic = 'force-dynamic';

interface PostBody {
  // Widened to plain string to cover both Google and Marketa connector
  // namespaces; the dispatch lookup below validates against both registries.
  connectorId?: string;
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

  // Dispatch order: Google connectors first, then Marketa. Each registry
  // owns its own configuration gate (OAuth for Google, Mailjet env for
  // Marketa) — keeps a missing Mailjet config from blocking Google calls
  // and vice versa.
  const isMarketa = body.connectorId.startsWith('marketa.');
  if (!isMarketa) {
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
  }

  const connector = isMarketa
    ? getMarketaConnector(body.connectorId)
    : getGoogleConnector(body.connectorId as GoogleConnectorId);
  if (!connector) {
    return NextResponse.json(
      { error: 'unknown-connector', detail: `connectorId ${body.connectorId} not registered` },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Second-tier approval gate (hardened — Phase 6.b Part 4).
  // The token must be HMAC-signed by /api/assistant/approve-action AND
  // bound to (this personaId, this connectorId, < 5 min old). An opaque
  // string no longer suffices.
  if (connector.requiresApproval) {
    if (!body.approvalToken) {
      return NextResponse.json(
        {
          ok: false,
          code: 'requires-approval',
          reason: `${connector.label} requires explicit approval before execution.`,
          hint:
            'POST /api/assistant/approve-action with { connectorId } to mint a signed approvalToken, then retry execute.',
        },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (!isApprovalTokenSigningConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          code: 'approval-signing-not-configured',
          reason:
            'Server cannot verify approval tokens — APPROVAL_TOKEN_HMAC_KEY / PERSONA_SESSION_TOKEN_HMAC_KEY / NEXTAUTH_SECRET unset.',
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const verified = verifyApprovalToken(body.approvalToken, {
      personaId: context.personaId,
      connectorId: connector.id,
    });
    if (!verified.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: 'approval-token-invalid',
          reason: `approvalToken rejected: ${verified.reason}`,
          hint:
            'Re-approve the action — token is single-use, persona-bound, and expires after 5 minutes.',
        },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }
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
