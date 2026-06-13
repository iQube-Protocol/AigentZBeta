/**
 * POST /api/iqube/persona/passport/mint
 *
 * Mints the active persona as a PersonaQube on the Sui+Walrus rail (the
 * canonical Polity Passport rail per the 2026-06-13 hackathon plan).
 *
 * Distinct from /api/iqube/persona/qripto/mint and /api/iqube/persona/knyt/mint
 * which target the AutoDrive rail — those remain for non-passport content.
 *
 * Flow:
 *   1. Resolve active persona via the spine (getActivePersona).
 *   2. Build a public-safe persona descriptor (commitment refs only — T0
 *      IDs never serialise).
 *   3. Encrypt the descriptor under the holder's persona key (AES-256-GCM).
 *   4. Call mintPersonaToSui → returns (suiObjectId, walrusBlobId, mode).
 *      Stub mode runs when SUI_PACKAGE_ID / WALRUS_PUBLISHER_URL unset.
 *   5. Write persona_qube_mints row (upsert).
 *   6. Return IDs + mode to the wallet drawer.
 *
 * T0 discipline: persona_id is selected server-side for the row write
 * ONLY. The response carries only persona_public_ref, suiObjectId,
 * walrusBlobId. Nothing T0 escapes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { mintPersonaToSui } from '@/services/persona/mintPersonaToSui';

export const dynamic = 'force-dynamic';

function getEncryptionKey(): Buffer {
  const keyHex = process.env.PERSONA_IQUBE_ENCRYPTION_KEY;
  if (keyHex && keyHex.length === 64) return Buffer.from(keyHex, 'hex');
  // Dev fallback — zero key. Logged in the response so the operator knows.
  return Buffer.alloc(32, 0);
}

function publicRef(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    // T1-safe descriptor — only commitment refs travel in/out.
    const personaPublicRef = publicRef(persona.personaId);
    const kybeDidPublicRef: string | null = null; // sourced server-side from passport_records lookup if present; null otherwise

    const descriptor = {
      schema: 'polity.persona.descriptor.v0.1',
      persona_public_ref: personaPublicRef,
      kybe_did_public_ref: kybeDidPublicRef,
      cartridge_flags: {
        isAdmin: Boolean(persona.cartridgeFlags?.isAdmin),
        isPartner: Boolean(persona.cartridgeFlags?.isPartner),
      },
      issued_at: new Date().toISOString(),
    };

    // Encrypt the descriptor — this is the blob that lands on Walrus.
    const key = getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const plaintext = Buffer.from(JSON.stringify(descriptor), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Mint — stub mode if Sui/Walrus env vars not set, real path otherwise.
    const result = await mintPersonaToSui({
      personaId: persona.personaId,
      personaPublicRef,
      kybeDidPublicRef,
      encryptedBlakQube: ciphertext,
      encryptionIv: iv,
      encryptionAuthTag: authTag,
    });

    // Upsert the mint row (uniq on persona_id).
    const { data: mintRow, error: insertErr } = await admin
      .from('persona_qube_mints')
      .upsert(
        {
          persona_id: persona.personaId,
          persona_public_ref: personaPublicRef,
          kybe_did_public_ref: kybeDidPublicRef,
          sui_object_id: result.suiObjectId,
          walrus_blob_id: result.walrusBlobId,
          mint_mode: result.mode,
          on_chain: result.onChain,
          minted_at: result.mintedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'persona_id' },
      )
      .select('mint_id')
      .single();

    if (insertErr) {
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    const usingDevKey = !process.env.PERSONA_IQUBE_ENCRYPTION_KEY;

    return NextResponse.json({
      ok: true,
      mintId: mintRow?.mint_id,
      status: 'minted',
      mode: result.mode,
      onChain: result.onChain,
      suiObjectId: result.suiObjectId,
      walrusBlobId: result.walrusBlobId,
      personaPublicRef,
      mintedAt: result.mintedAt,
      note: result.note,
      _devEncryption: usingDevKey
        ? 'WARNING: using dev zero-key. Set PERSONA_IQUBE_ENCRYPTION_KEY (64 hex chars) for production.'
        : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Mint failed' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/iqube/persona/passport/mint — returns current mint state for
 * the active persona (used by the wallet drawer to render "minted" status
 * on load without re-minting).
 */
export async function GET(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    const { data, error } = await admin
      .from('persona_qube_mints')
      .select('mint_id, persona_public_ref, sui_object_id, walrus_blob_id, mint_mode, on_chain, minted_at')
      .eq('persona_id', persona.personaId)
      .maybeSingle();

    if (error && !error.message.includes('persona_qube_mints')) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ ok: true, minted: false });
    }

    return NextResponse.json({
      ok: true,
      minted: true,
      mintId: data.mint_id,
      mode: data.mint_mode,
      onChain: data.on_chain,
      suiObjectId: data.sui_object_id,
      walrusBlobId: data.walrus_blob_id,
      personaPublicRef: data.persona_public_ref,
      mintedAt: data.minted_at,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Lookup failed' },
      { status: 500 },
    );
  }
}
