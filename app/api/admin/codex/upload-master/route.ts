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
      
      if (!episodeNumber || !title || !contentType) {
        return NextResponse.json({
          error: 'Missing required fields: episodeNumber, title, contentType',
        }, { status: 400 });
      }
      
      metadata = {
        episodeNumber: parseInt(episodeNumber, 10),
        title,
        contentType: contentType as MasterContentType,
        series: series || 'metaKnyts',
        editionTier: editionTier as EditionTier | undefined,
      };
    }

    // Validate required fields
    if (!metadata.episodeNumber || !metadata.title || !metadata.contentType) {
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
      if (!['rare', 'epic', 'legendary'].includes(metadata.editionTier)) {
        return NextResponse.json({
          error: 'Invalid editionTier. Must be rare, epic, or legendary',
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
      },
    });

  } catch (error) {
    console.error('[UploadMaster] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Upload failed',
    }, { status: 500 });
  }
}
