/**
 * Admin Investor Dashboard API.
 *
 * GET /api/admin/investor-dashboard
 *   → returns the full investor list (every persona flagged is_investor=TRUE
 *     in nakamoto_knyt_personas), each with a capital + documents summary.
 *
 * GET /api/admin/investor-dashboard?personaId=<persona-uuid>
 *   → returns the SAME shape as /api/codex/investor-dashboard for one persona,
 *     but ALSO surfaces docs that are not yet visible_to_investor (the admin
 *     must see what's pending publication). Sprint 4 admin tab consumes this.
 *
 * Plan: codexes/packs/agentiq/updates/2026-05-04_tasks-rewards-reputation-integration-plan.md § 4.3
 *
 * Auth: requireAdmin (header-based stub — IAM will replace).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { requireAdmin } from '@/app/api/_lib/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NakamotoRow {
  id: string;
  email: string | null;
  display_name: string | null;
  fio_handle: string | null;
  is_investor: boolean | null;
}

interface CapitalEventRow {
  id: string;
  persona_id: string;
  event_type: string;
  amount_usd: number | null;
  amount_shares: number | null;
  amount_knyt: number | null;
  vehicle: string | null;
  occurred_at: string;
  notes: string | null;
}

interface DocumentRow {
  id: string;
  persona_id: string;
  doc_type: string;
  title: string;
  storage_master_id: string | null;
  visible_to_investor: boolean;
  effective_date: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const personaId = request.nextUrl.searchParams.get('personaId');

  // Per-investor view (same shape as the investor-facing endpoint, plus
  // unpublished docs so the admin can see what is staged).
  if (personaId) {
    const { data: eventsData } = await supabase
      .from('investor_capital_events')
      .select('id, event_type, amount_usd, amount_shares, amount_knyt, vehicle, occurred_at, notes')
      .eq('persona_id', personaId)
      .order('occurred_at', { ascending: false })
      .limit(500);

    const { data: documentsData } = await supabase
      .from('investor_documents')
      .select('id, doc_type, title, storage_master_id, visible_to_investor, effective_date, created_at')
      .eq('persona_id', personaId)
      .order('effective_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(200);

    const events = (eventsData ?? []) as CapitalEventRow[];
    const documents = (documentsData ?? []) as DocumentRow[];

    return NextResponse.json({
      personaId,
      events: events.map((e) => ({
        id: e.id,
        eventType: e.event_type,
        amountUsd: e.amount_usd ? Number(e.amount_usd) : null,
        amountShares: e.amount_shares ? Number(e.amount_shares) : null,
        amountKnyt: e.amount_knyt ? Number(e.amount_knyt) : null,
        vehicle: e.vehicle,
        occurredAt: e.occurred_at,
        notes: e.notes,
      })),
      documents: documents.map((d) => ({
        id: d.id,
        docType: d.doc_type,
        title: d.title,
        storageMasterId: d.storage_master_id,
        visibleToInvestor: d.visible_to_investor,
        effectiveDate: d.effective_date,
        createdAt: d.created_at,
      })),
    });
  }

  // Full investor list — every flagged persona with their summary stats.
  const { data: investorsData } = await supabase
    .from('nakamoto_knyt_personas')
    .select('id, email, display_name, fio_handle, is_investor')
    .eq('is_investor', true)
    .order('display_name', { ascending: true })
    .limit(500);

  const investors = (investorsData ?? []) as NakamotoRow[];

  // Bulk-fetch summary stats for all investors in two queries.
  const investorIds = investors.map((i) => i.id);
  const [eventsRes, docsRes] = await Promise.all([
    supabase
      .from('investor_capital_events')
      .select('persona_id, event_type, amount_usd, amount_shares, amount_knyt')
      .in('persona_id', investorIds.length > 0 ? investorIds : ['__none__']),
    supabase
      .from('investor_documents')
      .select('persona_id, visible_to_investor')
      .in('persona_id', investorIds.length > 0 ? investorIds : ['__none__']),
  ]);

  const eventsByPersona = new Map<string, { totalInvestedUsd: number; totalSharesGranted: number; totalKnytGranted: number; eventCount: number }>();
  for (const row of (eventsRes.data ?? []) as Pick<CapitalEventRow, 'persona_id' | 'event_type' | 'amount_usd' | 'amount_shares' | 'amount_knyt'>[]) {
    const cur = eventsByPersona.get(row.persona_id) ?? { totalInvestedUsd: 0, totalSharesGranted: 0, totalKnytGranted: 0, eventCount: 0 };
    cur.eventCount += 1;
    if (row.event_type === 'investment'  && row.amount_usd)    cur.totalInvestedUsd   += Number(row.amount_usd);
    if (row.event_type === 'share_grant' && row.amount_shares) cur.totalSharesGranted += Number(row.amount_shares);
    if ((row.event_type === 'token_grant' || row.event_type === 'vesting_milestone') && row.amount_knyt) {
      cur.totalKnytGranted += Number(row.amount_knyt);
    }
    eventsByPersona.set(row.persona_id, cur);
  }

  const docCountByPersona = new Map<string, { total: number; visible: number }>();
  for (const row of (docsRes.data ?? []) as Pick<DocumentRow, 'persona_id' | 'visible_to_investor'>[]) {
    const cur = docCountByPersona.get(row.persona_id) ?? { total: 0, visible: 0 };
    cur.total += 1;
    if (row.visible_to_investor) cur.visible += 1;
    docCountByPersona.set(row.persona_id, cur);
  }

  return NextResponse.json({
    investors: investors.map((i) => ({
      personaId: i.id,
      email: i.email,
      displayName: i.display_name,
      fioHandle: i.fio_handle,
      summary: eventsByPersona.get(i.id) ?? { totalInvestedUsd: 0, totalSharesGranted: 0, totalKnytGranted: 0, eventCount: 0 },
      documents: docCountByPersona.get(i.id) ?? { total: 0, visible: 0 },
    })),
  });
}

export async function OPTIONS() {
  return new Response(null);
}
