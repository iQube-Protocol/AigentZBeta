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

async function readDisplayLabel(personaId: string): Promise<string | undefined> {
  try {
    const admin = getAdminClient();
    const { data } = await admin
      .from('personas')
      .select('display_name')
      .eq('id', personaId)
      .maybeSingle();
    const raw = (data as { display_name?: string } | null)?.display_name;
    if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  } catch {
    // Non-fatal — display label is purely cosmetic.
  }
  return undefined;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const issued = issuePersonaSessionToken({
    personaId: context.personaId,
    authProfileId: context.authProfileId,
  });

  const displayLabel = await readDisplayLabel(context.personaId);

  const surface: ActivePersonaSurface = {
    personaSessionToken: issued.token,
    identifiability: context.identifiability,
    cartridgeFlags: { ...context.cartridgeFlags },
    cohortMemberships: [...context.cohortMemberships],
    sessionExpiresAt: issued.expiresAt,
    ...(displayLabel ? { displayLabel } : {}),
  };

  // Privacy guard: assert no T0 leak by construction. The response shape
  // is `ActivePersonaSurface` exactly; any drift is a build error.
  return NextResponse.json(surface, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
