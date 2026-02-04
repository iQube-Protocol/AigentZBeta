import { NextRequest, NextResponse } from 'next/server';
import { PersonaRepo } from '@/services/wallet/personaRepo';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const fioHandle = searchParams.get('fioHandle');

    if (!tenantId || !fioHandle) {
      return NextResponse.json(
        { ok: false, error: 'tenantId and fioHandle are required' },
        { status: 400 }
      );
    }

    const repo = new PersonaRepo();
    const resolved = await repo.resolveHandleInTenant(tenantId, fioHandle);
    if (!resolved) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, personaId: resolved.id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

