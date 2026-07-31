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
  routeForCapability,
  domainSearchHint,
  type CapabilityRoute,
  type OverlayShape,
} from '@/services/companion/overlayMapping';
import {
  capabilityIdsForModules,
  capabilityModule,
  moduleAllowsAction,
  modulePosture,
  type CapabilityModuleId,
  type ModulePosture,
} from '@/services/resolution/capabilityModules';
import { resolveDomainProfile } from '@/services/resolution/domainProfileRegistry';
import { listRegisteredCapabilities } from '@/services/constitutional/capabilityRegistry';
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
  /** See `resolveRelatedMatches` — the SAME general registry/research lookup
   *  every shape now carries. Deduped against `registryMatch` /
   *  `researchMatches` above so this card never lists the same hit twice. */
  relatedMatches: CompanionSearchResult[];
}

/**
 * A registered Constitutional Capability that the shape's explicit id table
 * declares relevant to this page. T2-safe by construction: every field is a
 * capability fact from `capability_registry`, a table that carries NO
 * identity column at all (CFS-032 T2 discipline) — no personaId, no
 * ownership, nothing persona-derived.
 */
export interface OverlayCapabilityMatch {
  capabilityId: string;
  displayLabel: string;
  description: string | null;
  standingBand: string;
  /** Repo path OR http(s) URL — the UI handles both (mySoftware's pattern). */
  briefUrl: string | null;
  /** Where this capability actually OPERATES, from `CAPABILITY_ROUTES`
   *  (overlayMapping.ts). Identifier-free `{ slug, tab, label }`; the panel
   *  attaches the persona at render time via `buildCodexUrl`. `null` when no
   *  operating surface is declared — the row renders without a link rather
   *  than inventing a route. */
  route: CapabilityRoute | null;
}

/**
 * A capability module as composed for rendering (SPEC-CDR-001 §7.1, P4).
 * Carries its posture and its action permission explicitly, so the renderer
 * never has to re-derive the firewall rule.
 */
export interface OverlayCapabilityModule {
  moduleId: CapabilityModuleId;
  label: string;
  summary: string;
  posture: ModulePosture;
  /** D-11 — TRUE only for an authoritative module. */
  allowsAction: boolean;
  capabilities: OverlayCapabilityMatch[];
}

export interface FinancialContextOverlayCard {
  shape: 'financial-context';
  standing: OverlayStandingSummary;
  /** T1-safe persona flags already resolved by the spine for this request —
   *  not a new read (mirrors what `/api/wallet/active-persona` already
   *  returns to its own callers). */
  identifiability: ActivePersonaContext['identifiability'];
  cartridgeFlags: ActivePersonaContext['cartridgeFlags'];
  /** Constitutional capabilities relevant to a financial-context page
   *  (operator-approved 2026-07-24). OPTIONAL so every existing consumer of
   *  this card keeps working unchanged; absent/empty whenever the registry is
   *  empty, the migration is unapplied, or none of the declared ids are
   *  actually registered yet. */
  matchedCapabilities?: OverlayCapabilityMatch[];
  /** P4 — the modules the resolved profile named, each with its posture and
   *  its own capability rows. `matchedCapabilities` is retained as the flat
   *  list so no existing consumer breaks; the modules are the grouping. */
  modules: OverlayCapabilityModule[];
  /** See `resolveRelatedMatches`. Financial-context pages previously had NO
   *  registry lookup at all — the generalisation is what gave every shape the
   *  same "what does metaMe already know about this page" panel. */
  relatedMatches: CompanionSearchResult[];
}

