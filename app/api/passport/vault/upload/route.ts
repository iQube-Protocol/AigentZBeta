/**
 * POST /api/passport/vault/upload — ciphertext relay to Auto Drive.
 *
 * PRD Addendum A: the Bureau NEVER receives plaintext. This route accepts
 * ONLY vault envelopes (client-side AES-256-GCM ciphertext carrying the
 * PPBVAULT1 magic header) and relays the bytes to Auto Drive. Anything that
 * is not a vault envelope is refused with 422 — there is no plaintext path.
 *
 * Body: application/octet-stream — the raw envelope bytes from
 * encryptVaultPayload (services/passport/selfCustodyVault.ts).
 * Response: { ok, contentId, contentHash } — the fields the client needs to
 * build its selfCustodyBlakQubeRef.
 *
 * Auth: spine Bearer token (use personaFetch / fetch with Authorization).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAutoDriveApi } from '@autonomys/auto-drive';
import { NetworkId } from '@autonomys/auto-utils';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { isVaultEnvelope, sha256Hex } from '@/services/passport/selfCustodyVault';

export const dynamic = 'force-dynamic';

/** 256 KiB — private passport details are small structured payloads. */
const MAX_ENVELOPE_BYTES = 256 * 1024;

export async function POST(req: NextRequest) {
  try {
    const caller = await getCallerIdentityContext(req);
    if (!caller?.authProfileId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const apiKey = process.env.AUTONOMYS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'Vault storage not configured (AUTONOMYS_API_KEY missing)' },
        { status: 503 },
      );
    }

    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json({ ok: false, error: 'Empty body' }, { status: 400 });
    }
    if (buf.length > MAX_ENVELOPE_BYTES) {
      return NextResponse.json(
        { ok: false, error: `Envelope exceeds ${MAX_ENVELOPE_BYTES} bytes` },
        { status: 413 },
      );
    }
    if (!isVaultEnvelope(buf)) {
      // Hard refusal — this route never accepts plaintext (Addendum A).
      return NextResponse.json(
        { ok: false, error: 'Body is not a vault envelope — only client-side-encrypted payloads are accepted' },
        { status: 422 },
      );
    }

    const contentHash = await sha256Hex(buf);
    const api = createAutoDriveApi({ apiKey, network: NetworkId.MAINNET });
    const contentId = await api.uploadFileFromBuffer(
      Buffer.from(buf),
      `ppb-vault-${contentHash.slice(0, 12)}.enc`,
    );

    return NextResponse.json({
      ok: true,
      contentId: String(contentId),
      contentHash,
      storageProvider: 'autodrive',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Vault upload failed';
    console.error('[passport vault upload]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
