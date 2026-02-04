/**
 * Smart Content Relationships API
 * 
 * GET /api/content/smart/[id]/relationships - Get relationships for content
 * POST /api/content/smart/[id]/relationships - Create a relationship
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSmartContentService } from '@/services/content';
import type { RelationshipType } from '@/types/smartContent';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    const relationshipType = searchParams.get('type') as RelationshipType | undefined;
    const includeBidirectional = searchParams.get('bidirectional') === 'true';
    
    const service = getSmartContentService();
    const relationships = await service.getRelationships(id, {
      relationshipType,
      includeBidirectional,
    });
    
    return NextResponse.json({
      success: true,
      data: relationships,
    });
  } catch (error: any) {
    console.error('Failed to get relationships:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { targetId, targetType, relationshipType, tenantId, createdBy, data, metadata } = body;
    
    if (!targetId || !targetType || !relationshipType || !tenantId || !createdBy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: targetId, targetType, relationshipType, tenantId, createdBy' },
        { status: 400 }
      );
    }
    
    const service = getSmartContentService();
    const relationship = await service.createRelationship({
      sourceId: id,
      sourceType: 'SmartContentQube',
      targetId,
      targetType,
      relationshipType,
      tenantId,
      createdBy,
      data,
      metadata,
    });
    
    return NextResponse.json({
      success: true,
      data: relationship,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create relationship:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
