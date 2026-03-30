import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * GET /api/codex/knyt/roles?personaId=<uuid>
 *
 * Returns the active KNYT role strings for a persona.
 * Used by KnytLivingCanonTemplate to gate contributor / correspondent / steward UI.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const personaId = searchParams.get('personaId');

  if (!personaId) {
    return NextResponse.json({ roles: [] });
  }

  const { data, error } = await supabase
    .from('knyt_persona_roles')
    .select('role')
    .eq('persona_id', personaId)
    .is('revoked_at', null);

  if (error) {
    return NextResponse.json({ roles: [] });
  }

  const roles = (data ?? []).map((r: { role: string }) => r.role).filter(Boolean);
  return NextResponse.json({ roles });
}
