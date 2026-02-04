/**
 * x402 Payment Template API
 * 
 * GET /api/content/pricing/[contentId]/x402 - Get x402 payment templates
 * POST /api/content/pricing/[contentId]/x402 - Generate specific template
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSmartContentService, getX402TemplateGenerator } from '@/services/content';
import type { PricingKind } from '@/types/smartContent';

interface RouteParams {
  params: Promise<{ contentId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { contentId } = await params;
    const { searchParams } = new URL(request.url);
    
    const pricingKind = searchParams.get('kind') as PricingKind | undefined;
    
    const service = getSmartContentService();
    const content = await service.getById(contentId);
    
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Content not found' },
        { status: 404 }
      );
    }
    
    const generator = getX402TemplateGenerator();
    let templates;
    
    if (pricingKind) {
      // Find specific tier
      const tier = content.pricingModel.tiers.find(t => t.kind === pricingKind);
      if (!tier) {
        return NextResponse.json(
          { success: false, error: `No pricing tier found for kind: ${pricingKind}` },
          { status: 404 }
        );
      }
      templates = [generator.generateTemplate(content, tier)];
    } else {
      // Generate all templates
      templates = generator.generateTemplates(content);
    }
    
    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error: any) {
    console.error('Failed to get x402 templates:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { contentId } = await params;
    const body = await request.json();
    
    const { templateType, panelIndex, panelCount, durationSeconds, periodMonths } = body;
    
    const service = getSmartContentService();
    const content = await service.getById(contentId);
    
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Content not found' },
        { status: 404 }
      );
    }
    
    const generator = getX402TemplateGenerator();
    let template;
    
    switch (templateType) {
      case 'panel':
        if (panelIndex === undefined || panelCount === undefined) {
          return NextResponse.json(
            { success: false, error: 'panelIndex and panelCount required for panel template' },
            { status: 400 }
          );
        }
        template = generator.generatePanelTemplate(content, panelIndex, panelCount);
        break;
        
      case 'stream':
        if (!durationSeconds) {
          return NextResponse.json(
            { success: false, error: 'durationSeconds required for stream template' },
            { status: 400 }
          );
        }
        template = generator.generateStreamTemplate(content, durationSeconds);
        break;
        
      case 'subscription':
        template = generator.generateSubscriptionTemplate(content, periodMonths || 1);
        break;
        
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid templateType. Use: panel, stream, subscription' },
          { status: 400 }
        );
    }
    
    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Could not generate template. Check content pricing configuration.' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('Failed to generate x402 template:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
