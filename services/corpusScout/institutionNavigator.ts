/**
 * Corpus Scout — Constitutional Discovery amendment §4/§5/§9 phase 3: Agent B
 * (Discovery Agent, reframed) + a bounded Agent C (Resolver Agent).
 * See `codexes/packs/agentiq/updates/
 * 2026-07-23_prd-ica-001-amendment-constitutional-discovery-domain-architect.md`.
 *
 * §4 Agent B: "given a known Institutional Registry entry, locate that
 * institution's own publication/recommendations listing" — institution-
 * targeted navigation, never open keyword search (Law I's institution-first
 * philosophy; general search stays reserved for §7 Open Discovery, the
 * doubly-gated last resort).
 *
 * §5 Agent C: "recursive traversal from an institution's page -> publication
 * page -> download link -> redirect -> final artifact." Implemented here as
 * a BOUNDED two-level walk (seed page, then a capped number of listing
 * pages it links to) — narrow, bounded, explainable, matching PRD-ICA-001's
 * own framing of this task, not an open-ended generic crawler. Depth,
 * page-fetch count, and candidate count are all capped; nothing here retries
 * indefinitely or follows links outside these bounds.
 *
 * Evaluated per PRD-ICA-001 §0.4: this is a DEDICATED lightweight HTML
 * fetch + link-extraction module, not `services/aa-api/src/browser/*`'s
 * session/mount/takeover machinery (built for interactive user-facing
 * browsing with a live iframe view, not a bounded backend link walk).
 * Shares `retrieval.ts`'s `followRedirects()` mechanic (Extend, Don't
 * Duplicate) — never a second redirect-following implementation.
 *
 * Never throws — every failure path returns a structured result, mirroring
 * `retrieval.ts`'s honest-failure ethos (PRD-ICA-001 §12).
 */

import { followRedirects } from './retrieval';

const MAX_LISTING_PAGES_TO_FOLLOW = 5;
const MAX_TOTAL_PAGES_FETCHED = 1 + MAX_LISTING_PAGES_TO_FOLLOW; // seed + listing pages
const MAX_CANDIDATES = 40;
const MAX_LINKS_PER_PAGE = 400; // bound regex work on pathological pages
const HTML_FETCH_TIMEOUT_MS = 15_000;

/** Coarse, advisory heuristics (like `intelligence.ts`'s structural-value
 *  tags) — a single keyword match is enough to consider a link a candidate;
 *  false positives are fine, they land as `pending_review` candidates a
 *  steward reviews same as any manually-submitted URL. */
const PUBLICATION_LISTING_PATTERN =
  /\b(publications?|recommendations?|guidance|standards?|reports?|papers?|circulars?|press[- ]?releases?|resources?|library|research|documents?)\b/i;
