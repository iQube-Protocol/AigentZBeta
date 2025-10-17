import { NextRequest, NextResponse } from 'next/server';
import { PersonaService } from '@/services/identity/personaService';

export async function GET() {
  try {
    const svc = new PersonaService();
    const personas = await svc.listPersonas(100);
    return NextResponse.json({ ok: true, data: personas });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to list personas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const svc = new PersonaService();
    const persona = await svc.createPersona({
      rootId: body?.rootId,
      fioHandle: body?.fioHandle,
      defaultState: body?.defaultState,
      appOrigin: body?.appOrigin,
      worldIdStatus: body?.worldIdStatus
    });
    return NextResponse.json({ ok: true, data: persona });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to create persona' }, { status: 500 });
  }
}
