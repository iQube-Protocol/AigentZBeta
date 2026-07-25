/**
 * Constitutional Overlay — domain → shape mapping.
 *
 * PRD-MMC-IMPL-002 Increment 2, Step 2 (RATIFIED 2026-07-23).
 * See: codexes/packs/agentiq/updates/2026-07-23_prd-mmc-impl-002-companion-phase3-implementation-plan.md §3.
 *
 * A SMALL, EXPLICIT domain → shape table — NOT a general-purpose arbitrary-
 * app classifier (plan §4 non-goal, ratified). Two illustrative shapes:
 * `github.com`/`*.github.com` → `'github-repo'`; a banking-class domain set
 * → `'banking'` (QriptoCENT/Wallet/Standing/Passport/Delegations). Expanding
 * this table is a natural follow-up, not blocked by the ratifying pass.
 *
 * 2026-07-23 addition: the platform's own domains (`metame.com`,
 * `dev-beta.aigentz.me`) were added to the BANKING set, not a new shape --
 * being on the platform's own site is exactly the "wallet/standing/passport"
 * context the banking card already composes, so it's a genuine semantic fit,
 * not an arbitrary stretch. `google.com` was deliberately NOT added: it
 * doesn't fit either shape's data model, and forcing it into one would
 * violate this file's own ratified principle below (no fabricated card for
 * an unmapped domain) -- for google.com, the honest "no overlay available"
 * empty state is the correct behavior, not a bug.
 *
 * Pure, no I/O. Returns `null` for any unmapped domain — the caller renders
 * an honest "no overlay available for this page" rather than a fabricated
 * generic card.
 */

export type OverlayShape = 'github-repo' | 'banking';

const GITHUB_DOMAIN_RE = /(^|\.)github\.com$/i;

/** Illustrative banking-class domain set — deliberately small (plan §4). */
const BANKING_DOMAINS = new Set<string>([
  'coinbase.com',
  'www.coinbase.com',
  'metame.com',
  'www.metame.com',
  'dev-beta.aigentz.me',
]);

export function shapeForDomain(domain: string | null | undefined): OverlayShape | null {
  if (!domain) return null;
  const normalized = domain.trim().toLowerCase();
  if (normalized.length === 0) return null;
  if (GITHUB_DOMAIN_RE.test(normalized)) return 'github-repo';
  if (BANKING_DOMAINS.has(normalized)) return 'banking';
  return null;
}

/**
 * SHAPE → CCB CAPABILITY IDS (operator-approved 2026-07-24, "Yes to mp overlay").
 *
 * The SAME explicit-table philosophy as `BANKING_DOMAINS` above, one level
 * further along: a small, hand-declared list of Constitutional Capability
 * Registry ids (`services/constitutional/capabilityRegistry.ts`) that are
 * genuinely relevant to a citizen looking at a page of this shape. NOT a
 * semantic classifier, NOT a free-text query — the same non-goal this file's
 * header already rules out for domains applies to capabilities.
 *
 * Deliberately narrow and honest in both directions:
 *   - An id listed here that is NOT actually registered simply produces no
 *     match — never a placeholder, never a fabricated entry (the same
 *     "degrade honestly" contract as `registryMatch: null`).
 *   - `github-repo` is intentionally EMPTY: that shape already carries its
 *     own capability signal via `recommendProducers('software',
 *     'operational')`, which reads a different system (the closed
 *     `CapabilityId` producer graph). Adding CCB ids there would put two
 *     unrelated capability notions in one card. Left declared-but-empty
 *     rather than omitted so the table stays exhaustive over `OverlayShape`
 *     and a future shape addition is a compile error, not a silent gap.
 *
 * Ids below are the two financial-services capabilities registered by
 * `scripts/register-ccb-capabilities.ts` — the natural constitutional answer
 * to "what governs money-shaped work here?" on a banking-shaped page.
 *
 * KNOWN TRAP (hit 2026-07-25, both deep links 404'd as "Codex not found"):
 * the embed route (`app/(embed)/triad/embed/codex/[codexSlug]/page.tsx`)
 * builds its lookup key by appending `-codex` to whatever string sits in the
 * URL path UNLESS it already ends in `-codex`/`-cartridge`, then matches
 * that against each `CodexConfig.id` — NOT `.slug`. For `MONEYPENNY_CARTRIDGE`
 * (`id: 'moneypenny-codex'`, `slug: 'moneypenny'`) slug+`-codex` happens to
 * equal id. For `VENTURE_LAB_CODEX` it does NOT: `id: 'alpha-knyt-codex'`
 * (kept for historical reasons — CLAUDE.md's Venture Lab α naming note),
 * `slug: 'venture-lab'`; `'venture-lab' + '-codex'` matches nothing. So
 * `CAPABILITY_ROUTES.slug` below is always the codex's real `id` (already
 * carrying the `-codex`/`-cartridge` suffix), which the embed route passes
 * through UNCHANGED — the one value that survives its suffix logic
 * regardless of how slug and id happen to relate. The parity canary
 * (tests/companion-observer.test.ts) asserts against `.id`, matching this.
 */
