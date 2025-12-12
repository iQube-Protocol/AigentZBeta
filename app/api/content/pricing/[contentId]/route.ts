/**
 * Content Pricing API
 * 
 * GET /api/content/pricing/[contentId] - Get pricing snapshot for content
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSmartContentService, getX402TemplateGenerator } from '@/services/content';

interface RouteParams {
  params: Promise<{ contentId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { contentId } = await params;
    const { searchParams } = new URL(request.url);
    
    const personaId = searchParams.get('personaId') || undefined;
    const includeTemplates = searchParams.get('includeTemplates') === 'true';
    
    const service = getSmartContentService();
    
    // Get pricing snapshot
    const pricingSnapshot = await service.getPricingSnapshot(contentId, personaId);
    
    // Optionally include x402 templates
    let templates = null;
    if (includeTemplates) {
      const content = await service.getById(contentId);
      if (content) {
        const generator = getX402TemplateGenerator();
        templates = generator.generateTemplates(content);
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...pricingSnapshot,
        templates,
      },
    });
  } catch (error: any) {
    console.error('Failed to get pricing:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
