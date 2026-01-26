import { NextRequest, NextResponse } from 'next/server';
import { PersonaRepo } from '@/services/wallet/personaRepo';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const q = searchParams.get('q') || undefined;
    const limit = Number(searchParams.get('limit') || '25');

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: 'tenantId is required' }, { status: 400 });
    }

    const repo = new PersonaRepo();
    const results = await repo.listDiscoverableInTenant(tenantId, q, Number.isFinite(limit) ? limit : 25);
    return NextResponse.json({ ok: true, personas: results });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

