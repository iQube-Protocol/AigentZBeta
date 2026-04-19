import { NextRequest, NextResponse } from 'next/server';
import { loadProgramData } from '@/services/launch-ops/launchOpsService';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? 'metaknyt-launch-reset';
  try {
    const data = await loadProgramData(slug);
    if (!data) {
      return NextResponse.json({ ok: false, error: 'Program not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[launch-ops GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
