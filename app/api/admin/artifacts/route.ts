/**
 * GET /api/admin/artifacts?status=&source=&limit=
 *
 * Returns studio_artifacts for the traceability UI (COD-602).
 * Operator-only — service role enforced via RLS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const source = searchParams.get('source');
  const jobId = searchParams.get('jobId');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

  let query = supabase
    .from('studio_artifacts')
    .select(
      'job_id, source_surface, status, created_at, created_by, ' +
      'target_surfaces, journey_segments_affected, ui_surfaces_affected, package_dependencies, ' +
      'validation_status, validation_errors, rollback_available, ' +
      'parent_artifact_id, dvn_receipt_ids, codex_entry_ids'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);
  if (source) query = query.eq('source_surface', source);
  if (jobId) query = query.eq('job_id', jobId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ artifacts: data ?? [] });
}
