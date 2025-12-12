/**
 * CRM Personas API
 * 
 * GET /api/crm/personas - List personas for a tenant
 * POST /api/crm/personas - Create a new persona
 * 
 * Auto-provisions registry profile on persona creation (DiDQube compliant)
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crmService from '@/services/crm/crmService';
import * as db from '@/services/crm/crmDataAccess';
import { TenantId } from '@/types/crm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') as TenantId;
    const personaId = searchParams.get('personaId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || undefined;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // If personaId provided, get persona summary
    if (personaId) {
      const summary = await crmService.getPersonaSummary(tenantId, personaId);
      if (!summary) {
        return NextResponse.json(
          { error: 'Persona not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: summary });
    }

    // List personas
    const personas = await crmService.listPersonas(tenantId, { limit, offset, search });
    
    return NextResponse.json({
      success: true,
      data: personas,
      pagination: {
        limit,
        offset,
        count: personas.length,
      },
    });
  } catch (error: any) {
    console.error('[CRM API] GET /personas error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch personas' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      displayName,
      email,
      kybeDid,
      rootDidProxyId,
      externalUserId,
      primaryWalletAddress,
      authProfileId,
      primaryFranchiseId,
    } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Create persona
    const persona = await crmService.createPersona({
      tenantId,
      displayName,
      email,
      kybeDid,
      rootDidProxyId,
      externalUserId,
      primaryWalletAddress,
      authProfileId,
      primaryFranchiseId,
    });

    // Auto-provision registry profile if kybeDid provided
    // This ensures any account signup creates a registry profile (DiDQube compliant)
    if (kybeDid) {
      const tenant = await db.getTenant(tenantId);
      await db.ensureRegistryProfile({
        kybeDid,
        displayName,
        originLayer: 'tenant',
        originTenantId: tenantId,
        originFranchiseId: tenant?.franchiseId,
      });
    }

    return NextResponse.json({
      success: true,
      data: persona,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[CRM API] POST /personas error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create persona' },
      { status: 500 }
    );
  }
}
