/**
 * Connector action endpoint for native binary file uploads.
 *
 * Threshold bearer authorization is resolved exactly once here. After that,
 * execution is delegated to the shared Threshold upload executor used by the
 * MCP JSON-RPC path as well.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireThresholdSession } from '@/services/threshold/requireThresholdSession';
import {
  executeThresholdContentUpload,
  THRESHOLD_UPLOAD_ROLES,
} from '@/services/threshold/uploadContentAsset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await requireThresholdSession(req, 'content.asset.upload');
  if (!auth.ok) return auth.response;

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const fileName = typeof form.get('fileName') === 'string' ? String(form.get('fileName')) : null;
    const domain = typeof form.get('domain') === 'string' ? String(form.get('domain')) : null;
    const role = typeof form.get('role') === 'string' ? String(form.get('role')) : null;
    const contentId = typeof form.get('contentId') === 'string' ? String(form.get('contentId')) : null;
    const bind = form.get('bind') !== 'false';
    const setPrimary = form.get('setPrimary') === 'true';
    const bundleId = typeof form.get('bundleId') === 'string' ? String(form.get('bundleId')) : null;
    const bundleLabel = typeof form.get('bundleLabel') === 'string' ? String(form.get('bundleLabel')) : null;
    const bundleType = typeof form.get('bundleType') === 'string' ? String(form.get('bundleType')) : null;
    const bundleOrder = typeof form.get('bundleOrder') === 'string' ? Number(form.get('bundleOrder')) : null;
    const assetUse = typeof form.get('assetUse') === 'string' ? String(form.get('assetUse')) : null;

    if (!file || !fileName || !domain || !role) {
      return NextResponse.json({ error: 'missing-required-params' }, { status: 400 });
    }
    if (!THRESHOLD_UPLOAD_ROLES.has(role)) {
      return NextResponse.json({ error: 'invalid-role', allowed: [...THRESHOLD_UPLOAD_ROLES] }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const receipt = await executeThresholdContentUpload({
      bytes,
      mimeType: file.type || 'application/octet-stream',
      fileName,
      domain,
      role,
      origin: req.nextUrl.origin,
      contentId,
      bind,
      setPrimary,
      bundleId,
      bundleLabel,
      bundleType,
      bundleOrder,
      assetUse,
    });

    return NextResponse.json(receipt);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'upload-failed';
    console.error('[threshold/upload-action] upload failed:', message);
    return NextResponse.json({ error: 'upload-failed', reason: message }, { status: 500 });
  }
}
