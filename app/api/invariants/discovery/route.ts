/**
 * /api/invariants/discovery — Invariant Discovery Engine (CFS-048 Phase 0).
 *
 * GET  ?domain=financial-services  → { evidence[], candidates[] }
 * POST { action }                  → admin/steward-gated:
 *        add-evidence  { domain, title, sourceKind, content, sourceRef? }
 *        extract       { domain }   — run constitutional discovery → candidates
 *        promote       { candidateId } — land candidate as `proposed` in canon
 *        reject        { candidateId }
 *
 * The discovery workspace is a LABORATORY surface — admin-gated (the internal
 * IRL edition). Promotion never canonises; it lands at `proposed` for the
 * validation harness (inv.reasoning.337).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  addEvidence,
  listEvidence,
  listCandidates,
  runConstitutionalDiscovery,
  compareSubDomains,
  compressDomainInvariants,
  materializeCompressionEdges,
  suggestParents,
  promoteCandidate,
  linkPromotedParents,
  rejectCandidate,
  type EvidenceKind,
} from '@/services/invariants/discoveryEngine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_DOMAIN = 'financial-services';

// Sub-domain presets for the Financial Services domain: CRP-003's five capability
// domains + the sector-native areas the operator named. The UI offers these plus
// free-text — laddering beneath the domain baseline (CFS-048 Phase 1a).
const SUB_DOMAIN_PRESETS: Record<string, { value: string; label: string }[]> = {
  'financial-services': [
    { value: 'investment-operations', label: 'Investment Operations (CRP-003 D1)' },
    { value: 'market-operations', label: 'Market Operations (CRP-003 D2)' },
    { value: 'financial-intelligence', label: 'Financial Intelligence (CRP-003 D3)' },
    { value: 'financial-integrity', label: 'Constitutional Financial Integrity (CRP-003 D4)' },
    { value: 'constitutional-commerce', label: 'Constitutional Commerce (CRP-003 D5)' },
    { value: 'payments', label: 'Payments' },
    { value: 'trading', label: 'Trading' },
    { value: 'banking', label: 'Banking' },
    { value: 'custody', label: 'Custody' },
    { value: 'cross-border', label: 'Cross-border' },
  ],
};

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const params = new URL(req.url).searchParams;
  const domain = params.get('domain')?.trim() || DEFAULT_DOMAIN;
  const subDomain = params.get('subDomain')?.trim() || null;
  const [evidence, candidates] = await Promise.all([
    listEvidence(admin, domain, subDomain),
    listCandidates(admin, domain, subDomain),
  ]);
  return NextResponse.json(
    { ok: true, domain, subDomain, subDomainPresets: SUB_DOMAIN_PRESETS[domain] ?? [], evidence, candidates },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    domain?: string;
    subDomain?: string;
    title?: string;
    sourceKind?: EvidenceKind;
    content?: string;
    sourceRef?: string;
    candidateId?: string;
    parentInvariantIds?: string[];
  };
  const domain = body.domain?.trim() || DEFAULT_DOMAIN;
  const subDomain = body.subDomain?.trim() || null;

  switch (body.action) {
    case 'add-evidence': {
      const r = await addEvidence(admin, {
        domain,
        subDomain: subDomain ?? undefined,
        title: String(body.title ?? ''),
        sourceKind: (body.sourceKind ?? 'other'),
        content: String(body.content ?? ''),
        sourceRef: body.sourceRef,
        personaId: persona.personaId,
      });
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'extract': {
      const r = await runConstitutionalDiscovery(admin, domain, { subDomain });
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'compare': {
      // Cross-sub-domain compression → earned domain-level candidates (Phase 2).
      const r = await compareSubDomains(admin, domain);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'compress-domain': {
      // Recursive compression — PROPOSE the derivation structure (roots vs
      // derived, with typed parent edges) among the domain's earned invariants.
      // Proposals only — nothing is inserted into the graph here.
      const r = await compressDomainInvariants(admin, domain);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'materialize-edges': {
      // OPERATOR-CONFIRMED materialisation of a derived candidate's proposed
      // typed edges into the invariant graph (child + parents must be promoted).
      if (!body.candidateId) return NextResponse.json({ ok: false, error: 'candidateId required' }, { status: 400 });
      const r = await materializeCompressionEdges(admin, body.candidateId);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'suggest-parents': {
      if (!body.candidateId) return NextResponse.json({ ok: false, error: 'candidateId required' }, { status: 400 });
      const suggestions = await suggestParents(admin, body.candidateId);
      return NextResponse.json({ ok: true, suggestions });
    }
    case 'promote': {
      if (!body.candidateId) return NextResponse.json({ ok: false, error: 'candidateId required' }, { status: 400 });
      const parentIds = Array.isArray(body.parentInvariantIds) ? body.parentInvariantIds.filter((x) => typeof x === 'string') : [];
      const r = await promoteCandidate(admin, body.candidateId, { personaId: persona.personaId }, parentIds);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'link-parents': {
      // Retro-link an already-promoted sub-domain invariant to its domain parents.
      if (!body.candidateId) return NextResponse.json({ ok: false, error: 'candidateId required' }, { status: 400 });
      const parentIds = Array.isArray(body.parentInvariantIds) ? body.parentInvariantIds.filter((x) => typeof x === 'string') : [];
      const r = await linkPromotedParents(admin, body.candidateId, parentIds);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    case 'reject': {
      if (!body.candidateId) return NextResponse.json({ ok: false, error: 'candidateId required' }, { status: 400 });
      const r = await rejectCandidate(admin, body.candidateId);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    default:
      return NextResponse.json({ ok: false, error: 'action must be one of: add-evidence, extract, compare, compress-domain, materialize-edges, suggest-parents, promote, link-parents, reject' }, { status: 400 });
  }
}
