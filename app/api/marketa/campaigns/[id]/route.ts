/**
 * PATCH /api/marketa/campaigns/[id]  — update campaign status (admin)
 * DELETE /api/marketa/campaigns/[id] — delete campaign + items (admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getMarketaClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { db: { schema: 'marketa' } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getMarketaClient();
  if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  const { id } = params;
  const body = await req.json().catch(() => ({}));
  const { status } = body as { status?: string };

  const allowed = ['active', 'draft', 'archived', 'completed'];
  if (!status || !allowed.includes(status)) {
    return NextResponse.json({ ok: false, error: `status must be one of: ${allowed.join(', ')}` }, { status: 400 });
  }

  const { data, error } = await db
    .from('marketa_campaigns')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, name, status')
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, campaign: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getMarketaClient();
  if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  const { id } = params;

  // Delete sequence items first (FK constraint)
  await db.from('marketa_sequence_items').delete().eq('campaign_id', id);
  // Delete tenant configs
  await db.from('marketa_tenant_campaign_config').delete().eq('campaign_id', id);

  const { error } = await db.from('marketa_campaigns').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