/**
 * The unmapped-domain fallback (operator-directed, 2026-07-25 — "1 and 2 for
 * unmapped pages + 3 as you suggest").
 *
 * NOT a fourth hand-classified shape. `shapeForDomain` still returns `null`
 * for any domain outside the `github-repo` rule and the verified Domain
 * Profile registry — that
 * classification is unchanged. This is what the route composes INSTEAD OF
 * the prior empty state, specifically and ONLY when the reason is
 * `'domain-unmapped'` (a real, currently-granted observation exists; the
 * domain simply has no dedicated dashboard). The other three empty-state
 * reasons (`no-observation`, `no-domain-observed`, `grant-revoked`) are
 * consent problems, not classification problems, and keep returning
 * `card: null` — composing ANY card there would show standing/capability
 * data derived from an observation the route has no legitimate basis to
 * use, conflating "no consent" with "no dashboard for this page type".
 *
 * Composed from data that is true on EVERY page, never fabricated for one
 * that has none:
 *   - `standing` / `identifiability` / `cartridgeFlags` — persona-level, not
 *     page-level. Hiding these on an unmapped domain was never a privacy
 *     boundary, just an artifact of the card being all-or-nothing per shape;
 *     they render here as they already do on `FinancialContextOverlayCard`.
 *   - `titleMatches` — a best-effort registry/research search using the
 *     page's own title as the query, via the EXACT SAME federation
 *     functions `composeGithubRepoCard` already calls
 *     (`searchRegistryIQube` / `searchRegistryAsset` / `searchResearch` /
 *     `rankSearchResults`) — never a second matching implementation, just a
 *     different query source (page title vs. an extracted repo name).
 *     Empty title or zero hits degrades to `[]`, never a fabricated match.
 *
 *     UPDATE 2026-07-25 (found live-verifying Gmail): title-only search
 *     under-covers domains whose tab title is the document/inbox CONTENT
 *     rather than the product name (Gmail's title is "Inbox (72,138)", never
 *     "Gmail"). `domainSearchHint` (`overlayMapping.ts`) adds a second query
 *     candidate for a small, explicit table of Google Workspace hosts. Both
 *     candidates are searched and results merged/deduped by `ref` — never a
 *     new matching implementation, just a second real query alongside the
 *     first. A domain outside that table degrades to title-only, unchanged.
 */
export interface GenericOverlayCard {
  shape: 'generic';
  domain: string;
  standing: OverlayStandingSummary;
  identifiability: ActivePersonaContext['identifiability'];
  cartridgeFlags: ActivePersonaContext['cartridgeFlags'];
  relatedMatches: CompanionSearchResult[];
}

export type OverlayCard = GithubRepoOverlayCard | FinancialContextOverlayCard | GenericOverlayCard;

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
  domain: string | null,
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

  // The general lookup, excluding whatever the repo-specific panels above
  // already show, so the same hit never appears twice on one card.
  const alreadyShown = new Set<string>(
    [registryMatch?.ref, ...researchMatches.map((m) => m.ref)].filter(
      (ref): ref is string => typeof ref === 'string',
    ),
  );
  const relatedMatches = await resolveRelatedMatches(domain, currentTabTitle, alreadyShown);

  return { shape: 'github-repo', standing, capability, registryMatch, researchMatches, relatedMatches };
}

/**
 * Capability-matching path (operator-approved 2026-07-24, "Yes to mp overlay").
 *
 * The matching RULE is deliberately dumb and auditable: take the shape's
 * declared id list (the modules a resolved profile names) and
 * keep the ones that are ACTUALLY in the Constitutional Capability Registry
 * and not deprecated. No semantic classifier, no free-text query, no
 * inference — the same explicit-table discipline `shapeForDomain` uses one
 * level up.
 *
 * Reads the EXISTING `listRegisteredCapabilities()` (the same function the
 * admin route and `registeredCapabilityBlock()` already call) — never a new
 * query, never a parallel registry read. Note this never ENUMERATES the
 * registry to the caller: the declared id list is the filter, so an
 * unlisted capability can never reach the response. That is why this does
 * not weaken the sibling admin route's gate, which exists to protect
 * enumeration of the whole constitutional ledger.
 *
 * Soft-fails to [] on every failure path (`listRegisteredCapabilities` is
 * itself soft-fail: no Supabase, unapplied migration 20260716000000, or a
 * query error all yield []), so an empty registry renders as "no matched
 * capabilities", never an error state — same discipline as
 * `searchFederation`'s per-source `guard()`.
 */
