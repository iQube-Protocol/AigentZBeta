/**
 * services/uploads/iqubeUploadEmbed.ts
 *
 * STUB — embed a persona upload into an iQube as a payload reference.
 *
 * Phase 1 (this file): resolve the upload, surface a payload descriptor
 * that the iQube assembly path can consume later. No actual iQube
 * write — operator can see that the file is "staged for iQube" and
 * the full materialisation lands when the iQube mint flow takes a
 * `uploadReferences` array.
 *
 * Phase 2 (deferred):
 *   - Wire into ContentQube minting (iqube_payload → encrypted blob in
 *     iqube_payload_refs table; mint receipt anchors the file hash on
 *     DVN per the iQube encryption spec).
 *   - Add /api/iqubes/[id]/embed-upload route that takes a uploadId,
 *     enforces persona access to the target iQube, and writes the
 *     payload ref.
 *
 * The shape returned here is the contract iQube assembly will read.
 * Lifecycle:
 *   staged   — operator selected the upload for embed; not minted
 *   minted   — payload sealed into the iQube edition (Phase 2)
 *   failed   — embed path threw (Phase 2)
 */

import { getPersonaUploadService } from '@/services/uploads/supabaseUploadAdapter';

export interface IqubeUploadEmbed {
  /** The persona upload row id. */
  uploadId: string;
  /** Target iQube id (validated by Phase-2 access check). */
  iqubeId: string | null;
  /** Stable storage path the iQube minter reads. */
  storagePath: string;
  /** Filename + mime for the iQube payload header. */
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Operator-supplied label (overrides upload.label when set). */
  label: string | null;
  /** Operator-supplied tags (merge with iQube tags at mint time). */
  tags: string[];
  /** Lifecycle. */
  status: 'staged' | 'minted' | 'failed';
  /** Optional error trace if status='failed'. */
  error: string | null;
}

export interface StageEmbedInput {
  personaId: string;
  uploadId: string;
  /** When known — Phase 2 access check binds the embed to a specific
   *  iQube. When null, the embed is staged free-floating and the
   *  operator can attach it to an iQube later. */
  iqubeId?: string | null;
  label?: string;
  tags?: string[];
}

/**
 * Stage an upload for embed into an iQube. Resolves the upload via the
 * persona service, validates lifecycle (must be `ready`), and returns
 * the embed descriptor for the iQube minter to consume.
 *
 * NB: no DB write yet. Phase 2 persists this into `iqube_payload_refs`.
 * Until then the helper is a pure resolver — the operator-facing
 * UploadDrawer / iQube minter can call it to confirm the upload is
 * ready and surface a "Staged for iQube" badge.
 */
export async function stageUploadForIqube(
  input: StageEmbedInput,
): Promise<{ ok: true; embed: IqubeUploadEmbed } | { ok: false; reason: string }> {
  if (!input.personaId) return { ok: false, reason: 'persona-required' };
  if (!input.uploadId) return { ok: false, reason: 'uploadId required' };

  const service = getPersonaUploadService();
  const upload = await service.get(input.uploadId, input.personaId);
  if (!upload) return { ok: false, reason: 'upload-not-found' };
  if (upload.status === 'archived') return { ok: false, reason: 'upload archived' };
  if (upload.status !== 'ready') return { ok: false, reason: `upload not ready (status=${upload.status})` };

  const embed: IqubeUploadEmbed = {
    uploadId: upload.id,
    iqubeId: input.iqubeId ?? null,
    storagePath: upload.storagePath,
    filename: upload.filename,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
    label: input.label?.trim() ?? upload.label ?? null,
    tags: input.tags && input.tags.length > 0 ? input.tags : upload.tags,
    status: 'staged',
    error: null,
  };

  // TODO Phase 2 — persist to iqube_payload_refs + emit a DVN receipt
  // when iqubeId is provided AND the persona owns / can-mint that
  // iQube. Until then the operator surface treats every staged embed
  // as ephemeral session state.
  return { ok: true, embed };
}
