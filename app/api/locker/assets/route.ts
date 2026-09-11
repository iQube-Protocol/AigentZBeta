/**
 * GET  /api/locker/assets — list the caller's Locker assets.
 * POST /api/locker/assets — register an asset.
 *
 * Two request shapes:
 *   multipart/form-data with a `file` field — Locker-native upload (spec
 *     §8.5). Optional fields: title, assetClass, ventureId, projectId,
 *     sharingStatus, sensitivity, aliases (comma-separated), tags
 *     (comma-separated), newVersionOfFamilyId, newVersionOfAssetId.
 *   application/json — register WITHOUT bytes: either a "generate and
 *     save" artifact whose bytes are already stored elsewhere (spec §9 —
 *     caller supplies renditions separately via addRendition) or a
 *     metadata-only registration. Body: { title, assetClass, ... } (same
 *     RegisterAssetInput shape, minus ownerPersonaId).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { registerAsset, uploadLockerFile, detectVersionCandidates, listLockerAssets } from '@/services/locker/assetRegistry';
import type { AssetClass, SharingStatus, Sensitivity } from '@/types/locker';

export const dynamic = 'force-dynamic';

const ASSET_CLASSES = new Set<AssetClass>([
  'deck', 'agreement', 'report', 'paper', 'essay', 'experiment', 'dataset',
  'image', 'audio', 'video', 'bridge', 'dynamic-report', 'other',
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(request.url);
  const assetClass = url.searchParams.get('assetClass');
  const result = await listLockerAssets({
    ownerPersonaId: context.personaId,
    assetClass: assetClass && ASSET_CLASSES.has(assetClass as AssetClass) ? (assetClass as AssetClass) : undefined,
    ventureId: url.searchParams.get('ventureId') ?? undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ assets: result.value }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = await getActivePersona(request);
  if (!context) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file field required' }, { status: 400 });
    const assetClassRaw = String(form.get('assetClass') ?? 'other');
    const assetClass = ASSET_CLASSES.has(assetClassRaw as AssetClass) ? (assetClassRaw as AssetClass) : 'other';

    const familyId = form.get('newVersionOfFamilyId');
    const supersedesId = form.get('newVersionOfAssetId');
    const newVersionOf = typeof familyId === 'string' && typeof supersedesId === 'string' && familyId && supersedesId
      ? { versionFamilyId: familyId, supersedesAssetId: supersedesId }
      : undefined;

    const result = await uploadLockerFile({
      ownerPersonaId: context.personaId,
      file,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      title: (form.get('title') as string | null) ?? undefined,
      assetClass,
      ventureId: (form.get('ventureId') as string | null) ?? undefined,
      projectId: (form.get('projectId') as string | null) ?? undefined,
      sharingStatus: (form.get('sharingStatus') as SharingStatus | null) ?? undefined,
      sensitivity: (form.get('sensitivity') as Sensitivity | null) ?? undefined,
      aliases: (form.get('aliases') as string | null)?.split(',').map((s) => s.trim()).filter(Boolean),
      tags: (form.get('tags') as string | null)?.split(',').map((s) => s.trim()).filter(Boolean),
      newVersionOf,
    });
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.code === 'forbidden' ? 403 : 400 });
    return NextResponse.json({ asset: result.value.asset, rendition: result.value.rendition, exactDuplicateOfAssetId: result.value.exactDuplicateOfAssetId });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const assetClassRaw = typeof body.assetClass === 'string' ? body.assetClass : 'other';
  const assetClass = ASSET_CLASSES.has(assetClassRaw as AssetClass) ? (assetClassRaw as AssetClass) : 'other';
  const title = typeof body.title === 'string' ? body.title : '';
  if (!title.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });

  // "Suggest existing version candidates" query mode (spec §8.4/§9.5) —
  // pass ?mode=candidates to check before registering.
  if (body.mode === 'candidates') {
    const filename = typeof body.originalFilename === 'string' ? body.originalFilename : title;
    const candidates = await detectVersionCandidates(context.personaId, assetClass, title, filename);
    if (!candidates.ok) return NextResponse.json({ error: candidates.error }, { status: 400 });
    return NextResponse.json({ candidates: candidates.value });
  }

  const newVersionOf = body.newVersionOfFamilyId && body.newVersionOfAssetId
    ? { versionFamilyId: String(body.newVersionOfFamilyId), supersedesAssetId: String(body.newVersionOfAssetId) }
    : undefined;

  const result = await registerAsset({
    ownerPersonaId: context.personaId,
    title,
    description: typeof body.description === 'string' ? body.description : undefined,
    assetClass,
    nativeSystem: body.nativeSystem === 'locker' ? 'locker' : 'locker',
    ventureId: typeof body.ventureId === 'string' ? body.ventureId : undefined,
    projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
    lifecycleStatus: typeof body.lifecycleStatus === 'string' ? (body.lifecycleStatus as never) : undefined,
    sharingStatus: typeof body.sharingStatus === 'string' ? (body.sharingStatus as SharingStatus) : undefined,
    sensitivity: typeof body.sensitivity === 'string' ? (body.sensitivity as Sensitivity) : undefined,
    aliases: Array.isArray(body.aliases) ? (body.aliases as string[]) : undefined,
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
    provenance: typeof body.provenance === 'object' && body.provenance ? (body.provenance as Record<string, unknown>) : { source: 'generated-and-saved' },
    newVersionOf,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ asset: result.value });
}
