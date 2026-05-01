/**
 * Admin API: Upload Codex Media Asset
 * 
 * POST /api/admin/codex/upload-asset
 * 
 * Uploads covers, characters, lore docs, game media, social assets
 * to Autonomys and creates codex_media_assets entries.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  uploadCodexMediaAsset,
  CodexAssetKind,
  validateFileType,
} from '../../../../../server/services/autonomysContentService';
import { getKnowledgeBaseService } from '@/services/content/knowledgeBaseService';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large uploads

type DisplayMode = 'pdf' | 'image' | 'video' | 'text_extract';

interface UploadAssetRequest {
  title: string;
  assetKind: CodexAssetKind;
  episodeNumber?: number;
  series?: string;
  priceAmount?: number;
  paymentType?: 'one-time' | 'subscription';
  paymentSurface?: 'overlay' | 'embedded' | 'liquid';
  // Cover-specific
  variantName?: string;
  rarityTier?: 'legendary' | 'epic' | 'rare' | 'common';
  editionMax?: number;
  randomWeight?: number;
  // Social-specific
  isShareable?: boolean;
  recommendedTask?: string;
  // Lore-specific
  displayMode?: DisplayMode;
}

export async function POST(req: NextRequest) {
  try {
    // Skip auth check in development mode
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Support both metadata JSON format and individual form fields
    const metadataStr = formData.get('metadata') as string | null;
    let metadata: UploadAssetRequest;

    if (metadataStr) {
      // Legacy format: metadata as JSON string
      try {
        metadata = JSON.parse(metadataStr);
      } catch {
        return NextResponse.json({ error: 'Invalid metadata JSON' }, { status: 400 });
      }
    } else {
      // New format: individual form fields
      const title = formData.get('title') as string | null;
      const assetKind = formData.get('assetKind') as string | null;
      const episodeNumber = formData.get('episodeNumber') as string | null;
      const series = formData.get('series') as string | null;
      const variantName = formData.get('variantName') as string | null;
      const rarityTier = formData.get('rarityTier') as string | null;
      const editionMax = formData.get('editionMax') as string | null;
      const priceAmount = formData.get('priceAmount') as string | null;
      const paymentType = formData.get('paymentType') as string | null;
      const paymentSurface = formData.get('paymentSurface') as string | null;

      if (!title || !assetKind) {
        return NextResponse.json({
          error: 'Missing required fields: title, assetKind',
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

      const displayMode = formData.get('displayMode') as string | null;

      metadata = {
        title,
        assetKind: assetKind as CodexAssetKind,
        episodeNumber: episodeNumber ? parseInt(episodeNumber, 10) : undefined,
        series: series || 'metaKnyts',
        priceAmount: parsedPriceAmount,
        paymentType: paymentType === 'subscription' ? 'subscription' : paymentType === 'one-time' ? 'one-time' : undefined,
        paymentSurface:
          paymentSurface === 'embedded' || paymentSurface === 'liquid' || paymentSurface === 'overlay'
            ? paymentSurface
            : undefined,
        variantName: variantName || undefined,
        rarityTier: rarityTier as 'legendary' | 'epic' | 'rare' | 'common' | undefined,
        editionMax: editionMax ? parseInt(editionMax, 10) : undefined,
        displayMode: displayMode as DisplayMode | undefined,
      };
    }

    // Validate required fields
    if (!metadata.title || !metadata.assetKind) {
      return NextResponse.json({
        error: 'Missing required fields: title, assetKind',
      }, { status: 400 });
    }

    // Validate asset kind
    const validAssetKinds: CodexAssetKind[] = [
      'character_poster',
      'powers_sheet',
      'background_lore_doc',
      'game_concept_doc',
      'game_still',
      'game_video',
      'twenty_one_sats_concept',
      'social_campaign_video',
      'social_campaign_image',
      'cover_pdf',
      'cover_image',
      'cover_motion',
      'ra_badge',
    ];

    if (!validAssetKinds.includes(metadata.assetKind)) {
      return NextResponse.json({
        error: `Invalid assetKind. Must be one of: ${validAssetKinds.join(', ')}`,
      }, { status: 400 });
    }

    // Validate file type
    const mimeType = file.type || 'application/octet-stream';
    if (!validateFileType(mimeType, metadata.assetKind)) {
      return NextResponse.json({
        error: `Invalid file type ${mimeType} for ${metadata.assetKind}`,
      }, { status: 400 });
    }

    // Validate cover-specific fields
    if (metadata.assetKind.startsWith('cover_')) {
      if (metadata.episodeNumber === undefined) {
        return NextResponse.json({
          error: 'episodeNumber is required for cover assets',
        }, { status: 400 });
      }
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[UploadAsset] Processing: ${metadata.title} (${metadata.assetKind}, ${buffer.length} bytes)`);

    // Upload to Autonomys
    const result = await uploadCodexMediaAsset({
      file: buffer,
      mimeType,
      title: metadata.title,
      assetKind: metadata.assetKind,
      episodeNumber: metadata.episodeNumber,
      series: metadata.series || 'metaKnyts',
      priceAmount: metadata.priceAmount,
      paymentType: metadata.paymentType,
      paymentSurface: metadata.paymentSurface,
      variantName: metadata.variantName,
      rarityTier: metadata.rarityTier,
      editionMax: metadata.editionMax,
      randomWeight: metadata.randomWeight,
      isShareable: metadata.isShareable,
      recommendedTask: metadata.recommendedTask,
      displayMode: metadata.displayMode,
    });

    console.log(`[UploadAsset] Success: ${result.id}`);

    // Auto-extract PDF content for knowledge base if it's a PDF document
    let kbDocumentId: string | undefined;
    const isPdfAsset = mimeType === 'application/pdf' || 
                       metadata.assetKind === 'cover_pdf' ||
                       metadata.assetKind === 'background_lore_doc' ||
                       metadata.assetKind === 'game_concept_doc' ||
                       metadata.assetKind === 'twenty_one_sats_concept';

    if (isPdfAsset && result.cid) {
      try {
        console.log(`[UploadAsset] Extracting PDF content for knowledge base...`);
        const kbService = getKnowledgeBaseService();
        
        // Determine content category based on asset kind
        let contentCategory = 'general';
        if (metadata.assetKind === 'background_lore_doc') contentCategory = 'world_building';
        else if (metadata.assetKind === 'game_concept_doc') contentCategory = 'technical';
        else if (metadata.assetKind === 'twenty_one_sats_concept') contentCategory = 'lore';
        else if (metadata.assetKind === 'cover_pdf') contentCategory = 'episode_content';

        const kbResult = await kbService.processPdfFromBuffer(buffer, {
          title: metadata.title,
          domain: 'metaKnyts',
          series: metadata.series || 'metaKnyts',
          episodeNumber: metadata.episodeNumber,
          contentCategory,
          sourceCid: result.cid,
          sourceId: result.id,
          tags: [metadata.assetKind],
        });

        if (kbResult.success) {
          kbDocumentId = kbResult.documentId;
          console.log(`[UploadAsset] PDF extracted to KB document: ${kbDocumentId}`);
        } else {
          console.warn(`[UploadAsset] KB extraction failed: ${kbResult.error}`);
        }
      } catch (kbError) {
        console.error('[UploadAsset] KB extraction error:', kbError);
        // Don't fail the upload if KB extraction fails
      }
    }

    return NextResponse.json({
      success: true,
      id: result.id,
      cid: result.cid,
      kbDocumentId,
      data: {
        id: result.id,
        cid: result.cid,
        metaQubeId: result.metaQubeId,
        blakQubeId: result.blakQubeId,
        tokenQubeId: result.tokenQubeId,
        assetKind: metadata.assetKind,
        episodeNumber: metadata.episodeNumber,
        priceAmount: metadata.priceAmount,
        paymentType: metadata.paymentType,
        paymentSurface: metadata.paymentSurface,
        kbDocumentId,
      },
    });

  } catch (error) {
    console.error('[UploadAsset] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Upload failed',
    }, { status: 500 });
  }
}
