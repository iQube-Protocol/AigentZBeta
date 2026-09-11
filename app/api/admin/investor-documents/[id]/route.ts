/**
 * Admin Investor Documents — update + delete by id.
 *
 * PATCH /api/admin/investor-documents/[id]
 *   body: { visibleToInvestor?, title?, effectiveDate?, storageMasterId? }
 *   → primary use is flipping visibleToInvestor TRUE to publish the doc to
 *     the investor (the doc only appears in /api/codex/investor-dashboard
 *     once visible_to_investor = TRUE).
 *
 * DELETE /api/admin/investor-documents/[id]
 *   → removes the row. Does NOT delete the underlying master_content_qubes
 *     storage object — that is owned by the storage admin flow.
 *
 * Plan: codexes/packs/agentiq/updates/2026-05-04_tasks-rewards-reputation-integration-plan.md § 4.5
 *
 * Auth: requireAdmin (header-based stub — IAM will replace).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { requireAdmin } from '@/app/api/_lib/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PatchBody {
  visibleToInvestor?: boolean;
  title?: string;
  effectiveDate?: string | null;
  storageMasterId?: string | null;
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const update: Record<string, unknown> = {};
  if (typeof body.visibleToInvestor === 'boolean') update.visible_to_investor = body.visibleToInvestor;
  if (typeof body.title === 'string') update.title = body.title;
  if (body.effectiveDate !== undefined) update.effective_date = body.effectiveDate;
  if (body.storageMasterId !== undefined) update.storage_master_id = body.storageMasterId;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('investor_documents')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ document: data });
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const { error } = await supabase.from('investor_documents').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
