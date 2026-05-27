/**
 * services/uploads/personaUploadService.ts
 *
 * Persona Uploads — portable service for managing per-persona file
 * uploads consumed as context / tool input by aigentMe + Studio skills.
 *
 * Designed to be lifted out of this repo into its own package. The
 * service is split into:
 *
 *   - `PersonaUploadService` (this file): the public surface — upload,
 *     list, get, archive. Pure logic, depends only on the storage +
 *     metadata interfaces below.
 *   - Adapter implementations (`supabaseUploadAdapter.ts`): bind the
 *     service to a concrete backend (Supabase Storage + Postgres in
 *     this repo; other consumers can supply their own).
 *
 * Indexing (parse-on-upload) runs through `runUploadIndexer` which the
 * adapter triggers after the storage write lands. Indexer is best-
 * effort: a failure flips status='failed' on the row and surfaces the
 * error to the operator; metadata + storage still survive.
 *
 * Privacy: persona id is T0 — server-internal. All entry points
 * require an authenticated persona context passed by the route layer;
 * the service NEVER reads identity from the input payload directly.
 */

export type UploadUseKind = 'context' | 'tool' | 'workbench' | 'general';
export type UploadStatus = 'parsing' | 'ready' | 'archived' | 'failed';

export interface PersonaUploadRow {
  id: string;
  personaId: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  useKind: UploadUseKind;
  status: UploadStatus;
  label: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface PersonaUploadIndexRow {
  uploadId: string;
  contentMd: string | null;
  contentJson: unknown | null;
  summary: string | null;
  tokensEstimate: number;
  schemaMeta: unknown | null;
  error: string | null;
  indexedAt: string;
}

export interface PersonaUploadFull extends PersonaUploadRow {
  index: PersonaUploadIndexRow | null;
}

export interface CreateUploadInput {
  personaId: string;
  authProfileId?: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Raw bytes — the adapter writes to its storage backend. */
  data: Uint8Array;
  useKind?: UploadUseKind;
  label?: string;
  tags?: string[];
}

export interface ListUploadsOptions {
  status?: UploadStatus | UploadStatus[];
  useKind?: UploadUseKind | UploadUseKind[];
  /** Default 50, capped at 200. */
  limit?: number;
}

/**
 * Storage backend interface. The service writes bytes through this and
 * keeps no direct dependency on Supabase Storage / S3 / local disk.
 */
export interface UploadStorageAdapter {
  /** Write bytes to the backend at the computed path. Returns the
   *  storage-relative path (mirrored back to the metadata row). */
  put(input: { personaId: string; uploadId: string; ext: string; data: Uint8Array; mimeType: string }): Promise<{ storagePath: string }>;
  /** Read bytes back — used by the indexer + by attach-for-context. */
  read(storagePath: string): Promise<Uint8Array>;
  /** Soft-delete on archive — adapter chooses whether to keep the
   *  file or hard-delete it. Default impl: keep. */
  archive?(storagePath: string): Promise<void>;
}

/**
 * Metadata backend interface — wraps the persona_uploads +
 * persona_upload_index tables. Consumers using a non-Postgres store
 * can supply their own implementation.
 */
export interface UploadMetadataAdapter {
  insertRow(row: Omit<PersonaUploadRow, 'createdAt' | 'updatedAt' | 'archivedAt'>): Promise<PersonaUploadRow>;
  updateRow(uploadId: string, patch: Partial<Omit<PersonaUploadRow, 'id'>>): Promise<PersonaUploadRow | null>;
  getRow(uploadId: string): Promise<PersonaUploadRow | null>;
  listRows(personaId: string, opts?: ListUploadsOptions): Promise<PersonaUploadRow[]>;
  upsertIndex(row: PersonaUploadIndexRow): Promise<PersonaUploadIndexRow>;
  getIndex(uploadId: string): Promise<PersonaUploadIndexRow | null>;
}

/**
 * Indexer signature — runs after the storage write lands. Returns the
 * index row to upsert. Implementations live alongside the service
 * (uploadIndexer.ts) and dispatch by mime type.
 */
export type UploadIndexer = (params: {
  upload: PersonaUploadRow;
  bytes: Uint8Array;
}) => Promise<Omit<PersonaUploadIndexRow, 'indexedAt'>>;

/**
 * Hard limits enforced by the service. These can be relaxed by a
 * specific deployment, but the defaults are safe across environments.
 */
export const UPLOAD_LIMITS = {
  /** 50 MB per file. */
  maxBytes: 50 * 1024 * 1024,
  /** Indexed text capped here — chunking happens on inject. */
  maxIndexedChars: 256 * 1024,
} as const;

export const BLOCKED_EXTENSIONS = new Set([
  'exe', 'sh', 'bat', 'cmd', 'msi', 'dmg', 'app', 'apk', 'deb', 'rpm', 'jar', 'ps1', 'vbs', 'scr',
]);

function uuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  // Fallback — sufficient for non-cryptographic ids.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function extOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  if (i < 0) return '';
  return filename.slice(i + 1).toLowerCase();
}

