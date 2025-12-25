/**
 * PDF Page Rendering API
 *
 * GET /api/content/pdf-page/[cid]?page=1&width=1200
 *
 * - Downloads encrypted PDF from Autonomys
 * - Decrypts server-side
 * - Renders ONE page to an image
 * - Encodes WebP under ~950KB to avoid edge body limit (413)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAutoDriveApi } from '@autonomys/auto-drive';
import { NetworkId } from '@autonomys/auto-utils';
import sharp from 'sharp';

import {
  unwrapKeyWithMasterKey,
  decryptContent,
} from '@/server/services/encryptionService';

import { getCachedImage, setCachedImage } from './cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CORS headers for cross-origin requests from thin client
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_EDGE_BODY_BYTES = 950_000; // stay safely under 1MB
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/P5mU7QAAAABJRU5ErkJggg==',
  'base64'
);

// Simple concurrency guard (avoid rendering storms)
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

// ---- pdfjs canvas factory (Node) ----
class NodeCanvasFactory {
  async create(width: number, height: number) {
    // Dynamic import to avoid webpack bundling native binary
    const { createCanvas } = await import('@napi-rs/canvas');
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }
  reset(canvasAndContext: any, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext: any) {
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

function clampInt(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(val)));
}

async function encodeWebPUnderLimit(inputPng: Buffer, targetWidth: number) {
  // width ladder + quality ladder until under MAX_EDGE_BODY_BYTES
  const widthAttempts = [targetWidth, Math.floor(targetWidth * 0.85), Math.floor(targetWidth * 0.72), 600];
  const qualityAttempts = [70, 65, 60, 55];

  for (const w of widthAttempts) {
    const resizedPng =
      w === targetWidth
        ? inputPng
        : await sharp(inputPng).resize({ width: w, withoutEnlargement: true }).png().toBuffer();

    for (const q of qualityAttempts) {
      const out = await sharp(resizedPng).webp({ quality: q, effort: 4 }).toBuffer();
      if (out.length <= MAX_EDGE_BODY_BYTES) {
        return { data: out, mime: 'image/webp', ok: true as const };
      }
    }
  }

  // Fallback placeholder if we can't get under limit (rare, but safe)
  return { data: PLACEHOLDER_PNG, mime: 'image/png', ok: false as const };
}

interface RouteParams {
  params: { cid: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { cid } = params;

  if (!cid) {
    return NextResponse.json({ error: 'CID required' }, { status: 400, headers: corsHeaders });
  }

  const pageParam = req.nextUrl.searchParams.get('page') ?? '1';
  const widthParam = req.nextUrl.searchParams.get('width') ?? '1200';

  const page = clampInt(Number(pageParam), 1, 10_000);
  const width = clampInt(Number(widthParam), 600, 1800);

  const cacheKey = `${cid}:page:${page}:w:${width}`;
  const cached = getCachedImage(cacheKey);
  if (cached) {
    console.log(`[PdfPage] Cache HIT: ${cacheKey}`);
    return new NextResponse(new Uint8Array(cached.data), {
      headers: {
        ...corsHeaders,
        'Content-Type': cached.mimeType,
        'Content-Length': cached.data.length.toString(),
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': 'HIT',
        'X-Page': String(page),
        'X-Width': String(width),
      },
    });
  }

  // Concurrency guard
  await acquireRenderSlot();
  try {
    console.log(`[PdfPage] Rendering: ${cid}, page ${page}, width ${width}`);
    
    // 1) Lookup encryption metadata
    const asset = await findAssetByCid(cid);
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404, headers: corsHeaders });
    }
    if (!asset.token_qube_id) {
      return NextResponse.json({ error: 'No token qube for decryption' }, { status: 400, headers: corsHeaders });
    }

    // 2) Fetch token qube (unwrap key)
    const { data: tokenQube, error: tokenError } = await supabase
      .from('iq_token_qubes')
      .select('key_ciphertext, key_wrapping_alg')
      .eq('id', asset.token_qube_id)
      .single();

    if (tokenError || !tokenQube) {
      return NextResponse.json(
        { error: `Token qube not found: ${tokenError?.message || 'unknown'}` },
        { status: 404, headers: corsHeaders }
      );
    }

    let contentKey: Buffer;
    try {
      contentKey = unwrapKeyWithMasterKey({
        keyCiphertext: tokenQube.key_ciphertext,
        wrappingAlgorithm: tokenQube.key_wrapping_alg || 'aes-256-kw',
      });
    } catch (e) {
      console.error('[PdfPage] Key unwrap error:', e);
      return NextResponse.json(
        { error: 'Key unwrap failed - check CODEX_MASTER_KEY' },
        { status: 500, headers: corsHeaders }
      );
    }

    // 3) Download encrypted PDF from Autonomys
    const apiKey = process.env.AUTONOMYS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Autonomys not configured' }, { status: 500, headers: corsHeaders });
    }

    const api = createAutoDriveApi({ apiKey, network: NetworkId.MAINNET });

    let encryptedData: Buffer;
    try {
      const stream = await api.downloadFile(asset.auto_drive_cid);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      encryptedData = Buffer.concat(chunks);
      console.log(`[PdfPage] Downloaded ${encryptedData.length} bytes from Autonomys`);
    } catch (e) {
      console.error('[PdfPage] Download error:', e);
      return NextResponse.json({ error: 'Download failed' }, { status: 500, headers: corsHeaders });
    }

    // 4) Decrypt PDF
    let decryptedPdf: Buffer;
    try {
      decryptedPdf = decryptContent({
        ciphertext: encryptedData,
        iv: asset.encryption_iv,
        authTag: asset.encryption_auth_tag || '',
        key: contentKey,
      });
      console.log(`[PdfPage] Decrypted ${decryptedPdf.length} bytes`);
    } catch (e) {
      console.error('[PdfPage] Decryption error:', e);
      return NextResponse.json({ error: 'Decryption failed' }, { status: 500, headers: corsHeaders });
    }

    // 5) Render page -> PNG buffer
    const { pngBuffer, numPages } = await renderPdfPageToPng(decryptedPdf, page, width);

    if (page > numPages) {
      return NextResponse.json(
        { error: `Invalid page. PDF has ${numPages} pages.` },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[PdfPage] Rendered page ${page}/${numPages}, PNG size: ${pngBuffer.length} bytes`);

    // 6) Encode WebP under 950KB
    const encoded = await encodeWebPUnderLimit(pngBuffer, width);
    console.log(`[PdfPage] Encoded WebP: ${encoded.data.length} bytes, ok=${encoded.ok}`);

    // 7) Cache and return
    setCachedImage(cacheKey, encoded.data, encoded.mime);

    return new NextResponse(new Uint8Array(encoded.data), {
      headers: {
        ...corsHeaders,
        'Content-Type': encoded.mime,
        'Content-Length': encoded.data.length.toString(),
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': 'MISS',
        'X-Variant': 'page',
        'X-Page': String(page),
        'X-Width': String(width),
        'X-Render-OK': encoded.ok ? '1' : '0',
      },
    });
  } catch (e: any) {
    console.error('[PdfPage] Error:', e);
    // Always return 200 placeholder to avoid ORB/render cascades
    setCachedImage(`${cid}:page:${page}:w:${width}`, PLACEHOLDER_PNG, 'image/png');
    return new NextResponse(new Uint8Array(PLACEHOLDER_PNG), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/png',
        'Content-Length': PLACEHOLDER_PNG.length.toString(),
        'Cache-Control': 'public, max-age=300',
        'X-Variant': 'page',
        'X-Page': String(page),
        'X-Width': String(width),
        'X-Render-OK': '0',
      },
    });
  } finally {
    releaseRenderSlot();
  }
}

// ---- Helpers ----

async function findAssetByCid(cid: string) {
  // Try codex_media_assets first
  const { data: asset, error: assetError } = await supabase
    .from('codex_media_assets')
    .select('auto_drive_cid, mime_type, encryption_iv, encryption_auth_tag, token_qube_id')
    .eq('auto_drive_cid', cid)
    .single();

  if (!assetError && asset) return asset;

  // Fallback to master_content_qubes
  const { data: master, error: masterError } = await supabase
    .from('master_content_qubes')
    .select('auto_drive_cid, mime_type, encryption_iv, encryption_auth_tag, token_qube_id')
    .eq('auto_drive_cid', cid)
    .single();

  if (!masterError && master) return master;

  return null;
}

async function renderPdfPageToPng(decryptedPdf: Buffer, pageNumber: number, targetWidth: number) {
  // Dynamic import to avoid Next.js ESM issues
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const { getDocument } = pdfjs as any;

  // Load PDF with security hardening
  const loadingTask = getDocument({
    data: new Uint8Array(decryptedPdf),
    isEvalSupported: false, // Security hardening
  });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  // If pageNumber is out of range, still return numPages so caller can respond
  const safePage = Math.min(Math.max(pageNumber, 1), numPages);
  const page = await pdf.getPage(safePage);

  // Compute scale to match targetWidth
  const viewport1 = page.getViewport({ scale: 1 });
  const scale = targetWidth / viewport1.width;
  const viewport = page.getViewport({ scale });

  const canvasFactory = new NodeCanvasFactory();
  const { canvas, context } = await canvasFactory.create(Math.floor(viewport.width), Math.floor(viewport.height));

  const renderTask = page.render({
    canvasContext: context as any,
    viewport,
    canvasFactory: canvasFactory as any,
  });

  await renderTask.promise;

  // Encode as PNG in-memory
  const pngBuffer = canvas.toBuffer('image/png');

  // Cleanup
  canvasFactory.destroy({ canvas, context });

  return { pngBuffer, numPages };
}
