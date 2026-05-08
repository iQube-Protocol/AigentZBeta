/**
 * Investor Dashboard API — investor-facing read endpoint.
 *
 * GET /api/codex/investor-dashboard?personaId=<persona-uuid>
 *
 * Returns the persona's capital summary, equity/token holdings, and visible
 * documents. Visibility scope is "self only" — the requested personaId must
 * either be one of the caller's personas or a known investor persona linked
 * to the caller. Phase 1 trusts the URL personaId since the IAM resolution
 * agent handles the persona identity layer; we add a basic existence check.
 *
 * Plan: codexes/packs/agentiq/updates/2026-05-04_tasks-rewards-reputation-integration-plan.md § 4.2
 *
 * The DB tables (investor_capital_events, investor_documents) are created by
 * migration 20260506000000_investor_dashboard_tables.sql.
 *
 * Documents are listed (with storage_master_id) for the gated PDFPageViewer to
 * load via /api/content/pdf-page-by-master/[masterId] (CLAUDE.md § Gated Content).
 * No raw URLs are exposed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CapitalEventRow {
  id: string;
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
  doc_type: string;
  title: string;
  storage_master_id: string | null;
  effective_date: string | null;
  created_at: string;
}

interface NakamotoInvestorRow {
  is_investor: boolean | null;
  email: string | null;
  display_name: string | null;
}

export async function GET(request: NextRequest) {
  const personaId = request.nextUrl.searchParams.get('personaId');
  if (!personaId) {
    return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  // Resolve FIO handle to UUID — the table uses UUID as primary key.
  let resolvedPersonaId = personaId;
  if (personaId.includes('@')) {
    const { data: personaRow } = await supabase
      .from('personas')
      .select('id')
      .eq('fio_handle', personaId)
      .maybeSingle();
    if (personaRow?.id) resolvedPersonaId = personaRow.id;
  }

  // Confirm the persona is an investor (gate stub — IAM agent will own this).
  // Falls through gracefully if nakamoto_knyt_personas table or row missing —
  // an admin reviewing a non-investor persona will see an "isInvestor: false"
  // payload and the UI gate will refuse to render the dashboard.
  let isInvestor = false;
  let displayName: string | null = null;
  try {
    const { data: nakamotoRow } = await supabase
      .from('nakamoto_knyt_personas')
      .select('is_investor, email, display_name')
      .eq('id', resolvedPersonaId)
      .maybeSingle();
    const row = nakamotoRow as NakamotoInvestorRow | null;
    isInvestor = row?.is_investor === true;
    displayName = row?.display_name ?? null;
  } catch {
    // Table missing or query failed — caller will see isInvestor: false.
  }

  // Capital events ledger (RLS allows the persona's owner to see own rows;
  // service-role here bypasses RLS, so we manually scope by persona_id.)
  const { data: eventsData } = await supabase
    .from('investor_capital_events')
    .select('id, event_type, amount_usd, amount_shares, amount_knyt, vehicle, occurred_at, notes')
    .eq('persona_id', resolvedPersonaId)
    .order('occurred_at', { ascending: false })
    .limit(200);

  const events = (eventsData ?? []) as CapitalEventRow[];

  // Documents — only those the admin has explicitly published (visible_to_investor = TRUE).
  const { data: documentsData } = await supabase
    .from('investor_documents')
    .select('id, doc_type, title, storage_master_id, effective_date, created_at')
    .eq('persona_id', resolvedPersonaId)
    .eq('visible_to_investor', true)
    .order('effective_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(100);

  const documents = (documentsData ?? []) as DocumentRow[];

  // ── Aggregate capital summary ──────────────────────────────────────────
  let totalInvestedUsd = 0;
  let totalSharesGranted = 0;
  let totalKnytGranted = 0;
  let totalDistributionsUsd = 0;

  for (const e of events) {
    if (e.event_type === 'investment'        && e.amount_usd)    totalInvestedUsd      += Number(e.amount_usd);
    if (e.event_type === 'share_grant'       && e.amount_shares) totalSharesGranted    += Number(e.amount_shares);
    if (e.event_type === 'token_grant'       && e.amount_knyt)   totalKnytGranted      += Number(e.amount_knyt);
    if (e.event_type === 'vesting_milestone' && e.amount_knyt)   totalKnytGranted      += Number(e.amount_knyt);
    if (e.event_type === 'distribution'      && e.amount_usd)    totalDistributionsUsd += Number(e.amount_usd);
  }

  return NextResponse.json({
    personaId: resolvedPersonaId,
    isInvestor,
    displayName,
    summary: {
      totalInvestedUsd,
      totalSharesGranted,
      totalKnytGranted,
      totalDistributionsUsd,
      eventCount: events.length,
      documentCount: documents.length,
    },
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
      effectiveDate: d.effective_date,
      createdAt: d.created_at,
    })),
  });
}

export async function OPTIONS() {
  return new Response(null);
}
