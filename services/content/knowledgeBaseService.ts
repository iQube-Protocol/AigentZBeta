/**
 * Knowledge Base Service
 * 
 * Manages the Codex Knowledge Base for both metaKnyts and Qriptopian domains.
 * Handles document registration, chunk storage, entity tracking, and retrieval.
 * 
 * Integrates with:
 * - PDF Extraction Service for content extraction
 * - Supabase for persistent storage
 * - OpenAI for embeddings (future)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getPDFExtractionService, type PDFExtractionResult, type TextChunk } from './pdfExtractionService';

// ============================================================================
// Types
// ============================================================================

export type ContentDomain = 'metaKnyts' | 'qriptopian';
export type DocumentSourceType = 'pdf' | 'episode' | 'character' | 'lore' | 'article';
export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type EntityType = 'character' | 'location' | 'organization' | 'concept' | 'item';

export interface KBDocument {
  id: string;
  source_type: DocumentSourceType;
  source_id?: string;
  source_cid?: string;
  title: string;
  domain: ContentDomain;
  series?: string;
  episode_number?: number;
  content_category?: string;
  tags: string[];
  extraction_status: ExtractionStatus;
  extraction_error?: string;
  extracted_at?: string;
  page_count?: number;
  word_count?: number;
  chunk_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KBChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  page_number?: number;
  section_title?: string;
  chunk_type: string;
  character_refs: string[];
  location_refs: string[];
  word_count?: number;
  token_count?: number;
  created_at: string;
}

export interface KBEntity {
  id: string;
  name: string;
  entity_type: EntityType;
  domain: ContentDomain;
  canonical_id?: string;
  aliases: string[];
  description?: string;
  mention_count: number;
  document_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentRegistration {
  sourceType: DocumentSourceType;
  sourceId?: string;
  sourceCid?: string;
  title: string;
  domain: ContentDomain;
  series?: string;
  episodeNumber?: number;
  contentCategory?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  domain?: ContentDomain;
  series?: string;
  contentCategory?: string;
  entityType?: EntityType;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  chunks: KBChunk[];
  documents: KBDocument[];
  totalCount: number;
}

// ============================================================================
// Knowledge Base Service
// ============================================================================

class KnowledgeBaseService {
  private supabase: SupabaseClient;
  private pdfService = getPDFExtractionService();

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // ==========================================================================
  // Document Management
  // ==========================================================================

  /**
   * Register a new document in the knowledge base
   */
  async registerDocument(registration: DocumentRegistration): Promise<KBDocument | null> {
    try {
      const { data, error } = await this.supabase
        .from('codex_kb_documents')
        .insert({
          source_type: registration.sourceType,
          source_id: registration.sourceId,
          source_cid: registration.sourceCid,
          title: registration.title,
          domain: registration.domain,
          series: registration.series,
          episode_number: registration.episodeNumber,
          content_category: registration.contentCategory,
          tags: registration.tags || [],
          metadata: registration.metadata || {},
          extraction_status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.error('[KnowledgeBase] Error registering document:', error);
        return null;
      }

      return data as KBDocument;
    } catch (error) {
      console.error('[KnowledgeBase] Error registering document:', error);
      return null;
    }
  }

  /**
   * Get a document by ID
   */
  async getDocument(documentId: string): Promise<KBDocument | null> {
    const { data, error } = await this.supabase
      .from('codex_kb_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      console.error('[KnowledgeBase] Error fetching document:', error);
      return null;
    }

    return data as KBDocument;
  }

  /**
   * Get document by source CID
   */
  async getDocumentByCid(cid: string): Promise<KBDocument | null> {
    const { data, error } = await this.supabase
      .from('codex_kb_documents')
      .select('*')
      .eq('source_cid', cid)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is ok
      console.error('[KnowledgeBase] Error fetching document by CID:', error);
    }

    return data as KBDocument | null;
  }

  /**
   * List documents with optional filters
   */
  async listDocuments(options: SearchOptions = {}): Promise<KBDocument[]> {
    let query = this.supabase
      .from('codex_kb_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (options.domain) {
      query = query.eq('domain', options.domain);
    }
    if (options.series) {
      query = query.eq('series', options.series);
    }
    if (options.contentCategory) {
      query = query.eq('content_category', options.contentCategory);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[KnowledgeBase] Error listing documents:', error);
      return [];
    }

    return data as KBDocument[];
  }

  /**
   * Update document status
   */
  async updateDocumentStatus(
    documentId: string,
    status: ExtractionStatus,
    error?: string,
    stats?: { pageCount?: number; wordCount?: number; chunkCount?: number }
  ): Promise<boolean> {
    const updateData: Record<string, unknown> = {
      extraction_status: status,
      extraction_error: error || null,
    };

    if (status === 'completed') {
      updateData.extracted_at = new Date().toISOString();
    }

    if (stats) {
      if (stats.pageCount !== undefined) updateData.page_count = stats.pageCount;
      if (stats.wordCount !== undefined) updateData.word_count = stats.wordCount;
      if (stats.chunkCount !== undefined) updateData.chunk_count = stats.chunkCount;
    }

    const { error: updateError } = await this.supabase
      .from('codex_kb_documents')
      .update(updateData)
      .eq('id', documentId);

    if (updateError) {
      console.error('[KnowledgeBase] Error updating document status:', updateError);
      return false;
    }

    return true;
  }

  // ==========================================================================
  // PDF Processing
  // ==========================================================================

  /**
   * Process a PDF and store its content in the knowledge base
   */
  async processPdfFromCid(
    cid: string,
    registration: Omit<DocumentRegistration, 'sourceCid' | 'sourceType'>,
    apiBaseUrl: string = ''
  ): Promise<{ success: boolean; documentId?: string; error?: string }> {
    // Check if already processed
    const existing = await this.getDocumentByCid(cid);
    if (existing && existing.extraction_status === 'completed') {
      return { success: true, documentId: existing.id };
    }

    // Register or get existing document
    let document: KBDocument | null = existing;
    if (!document) {
      document = await this.registerDocument({
        ...registration,
        sourceType: 'pdf',
        sourceCid: cid,
      });
    }

    if (!document) {
      return { success: false, error: 'Failed to register document' };
    }

    // Update status to processing
    await this.updateDocumentStatus(document.id, 'processing');

    try {
      // Extract PDF content
      const extraction = await this.pdfService.extractFromCid(cid, apiBaseUrl);

      if (!extraction.success) {
        await this.updateDocumentStatus(document.id, 'failed', extraction.error);
        return { success: false, documentId: document.id, error: extraction.error };
      }

      // Store chunks
      const chunksStored = await this.storeChunks(document.id, extraction.chunks);

      if (!chunksStored) {
        await this.updateDocumentStatus(document.id, 'failed', 'Failed to store chunks');
        return { success: false, documentId: document.id, error: 'Failed to store chunks' };
      }

      // Extract and store entities
      await this.extractAndStoreEntities(document.id, extraction, registration.domain);

      // Update document with stats
      await this.updateDocumentStatus(document.id, 'completed', undefined, {
        pageCount: extraction.metadata.pageCount,
        wordCount: extraction.metadata.wordCount,
        chunkCount: extraction.chunks.length,
      });

      console.log(`[KnowledgeBase] Successfully processed PDF: ${registration.title} (${extraction.chunks.length} chunks)`);

      return { success: true, documentId: document.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateDocumentStatus(document.id, 'failed', errorMessage);
      return { success: false, documentId: document.id, error: errorMessage };
    }
  }

  /**
   * Get a document by its source_id (idempotency for non-CID sources like
   * markdown commentary documents keyed by a stable paper id).
   */
  async getDocumentBySourceId(sourceId: string): Promise<KBDocument | null> {
    const { data } = await this.supabase
      .from('codex_kb_documents')
      .select('*')
      .eq('source_id', sourceId)
      .maybeSingle();
    return (data as KBDocument | null) ?? null;
  }

  /**
   * Delete a document and its chunks (used to re-ingest a markdown document
   * idempotently by source_id).
   */
  async deleteDocument(documentId: string): Promise<void> {
    await this.supabase.from('codex_kb_chunks').delete().eq('document_id', documentId);
    await this.supabase.from('codex_kb_documents').delete().eq('id', documentId);
  }

  /**
   * Ingest already-extracted plain text (e.g. a markdown commentary document)
   * into the knowledge base: register the document, chunk the text, and store
   * the chunks. Embeddings are generated separately by
   * EmbeddingService.processUnembeddedChunks(). Re-ingests idempotently when a
   * document with the same source_id already exists.
   */
  async ingestTextDocument(
    text: string,
    registration: Omit<DocumentRegistration, 'sourceType'> & { sourceType?: DocumentSourceType },
  ): Promise<{ success: boolean; documentId?: string; chunkCount?: number; error?: string }> {
    if (!text.trim()) return { success: false, error: 'empty text' };

    // Idempotency — drop any prior document for this source_id first.
    if (registration.sourceId) {
      const existing = await this.getDocumentBySourceId(registration.sourceId);
      if (existing) await this.deleteDocument(existing.id);
    }

    const document = await this.registerDocument({
      ...registration,
      sourceType: registration.sourceType ?? 'article',
    });
    if (!document) return { success: false, error: 'Failed to register document' };

    await this.updateDocumentStatus(document.id, 'processing');
    try {
      const chunks = this.pdfService.chunkPlainText(text);
      const stored = await this.storeChunks(document.id, chunks);
      if (!stored) {
        await this.updateDocumentStatus(document.id, 'failed', 'Failed to store chunks');
        return { success: false, documentId: document.id, error: 'Failed to store chunks' };
      }
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      await this.updateDocumentStatus(document.id, 'completed', undefined, {
        wordCount,
        chunkCount: chunks.length,
      });
      return { success: true, documentId: document.id, chunkCount: chunks.length };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      await this.updateDocumentStatus(document.id, 'failed', msg);
      return { success: false, documentId: document.id, error: msg };
    }
  }

  /**
   * Process a PDF from a buffer
   */
  async processPdfFromBuffer(
    buffer: Buffer,
    registration: Omit<DocumentRegistration, 'sourceType'>,
  ): Promise<{ success: boolean; documentId?: string; error?: string }> {
    // Register document
    const document = await this.registerDocument({
      ...registration,
      sourceType: 'pdf',
    });

    if (!document) {
      return { success: false, error: 'Failed to register document' };
    }

    // Update status to processing
    await this.updateDocumentStatus(document.id, 'processing');

    try {
      // Extract PDF content
      const extraction = await this.pdfService.extractFromBuffer(buffer, registration.title);

      if (!extraction.success) {
        await this.updateDocumentStatus(document.id, 'failed', extraction.error);
        return { success: false, documentId: document.id, error: extraction.error };
      }

      // Store chunks
      const chunksStored = await this.storeChunks(document.id, extraction.chunks);

      if (!chunksStored) {
        await this.updateDocumentStatus(document.id, 'failed', 'Failed to store chunks');
        return { success: false, documentId: document.id, error: 'Failed to store chunks' };
      }

      // Extract and store entities
      await this.extractAndStoreEntities(document.id, extraction, registration.domain);

      // Update document with stats
      await this.updateDocumentStatus(document.id, 'completed', undefined, {
        pageCount: extraction.metadata.pageCount,
        wordCount: extraction.metadata.wordCount,
        chunkCount: extraction.chunks.length,
      });

      return { success: true, documentId: document.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateDocumentStatus(document.id, 'failed', errorMessage);
      return { success: false, documentId: document.id, error: errorMessage };
    }
  }

  // ==========================================================================
  // Chunk Management
  // ==========================================================================

  /**
   * Store chunks for a document
   */
  private async storeChunks(documentId: string, chunks: TextChunk[]): Promise<boolean> {
    if (chunks.length === 0) {
      return true;
    }

    const chunkRecords = chunks.map(chunk => ({
      document_id: documentId,
      content: chunk.content,
      chunk_index: chunk.index,
      page_number: chunk.pageNumber,
      chunk_type: chunk.chunkType,
      character_refs: this.pdfService.detectCharacterMentions(chunk.content),
      location_refs: [],
      word_count: chunk.wordCount,
      token_count: chunk.tokenEstimate,
    }));

    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < chunkRecords.length; i += batchSize) {
      const batch = chunkRecords.slice(i, i + batchSize);
      const { error } = await this.supabase
        .from('codex_kb_chunks')
        .insert(batch);

      if (error) {
        console.error('[KnowledgeBase] Error storing chunks:', error);
        return false;
      }
    }

    return true;
  }

  /**
   * Get chunks for a document
   */
  async getDocumentChunks(documentId: string): Promise<KBChunk[]> {
    const { data, error } = await this.supabase
      .from('codex_kb_chunks')
      .select('*')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });

    if (error) {
      console.error('[KnowledgeBase] Error fetching chunks:', error);
      return [];
    }

    return data as KBChunk[];
  }

  // ==========================================================================
  // Entity Management
  // ==========================================================================

  /**
   * Extract and store entities from extraction result
   */
  private async extractAndStoreEntities(
    documentId: string,
    extraction: PDFExtractionResult,
    domain: ContentDomain
  ): Promise<void> {
    const entities = this.pdfService.extractPotentialEntities(extraction.fullText);
    
    for (const entity of entities) {
      if (entity.type === 'unknown') continue;

      // Upsert entity
      const { data: entityData, error: entityError } = await this.supabase
        .from('codex_kb_entities')
        .upsert({
          name: entity.name,
          entity_type: entity.type,
          domain,
        }, {
          onConflict: 'name,entity_type,domain',
        })
        .select()
        .single();

      if (entityError) {
        console.error('[KnowledgeBase] Error upserting entity:', entityError);
        continue;
      }

      // Update mention count
      await this.supabase
        .from('codex_kb_entities')
        .update({
          mention_count: (entityData.mention_count || 0) + 1,
          document_count: (entityData.document_count || 0) + 1,
        })
        .eq('id', entityData.id);
    }
  }

  /**
   * Get entities by type
   */
  async getEntities(options: SearchOptions = {}): Promise<KBEntity[]> {
    let query = this.supabase
      .from('codex_kb_entities')
      .select('*')
      .order('mention_count', { ascending: false });

    if (options.domain) {
      query = query.eq('domain', options.domain);
    }
    if (options.entityType) {
      query = query.eq('entity_type', options.entityType);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[KnowledgeBase] Error fetching entities:', error);
      return [];
    }

    return data as KBEntity[];
  }

  // ==========================================================================
  // Search & Retrieval
  // ==========================================================================

  /**
   * Search chunks by text (simple keyword search)
   * TODO: Add vector similarity search when embeddings are implemented
   */
  async searchChunks(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const limit = options.limit || 10;
    
    // Build the search query
    let dbQuery = this.supabase
      .from('codex_kb_chunks')
      .select(`
        *,
        document:codex_kb_documents!inner(*)
      `)
      .textSearch('content', query, { type: 'websearch' })
      .limit(limit);

    if (options.domain) {
      dbQuery = dbQuery.eq('document.domain', options.domain);
    }

    const { data, error, count } = await dbQuery;

    if (error) {
      console.error('[KnowledgeBase] Error searching chunks:', error);
      return { chunks: [], documents: [], totalCount: 0 };
    }

    const chunks = data?.map(d => {
      const { document, ...chunk } = d;
      return chunk;
    }) as KBChunk[] || [];

    const documents = data?.map(d => d.document).filter((d, i, arr) => 
      arr.findIndex(x => x.id === d.id) === i
    ) as KBDocument[] || [];

    return {
      chunks,
      documents,
      totalCount: count || chunks.length,
    };
  }

  /**
   * Get relevant chunks for a copilot query
   * Returns chunks most relevant to the query for RAG
   */
  async getRelevantChunks(
    query: string,
    domain: ContentDomain,
    maxChunks: number = 5,
    maxTokens: number = 2000
  ): Promise<KBChunk[]> {
    // For now, use simple text search
    // TODO: Implement vector similarity search
    const result = await this.searchChunks(query, {
      domain,
      limit: maxChunks * 2, // Get extra to filter by tokens
    });

    // Filter to stay within token limit
    const selectedChunks: KBChunk[] = [];
    let totalTokens = 0;

    for (const chunk of result.chunks) {
      const chunkTokens = chunk.token_count || Math.ceil((chunk.word_count || 0) * 1.3);
      if (totalTokens + chunkTokens <= maxTokens) {
        selectedChunks.push(chunk);
        totalTokens += chunkTokens;
      }
      if (selectedChunks.length >= maxChunks) break;
    }

    return selectedChunks;
  }

  // ==========================================================================
  // Batch Processing
  // ==========================================================================

  /**
   * Process all pending PDFs in the knowledge base
   */
  async processPendingDocuments(apiBaseUrl: string = ''): Promise<{ processed: number; failed: number }> {
    const { data: pendingDocs, error } = await this.supabase
      .from('codex_kb_documents')
      .select('*')
      .eq('extraction_status', 'pending')
      .eq('source_type', 'pdf')
      .not('source_cid', 'is', null);

    if (error || !pendingDocs) {
      console.error('[KnowledgeBase] Error fetching pending documents:', error);
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const doc of pendingDocs) {
      const result = await this.processPdfFromCid(
        doc.source_cid,
        {
          title: doc.title,
          domain: doc.domain,
          series: doc.series,
          episodeNumber: doc.episode_number,
          contentCategory: doc.content_category,
          tags: doc.tags,
        },
        apiBaseUrl
      );

      if (result.success) {
        processed++;
      } else {
        failed++;
      }
    }

    return { processed, failed };
  }

  /**
   * Get knowledge base statistics
   */
  async getStats(domain?: ContentDomain): Promise<{
    documentCount: number;
    chunkCount: number;
    entityCount: number;
    pendingCount: number;
  }> {
    let docQuery = this.supabase
      .from('codex_kb_documents')
      .select('*', { count: 'exact', head: true });

    let chunkQuery = this.supabase
      .from('codex_kb_chunks')
      .select('*', { count: 'exact', head: true });

    let entityQuery = this.supabase
      .from('codex_kb_entities')
      .select('*', { count: 'exact', head: true });

    let pendingQuery = this.supabase
      .from('codex_kb_documents')
      .select('*', { count: 'exact', head: true })
      .eq('extraction_status', 'pending');

    if (domain) {
      docQuery = docQuery.eq('domain', domain);
      entityQuery = entityQuery.eq('domain', domain);
      pendingQuery = pendingQuery.eq('domain', domain);
    }

    const [docResult, chunkResult, entityResult, pendingResult] = await Promise.all([
      docQuery,
      chunkQuery,
      entityQuery,
      pendingQuery,
    ]);

    return {
      documentCount: docResult.count || 0,
      chunkCount: chunkResult.count || 0,
      entityCount: entityResult.count || 0,
      pendingCount: pendingResult.count || 0,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let serviceInstance: KnowledgeBaseService | null = null;

export function getKnowledgeBaseService(): KnowledgeBaseService {
  if (!serviceInstance) {
    serviceInstance = new KnowledgeBaseService();
  }
  return serviceInstance;
}

export { KnowledgeBaseService };
