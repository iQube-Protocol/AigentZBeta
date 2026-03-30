/**
 * KNYT Correspondent Campaigns
 *
 * Returns active editorial campaigns and featured correspondent slots
 * for the 21 Sats world. Used to surface targeted prompts to correspondents
 * so they know what content is most needed right now.
 *
 * Campaigns are authored in crm_task_templates where:
 *   - tenant_id = 'knyt'
 *   - metadata->>'branch_target' = 'correspondent'
 *   - metadata->>'campaign_active' = 'true'
 *
 * Featured slots are open knyt_elections of votable_type='correspondent_candidate'
 * that haven't settled yet — these show who is in contention.
 *
 * GET /api/codex/knyt/correspondent/campaigns
 *   Returns: { campaigns[], featured_slots[], recent_dispatches[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const WORLD_ID = '21sats';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('persona_id');

    const now = new Date().toISOString();

    const [templatesResult, electionsResult, dispatchesResult] = await Promise.all([
      // Active campaign templates for correspondents
      supabase
        .from('crm_task_templates')
        .select('id, slug, title, description, category, schema_json, metadata')
        .eq('tenant_id', 'knyt')
        .eq('is_active', true),

      // Open elections for correspondent candidates
      supabase
        .from('knyt_elections')
        .select('id, title, description, closes_at, total_ballots_cast, per_voter_reward_knyt, candidate_ids')
        .eq('world_id', WORLD_ID)
        .eq('votable_type', 'correspondent_candidate')
        .eq('status', 'open')
        .lte('opens_at', now)
        .gte('closes_at', now)
        .limit(5),

      // Recent correspondent dispatches (accepted/canon correspondent branch)
      supabase
        .from('knyt_publication_states')
        .select('id, subject_type, subject_id, state, elevated_at, created_at')
        .eq('branch', 'correspondent')
        .in('state', ['approved', 'canon_eligible', 'canon'])
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    // Filter templates to correspondent campaigns only
    const allTemplates = templatesResult.data ?? [];
    const campaigns = allTemplates.filter((t) => {
      if (!t.metadata || typeof t.metadata !== 'object') return false;
      const meta = t.metadata as Record<string, unknown>;
      return meta.branch_target === 'correspondent' && meta.campaign_active === true;
    });

    // Check if persona is eligible — correspondent, steward, or admin all qualify
    let isCorrespondent = false;
    if (personaId) {
      const { data: roleRows } = await supabase
        .from('knyt_persona_roles')
        .select('id')
        .eq('persona_id', personaId)
        .in('role', ['knyt:correspondent', 'knyt:steward', 'knyt:admin'])
        .is('revoked_at', null)
        .limit(1);
      isCorrespondent = Array.isArray(roleRows) && roleRows.length > 0;
    }

    return NextResponse.json({
      world_id: WORLD_ID,
      is_correspondent: isCorrespondent,
      campaigns: campaigns.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        category: c.category,
        prompt: (c.metadata as Record<string, unknown>)?.campaign_prompt ?? null,
        reward_preview: (c.metadata as Record<string, unknown>)?.reward_preview ?? null,
      })),
      featured_slots: (electionsResult.data ?? []).map((e) => ({
        election_id: e.id,
        title: e.title,
        description: e.description,
        closes_at: e.closes_at,
        closes_in_ms: Math.max(0, new Date(e.closes_at).getTime() - Date.now()),
        total_ballots: e.total_ballots_cast,
        per_voter_reward: e.per_voter_reward_knyt,
        candidate_count: (e.candidate_ids ?? []).length,
      })),
      recent_dispatches: (dispatchesResult.data ?? []).map((d) => ({
        id: d.id,
        subject_type: d.subject_type,
        state: d.state,
        date: d.elevated_at ?? d.created_at,
      })),
    });
  } catch (err) {
    console.error('[correspondent/campaigns] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
