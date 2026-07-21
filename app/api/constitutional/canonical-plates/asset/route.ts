/**
 * POST /api/constitutional/canonical-plates/asset — upload a plate RENDERING
 * (SVG / PNG / PDF) to storage and return its public URL.
 *
 * The machine representation (structure/plate.json) is the plate; these files
 * are alternative renderings referenced on the plate object (CFS-027 doctrine).
 * This is the file-upload counterpart to the URL-ref fields on the composer —
 * the returned url slots straight into the plate's `assets` map.
 *
 * Admin/steward-gated via the spine (same gate as the plate lifecycle route).
 * Reuses the canonical storage pattern (content-media bucket, service-role
 * client, public URL) from app/api/admin/codex/upload-cover-thumb.
 *
 * multipart/form-data: { file, kind: 'svg'|'png'|'pdf', cpNumber? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { getActivePersona } from '@/services/identity/getActivePersona';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BUCKET = 'content-media';

// kind → (accepted MIME types, file extension). SVG is text/xml-ish; some
// browsers send image/svg+xml, some application/... — accept the known set.
const KIND_SPEC: Record<string, { mimes: string[]; ext: string }> = {
  svg: { mimes: ['image/svg+xml', 'text/xml', 'application/xml'], ext: 'svg' },
  png: { mimes: ['image/png'], ext: 'png' },
  pdf: { mimes: ['application/pdf'], ext: 'pdf' },
};

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB — generous for a diagram/infographic

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    if (!persona.cartridgeFlags?.isAdmin) {
      return NextResponse.json({ ok: false, error: 'Steward access required — plate assets are admin-gated' }, { status: 403 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ ok: false, error: 'Storage not configured' }, { status: 500 });
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const kind = String(form.get('kind') ?? '').toLowerCase();
    const cpNumber = (form.get('cpNumber') as string | null)?.trim() || 'uploads';

    if (!file) return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    const spec = KIND_SPEC[kind];
    if (!spec) return NextResponse.json({ ok: false, error: "kind must be one of: svg, png, pdf" }, { status: 400 });
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: `File exceeds ${MAX_BYTES / (1024 * 1024)}MB` }, { status: 400 });
    }
    // Trust extension for SVG (browsers vary on its MIME), enforce MIME otherwise.
    if (kind !== 'svg' && file.type && !spec.mimes.includes(file.type)) {
      return NextResponse.json({ ok: false, error: `Expected ${kind.toUpperCase()}, got ${file.type}` }, { status: 400 });
    }

    // cpNumber path segment is sanitised; the object name is unguessable so
    // draft renderings don't collide and are not enumerable.
    const safeScope = /^[A-Za-z0-9-]{1,24}$/.test(cpNumber) ? cpNumber : 'uploads';
    const objectPath = `canonical-plates/${safeScope}/${kind}-${randomUUID()}.${spec.ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, buf, {
      contentType: kind === 'svg' ? 'image/svg+xml' : file.type || 'application/octet-stream',
      upsert: true,
      cacheControl: '3600',
    });
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    return NextResponse.json({ ok: true, kind, url: data.publicUrl, objectPath });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Upload failed' }, { status: 500 });
  }
}
