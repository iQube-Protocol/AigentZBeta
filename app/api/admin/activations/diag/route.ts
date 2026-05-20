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
  const context = await getActivePersona(request);
  if (!context || !context.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'admin-required' }, { status: 403 });
  }

  const keyType = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? 'SERVICE_ROLE_KEY'
    : process.env.SUPABASE_ANON_KEY
      ? 'SUPABASE_ANON_KEY (writes blocked by RLS — this is the bug)'
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY (writes blocked by RLS — this is the bug)'
        : 'NONE';

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
      readError,
      rowCount: rows.length,
      rows,
      autoGrantIds: listAutoGrantActivationIds(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
