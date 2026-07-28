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
import {
  DISCOVERY_DOMAINS,
  DEFAULT_DISCOVERY_DOMAIN,
  discoveryDomain,
  discoveryNamespace,
  subDomainPresets,
} from '@/services/invariants/discoveryDomains';
import { listInvariants } from '@/services/invariants/store';
import {
  CLASSIFICATION_CHECKS,
  PERMITTED_UNCLASSIFIED_USES,
  RESTRICTED_INVARIANT_USES,
  buildClassificationQueue,
  canUseInvariantFor,
} from '@/services/research/experimentalPopulations';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Domain list, default, and sub-domain presets are DERIVED from the Discovery
// Domain Registry (PRD-IDE-002). They used to be hand-maintained literals here
// AND in two client surfaces — three copies of one list, the stale-duplicate
// defect `tests/source-of-truth-parity.test.ts` exists to catch.
const DEFAULT_DOMAIN = DEFAULT_DISCOVERY_DOMAIN;

export async function GET(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const params = new URL(req.url).searchParams;
  const domain = params.get('domain')?.trim() || DEFAULT_DOMAIN;
  const subDomain = params.get('subDomain')?.trim() || null;
  const namespace = discoveryNamespace(domain);
  const [evidence, candidates, promoted] = await Promise.all([
    listEvidence(admin, domain, subDomain),
    listCandidates(admin, domain, subDomain),
    // The classification queue's input. Scoped to the domain's namespace, which
    // is what `promoteCandidate` resolved when it landed the record — so the
    // namespace check below compares like with like.
    listInvariants({ namespace, limit: 200 }).catch(() => [] as Awaited<ReturnType<typeof listInvariants>>),
  ]);
  // "Safe should not become finished" (operator ruling 2026-07-28). Promotion is
  // fail-closed — every promoted invariant lands unclassified, in NO population.
  // That is correct and deliberately unchanged; what it must not be is invisible.
  const classificationQueue = buildClassificationQueue(
    promoted.map((inv) => ({
      id: inv.id, statement: inv.statement, namespace: inv.namespace,
      status: inv.status, provenance: inv.provenance as Record<string, unknown> | null,
    })),
    // The Discovery Domain Registry is the authority on domain → namespace; the
    // queue never forks that mapping.
    (record) => {
      const recordDomain = (record.provenance?.domain ?? null) as string | null;
      return recordDomain ? discoveryNamespace(recordDomain) : null;
    },
  );
  const registered = discoveryDomain(domain);
  return NextResponse.json(
    {
      ok: true,
      domain,
      subDomain,
      subDomainPresets: subDomainPresets(domain),
      // The registry, projected for the surface's domain picker + the
      // observed-domain legend a horizontal domain's recurrence scores need.
      domains: DISCOVERY_DOMAINS.map((d) => ({ key: d.key, label: d.label, kind: d.kind })),
      domainKind: registered?.kind ?? null,
      domainDefinition: registered?.definition ?? null,
      observedIn: registered ? [...registered.observedIn] : [],
      evidence,
      candidates,
      classificationQueue,
      // The six checks are carried from the ruling's own list rather than
      // restated in the client (inv.engineering.036), and the prohibition is
      // reported as the GATE'S OWN reason strings — not prose written beside
      // it that could drift from what the gate actually refuses.
      classificationChecks: CLASSIFICATION_CHECKS,
      unclassifiedProhibitions: RESTRICTED_INVARIANT_USES.map((use) => {
        const gate = canUseInvariantFor({ provenance: null, status: 'proposed' }, use);
        return { use, reason: gate.allowed ? null : gate.reason };
      }),
      permittedUnclassifiedUses: PERMITTED_UNCLASSIFIED_USES,
    },
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
