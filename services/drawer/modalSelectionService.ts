/**
 * ModalSelectionService
 * 
 * Copilot-driven modal selection for drawer slots.
 * Uses the CardVariantRegistry to find the best variant for a given context,
 * or proposes new variants when existing ones don't fit.
 */

import type {
  ModalSelectionContext,
  ModalDecision,
  NewCardVariantProposal,
  CardVariantDefinition,
  ModalUseCase,
} from '@/types/cardVariant';
import type { Device, Modality } from '@/types/smartDrawer';
import {
  cardVariantRegistry,
  findBestVariant,
  findClosestBase,
  BUILTIN_CARD_VARIANTS,
} from './cardVariantRegistry';

// =============================================================================
// TYPES
// =============================================================================

/** Selection result with reasoning */
export interface ModalSelectionResult {
  /** The decision made */
  decision: ModalDecision;
  
  /** Selected variant definition (if existing) */
  variant?: CardVariantDefinition;
  
  /** Reasoning trace for debugging */
  reasoning: string[];
  
  /** Time taken (ms) */
  processingTimeMs: number;
}

/** Batch selection request */
export interface BatchSelectionRequest {
  contexts: ModalSelectionContext[];
}

/** Batch selection result */
export interface BatchSelectionResult {
  results: Map<string, ModalSelectionResult>;
  totalTimeMs: number;
}

// =============================================================================
// MODAL SELECTION SERVICE CLASS
// =============================================================================

class ModalSelectionService {
  // ---------------------------------------------------------------------------
  // MAIN SELECTION
  // ---------------------------------------------------------------------------

