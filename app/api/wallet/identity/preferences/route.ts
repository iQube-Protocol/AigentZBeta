import { NextRequest, NextResponse } from 'next/server';
import { getCallerAuthProfileId } from '@/services/wallet/personaRepo';
import { db } from '@/services/wallet/multiEmailIdentity';

export async function GET(request: NextRequest) {
  const authProfileId = await getCallerAuthProfileId(request);
  if (!authProfileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const ownerAuthProfileId = searchParams.get('ownerAuthProfileId');
  const { data, error } = await db
    .from('crm_persona_access_preferences')
    .select('persona_id,access_mode')
    .eq('owner_auth_profile_id', ownerAuthProfileId || authProfileId);
  if (error) throw error;
  return NextResponse.json({ ok: true, preferences: data || [] });
}

export async function POST(request: NextRequest) {
  const authProfileId = await getCallerAuthProfileId(request);
  if (!authProfileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { personaId, accessMode, ownerAuthProfileId } = await request.json();
  if (!personaId || !accessMode) return NextResponse.json({ error: 'personaId and accessMode required' }, { status: 400 });
  const { error } = await db.from('crm_persona_access_preferences').upsert(
    { owner_auth_profile_id: ownerAuthProfileId || authProfileId, persona_id: personaId, access_mode: accessMode },
    { onConflict: 'owner_auth_profile_id,persona_id' }
  );
  if (error) throw error;
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const authProfileId = await getCallerAuthProfileId(request);
  if (!authProfileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const personaId = searchParams.get('personaId');
  const ownerAuthProfileId = searchParams.get('ownerAuthProfileId');
  if (!personaId) return NextResponse.json({ error: 'personaId query param required' }, { status: 400 });
  const { error } = await db
    .from('crm_persona_access_preferences')
    .delete()
    .eq('owner_auth_profile_id', ownerAuthProfileId || authProfileId)
    .eq('persona_id', personaId);
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
