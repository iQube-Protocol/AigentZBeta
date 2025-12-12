/**
 * Card Variants API
 * 
 * GET /api/drawer/variants - List card variants
 * POST /api/drawer/variants - Register new variant
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  cardVariantRegistry,
  listVariants,
  getVariantById,
  findBestVariant,
  getRecommendedVariants,
} from '@/services/drawer';
import type { NewCardVariantProposal } from '@/types/cardVariant';
import type { Device, Modality } from '@/types/smartDrawer';

export const runtime = 'nodejs';

/**
 * GET /api/drawer/variants
 * 
 * Query params:
 * - id: Get specific variant
 * - modality: Filter by modality
 * - device: Filter by device
 * - useCase: Get recommended for use case
 * - builtin: Filter builtin only (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const modality = searchParams.get('modality') as Modality | null;
    const device = searchParams.get('device') as Device | null;
    const useCase = searchParams.get('useCase');
    const builtinOnly = searchParams.get('builtin') === 'true';

    // Get by ID
    if (id) {
      const variant = getVariantById(id);
      if (!variant) {
        return NextResponse.json(
          { error: 'Variant not found', id },
          { status: 404 }
        );
      }
      return NextResponse.json({ variant });
    }

    // Get recommended for use case
    if (useCase && device) {
      const recommended = getRecommendedVariants(useCase as any, device);
      return NextResponse.json({
        variants: recommended,
        count: recommended.length,
        useCase,
        device,
      });
    }

    // Find best match
    if (modality && device) {
      const result = findBestVariant({ modality, device });
      return NextResponse.json({
        bestMatch: result?.variant ?? null,
        score: result?.score ?? 0,
        modality,
        device,
      });
    }

    // List all
    let variants = listVariants();

    // Filter by builtin
    if (builtinOnly) {
      variants = variants.filter((v) => v.isBuiltin);
    }

    // Filter by modality
    if (modality) {
      variants = variants.filter((v) => v.recommendedModality.includes(modality));
    }

    // Filter by device
    if (device) {
      variants = variants.filter((v) => v.recommendedDevices.includes(device));
    }

    return NextResponse.json({
      variants,
      count: variants.length,
    });
  } catch (error) {
    console.error('[Variants API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/drawer/variants
 * 
 * Body: NewCardVariantProposal
 * 
 * Registers a new card variant (from Copilot proposal).
 */
export async function POST(request: NextRequest) {
  try {
    const body: NewCardVariantProposal = await request.json();

    // Validate required fields
    if (!body.id || !body.label || !body.group) {
      return NextResponse.json(
        { error: 'Missing required fields: id, label, group' },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = getVariantById(body.id);
    if (existing) {
      return NextResponse.json(
        { error: 'Variant already exists', id: body.id },
        { status: 409 }
      );
    }

    // Register
    const registered = cardVariantRegistry.registerVariant(body);

    return NextResponse.json({
      variant: registered,
      message: 'Variant registered successfully',
    });
  } catch (error) {
    console.error('[Variants API] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
