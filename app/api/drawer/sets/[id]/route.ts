/**
 * DrawerSet by ID API Routes
 * 
 * GET /api/drawer/sets/[id] - Get drawer set by ID
 * PUT /api/drawer/sets/[id] - Update drawer set
 * DELETE /api/drawer/sets/[id] - Delete drawer set
 */

import { NextRequest, NextResponse } from 'next/server';
import { drawerService, validateDrawerSet } from '@/services/drawer';
import type { DrawerSet } from '@/types/smartDrawer';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/drawer/sets/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const drawerSet = await drawerService.getDrawerSetById(id);

    if (!drawerSet) {
      return NextResponse.json(
        { error: 'DrawerSet not found', id },
        { status: 404 }
      );
    }

    return NextResponse.json({ drawerSet });
  } catch (error) {
    console.error('[DrawerSet API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/drawer/sets/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updates = body as Partial<DrawerSet>;

    // Get existing
    const existing = await drawerService.getDrawerSetById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'DrawerSet not found', id },
        { status: 404 }
      );
    }

    // Merge updates
    const merged: DrawerSet = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
    };

    // Validate
    const validation = validateDrawerSet(merged);
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

    // Save
    const saved = await drawerService.upsertDrawerSet(merged);

    return NextResponse.json({
      drawerSet: saved,
      warnings: validation.warnings,
    });
  } catch (error) {
    console.error('[DrawerSet API] PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/drawer/sets/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deleted = await drawerService.deleteDrawerSet(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'DrawerSet not found', id },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('[DrawerSet API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
