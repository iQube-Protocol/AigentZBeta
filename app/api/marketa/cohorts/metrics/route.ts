/**
 * GET /api/marketa/cohorts/metrics
 *
 * Aggregate Mailjet metrics for a Marketa cohort. Reads the existing
 * CRM state columns (nakamoto_knyt_personas.campaign_state /
 * avl_partner_contacts.outreach_status / ks_backers_staging.engagement_status)
 * that the Mailjet webhook updates on every open / click / bounce /
 * spam / unsub event.
 *
 * Query params:
 *   ?campaignId=knyt_codex|knyt_partners|ks_prospects   (required)
 *   ?cohortId=<cohort_value>                            (required for knyt_codex / knyt_partners)
 *
 * Response shape mirrors what the workbench Mailjet metrics modal
 * needs to render: per-state counts + headline rates.
 *
 * Persona scoping: this surface is admin-only (cohort metrics expose
 * recipient counts) — gated by the existing admin route policy on
 * `/api/marketa/*`. No persona id required in the body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getActivePersona } from '@/services/identity/getActivePersona';

export const dynamic = 'force-dynamic';

interface CohortMetrics {
  campaignId: string;
  campaignLabel: string;
  cohortId: string | null;
  cohortLabel: string;
  totalRecipients: number;
  states: Record<string, number>;
  rates: {
    sent: number;
    open: number;
    click: number;
    /** Backed/converted rate — only meaningful for knyt_codex. */
    backed: number | null;
  };
  /** Best-effort timestamp of the most recent send (last_event_at /
   *  last_outreach_at where available). */
  lastEventAt: string | null;
  /** Source table for traceability. */
  source: 'nakamoto_knyt_personas' | 'avl_partner_contacts' | 'ks_backers_staging';
}

const CAMPAIGN_LABELS: Record<string, string> = {
  knyt_codex: 'KNYT Codex Investors',
  knyt_partners: 'KNYT Partners',
  ks_prospects: 'KS Prospects',
};

function humaniseCohortId(id: string | null): string {
  if (!id) return 'all';
  return id.replace(/_/g, ' ');
}

