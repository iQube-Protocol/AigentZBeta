import { NextRequest, NextResponse } from 'next/server';
import { getCallerAuthProfileId } from '@/services/wallet/personaRepo';
import { db } from '@/services/wallet/multiEmailIdentity';

export async function GET(request: NextRequest) {
  const authProfileId = await getCallerAuthProfileId(request);
  if (!authProfileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await db
    .from('crm_auth_profile_links')
    .select('linked_auth_profile_id,relationship_mode,active')
    .eq('owner_auth_profile_id', authProfileId);
  if (error) throw error;
  return NextResponse.json({ ok: true, links: data || [] });
}

export async function POST(request: NextRequest) {
  const authProfileId = await getCallerAuthProfileId(request);
  if (!authProfileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { linkedAuthProfileId, relationshipMode } = await request.json();
  if (!linkedAuthProfileId || !relationshipMode) return NextResponse.json({ error: 'linkedAuthProfileId and relationshipMode required' }, { status: 400 });
  const { error } = await db.from('crm_auth_profile_links').upsert(
    { owner_auth_profile_id: authProfileId, linked_auth_profile_id: linkedAuthProfileId, relationship_mode: relationshipMode, active: true },
    { onConflict: 'owner_auth_profile_id,linked_auth_profile_id' }
  );
  if (error) throw error;
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const authProfileId = await getCallerAuthProfileId(request);
  if (!authProfileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const linkedAuthProfileId = searchParams.get('linkedAuthProfileId');
  if (!linkedAuthProfileId) return NextResponse.json({ error: 'linkedAuthProfileId query param required' }, { status: 400 });
  const { error } = await db
    .from('crm_auth_profile_links')
    .update({ active: false })
    .eq('owner_auth_profile_id', authProfileId)
    .eq('linked_auth_profile_id', linkedAuthProfileId);
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
