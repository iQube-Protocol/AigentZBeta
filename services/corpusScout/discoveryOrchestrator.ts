/**
 * Corpus Scout — Constitutional Discovery amendment §4/§5/§9 phase 3:
 * orchestrates Agent B/C (`institutionNavigator.ts`) end-to-end so neither
 * API route has to inline the same steps. Two entry points:
 *
 *   runDiscoveryForInstitution — one ratified institution.
 *   runDiscoveryForDomain      — every ratified institution in a domain, in
 *                                 one call. This is the "just run it for
 *                                 financial-services" action: no per-
 *                                 institution clicking, no manual URL entry
 *                                 for any institution the canonical registry
 *                                 already resolves (`ensureInstitutionSeedUrl`).
 *
 * Both use `ensureInstitutionSeedUrl` first — a steward never has to supply
 * a seed URL for an institution the curated registry already knows, and an
 * institution it doesn't know fails honestly (never a search fallback).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getDomainConstitution, ensureInstitutionSeedUrl } from './domainConstitution';
import { runInstitutionDiscovery } from './institutionNavigator';
import { createCandidateSource } from './provenance';

export interface InstitutionDiscoveryRunResult {
  ok: boolean;
  error?: string;
  pillarKey: string;
  institutionName: string;
  seedUrl?: string;
  pagesFetched: number;
  found: number;
  submitted: number;
  errors: string[];
}

/** Runs Agent B/C for exactly one ratified institution and submits every
 *  resolved candidate through the standard candidate-source pipeline. */
export async function runDiscoveryForInstitution(
  admin: SupabaseClient,
  input: { domain: string; pillarKey: string; institutionName: string },
): Promise<InstitutionDiscoveryRunResult> {
  const { domain, pillarKey, institutionName } = input;
  const base = { pillarKey, institutionName, pagesFetched: 0, found: 0, submitted: 0, errors: [] as string[] };

  const constitution = await getDomainConstitution(admin, domain);
  const institution = constitution.institutions.find((i) => i.pillarKey === pillarKey && i.institutionName === institutionName);
  if (!institution) return { ok: false, error: `no institution '${institutionName}' found for pillar '${pillarKey}' in '${domain}'`, ...base };
  if (institution.status !== 'ratified') return { ok: false, error: `institution '${institutionName}' must be ratified before discovery can run`, ...base };

  const seedResolution = await ensureInstitutionSeedUrl(admin, domain, pillarKey, institutionName);
  if (!seedResolution.ok) return { ok: false, error: seedResolution.error, ...base };
  const seedUrl = seedResolution.seedUrl;

  const discovery = await runInstitutionDiscovery(seedUrl);
  if (!discovery.ok) {
    return { ok: false, error: discovery.error, seedUrl, pagesFetched: discovery.pagesFetched, found: 0, submitted: 0, errors: [], pillarKey, institutionName };
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

  return { ok: true, seedUrl, pillarKey, institutionName, pagesFetched: discovery.pagesFetched, found: discovery.candidates.length, submitted, errors };
}

export interface DomainDiscoveryRunResult {
  ok: boolean;
  domain: string;
  institutionsAttempted: number;
  totalFound: number;
  totalSubmitted: number;
  perInstitution: InstitutionDiscoveryRunResult[];
}

/**
 * Runs discovery across EVERY ratified institution in a domain, sequentially
 * (bounded work per institution already; sequential keeps total request
 * volume against external sites predictable rather than bursting many at
 * once). One click covers a whole ratified domain — for financial-services,
 * every seeded institution resolves via the canonical registry, so this
 * requires no manual URL entry at all.
 */
export async function runDiscoveryForDomain(admin: SupabaseClient, domain: string): Promise<DomainDiscoveryRunResult> {
  const constitution = await getDomainConstitution(admin, domain);
  const ratifiedInstitutions = constitution.institutions.filter((i) => i.status === 'ratified');

  const perInstitution: InstitutionDiscoveryRunResult[] = [];
  for (const institution of ratifiedInstitutions) {
    const result = await runDiscoveryForInstitution(admin, {
      domain,
      pillarKey: institution.pillarKey,
      institutionName: institution.institutionName,
    });
    perInstitution.push(result);
  }

  return {
    ok: true,
    domain,
    institutionsAttempted: ratifiedInstitutions.length,
    totalFound: perInstitution.reduce((sum, r) => sum + r.found, 0),
    totalSubmitted: perInstitution.reduce((sum, r) => sum + r.submitted, 0),
    perInstitution,
  };
}
