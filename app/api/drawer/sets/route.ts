/**
 * DrawerSet API Routes
 * 
 * GET /api/drawer/sets - List drawer sets or get by query
 * POST /api/drawer/sets - Create/update drawer set
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  drawerService,
  getDrawerSet,
  upsertDrawerSet,
  validateDrawerSet,
} from '@/services/drawer';
import type { DrawerSet } from '@/types/smartDrawer';

export const runtime = 'nodejs';

/**
 * GET /api/drawer/sets
 * 
 * Query params:
 * - appId: Filter by app
 * - tenantId: Filter by tenant
 * - personaId: Filter by persona
 * - id: Get specific drawer set by ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const appId = searchParams.get('appId');
    const tenantId = searchParams.get('tenantId');
    const personaId = searchParams.get('personaId');

    // Get by ID
    if (id) {
      const drawerSet = await drawerService.getDrawerSetById(id);
      if (!drawerSet) {
        return NextResponse.json(
          { error: 'DrawerSet not found', id },
          { status: 404 }
        );
      }
      return NextResponse.json({ drawerSet });
    }

    // Get by query
    if (appId && tenantId && personaId) {
      const drawerSet = await getDrawerSet({ appId, tenantId, personaId });
      if (!drawerSet) {
        return NextResponse.json(
          { error: 'DrawerSet not found', query: { appId, tenantId, personaId } },
          { status: 404 }
        );
      }
      return NextResponse.json({ drawerSet });
    }

    // List by app
    if (appId) {
      const drawerSets = await drawerService.listDrawerSets(appId);
      return NextResponse.json({ drawerSets, count: drawerSets.length });
    }

    return NextResponse.json(
      { error: 'Missing required query parameters: id, or (appId, tenantId, personaId), or appId' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[DrawerSets API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/drawer/sets
 * 
 * Body: DrawerSet object
 * 
 * Creates or updates a drawer set.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const drawerSet = body as DrawerSet;

    // Validate
    const validation = validateDrawerSet(drawerSet);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    // Upsert
    const saved = await upsertDrawerSet(drawerSet);

    return NextResponse.json({
      drawerSet: saved,
      warnings: validation.warnings,
    });
  } catch (error) {
    console.error('[DrawerSets API] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
