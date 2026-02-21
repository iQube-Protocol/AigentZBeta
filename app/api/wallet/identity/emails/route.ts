import { NextRequest, NextResponse } from 'next/server';
import { getCallerAuthProfileId } from '@/services/wallet/personaRepo';
import { listEmailAliases, upsertEmailAlias, normalizeEmail, db } from '@/services/wallet/multiEmailIdentity';

export async function GET(request: NextRequest) {
  const authProfileId = await getCallerAuthProfileId(request);
  if (!authProfileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const emails = await listEmailAliases(authProfileId);
  return NextResponse.json({ ok: true, emails });
}

export async function POST(request: NextRequest) {
  const authProfileId = await getCallerAuthProfileId(request);
  if (!authProfileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { email, isPrimary } = await request.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
  await upsertEmailAlias(authProfileId, email, !!isPrimary);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const authProfileId = await getCallerAuthProfileId(request);
  if (!authProfileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'email query param required' }, { status: 400 });
  const { error } = await db
    .from('crm_auth_profile_emails')
    .update({ status: 'inactive' })
    .eq('auth_profile_id', authProfileId)
    .eq('email_normalized', normalizeEmail(email));
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
