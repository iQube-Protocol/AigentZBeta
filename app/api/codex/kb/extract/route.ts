/**
 * Knowledge Base PDF Extraction API
 * 
 * Endpoints for extracting content from PDFs and adding to the Codex Knowledge Base.
 * 
 * POST /api/codex/kb/extract
 * - Extract content from a PDF by CID or uploaded file
 * - Stores extracted content in the knowledge base
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeBaseService } from '@/services/content/knowledgeBaseService';
import type { ContentDomain } from '@/services/content/knowledgeBaseService';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/codex/kb/extract
 * 
 * Extract content from a PDF and store in knowledge base
 * 
 * Body (JSON):
 * - cid: string (Autonomys CID of the PDF)
 * - title: string (Document title)
 * - domain: 'metaKnyts' | 'qriptopian'
 * - series?: string
 * - episodeNumber?: number
 * - contentCategory?: string
 * - tags?: string[]
 * 
 * Or multipart/form-data:
 * - file: PDF file
 * - title: string
 * - domain: string
 * - (other fields as above)
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const kbService = getKnowledgeBaseService();

    // Handle multipart form data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const title = formData.get('title') as string;
      const domain = (formData.get('domain') as ContentDomain) || 'metaKnyts';
      const series = formData.get('series') as string | null;
      const episodeNumber = formData.get('episodeNumber') as string | null;
      const contentCategory = formData.get('contentCategory') as string | null;
      const tagsStr = formData.get('tags') as string | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400, headers: corsHeaders }
        );
      }

      if (!title) {
        return NextResponse.json(
          { error: 'Title is required' },
          { status: 400, headers: corsHeaders }
        );
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Process the PDF
      const result = await kbService.processPdfFromBuffer(buffer, {
        title,
        domain,
        series: series || undefined,
        episodeNumber: episodeNumber ? parseInt(episodeNumber, 10) : undefined,
        contentCategory: contentCategory || undefined,
        tags: tagsStr ? tagsStr.split(',').map(t => t.trim()) : undefined,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to process PDF' },
          { status: 500, headers: corsHeaders }
        );
      }

      return NextResponse.json({
        success: true,
        documentId: result.documentId,
        message: 'PDF extracted and stored in knowledge base',
      }, { headers: corsHeaders });
    }

    // Handle JSON body (CID-based extraction)
    const body = await request.json();
    const {
      cid,
      title,
      domain = 'metaKnyts',
      series,
      episodeNumber,
      contentCategory,
      tags,
    } = body;

    if (!cid) {
      return NextResponse.json(
        { error: 'CID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get the API base URL for fetching the PDF
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 
                       `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    // Process the PDF from CID
    const result = await kbService.processPdfFromCid(cid, {
      title,
      domain,
      series,
      episodeNumber,
      contentCategory,
      tags,
    }, apiBaseUrl);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to process PDF' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      message: 'PDF extracted and stored in knowledge base',
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[KB Extract API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
