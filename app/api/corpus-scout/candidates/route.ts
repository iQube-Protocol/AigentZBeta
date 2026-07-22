/**
 * /api/corpus-scout/candidates — Corpus Scout (PRD-ICA-001) candidate-source
 * workspace surface. Admin-gated, mirroring `/api/invariants/discovery`'s
 * auth pattern exactly (`getActivePersona` + `cartridgeFlags?.isAdmin`).
 *
 * GET  ?campaignDomain=&reviewWorkflowStatus=  → list candidate sources
 * POST { url, campaignDomain, campaignSubDomain? } → retrieve + inspect +
 *      persist ONE candidate source (Level 4 discovery only, §2). Always
 *      returns a record — a verification failure is recorded as
 *      `needs_retrieval_fix`, never silently dropped (§12).
 *
 * Scope note: accepts a DIRECT document URL only. Multi-hop resolution from a
 * search query/landing page to a final artifact (the Resolver Agent, §10
 * agent C) is explicitly out of scope for this build — see PRD-ICA-001 §0.4.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { createCandidateSource, listCandidateSources } from '@/services/corpusScout/provenance';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const params = new URL(req.url).searchParams;
  const campaignDomain = params.get('campaignDomain')?.trim() || undefined;
  const reviewWorkflowStatus = params.get('reviewWorkflowStatus')?.trim() || undefined;
  const candidates = await listCandidateSources(admin, { campaignDomain, reviewWorkflowStatus });
  return NextResponse.json({ ok: true, candidates }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    campaignDomain?: string;
    campaignSubDomain?: string;
    title?: string;
  };
  if (!body.url?.trim()) return NextResponse.json({ ok: false, error: 'url is required' }, { status: 400 });
  if (!body.campaignDomain?.trim()) return NextResponse.json({ ok: false, error: 'campaignDomain is required' }, { status: 400 });

  const r = await createCandidateSource(admin, {
    url: body.url,
    campaignDomain: body.campaignDomain,
    campaignSubDomain: body.campaignSubDomain,
    title: body.title,
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