const DOCUMENT_LINK_PATTERN =
  /\.pdf(?:[?#]|$)/i;
const DOCUMENT_TEXT_PATTERN =
  /\b(download|full text|read (?:the )?(?:report|paper|document)|view (?:pdf|report|document))\b/i;

export interface DiscoveredLink {
  href: string;
  text: string;
}

export type NavigatorFailureClass = 'timeout' | 'redirect-loop' | 'unknown' | 'not-html' | 'empty';

export interface DocumentCandidate {
  /** The final document URL to submit as a candidate source. */
  documentUrl: string;
  /** Anchor text at the point the document link was found — used as the
   *  candidate's title draft; a steward can always edit it on review. */
  title: string;
  /** Where this candidate was found: the seed URL, and the intermediate
   *  listing page URL if it took two hops. Fed into `createCandidateSource`'s
   *  `discoveryUrl` so the resulting `resolutionChain.discoveryUrl` records
   *  the true institution-targeted path, not just the final document URL. */
  discoveryUrl: string;
  foundOnUrl: string;
}

export interface InstitutionDiscoveryResult {
  ok: boolean;
  error?: string;
  failureClass?: NavigatorFailureClass;
  pagesFetched: number;
  candidates: DocumentCandidate[];
}

function resolveHref(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Minimal `<a href="...">text</a>` extractor. Regex-based by design — no DOM
 * parser dependency, matching `retrieval.ts`'s "no axios/node-fetch dep"
 * ethos. Good enough for a HEURISTIC discovery pass; it does not need to be
 * a correct HTML parser, only to find plausible links for a human reviewer
 * to eventually confirm.
 */
export function extractLinks(html: string, baseUrl: string): DiscoveredLink[] {
  const links: DiscoveredLink[] = [];
  const anchorPattern = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while (links.length < MAX_LINKS_PER_PAGE && (match = anchorPattern.exec(html)) !== null) {
    const rawHref = match[1].trim();
    if (!rawHref || rawHref.startsWith('#') || rawHref.toLowerCase().startsWith('javascript:') || rawHref.toLowerCase().startsWith('mailto:')) {
      continue;
    }
    const resolved = resolveHref(rawHref, baseUrl);
    if (!resolved) continue;
    const text = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    links.push({ href: resolved, text });
  }
  return links;
}

async function fetchHtml(
  url: string,
): Promise<{ ok: true; html: string; finalUrl: string } | { ok: false; failureClass: NavigatorFailureClass }> {
  const followed = await followRedirects(url, { timeoutMs: HTML_FETCH_TIMEOUT_MS, accept: 'text/html,*/*' });
  if (!followed.ok) return { ok: false, failureClass: followed.failureClass };
  const contentType = followed.response.headers.get('content-type') ?? '';
  if (contentType && !contentType.toLowerCase().includes('html') && !contentType.toLowerCase().includes('text')) {
    return { ok: false, failureClass: 'not-html' };
  }
  let html: string;
  try {
    html = await followed.response.text();
  } catch {
    return { ok: false, failureClass: 'unknown' };
  }
  if (!html.trim()) return { ok: false, failureClass: 'empty' };
  return { ok: true, html, finalUrl: followed.finalUrl };
}

function classifyLinks(links: DiscoveredLink[]) {
  const documentLinks: DiscoveredLink[] = [];
  const listingLinks: DiscoveredLink[] = [];
  for (const link of links) {
    if (DOCUMENT_LINK_PATTERN.test(link.href) || DOCUMENT_TEXT_PATTERN.test(link.text)) {
      documentLinks.push(link);
    } else if (PUBLICATION_LISTING_PATTERN.test(link.href) || PUBLICATION_LISTING_PATTERN.test(link.text)) {
      listingLinks.push(link);
    }
  }
  return { documentLinks, listingLinks };
}

/**
 * Agent B + bounded Agent C in one pass: fetch the seed URL, collect any
 * direct document links found there, then follow up to
 * `MAX_LISTING_PAGES_TO_FOLLOW` publication-listing-looking links one level
 * deep and collect document links found on those. Total pages fetched is
 * capped at `MAX_TOTAL_PAGES_FETCHED`; total candidates at `MAX_CANDIDATES`.
 * Never throws.
 */
export async function runInstitutionDiscovery(seedUrl: string): Promise<InstitutionDiscoveryResult> {
  const trimmed = seedUrl.trim();
  if (!trimmed) return { ok: false, error: 'seedUrl is required', pagesFetched: 0, candidates: [] };

  const seed = await fetchHtml(trimmed);
  if (!seed.ok) {
    return { ok: false, failureClass: seed.failureClass, error: `failed to fetch seed URL: ${seed.failureClass}`, pagesFetched: 0, candidates: [] };
  }

  const candidates: DocumentCandidate[] = [];
  const seenDocumentUrls = new Set<string>();
  const addCandidate = (link: DiscoveredLink, foundOnUrl: string) => {
    if (candidates.length >= MAX_CANDIDATES) return;
    if (seenDocumentUrls.has(link.href)) return;
    seenDocumentUrls.add(link.href);
    candidates.push({ documentUrl: link.href, title: link.text || link.href, discoveryUrl: trimmed, foundOnUrl });
  };

  const seedLinks = extractLinks(seed.html, seed.finalUrl);
  const { documentLinks: seedDocumentLinks, listingLinks: seedListingLinks } = classifyLinks(seedLinks);
  for (const link of seedDocumentLinks) addCandidate(link, seed.finalUrl);

  let pagesFetched = 1;
  for (const listingLink of seedListingLinks.slice(0, MAX_LISTING_PAGES_TO_FOLLOW)) {
    if (pagesFetched >= MAX_TOTAL_PAGES_FETCHED || candidates.length >= MAX_CANDIDATES) break;
    const listing = await fetchHtml(listingLink.href);
    pagesFetched += 1;
    if (!listing.ok) continue; // one bad listing page doesn't fail the whole run
    const { documentLinks } = classifyLinks(extractLinks(listing.html, listing.finalUrl));
    for (const link of documentLinks) addCandidate(link, listing.finalUrl);
  }

  return { ok: true, pagesFetched, candidates };
}
