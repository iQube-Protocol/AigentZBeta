/**
 * Embedding Service
 * 
 * Generates and manages vector embeddings for semantic search in the Knowledge Base.
 * Uses OpenAI's text-embedding-ada-002 model (1536 dimensions).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingResult {
  success: boolean;
  embedding?: number[];
  error?: string;
  tokenCount?: number;
}

export interface BatchEmbeddingResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: string[];
}

export interface SimilaritySearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata: {
    title?: string;
    domain?: string;
    contentCategory?: string;
    chunkIndex?: number;
  };
}

// ============================================================================
// Embedding Service
// ============================================================================

class EmbeddingService {
  private supabase: SupabaseClient;
  private openaiApiKey: string | undefined;
  private model = 'text-embedding-ada-002';
  private dimensions = 1536;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  /**
   * Check if embeddings are available (OpenAI key configured)
   */
  isAvailable(): boolean {
    return !!this.openaiApiKey;
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.openaiApiKey) {
      return { success: false, error: 'OpenAI API key not configured' };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: text.substring(0, 8000), // Limit to ~8000 chars for safety
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error?.message || 'OpenAI API error' };
      }

      const data = await response.json();
      const embedding = data.data[0]?.embedding;
      const tokenCount = data.usage?.total_tokens;

      if (!embedding) {
        return { success: false, error: 'No embedding returned' };
      }

      return { success: true, embedding, tokenCount };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.openaiApiKey) {
      return texts.map(() => ({ success: false, error: 'OpenAI API key not configured' }));
    }

    // OpenAI supports batch embeddings
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: texts.map(t => t.substring(0, 8000)),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMsg = error.error?.message || 'OpenAI API error';
        return texts.map(() => ({ success: false, error: errorMsg }));
      }

      const data = await response.json();
      return data.data.map((item: { embedding: number[]; index: number }) => ({
        success: true,
        embedding: item.embedding,
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return texts.map(() => ({ success: false, error: errorMsg }));
    }
  }

  /**
   * Store embedding for a chunk
   */
  async storeChunkEmbedding(chunkId: string, embedding: number[]): Promise<boolean> {
    // Convert to pgvector format
    const vectorStr = `[${embedding.join(',')}]`;

    const { error } = await this.supabase
      .from('codex_kb_chunks')
      .update({ embedding: vectorStr })
      .eq('id', chunkId);

    if (error) {
      console.error('[Embedding] Error storing embedding:', error);
      return false;
    }

    return true;
  }

  /**
   * Generate and store embeddings for all chunks without embeddings
   */
  async processUnembeddedChunks(batchSize: number = 20): Promise<BatchEmbeddingResult> {
    if (!this.openaiApiKey) {
      return { success: false, processed: 0, failed: 0, errors: ['OpenAI API key not configured'] };
    }

    // Get chunks without embeddings
    const { data: chunks, error } = await this.supabase
      .from('codex_kb_chunks')
      .select('id, content')
      .is('embedding', null)
      .limit(batchSize);

    if (error || !chunks) {
      return { success: false, processed: 0, failed: 0, errors: [error?.message || 'Failed to fetch chunks'] };
    }

    if (chunks.length === 0) {
      return { success: true, processed: 0, failed: 0, errors: [] };
    }

    console.log(`[Embedding] Processing ${chunks.length} chunks...`);

    // Generate embeddings in batch
    const texts = chunks.map(c => c.content);
    const results = await this.generateEmbeddings(texts);

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    // Store embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const result = results[i];

      if (result.success && result.embedding) {
        const stored = await this.storeChunkEmbedding(chunk.id, result.embedding);
        if (stored) {
          processed++;
        } else {
          failed++;
          errors.push(`Failed to store embedding for chunk ${chunk.id}`);
        }
      } else {
        failed++;
        errors.push(result.error || `Failed to generate embedding for chunk ${chunk.id}`);
      }
    }

    return { success: true, processed, failed, errors };
  }

  /**
   * Semantic search using vector similarity
   */
  async semanticSearch(
    query: string,
    domain: string = 'metaKnyts',
    limit: number = 5,
    similarityThreshold: number = 0.7
  ): Promise<SimilaritySearchResult[]> {
    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(query);
    
    if (!queryEmbedding.success || !queryEmbedding.embedding) {
      console.error('[Embedding] Failed to generate query embedding:', queryEmbedding.error);
      return [];
    }

    // Use Supabase's vector similarity search via RPC
    // This requires a function to be created in Supabase
    const { data, error } = await this.supabase.rpc('search_kb_chunks', {
      query_embedding: queryEmbedding.embedding,
      match_domain: domain,
      match_threshold: similarityThreshold,
      match_count: limit,
    });

    if (error) {
      console.error('[Embedding] Semantic search error:', error);
      // Fall back to text search if vector search fails
      return [];
    }

    return (data || []).map((item: {
      chunk_id: string;
      document_id: string;
      content: string;
      similarity: number;
      title: string;
      domain: string;
      content_category: string;
      chunk_index: number;
    }) => ({
      chunkId: item.chunk_id,
      documentId: item.document_id,
      content: item.content,
      similarity: item.similarity,
      metadata: {
        title: item.title,
        domain: item.domain,
        contentCategory: item.content_category,
        chunkIndex: item.chunk_index,
      },
    }));
  }

  /**
   * Hybrid search combining semantic and keyword search
   */
  async hybridSearch(
    query: string,
    domain: string = 'metaKnyts',
    limit: number = 5
  ): Promise<SimilaritySearchResult[]> {
    // Try semantic search first
    const semanticResults = await this.semanticSearch(query, domain, limit);
    
    if (semanticResults.length >= limit) {
      return semanticResults;
    }

    // Fall back to or supplement with keyword search
    const { data: keywordResults, error } = await this.supabase
      .from('codex_kb_chunks')
      .select(`
        id,
        document_id,
        content,
        chunk_index,
        document:codex_kb_documents!inner(title, domain, content_category)
      `)
      .eq('document.domain', domain)
      .textSearch('content', query, { type: 'websearch' })
      .limit(limit - semanticResults.length);

    if (error || !keywordResults) {
      return semanticResults;
    }

    // Merge results, avoiding duplicates
    const seenIds = new Set(semanticResults.map(r => r.chunkId));
    
    for (const item of keywordResults) {
      if (!seenIds.has(item.id)) {
        const doc = item.document as unknown as { title: string; domain: string; content_category: string };
        semanticResults.push({
          chunkId: item.id,
          documentId: item.document_id,
          content: item.content,
          similarity: 0.5, // Default similarity for keyword matches
          metadata: {
            title: doc.title,
            domain: doc.domain,
            contentCategory: doc.content_category,
            chunkIndex: item.chunk_index,
          },
        });
      }
    }

    return semanticResults.slice(0, limit);
  }

  /**
   * Get embedding statistics
   */
  async getStats(): Promise<{
    totalChunks: number;
    embeddedChunks: number;
    pendingChunks: number;
  }> {
    const { count: totalChunks } = await this.supabase
      .from('codex_kb_chunks')
      .select('*', { count: 'exact', head: true });

    const { count: embeddedChunks } = await this.supabase
      .from('codex_kb_chunks')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    return {
      totalChunks: totalChunks || 0,
      embeddedChunks: embeddedChunks || 0,
      pendingChunks: (totalChunks || 0) - (embeddedChunks || 0),
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let serviceInstance: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!serviceInstance) {
    serviceInstance = new EmbeddingService();
  }
  return serviceInstance;
}

export { EmbeddingService };
