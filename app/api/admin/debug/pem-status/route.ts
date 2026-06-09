/**
 * GET /api/admin/debug/pem-status
 *
 * Diagnostic endpoint that reveals exactly why DFX_IDENTITY_PEM parsing
 * is failing. Returns: env-var presence, normalised length + head/tail,
 * isPemLike result, and the exact error each fromPem() attempt threw.
 *
 * Never returns the PEM body itself — only structural metadata + error
 * strings, so it is safe to expose to admin operators.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { normalizePem, isPemLike } from '@/services/ops/pemNormalizer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safePreview(s: string | null | undefined, n = 40): string | null {
  if (!s) return null;
  if (s.length <= n * 2 + 5) return `${s.slice(0, n)}…`;
  return `${s.slice(0, n)} … ${s.slice(-n)}`;
}

function lineShape(s: string | null): { lineCount: number; firstLine: string | null; lastLine: string | null } {
  if (!s) return { lineCount: 0, firstLine: null, lastLine: null };
  const lines = s.split('\n');
  return {
    lineCount: lines.length,
    firstLine: lines[0] ?? null,
    lastLine: lines[lines.length - 1] || (lines[lines.length - 2] ?? null),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!context.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const rawServer = process.env.DFX_IDENTITY_PEM ?? null;
  const rawPublic = process.env.NEXT_PUBLIC_DFX_IDENTITY_PEM ?? null;
  const pathVar = process.env.DFX_IDENTITY_PEM_PATH ?? null;
  const sourceUsed = rawServer ? 'DFX_IDENTITY_PEM' : (rawPublic ? 'NEXT_PUBLIC_DFX_IDENTITY_PEM' : (pathVar ? 'DFX_IDENTITY_PEM_PATH' : null));
  const raw = rawServer || rawPublic || null;

  const rawDiag = raw
    ? {
        length: raw.length,
        startsWithDash: raw.startsWith('-'),
        hasLiteralBackslashN: raw.includes('\\n'),
        hasRealNewline: raw.includes('\n'),
        hasCRLF: raw.includes('\r\n'),
        hasBeginMarker: raw.includes('-----BEGIN'),
        hasEndMarker: raw.includes('-----END'),
        hasKeyToken: raw.includes('KEY'),
        leadingWhitespace: /^\s/.test(raw),
        trailingWhitespace: /\s$/.test(raw),
        preview: safePreview(raw, 30),
      }
    : null;

  const normalised = normalizePem(raw);
  const normDiag = normalised
    ? {
        length: normalised.length,
        ...lineShape(normalised),
        isPemLike: isPemLike(normalised),
        preview: safePreview(normalised, 30),
      }
    : null;

  const attempts: Array<{ method: string; ok: boolean; principal: string | null; error: string | null }> = [];

  if (isPemLike(normalised)) {
    try {
      const skMod: any = await import('@dfinity/identity-secp256k1');
      if (skMod?.Secp256k1KeyIdentity?.fromPem) {
        try {
          const id = skMod.Secp256k1KeyIdentity.fromPem(normalised);
          attempts.push({ method: '@dfinity/identity-secp256k1 Secp256k1KeyIdentity.fromPem', ok: true, principal: id.getPrincipal().toText(), error: null });
        } catch (err) {
          attempts.push({ method: '@dfinity/identity-secp256k1 Secp256k1KeyIdentity.fromPem', ok: false, principal: null, error: err instanceof Error ? err.message : String(err) });
        }
      } else {
        attempts.push({ method: '@dfinity/identity-secp256k1 Secp256k1KeyIdentity.fromPem', ok: false, principal: null, error: 'fromPem not exported' });
      }
    } catch (err) {
      attempts.push({ method: 'import @dfinity/identity-secp256k1', ok: false, principal: null, error: err instanceof Error ? err.message : String(err) });
    }

    try {
      const idMod: any = await import('@dfinity/identity');
      if (idMod?.Ed25519KeyIdentity?.fromPem) {
        try {
          const id = idMod.Ed25519KeyIdentity.fromPem(normalised);
          attempts.push({ method: 'Ed25519KeyIdentity.fromPem', ok: true, principal: id.getPrincipal().toText(), error: null });
        } catch (err) {
          attempts.push({ method: 'Ed25519KeyIdentity.fromPem', ok: false, principal: null, error: err instanceof Error ? err.message : String(err) });
        }
      } else {
        attempts.push({ method: 'Ed25519KeyIdentity.fromPem', ok: false, principal: null, error: 'fromPem not exported (use @dfinity/identity-secp256k1 for EC keys)' });
      }
    } catch (err) {
      attempts.push({ method: 'import @dfinity/identity', ok: false, principal: null, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json(
    {
      env: {
        DFX_IDENTITY_PEM_present: !!rawServer,
        NEXT_PUBLIC_DFX_IDENTITY_PEM_present: !!rawPublic,
        DFX_IDENTITY_PEM_PATH_present: !!pathVar,
        sourceUsed,
      },
      raw: rawDiag,
      normalised: normDiag,
      attempts,
      verdict: attempts.find((a) => a.ok)?.principal
        ? `OK — parsed as ${attempts.find((a) => a.ok)?.method}, principal ${attempts.find((a) => a.ok)?.principal}`
        : (raw ? 'PEM present but no parser accepted it — see attempts[].error' : 'No DFX_IDENTITY_PEM in environment'),
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
