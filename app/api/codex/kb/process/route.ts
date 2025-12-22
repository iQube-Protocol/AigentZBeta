/**
 * Knowledge Base Batch Processing API
 * 
 * POST /api/codex/kb/process - Process all pending documents in the knowledge base
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeBaseService } from '@/services/content/knowledgeBaseService';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/codex/kb/process
 * 
 * Process all pending PDF documents in the knowledge base
 * 
 * Body (optional):
 * - limit: number (max documents to process, default: all)
 */
export async function POST(request: NextRequest) {
  try {
    const kbService = getKnowledgeBaseService();

    // Get the API base URL for fetching PDFs
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 
                       `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    // Get stats before processing
    const statsBefore = await kbService.getStats();

    console.log(`[KB Process] Starting batch processing. Pending: ${statsBefore.pendingCount}`);

    // Process pending documents
    const result = await kbService.processPendingDocuments(apiBaseUrl);

    // Get stats after processing
    const statsAfter = await kbService.getStats();

    return NextResponse.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      stats: {
        before: statsBefore,
        after: statsAfter,
      },
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[KB Process API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
