/**
 * Locker items — the authoritative "create a persisted locker item from
 * plaintext for a persona" path: encrypt (AES-256-GCM) → publish to the
 * Sui+Walrus rail (`publishLockerItem`) → insert `passport_locker_items`.
 *
 * This composes the exact steps the locker upload route
 * (`app/api/polity-passport/locker/route.ts`) performs inline for its
 * server-encrypt (dev-fallback) branch. It exists so other surfaces — e.g.
 * QubeTalk copy-to-locker — reuse the SAME encryption + storage path rather
 * than duplicating crypto or bypassing the rail.
 *
 * TODO(converge): migrate the locker route's dev-fallback branch to call this
 * so there is a single source (kept separate for now to avoid editing the live
 * encrypted-upload path mid-session).
 *
 * T0 discipline: `holder_persona_id` is written from the caller's own persona
 * (owner-authenticated); the holder commitment on the storage rail is the
 * public ref, never the raw UUID.
 */

import { createCipheriv, createHash, randomBytes } from 'crypto';

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { publishLockerItem } from '@/services/passport/lockerStorage';

function getEncryptionKey(): Buffer {
  const keyHex = process.env.PERSONA_IQUBE_ENCRYPTION_KEY;
  if (keyHex && keyHex.length === 64) return Buffer.from(keyHex, 'hex');
  return Buffer.alloc(32, 0);
}

export interface AddLockerItemInput {
  displayName: string;
  contentType: string;
  /** Plaintext content — a Buffer or a UTF-8 string. Encrypted here. */
  plaintext: Buffer | string;
  /** false = view-in-app only (no byte export). Defaults to true. */
  downloadable?: boolean;
  holderPassportId?: string | null;
}

export interface AddedLockerItem {
  itemId: string;
  displayName: string;
  contentType: string;
  walrusBlobId: string;
  suiObjectId: string | null;
  downloadable: boolean;
  storageMode: string;
  createdAt: string;
}

export type AddLockerItemResult =
  | { ok: true; item: AddedLockerItem; note?: string }
  | { ok: false; error: string; code?: string };

/** Encrypt + publish + persist a locker item owned by `personaId`. */
export async function addLockerItemForPersona(
  personaId: string,
  input: AddLockerItemInput,
): Promise<AddLockerItemResult> {
  const admin = getSupabaseServer();
  if (!admin) return { ok: false, error: 'Supabase configuration missing' };
  if (!input.displayName?.trim() || !input.contentType?.trim()) {
    return { ok: false, error: 'displayName and contentType are required', code: 'bad_input' };
  }

  const plaintext = typeof input.plaintext === 'string' ? Buffer.from(input.plaintext, 'utf8') : input.plaintext;
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const holderPublicRef = createHash('sha256').update(personaId).digest('hex').slice(0, 16);
  const published = await publishLockerItem({
    holderPublicRef,
    ciphertext,
    iv,
    authTag,
    contentType: input.contentType,
    displayName: input.displayName,
  });

  const { data: row, error } = await admin
    .from('passport_locker_items')
    .insert({
      holder_persona_id: personaId,
      holder_passport_id: input.holderPassportId ?? null,
      display_name: input.displayName.trim(),
      content_type: input.contentType.trim(),
      size_bytes: ciphertext.byteLength,
      walrus_blob_id: published.walrusBlobId,
      sui_object_id: published.suiObjectId,
      encryption_iv: iv.toString('base64'),
      encryption_auth_tag: authTag.toString('base64'),
      downloadable: input.downloadable !== false,
      storage_mode: published.mode,
    })
    .select('item_id, display_name, content_type, walrus_blob_id, sui_object_id, downloadable, storage_mode, created_at')
    .single();

  if (error) {
    if (error.message.includes('passport_locker_items')) {
      return { ok: false, code: 'migration_pending', error: 'locker not provisioned — apply 20260613300000.' };
    }
    return { ok: false, error: error.message };
  }
  return {
    ok: true,
    note: published.note,
    item: {
      itemId: String(row.item_id),
      displayName: String(row.display_name),
      contentType: String(row.content_type),
      walrusBlobId: String(row.walrus_blob_id),
      suiObjectId: (row.sui_object_id as string | null) ?? null,
      downloadable: Boolean(row.downloadable),
      storageMode: String(row.storage_mode),
      createdAt: String(row.created_at),
    },
  };
}
