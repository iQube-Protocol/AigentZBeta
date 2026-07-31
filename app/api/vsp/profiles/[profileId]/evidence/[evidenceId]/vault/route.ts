/**
 * POST /api/vsp/profiles/[profileId]/evidence/[evidenceId]/vault
 *
 * Publishes evidence content to the Standing Vault (Walrus + Sui).
 * Encrypts the content_text under AES-256-GCM server-side, then
 * calls publishLockerItem (same Walrus rail as the Polity Passport locker).
 *
 * After successful publication:
 *  - Sets vsp_evidence.storage_backend = 'sui_locker'
 *  - Sets vsp_evidence.storage_ref = walrusBlobId
 *
 * BLACK / BLAKQUBE evidence is always vault-eligible.
 * WHITE / GREY evidence may also be vaulted for completeness.
 *
 * T0 discipline: holderPublicRef is a sha256 commitment — personaId never
 * travels to Walrus or Sui.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { publishLockerItem } from '@/services/passport/lockerStorage';

export const dynamic = 'force-dynamic';

function getEncryptionKey(): Buffer {
  const keyHex = process.env.PERSONA_IQUBE_ENCRYPTION_KEY;
  if (keyHex && keyHex.length === 64) return Buffer.from(keyHex, 'hex');
  return Buffer.alloc(32, 0);
}

function publicRef(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

async function canAccess(
  personaId: string,
  profileId: string,
  isAdmin: boolean,
  supabase: ReturnType<typeof getSupabaseServer>,
): Promise<boolean> {
  if (isAdmin) return true;
  const { data } = await supabase
    .from('vsp_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('owner_persona_id', personaId)
    .maybeSingle();
  return !!data;
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ profileId: string; evidenceId: string }> }
) {
  const params = await props.params;
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    const isAdmin = persona.cartridgeFlags?.isAdmin === true;

    if (!(await canAccess(persona.personaId, params.profileId, isAdmin, supabase))) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const { data: evidence, error: evErr } = await supabase
      .from('vsp_evidence')
      .select('id, label, content_text, source_type, classification, storage_backend')
      .eq('id', params.evidenceId)
      .eq('profile_id', params.profileId)
      .single();

    if (evErr || !evidence) {
      return NextResponse.json({ ok: false, error: 'Evidence not found' }, { status: 404 });
    }

    if (evidence.storage_backend === 'sui_locker') {
      return NextResponse.json({
        ok: false,
        error: 'Evidence is already vaulted. Re-vault not supported — create a new evidence item to supersede.',
      }, { status: 409 });
    }

    if (!evidence.content_text?.trim()) {
      return NextResponse.json({ ok: false, error: 'Evidence has no content to vault' }, { status: 422 });
    }

    // Encrypt content_text under the persona's vault key
    const plaintext = Buffer.from(evidence.content_text, 'utf8');
    const key = getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const holderPublicRef = publicRef(persona.personaId);

    // Standing Vault display name — no raw IDs; uses evidence label only
    const displayName = `[Standing Vault] ${evidence.label}`;

    const publishResult = await publishLockerItem({
      holderPublicRef,
      ciphertext,
      iv,
      authTag,
      contentType: 'text/plain',
      displayName,
    });

    // Update evidence with vault refs
    await supabase
      .from('vsp_evidence')
      .update({
        storage_backend: 'sui_locker',
        storage_ref: publishResult.walrusBlobId,
      })
      .eq('id', params.evidenceId);

    return NextResponse.json({
      ok: true,
      vault: {
        storageBackend: 'sui_locker',
        walrusBlobId: publishResult.walrusBlobId,
        suiObjectId: publishResult.suiObjectId,
        mode: publishResult.mode,
        onChain: publishResult.onChain,
        note: publishResult.note,
      },
    });
  } catch (err) {
    console.error('[vsp/evidence/vault POST]', err);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
