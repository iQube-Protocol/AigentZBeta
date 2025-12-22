/**
 * Knowledge Base Documents API
 * 
 * GET /api/codex/kb/documents - List documents in the knowledge base
 * POST /api/codex/kb/documents - Register a new document (without extraction)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeBaseService } from '@/services/content/knowledgeBaseService';
import type { ContentDomain, DocumentSourceType } from '@/services/content/knowledgeBaseService';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/codex/kb/documents
 * 
 * Query params:
 * - domain: 'metaKnyts' | 'qriptopian'
 * - series: string
 * - contentCategory: string
 * - status: 'pending' | 'processing' | 'completed' | 'failed'
 * - limit: number (default 50)
 * - offset: number (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain') as ContentDomain | null;
    const series = searchParams.get('series');
    const contentCategory = searchParams.get('contentCategory');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const kbService = getKnowledgeBaseService();
    
    const documents = await kbService.listDocuments({
      domain: domain || undefined,
      series: series || undefined,
      contentCategory: contentCategory || undefined,
      limit,
      offset,
    });

    // Get stats
    const stats = await kbService.getStats(domain || undefined);

    return NextResponse.json({
      documents,
      stats,
      pagination: {
        limit,
        offset,
        total: stats.documentCount,
      },
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[KB Documents API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/codex/kb/documents
 * 
 * Register a document without extraction (for manual/deferred processing)
 * 
 * Body:
 * - sourceType: 'pdf' | 'episode' | 'character' | 'lore' | 'article'
 * - sourceId?: string
 * - sourceCid?: string
 * - title: string
 * - domain: 'metaKnyts' | 'qriptopian'
 * - series?: string
 * - episodeNumber?: number
 * - contentCategory?: string
 * - tags?: string[]
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sourceType,
      sourceId,
      sourceCid,
      title,
      domain = 'metaKnyts',
      series,
      episodeNumber,
      contentCategory,
      tags,
      metadata,
    } = body;

    if (!sourceType) {
      return NextResponse.json(
        { error: 'sourceType is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const kbService = getKnowledgeBaseService();
    
    const document = await kbService.registerDocument({
      sourceType: sourceType as DocumentSourceType,
      sourceId,
      sourceCid,
      title,
      domain: domain as ContentDomain,
      series,
      episodeNumber,
      contentCategory,
      tags,
      metadata,
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Failed to register document' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      success: true,
      document,
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[KB Documents API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
