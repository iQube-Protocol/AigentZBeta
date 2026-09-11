/**
 * /api/polity-passport/locker
 *
 * GET — list the active persona's locker items (+ grants made on each).
 * POST — upload a new encrypted item: body { displayName, contentType,
 *         payloadBase64, ivBase64, authTagBase64, downloadable }.
 *         The route encrypts only if payload is plaintext (dev fallback);
 *         production callers encrypt client-side and send ciphertext.
 *
 * Per the 2026-06-13 hackathon plan §Sprint 4. Sui+Walrus rail only.
 *
 * T0 discipline: holder_persona_id selected server-side; never
 * serialised. Response carries item_id, walrus_blob_id (T2-safe),
 * sui_object_id (T2-safe), display_name, content_type, downloadable.
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
      .from('passport_locker_items')
      .select(
        'item_id, display_name, content_type, size_bytes, walrus_blob_id, sui_object_id, downloadable, storage_mode, created_at, encryption_iv, encryption_auth_tag',
      )
      .eq('holder_persona_id', persona.personaId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.message.includes('passport_locker_items')) {
        return NextResponse.json(
          {
            ok: true,
            items: [],
            grants: [],
            migrationPending: '20260613300000_passport_locker_qubetalk.sql',
          },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const items = data ?? [];
    const itemIds = items.map((i) => i.item_id);

    let grants: Array<{
      grant_id: string;
      item_id: string;
      delegated_persona_id: string;
      delegated_agent_root_id: string | null;
      scope: string;
      granted_at: string;
      expires_at: string | null;
      revoked_at: string | null;
    }> = [];

    if (itemIds.length > 0) {
      const { data: gs } = await admin
        .from('passport_locker_grants')
        .select('grant_id, item_id, delegated_persona_id, delegated_agent_root_id, scope, granted_at, expires_at, revoked_at')
        .in('item_id', itemIds)
        .is('revoked_at', null);
      grants = gs ?? [];
    }

    return NextResponse.json(
      {
        ok: true,
        items: items.map((i) => ({
          itemId: i.item_id,
          displayName: i.display_name,
          contentType: i.content_type,
          sizeBytes: i.size_bytes,
          walrusBlobId: i.walrus_blob_id,
          suiObjectId: i.sui_object_id,
          downloadable: i.downloadable,
          storageMode: i.storage_mode,
          createdAt: i.created_at,
          encryptionIv: i.encryption_iv ?? null,
          encryptionAuthTag: i.encryption_auth_tag ?? null,
        })),
        grants: grants.map((g) => ({
          grantId: g.grant_id,
          itemId: g.item_id,
          delegatedPersonaId: null, // T0 — server-internal; UI joins via sponsored agents endpoint
          delegatedAgentRootId: g.delegated_agent_root_id,
          scope: g.scope,
          grantedAt: g.granted_at,
          expiresAt: g.expires_at,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Locker list failed' },
      { status: 500 },
    );
  }
}

interface UploadBody {
  displayName: string;
  contentType: string;
  /** Base64-encoded plaintext OR ciphertext. If ciphertextProvided=true, treated as ciphertext. */
  payloadBase64: string;
  ciphertextProvided?: boolean;
  ivBase64?: string;
  authTagBase64?: string;
  downloadable?: boolean;
  holderPassportId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await req.json()) as UploadBody;
    if (!body?.displayName?.trim() || !body?.contentType?.trim() || !body?.payloadBase64) {
      return NextResponse.json(
        { ok: false, error: 'displayName, contentType, and payloadBase64 are required' },
        { status: 400 },
      );
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    let ciphertext: Buffer;
    let iv: Buffer;
    let authTag: Buffer;

    if (body.ciphertextProvided) {
      if (!body.ivBase64 || !body.authTagBase64) {
        return NextResponse.json(
          { ok: false, error: 'ciphertextProvided=true requires ivBase64 + authTagBase64' },
          { status: 400 },
        );
      }
      ciphertext = Buffer.from(body.payloadBase64, 'base64');
      iv = Buffer.from(body.ivBase64, 'base64');
      authTag = Buffer.from(body.authTagBase64, 'base64');
    } else {
      // Dev fallback — encrypt server-side under PERSONA_IQUBE_ENCRYPTION_KEY.
      const plaintext = Buffer.from(body.payloadBase64, 'base64');
      const key = getEncryptionKey();
      iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      authTag = cipher.getAuthTag();
    }

    const holderPublicRef = publicRef(persona.personaId);
    const publishResult = await publishLockerItem({
      holderPublicRef,
      ciphertext,
      iv,
      authTag,
      contentType: body.contentType,
      displayName: body.displayName,
    });

    const { data: row, error: insertErr } = await admin
      .from('passport_locker_items')
      .insert({
        holder_persona_id: persona.personaId,
        holder_passport_id: body.holderPassportId ?? null,
        display_name: body.displayName.trim(),
        content_type: body.contentType.trim(),
        size_bytes: ciphertext.byteLength,
        walrus_blob_id: publishResult.walrusBlobId,
        sui_object_id: publishResult.suiObjectId,
        encryption_iv: iv.toString('base64'),
        encryption_auth_tag: authTag.toString('base64'),
        downloadable: body.downloadable !== false,
        storage_mode: publishResult.mode,
      })
      .select('item_id, display_name, content_type, walrus_blob_id, sui_object_id, downloadable, storage_mode, created_at')
      .single();

    if (insertErr) {
      if (insertErr.message.includes('passport_locker_items')) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Pending migration: 20260613300000_passport_locker_qubetalk.sql must be applied in Supabase before locker uploads can persist.',
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      item: {
        itemId: row.item_id,
        displayName: row.display_name,
        contentType: row.content_type,
        walrusBlobId: row.walrus_blob_id,
        suiObjectId: row.sui_object_id,
        downloadable: row.downloadable,
        storageMode: row.storage_mode,
        createdAt: row.created_at,
      },
      note: publishResult.note,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Locker upload failed' },
      { status: 500 },
    );
  }
}
