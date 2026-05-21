/**
 * GET /api/assistant/activations
 *
 * Returns the activation catalog with this persona's status overlaid.
 * Auto-grants `autoGrant: true` catalog entries (myCanvas, Order of
 * Metayé) on first read.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { listActivations } from '@/services/activations/spineActivations';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  try {
    const surfaces = await listActivations(context.personaId, {
      isAdmin: !!context.cartridgeFlags?.isAdmin,
    });
    return NextResponse.json(
      { activations: surfaces },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[assistant/activations] list failed:', msg);
    return NextResponse.json(
      { error: 'activations-failed', detail: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
