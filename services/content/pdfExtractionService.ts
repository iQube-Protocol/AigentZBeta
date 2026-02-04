/**
 * PDF Extraction Service
 * 
 * Extracts text content from PDF files for the Codex Knowledge Base.
 * Supports both local files and remote URLs (including Autonomys CIDs).
 * 
 * Features:
 * - Text extraction with page-level granularity
 * - Intelligent chunking for RAG/LLM consumption
 * - Metadata extraction (page count, word count)
 * - Character/entity detection for cross-referencing
 */

import pdfParse from 'pdf-parse';

// ============================================================================
// Types
// ============================================================================

export interface PDFExtractionResult {
  success: boolean;
  error?: string;
  
  // Document metadata
  metadata: {
    pageCount: number;
    wordCount: number;
    title?: string;
    author?: string;
    creationDate?: string;
  };
  
  // Full text content
  fullText: string;
  
  // Page-by-page content
  pages: PDFPage[];
  
  // Chunked content for RAG
  chunks: TextChunk[];
}

export interface PDFPage {
  pageNumber: number;
  text: string;
  wordCount: number;
}

export interface TextChunk {
  index: number;
  content: string;
  pageNumber?: number;
  wordCount: number;
  tokenEstimate: number; // Rough estimate: words * 1.3
  chunkType: 'text' | 'heading' | 'dialogue' | 'caption';
}

export interface ChunkingOptions {
  maxChunkSize: number; // Max words per chunk
  overlapSize: number; // Words to overlap between chunks
  preserveParagraphs: boolean; // Try to keep paragraphs together
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  maxChunkSize: 500, // ~650 tokens, good for context windows
  overlapSize: 50, // Some overlap for context continuity
  preserveParagraphs: true,
};

// Known character names for entity detection (metaKnyts)
const KNOWN_CHARACTERS = [
  'Kn0w1', 'Know One', 'MoneyPenny', 'Money Penny',
  'Satoshi', 'Nakamoto', 'Hal', 'Finney',
  'DigiTerra', 'Terra', 'MetaKnyt', 'KNYT',
  // Add more as needed
];

// ============================================================================
// PDF Extraction Service
// ============================================================================

class PDFExtractionService {
  private chunkingOptions: ChunkingOptions;

  constructor(options?: Partial<ChunkingOptions>) {
    this.chunkingOptions = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
  }

  /**
   * Extract text content from a PDF buffer
   */
  async extractFromBuffer(buffer: Buffer, filename?: string): Promise<PDFExtractionResult> {
    try {
      const data = await pdfParse(buffer);
      
      // Parse pages (pdf-parse gives us full text, we need to split by page markers)
      const pages = this.parsePages(data.text, data.numpages);
      
      // Calculate word count
      const wordCount = this.countWords(data.text);
      
      // Create chunks for RAG
      const chunks = this.createChunks(pages);
      
      return {
        success: true,
        metadata: {
          pageCount: data.numpages,
          wordCount,
          title: data.info?.Title || filename,
          author: data.info?.Author,
          creationDate: data.info?.CreationDate,
        },
        fullText: data.text,
        pages,
        chunks,
      };
    } catch (error) {
      console.error('[PDFExtraction] Error extracting PDF:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during PDF extraction',
        metadata: { pageCount: 0, wordCount: 0 },
        fullText: '',
        pages: [],
        chunks: [],
      };
    }
  }

