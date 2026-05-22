/**
 * GET /api/assistant/activations/diag
 *
 * Authenticated diag — returns the calling persona's raw edition state on
 * activation_tab ContentQubes, the legacy persona_activations rows (if
 * any), and the supabase key type. Use this to verify writes are landing
 * AND that the released_at migration is applied.
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

  // 1. Activation-tab ContentQubes (catalogue from DB).
  let qubes: unknown[] = [];
  let qubesError: string | null = null;
  if (admin) {
    const { data, error } = await admin
      .from('activation_tab_qubes')
      .select('*');
    if (error) qubesError = error.message;
    if (Array.isArray(data)) qubes = data;
  }

  // 2. THIS PERSONA'S edition rows on those qubes (raw — includes released_at
  //    so we can see whether the soft-release column is present + populated).
  let editions: unknown[] = [];
  let editionsError: string | null = null;
  let releasedAtColumnPresent = true;
  if (admin) {
    const { data, error } = await admin
      .from('content_qube_editions')
      .select('id, content_qube_id, persona_id, rarity, edition_number, issued_at, released_at')
      .eq('persona_id', context.personaId)
      .eq('rarity', 'common');
    if (error) {
      editionsError = error.message;
      if (/released_at/i.test(error.message)) releasedAtColumnPresent = false;
    }
    if (Array.isArray(data)) editions = data;
  }

  // 3. Legacy persona_activations rows (should be unused; here to detect drift).
  let legacyRows: unknown[] = [];
  let legacyError: string | null = null;
  if (admin) {
    const { data, error } = await admin
      .from('persona_activations')
      .select('activation_id, status, granted_via, granted_at, revoked_at, updated_at')
      .eq('persona_id', context.personaId)
      .order('updated_at', { ascending: false });
    if (error) legacyError = error.message;
    if (Array.isArray(data)) legacyRows = data;
  }

  return NextResponse.json(
    {
      personaIdHashPrefix: context.personaId.slice(0, 8) + '…',
      supabaseKeyType: keyType,
      migrations: {
        releasedAtColumnPresent,
        activationTabQubesView: qubes.length > 0 || !qubesError,
        qubesError,
        editionsError,
        legacyError,
      },
      autoGrantActivationIds: listAutoGrantActivationIds(),
      activationTabQubes: qubes,
      personaEditions: editions,
      legacyPersonaActivationsRows: legacyRows,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
