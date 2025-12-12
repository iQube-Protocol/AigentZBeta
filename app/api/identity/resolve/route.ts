import { NextRequest, NextResponse } from 'next/server';
import { resolveIdentity } from '@/services/identity/identityResolver';

export async function GET(req: NextRequest) {
  const subject = req.nextUrl.searchParams.get('subject');
  if (!subject) return NextResponse.json({ ok: false, error: 'subject required' }, { status: 400 });
  const resolved = await resolveIdentity(subject);
  return NextResponse.json({ ok: true, data: resolved });
}