async function matchCapabilities(
  declared: readonly string[],
): Promise<OverlayCapabilityMatch[]> {
  if (declared.length === 0) return [];
  try {
    const registered = await listRegisteredCapabilities();
    if (registered.length === 0) return [];
    const wanted = new Set(declared);
    return registered
      .filter((c) => wanted.has(c.capabilityId) && c.lifecycleState !== 'deprecated')
      .map((c) => {
        const payload = (c.object?.payload ?? {}) as { description?: string; briefUrl?: string | null };
        return {
          capabilityId: c.capabilityId,
          displayLabel: c.displayLabel,
          description: payload.description?.trim() ? payload.description : null,
          standingBand: c.standingBand,
          briefUrl: payload.briefUrl ?? null,
          route: routeForCapability(c.capabilityId),
        };
      });
  } catch (e) {
    console.warn('[CompanionOverlay] capability match failed; degrading to no matches:', e);
    return [];
  }
}

/**
 * P4 — compose the capability modules the RESOLVED PROFILE names (§7.1).
 *
 * Modules are never inferred from the overlay context: a profile that names
 * none renders none, and a governance module appears only where a profile
 * explicitly asserts it (operator, P4-2).
 *
 * Rendering rule, chosen to preserve the shipped empty-state discipline: an
 * **executable** module with zero matched capabilities is OMITTED, because an
 * unpopulated registry (or an unapplied migration) would otherwise turn
 * today's clean card into a header with nothing under it. A **context-only**
 * module (shadow-only or governance) inherently has no capability rows, so it
 * renders on the strength of the profile's assertion alone — that IS its
 * content.
 */
function composeModules(
  modules: readonly CapabilityModuleId[],
  matched: OverlayCapabilityMatch[],
): OverlayCapabilityModule[] {
  const byId = new Map(matched.map((m) => [m.capabilityId, m]));
  const composed: OverlayCapabilityModule[] = [];
  for (const id of modules) {
    const def = capabilityModule(id);
    const capabilities = def.capabilityIds
      .map((capabilityId) => byId.get(capabilityId))
      .filter((m): m is OverlayCapabilityMatch => Boolean(m));
    const posture = modulePosture(id);
    const contextOnly = posture !== 'authoritative';
    if (!contextOnly && capabilities.length === 0) continue;
    composed.push({
      moduleId: id,
      label: def.label,
      summary: def.summary,
      posture,
      // D-11's behavioural half: only an authoritative module may present an
      // action affordance. The renderer omits the control entirely rather
      // than disabling it -- a disabled button still implies the action.
      allowsAction: moduleAllowsAction(id),
      capabilities,
    });
  }
  return composed;
}

async function composeFinancialContextCard(
  persona: ActivePersonaContext,
  currentTabTitle: string | undefined,
  domain: string | null,
): Promise<FinancialContextOverlayCard> {
  const profile = resolveDomainProfile(domain);
  const declaredModules = profile?.capabilityModules ?? [];
  const [standing, matchedCapabilities, relatedMatches] = await Promise.all([
    buildStandingSummary(persona.personaId),
    matchCapabilities(capabilityIdsForModules(declaredModules)),
    resolveRelatedMatches(domain, currentTabTitle),
  ]);
  return {
    shape: 'financial-context',
    standing,
    identifiability: persona.identifiability,
    cartridgeFlags: persona.cartridgeFlags,
    matchedCapabilities,
    modules: composeModules(declaredModules, matchedCapabilities),
    relatedMatches,
  };
}

export async function composeOverlayCard(
  shape: OverlayShape,
  persona: ActivePersonaContext,
  currentTabTitle: string | undefined,
  domain: string | null,
): Promise<OverlayCard> {
  if (shape === 'github-repo') return composeGithubRepoCard(persona.personaId, currentTabTitle, domain);
  return composeFinancialContextCard(persona, currentTabTitle, domain);
}

