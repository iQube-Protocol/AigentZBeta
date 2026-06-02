/**
 * Embedding Service
 * 
 * Generates and manages vector embeddings for semantic search in the Knowledge Base.
 * Supports a dedicated embedding-provider path with the current schema fixed at 1536 dimensions.
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

type EmbeddingProviderId = 'openai' | 'voyage' | 'none';

// ============================================================================
// Embedding Service
// ============================================================================

class EmbeddingService {
  private supabase: SupabaseClient;
  private openaiApiKey: string | undefined;
  private voyageApiKey: string | undefined;
  private provider: EmbeddingProviderId;
  private model: string;
  private dimensions = 1536;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.voyageApiKey = process.env.VOYAGE_API_KEY;

    const configuredProvider = (process.env.EMBEDDING_PROVIDER || '').trim().toLowerCase();
    if (configuredProvider === 'voyage' && this.voyageApiKey) {
      this.provider = 'voyage';
    } else if (configuredProvider === 'openai' && this.openaiApiKey) {
      this.provider = 'openai';
    } else if (this.openaiApiKey) {
      this.provider = 'openai';
    } else if (this.voyageApiKey) {
      this.provider = 'voyage';
    } else {
      this.provider = 'none';
    }

    this.model =
      this.provider === 'voyage'
        ? process.env.VOYAGE_EMBEDDING_MODEL || 'voyage-large-2'
        : process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  }

  private normalizeQueryTerms(query: string): string[] {
    return Array.from(
      new Set(
        query
          .toLowerCase()
          .split(/[^a-z0-9]+/i)
          .map((term) => term.trim())
          .filter((term) => term.length >= 3),
      ),
    ).slice(0, 8);
  }

  private mapRowToResult(item: any, similarity: number): SimilaritySearchResult {
    const doc = item.document as unknown as { title?: string; domain?: string; content_category?: string };
    return {
      chunkId: item.id,
      documentId: item.document_id,
      content: item.content,
      similarity,
      metadata: {
        title: doc?.title,
        domain: doc?.domain,
        contentCategory: doc?.content_category,
        chunkIndex: item.chunk_index,
      },
    };
  }

  private scoreLexicalMatch(content: string, title: string, terms: string[]): number {
    if (!terms.length) return 0;
    const contentLower = content.toLowerCase();
    const titleLower = title.toLowerCase();

    let score = 0;
    for (const term of terms) {
      if (titleLower.includes(term)) score += 3;
      const occurrences = contentLower.split(term).length - 1;
      score += Math.min(occurrences, 5);
    }

    return score;
  }

  private async keywordSearch(
    query: string,
    domain: string,
    limit: number,
  ): Promise<SimilaritySearchResult[]> {
    const terms = this.normalizeQueryTerms(query);
    const seenIds = new Set<string>();
    const results: SimilaritySearchResult[] = [];

    const appendUnique = (items: SimilaritySearchResult[]) => {
      for (const item of items) {
        if (seenIds.has(item.chunkId)) continue;
        seenIds.add(item.chunkId);
        results.push(item);
        if (results.length >= limit) break;
      }
    };

    const { data: textSearchRows, error: textSearchError } = await this.supabase
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
      .limit(limit);

    if (!textSearchError && textSearchRows?.length) {
      appendUnique(textSearchRows.map((row) => this.mapRowToResult(row, 0.55)));
    }

    if (results.length >= limit) {
      return results.slice(0, limit);
    }

    if (!terms.length) {
      return results.slice(0, limit);
    }

    const orClause = terms.map((term) => `content.ilike.%${term}%`).join(',');
    const { data: looseRows, error: looseError } = await this.supabase
      .from('codex_kb_chunks')
      .select(`
        id,
        document_id,
        content,
        chunk_index,
        document:codex_kb_documents!inner(title, domain, content_category)
      `)
      .eq('document.domain', domain)
      .or(orClause)
      .limit(Math.max(limit * 4, 20));

    if (looseError || !looseRows?.length) {
      return results.slice(0, limit);
    }

    const rankedLoose = looseRows
      .map((row) => {
        const doc = row.document as unknown as { title?: string };
        const score = this.scoreLexicalMatch(row.content || '', doc?.title || '', terms);
        return { row, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => this.mapRowToResult(entry.row, Math.max(0.3, 0.5 - index * 0.02)));

    appendUnique(rankedLoose);
    return results.slice(0, limit);
  }

  /**
   * Check if embeddings are available
   */
  isAvailable(): boolean {
    return this.provider !== 'none';
  }

  getProviderInfo() {
    return {
      provider: this.provider,
      model: this.model,
      dimensions: this.dimensions,
    };
  }

  private async generateOpenAiEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.openaiApiKey) {
      return { success: false, error: 'OpenAI embedding provider not configured' };
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text.substring(0, 8000),
        dimensions: this.dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      return { success: false, error: error?.error?.message || 'OpenAI API error' };
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;
    const tokenCount = data.usage?.total_tokens;

    if (!Array.isArray(embedding) || embedding.length !== this.dimensions) {
      return { success: false, error: 'OpenAI returned invalid embedding dimensions' };
    }

    return { success: true, embedding, tokenCount };
  }

  private async generateVoyageEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.voyageApiKey) {
      return { success: false, error: 'Voyage embedding provider not configured' };
    }

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.voyageApiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: [text.substring(0, 8000)],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      return { success: false, error: error?.detail || error?.message || 'Voyage API error' };
    }

    const data = await response.json();
    const embedding = data?.data?.[0]?.embedding;
    const tokenCount = data?.usage?.total_tokens;

    if (!Array.isArray(embedding) || embedding.length !== this.dimensions) {
      return {
        success: false,
        error: `Voyage model ${this.model} returned ${Array.isArray(embedding) ? embedding.length : 0} dimensions, expected ${this.dimensions}`,
      };
    }

    return { success: true, embedding, tokenCount };
  }

  private async generateOpenAiEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.openaiApiKey) {
      return texts.map(() => ({ success: false, error: 'OpenAI embedding provider not configured' }));
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts.map((text) => text.substring(0, 8000)),
        dimensions: this.dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      const errorMsg = error?.error?.message || 'OpenAI API error';
      return texts.map(() => ({ success: false, error: errorMsg }));
    }

    const data = await response.json();
    return (data.data || []).map((item: { embedding: number[] }) => ({
      success: Array.isArray(item.embedding) && item.embedding.length === this.dimensions,
      embedding: item.embedding,
      error:
        Array.isArray(item.embedding) && item.embedding.length === this.dimensions
          ? undefined
          : 'OpenAI returned invalid embedding dimensions',
    }));
  }

  private async generateVoyageEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.voyageApiKey) {
      return texts.map(() => ({ success: false, error: 'Voyage embedding provider not configured' }));
    }

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.voyageApiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts.map((text) => text.substring(0, 8000)),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      const errorMsg = error?.detail || error?.message || 'Voyage API error';
      return texts.map(() => ({ success: false, error: errorMsg }));
    }

    const data = await response.json();
    return (data.data || []).map((item: { embedding: number[] }) => ({
      success: Array.isArray(item.embedding) && item.embedding.length === this.dimensions,
      embedding: item.embedding,
      error:
        Array.isArray(item.embedding) && item.embedding.length === this.dimensions
          ? undefined
          : 'Voyage returned invalid embedding dimensions',
    }));
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      switch (this.provider) {
        case 'openai':
          return await this.generateOpenAiEmbedding(text);
        case 'voyage':
          return await this.generateVoyageEmbedding(text);
        default:
          return { success: false, error: 'No embedding provider configured' };
      }
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
    try {
      switch (this.provider) {
        case 'openai':
          return await this.generateOpenAiEmbeddings(texts);
        case 'voyage':
          return await this.generateVoyageEmbeddings(texts);
        default:
          return texts.map(() => ({ success: false, error: 'No embedding provider configured' }));
      }
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
    if (!this.isAvailable()) {
      return { success: false, processed: 0, failed: 0, errors: ['No embedding provider configured'] };
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
   * Hybrid search combining semantic and keyword search.
   *
   * Phase 8 of the myCartridge PRD §16 extends the signature with an
   * optional `cartridgeSlug` filter. When provided, the implementation
   * will eventually scope the embedding lookup to chunks tagged with
   * that cartridge slug (per `cartridge_kb_sources` — PRD §17 / §26;
   * table lands in v0.5). For MVP, the parameter is accepted on the
   * contract but the filter falls back to the domain-scoped lookup
   * because cartridge KB sources are not yet populated. The graceful
   * fallback matches the PRD: "if cartridge KB is empty, copilot falls
   * back to domain-scoped KB."
   *
   * Callers should pass `cartridgeSlug` whenever they have one — the
   * signature won't change again when v0.5 wires the filter for real.
   */
  async hybridSearch(
    query: string,
    domain: string = 'metaKnyts',
    limit: number = 5,
    options?: { cartridgeSlug?: string }
  ): Promise<SimilaritySearchResult[]> {
    if (options?.cartridgeSlug) {
      // Phase 8a — log only. v0.5 will branch here into a cartridge-
      // scoped semanticSearch path. For now, fall through to the
      // domain-scoped lookup so existing chat behaviour is preserved.
      console.log(
        `[embeddingService] cartridgeSlug=${options.cartridgeSlug} requested; ` +
          `falling back to domain-scoped lookup (cartridge KB pipeline lands in v0.5)`
      );
    }

    // Try semantic search first
    const semanticResults = await this.semanticSearch(query, domain, limit);

    if (semanticResults.length >= limit) {
      return semanticResults;
    }

    const keywordResults = await this.keywordSearch(query, domain, limit);
    const seenIds = new Set(semanticResults.map(r => r.chunkId));

    for (const item of keywordResults) {
      if (!seenIds.has(item.chunkId)) {
        semanticResults.push(item);
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
