import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  try {
    const pemEnv = process.env.DFX_IDENTITY_PEM;
    const pemPath = process.env.DFX_IDENTITY_PEM_PATH;
    let used: 'env' | 'path' | 'none' = 'none';
    let pem: string | undefined = undefined;
    let hasPem = false;
    let pemLen = 0;
    let parseOk = false;
    let principal: string | null = null;

    if (pemEnv && pemEnv.length > 0) {
      pem = pemEnv;
      used = 'env';
    } else if (pemPath && pemPath.length > 0) {
      try {
        const { readFileSync } = await import('fs');
        pem = readFileSync(pemPath, 'utf8');
        used = 'path';
      } catch {}
    }

    if (typeof pem === 'string') {
      pemLen = pem.length;
      hasPem = pemLen > 0;
      if (hasPem) {
        try {
          const idMod: any = await import('@dfinity/identity');
          let id: any = null;
          if (idMod?.Ed25519KeyIdentity?.fromPem) {
            try { id = idMod.Ed25519KeyIdentity.fromPem(pem); } catch {}
          }
          if (!id && idMod?.Secp256k1KeyIdentity?.fromPem) {
            try { id = idMod.Secp256k1KeyIdentity.fromPem(pem); } catch {}
          }
          if (id) {
            principal = id.getPrincipal().toText();
            parseOk = true;
          }
        } catch {}
      }
    }
    return NextResponse.json({ ok: true, hasPem, pemLen, parseOk, principal, used, pemPath: pemPath || null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
