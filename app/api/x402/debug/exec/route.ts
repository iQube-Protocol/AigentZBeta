import { NextResponse } from 'next/server';
import { loadExecConfig } from '@/services/x402/config';

export async function GET() {
  try {
    const cfg = loadExecConfig();
    const redacted = {
      ...cfg,
      treasuryPrivateKey: cfg.treasuryPrivateKey ? 'redacted' : undefined,
    };
    return NextResponse.json({ ok: true, config: redacted });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'config error' }, { status: 500 });
  }
}
