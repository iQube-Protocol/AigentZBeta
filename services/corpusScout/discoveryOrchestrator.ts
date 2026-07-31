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
import { canRunInstitutionDiscovery } from './registryVerification';
import { acquisitionSeedsFor } from './institutionalRegistry';

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
  /**
   * How many of `submitted` came from the operator's curated acquisition
   * plan (`acquisitionSeedsFor`) versus homepage navigation — the seed-
   * priority ordering below (operator ruling 2026-07-28). Zero curated seeds
   * is the normal case for a (domain, pillar, institution) the operator
   * hasn't hand-selected documents for; it never blocks navigation.
   */
  curatedSeedsSubmitted: number;
  navigationSubmitted: number;
}

/**
 * Runs Agent B/C for exactly one ratified institution and submits every
 * resolved candidate through the standard candidate-source pipeline.
 *
 * ── Seed priority (operator ruling 2026-07-28) ───────────────────────────
 *
 * CURATED ACQUISITION SEEDS ARE RETRIEVED FIRST, homepage navigation SECOND.
 * `acquisitionSeedsFor` (`institutionalRegistry.ts`) carries the operator's
 * own pillar-specific, document-level plan — e.g. NBER's own
 * `https://www.nber.org/papers/w17181` for `partnerships` — pre-selected
 * for relevance so acquisition doesn't depend on a crawler finding the right
 * document. Previously this function went straight to homepage navigation
 * and never consulted the curated plan at all: nineteen operator-selected
 * URLs sat unused while Agent B/C guessed from the institution's homepage.
 * Navigation still runs, for corpus EXPANSION beyond the curated plan —
 * never as a bypass of it.
 *
 * Each candidate's `acquisitionMethod` records which path produced it —
 * `operator-curated-seed` or the pre-existing `institutional-registry` tag
 * for homepage-navigation discoveries — so the provenance distinction is
 * visible in output, not just implicit (operator ruling 2026-07-28, same
 * discipline as the evidence provenance fix).
 */
export async function runDiscoveryForInstitution(
  admin: SupabaseClient,
  input: { domain: string; pillarKey: string; institutionName: string },
): Promise<InstitutionDiscoveryRunResult> {
  const { domain, pillarKey, institutionName } = input;
  const base = {
    pillarKey, institutionName, pagesFetched: 0, found: 0, submitted: 0, errors: [] as string[],
    curatedSeedsSubmitted: 0, navigationSubmitted: 0,
  };

  const constitution = await getDomainConstitution(admin, domain);
  const institution = constitution.institutions.find((i) => i.pillarKey === pillarKey && i.institutionName === institutionName);
  if (!institution) return { ok: false, error: `no institution '${institutionName}' found for pillar '${pillarKey}' in '${domain}'`, ...base };

  // THE REFUSAL GATE (SPEC-CIR-001 §9.5, operator ruling 2026-07-27). Steward
  // ratification AND completed verification, both, before a single byte is
  // acquired from this institution. Previously only ratification was checked,
  // so the pipeline would happily acquire from a URL nobody had ever resolved.
  // One authority answers the question (`canRunInstitutionDiscovery`); this
  // route does not re-implement the condition. Applies uniformly to BOTH
  // acquisition paths below — curated seeds are not a way around the gate.
  const gate = canRunInstitutionDiscovery(institution);
  if (!gate.allowed) return { ok: false, error: `institution '${institutionName}': ${gate.reason}`, ...base };

  const errors: string[] = [];

  // ── 1. CURATED SEEDS FIRST ─────────────────────────────────────────────
  const curatedSeeds = acquisitionSeedsFor(domain, pillarKey, institutionName);
  let curatedSeedsSubmitted = 0;
  for (const seed of curatedSeeds) {
    const r = await createCandidateSource(admin, {
      url: seed.url,
      campaignDomain: domain,
      campaignSubDomain: pillarKey,
      title: seed.claim || seed.url,
      acquisitionMethod: 'operator-curated-seed',
      discoveryUrl: seed.url,
    });
    if (r.ok) curatedSeedsSubmitted += 1;
    else errors.push(`${seed.url}: ${r.error ?? 'unknown error'}`);
  }

  // ── 2. HOMEPAGE NAVIGATION SECOND — corpus expansion, never a bypass ────
  const seedResolution = await ensureInstitutionSeedUrl(admin, domain, pillarKey, institutionName);
  if (!seedResolution.ok) {
    return {
      ok: curatedSeedsSubmitted > 0, // a curated-only run is still a real result
      error: seedResolution.error,
      pillarKey, institutionName, pagesFetched: 0,
      found: curatedSeeds.length, submitted: curatedSeedsSubmitted, errors,
      curatedSeedsSubmitted, navigationSubmitted: 0,
    };
  }
  const seedUrl = seedResolution.seedUrl;

  const discovery = await runInstitutionDiscovery(seedUrl);
  if (!discovery.ok) {
    return {
      ok: curatedSeedsSubmitted > 0,
      error: discovery.error, seedUrl, pagesFetched: discovery.pagesFetched,
      found: curatedSeeds.length, submitted: curatedSeedsSubmitted, errors,
      pillarKey, institutionName, curatedSeedsSubmitted, navigationSubmitted: 0,
    };
  }

  let navigationSubmitted = 0;
  for (const candidate of discovery.candidates) {
    const r = await createCandidateSource(admin, {
      url: candidate.documentUrl,
      campaignDomain: domain,
      campaignSubDomain: pillarKey,
      title: candidate.title,
      acquisitionMethod: 'institutional-registry',
      discoveryUrl: candidate.discoveryUrl,
    });
    if (r.ok) navigationSubmitted += 1;
    else errors.push(`${candidate.documentUrl}: ${r.error ?? 'unknown error'}`);
  }

  return {
    ok: true,
    seedUrl, pillarKey, institutionName,
    pagesFetched: discovery.pagesFetched,
    found: curatedSeeds.length + discovery.candidates.length,
    submitted: curatedSeedsSubmitted + navigationSubmitted,
    errors,
    curatedSeedsSubmitted, navigationSubmitted,
  };
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
  // Same gate, same authority — a domain run must not become a way around the
  // per-institution refusal.
  const ratifiedInstitutions = constitution.institutions.filter((i) => canRunInstitutionDiscovery(i).allowed);

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
