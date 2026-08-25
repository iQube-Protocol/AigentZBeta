/**
 * POST /api/locker/assets/[id]/versions — register a new version of an
 * existing asset (spec §9.5, §16.1 createAssetVersion). The caller need
 * only know the EXISTING asset id being superseded; this route resolves
 * its version_family_id server-side rather than requiring the client to
 * track it.
 *
 * multipart/form-data with a `file` field (same fields as
 * POST /api/locker/assets, minus newVersionOf* — this route derives that).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getAsset, uploadLockerFile } from '@/services/locker/assetRegistry';
import type { AssetClass, SharingStatus, Sensitivity } from '@/types/locker';

export const dynamic = 'force-dynamic';

const ASSET_CLASSES = new Set<AssetClass>([
  'deck', 'agreement', 'report', 'paper', 'essay', 'experiment', 'dataset',
  'image', 'audio', 'video', 'bridge', 'dynamic-report', 'other',
]);

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await ctx.params;

  const priorVersion = await getAsset(id, context.personaId);
  if (!priorVersion.ok) return NextResponse.json({ error: priorVersion.error }, { status: priorVersion.code === 'not_found' ? 404 : 403 });

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'multipart/form-data with a file field is required' }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file field required' }, { status: 400 });
  const assetClassRaw = String(form.get('assetClass') ?? priorVersion.value.assetClass);
  const assetClass = ASSET_CLASSES.has(assetClassRaw as AssetClass) ? (assetClassRaw as AssetClass) : priorVersion.value.assetClass;

  const result = await uploadLockerFile({
    ownerPersonaId: context.personaId,
    file,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    title: (form.get('title') as string | null) ?? priorVersion.value.title,
    assetClass,
    ventureId: (form.get('ventureId') as string | null) ?? priorVersion.value.ventureId ?? undefined,
    projectId: (form.get('projectId') as string | null) ?? priorVersion.value.projectId ?? undefined,
    sharingStatus: (form.get('sharingStatus') as SharingStatus | null) ?? priorVersion.value.sharingStatus,
    sensitivity: (form.get('sensitivity') as Sensitivity | null) ?? priorVersion.value.sensitivity ?? undefined,
    aliases: priorVersion.value.aliases,
    tags: priorVersion.value.tags,
    newVersionOf: { versionFamilyId: priorVersion.value.versionFamilyId, supersedesAssetId: id },
  });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.code === 'forbidden' ? 403 : 400 });
  return NextResponse.json({ asset: result.value.asset, rendition: result.value.rendition });
}
