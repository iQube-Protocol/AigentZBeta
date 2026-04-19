/**
 * GET  /api/marketa/sequence-items/[id]  — full item detail
 * PATCH /api/marketa/sequence-items/[id] — update editable fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { db: { schema: 'marketa' } });
}

const EDITABLE = new Set([
  'title', 'description', 'thumbnail_url', 'cta_url', 'asset_ref',
  'explainer', 'status',
  'channels', 'publish_day',
  'reward_knyt', 'reward_trigger', 'nbe_disposition',
  'experience_goal_id', 'studio_artifact_id', 'metaproof_milestone',
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = db();
  if (!client) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  const { data, error } = await client
    .from('marketa_sequence_items')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = db();
  if (!client) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  // Whitelist fields
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(body)) {
    if (EDITABLE.has(k)) update[k] = v;
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ ok: false, error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await client
    .from('marketa_sequence_items')
    .update(update)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}