/**
 * The unmapped-domain composer. Kept as a SEPARATE export (not folded into
 * `composeOverlayCard`'s shape switch) because its call condition is not "no
 * shape resolved" but the more specific "no shape resolved AND a currently-
 * granted observation legitimately exists for this domain" — a distinction
 * only the route can make (it alone holds the four-way reason computation).
 * See the `GenericOverlayCard` doc comment for what this does and does not
 * fabricate.
 */
/**
 * PURE — the query candidates for the generic card's registry search, in
 * priority order (domain hint first when present, since it's a certain
 * product-name signal vs. the title's incidental one). Deduped
 * case-insensitively so a domain hint that happens to equal the title
 * (unlikely, but possible) doesn't search twice. Exported for direct,
 * I/O-free testing — this is the one place the "which queries do we try"
 * decision is made; the I/O shell below just executes each and merges.
 */
export function buildRegistrySearchCandidates(
  domain: string | null | undefined,
  currentTabTitle: string | null | undefined,
): string[] {
  const hint = domainSearchHint(domain);
  const title = (currentTabTitle ?? '').trim();
  const raw = [hint, title.length > 0 ? title : null].filter((c): c is string => Boolean(c));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of raw) {
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

/**
 * THE GENERAL "what does metaMe already know about this page" LOOKUP.
 *
 * Operator-directed 2026-07-25, answering their own question — "would this
 * apply generally or just github?" — with: generally. Before this, only the
 * generic (unmapped-domain) card searched the registry at all; the financial-context
 * card had NO registry lookup whatsoever, and the github card had only its
 * narrow repo-name "linked iQube" question. So the broadest capability lived
 * on the LEAST specific shape, which is backwards.
 *
 * Now every shape carries the same lookup, driven by the same two honest
 * signals (`buildRegistrySearchCandidates`: the domain's product hint where
 * one is declared, plus the page's own title) through the same federation
 * functions. Shape-specific panels stay shape-specific — github keeps its
 * repo-name `registryMatch`, financial-context keeps its capability match — this is
 * the common floor beneath them, not a replacement for either.
 *
 * `excludeRefs` keeps a card from listing the same hit twice when a
 * shape-specific panel already surfaced it.
 */
async function resolveRelatedMatches(
  domain: string | null | undefined,
  currentTabTitle: string | null | undefined,
  excludeRefs: ReadonlySet<string> = new Set(),
): Promise<CompanionSearchResult[]> {
  const candidates = buildRegistrySearchCandidates(domain, currentTabTitle);
  if (candidates.length === 0) return [];

  const perCandidate = await Promise.all(candidates.map((q) => searchAllSourcesFor(q)));

  // Merge in candidate priority order, deduping by ref.
  const seen = new Set<string>(excludeRefs);
  const out: CompanionSearchResult[] = [];
  for (const results of perCandidate) {
    for (const result of results) {
      if (seen.has(result.ref)) continue;
      seen.add(result.ref);
      out.push(result);
    }
  }
  return out.slice(0, 5);
}

async function searchAllSourcesFor(query: string): Promise<CompanionSearchResult[]> {
  const [iqubeMatches, assetMatches, research] = await Promise.all([
    searchRegistryIQube(query).catch(() => []),
    searchRegistryAsset(query).catch(() => []),
    searchResearch(query).catch(() => []),
  ]);
  return rankSearchResults([...iqubeMatches, ...assetMatches, ...research], query);
}

export async function composeGenericOverlayCard(
  persona: ActivePersonaContext,
  currentTabTitle: string | undefined,
  domain: string,
): Promise<GenericOverlayCard> {
  // Uses the SAME `resolveRelatedMatches` every other shape now uses — this
  // composer used to carry its own inline copy of the merge/dedupe logic,
  // which became a duplicate the moment the lookup was generalised.
  const [standing, relatedMatches] = await Promise.all([
    buildStandingSummary(persona.personaId),
    resolveRelatedMatches(domain, currentTabTitle),
  ]);

  return {
    shape: 'generic',
    domain,
    standing,
    identifiability: persona.identifiability,
    cartridgeFlags: persona.cartridgeFlags,
    relatedMatches,
  };
}
