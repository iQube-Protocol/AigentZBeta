/**
 * KNYT Living Canon — Bounded Remix
 *
 * Creates a derivative community submission pre-seeded from a source
 * canon or community publication. The remix is bounded:
 *   - Source must be in 'canon' or 'approved'/'canon_eligible' state
 *   - Remix always targets 'community' branch (never direct to canon)
 *   - Remix depth is capped at 3 (prevents infinite derivative chains)
 *   - Source attribution (parent_publication_id) is preserved
 *
 * POST /api/codex/knyt/living-canon/remix
 *   body: {
 *     source_publication_id: string  — the item being remixed
 *     persona_id: string             — remixer
 *     task_slug: string              — contribution type (e.g. 'knyt:community_submission')
 *     seed_content?: Record<string, unknown>  — optional overrides
 *   }
 *
 * Returns: { publication_id, contribution_id, seed, source }
 * The client mounts KnytSubmissionShell with the returned seed as initial values.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_REMIX_DEPTH = 3;
const REMIXABLE_STATES = ['canon', 'canon_eligible', 'approved'];
const REMIXABLE_BRANCHES = ['canon', 'community'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source_publication_id, persona_id, task_slug, seed_content } = body;

    if (typeof source_publication_id !== 'string' || !source_publication_id)
      return NextResponse.json({ error: 'source_publication_id is required' }, { status: 400 });
    if (typeof persona_id !== 'string' || !persona_id)
      return NextResponse.json({ error: 'persona_id is required' }, { status: 400 });
    if (typeof task_slug !== 'string' || !task_slug)
      return NextResponse.json({ error: 'task_slug is required' }, { status: 400 });

    // 1. Load source publication
    const { data: source, error: sourceErr } = await supabase
      .from('knyt_publication_states')
      .select('id, subject_type, subject_id, branch, state, remix_depth')
      .eq('id', source_publication_id)
      .single();

    if (sourceErr || !source)
      return NextResponse.json({ error: 'Source publication not found' }, { status: 404 });

    if (!REMIXABLE_STATES.includes(source.state)) {
      return NextResponse.json(
        { error: `Cannot remix a publication in state '${source.state}'. Must be: ${REMIXABLE_STATES.join(', ')}.` },
        { status: 422 }
      );
    }

    if (!REMIXABLE_BRANCHES.includes(source.branch)) {
      return NextResponse.json(
        { error: `Cannot remix a '${source.branch}' branch item. Only canon and community items can be remixed.` },
        { status: 422 }
      );
    }

    const sourceDepth = source.remix_depth ?? 0;
    if (sourceDepth >= MAX_REMIX_DEPTH) {
      return NextResponse.json(
        { error: `Remix depth limit reached (max ${MAX_REMIX_DEPTH}). This item cannot be remixed further.` },
        { status: 422 }
      );
    }

    // 2. Load task template for seed schema
    const { data: template } = await supabase
      .from('crm_task_templates')
      .select('id, slug, title, schema_json, metadata')
      .eq('tenant_id', 'knyt')
      .eq('slug', task_slug)
      .maybeSingle();

    // 3. Build seed from source content (attribution + empty remix fields)
    const seed: Record<string, unknown> = {
      // Attribution fields — always present in a remix
      remix_source_id: source_publication_id,
      remix_source_type: source.subject_type,
      remix_branch: 'community',  // remixes always go to community
      // Caller overrides (if provided)
      ...(seed_content && typeof seed_content === 'object' ? seed_content : {}),
    };

    // 4. Create a draft contribution to hold the remix state
    const now = new Date().toISOString();
    const { data: contribution, error: contribErr } = await supabase
      .from('crm_contributions')
      .insert({
        persona_id,
        tenant_id: 'knyt',
        contribution_type: task_slug,
        status: 'draft',
        task_template_id: template?.id ?? null,
        pokw_score: null, // set on acceptance
        metadata: {
          remix_of: source_publication_id,
          remix_depth: sourceDepth + 1,
          source_subject_type: source.subject_type,
          source_subject_id: source.subject_id,
          source_branch: source.branch,
          seed,
        },
      })
      .select('id')
      .single();

    if (contribErr) throw contribErr;

    // 5. Create publication state for the remix (draft, community branch)
    const { data: publication, error: pubErr } = await supabase
      .from('knyt_publication_states')
      .insert({
        subject_type: source.subject_type,
        subject_id: contribution.id, // contribution row is the subject
        branch: 'community',
        state: 'draft',
        parent_publication_id: source_publication_id,
        remix_depth: sourceDepth + 1,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (pubErr) throw pubErr;

    return NextResponse.json({
      success: true,
      publication_id: publication.id,
      contribution_id: contribution.id,
      remix_depth: sourceDepth + 1,
      seed,
      source: {
        id: source.id,
        subject_type: source.subject_type,
        branch: source.branch,
        state: source.state,
      },
    });
  } catch (err) {
    console.error('[living-canon/remix] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/codex/knyt/living-canon/remix?source_id=<id>
 * Returns all remixes of a source publication (lineage view).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('source_id');

    if (!sourceId)
      return NextResponse.json({ error: 'source_id query param required' }, { status: 400 });

    const { data: remixes, error } = await supabase
      .from('knyt_publication_states')
      .select('id, subject_type, branch, state, remix_depth, created_at')
      .eq('parent_publication_id', sourceId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      source_id: sourceId,
      remixes: remixes ?? [],
      total: (remixes ?? []).length,
    });
  } catch (err) {
    console.error('[living-canon/remix GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
