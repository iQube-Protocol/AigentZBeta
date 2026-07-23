/**
 * /api/corpus-scout/institution-discovery — Constitutional Discovery
 * amendment §4/§5/§9 phase 3: Agent B (institution-targeted navigation) +
 * bounded Agent C (recursive resolution), triggered per ratified
 * Institutional Registry entry. Admin-gated, mirroring
 * `/api/corpus-scout/candidates`'s auth pattern exactly.
 *
 * POST { domain, pillarKey, institutionName } →
 *   1. Look up the institution row (must be `ratified` and carry a
 *      `seedUrl` — Law I's institution-first philosophy: never falls back
 *      to search when a seed URL is missing).
 *   2. Run `runInstitutionDiscovery(seedUrl)` (`institutionNavigator.ts`).
 *   3. Submit every resolved candidate through the SAME back half a manual
 *      URL submission uses (`createCandidateSource`), tagged
 *      `acquisitionMethod: 'institutional-registry'` with `discoveryUrl` set
 *      to the institution's seed/listing path — never a parallel ingestion
 *      mechanism.
 *
 * Each candidate still lands as `pending_review` (or `needs_retrieval_fix`
 * if retrieval fails) — discovery finds candidates, it never auto-approves
 * them. A steward reviews every one exactly as they would a manually
 * submitted URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getDomainConstitution } from '@/services/corpusScout/domainConstitution';
import { runInstitutionDiscovery } from '@/services/corpusScout/institutionNavigator';
import { createCandidateSource } from '@/services/corpusScout/provenance';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!persona.cartridgeFlags?.isAdmin) return NextResponse.json({ ok: false, error: 'Steward access required' }, { status: 403 });
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    domain?: string;
    pillarKey?: string;
    institutionName?: string;
  };
  const domain = body.domain?.trim();
  const pillarKey = body.pillarKey?.trim();
  const institutionName = body.institutionName?.trim();
  if (!domain || !pillarKey || !institutionName) {
    return NextResponse.json({ ok: false, error: 'domain, pillarKey, and institutionName are required' }, { status: 400 });
  }

  const constitution = await getDomainConstitution(admin, domain);
  const institution = constitution.institutions.find((i) => i.pillarKey === pillarKey && i.institutionName === institutionName);
  if (!institution) {
    return NextResponse.json({ ok: false, error: `no institution '${institutionName}' found for pillar '${pillarKey}' in '${domain}'` }, { status: 404 });
  }
  if (institution.status !== 'ratified') {
    return NextResponse.json({ ok: false, error: `institution '${institutionName}' must be ratified before discovery can run` }, { status: 400 });
  }
  if (!institution.seedUrl) {
    return NextResponse.json({ ok: false, error: `institution '${institutionName}' has no seedUrl — Agent B needs an institution-provided starting point, not a search fallback` }, { status: 400 });
  }

  const discovery = await runInstitutionDiscovery(institution.seedUrl);
  if (!discovery.ok) {
    return NextResponse.json({ ok: false, error: discovery.error, failureClass: discovery.failureClass, pagesFetched: discovery.pagesFetched }, { status: 502 });
  }

  let submitted = 0;
  const errors: string[] = [];
  for (const candidate of discovery.candidates) {
    const r = await createCandidateSource(admin, {
      url: candidate.documentUrl,
      campaignDomain: domain,
      campaignSubDomain: pillarKey,
      title: candidate.title,
      acquisitionMethod: 'institutional-registry',
      discoveryUrl: candidate.discoveryUrl,
    });
    if (r.ok) submitted += 1;
    else errors.push(`${candidate.documentUrl}: ${r.error ?? 'unknown error'}`);
  }

  return NextResponse.json({
    ok: true,
    pagesFetched: discovery.pagesFetched,
    found: discovery.candidates.length,
    submitted,
    errors,
  });
}
