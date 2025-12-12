/**
 * Modal Selection API
 * 
 * POST /api/drawer/modal-select - Copilot-driven modal selection
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  selectModal,
  selectModalsBatch,
  inferUseCase,
  getRecommendedVariants,
} from '@/services/drawer';
import type { ModalSelectionContext } from '@/types/cardVariant';

export const runtime = 'nodejs';

interface SelectRequest {
  /** Single context */
  context?: ModalSelectionContext;
  
  /** Batch contexts */
  contexts?: ModalSelectionContext[];
  
  /** Just infer use case */
  inferOnly?: boolean;
}

/**
 * POST /api/drawer/modal-select
 * 
 * Copilot modal selection endpoint.
 * 
 * Body options:
 * - context: Single ModalSelectionContext for one selection
 * - contexts: Array of contexts for batch selection
 * - inferOnly: If true, just infer use case without full selection
 */
export async function POST(request: NextRequest) {
  try {
    const body: SelectRequest = await request.json();

    // Infer use case only
    if (body.inferOnly && body.context) {
      const useCase = inferUseCase(body.context);
      const recommended = getRecommendedVariants(useCase, body.context.device);
      
      return NextResponse.json({
        useCase,
        recommended: recommended.map((v) => ({
          id: v.id,
          label: v.label,
          density: v.density,
          aspectHint: v.aspectHint,
        })),
        context: {
          drawerId: body.context.drawerId,
          tabId: body.context.tabId,
          device: body.context.device,
          modality: body.context.modality,
        },
      });
    }

    // Single selection
    if (body.context) {
      const result = await selectModal(body.context);
      
      return NextResponse.json({
        decision: result.decision,
        variant: result.variant ? {
          id: result.variant.id,
          label: result.variant.label,
          componentName: result.variant.componentName,
          density: result.variant.density,
          aspectHint: result.variant.aspectHint,
          supportsAgents: result.variant.supportsAgents,
          supportsTasks: result.variant.supportsTasks,
        } : null,
        reasoning: result.reasoning,
        processingTimeMs: result.processingTimeMs,
      });
    }

    // Batch selection
    if (body.contexts && body.contexts.length > 0) {
      const batchResult = await selectModalsBatch(body.contexts);
      
      const results: Record<string, any> = {};
      for (const [key, result] of batchResult.results) {
        results[key] = {
          decision: result.decision,
          variant: result.variant ? {
            id: result.variant.id,
            label: result.variant.label,
            componentName: result.variant.componentName,
          } : null,
          processingTimeMs: result.processingTimeMs,
        };
      }
      
      return NextResponse.json({
        results,
        totalTimeMs: batchResult.totalTimeMs,
        count: body.contexts.length,
      });
    }

    return NextResponse.json(
      { error: 'Missing context or contexts in request body' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Modal Select API] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
