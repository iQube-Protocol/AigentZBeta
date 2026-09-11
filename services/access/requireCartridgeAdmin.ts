/**
 * requireCartridgeAdmin — per-cartridge admin gate for API routes.
 *
 * Replaces the bespoke `if (!context.cartridgeFlags.isAdmin) return 403`
 * pattern with a cartridge-scoped check that honours the spine's
 * adminCartridges array. Global isAdmin (uber / platform-tier) still
 * satisfies any per-cartridge gate.
 *
 * Two surfaces:
 *
 *   isCartridgeAdmin(context, cartridgeSlug) — pure boolean predicate.
 *     Use when you need to branch logic without short-circuiting.
 *
 *   requireCartridgeAdmin(request, cartridgeSlug) — async route guard
 *     that resolves the persona via getActivePersona and returns
 *     EITHER the resolved context OR a NextResponse 401/403 that the
 *     route handler should pass through. Pattern:
 *
 *         const gate = await requireCartridgeAdmin(req, 'knyt-codex');
 *         if (gate instanceof NextResponse) return gate;
 *         const context = gate;
 *         // ... admin logic, context is fully resolved
 *
 * Why this helper instead of inline checks
 * ----------------------------------------
 *   Cartridge-scoped admin endpoints (/api/admin/<cartridge>/...) need
 *   to gate on per-cartridge admin grants now that the spine carries
 *   them. Without this helper, every route would re-implement the
 *   same global-OR-per-cartridge logic and drift would compound. The
 *   canonical surface lives here.
 *
 *   When Layer 3 ContentQube admin descriptors land, prefer routing
 *   through evaluateAccess(context, descriptor, action) directly so
 *   the same decision gates UI tabs AND endpoint access. This helper
 *   stays as the short-form ergonomic wrapper for routes that don't
 *   need the full descriptor pipeline (e.g. KPI dashboards, ops
 *   queues — flat reads + writes scoped to a cartridge).
 */
import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import type { ActivePersonaContext } from '@/types/access';

export function isCartridgeAdmin(
  context: ActivePersonaContext,
  cartridgeSlug: string,
): boolean {
  if (!cartridgeSlug) return false;
  // Global admins (uber / platform / category_uber) satisfy any
  // per-cartridge gate. This mirrors the credentialMatchesCartridgeFlag
  // semantics in services/access/policyResolvers.ts so UI and server
  // never disagree about the same persona's scope.
  if (context.cartridgeFlags.isAdmin) return true;
  return context.cartridgeFlags.adminCartridges.includes(cartridgeSlug);
}

/**
 * Resolve persona via spine + check per-cartridge admin in one step.
 * Returns either the context (caller proceeds) or a NextResponse the
 * caller should return immediately. Fail-closed by design — anything
 * other than a positive admin grant lands as 401 / 403.
 */
export async function requireCartridgeAdmin(
  request: NextRequest,
  cartridgeSlug: string,
): Promise<ActivePersonaContext | NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (!isCartridgeAdmin(context, cartridgeSlug)) {
    return NextResponse.json(
      {
        error: 'admin-required',
        detail: `This endpoint requires admin scope on cartridge '${cartridgeSlug}'. Global uber/platform admins also qualify.`,
        cartridge: cartridgeSlug,
      },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return context;
}