function computeRates(states: Record<string, number>, total: number, includeBacked: boolean): CohortMetrics['rates'] {
  const sent = (states.sent ?? 0) + (states.opened ?? 0) + (states.clicked ?? 0) + (states.backed ?? 0);
  const opened = (states.opened ?? 0) + (states.clicked ?? 0) + (states.backed ?? 0);
  const clicked = (states.clicked ?? 0) + (states.backed ?? 0);
  const backed = states.backed ?? 0;
  return {
    sent: total > 0 ? sent / total : 0,
    open: sent > 0 ? opened / sent : 0,
    click: sent > 0 ? clicked / sent : 0,
    backed: includeBacked ? (sent > 0 ? backed / sent : 0) : null,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth — admin-only surface. Persona must resolve and carry the admin flag.
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ error: 'persona-required' }, { status: 401 });
  }
  if (!persona.cartridgeFlags?.isAdmin) {
    return NextResponse.json({ error: 'admin-required' }, { status: 403 });
  }

  const url = new URL(req.url);
  const campaignId = url.searchParams.get('campaignId');
  const cohortId = url.searchParams.get('cohortId');
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
  }

  const admin = getSupabaseServer();
  if (!admin) {
    return NextResponse.json({ error: 'supabase-unavailable' }, { status: 503 });
  }

  const campaignLabel = CAMPAIGN_LABELS[campaignId] ?? campaignId;
  const cohortLabel = humaniseCohortId(cohortId);

  // ── KNYT Codex — nakamoto_knyt_personas.campaign_state ──────────────────
  if (campaignId === 'knyt_codex') {
    if (!cohortId) {
      return NextResponse.json({ error: 'cohortId required for knyt_codex' }, { status: 400 });
    }
    const { data, error } = await admin
      .from('nakamoto_knyt_personas')
      .select('campaign_state')
      .eq('campaign_cohort', cohortId)
      .not('Email', 'is', null);
    if (error) {
      return NextResponse.json({ error: 'query-failed', detail: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as Array<{ campaign_state: string | null }>;
    const states: Record<string, number> = {};
    for (const r of rows) {
      const s = (r.campaign_state ?? 'unsent') as string;
      states[s] = (states[s] ?? 0) + 1;
    }
    const metrics: CohortMetrics = {
      campaignId,
      campaignLabel,
      cohortId,
      cohortLabel,
      totalRecipients: rows.length,
      states,
      rates: computeRates(states, rows.length, true),
      lastEventAt: null,
      source: 'nakamoto_knyt_personas',
    };
    return NextResponse.json(metrics);
  }

  // ── KNYT Partners — avl_partner_contacts.outreach_status ────────────────
  if (campaignId === 'knyt_partners') {
    if (!cohortId) {
      return NextResponse.json({ error: 'cohortId required for knyt_partners' }, { status: 400 });
    }
    const waveNum = cohortId === 'wave_1' ? 1 : cohortId === 'wave_2' ? 2 : null;
    if (waveNum === null) {
      return NextResponse.json({ error: `unknown wave: ${cohortId}` }, { status: 400 });
    }
    const { data, error } = await admin
      .from('avl_partner_contacts')
      .select('outreach_status')
      .eq('wave', waveNum)
      .not('email', 'is', null);
    if (error) {
      return NextResponse.json({ error: 'query-failed', detail: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as Array<{ outreach_status: string | null }>;
    const states: Record<string, number> = {};
    for (const r of rows) {
      // Normalise to the same state vocabulary as knyt_codex where
      // possible so the workbench can render a uniform bar.
      const raw = (r.outreach_status ?? 'unsent') as string;
      const s = raw === 'engaged' ? 'clicked' : raw === 'responded' ? 'clicked' : raw;
      states[s] = (states[s] ?? 0) + 1;
    }
    const metrics: CohortMetrics = {
      campaignId,
      campaignLabel,
      cohortId,
      cohortLabel,
      totalRecipients: rows.length,
      states,
      rates: computeRates(states, rows.length, false),
      lastEventAt: null,
      source: 'avl_partner_contacts',
    };
    return NextResponse.json(metrics);
  }

  // ── KS Prospects — ks_backers_staging.engagement_status ─────────────────
  if (campaignId === 'ks_prospects') {
    const { data, error } = await admin
      .from('ks_backers_staging')
      .select('engagement_status, suppression_status, last_event_at')
      .eq('suppression_status', 'active')
      .not('email', 'is', null);
    if (error) {
      return NextResponse.json({ error: 'query-failed', detail: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as Array<{
      engagement_status: string | null;
      suppression_status: string | null;
      last_event_at: string | null;
    }>;
    const states: Record<string, number> = {};
    let lastEventAt: string | null = null;
    for (const r of rows) {
      let s = (r.engagement_status ?? 'unsent') as string;
      // Reduce email_<n>_sent fan-out to a single 'sent' bucket so the
      // headline rate stays comparable across campaigns.
      if (/^email_\d+_sent$/.test(s)) s = 'sent';
      states[s] = (states[s] ?? 0) + 1;
      if (r.last_event_at && (!lastEventAt || r.last_event_at > lastEventAt)) {
        lastEventAt = r.last_event_at;
      }
    }
    const metrics: CohortMetrics = {
      campaignId,
      campaignLabel,
      cohortId: null,
      cohortLabel: 'active',
      totalRecipients: rows.length,
      states,
      rates: computeRates(states, rows.length, false),
      lastEventAt,
      source: 'ks_backers_staging',
    };
    return NextResponse.json(metrics);
  }

  return NextResponse.json({ error: `unknown campaignId: ${campaignId}` }, { status: 400 });
}
