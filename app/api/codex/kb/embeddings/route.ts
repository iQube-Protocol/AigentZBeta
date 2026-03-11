/**
 * Knowledge Base Embeddings API
 * 
 * POST /api/codex/kb/embeddings - Generate embeddings for KB chunks
 * GET /api/codex/kb/embeddings - Get embedding statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEmbeddingService } from '@/services/content/embeddingService';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204,  });
}

/**
 * GET /api/codex/kb/embeddings
 * 
 * Get embedding statistics
 */
export async function GET() {
  try {
    const embeddingService = getEmbeddingService();
    
    const stats = await embeddingService.getStats();
    const isAvailable = embeddingService.isAvailable();
    const provider = embeddingService.getProviderInfo();

    return NextResponse.json({
      available: isAvailable,
      provider,
      stats,
      percentComplete: stats.totalChunks > 0 
        ? Math.round((stats.embeddedChunks / stats.totalChunks) * 100) 
        : 0,
    });

  } catch (error) {
    console.error('[KB Embeddings API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500,  }
    );
  }
}

/**
 * POST /api/codex/kb/embeddings
 * 
 * Generate embeddings for unembedded chunks
 * 
 * Body (optional):
 * - batchSize: number (default 20)
 */
export async function POST(request: NextRequest) {
  try {
    const embeddingService = getEmbeddingService();
    const provider = embeddingService.getProviderInfo();

    if (!embeddingService.isAvailable()) {
      return NextResponse.json(
        { error: 'No embedding provider configured. Embeddings are not available.', provider },
        { status: 503,  }
      );
    }

    // Parse optional batch size
    let batchSize = 20;
    try {
      const body = await request.json();
      if (body.batchSize && typeof body.batchSize === 'number') {
        batchSize = Math.min(body.batchSize, 100); // Cap at 100
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log(`[KB Embeddings] Processing batch of ${batchSize} chunks...`);

    // Get stats before
    const statsBefore = await embeddingService.getStats();

    // Process unembedded chunks
    const result = await embeddingService.processUnembeddedChunks(batchSize);

    // Get stats after
    const statsAfter = await embeddingService.getStats();

    return NextResponse.json({
      success: result.success,
      provider,
      processed: result.processed,
      failed: result.failed,
      errors: result.errors.slice(0, 5), // Limit errors in response
      stats: {
        before: statsBefore,
        after: statsAfter,
      },
      percentComplete: statsAfter.totalChunks > 0 
        ? Math.round((statsAfter.embeddedChunks / statsAfter.totalChunks) * 100) 
        : 0,
    });

  } catch (error) {
    console.error('[KB Embeddings API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500,  }
    );
  }
}
