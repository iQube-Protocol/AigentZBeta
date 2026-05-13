/**
 * GET /api/assistant/google-status
 *
 * Aigent Me Phase 6.b — list this persona's Google connection status per
 * source. Used by the welcome surface to render the "Connect Google
 * Workspace" section.
 *
 * Response: { configured, statuses: GoogleConnectionStatus[] }
 */

import { NextRequest, NextResponse } from 'next/server';

import { getActivePersona } from '@/services/identity/getActivePersona';
import {
  getConnectionStatuses,
  getOAuthConfig,
} from '@/services/google/oauth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const cfg = getOAuthConfig();
  const statuses = await getConnectionStatuses(context.personaId).catch(() => []);
  return NextResponse.json(
    {
      configured: cfg.configured,
      missing: cfg.configured ? [] : cfg.missing,
      statuses,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
