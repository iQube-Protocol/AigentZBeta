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
  // Operator-supplied landing page (2026-07-28): the CPMI overview carries the
  // committee charter, work programme, and links to current publications —
  // a better navigation start than the bare `/cpmi/` section root.
  'bis committee on payments and market infrastructures': 'https://www.bis.org/cpmi/about/overview.htm',
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

  // ── Commercialisation, wave 2 (operator RULING, 2026-07-27) ─────────────
  //
  // The five pillars the first-tier list left empty, populated on the
  // operator's own instruction ("Do not waive the five empty pillars").
  // Same provenance posture as above: OPERATOR-SUPPLIED, unverified here,
  // and — per the ruling — explicitly NOT to be treated as verified merely
  // because they are operator-supplied or resolve in an ordinary browser.
  // Every registry entry using them enters at `pending_verification`.
  //
  // FOUR institutions the ruling reuses are NOT restated here, because they
  // are already in this directory and one institution has one homepage fact:
  //   · OECD          (trust-formation, pricing — added above for adoption/scaling)
  //   · NBER          (pricing, commercial-failure-modes — added above)
  //   · World Bank    (Financial Services entry, above)
  //   · BIS Committee on Payments and Market Infrastructures — RECONCILED,
  //     see the note below.
  //
  // ── BIS CPMI reconciliation ────────────────────────────────────────────
  // The operator's first institutional seed for CPMI was `https://www.bis.org`;
  // the directory held `https://www.bis.org/cpmi/` for the same named
  // institution. These were not in conflict — the operator's value was the
  // PARENT of the existing one — and the more specific value was kept, for the
  // reason this file's header gives: a steward may need "a more specific
  // starting page than its bare homepage". It is also strictly better for
  // Agent B, whose job is to find the institution's publication listing:
  // bis.org surfaces all of BIS's output, the committee path surfaces the
  // committee's. A bare `bis.org` key would ALSO collide with the plain `bis`
  // entry above and give two institutions one starting page.
  //
  // NARROWED AGAIN 2026-07-28 (operator ruling) to
  // `https://www.bis.org/cpmi/about/overview.htm` — the CPMI overview, which
  // carries the charter, work programme, and links to the current publication
  // collections. Same principle one rung finer: the more specific page that
  // still enumerates the committee's output is the better navigation start.
  // The document-level acquisition seeds now live in
  // `institutionalRegistry.ts` (COMMERCIALISATION_ACQUISITION_SEEDS) and point
  // at PUBLICATION INDEXES, never at individual reports — see the ruling
  // recorded there for why a pinned document seed is a defect.
  'uk competition and markets authority': 'https://www.gov.uk/government/organisations/competition-and-markets-authority',
  'world trade organization': 'https://www.wto.org',
  'un trade and development (unctad)': 'https://unctad.org',
  uncitral: 'https://uncitral.un.org',
  'u.s. bureau of labor statistics': 'https://www.bls.gov',

  // ── Commercialisation, wave 3 (operator RULING on Law II, 2026-07-27) ────
  //
  // "Do not waive Law II. Add a second authority from a different tradition
  // for each pillar." NBER is REUSED for `partnerships` (a third pillar for
  // one institution) and needs no new key — one institution, one homepage
  // fact. Only NISTA is new.
  //
  // The operator live-checked both URLs in a browser. **That is not
  // verification** under the protocol in `registryVerification.ts`: nothing
  // reaches `verified` except through the four-conjunct run on the deployed
  // app. Both enter at `pending_verification` like every other URL here.
  'national infrastructure and service transformation authority':
    'https://www.gov.uk/government/organisations/national-infrastructure-and-service-transformation-authority',
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
