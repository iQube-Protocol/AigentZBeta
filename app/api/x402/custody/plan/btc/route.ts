import { NextRequest, NextResponse } from 'next/server';
import { loadBtcConfig, planBtcCustody } from '@/services/x402/adapters/btc';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { iqubeRef, limits, ttlSec } = body || {};
    if (!iqubeRef) {
      return NextResponse.json({ ok: false, error: 'iqubeRef required' }, { status: 400 });
    }
    const cfg = loadBtcConfig();
    const result = await planBtcCustody({ iqubeRef, limits, ttlSec });
    return NextResponse.json({ ok: true, config: { enabled: cfg.enabled, network: cfg.network }, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'btc plan error' }, { status: 500 });
  }
}

export async function GET() {
  const cfg = loadBtcConfig();
  return NextResponse.json({ ok: true, config: { enabled: cfg.enabled, network: cfg.network } });
}