  /**
   * Extract text from a PDF URL (including Autonomys CIDs)
   */
  async extractFromUrl(url: string): Promise<PDFExtractionResult> {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: HTTP ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Extract filename from URL if possible
      const filename = url.split('/').pop()?.split('?')[0];
      
      return this.extractFromBuffer(buffer, filename);
    } catch (error) {
      console.error('[PDFExtraction] Error fetching PDF from URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch PDF',
        metadata: { pageCount: 0, wordCount: 0 },
        fullText: '',
        pages: [],
        chunks: [],
      };
    }
  }

  /**
   * Extract from Autonomys CID via the content API
   */
  async extractFromCid(cid: string, apiBaseUrl: string = ''): Promise<PDFExtractionResult> {
    const url = `${apiBaseUrl}/api/content/pdf/${cid}`;
    return this.extractFromUrl(url);
  }

  /**
   * Parse text into pages
   * Note: pdf-parse doesn't provide clean page breaks, so we estimate
   */
  private parsePages(fullText: string, pageCount: number): PDFPage[] {
    // If only one page, return as-is
    if (pageCount === 1) {
      return [{
        pageNumber: 1,
        text: fullText.trim(),
        wordCount: this.countWords(fullText),
      }];
    }

    // Try to split by common page break patterns
    // pdf-parse sometimes includes form feed characters or page markers
    const pageBreakPatterns = [
      /\f/g, // Form feed
      /\n{3,}/g, // Multiple newlines
      /Page \d+/gi, // "Page X" markers
    ];

    let pages: string[] = [fullText];
    
    // Try form feed first (most reliable)
    if (fullText.includes('\f')) {
      pages = fullText.split('\f').filter(p => p.trim());
    }
    
    // If we got roughly the right number of pages, use them
    if (Math.abs(pages.length - pageCount) <= 1) {
      return pages.map((text, i) => ({
        pageNumber: i + 1,
        text: text.trim(),
        wordCount: this.countWords(text),
      }));
    }

    // Otherwise, split evenly by character count (rough approximation)
    const avgCharsPerPage = Math.ceil(fullText.length / pageCount);
    pages = [];
    
    for (let i = 0; i < pageCount; i++) {
      const start = i * avgCharsPerPage;
      const end = Math.min((i + 1) * avgCharsPerPage, fullText.length);
      
      // Try to break at a paragraph boundary
      let breakPoint = end;
      if (end < fullText.length) {
        const nextParagraph = fullText.indexOf('\n\n', end - 100);
        if (nextParagraph !== -1 && nextParagraph < end + 100) {
          breakPoint = nextParagraph;
        }
      }
      
      const pageText = fullText.slice(start, breakPoint).trim();
      if (pageText) {
        pages.push(pageText);
      }
    }

    return pages.map((text, i) => ({
      pageNumber: i + 1,
      text,
      wordCount: this.countWords(text),
    }));
  }

  /**
   * Create chunks for RAG/LLM consumption
   */
  private createChunks(pages: PDFPage[]): TextChunk[] {
    const chunks: TextChunk[] = [];
    let chunkIndex = 0;

    for (const page of pages) {
      const pageChunks = this.chunkText(page.text, page.pageNumber);
      
      for (const chunk of pageChunks) {
        chunks.push({
          ...chunk,
          index: chunkIndex++,
        });
      }
    }

    return chunks;
  }

  /**
   * Split text into chunks with overlap
   */
  private chunkText(text: string, pageNumber?: number): Omit<TextChunk, 'index'>[] {
    const { maxChunkSize, overlapSize, preserveParagraphs } = this.chunkingOptions;
    const chunks: Omit<TextChunk, 'index'>[] = [];

    if (!text.trim()) {
      return chunks;
    }

    // Split into paragraphs
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    
    let currentChunk = '';
    let currentWordCount = 0;

    for (const paragraph of paragraphs) {
      const paragraphWords = this.countWords(paragraph);
      
      // If single paragraph exceeds max, split it
      if (paragraphWords > maxChunkSize) {
        // Flush current chunk first
        if (currentChunk.trim()) {
          chunks.push(this.createChunkObject(currentChunk, pageNumber));
        }
        
        // Split large paragraph into sentences
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        currentChunk = '';
        currentWordCount = 0;
        
        for (const sentence of sentences) {
          const sentenceWords = this.countWords(sentence);
          
          if (currentWordCount + sentenceWords > maxChunkSize && currentChunk.trim()) {
            chunks.push(this.createChunkObject(currentChunk, pageNumber));
            
            // Start new chunk with overlap
            const words = currentChunk.split(/\s+/);
            const overlapText = words.slice(-overlapSize).join(' ');
            currentChunk = overlapText + ' ' + sentence;
            currentWordCount = overlapSize + sentenceWords;
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
            currentWordCount += sentenceWords;
          }
        }
        continue;
      }

      // Check if adding this paragraph exceeds max
      if (currentWordCount + paragraphWords > maxChunkSize && currentChunk.trim()) {
        chunks.push(this.createChunkObject(currentChunk, pageNumber));
        
        // Start new chunk with overlap if preserving paragraphs
        if (preserveParagraphs && overlapSize > 0) {
          const words = currentChunk.split(/\s+/);
          const overlapText = words.slice(-Math.min(overlapSize, words.length)).join(' ');
          currentChunk = overlapText + '\n\n' + paragraph;
          currentWordCount = Math.min(overlapSize, words.length) + paragraphWords;
        } else {
          currentChunk = paragraph;
          currentWordCount = paragraphWords;
        }
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        currentWordCount += paragraphWords;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push(this.createChunkObject(currentChunk, pageNumber));
    }

    return chunks;
  }

  /**
   * Create a chunk object with metadata
   */
  private createChunkObject(content: string, pageNumber?: number): Omit<TextChunk, 'index'> {
    const wordCount = this.countWords(content);
    const chunkType = this.detectChunkType(content);
    
    return {
      content: content.trim(),
      pageNumber,
      wordCount,
      tokenEstimate: Math.ceil(wordCount * 1.3), // Rough token estimate
      chunkType,
    };
  }

  /**
   * Detect the type of content in a chunk
   */
  private detectChunkType(text: string): TextChunk['chunkType'] {
    const trimmed = text.trim();
    
    // Check for heading patterns
    if (/^(Chapter|Section|Part|\d+\.)\s/i.test(trimmed) || 
        (trimmed.length < 100 && /^[A-Z][A-Z\s]+$/.test(trimmed))) {
      return 'heading';
    }
    
    // Check for dialogue patterns
    if (/^["']/.test(trimmed) || /said|asked|replied|whispered/i.test(trimmed)) {
      return 'dialogue';
    }
    
    // Check for caption patterns (short, descriptive)
    if (trimmed.length < 50 && /^(Figure|Image|Photo|Illustration)/i.test(trimmed)) {
      return 'caption';
    }
    
    return 'text';
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  /**
   * Detect character mentions in text
   */
  detectCharacterMentions(text: string): string[] {
    const mentions: Set<string> = new Set();
    const lowerText = text.toLowerCase();
    
    for (const character of KNOWN_CHARACTERS) {
      if (lowerText.includes(character.toLowerCase())) {
        mentions.add(character);
      }
    }
    
    return Array.from(mentions);
  }

  /**
   * Extract potential entity names using simple heuristics
   */
  extractPotentialEntities(text: string): { name: string; type: string }[] {
    const entities: { name: string; type: string }[] = [];
    
    // Find capitalized phrases (potential proper nouns)
    const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    const matches = text.matchAll(capitalizedPattern);
    
    const seen = new Set<string>();
    for (const match of matches) {
      const name = match[1];
      if (!seen.has(name) && name.length > 2) {
        seen.add(name);
        
        // Simple type detection
        let type = 'unknown';
        if (KNOWN_CHARACTERS.some(c => c.toLowerCase() === name.toLowerCase())) {
          type = 'character';
        } else if (/^(The\s+)?[A-Z][a-z]+\s+(City|Kingdom|Land|World|Realm)/i.test(name)) {
          type = 'location';
        } else if (/^(The\s+)?[A-Z][a-z]+\s+(Order|Guild|Council|Alliance)/i.test(name)) {
          type = 'organization';
        }
        
        entities.push({ name, type });
      }
    }
    
    return entities;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let serviceInstance: PDFExtractionService | null = null;

export function getPDFExtractionService(options?: Partial<ChunkingOptions>): PDFExtractionService {
  if (!serviceInstance) {
    serviceInstance = new PDFExtractionService(options);
  }
  return serviceInstance;
}

export { PDFExtractionService };
