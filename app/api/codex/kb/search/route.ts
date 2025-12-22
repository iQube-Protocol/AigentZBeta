/**
 * Knowledge Base Search API
 * 
 * GET /api/codex/kb/search - Search the knowledge base for relevant content
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeBaseService } from '@/services/content/knowledgeBaseService';
import type { ContentDomain } from '@/services/content/knowledgeBaseService';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/codex/kb/search
 * 
 * Query params:
 * - q: string (search query, required)
 * - domain: 'metaKnyts' | 'qriptopian'
 * - limit: number (default 10)
 * - maxTokens: number (default 2000, for RAG context)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const domain = searchParams.get('domain') as ContentDomain | null;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const maxTokens = parseInt(searchParams.get('maxTokens') || '2000', 10);

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const kbService = getKnowledgeBaseService();

    // Get relevant chunks for the query
    const chunks = await kbService.getRelevantChunks(
      query,
      domain || 'metaKnyts',
      limit,
      maxTokens
    );

    // Calculate total tokens
    const totalTokens = chunks.reduce((sum, chunk) => 
      sum + (chunk.token_count || Math.ceil((chunk.word_count || 0) * 1.3)), 0
    );

    return NextResponse.json({
      query,
      domain: domain || 'metaKnyts',
      chunks,
      stats: {
        chunkCount: chunks.length,
        totalTokens,
        maxTokens,
      },
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[KB Search API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
