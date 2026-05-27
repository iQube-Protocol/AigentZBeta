/**
 * PDF Thumbnail API — Qriptopian WIP papers
 *
 * GET /api/codex/qripto/pdf-thumb?url=<supabase-pdf-url>&page=1&width=600
 *
 * Server-side renders a single page of a Supabase-hosted PDF to a WebP
 * thumbnail and caches it in-memory. The cover-as-PDF case (Qripto
 * papers were uploaded with cover_pdf assets) cannot render reliably in
 * a cross-origin <iframe> — browsers either show blank or trigger a
 * download. Rasterising server-side and serving as <img src> sidesteps
 * both failure modes and matches how KNYT episode covers paint.
 *
 * Security:
 * - URL must be from our Supabase project; arbitrary external URLs are
 *   rejected so the route can't be used as a generic PDF rasteriser.
 * - Page + width are clamped.
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// pdfjs-dist 4.x calls Promise.withResolvers (Node 22+). Amplify runs
// Node 20, so without this polyfill the rasteriser throws
// "Promise.withResolvers is not a function" the moment it loads a PDF.
// Idempotent: only assigns when the method is missing.
if (typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers !== 'function') {
  (Promise as unknown as {
    withResolvers: <T>() => { promise: Promise<T>; resolve: (v: T | PromiseLike<T>) => void; reject: (r?: unknown) => void };
  }).withResolvers = function <T>() {
    let resolve!: (v: T | PromiseLike<T>) => void;
    let reject!: (r?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// ─── In-memory cache ──────────────────────────────────────────────────
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
type CacheEntry = { buf: Buffer; mime: string; ts: number };
const cache = new Map<string, CacheEntry>();

function cacheKey(url: string, page: number, width: number) {
  return `${url}::${page}::${width}`;
}

function getFromCache(key: string): CacheEntry | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit;
}

function putInCache(key: string, buf: Buffer, mime: string) {
  cache.set(key, { buf, mime, ts: Date.now() });
}

// ─── pdfjs canvas factory ────────────────────────────────────────────
class NodeCanvasFactory {
  async create(width: number, height: number) {
    const { createCanvas } = await import('@napi-rs/canvas');
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }
  reset(cc: { canvas: { width: number; height: number } }, w: number, h: number) {
    cc.canvas.width = w;
    cc.canvas.height = h;
  }
  destroy(_cc: unknown) { /* no-op in Node */ }
}

async function renderPdfPageToPng(buf: Buffer, page: number, targetWidth: number) {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const { getDocument } = pdfjs as unknown as { getDocument: (args: unknown) => { promise: Promise<unknown> } };
  const loadingTask = getDocument({ data: new Uint8Array(buf), isEvalSupported: false });
  const pdf = (await loadingTask.promise) as {
    numPages: number;
    getPage: (n: number) => Promise<{
      getViewport: (args: { scale: number }) => { width: number; height: number };
      render: (args: { canvasContext: unknown; viewport: unknown; canvasFactory: unknown }) => { promise: Promise<void> };
    }>;
  };
  const safePage = Math.min(Math.max(page, 1), pdf.numPages);
  const pageObj = await pdf.getPage(safePage);
  const v1 = pageObj.getViewport({ scale: 1 });
  const scale = targetWidth / v1.width;
  const viewport = pageObj.getViewport({ scale });
  const factory = new NodeCanvasFactory();
  const { canvas, context } = await factory.create(Math.floor(viewport.width), Math.floor(viewport.height));
  await pageObj.render({ canvasContext: context, viewport, canvasFactory: factory }).promise;
  const png = (canvas as { toBuffer: (m: string) => Buffer }).toBuffer('image/png');
  factory.destroy({ canvas, context });
  return png;
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const rawUrl = params.get('url');
    const page = Math.min(Math.max(Number(params.get('page') || '1') || 1, 1), 50);
    const width = Math.min(Math.max(Number(params.get('width') || '600') || 600, 200), 1200);

    if (!rawUrl) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    // Only allow URLs from our Supabase project.
    const supabaseHost = (() => {
      try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host; } catch { return null; }
    })();
    let parsed: URL;
    try { parsed = new URL(rawUrl); } catch {
      return NextResponse.json({ error: 'Bad url' }, { status: 400 });
    }
    if (!supabaseHost || parsed.host !== supabaseHost) {
      return NextResponse.json({ error: 'Disallowed host' }, { status: 403 });
    }

    const key = cacheKey(rawUrl, page, width);
    const cached = getFromCache(key);
    if (cached) {
      return new NextResponse(new Uint8Array(cached.buf), {
        headers: {
          'Content-Type': cached.mime,
          'Cache-Control': 'public, max-age=3600',
          'X-Cache': 'HIT',
        },
      });
    }

    const fetched = await fetch(rawUrl);
    if (!fetched.ok) {
      return NextResponse.json({ error: `Upstream ${fetched.status}` }, { status: 502 });
    }
    const pdfBuf = Buffer.from(await fetched.arrayBuffer());
    const png = await renderPdfPageToPng(pdfBuf, page, width);
    const webp = await sharp(png).webp({ quality: 78 }).toBuffer();

    putInCache(key, webp, 'image/webp');

    return new NextResponse(new Uint8Array(webp), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': 'MISS',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: (e as Error)?.message || 'Render failed' },
      { status: 500 },
    );
  }
}
