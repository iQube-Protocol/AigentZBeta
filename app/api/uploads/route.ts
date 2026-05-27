/**
 * GET  /api/uploads          — list this persona's uploads
 * POST /api/uploads          — multipart/form-data upload
 *
 * Persona resolved through the spine. Persona id never read from the
 * body — server-internal only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import { getPersonaUploadService } from '@/services/uploads/supabaseUploadAdapter';
import {
  UPLOAD_LIMITS,
  type UploadStatus,
  type UploadUseKind,
} from '@/services/uploads/personaUploadService';

export const dynamic = 'force-dynamic';

const VALID_USE_KINDS: UploadUseKind[] = ['context', 'tool', 'workbench', 'general'];
const VALID_STATUSES: UploadStatus[] = ['parsing', 'ready', 'archived', 'failed'];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ error: 'persona-required' }, { status: 401 });
  }
  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  const useKindParam = url.searchParams.get('useKind');
  const limit = Number(url.searchParams.get('limit') ?? '50');

  const service = getPersonaUploadService();
  const rows = await service.list(persona.personaId, {
    status:
      statusParam && VALID_STATUSES.includes(statusParam as UploadStatus)
        ? (statusParam as UploadStatus)
        : undefined,
    useKind:
      useKindParam && VALID_USE_KINDS.includes(useKindParam as UploadUseKind)
        ? (useKindParam as UploadUseKind)
        : undefined,
    limit: Number.isFinite(limit) ? limit : 50,
  });
  return NextResponse.json({ uploads: rows });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ error: 'persona-required' }, { status: 401 });
  }
  const caller = await getCallerIdentityContext(req);

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid-form', detail: err instanceof Error ? err.message : 'form parse failed' },
      { status: 400 },
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file-required' }, { status: 400 });
  }
  if (file.size > UPLOAD_LIMITS.maxBytes) {
    return NextResponse.json(
      { error: 'file-too-large', detail: `Max ${UPLOAD_LIMITS.maxBytes} bytes; got ${file.size}` },
      { status: 413 },
    );
  }

  const rawUseKind = form.get('useKind');
  const useKind: UploadUseKind = typeof rawUseKind === 'string' && VALID_USE_KINDS.includes(rawUseKind as UploadUseKind)
    ? (rawUseKind as UploadUseKind)
    : 'general';
  const labelRaw = form.get('label');
  const label = typeof labelRaw === 'string' ? labelRaw.trim().slice(0, 200) || undefined : undefined;
  const tagsRaw = form.get('tags');
  const tags = typeof tagsRaw === 'string'
    ? tagsRaw.split(',').map((t) => t.trim()).filter((t) => t.length > 0).slice(0, 16)
    : undefined;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const service = getPersonaUploadService();
    const result = await service.upload({
      personaId: persona.personaId,
      authProfileId: caller?.email ?? null,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      data: bytes,
      useKind,
      label,
      tags,
    });
    return NextResponse.json({ ok: true, upload: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[uploads] POST failed:', msg);
    return NextResponse.json({ error: 'upload-failed', detail: msg }, { status: 500 });
  }
}
