/**
 * Locker Asset Registry — Phase 1 (spec §7.1, §8, §16.1, §16.5).
 *
 * Reuse audit (full matrix in the Phase 1 closeout doc):
 *   - Storage: reuses services/content/storageAdapter.ts's
 *     SupabaseStorageAdapter — no second upload path. Bucket
 *     'locker-assets' is a new bucket name (Locker-native files are a
 *     distinct namespace from 'content-assets'), created lazily by
 *     Supabase Storage on first upload; no migration needed for buckets.
 *   - Table shape mirrors content_qubes / content_qube_storage
 *     (20260513010000_content_qubes_schema.sql) — a unified object row
 *     plus linked rendition rows, not a blob column.
 *   - Receipts: every mutation that spec §18 calls out emits through
 *     services/receipts/activityReceiptService.ts — no new receipts table.
 *
 * Ownership discipline: every read/write that takes a callerPersonaId
 * checks it against asset_records.owner_persona_id server-side. Nothing
 * here trusts a client-supplied ownerPersonaId for anything but the
 * INITIAL registration (where the caller registering IS the owner).
 */

import { randomUUID, createHash } from 'crypto';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { StorageAdapterFactory } from '@/services/content/storageAdapter';
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';
import type {
  AssetRecord, AssetRendition, AssetClass, NativeSystem, LifecycleStatus,
  SharingStatus, Sensitivity, RenditionKind, PeerResult,
} from '@/types/locker';

const LOCKER_BUCKET = 'locker-assets';

// ─────────────────────────────────────────────────────────────────────────
// Row <-> domain mapping.
// ─────────────────────────────────────────────────────────────────────────

