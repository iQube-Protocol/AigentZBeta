/**
 * GET /api/admin/activations/diag
 *
 * Admin-only diagnostic. Returns:
 *   - the supabase key type the server-side client booted with (service vs anon),
 *   - the raw persona_activations rows for the calling persona,
 *   - the catalog auto-grant ids,
 * so we can verify writes are actually reaching the DB when the UI seems
 * to "flip back" after a click.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listAutoGrantActivationIds } from '@/data/activation-catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  // The keyType bit is the smoking gun for the "deactivates then reactivates"
  // bug — return it WITHOUT admin auth so the operator can hit this URL
  // directly in a browser tab. Per-persona rows still require admin.
  const keyType = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? 'SERVICE_ROLE_KEY'
    : process.env.SUPABASE_ANON_KEY
      ? 'SUPABASE_ANON_KEY (writes blocked by RLS — this is the bug)'
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY (writes blocked by RLS — this is the bug)'
        : 'NONE';

  const context = await getActivePersona(request);
  if (!context || !context.cartridgeFlags?.isAdmin) {
    return NextResponse.json(
      {
        supabaseKeyType: keyType,
        adminAuth: 'not-resolved',
        hint: 'Open this URL from inside the metame.live runtime (where the Supabase bearer token is attached) to see per-persona rows. Or pass ?personaId=<id>&adminBypass=1 (NEVER in prod).',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const admin = getSupabaseServer();
  let rows: unknown[] = [];
  let readError: string | null = null;
  if (admin) {
    const { data, error } = await admin
      .from('persona_activations')
      .select('*')
      .eq('persona_id', context.personaId)
      .order('updated_at', { ascending: false });
    if (error) readError = error.message;
    if (Array.isArray(data)) rows = data;
  }

  return NextResponse.json(
    {
      personaIdHashPrefix: context.personaId.slice(0, 8) + '…',
      supabaseKeyType: keyType,
      adminAuth: 'resolved',
      readError,
      rowCount: rows.length,
      rows,
      autoGrantIds: listAutoGrantActivationIds(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
