import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  try {
    const pem = process.env.DFX_IDENTITY_PEM;
    let principal = 'anonymous';
    if (pem && pem.includes('BEGIN') && pem.includes('KEY')) {
      try {
        const idMod: any = await import('@dfinity/identity');
        if (idMod?.Ed25519KeyIdentity?.fromPem) {
          const identity = idMod.Ed25519KeyIdentity.fromPem(pem);
          principal = identity.getPrincipal().toText();
        }
      } catch {}
    }
    return NextResponse.json({ ok: true, principal, host: process.env.ICP_HOST || process.env.NEXT_PUBLIC_ICP_HOST || 'unset' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
