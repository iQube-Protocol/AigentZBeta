/**
 * POST /api/polity-passport/locker/claim-agreement
 *
 * Body: { inviteCode }. The invitee side of the x409 Locker exchange
 * (CFS-042/CFS-044): a signed-in persona redeems an invitation issued by
 * /api/constitutional/agreement/invite, and the formed x409 Constitutional
 * Agreement lands in THEIR Passport Locker as an encrypted contract item —
 * the project-initiation contract waiting to be executed.
 *
 * The locker item's display name carries only a T2-safe commitment of the
 * agreement id (sha256 16-hex, 'x409:locker:' namespace) — the raw
 * agreementId is a capability string and lives ONLY inside the encrypted
 * payload, never in locker metadata (the HMS identifier-isolation rule).
 *
 * One claim per invitation. Claiming binds nothing: acceptance stays with
 * the pre-named agent (public agreement route), authorization stays with
 * the operator (gated route) — Principal–Delegate Separation intact.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { publishLockerItem } from '@/services/passport/lockerStorage';
import { getAgreement } from '@/services/constitutional/constitutionalAgreement';

export const dynamic = 'force-dynamic';

const X409_LOCKER_CONTENT_TYPE = 'application/x409-agreement+json';

function getEncryptionKey(): Buffer {
  const keyHex = process.env.PERSONA_IQUBE_ENCRYPTION_KEY;
  if (keyHex && keyHex.length === 64) return Buffer.from(keyHex, 'hex');
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
    if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

    const body = (await req.json().catch(() => ({}))) as { inviteCode?: string };
    const code = body.inviteCode?.trim();
    if (!code) return NextResponse.json({ ok: false, error: 'inviteCode is required' }, { status: 400 });

    const { data: invite, error: invErr } = await admin
      .from('x409_invitations')
      .select('id, code, agreement_id, label, status')
      .eq('code', code)
      .maybeSingle();
    if (invErr) {
      if (invErr.message.includes('x409_invitations')) {
        return NextResponse.json({ ok: false, error: 'Invitations not provisioned — apply 20260724000000_x409_invitations.sql.' }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: invErr.message }, { status: 500 });
    }
    if (!invite) return NextResponse.json({ ok: false, error: 'Invitation not found' }, { status: 404 });
    if (invite.status !== 'pending') {
      return NextResponse.json({ ok: false, error: `Invitation already ${invite.status}` }, { status: 409 });
    }

    const agreement = await getAgreement(String(invite.agreement_id));
    if (!agreement) return NextResponse.json({ ok: false, error: 'Agreement no longer exists' }, { status: 404 });

    // The contract payload the holder (and granted agents) will decrypt: the
    // capability reference + everything needed to review and act on it.
    const payloadJson = JSON.stringify({
      kind: 'x409-agreement',
      agreementId: agreement.agreementId,
      displayLabel: agreement.displayLabel,
      selectedAgentRef: agreement.selectedAgentRef,
      capabilityRef: agreement.capabilityRef,
      statusPath: `/api/public/irl/agreement?agreementId=${agreement.agreementId}`,
      acceptPath: '/api/public/irl/agreement',
      claimedAt: new Date().toISOString(),
    });

    const plaintext = Buffer.from(payloadJson, 'utf8');
    const key = getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // T2-safe display name: the commitment, never the raw agreementId.
    const lockerRef = publicRef('x409:locker:' + agreement.agreementId);
    const displayName = `[x409:${lockerRef}] ${invite.label || agreement.displayLabel || 'Constitutional Agreement'}`;

    const publishResult = await publishLockerItem({
      holderPublicRef: publicRef(persona.personaId),
      ciphertext,
      iv,
      authTag,
      contentType: X409_LOCKER_CONTENT_TYPE,
      displayName,
    });

    const { data: row, error: insertErr } = await admin
      .from('passport_locker_items')
      .insert({
        holder_persona_id: persona.personaId,
        display_name: displayName,
        content_type: X409_LOCKER_CONTENT_TYPE,
        size_bytes: ciphertext.byteLength,
        walrus_blob_id: publishResult.walrusBlobId,
        sui_object_id: publishResult.suiObjectId,
        encryption_iv: iv.toString('base64'),
        encryption_auth_tag: authTag.toString('base64'),
        downloadable: false,
        storage_mode: publishResult.mode,
      })
      .select('item_id, display_name, created_at')
      .single();
    if (insertErr) {
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    await admin
      .from('x409_invitations')
      .update({ status: 'claimed', claimed_at: new Date().toISOString(), claimed_item_id: String(row.item_id) })
      .eq('id', invite.id);

    return NextResponse.json({
      ok: true,
      item: { itemId: row.item_id, displayName: row.display_name, createdAt: row.created_at },
      agreementStatus: agreement.status,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Claim failed' },
      { status: 500 },
    );
  }
}
