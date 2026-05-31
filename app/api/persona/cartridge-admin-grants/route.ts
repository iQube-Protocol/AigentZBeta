/**
 * GET /api/persona/cartridge-admin-grants
 *
 * Returns the active persona's per-cartridge admin grants — used by
 * the metaMe Cartridge to decide whether to surface a foreign
 * cartridge's Admin tab inside its Activation sub-surfaces (the
 * chief-of-staff unlock).
 *
 * Status: DEPRECATED 2026-05-26 in favour of reading
 * cartridgeFlags.adminCartridges directly from
 * /api/wallet/active-persona. This route is now a thin pass-through
 * over getActivePersona() — it does NOT re-query CRM. New clients
 * should read from the active-persona surface so admin grants and
 * other persona flags travel together in a single broadcast.
 *
 * Privacy posture
 * ---------------
 *   - Persona resolved from the spine via getActivePersona().
 *   - Output mirrors the spine's resolved cartridgeFlags.
 *     adminCartridges + isAdmin — single source of truth.
 *   - 401 when no persona is resolved.
 */
import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';

export const dynamic = 'force-dynamic';

interface CartridgeAdminGrantsApiResponse {
  isGlobalAdmin: boolean;
  cartridgeSlugs: string[];
  /** Deprecation hint for callers; remove the field if it ever causes JSON-shape concerns. */
  _deprecated: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Spine is the single source of truth. cartridgeFlags.isAdmin is true
  // when EITHER the legacy resolveAdminFlag matched OR the admin-grants
  // resolver determined a global role — getActivePersona handles the
  // union internally.
  const payload: CartridgeAdminGrantsApiResponse = {
    isGlobalAdmin: context.cartridgeFlags.isAdmin,
    cartridgeSlugs: context.cartridgeFlags.adminCartridges,
    _deprecated: 'Read cartridgeFlags.adminCartridges from /api/wallet/active-persona instead. This route remains as a back-compat surface.',
  };

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