export interface PersonaUploadServiceOptions {
  storage: UploadStorageAdapter;
  metadata: UploadMetadataAdapter;
  /** Optional — when provided, runs after the storage write. The
   *  service handles success → 'ready' / failure → 'failed' for you. */
  indexer?: UploadIndexer;
}

export class PersonaUploadService {
  private storage: UploadStorageAdapter;
  private metadata: UploadMetadataAdapter;
  private indexer: UploadIndexer | null;

  constructor(opts: PersonaUploadServiceOptions) {
    this.storage = opts.storage;
    this.metadata = opts.metadata;
    this.indexer = opts.indexer ?? null;
  }

  async upload(input: CreateUploadInput): Promise<PersonaUploadFull> {
    if (!input.personaId) throw new Error('personaId required');
    if (!input.filename) throw new Error('filename required');
    if (input.sizeBytes <= 0) throw new Error('non-empty file required');
    if (input.sizeBytes > UPLOAD_LIMITS.maxBytes) {
      throw new Error(`file too large (${input.sizeBytes} > ${UPLOAD_LIMITS.maxBytes} bytes)`);
    }
    const ext = extOf(input.filename);
    if (BLOCKED_EXTENSIONS.has(ext)) {
      throw new Error(`file extension blocked: .${ext}`);
    }

    const uploadId = uuid();
    const stored = await this.storage.put({
      personaId: input.personaId,
      uploadId,
      ext,
      data: input.data,
      mimeType: input.mimeType,
    });

    const now = new Date().toISOString();
    const row: PersonaUploadRow = await this.metadata.insertRow({
      id: uploadId,
      personaId: input.personaId,
      storagePath: stored.storagePath,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      useKind: input.useKind ?? 'general',
      status: this.indexer ? 'parsing' : 'ready',
      label: input.label ?? input.filename.replace(/\.[^/.]+$/, ''),
      tags: input.tags ?? [],
    } as PersonaUploadRow);
    void now;

    // Index in the background — but await the first pass so the API
    // route can return a 'ready' status (and any parse errors) inline.
    let index: PersonaUploadIndexRow | null = null;
    if (this.indexer) {
      try {
        const partial = await this.indexer({ upload: row, bytes: input.data });
        index = await this.metadata.upsertIndex({
          uploadId,
          contentMd: partial.contentMd ?? null,
          contentJson: partial.contentJson ?? null,
          summary: partial.summary ?? null,
          tokensEstimate: partial.tokensEstimate ?? 0,
          schemaMeta: partial.schemaMeta ?? null,
          error: partial.error ?? null,
          indexedAt: new Date().toISOString(),
        });
        await this.metadata.updateRow(uploadId, {
          status: partial.error ? 'failed' : 'ready',
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        index = await this.metadata.upsertIndex({
          uploadId,
          contentMd: null,
          contentJson: null,
          summary: null,
          tokensEstimate: 0,
          schemaMeta: null,
          error: msg,
          indexedAt: new Date().toISOString(),
        });
        await this.metadata.updateRow(uploadId, { status: 'failed' });
      }
    }

    const finalRow = (await this.metadata.getRow(uploadId)) ?? row;
    return { ...finalRow, index };
  }

  async list(personaId: string, opts?: ListUploadsOptions): Promise<PersonaUploadRow[]> {
    if (!personaId) return [];
    return this.metadata.listRows(personaId, opts);
  }

  async get(uploadId: string, personaId: string): Promise<PersonaUploadFull | null> {
    const row = await this.metadata.getRow(uploadId);
    if (!row || row.personaId !== personaId) return null;
    const index = await this.metadata.getIndex(uploadId);
    return { ...row, index };
  }

  async archive(uploadId: string, personaId: string): Promise<boolean> {
    const row = await this.metadata.getRow(uploadId);
    if (!row || row.personaId !== personaId) return false;
    await this.metadata.updateRow(uploadId, {
      status: 'archived',
      archivedAt: new Date().toISOString(),
    });
    if (this.storage.archive) {
      await this.storage.archive(row.storagePath).catch(() => undefined);
    }
    return true;
  }

  async readBytes(uploadId: string, personaId: string): Promise<Uint8Array | null> {
    const row = await this.metadata.getRow(uploadId);
    if (!row || row.personaId !== personaId) return null;
    return this.storage.read(row.storagePath);
  }
}
