/**
 * Gated PDF Page Rendering — Master ID proxy
 *
 * GET /api/content/pdf-page-by-master/[masterId]?personaId=...&page=1&width=1200
 *
 * Custody-safe renderer for Supabase-hosted print PDFs.
 * The raw PDF URL NEVER reaches the client — the server fetches it, renders
 * one page to a WebP image, and returns the image.
 *
 * Security model:
 *   - masterId is the TEXT pk from master_content_qubes (e.g. mk_ep01_print_common)
 *   - personaId identifies the requesting persona
 *   - userOwnsAsset() validates entitlement before any PDF data is read
 *   - If the persona is not entitled → 403 (PDF never fetched)
 *
 * Phase 2 will replace Supabase Storage with Autonomys + iQube encryption.
 * Until then this route is the security boundary: entitlement gate + URL opacity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

import { userOwnsAsset } from '@/services/rewards/assetOwnership';
import { getCachedImage, setCachedImage } from '../../pdf-page/[cid]/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CORS headers for cross-origin requests from thin client
export async function OPTIONS() {
  return new NextResponse(null);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_EDGE_BODY_BYTES = 950_000;
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/P5mU7QAAAABJRU5ErkJggg==',
  'base64'
);

let activeRenders = 0;
const MAX_CONCURRENT_RENDERS = 2;

async function acquireRenderSlot() {
  while (activeRenders >= MAX_CONCURRENT_RENDERS) {
    await new Promise((r) => setTimeout(r, 50));
  }
  activeRenders++;
}

function releaseRenderSlot() {
  activeRenders = Math.max(0, activeRenders - 1);
}

class NodeCanvasFactory {
  async create(width: number, height: number) {
    const { createCanvas } = await import('@napi-rs/canvas');
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }
  reset(canvasAndContext: { canvas: any; context: any }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext: { canvas: any; context: any }) {
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

function clampInt(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(val)));
}

async function encodeWebPUnderLimit(inputPng: Buffer, targetWidth: number) {
  const widthAttempts = [targetWidth, Math.floor(targetWidth * 0.85), Math.floor(targetWidth * 0.72), 600];
  const qualityAttempts = [70, 65, 60, 55];

  for (const w of widthAttempts) {
    const resizedPng =
      w === targetWidth
        ? inputPng
        : await sharp(inputPng).resize({ width: w, withoutEnlargement: true }).png().toBuffer();
    for (const q of qualityAttempts) {
      const out = await sharp(resizedPng).webp({ quality: q, effort: 4 }).toBuffer();
      if (out.length <= MAX_EDGE_BODY_BYTES) return { data: out, mime: 'image/webp', ok: true as const };
    }
  }
  return { data: PLACEHOLDER_PNG, mime: 'image/png', ok: false as const };
}

async function renderPdfPageToPng(pdfBytes: Buffer, pageNumber: number, targetWidth: number) {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const { getDocument } = pdfjs as any;
  const loadingTask = getDocument({ data: new Uint8Array(pdfBytes), isEvalSupported: false });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const safePage = Math.min(Math.max(pageNumber, 1), numPages);
  const page = await pdf.getPage(safePage);
  const viewport1 = page.getViewport({ scale: 1 });
  const scale = targetWidth / viewport1.width;
  const viewport = page.getViewport({ scale });
  const canvasFactory = new NodeCanvasFactory();
  const { canvas, context } = await canvasFactory.create(
    Math.floor(viewport.width),
    Math.floor(viewport.height)
  );
  const renderTask = page.render({ canvasContext: context as any, viewport, canvasFactory: canvasFactory as any });
  await renderTask.promise;
  const pngBuffer = canvas.toBuffer('image/png');
  canvasFactory.destroy({ canvas, context });
  return { pngBuffer, numPages };
}

interface RouteParams {
  params: { masterId: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { masterId } = params;

  if (!masterId) {
    return NextResponse.json({ error: 'masterId required' }, { status: 400 });
  }

  const personaId = req.nextUrl.searchParams.get('personaId') || '';
  const pageParam = req.nextUrl.searchParams.get('page') ?? '1';
  const widthParam = req.nextUrl.searchParams.get('width') ?? '1200';
  const page = clampInt(Number(pageParam), 1, 10_000);
  const width = clampInt(Number(widthParam), 600, 1800);

  if (!personaId) {
    return NextResponse.json({ error: 'personaId required' }, { status: 401 });
  }

  // Entitlement gate — PDF never fetched if persona is not entitled
  let entitled = false;
  try {
    const { owned } = await userOwnsAsset(personaId, masterId);
    entitled = owned;
  } catch (e) {
    console.error('[PdfPageByMaster] Entitlement check error:', e);
  }

  if (!entitled) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const cacheKey = `master:${masterId}:page:${page}:w:${width}`;
  const cached = getCachedImage(cacheKey);
  if (cached) {
    return new NextResponse(new Uint8Array(cached.data), {
      headers: {
        'Content-Type': cached.mimeType,
        'Content-Length': cached.data.length.toString(),
        'Cache-Control': 'private, max-age=3600',
        'X-Cache': 'HIT',
      },
    });
  }

  // ?meta=1 → return page count without rendering (lightweight)
  if (req.nextUrl.searchParams.get('meta') === '1') {
    try {
      const { data: master, error: masterErr } = await supabase
        .from('master_content_qubes')
        .select('auto_drive_cid, pdf_lite_url, page_count')
        .eq('id', masterId)
        .maybeSingle();

      if (masterErr) {
        console.error('[PdfPageByMaster:meta] master lookup error', { masterId, masterErr });
        return NextResponse.json({ error: 'Master lookup failed' }, { status: 502 });
      }
      if (!master) return NextResponse.json({ error: 'Master not found' }, { status: 404 });

      // Return cached page count if available
      if (typeof (master as any).page_count === 'number' && (master as any).page_count > 0) {
        return NextResponse.json({ pages: (master as any).page_count, suggestedWidth: 1200 });
      }

      // Count pages by fetching the PDF (slow path, only needed once per master)
      const rawCid = master.auto_drive_cid as string | null;
      const isUrl = typeof rawCid === 'string' && (rawCid.startsWith('http://') || rawCid.startsWith('https://'));
      const pdfUrl: string | null = (master as any).pdf_lite_url || (isUrl ? rawCid : null);

      if (!pdfUrl) {
        // No URL available — return a sane default rather than crashing the viewer.
        return NextResponse.json({ pages: 1, suggestedWidth: 1200 });
      }

      let fetchRes: Response;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        fetchRes = await fetch(pdfUrl, { signal: ctrl.signal });
        clearTimeout(timer);
      } catch (fetchErr) {
        console.error('[PdfPageByMaster:meta] fetch threw', { masterId, pdfUrl, fetchErr });
        return NextResponse.json({ pages: 1, suggestedWidth: 1200 });
      }
      if (!fetchRes.ok) {
        console.warn('[PdfPageByMaster:meta] fetch !ok', { masterId, pdfUrl, status: fetchRes.status });
        return NextResponse.json({ pages: 1, suggestedWidth: 1200 });
      }

      const pdfBytes = Buffer.from(await fetchRes.arrayBuffer());
      const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
      const { getDocument } = pdfjs as any;
      const pdf = await getDocument({ data: new Uint8Array(pdfBytes), isEvalSupported: false }).promise;
      const pages = pdf.numPages as number;

      // Best-effort write-back; don't fail the request if the column is missing
      // or RLS blocks the update.
      try {
        await supabase.from('master_content_qubes').update({ page_count: pages } as any).eq('id', masterId);
      } catch (updateErr) {
        console.warn('[PdfPageByMaster:meta] page_count update failed (non-fatal)', { masterId, updateErr });
      }

      return NextResponse.json({ pages, suggestedWidth: 1200 });
    } catch (e: any) {
      console.error('[PdfPageByMaster:meta] unhandled error', { masterId, error: e?.message, stack: e?.stack });
      // Return a soft default so the viewer still loads page 1 rather than
      // showing a blocking error.
      return NextResponse.json({ pages: 1, suggestedWidth: 1200 });
    }
  }

  await acquireRenderSlot();
  try {
    // Look up master — URL is resolved entirely server-side
    const { data: master, error: masterError } = await supabase
      .from('master_content_qubes')
      .select('auto_drive_cid, pdf_lite_url')
      .eq('id', masterId)
      .single();

    if (masterError || !master) {
      return NextResponse.json({ error: 'Master not found' }, { status: 404 });
    }

    const rawCid = master.auto_drive_cid as string | null;
    const isUrl =
      typeof rawCid === 'string' &&
      (rawCid.startsWith('http://') || rawCid.startsWith('https://'));
    const pdfUrl: string | null = master.pdf_lite_url || (isUrl ? rawCid : null);

    if (!pdfUrl) {
      // Autonomys-hosted CID path — not yet handled here; return 404 with hint
      return NextResponse.json(
        { error: 'CID-hosted masters not yet supported by this route; use /api/content/pdf-page/[cid]' },
        { status: 422 }
      );
    }

    // Fetch PDF bytes from Supabase Storage — URL stays on the server
    const fetchCtrl = new AbortController();
    const fetchTimer = setTimeout(() => fetchCtrl.abort(), 15000);
    let fetchRes: Response;
    try {
      fetchRes = await fetch(pdfUrl, { signal: fetchCtrl.signal });
    } finally {
      clearTimeout(fetchTimer);
    }
    if (!fetchRes.ok) {
      return NextResponse.json({ error: `PDF fetch failed: ${fetchRes.status}` }, { status: 502 });
    }
    const pdfBytes = Buffer.from(await fetchRes.arrayBuffer());

    const { pngBuffer, numPages } = await renderPdfPageToPng(pdfBytes, page, width);
    if (page > numPages) {
      return NextResponse.json({ error: `Invalid page. PDF has ${numPages} pages.` }, { status: 400 });
    }

    const encoded = await encodeWebPUnderLimit(pngBuffer, width);
    setCachedImage(cacheKey, encoded.data, encoded.mime);

    return new NextResponse(new Uint8Array(encoded.data), {
      headers: {
        'Content-Type': encoded.mime,
        'Content-Length': encoded.data.length.toString(),
        'Cache-Control': 'private, max-age=3600',
        'X-Cache': 'MISS',
        'X-Page': String(page),
        'X-Width': String(width),
        'X-Render-OK': encoded.ok ? '1' : '0',
      },
    });
  } catch (e: any) {
    console.error('[PdfPageByMaster] Error:', e);
    setCachedImage(cacheKey, PLACEHOLDER_PNG, 'image/png');
    return new NextResponse(new Uint8Array(PLACEHOLDER_PNG), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=300',
        'X-Render-OK': '0',
      },
    });
  } finally {
    releaseRenderSlot();
  }
}
