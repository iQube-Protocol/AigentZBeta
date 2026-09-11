import { NextRequest, NextResponse } from 'next/server';
import { PersonaRepo, getCallerAuthProfileId } from '@/services/wallet/personaRepo';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const callerAuthProfileId = await getCallerAuthProfileId(request);
    if (!callerAuthProfileId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const discoverable = !!body?.discoverableWithinTenant;

    const repo = new PersonaRepo();
    const result = await repo.setDiscoverableWithinTenant(params.id, callerAuthProfileId, discoverable);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.error === 'Forbidden' ? 403 : 404 });
    }

    return NextResponse.json({ ok: true, persona: result.persona });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

