/**
 * GET /api/persona/cartridge-admin-grants
 *
 * Returns the active persona's per-cartridge admin grants — the data
 * the metaMe Cartridge consumes to decide whether to surface a foreign
 * cartridge's Admin tab inside its Activation sub-surfaces (the
 * chief-of-staff unlock).
 *
 * Privacy posture
 * ---------------
 *   - Persona resolved from the spine via getActivePersona(). T0 ids
 *     never appear on the wire.
 *   - Response surfaces only T1-safe fields:
 *       { isGlobalAdmin: boolean, cartridgeSlugs: string[] }
 *   - When the spine returns no persona context, the route returns
 *     401 — no anonymous claim of admin grants is possible.
 *
 * Why a dedicated route instead of folding into /api/wallet/active-persona
 * ------------------------------------------------------------------------
 *   The grants set can be moderately expensive to resolve (a join
 *   across crm_admin_roles + crm_tenants) and is only needed by codex
 *   surfaces that actually render admin-gated tabs. Keeping it on its
 *   own endpoint lets the metaMe panel fetch it lazily and lets every
 *   other surface skip the call entirely.
 */
import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getMergedLinkedAuthProfileIds } from '@/services/wallet/multiEmailIdentity';
import { getCartridgeAdminGrants } from '@/services/access/cartridgeAdminGrants';

export const dynamic = 'force-dynamic';

interface CartridgeAdminGrantsApiResponse {
  isGlobalAdmin: boolean;
  cartridgeSlugs: string[];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    // ActivePersonaContext doesn't expose linkedAuthProfileIds; fetch
    // them here so the grants resolver can mirror the same multi-email
    // merge surface getActivePersona.resolveAdminFlag already honours.
    const linkedAuthProfileIds = await getMergedLinkedAuthProfileIds(
      context.authProfileId,
    ).catch(() => []);

    const grants = await getCartridgeAdminGrants(
      context.authProfileId,
      linkedAuthProfileIds,
    );

    const payload: CartridgeAdminGrantsApiResponse = {
      isGlobalAdmin: grants.isGlobalAdmin,
      cartridgeSlugs: grants.cartridgeSlugs,
    };

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[persona/cartridge-admin-grants] resolve failed: ${msg}`);
    // Fail closed — return no admin grants rather than leaking a
    // partial set or surfacing a 500 that the client might paper over.
    return NextResponse.json(
      { isGlobalAdmin: false, cartridgeSlugs: [] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
