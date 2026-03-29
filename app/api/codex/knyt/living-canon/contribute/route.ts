/**
 * KNYT Living Canon — Submit Contribution
 *
 * Accepts the KnytSubmissionShell POST shape and:
 *   1. Resolves the task template (schema_json, pokw_weight, reward_task_type)
 *   2. Inserts into crm_contributions with correct field mapping
 *   3. Creates a knyt_publication_states record (draft or submitted)
 *
 * POST body:
 *   persona_id       UUID       required
 *   world_id         string     default '21sats'
 *   task_slug        string     required — e.g. 'knyt:dispatch'
 *   branch_target    string     required — 'community' | 'correspondent'
 *   status           string     'draft' | 'submitted'
 *   field_values     object     required — key/value map from schema fields
 *   metadata         object     optional — extra context
 *
 * Returns: { id, publication_id }
 *   id             = crm_contributions row id
 *   publication_id = knyt_publication_states row id
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TENANT_ID = 'knyt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      persona_id,
      world_id = '21sats',
      task_slug,
      branch_target,
      status = 'draft',
      field_values,
      metadata: extraMeta = {},
    } = body;

    // Validate required fields
    if (typeof persona_id !== 'string' || !persona_id)
      return NextResponse.json({ error: 'persona_id is required' }, { status: 400 });
    if (typeof task_slug !== 'string' || !task_slug)
      return NextResponse.json({ error: 'task_slug is required' }, { status: 400 });
    if (!['community', 'correspondent'].includes(branch_target))
      return NextResponse.json({ error: 'branch_target must be community or correspondent' }, { status: 400 });
    if (!['draft', 'submitted'].includes(status))
      return NextResponse.json({ error: 'status must be draft or submitted' }, { status: 400 });

    // 1. Resolve task template
    const { data: template, error: templateErr } = await supabase
      .from('crm_task_templates')
      .select('id, slug, title, schema_json, metadata, reward_knyt')
      .eq('tenant_id', TENANT_ID)
      .eq('slug', task_slug)
      .single();

    if (templateErr || !template) {
      return NextResponse.json({ error: `Task template '${task_slug}' not found` }, { status: 404 });
    }

    const schemaJson = template.schema_json as Record<string, unknown> ?? {};
    const pokwWeight = typeof (template.metadata as Record<string, unknown>)?.pokw_weight === 'number'
      ? (template.metadata as Record<string, unknown>).pokw_weight as number
      : 1.0;

    // 2. Derive a human-readable title from field_values (use 'title', 'headline', or 'subject' field)
    const fieldVals = field_values as Record<string, unknown> ?? {};
    const derivedTitle =
      (typeof fieldVals.title === 'string' && fieldVals.title) ||
      (typeof fieldVals.headline === 'string' && fieldVals.headline) ||
      (typeof fieldVals.subject === 'string' && fieldVals.subject) ||
      template.title;

    // 3. Map publication state
    const publicationState = status === 'submitted' ? 'submitted' : 'draft';

    // 4. Insert crm_contribution
    // contribution_type maps to task_slug; units = 1 for a single submission
    const { data: contribution, error: contribErr } = await supabase
      .from('crm_contributions')
      .insert({
        tenant_id: TENANT_ID,
        persona_id,
        contribution_type: task_slug,
        units: 1,
        base_pokw_weight: pokwWeight,
        pokw_score: pokwWeight, // preliminary; recalculated on acceptance
        status: status === 'submitted' ? 'submitted' : 'pending',
        task_template_id: template.id,
        artifact_metadata: {
          world_id,
          branch_target,
          field_values: fieldVals,
          title: derivedTitle,
          schema_slug: task_slug,
          reward_task_type: schemaJson.reward_task_type ?? null,
          ...extraMeta,
        },
      })
      .select('id')
      .single();

    if (contribErr) {
      console.error('[contribute] crm_contributions insert error:', contribErr);
      return NextResponse.json({ error: 'Failed to save contribution', detail: contribErr.message }, { status: 500 });
    }

    // 5. Create knyt_publication_state record
    const { data: publication, error: pubErr } = await supabase
      .from('knyt_publication_states')
      .insert({
        subject_type: 'contribution',
        subject_id: contribution.id,
        branch: branch_target,
        state: publicationState,
      })
      .select('id')
      .single();

    if (pubErr) {
      // Non-fatal: contribution is saved; publication state missing is recoverable
      console.warn('[contribute] knyt_publication_states insert failed:', pubErr.message);
    }

    return NextResponse.json({
      success: true,
      id: contribution.id,
      publication_id: publication?.id ?? null,
      status: publicationState,
    }, { status: 201 });
  } catch (err) {
    console.error('[living-canon/contribute] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
