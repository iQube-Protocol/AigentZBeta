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
