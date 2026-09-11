/**
 * services/uploads/supabaseUploadAdapter.ts
 *
 * Supabase Storage + Postgres binding for `PersonaUploadService`.
 *
 * Storage bucket: `persona-uploads` (must exist; service-role only).
 * Path format:    `<persona_id>/<yyyy-mm>/<upload_id>.<ext>`
 *
 * Metadata: `persona_uploads` + `persona_upload_index` tables (see
 * supabase/migrations/20260527000000_persona_uploads.sql).
 *
 * This adapter is the only file that knows about Supabase — the rest
 * of the service is portable.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  PersonaUploadService,
  type PersonaUploadRow,
  type PersonaUploadIndexRow,
  type UploadStorageAdapter,
  type UploadMetadataAdapter,
  type ListUploadsOptions,
} from './personaUploadService';
import { defaultUploadIndexer } from './uploadIndexer';

const STORAGE_BUCKET = 'persona-uploads';

function yyyyMm(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function rowFromDb(r: Record<string, unknown>): PersonaUploadRow {
  return {
    id: String(r.id),
    personaId: String(r.persona_id),
    storagePath: String(r.storage_path),
    filename: String(r.filename),
    mimeType: String(r.mime_type),
    sizeBytes: Number(r.size_bytes),
    useKind: r.use_kind as PersonaUploadRow['useKind'],
    status: r.status as PersonaUploadRow['status'],
    label: (r.label as string | null) ?? null,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    archivedAt: (r.archived_at as string | null) ?? null,
  };
}

function indexFromDb(r: Record<string, unknown>): PersonaUploadIndexRow {
  return {
    uploadId: String(r.upload_id),
    contentMd: (r.content_md as string | null) ?? null,
    contentJson: r.content_json ?? null,
    summary: (r.summary as string | null) ?? null,
    tokensEstimate: Number(r.tokens_estimate ?? 0),
    schemaMeta: r.schema_meta ?? null,
    error: (r.error as string | null) ?? null,
    indexedAt: String(r.indexed_at),
  };
}

const storageAdapter: UploadStorageAdapter = {
  async put({ personaId, uploadId, ext, data, mimeType }) {
    const admin = getSupabaseServer();
    if (!admin) throw new Error('supabase-unavailable');
    const path = `${personaId}/${yyyyMm()}/${uploadId}${ext ? `.${ext}` : ''}`;
    const { error } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(path, data, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
      });
    if (error) throw new Error(`storage upload failed: ${error.message}`);
    return { storagePath: path };
  },
  async read(storagePath) {
    const admin = getSupabaseServer();
    if (!admin) throw new Error('supabase-unavailable');
    const { data, error } = await admin.storage.from(STORAGE_BUCKET).download(storagePath);
    if (error || !data) throw new Error(`storage read failed: ${error?.message ?? 'no data'}`);
    const arrayBuf = await data.arrayBuffer();
    return new Uint8Array(arrayBuf);
  },
  async archive() {
    // Keep the file. Operator can purge later via Storage UI / admin tool.
  },
};

const metadataAdapter: UploadMetadataAdapter = {
  async insertRow(row) {
    const admin = getSupabaseServer();
    if (!admin) throw new Error('supabase-unavailable');
    const insertPayload = {
      id: row.id,
      persona_id: row.personaId,
      storage_path: row.storagePath,
      filename: row.filename,
      mime_type: row.mimeType,
      size_bytes: row.sizeBytes,
      use_kind: row.useKind,
      status: row.status,
      label: row.label,
      tags: row.tags,
    };
    const { data, error } = await admin
      .from('persona_uploads')
      .insert(insertPayload)
      .select('*')
      .single();
    if (error || !data) throw new Error(`persona_uploads insert failed: ${error?.message ?? 'no row'}`);
    return rowFromDb(data as Record<string, unknown>);
  },
  async updateRow(uploadId, patch) {
    const admin = getSupabaseServer();
    if (!admin) throw new Error('supabase-unavailable');
    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.useKind !== undefined) dbPatch.use_kind = patch.useKind;
    if (patch.label !== undefined) dbPatch.label = patch.label;
    if (patch.tags !== undefined) dbPatch.tags = patch.tags;
    if (patch.archivedAt !== undefined) dbPatch.archived_at = patch.archivedAt;
    const { data, error } = await admin
      .from('persona_uploads')
      .update(dbPatch)
      .eq('id', uploadId)
      .select('*')
      .single();
    if (error || !data) return null;
    return rowFromDb(data as Record<string, unknown>);
  },
  async getRow(uploadId) {
    const admin = getSupabaseServer();
    if (!admin) return null;
    const { data, error } = await admin
      .from('persona_uploads')
      .select('*')
      .eq('id', uploadId)
      .maybeSingle();
    if (error || !data) return null;
    return rowFromDb(data as Record<string, unknown>);
  },
  async listRows(personaId, opts) {
    const admin = getSupabaseServer();
    if (!admin) return [];
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    let q = admin
      .from('persona_uploads')
      .select('*')
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (opts?.status) {
      const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
      q = q.in('status', statuses);
    }
    if (opts?.useKind) {
      const kinds = Array.isArray(opts.useKind) ? opts.useKind : [opts.useKind];
      q = q.in('use_kind', kinds);
    }
    const { data, error } = await q;
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(rowFromDb);
  },
  async upsertIndex(row) {
    const admin = getSupabaseServer();
    if (!admin) throw new Error('supabase-unavailable');
    const insertPayload = {
      upload_id: row.uploadId,
      content_md: row.contentMd,
      content_json: row.contentJson,
      summary: row.summary,
      tokens_estimate: row.tokensEstimate,
      schema_meta: row.schemaMeta,
      error: row.error,
      indexed_at: row.indexedAt,
    };
    const { data, error } = await admin
      .from('persona_upload_index')
      .upsert(insertPayload, { onConflict: 'upload_id' })
      .select('*')
      .single();
    if (error || !data) throw new Error(`persona_upload_index upsert failed: ${error?.message ?? 'no row'}`);
    return indexFromDb(data as Record<string, unknown>);
  },
  async getIndex(uploadId) {
    const admin = getSupabaseServer();
    if (!admin) return null;
    const { data, error } = await admin
      .from('persona_upload_index')
      .select('*')
      .eq('upload_id', uploadId)
      .maybeSingle();
    if (error || !data) return null;
    return indexFromDb(data as Record<string, unknown>);
  },
};

let cached: PersonaUploadService | null = null;

/**
 * Singleton accessor — every API route gets the same instance so the
 * adapter caches don't recreate. Lifted out of this repo by replacing
 * the storage + metadata adapters with non-Supabase implementations.
 */
export function getPersonaUploadService(): PersonaUploadService {
  if (cached) return cached;
  cached = new PersonaUploadService({
    storage: storageAdapter,
    metadata: metadataAdapter,
    indexer: defaultUploadIndexer,
  });
  return cached;
}

export { ListUploadsOptions };
