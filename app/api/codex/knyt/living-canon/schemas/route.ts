/**
 * KNYT Living Canon — Contribution Schemas
 *
 * Returns task template schemas for the guided submission shell.
 * The Runtime submission shell calls this endpoint to get the
 * field definitions and prompts to render for a given contribution type.
 *
 * GET /api/codex/knyt/living-canon/schemas
 *   Returns all available schemas for the world/branch.
 *
 * GET /api/codex/knyt/living-canon/schemas?type=knyt:dispatch
 *   Returns the schema for a specific task template slug.
 *
 * GET /api/codex/knyt/living-canon/schemas?branch=correspondent
 *   Returns schemas for a specific branch.
 *
 * Schema source: crm_task_templates seeded by the KNYT task templates migration.
 * Cartridge injects these schemas into the Runtime submission shell.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const typeSlug = searchParams.get('type');
    const branch = searchParams.get('branch');

    let query = supabase
      .from('crm_task_templates')
      .select('slug, title, description, difficulty, schema_json, metadata')
      .like('slug', 'knyt:%');

    if (typeSlug) {
      const { data, error } = await query.eq('slug', typeSlug).single();
      if (error || !data) {
        return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
      }
      return NextResponse.json({ schema: data });
    }

    // Filter by branch if requested
    // branch_target is stored inside schema_json JSONB field
    if (branch) {
      query = query.contains('schema_json', { branch_target: branch });
    }

    const { data, error } = await query.order('slug');
    if (error) throw error;

    return NextResponse.json({
      world_id: '21sats',
      schemas: data ?? [],
      count: (data ?? []).length,
    });
  } catch (err) {
    console.error('[living-canon/schemas] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
