/**
 * Corpus Scout — Constitutional Discovery amendment: a curated, static
 * institution-name -> homepage lookup for the WELL-KNOWN standard-setting
 * bodies already seeded into the Institutional Registry (financial-services
 * first instance). This is NOT a search step — it's the same kind of
 * steward-curated fact as the institution names themselves, just extended
 * to include the one additional fact ("what's their homepage") a steward
 * would otherwise have to look up and paste in by hand.
 *
 * Why this is consistent with Law I (institution-first, never search-first):
 * a canonical name -> known-public-fact mapping is a directory lookup, not a
 * web search. It never queries a search engine, never ranks results, and
 * never runs for an institution not already in this curated list — if a
 * name isn't here, resolution fails honestly (see `resolveCanonicalHomepage`
 * returning `null`), it never falls back to search.
 *
 * This list is a starting point, not a guarantee: entries are the
 * organizations' well-known public homepages, curated by the operator/agent
 * at build time, not verified against a live registry. A steward can always
 * override any institution's `seedUrl` directly (`domainConstitution.ts`'s
 * `upsertInstitutionEntry`) if an entry here is wrong or an institution
 * needs a more specific starting page than its bare homepage.
 *
 * Deliberately excludes entries that aren't a navigable organization with
 * its own site (e.g. "MiCA (EU framework)" is a regulation, not a body) —
 * those stay unresolvable until a steward provides a seedUrl, rather than
 * guessing a proxy.
 */

const CANONICAL_INSTITUTION_HOMEPAGES: Readonly<Record<string, string>> = {
  bis: 'https://www.bis.org',
  fca: 'https://www.fca.org.uk',
  ecb: 'https://www.ecb.europa.eu',
  fatf: 'https://www.fatf-gafi.org',
  'bis committee on payments and market infrastructures': 'https://www.bis.org/cpmi/',
  sec: 'https://www.sec.gov',
  esma: 'https://www.esma.europa.eu',
  fincen: 'https://www.fincen.gov',
  cftc: 'https://www.cftc.gov',
  iais: 'https://www.iaisweb.org',
  naic: 'https://www.naic.org',
  pra: 'https://www.bankofengland.co.uk/prudential-regulation',
  eiopa: 'https://www.eiopa.europa.eu',
  imf: 'https://www.imf.org',
  'world bank': 'https://www.worldbank.org',

  // ── Commercialisation, first tier (PRD-IDE-002 / SPEC-CIR-001) ───────────
  //
  // PROVENANCE: every URL below was SUPPLIED VERBATIM BY THE OPERATOR in the
  // direction of 2026-07-27. None was searched for, inferred, or constructed,
  // and none has been verified from the build environment — outbound HTTPS is
  // blocked there, so any claim of verification would be false. They carry
  // exactly the posture this file's header already states: curated at build
  // time, not checked against a live registry. The first Agent B/C discovery
  // run on the deployed app is what verifies them, and a dead entry surfaces
  // as an honest retrieval failure, never as a search fallback.
  //
  // `world bank` is NOT restated here — the same institution already appears
  // above as a Financial Services authority with the same operator-supplied
  // URL. One institution, one homepage fact, one entry.
  //
  // The operator's SECOND tier (a16z, First Round Review, Y Combinator
  // Library, McKinsey/Bain/BCG/Deloitte Insights, PwC Strategy, Accenture
  // Research) is deliberately ABSENT: no URL was supplied for any of them, so
  // resolution fails honestly and they stay ineligible for Agent B/C until a
  // steward provides a seedUrl. See `institutionalRegistry.ts`.
  nber: 'https://www.nber.org',
  'kauffman foundation': 'https://www.kauffman.org',
  ssrn: 'https://www.ssrn.com',
  oecd: 'https://www.oecd.org',
  'mit sloan': 'https://mitsloan.mit.edu',
  'stanford graduate school of business': 'https://www.gsb.stanford.edu',
  'harvard business school': 'https://www.hbs.edu',
  'strategic management society': 'https://www.strategicmanagement.net',
  'santa fe institute': 'https://www.santafe.edu',
  incose: 'https://www.incose.org',
  'silicon valley product group': 'https://www.svpg.com',
  'product school': 'https://productschool.com',
  strategyzer: 'https://www.strategyzer.com',
  'lean startup': 'https://theleanstartup.com',
};

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/** Returns the curated homepage for a known institution name, or `null` if
 *  it isn't in the list — never a guess, never a search fallback. */
export function resolveCanonicalHomepage(institutionName: string): string | null {
  return CANONICAL_INSTITUTION_HOMEPAGES[normalize(institutionName)] ?? null;
}

/** Exposed for the seed-backfill migration companion script and for
 *  displaying "known institutions" hints in the UI, if ever useful. */
export function listCanonicalInstitutionNames(): string[] {
  return Object.keys(CANONICAL_INSTITUTION_HOMEPAGES);
}
