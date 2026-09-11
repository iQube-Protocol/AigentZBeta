import { NextRequest, NextResponse } from 'next/server';
import { hasScope, resolveBearer, type ScopedSession } from './gatewaySession';

/**
 * Canonical authentication adapter for endpoints reached with a Threshold
 * Constitutional Handshake bearer (`ths_…`).
 *
 * INVARIANT: Threshold authority is resolved from the Threshold bearer. A route
 * using this adapter must not reconstruct authority through getActivePersona()
 * or another browser/Supabase auth mechanism.
 */
export function extractThresholdBearer(request: Pick<NextRequest, 'headers'>): string | null {
  const authz = request.headers.get('authorization');
  if (!authz) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authz.trim());
  return match?.[1]?.trim() || null;
}

export type ThresholdAuthFailure =
  | 'missing_bearer'
  | 'invalid_expired_or_revoked_bearer'
  | 'missing_capability';

export type ThresholdSessionRequirement =
  | { ok: true; session: ScopedSession }
  | { ok: false; reason: ThresholdAuthFailure; response: NextResponse };

/**
 * Resolve the canonical Threshold session and optionally enforce a capability.
 * The bearer itself is never logged or returned in diagnostics.
 */
export async function requireThresholdSession(
  request: NextRequest,
  requiredCapability?: string,
): Promise<ThresholdSessionRequirement> {
  const bearer = extractThresholdBearer(request);
  if (!bearer) {
    console.warn('[threshold-auth] denied', { reason: 'missing_bearer', requiredCapability: requiredCapability ?? null });
    return {
      ok: false,
      reason: 'missing_bearer',
      response: NextResponse.json(
        { error: 'unauthenticated', authReason: 'missing_bearer' },
        { status: 401 },
      ),
    };
  }

  const session = await resolveBearer(bearer);
  if (!session) {
    console.warn('[threshold-auth] denied', {
      reason: 'invalid_expired_or_revoked_bearer',
      requiredCapability: requiredCapability ?? null,
    });
    return {
      ok: false,
      reason: 'invalid_expired_or_revoked_bearer',
      response: NextResponse.json(
        { error: 'unauthenticated', authReason: 'invalid_expired_or_revoked_bearer' },
        { status: 401 },
      ),
    };
  }

  if (requiredCapability && !hasScope(session, requiredCapability)) {
    console.warn('[threshold-auth] denied', {
      reason: 'missing_capability',
      requiredCapability,
      sessionId: session.id,
    });
    return {
      ok: false,
      reason: 'missing_capability',
      response: NextResponse.json(
        { error: 'missing-capability', required: requiredCapability, authReason: 'missing_capability' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, session };
}

/** Stable, order-preserving capability normalization for minted sessions. */
export function normalizeThresholdScope(scope: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const capability of scope ?? []) {
    const value = typeof capability === 'string' ? capability.trim() : '';
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}
