/**
 * services/uploads/uploadAttachmentHelper.ts
 *
 * Resolves persona uploads to the base64 payloads outbound email
 * connectors (Gmail / Mailjet) need to ship as attachments. Persona-
 * scoped — the route layer passes the active persona; this helper
 * never accepts a persona-less call.
 *
 * Shared shape for both connectors so the create-artifact path can
 * forward attachments without per-connector branching:
 *
 *   ResolvedAttachment {
 *     filename, mimeType, base64Content, sizeBytes, uploadId
 *   }
 *
 * Total-size guard caps the combined attachment payload at 24 MB
 * (under Gmail's 25 MB envelope and Mailjet's per-message limit).
 * Operator gets a clear error if they over-attach instead of a
 * silent provider rejection downstream.
 */

import { getPersonaUploadService } from '@/services/uploads/supabaseUploadAdapter';

export interface ResolvedAttachment {
  uploadId: string;
  filename: string;
  mimeType: string;
  base64Content: string;
  sizeBytes: number;
}

export interface ResolveAttachmentsResult {
  ok: true;
  attachments: ResolvedAttachment[];
  totalBytes: number;
}
export type ResolveAttachmentsFailure = { ok: false; reason: string; uploadId?: string };

const TOTAL_ATTACHMENT_CAP_BYTES = 24 * 1024 * 1024;

function toBase64(bytes: Uint8Array): string {
  // Node + browser portable path. Buffer is faster on the server.
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // btoa is available in Edge runtime too.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).btoa(binary);
}

/**
 * Resolve a list of upload ids to attachment payloads ready for the
 * Gmail / Mailjet send pipelines. Skips archived uploads. Enforces the
 * combined-size cap and returns a single failure result on the first
 * blocking issue so the operator sees one clear message.
 */
export async function resolveAttachments(
  personaId: string,
  uploadIds: string[],
): Promise<ResolveAttachmentsResult | ResolveAttachmentsFailure> {
  if (!personaId) return { ok: false, reason: 'persona-required' };
  if (uploadIds.length === 0) return { ok: true, attachments: [], totalBytes: 0 };

  const service = getPersonaUploadService();
  const out: ResolvedAttachment[] = [];
  let totalBytes = 0;

  for (const id of uploadIds) {
    const row = await service.get(id, personaId);
    if (!row) return { ok: false, reason: 'upload-not-found', uploadId: id };
    if (row.status === 'archived') {
      return { ok: false, reason: `upload archived: ${row.filename}`, uploadId: id };
    }
    if (row.status !== 'ready') {
      return { ok: false, reason: `upload not ready (status=${row.status}): ${row.filename}`, uploadId: id };
    }
    const bytes = await service.readBytes(id, personaId);
    if (!bytes) return { ok: false, reason: 'upload-read-failed', uploadId: id };
    totalBytes += bytes.byteLength;
    if (totalBytes > TOTAL_ATTACHMENT_CAP_BYTES) {
      return {
        ok: false,
        reason: `attachments exceed ${TOTAL_ATTACHMENT_CAP_BYTES} byte cap (combined size after ${out.length + 1} files)`,
        uploadId: id,
      };
    }
    out.push({
      uploadId: row.id,
      filename: row.filename,
      mimeType: row.mimeType || 'application/octet-stream',
      base64Content: toBase64(bytes),
      sizeBytes: bytes.byteLength,
    });
  }

  return { ok: true, attachments: out, totalBytes };
}
