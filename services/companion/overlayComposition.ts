/**
 * Constitutional Overlay — card composition.
 *
 * PRD-MMC-IMPL-002 Increment 2, Step 2 (RATIFIED 2026-07-23).
 * See: codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-002-companion-phase3-implementation-plan.md §3.
 *
 * Composes an overlay card for a resolved `OverlayShape` by calling ONLY
 * existing reads — never a new one:
 *
 *   - Standing summary   → `readStandingForVenture()` (`services/venture/standingForVenture.ts`),
 *     the exact function `GET /api/venture/standing-summary` itself calls;
 *     the fact-count collapse below mirrors that route's own transformation
 *     verbatim so this surface exposes nothing new beyond what that route
 *     already returns to its callers.
 *   - Capability-graph position → `recommendProducers()` (`services/capability/capabilityGraph.ts`),
 *     the exact function `GET /api/capability/producers` itself calls. The
 *     GitHub-repo card asks for the `'software'` capability at the
 *     `'operational'` tier — the natural capability class for a repo page.
 *   - Registry / research match → `services/companion/searchFederation.ts`'s
 *     `searchRegistryIQube` / `searchRegistryAsset` / `searchResearch` — the
 *     SAME federation functions Increment 1's Universal Search already
 *     built, run here against a best-effort repo-name query instead of a
 *     user-typed one. Never a second registry-matching implementation.
 *
 * Degrades honestly: a GitHub page with no registry match returns
 * `registryMatch: null` (rendered as "no linked iQube found for this repo"
 * by the UI) rather than fabricating one — plan §3 Increment 2's own stated
 * requirement.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { readStandingForVenture } from '@/services/venture/standingForVenture';
import { recommendProducers } from '@/services/capability/capabilityGraph';
import type { ProducerRecommendation } from '@/types/capabilityGraph';
import {
  repoNameCandidateFromTitle,
  type OverlayShape,
} from '@/services/companion/overlayMapping';
import {
  searchRegistryIQube,
  searchRegistryAsset,
  searchResearch,
  rankSearchResults,
} from '@/services/companion/searchFederation';
import type { CompanionSearchResult } from '@/types/companionSearch';
import type { ActivePersonaContext } from '@/types/access';

/** Mirrors `GET /api/venture/standing-summary`'s own fact-count collapse —
 *  the same T1/T2-safe aggregate shape that route already returns. */
export interface OverlayStandingSummary {
  standing: unknown;
  reputation: unknown;
  score: unknown;
  factCountsByDomain: Record<string, number>;
  hasStandingSignal: boolean;
}

export interface GithubRepoOverlayCard {
  shape: 'github-repo';
  standing: OverlayStandingSummary;
  capability: ProducerRecommendation[];
  registryMatch: CompanionSearchResult | null;
  researchMatches: CompanionSearchResult[];
}

export interface BankingOverlayCard {
  shape: 'banking';
  standing: OverlayStandingSummary;
  /** T1-safe persona flags already resolved by the spine for this request —
   *  not a new read (mirrors what `/api/wallet/active-persona` already
   *  returns to its own callers). */
  identifiability: ActivePersonaContext['identifiability'];
  cartridgeFlags: ActivePersonaContext['cartridgeFlags'];
}

export type OverlayCard = GithubRepoOverlayCard | BankingOverlayCard;

async function buildStandingSummary(personaId: string): Promise<OverlayStandingSummary> {
  const admin = getSupabaseServer();
  if (!admin) {
    return { standing: null, reputation: null, score: null, factCountsByDomain: {}, hasStandingSignal: false };
  }
  const summary = await readStandingForVenture(admin, personaId);
  const factCountsByDomain: Record<string, number> = {};
  for (const [domain, facts] of Object.entries(summary.factsByDomain)) {
    factCountsByDomain[domain] = facts.length;
  }
  return {
    standing: summary.standing,
    reputation: summary.reputation,
    score: summary.score,
    factCountsByDomain,
    hasStandingSignal: summary.hasStandingSignal,
  };
}

async function composeGithubRepoCard(
  personaId: string,
  currentTabTitle: string | undefined,
): Promise<GithubRepoOverlayCard> {
  const [standing, capability] = await Promise.all([
    buildStandingSummary(personaId),
    recommendProducers('software', 'operational'),
  ]);

  const candidate = repoNameCandidateFromTitle(currentTabTitle);
  let registryMatch: CompanionSearchResult | null = null;
  let researchMatches: CompanionSearchResult[] = [];

  if (candidate) {
    const [iqubeMatches, assetMatches, research] = await Promise.all([
      searchRegistryIQube(candidate).catch(() => []),
      searchRegistryAsset(candidate).catch(() => []),
      searchResearch(candidate).catch(() => []),
    ]);
    const ranked = rankSearchResults([...iqubeMatches, ...assetMatches], candidate);
    registryMatch = ranked[0] ?? null;
    researchMatches = rankSearchResults(research, candidate).slice(0, 5);
  }

  return { shape: 'github-repo', standing, capability, registryMatch, researchMatches };
}

async function composeBankingCard(persona: ActivePersonaContext): Promise<BankingOverlayCard> {
  const standing = await buildStandingSummary(persona.personaId);
  return {
    shape: 'banking',
    standing,
    identifiability: persona.identifiability,
    cartridgeFlags: persona.cartridgeFlags,
  };
}

export async function composeOverlayCard(
  shape: OverlayShape,
  persona: ActivePersonaContext,
  currentTabTitle: string | undefined,
): Promise<OverlayCard> {
  if (shape === 'github-repo') return composeGithubRepoCard(persona.personaId, currentTabTitle);
  return composeBankingCard(persona);
}
