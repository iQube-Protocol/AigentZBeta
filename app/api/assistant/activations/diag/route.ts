/**
 * GET /api/assistant/activations/diag
 *
 * Authenticated diag — returns the calling persona's raw
 * persona_activations rows + the auto-grant id set so we can verify
 * writes are actually landing in the DB.
 *
 * Same auth as the rest of /api/assistant/* — uses getActivePersona.
 * Returns only the caller's OWN rows (T0 personaId is never serialised
 * out — the rows already contain it, but the caller is by definition the
 * owner so this is identity-spine-safe).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { listAutoGrantActivationIds } from '@/data/activation-catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const admin = getSupabaseServer();
  const keyType = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? 'SERVICE_ROLE_KEY'
    : process.env.SUPABASE_ANON_KEY
      ? 'SUPABASE_ANON_KEY'
      : 'NEXT_PUBLIC_SUPABASE_ANON_KEY';

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