interface AssetRow {
  id: string;
  title: string;
  description: string | null;
  asset_class: AssetClass;
  native_system: NativeSystem;
  native_reference: Record<string, unknown> | null;
  venture_id: string | null;
  project_id: string | null;
  owner_persona_id: string;
  owning_organization_ref: string | null;
  lifecycle_status: LifecycleStatus;
  sharing_status: SharingStatus;
  sensitivity: Sensitivity | null;
  aliases: string[] | null;
  tags: string[] | null;
  version_family_id: string;
  version_number: number;
  supersedes_asset_id: string | null;
  content_hash: string | null;
  original_filename: string | null;
  provenance: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function rowToAsset(row: AssetRow): AssetRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    assetClass: row.asset_class,
    nativeSystem: row.native_system,
    nativeReference: row.native_reference ?? {},
    ventureId: row.venture_id,
    projectId: row.project_id,
    ownerPersonaId: row.owner_persona_id,
    owningOrganizationRef: row.owning_organization_ref,
    lifecycleStatus: row.lifecycle_status,
    sharingStatus: row.sharing_status,
    sensitivity: row.sensitivity,
    aliases: row.aliases ?? [],
    tags: row.tags ?? [],
    versionFamilyId: row.version_family_id,
    versionNumber: row.version_number,
    supersedesAssetId: row.supersedes_asset_id,
    contentHash: row.content_hash,
    originalFilename: row.original_filename,
    provenance: row.provenance ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface RenditionRow {
  id: string;
  asset_id: string;
  rendition_kind: RenditionKind;
  storage_provider: 'supabase' | 'autonomys' | 'ipfs' | 'external';
  storage_uri: string;
  public_url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  content_hash: string | null;
  is_primary: boolean;
  created_at: string;
}

function rowToRendition(row: RenditionRow): AssetRendition {
  return {
    id: row.id,
    assetId: row.asset_id,
    renditionKind: row.rendition_kind,
    storageProvider: row.storage_provider,
    storageUri: row.storage_uri,
    publicUrl: row.public_url,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    contentHash: row.content_hash,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
  };
}

function admin() {
  const client = getSupabaseServer();
  if (!client) throw new Error('Supabase configuration missing for Locker asset registry');
  return client;
}

// ─────────────────────────────────────────────────────────────────────────
// Register (spec §8.5 steps 3-6 — storage itself is uploadLockerFile below).
// ─────────────────────────────────────────────────────────────────────────

export interface RegisterAssetInput {
  ownerPersonaId: string;
  title: string;
  description?: string;
  assetClass: AssetClass;
  nativeSystem?: NativeSystem;
  nativeReference?: Record<string, unknown>;
  ventureId?: string;
  projectId?: string;
  lifecycleStatus?: LifecycleStatus;
  sharingStatus?: SharingStatus;
  sensitivity?: Sensitivity;
  aliases?: string[];
  tags?: string[];
  contentHash?: string;
  originalFilename?: string;
  provenance?: Record<string, unknown>;
  /** Set only when this call registers a NEW VERSION of an existing family
   *  (spec §9.5). Never inferred silently — the caller (route/ingestion
   *  proposal) must have already confirmed this with the principal. */
  newVersionOf?: { versionFamilyId: string; supersedesAssetId: string };
}

export async function registerAsset(input: RegisterAssetInput): Promise<PeerResult<AssetRecord>> {
  if (!input.ownerPersonaId) return { ok: false, error: 'ownerPersonaId required' };
  if (!input.title.trim()) return { ok: false, error: 'title required' };

  const db = admin();
  const versionFamilyId = input.newVersionOf?.versionFamilyId ?? randomUUID();
  let versionNumber = 1;
  if (input.newVersionOf) {
    const { data: siblings } = await db
      .from('asset_records')
      .select('version_number')
      .eq('version_family_id', versionFamilyId)
      .order('version_number', { ascending: false })
      .limit(1);
    versionNumber = ((siblings?.[0] as { version_number?: number } | undefined)?.version_number ?? 0) + 1;
  }

  const { data, error } = await db
    .from('asset_records')
    .insert({
      title: input.title.trim(),
      description: input.description ?? null,
      asset_class: input.assetClass,
      native_system: input.nativeSystem ?? 'locker',
      native_reference: input.nativeReference ?? {},
      venture_id: input.ventureId ?? null,
      project_id: input.projectId ?? null,
      owner_persona_id: input.ownerPersonaId,
      lifecycle_status: input.lifecycleStatus ?? 'draft',
      sharing_status: input.sharingStatus ?? 'private',
      sensitivity: input.sensitivity ?? null,
      aliases: input.aliases ?? [],
      tags: input.tags ?? [],
      version_family_id: versionFamilyId,
      version_number: versionNumber,
      supersedes_asset_id: input.newVersionOf?.supersedesAssetId ?? null,
      content_hash: input.contentHash ?? null,
      original_filename: input.originalFilename ?? null,
      provenance: input.provenance ?? {},
    })
    .select('*')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' };
  const record = rowToAsset(data as AssetRow);

  await createActivityReceipt({
    personaId: input.ownerPersonaId,
    activeCartridge: 'locker',
    actionType: input.newVersionOf ? 'locker_asset_version_created' : 'locker_asset_registered',
    summary: input.newVersionOf
      ? `Registered a new version of "${record.title}" (v${record.versionNumber})`
      : `Registered asset "${record.title}"`,
    artifactsCreated: [record.id],
  }).catch((err) => console.warn('[Locker] registerAsset receipt failed (non-fatal):', err instanceof Error ? err.message : err));

  return { ok: true, value: record };
}

export interface AddRenditionInput {
  assetId: string;
  callerPersonaId: string;
  renditionKind: RenditionKind;
  storageProvider: 'supabase' | 'autonomys' | 'ipfs' | 'external';
  storageUri: string;
  publicUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  contentHash?: string;
  isPrimary?: boolean;
}

export async function addRendition(input: AddRenditionInput): Promise<PeerResult<AssetRendition>> {
  const db = admin();
  const owned = await assertOwnsAsset(db, input.assetId, input.callerPersonaId);
  if (!owned.ok) return owned;

  const { data, error } = await db
    .from('asset_renditions')
    .insert({
      asset_id: input.assetId,
      rendition_kind: input.renditionKind,
      storage_provider: input.storageProvider,
      storage_uri: input.storageUri,
      public_url: input.publicUrl ?? null,
      mime_type: input.mimeType ?? null,
      size_bytes: input.sizeBytes ?? null,
      content_hash: input.contentHash ?? null,
      is_primary: input.isPrimary ?? false,
    })
    .select('*')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' };
  return { ok: true, value: rowToRendition(data as RenditionRow) };
}

// ─────────────────────────────────────────────────────────────────────────
// Locker-native upload (spec §8.5) — persist bytes, hash, register, done
// in one call. This is the ONLY Phase-1 ingestion path; native-system
// resolver adapters (spec §6/§10) are Phase 2 and are NOT implemented here.
// ─────────────────────────────────────────────────────────────────────────

export interface UploadLockerFileInput {
  ownerPersonaId: string;
  file: Blob | ArrayBuffer;
  filename: string;
  mimeType: string;
  title?: string;
  assetClass: AssetClass;
  ventureId?: string;
  projectId?: string;
  sharingStatus?: SharingStatus;
  sensitivity?: Sensitivity;
  aliases?: string[];
  tags?: string[];
  /** Explicit new-version target — set only after the principal confirmed
   *  the duplicate/version-candidate proposal (spec §8.4: "never silently
   *  replace an existing asset"). */
  newVersionOf?: { versionFamilyId: string; supersedesAssetId: string };
}

export interface UploadLockerFileResult {
  asset: AssetRecord;
  rendition: AssetRendition;
  /** Populated when hashing the uploaded bytes matched an EXISTING asset's
   *  content_hash exactly — the caller still registered a new row (Phase 1
   *  never blocks the upload), but the route/UI should surface this so the
   *  principal can decide (spec acceptance #5: "exact duplicate upload is
   *  detected", never silently merged). */
  exactDuplicateOfAssetId: string | null;
}

async function hashBytes(file: Blob | ArrayBuffer): Promise<string> {
  const buf = file instanceof Blob ? await file.arrayBuffer() : file;
  return createHash('sha256').update(Buffer.from(buf)).digest('hex');
}

/** spec §8.4 — detect an EXACT duplicate by content hash within the same
 *  owner's assets. Never cross-owner (that would leak existence of another
 *  principal's private asset). */
export async function detectDuplicateAsset(
  ownerPersonaId: string,
  contentHash: string,
): Promise<PeerResult<AssetRecord | null>> {
  const db = admin();
  const { data, error } = await db
    .from('asset_records')
    .select('*')
    .eq('owner_persona_id', ownerPersonaId)
    .eq('content_hash', contentHash)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) return { ok: false, error: error.message };
  const row = (data as AssetRow[] | null)?.[0];
  return { ok: true, value: row ? rowToAsset(row) : null };
}