export const SHAPE_CAPABILITY_IDS: Record<OverlayShape, readonly string[]> = {
  'github-repo': [],
  banking: ['cap-moneypenny-financial-services', 'financial-services-capability-suite'],
};

/** PURE — the declared capability ids for a shape. Never an I/O call; the
 *  caller checks which of these are ACTUALLY registered. */
export function capabilityIdsForShape(shape: OverlayShape): readonly string[] {
  return SHAPE_CAPABILITY_IDS[shape] ?? [];
}

/**
 * CAPABILITY → THE SURFACE WHERE IT ACTUALLY OPERATES (2026-07-25).
 *
 * Operator, on seeing the capability rows render for the first time: *"I now
 * see the capability but what can be done with them?"* — a fair question,
 * because a registered capability with no route to its operating surface is
 * a label, not an affordance. This table is the answer: it turns each row
 * into a way IN.
 *
 * Deliberately a DEEP LINK to the existing surface, not a second
 * implementation of it. The Financial Services Capability Suite is a live
 * 12-step pipeline mounted at Venture Lab α → Financial Services
 * (`data/codex-configs.ts`, `VENTURE_LAB_CODEX` tab slug
 * `financial-services`, rendered by `FinancialServicesTab`). Rebuilding any
 * part of it inside a ~400px side panel would be the parallel-implementation
 * defect CLAUDE.md's "Extend, Don't Duplicate" forbids — and would fork a
 * money-moving surface, the worst possible place for two implementations to
 * drift.
 *
 * IDENTIFIER-FREE, exactly like `types/companionSearch.ts`'s routing
 * metadata: `{ slug, tab }` only. The persona is attached at RENDER time by
 * the panel via `buildCodexUrl(..., { personaId })` — this table never sees
 * or stores an identifier, so it stays a pure static constant safe to log.
 *
 * A capability absent from this table renders exactly as it does today (text
 * + brief ref, no link) rather than a dead or invented route — the same
 * "degrade honestly" contract as the shape table above. `slug`/`tab` values
 * below are read from `data/codex-configs.ts`, never guessed.
 */
export interface CapabilityRoute {
  /** For `buildCodexUrl`'s first argument — MUST be the codex's real `id`
   *  (e.g. 'alpha-knyt-codex'), NOT its `.slug`. See the "KNOWN TRAP" note
   *  above `SHAPE_CAPABILITY_IDS`: the embed route matches by id, and only
   *  a value that already carries the `-codex`/`-cartridge` suffix survives
   *  its suffix logic unchanged regardless of how slug and id relate. */
  readonly slug: string;
  /** Tab slug within that codex — `CodexTab.slug`. */
  readonly tab: string;
  /** Button label. Names the surface, so the operator knows where they land. */
  readonly label: string;
}

export const CAPABILITY_ROUTES: Record<string, CapabilityRoute> = {
  // VENTURE_LAB_CODEX.id === 'alpha-knyt-codex' (product name "Venture Lab α",
  // slug 'venture-lab' — id kept for historical reasons, see CLAUDE.md).
  // Tab id/slug 'financial-services' (CRP-003a Increment 3 — the Founder
  // Office Capability Suite).
  'financial-services-capability-suite': {
    slug: 'alpha-knyt-codex',
    tab: 'financial-services',
    label: 'Open Financial Services',
  },
  // MoneyPenny's runtime drives that same pipeline, so its operating surface
  // is the same tab — the runtime is the agent mode, not a separate console.
  'cap-moneypenny-financial-services': {
    slug: 'alpha-knyt-codex',
    tab: 'financial-services',
    label: 'Open Financial Services',
  },
};

/** PURE — the operating surface for a capability, or null when none is
 *  declared (render the row without a link; never invent a route). */
export function routeForCapability(capabilityId: string): CapabilityRoute | null {
  return CAPABILITY_ROUTES[capabilityId] ?? null;
}

/**
 * Best-effort repo-name candidate extracted from a GitHub tab title. GitHub
 * page titles commonly take the shape `owner/repo: description` or
 * `GitHub - owner/repo: description` or `owner/repo`. This is a heuristic,
 * not a parser — it exists only to produce a search query string for the
 * registry-match lookup (Step 2's own "best-effort match against the
 * registry by repo name" language); a query that turns out too broad or too
 * narrow degrades to more/fewer matches, never a wrong-account exposure.
 */
export function repoNameCandidateFromTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  let candidate = title.trim();
  candidate = candidate.replace(/^GitHub\s*-\s*/i, '');
  const colonIdx = candidate.indexOf(':');
  if (colonIdx > 0) candidate = candidate.slice(0, colonIdx);
  const dotIdx = candidate.indexOf(' · ');
  if (dotIdx > 0) candidate = candidate.slice(0, dotIdx);
  candidate = candidate.trim();
  return candidate.length > 0 ? candidate : null;
}
