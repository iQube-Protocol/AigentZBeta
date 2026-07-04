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

import { getActivePersona } from '@/services/identity/getActivePersona';
import { getContentDescriptorByCid } from '@/services/content/getContentDescriptor';
import { evaluateAccess } from '@/services/access/evaluateAccess';

import { getCachedImage, setCachedImage } from './cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Phase B fix — Bug 2: large PDFs (e.g. 430MB GN) need more than the
// default 10s serverless timeout to download + decrypt + render a
// single page. 60s comfortably covers worst-case Autonomys + render.
export const maxDuration = 60;

// CORS headers for cross-origin requests from thin client
export async function OPTIONS() {
  return new NextResponse(null);
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
  params: Promise<{ cid: string }>;
}

export async function GET(req: NextRequest, props: RouteParams) {
  const params = await props.params;
  const { cid } = params;

  if (!cid) {
    return NextResponse.json({ error: 'CID required' }, { status: 400,  });
  }

  const pageParam = req.nextUrl.searchParams.get('page') ?? '1';
  const widthParam = req.nextUrl.searchParams.get('width') ?? '1200';

  const page = clampInt(Number(pageParam), 1, 10_000);
  const width = clampInt(Number(widthParam), 600, 1800);

  // ─────────────────────────────────────────────────────────────────────
  // Spine gate — Phase 1.4 consumer migration
  //
  // This route was previously un-gated (anyone with a CID could fetch
  // any page of any asset). The unified IAM spine adds an entitlement
  // check at this seam.
  //
  // Rollout posture: shadow-log by default. The gate runs and logs
  // its decision but does NOT block. When the operator confirms
  // baseline behaviour is intact across the five test surfaces (Brave
  // platform, Brave thin-client, Firefox both, mobile Safari), they
  // flip ACCESS_SPINE_ENFORCE=1 to enforce.
  //
  // See plan §1.5 (consumer migration order) and the surgical-change
  // protocol in CLAUDE.md.
  // ─────────────────────────────────────────────────────────────────────
  const enforceGate = process.env.ACCESS_SPINE_ENFORCE === '1';
  try {
    const descriptor = await getContentDescriptorByCid(cid);
    if (!descriptor) {
      // No descriptor = unknown asset. Today's behaviour is to 404 below
      // when findAssetByCid returns null. Skip the gate; fall through.
      console.log(`[SPINE] route=pdf-page result=skip cid=${cid} reason=no-descriptor`);
    } else {
      const context = await getActivePersona(req);
      if (!context) {
        console.log(
          `[SPINE] route=pdf-page result=unauthenticated cid=${cid} ` +
          `asset=${descriptor.assetId} state=${descriptor.state} ` +
          `gating=${descriptor.gating.kind} enforce=${enforceGate}`,
        );
        if (enforceGate && descriptor.gating.kind !== 'free') {
          return new NextResponse(new Uint8Array(PLACEHOLDER_PNG), {
            status: 403,
            headers: {
              'Content-Type': 'image/png',
              'Content-Length': PLACEHOLDER_PNG.length.toString(),
              'Cache-Control': 'no-store',
              'X-Access-Denied': 'unauthenticated',
            },
          });
        }
      } else {
        const decision = await evaluateAccess(context, descriptor, 'read');
        console.log(
          `[SPINE] route=pdf-page result=${decision.allow ? 'ALLOW' : 'DENY'} ` +
          `reason=${decision.reason} cid=${cid} asset=${descriptor.assetId} ` +
          `state=${descriptor.state} gating=${descriptor.gating.kind} ` +
          `enforce=${enforceGate}`,
        );
        if (enforceGate && !decision.allow) {
          return new NextResponse(new Uint8Array(PLACEHOLDER_PNG), {
            status: 403,
            headers: {
              'Content-Type': 'image/png',
              'Content-Length': PLACEHOLDER_PNG.length.toString(),
              'Cache-Control': 'no-store',
              'X-Access-Denied': decision.reason,
            },
          });
        }
      }
    }
  } catch (gateErr) {
    // Never let a gate failure break a previously-working flow.
    // Log loudly; fall through to the legacy path so behaviour is
    // unchanged in shadow-log mode. In enforce mode, fail closed.
    console.error('[SPINE] route=pdf-page result=ERROR', gateErr);
    if (enforceGate) {
      return new NextResponse(new Uint8Array(PLACEHOLDER_PNG), {
        status: 503,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': PLACEHOLDER_PNG.length.toString(),
          'Cache-Control': 'no-store',
          'X-Access-Denied': 'gate-error',
        },
      });
    }
  }

  const cacheKey = `${cid}:page:${page}:w:${width}`;
  const cached = getCachedImage(cacheKey);
  if (cached) {
    console.log(`[PdfPage] Cache HIT: ${cacheKey}`);
    return new NextResponse(new Uint8Array(cached.data), {
      headers: {
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
      return NextResponse.json({ error: 'Asset not found' }, { status: 404,  });
    }
    if (!asset.token_qube_id) {
      return NextResponse.json({ error: 'No token qube for decryption' }, { status: 400,  });
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
        { status: 404,  }
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
        { status: 500,  }
      );
    }

    // 3) Download encrypted PDF from Autonomys
    const apiKey = process.env.AUTONOMYS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Autonomys not configured' }, { status: 500,  });
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
      return NextResponse.json({ error: 'Download failed' }, { status: 500,  });
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
      return NextResponse.json({ error: 'Decryption failed' }, { status: 500,  });
    }

    // 5) Render page -> PNG buffer
    const { pngBuffer, numPages } = await renderPdfPageToPng(decryptedPdf, page, width);

    if (page > numPages) {
      return NextResponse.json(
        { error: `Invalid page. PDF has ${numPages} pages.` },
        { status: 400,  }
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
  console.log(`[PdfPage] Looking for CID: ${cid}`);
  
  // Try codex_media_assets first
  const { data: asset, error: assetError } = await supabase
    .from('codex_media_assets')
    .select('auto_drive_cid, mime_type, encryption_iv, encryption_auth_tag, token_qube_id')
    .eq('auto_drive_cid', cid)
    .single();

  console.log(`[PdfPage] codex_media_assets result:`, { error: assetError, found: !!asset });
  if (!assetError && asset) return asset;

  // Fallback to master_content_qubes
  const { data: master, error: masterError } = await supabase
    .from('master_content_qubes')
    .select('auto_drive_cid, mime_type, encryption_iv, encryption_auth_tag, token_qube_id')
    .eq('auto_drive_cid', cid)
    .single();

  if (!masterError && master) return master;

  // Check if this is Episode #12 specifically
  if (cid.includes('ep12') || cid.includes('episode_12')) {
    console.log(`[PdfPage] Episode #12 CID not found. Checking all Episode 12 assets...`);
    const { data: ep12Assets } = await supabase
      .from('codex_media_assets')
      .select('auto_drive_cid, asset_kind, title')
      .eq('episode_number', 12);
    console.log(`[PdfPage] Episode 12 assets in database:`, ep12Assets);
  }

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
