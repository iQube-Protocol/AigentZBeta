/**
 * GET /api/wallet/active-persona
 *
 * Phase 1.1.c — issues an `ActivePersonaSurface` (T1) for the authenticated
 * caller. The browser-facing payload contains:
 *   - personaSessionToken (T1, opaque)
 *   - displayLabel (user-chosen pet name; not derived from personaId / fioHandle)
 *   - identifiability + cartridgeFlags + cohortMemberships
 *   - sessionExpiresAt
 *
 * The T0 personaId, authProfileId, fioHandle, and rootDid never appear in
 * the response. Surface code must consume `ActivePersonaSurface` only;
 * server code that needs T0 calls `getActivePersona(req)` directly.
 *
 * See:
 *   - codexes/packs/agentiq/updates/2026-05-05_unified-identity-content-access-foundation-plan.md §4.1
 *   - services/identity/getActivePersona.ts
 *   - services/identity/personaSessionToken.ts
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { issuePersonaSessionToken } from '@/services/identity/personaSessionToken';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { ActivePersonaSurface } from '@/types/access';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  const client = getSupabaseServer();
  if (!client) throw new Error('Supabase configuration missing');
  return client;
}

async function readPersonaPresentation(
  personaId: string,
): Promise<{ displayLabel?: string; ownFioHandle?: string }> {
  try {
    const admin = getAdminClient();
    const { data } = await admin
      .from('personas')
      .select('display_name, fio_handle')
      .eq('id', personaId)
      .maybeSingle();
    const row = data as { display_name?: string; fio_handle?: string } | null;
    const displayLabel =
      typeof row?.display_name === 'string' && row.display_name.trim().length > 0
        ? row.display_name.trim()
        : undefined;
    // Surface the persona's OWN fio_handle in the response. Privacy
    // contract allows this because the response is bound to the
    // authenticated caller's own session — the user already knows
    // their own handle. Cross-persona handle surfacing would be a
    // T0 leak; this is not.
    const ownFioHandle =
      typeof row?.fio_handle === 'string' && row.fio_handle.trim().length > 0
        ? row.fio_handle.trim()
        : undefined;
    return { displayLabel, ownFioHandle };
  } catch {
    // Non-fatal — display data is purely cosmetic.
    return {};
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Token issuance can throw if PERSONA_SESSION_TOKEN_HMAC_KEY is missing
  // in production AND NEXTAUTH_SECRET is also missing or too short. Catch
  // that here and return a clear 500 with diagnostics instead of an
  // unhandled throw — operators reading CloudWatch get an actionable
  // line, and downstream tooling (verify-spine.mjs privacy-guard check)
  // gets a stable error envelope.
  let issued: ReturnType<typeof issuePersonaSessionToken>;
  try {
    issued = issuePersonaSessionToken({
      personaId: context.personaId,
      authProfileId: context.authProfileId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[active-persona] token issuance failed: ${msg}. ` +
      `Set PERSONA_SESSION_TOKEN_HMAC_KEY (>=32 chars) in Amplify env, ` +
      `or ensure NEXTAUTH_SECRET (>=32 chars) is set as fallback.`,
    );
    return NextResponse.json(
      {
        error: 'token-issuance-failed',
        detail: msg,
        hint:
          'Set PERSONA_SESSION_TOKEN_HMAC_KEY (>=32 chars) in Amplify env, ' +
          'or ensure NEXTAUTH_SECRET (>=32 chars) is set as fallback.',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { displayLabel, ownFioHandle } = await readPersonaPresentation(context.personaId);

  const surface: ActivePersonaSurface & { ownFioHandle?: string } = {
    personaSessionToken: issued.token,
    identifiability: context.identifiability,
    cartridgeFlags: { ...context.cartridgeFlags },
    cohortMemberships: [...context.cohortMemberships],
    sessionExpiresAt: issued.expiresAt,
    ...(displayLabel ? { displayLabel } : {}),
    ...(ownFioHandle ? { ownFioHandle } : {}),
  };

  // Privacy guard: T0 handles (personaId, authProfileId, rootDid) are
  // NOT surfaced. The fio_handle that IS surfaced belongs to the
  // authenticated caller's own active persona — they already know it.
  // Cross-persona handle resolution is forbidden.
  return NextResponse.json(surface, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
