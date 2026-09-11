/**
 * GET /api/moneypenny/factor/bankr/launches/[launchId] — reads a single
 * token_launches row through the SAME tenant-checked read every write path
 * in services/factor/tokenLaunchService.ts already uses (getTokenLaunch),
 * never a second, unchecked lookup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getTokenLaunch } from '@/services/factor/tokenLaunchService';
import { respondError, resolveTenantId } from '../../../_lib/respondError';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ launchId: string }> }) {
  const { launchId } = await params;
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'not-authenticated' }, { status: 401 });
  }
  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'supabase-unavailable' }, { status: 503 });
  }

  const tenantId = resolveTenantId(req.nextUrl.searchParams.get('tenantId'));
  try {
    const launch = await getTokenLaunch(admin, launchId, tenantId);
    return NextResponse.json({ ok: true, launch });
  } catch (err) {
    return respondError(err);
  }
}
