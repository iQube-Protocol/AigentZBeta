/**
 * POST /api/registry/publish
 *
 * Publishes a completed experience to the iQube registry.
 * Creates a studio_artifact record (status: approved) as the canonical
 * registry entry and returns a DVN receipt stub.
 *
 * Product decision: manual Publish flow, stub for DVN mint.
 * Future: mint to chain via EVM/ICP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getExperienceRecord } from '@/services/composer/composerPersistence';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { experienceId, userId, tenantId } = body as {
      experienceId?: string;
      userId?: string;
      tenantId?: string;
    };

    if (!experienceId) {
      return NextResponse.json({ error: 'experienceId required' }, { status: 400 });
    }

    // Fetch the experience record
    const experience = await getExperienceRecord(experienceId);
    if (!experience) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
    }

    const jobId = `publish_${experienceId}_${Date.now()}`;
    const now = new Date().toISOString();

    // Check if already published for this experience
    const { data: existing } = await supabase
      .from('studio_artifacts')
      .select('id, job_id, dvn_receipt_ids')
      .eq('source_surface', 'studio-publish')
      .like('job_id', `publish_${experienceId}_%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Already published — return existing receipt
      return NextResponse.json({
        already_published: true,
        job_id: existing.job_id,
        dvn_receipt_id: existing.dvn_receipt_ids?.[0] ?? null,
        registry_entry_id: existing.id,
        message: 'Experience already published to registry',
      });
    }

    // Build the artifact record
    const receiptId = `dvn_receipt_${jobId}`;
    const { data: artifact, error } = await supabase
      .from('studio_artifacts')
      .insert({
        job_id: jobId,
        source_surface: 'studio-publish',
        created_by: userId ?? tenantId ?? 'studio',
        status: 'approved',
        target_surfaces: ['registry'],
        journey_segments_affected: [],
        ui_surfaces_affected: ['registry', 'knyt-codex'],
        package_dependencies: [],
        validation_status: 'passed',
        validation_errors: [],
        rollback_available: false,
        codex_entry_ids: [experienceId],
        dvn_receipt_ids: [receiptId],
        applied_at: now,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[registry/publish] artifact insert error:', error);
      return NextResponse.json({ error: 'Failed to publish to registry' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      job_id: jobId,
      registry_entry_id: artifact.id,
      dvn_receipt_id: receiptId,
      experience_id: experienceId,
      experience_name: typeof experience.name === 'string' ? experience.name : experienceId,
      published_at: now,
      // Stub: future mint-to-chain will return a tx_hash and token_id here
      chain_mint: null,
    });
  } catch (error: any) {
    console.error('[registry/publish] error:', error);
    return NextResponse.json({ error: error.message ?? 'Internal server error' }, { status: 500 });
  }
}