  /**
   * Select the best modal for a given context
   */
  async selectModal(ctx: ModalSelectionContext): Promise<ModalSelectionResult> {
    const startTime = Date.now();
    const reasoning: string[] = [];

    reasoning.push(`Starting modal selection for ${ctx.drawerId}/${ctx.tabId}`);
    reasoning.push(`Context: device=${ctx.device}, modality=${ctx.modality}, useCase=${ctx.useCase}`);

    // Step 1: Check if content has a preferred modal
    if (ctx.contentQube?.layoutHints?.preferredModal) {
      const preferredId = ctx.contentQube.layoutHints.preferredModal;
      const variant = cardVariantRegistry.getVariantById(preferredId);
      
      if (variant) {
        reasoning.push(`Content has preferred modal: ${preferredId}`);
        reasoning.push(`Using content preference (high confidence)`);
        
        return {
          decision: {
            mode: 'existing',
            variantId: preferredId,
            confidence: 0.95,
            reasons: [`Content explicitly prefers ${preferredId}`],
          },
          variant,
          reasoning,
          processingTimeMs: Date.now() - startTime,
        };
      } else {
        reasoning.push(`Content preferred modal ${preferredId} not found in registry`);
      }
    }

    // Step 2: Use registry scoring to find best match
    const searchResult = findBestVariant({
      modality: ctx.modality,
      device: ctx.device,
      useCase: ctx.useCase,
      contentHints: ctx.contentQube?.layoutHints,
    });

    if (searchResult && searchResult.score >= 50) {
      reasoning.push(`Found matching variant: ${searchResult.variant.id} (score: ${searchResult.score})`);
      
      const confidence = Math.min(searchResult.score / 100, 0.95);
      
      return {
        decision: {
          mode: 'existing',
          variantId: searchResult.variant.id,
          confidence,
          reasons: [
            `Best match for ${ctx.modality}/${ctx.device}`,
            `Score: ${searchResult.score}/100`,
          ],
        },
        variant: searchResult.variant,
        reasoning,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Step 3: For dynamic drawers, consider proposing a new variant
    if (ctx.isDynamicDrawer && searchResult && searchResult.score < 50) {
      reasoning.push(`Low match score (${searchResult?.score ?? 0}), considering new variant proposal`);
      
      const proposal = this.generateVariantProposal(ctx);
      
      if (proposal) {
        reasoning.push(`Generated proposal: ${proposal.id}`);
        
        return {
          decision: {
            mode: 'proposal',
            proposal,
            confidence: 0.6,
            reasons: [
              'No existing variant matches well',
              `Proposing new variant based on ${proposal.baseVariantHint}`,
            ],
          },
          reasoning,
          processingTimeMs: Date.now() - startTime,
        };
      }
    }

    // Step 4: Fallback to best available or standard
    const fallbackVariant = searchResult?.variant ?? cardVariantRegistry.getVariantById('standard');
    reasoning.push(`Using fallback variant: ${fallbackVariant?.id ?? 'standard'}`);

    return {
      decision: {
        mode: 'existing',
        variantId: fallbackVariant?.id ?? 'standard',
        confidence: 0.4,
        reasons: ['Fallback selection', 'No strong match found'],
      },
      variant: fallbackVariant,
      reasoning,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Select modals for multiple contexts in batch
   */
  async selectModalsBatch(request: BatchSelectionRequest): Promise<BatchSelectionResult> {
    const startTime = Date.now();
    const results = new Map<string, ModalSelectionResult>();

    // Process in parallel
    const promises = request.contexts.map(async (ctx) => {
      const key = `${ctx.drawerId}/${ctx.tabId}`;
      const result = await this.selectModal(ctx);
      return { key, result };
    });

    const settled = await Promise.all(promises);
    
    for (const { key, result } of settled) {
      results.set(key, result);
    }

    return {
      results,
      totalTimeMs: Date.now() - startTime,
    };
  }

  // ---------------------------------------------------------------------------
  // VARIANT PROPOSAL GENERATION
  // ---------------------------------------------------------------------------

  /**
   * Generate a new variant proposal based on context
   */
  generateVariantProposal(ctx: ModalSelectionContext): NewCardVariantProposal | null {
    // Find closest base variant
    const baseVariant = findClosestBase({
      modality: ctx.modality,
      device: ctx.device,
      useCase: ctx.useCase,
    });

    // Generate a unique ID based on context
    const idParts: string[] = [];
    
    if (ctx.device === 'mobile') {
      idParts.push('mobile');
    }
    
    idParts.push(ctx.useCase);
    
    if (ctx.userPromptSummary) {
      // Extract key terms from prompt
      const terms = this.extractKeyTerms(ctx.userPromptSummary);
      if (terms.length > 0) {
        idParts.push(terms[0]);
      }
    }

    const proposedId = this.toCamelCase(idParts.join('-'));

    // Check if this ID already exists
    if (cardVariantRegistry.getVariantById(proposedId)) {
      return null; // Already exists, don't propose
    }

    // Determine group
    const group = ctx.device === 'mobile' ? 'mobile' : 
                  ctx.device === 'tv' ? 'desktop' : 'shared';

    // Determine density based on use case
    const density = this.inferDensity(ctx.useCase);

    // Build proposal
    const proposal: NewCardVariantProposal = {
      id: proposedId,
      label: this.toTitleCase(proposedId),
      description: `Auto-generated variant for ${ctx.useCase} on ${ctx.device}`,
      group,
      recommendedModality: [ctx.modality],
      recommendedDevices: [ctx.device],
      density,
      baseVariantHint: baseVariant,
      supportsAgents: ctx.useCase === 'agent' || ctx.useCase === 'codex',
      supportsTasks: ctx.useCase === 'tasks' || ctx.useCase === 'wallet',
      supportsPricing: ctx.useCase === 'wallet' || ctx.useCase === 'hero',
    };

    return proposal;
  }

  // ---------------------------------------------------------------------------
  // USE CASE ANALYSIS
  // ---------------------------------------------------------------------------

  /**
   * Infer use case from context
   */
  inferUseCase(ctx: Partial<ModalSelectionContext>): ModalUseCase {
    // Check explicit use case
    if (ctx.useCase) {
      return ctx.useCase;
    }

    // Infer from drawer/tab IDs
    const combined = `${ctx.drawerId ?? ''} ${ctx.tabId ?? ''}`.toLowerCase();

    if (combined.includes('wallet') || combined.includes('balance')) {
      return 'wallet';
    }
    if (combined.includes('task') || combined.includes('quest') || combined.includes('reward')) {
      return 'tasks';
    }
    if (combined.includes('agent') || combined.includes('copilot') || combined.includes('chat')) {
      return 'agent';
    }
    if (combined.includes('codex') || combined.includes('lore') || combined.includes('explore')) {
      return 'codex';
    }
    if (combined.includes('hero') || combined.includes('featured') || combined.includes('summary')) {
      return 'hero';
    }
    if (combined.includes('grid') || combined.includes('browse') || combined.includes('list')) {
      return 'grid';
    }
    if (combined.includes('thumb') || combined.includes('thumbnail')) {
      return 'thumbnails';
    }

    // Default based on modality
    if (ctx.modality === 'watch') {
      return 'hero';
    }
    if (ctx.modality === 'interact') {
      return 'agent';
    }

    return 'custom';
  }

  /**
   * Get recommended variants for a use case
   */
  getRecommendedVariants(
    useCase: ModalUseCase,
    device: Device,
    limit: number = 5
  ): CardVariantDefinition[] {
    const variants = cardVariantRegistry.getVariantsForUseCase(useCase);
    
    // Filter by device
    const deviceFiltered = variants.filter((v) =>
      v.recommendedDevices.includes(device) || v.group === 'shared'
    );

    // Sort by relevance (implemented variants first, then by group match)
    deviceFiltered.sort((a, b) => {
      // Prefer implemented
      if (a.componentImplemented && !b.componentImplemented) return -1;
      if (!a.componentImplemented && b.componentImplemented) return 1;
      
      // Prefer exact device group match
      const aGroupMatch = (device === 'mobile' && a.group === 'mobile') ||
                          (device !== 'mobile' && a.group === 'desktop');
      const bGroupMatch = (device === 'mobile' && b.group === 'mobile') ||
                          (device !== 'mobile' && b.group === 'desktop');
      
      if (aGroupMatch && !bGroupMatch) return -1;
      if (!aGroupMatch && bGroupMatch) return 1;
      
      return 0;
    });

    return deviceFiltered.slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private extractKeyTerms(text: string): string[] {
    // Simple term extraction - could be enhanced with NLP
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
      'show', 'display', 'create', 'make', 'want', 'like', 'use',
    ]);

    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    return words.slice(0, 3);
  }

  private inferDensity(useCase: ModalUseCase): 'single' | 'grid-2' | 'grid-3' | 'grid-4' | 'list' {
    switch (useCase) {
      case 'hero':
        return 'single';
      case 'grid':
        return 'grid-3';
      case 'thumbnails':
        return 'grid-4';
      case 'tasks':
      case 'wallet':
        return 'list';
      case 'agent':
      case 'codex':
        return 'single';
      default:
        return 'grid-3';
    }
  }

  private toCamelCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map((word, i) => 
        i === 0 
          ? word.toLowerCase() 
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
  }

  private toTitleCase(str: string): string {
    return str
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const modalSelectionService = new ModalSelectionService();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export async function selectModal(ctx: ModalSelectionContext): Promise<ModalSelectionResult> {
  return modalSelectionService.selectModal(ctx);
}

export async function selectModalsBatch(
  contexts: ModalSelectionContext[]
): Promise<BatchSelectionResult> {
  return modalSelectionService.selectModalsBatch({ contexts });
}

export function inferUseCase(ctx: Partial<ModalSelectionContext>): ModalUseCase {
  return modalSelectionService.inferUseCase(ctx);
}

export function getRecommendedVariants(
  useCase: ModalUseCase,
  device: Device,
  limit?: number
): CardVariantDefinition[] {
  return modalSelectionService.getRecommendedVariants(useCase, device, limit);
}