/** spec §8.4 — a "likely new version" candidate: same owner, same asset
 *  class, and either the same title or the same original filename, but a
 *  DIFFERENT content hash. This is a proposal only — registration always
 *  requires the caller to explicitly pass newVersionOf once confirmed
 *  (spec: "never silently replace an existing asset"). */
export async function detectVersionCandidates(
  ownerPersonaId: string,
  assetClass: AssetClass,
  title: string,
  filename: string,
): Promise<PeerResult<AssetRecord[]>> {
  const db = admin();
  const { data, error } = await db
    .from('asset_records')
    .select('*')
    .eq('owner_persona_id', ownerPersonaId)
    .eq('asset_class', assetClass)
    .eq('lifecycle_status', 'current')
    .order('updated_at', { ascending: false })
    .limit(25);
  if (error) return { ok: false, error: error.message };
  const rows = (data as AssetRow[] | null) ?? [];
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedFilename = filename.trim().toLowerCase();
  const candidates = rows.filter((r) =>
    r.title.trim().toLowerCase() === normalizedTitle ||
    (r.original_filename ?? '').trim().toLowerCase() === normalizedFilename,
  );
  return { ok: true, value: candidates.map(rowToAsset) };
}

export async function uploadLockerFile(input: UploadLockerFileInput): Promise<PeerResult<UploadLockerFileResult>> {
  if (!input.ownerPersonaId) return { ok: false, error: 'ownerPersonaId required' };

  const contentHash = await hashBytes(input.file);
  const dup = await detectDuplicateAsset(input.ownerPersonaId, contentHash);
  const exactDuplicateOfAssetId = dup.ok ? (dup.value?.id ?? null) : null;

  const adapter = StorageAdapterFactory.getAdapter('supabase');
  const safeName = input.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${input.ownerPersonaId}/${Date.now()}_${safeName}`;
  let uploadResult;
  try {
    uploadResult = await adapter.upload(LOCKER_BUCKET, path, input.file, { contentType: input.mimeType });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'storage upload failed' };
  }

  const registered = await registerAsset({
    ownerPersonaId: input.ownerPersonaId,
    title: input.title ?? input.filename,
    assetClass: input.assetClass,
    nativeSystem: 'locker',
    ventureId: input.ventureId,
    projectId: input.projectId,
    lifecycleStatus: 'current',
    sharingStatus: input.sharingStatus ?? 'private',
    sensitivity: input.sensitivity,
    aliases: input.aliases,
    tags: input.tags,
    contentHash,
    originalFilename: input.filename,
    provenance: { uploadedVia: 'locker-upload', originalFilename: input.filename },
    newVersionOf: input.newVersionOf,
  });
  if (!registered.ok) return registered;

  const rendition = await addRendition({
    assetId: registered.value.id,
    callerPersonaId: input.ownerPersonaId,
    renditionKind: 'source',
    storageProvider: 'supabase',
    storageUri: uploadResult.uri,
    publicUrl: uploadResult.publicUrl,
    mimeType: input.mimeType,
    sizeBytes: uploadResult.sizeBytes,
    contentHash,
    isPrimary: true,
  });
  if (!rendition.ok) return rendition;

  return {
    ok: true,
    value: { asset: registered.value, rendition: rendition.value, exactDuplicateOfAssetId },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Read.
// ─────────────────────────────────────────────────────────────────────────

async function assertOwnsAsset(
  db: ReturnType<typeof getSupabaseServer>,
  assetId: string,
  callerPersonaId: string,
): Promise<PeerResult<AssetRow>> {
  if (!db) return { ok: false, error: 'Supabase unavailable' };
  const { data, error } = await db.from('asset_records').select('*').eq('id', assetId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'asset not found', code: 'not_found' };
  const row = data as AssetRow;
  if (row.owner_persona_id !== callerPersonaId) {
    return { ok: false, error: 'caller does not own this asset', code: 'forbidden' };
  }
  return { ok: true, value: row };
}

export async function getAsset(assetId: string, callerPersonaId: string): Promise<PeerResult<AssetRecord>> {
  const db = admin();
  const owned = await assertOwnsAsset(db, assetId, callerPersonaId);
  if (!owned.ok) return owned;
  return { ok: true, value: rowToAsset(owned.value) };
}

export async function listRenditions(assetId: string, callerPersonaId: string): Promise<PeerResult<AssetRendition[]>> {
  const db = admin();
  const owned = await assertOwnsAsset(db, assetId, callerPersonaId);
  if (!owned.ok) return owned;
  const { data, error } = await db.from('asset_renditions').select('*').eq('asset_id', assetId).order('created_at', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: ((data as RenditionRow[] | null) ?? []).map(rowToRendition) };
}

export interface ListLockerAssetsFilter {
  ownerPersonaId: string;
  assetClass?: AssetClass;
  lifecycleStatus?: LifecycleStatus;
  sharingStatus?: SharingStatus;
  ventureId?: string;
  limit?: number;
}

export async function listLockerAssets(filter: ListLockerAssetsFilter): Promise<PeerResult<AssetRecord[]>> {
  if (!filter.ownerPersonaId) return { ok: false, error: 'ownerPersonaId required' };
  const db = admin();
  let query = db.from('asset_records').select('*').eq('owner_persona_id', filter.ownerPersonaId);
  if (filter.assetClass) query = query.eq('asset_class', filter.assetClass);
  if (filter.lifecycleStatus) query = query.eq('lifecycle_status', filter.lifecycleStatus);
  if (filter.sharingStatus) query = query.eq('sharing_status', filter.sharingStatus);
  if (filter.ventureId) query = query.eq('venture_id', filter.ventureId);
  const { data, error } = await query.order('updated_at', { ascending: false }).limit(filter.limit ?? 100);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: ((data as AssetRow[] | null) ?? []).map(rowToAsset) };
}

// ─────────────────────────────────────────────────────────────────────────
// Resolve — alias/title lookup with confidence (spec §13). Never silently
// guesses when more than one plausible CURRENT asset exists in scope; the
// caller must present the ambiguity to the principal (spec: "aigentMe must
// ask the principal to choose rather than silently guessing").
// ─────────────────────────────────────────────────────────────────────────

export interface AssetResolution {
  asset: AssetRecord;
  confidence: 'exact_alias' | 'exact_title' | 'fuzzy_title';
  reasoning: string;
}

export async function resolveAsset(
  query: string,
  ownerPersonaId: string,
  scope?: { ventureId?: string },
): Promise<PeerResult<AssetResolution[]>> {
  if (!query.trim()) return { ok: false, error: 'query required' };
  const db = admin();
  let q = db
    .from('asset_records')
    .select('*')
    .eq('owner_persona_id', ownerPersonaId)
    .in('lifecycle_status', ['current', 'approved']);
  if (scope?.ventureId) q = q.eq('venture_id', scope.ventureId);
  const { data, error } = await q.limit(200);
  if (error) return { ok: false, error: error.message };
  const rows = ((data as AssetRow[] | null) ?? []).map(rowToAsset);
  const needle = query.trim().toLowerCase();

  const results: AssetResolution[] = [];
  for (const asset of rows) {
    if (asset.aliases.some((a) => a.toLowerCase() === needle)) {
      results.push({ asset, confidence: 'exact_alias', reasoning: `Matched alias "${needle}"` });
      continue;
    }
    if (asset.title.toLowerCase() === needle) {
      results.push({ asset, confidence: 'exact_title', reasoning: `Matched title exactly` });
      continue;
    }
    if (asset.title.toLowerCase().includes(needle) || needle.includes(asset.title.toLowerCase())) {
      results.push({ asset, confidence: 'fuzzy_title', reasoning: `Title partially matches "${needle}"` });
    }
  }
  // Exact matches first, then fuzzy; within a tier, most-recently-updated first.
  const rank = { exact_alias: 0, exact_title: 1, fuzzy_title: 2 } as const;
  results.sort((a, b) => rank[a.confidence] - rank[b.confidence] || b.asset.updatedAt.localeCompare(a.asset.updatedAt));
  return { ok: true, value: results };
}

export async function updateAssetStatus(
  assetId: string,
  callerPersonaId: string,
  updates: { lifecycleStatus?: LifecycleStatus; sharingStatus?: SharingStatus; sensitivity?: Sensitivity | null },
): Promise<PeerResult<AssetRecord>> {
  const db = admin();
  const owned = await assertOwnsAsset(db, assetId, callerPersonaId);
  if (!owned.ok) return owned;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.lifecycleStatus) patch.lifecycle_status = updates.lifecycleStatus;
  if (updates.sharingStatus) patch.sharing_status = updates.sharingStatus;
  if (updates.sensitivity !== undefined) patch.sensitivity = updates.sensitivity;

  const { data, error } = await db.from('asset_records').update(patch).eq('id', assetId).select('*').single();
  if (error || !data) return { ok: false, error: error?.message ?? 'update failed' };
  return { ok: true, value: rowToAsset(data as AssetRow) };
}
