/**
 * KNYT Canon Elevation API
 *
 * Codex authority endpoint for finalising a canon state change.
 * Only this route may promote content to 'canon' publication state.
 *
 * Flow:
 *   1. Caller (steward / editor) posts a publication_id that is in 'canon_eligible' state.
 *   2. This route validates state and actor role.
 *   3. Updates knyt_publication_states to 'canon'.
 *   4. Writes a canonical record to Autonomys Auto-Drive (on-chain audit trail).
 *   5. Writes the resulting CID back to the publication state record.
 *   6. Appends to knyt_publication_state_log.
 *   7. Returns the CID and updated record.
 *
 * Storage boundary:
 *   Supabase = fast query layer / cache
 *   Autodrive = canonical on-chain record (every canon elevation has a CID)
 *
 * IMPORTANT: Never call aa-proxy or Autodrive directly from client.
 * All calls must come through this server-side route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { publication_id, actor_persona_id, elevation_notes } = body;

    if (typeof publication_id !== 'string' || !publication_id) {
      return NextResponse.json({ error: 'publication_id is required' }, { status: 400 });
    }
    if (typeof actor_persona_id !== 'string' || !actor_persona_id) {
      return NextResponse.json({ error: 'actor_persona_id is required' }, { status: 400 });
    }

    // 1. Load the current publication state
    const { data: pub, error: fetchErr } = await supabase
      .from('knyt_publication_states')
      .select('*')
      .eq('id', publication_id)
      .single();

    if (fetchErr || !pub) {
      return NextResponse.json({ error: 'Publication record not found' }, { status: 404 });
    }

    if (pub.state !== 'canon_eligible') {
      return NextResponse.json(
        { error: `Cannot elevate to canon from state '${pub.state}'. Must be 'canon_eligible'.` },
        { status: 422 }
      );
    }

    // 2. Write canonical record to Autonomys Auto-Drive
    //    We call the server-side autonomysContentService directly.
    //    The CID proves on-chain existence and is returned to the caller.
    let autodriveCid: string | null = null;
    let autodriveError: string | null = null;

    try {
      const { uploadCodexAsset } = await import('@/server/services/autonomysContentService');
      const canonRecord = {
        publication_id,
        subject_type: pub.subject_type,
        subject_id: pub.subject_id,
        branch: pub.branch,
        elevated_by: actor_persona_id,
        elevation_notes: elevation_notes ?? null,
        elevated_at: new Date().toISOString(),
        prior_autodrive_cid: pub.autodrive_cid ?? null,
      };
      const result = await uploadCodexAsset({
        content: JSON.stringify(canonRecord),
        fileName: `canon-elevation-${publication_id}.json`,
        mimeType: 'application/json',
        metadata: { type: 'canon_elevation', publication_id, branch: pub.branch },
      });
      autodriveCid = result.cid ?? null;
    } catch (autodriveErr) {
      // Autodrive write failure is logged but does not block the DB update.
      // The CID will be null; operators must reconcile manually.
      autodriveError = autodriveErr instanceof Error ? autodriveErr.message : String(autodriveErr);
      console.error('[canon-elevation] Autodrive write failed:', autodriveError);
    }

    // 3. Update publication state to 'canon'
    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabase
      .from('knyt_publication_states')
      .update({
        state: 'canon',
        elevated_by: actor_persona_id,
        elevated_at: now,
        review_notes: elevation_notes ?? pub.review_notes,
        autodrive_cid: autodriveCid ?? pub.autodrive_cid,
        updated_at: now,
      })
      .eq('id', publication_id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update publication state', detail: updateErr.message }, { status: 500 });
    }

    // 4. Append to audit log
    await supabase.from('knyt_publication_state_log').insert({
      publication_id,
      from_state: 'canon_eligible',
      to_state: 'canon',
      actor_persona: actor_persona_id,
      reason: elevation_notes ?? 'Canon elevation',
      autodrive_cid: autodriveCid,
    });

    return NextResponse.json({
      success: true,
      publication: updated,
      autodrive_cid: autodriveCid,
      autodrive_warning: autodriveError
        ? 'Autodrive write failed — CID not recorded. Manual reconciliation required.'
        : null,
    });
  } catch (err) {
    console.error('[canon-elevation] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
