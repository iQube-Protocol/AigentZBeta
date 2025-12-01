/**
 * Smart Content API - List & Create
 * 
 * GET /api/content/smart - List smart content with filters
 * POST /api/content/smart - Create new smart content
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSmartContentService } from '@/services/content';
import type { SmartContentApp } from '@/types/smartContent';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const options = {
      app: searchParams.get('app') as SmartContentApp | undefined,
      tenantId: searchParams.get('tenantId') || undefined,
      creatorRootDid: searchParams.get('creatorRootDid') || undefined,
      status: searchParams.get('status') as 'draft' | 'published' | 'archived' | 'scheduled' | undefined,
      category: searchParams.get('category') || undefined,
      featured: searchParams.get('featured') === 'true' ? true : undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };
    
    const service = getSmartContentService();
    const result = await service.list(options);
    
    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
      limit: options.limit,
      offset: options.offset,
    });
  } catch (error: any) {
    console.error('Failed to list smart content:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { app, title, slug, creatorRootDid, tenantId } = body;
    if (!app || !title || !slug || !creatorRootDid || !tenantId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: app, title, slug, creatorRootDid, tenantId' },
        { status: 400 }
      );
    }
    
    const service = getSmartContentService();
    const content = await service.create({
      app,
      title,
      slug,
      creatorRootDid,
      tenantId,
      description: body.description,
      coverImageUri: body.coverImageUri,
      modalities: body.modalities,
      structure: body.structure,
      pricingModel: body.pricingModel,
      layoutHints: body.layoutHints,
      menuIntegration: body.menuIntegration,
      libraryMetadata: body.libraryMetadata,
      identityRequirements: body.identityRequirements,
      reputationRequirements: body.reputationRequirements,
      rewardOutcomes: body.rewardOutcomes,
      accessPolicy: body.accessPolicy,
    });
    
    return NextResponse.json({
      success: true,
      data: content,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create smart content:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
