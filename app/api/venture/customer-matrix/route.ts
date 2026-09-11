/**
 * GET /api/venture/customer-matrix — the generalized (tenant-agnostic) customer
 * progress matrix (Engagement × Sovereignty Journey), built on the generic
 * journey_states substrate. Replaces the KNYT-hardwired dashboard view=matrix
 * for any venture/tenant.
 *
 * Query: ?tenantId=<id> to scope to a venture's customers; omit for the whole
 * platform (metaMe-as-venture funnel). Admin-gated — it aggregates across
 * personas, so it is an operator/admin surface.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCustomerMatrix } from '@/services/venture/customerMatrix';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  // Aggregate-across-personas surface → admin only.
  if (!persona.cartridgeFlags.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'database unavailable' }, { status: 503 });
  }
  const tenantId = new URL(req.url).searchParams.get('tenantId');
  const matrix = await getCustomerMatrix(admin, { tenantId });
  return NextResponse.json({ ok: true, ...matrix });
}
