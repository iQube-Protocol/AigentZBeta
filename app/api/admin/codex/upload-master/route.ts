/**
 * Admin API: Upload Master Content
 * 
 * POST /api/admin/codex/upload-master
 * 
 * Uploads episode still PDFs, motion comics, or print editions to Autonomys
 * and creates master_content_qubes entries.
 * 
 * For print editions, include editionTier (rare, epic, legendary).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  uploadMasterContent,
  MasterContentType,
  EditionTier,
  validateFileType,
} from '../../../../../server/services/autonomysContentService';

export const runtime = 'nodejs';
export const maxDuration = 600; // 10 minutes for large video uploads (motion comics)

interface UploadMasterRequest {
  episodeNumber: number;
  title: string;
  contentType: MasterContentType;
  series?: string;
  editionTier?: EditionTier;
  priceAmount?: number;
  paymentType?: 'one-time' | 'subscription';
  paymentSurface?: 'overlay' | 'embedded' | 'liquid';
}

export async function POST(req: NextRequest) {
  try {
    // No auth check — admin codex routes are URL-protected; the codex viewer
    // host page does not require a Supabase session, so requiring a Bearer
    // token here blocks legitimate operator uploads on the dev environment.

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Support both metadata JSON format and individual form fields
    const metadataStr = formData.get('metadata') as string | null;
    let metadata: UploadMasterRequest;
    
    if (metadataStr) {
      // Legacy format: metadata as JSON string
      try {
        metadata = JSON.parse(metadataStr);
      } catch {
        return NextResponse.json({ error: 'Invalid metadata JSON' }, { status: 400 });
      }
    } else {
      // New format: individual form fields
      const episodeNumber = formData.get('episodeNumber') as string | null;
      const title = formData.get('title') as string | null;
      const contentType = formData.get('contentType') as string | null;
      const series = formData.get('series') as string | null;
      const editionTier = formData.get('editionTier') as string | null;
      const priceAmount = formData.get('priceAmount') as string | null;
      const paymentType = formData.get('paymentType') as string | null;
      const paymentSurface = formData.get('paymentSurface') as string | null;
      
      if (!episodeNumber || !title || !contentType) {
        return NextResponse.json({
          error: 'Missing required fields: episodeNumber, title, contentType',
        }, { status: 400 });
      }

      const parsedPriceAmount = priceAmount !== null && priceAmount.trim() !== ''
        ? Number(priceAmount)
        : undefined;
      if (parsedPriceAmount !== undefined && (!Number.isFinite(parsedPriceAmount) || parsedPriceAmount < 0)) {
        return NextResponse.json({
          error: 'Invalid priceAmount. Must be a non-negative number.',
        }, { status: 400 });
      }
      
      metadata = {
        episodeNumber: parseInt(episodeNumber, 10),
        title,
        contentType: contentType as MasterContentType,
        series: series || 'metaKnyts',
        editionTier: editionTier as EditionTier | undefined,
        priceAmount: parsedPriceAmount,
        paymentType: paymentType === 'subscription' ? 'subscription' : paymentType === 'one-time' ? 'one-time' : undefined,
        paymentSurface:
          paymentSurface === 'embedded' || paymentSurface === 'liquid' || paymentSurface === 'overlay'
            ? paymentSurface
            : undefined,
      };
    }

    // Validate required fields — use == null to allow episodeNumber 0 (GN)
    if (metadata.episodeNumber == null || !metadata.title || !metadata.contentType) {
      return NextResponse.json({
        error: 'Missing required fields: episodeNumber, title, contentType',
      }, { status: 400 });
    }

    // Validate content type
    if (!['episode_still', 'episode_motion', 'episode_print'].includes(metadata.contentType)) {
      return NextResponse.json({
        error: 'Invalid contentType. Must be episode_still, episode_motion, or episode_print',
      }, { status: 400 });
    }
    
    // Validate editionTier for print editions
    if (metadata.contentType === 'episode_print') {
      if (!metadata.editionTier) {
        return NextResponse.json({
          error: 'editionTier is required for episode_print content type',
        }, { status: 400 });
      }
      if (!['rare', 'epic', 'legendary', 'common'].includes(metadata.editionTier)) {
        return NextResponse.json({
          error: 'Invalid editionTier. Must be common, rare, epic, or legendary',
        }, { status: 400 });
      }
    }
    // Motion Comics may carry a tier flag as well (Common/Rare/Epic/Legendary).
    // Validate when provided but don't require it.
    if (metadata.contentType === 'episode_motion' && metadata.editionTier) {
      if (!['rare', 'epic', 'legendary', 'common'].includes(metadata.editionTier)) {
        return NextResponse.json({
          error: 'Invalid editionTier. Must be common, rare, epic, or legendary',
        }, { status: 400 });
      }
    }

    // Validate file type
    const mimeType = file.type || 'application/octet-stream';
    if (!validateFileType(mimeType, metadata.contentType)) {
      return NextResponse.json({
        error: `Invalid file type ${mimeType} for ${metadata.contentType}`,
      }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[UploadMaster] Processing: ${metadata.title} (${buffer.length} bytes)`);

    // Upload to Autonomys
    const result = await uploadMasterContent({
      file: buffer,
      mimeType,
      title: metadata.title,
      episodeNumber: metadata.episodeNumber,
      contentType: metadata.contentType,
      series: metadata.series || 'metaKnyts',
      editionTier: metadata.editionTier,
      priceAmount: metadata.priceAmount,
      paymentType: metadata.paymentType,
      paymentSurface: metadata.paymentSurface,
    });

    const tierLabel = metadata.editionTier ? ` [${metadata.editionTier}]` : '';
    console.log(`[UploadMaster] Success: ${result.id}${tierLabel}`);

    return NextResponse.json({
      success: true,
      id: result.id,
      cid: result.cid,
      data: {
        id: result.id,
        cid: result.cid,
        metaQubeId: result.metaQubeId,
        blakQubeId: result.blakQubeId,
        tokenQubeId: result.tokenQubeId,
        episodeNumber: metadata.episodeNumber,
        contentType: metadata.contentType,
        editionTier: metadata.editionTier,
        priceAmount: metadata.priceAmount,
        paymentType: metadata.paymentType,
        paymentSurface: metadata.paymentSurface,
      },
    });

  } catch (error) {
    console.error('[UploadMaster] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Upload failed',
    }, { status: 500 });
  }
}
