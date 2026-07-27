/**
 * Discovery Domain Registry — the single authoritative declaration of which
 * DOMAINS the Invariant Discovery Engine (CFS-048) runs against, what each one
 * constitutionally IS, and what sub-domain ladder sits beneath it.
 *
 * Why this module exists (inv.engineering.036 — one authoritative location per
 * concern). Before PRD-IDE-002 the domain list was hand-copied in three places:
 * `SUB_DOMAIN_PRESETS` + `DEFAULT_DOMAIN` in `app/api/invariants/discovery/route.ts`,
 * `KNOWN_DOMAINS` in `CorpusScoutTab.tsx`, and a hardcoded `useState("financial-services")`
 * in `InvariantDiscoveryTab.tsx`. Adding a second domain to three hand-maintained
 * copies is the exact stale-duplicate defect `tests/source-of-truth-parity.test.ts`
 * exists to fail the build on. Every surface now DERIVES from this registry.
 *
 * ── Two kinds of domain (PRD-IDE-002 §2) ────────────────────────────────────
 *
 *   vertical              an industry. Its evidence corpus is its own.
 *                         (financial-services — CRP-003)
 *   horizontal-capability a cross-cutting capability. It HAS no corpus of its
 *                         own; its evidence is OBSERVED INSIDE the verticals,
 *                         and an invariant earns confidence by recurring across
 *                         several of them. (commercialisation — PRD-IDE-002)
 *
 * ── Observation-domain keys (the mechanism that makes recurrence DERIVABLE) ──
 *
 * A horizontal domain's evidence is stored under a QUALIFIED domain key,
 * `<discoveryDomain>/<observedDomain>` — e.g. `commercialisation/media`. That
 * single convention buys three properties with no schema change:
 *
 *   1. Recurrence is a QUERY, never a stored score. "In how many distinct
 *      domains does evidence for this candidate exist" is read off the evidence
 *      rows themselves (`computeRecurrence`), so a score can never drift from
 *      the evidence that justifies it — the inv.engineering.036 defect applied
 *      to a number instead of a list.
 *   2. No cross-contamination. A `financial-services` discovery run reads
 *      `domain = 'financial-services'` and therefore never sweeps up
 *      commercialisation observations made in the financial-services vertical,
 *      which live under `commercialisation/financial-services`.
 *   3. The sub-domain axis stays free for the TAXONOMY (pricing, adoption, …),
 *      because the observed vertical rides on the domain axis. Two orthogonal
 *      questions, two orthogonal columns.
 *
 * Nothing in this module talks to the database, the LLM, or `domain_profiles`
 * (SPEC-CDR-001) — that registry answers a RUNTIME question ("which domain is
 * this operator acting in") and is deliberately uncoupled from this one, which
 * answers a RESEARCH question ("which domain is this candidate discovered for").
 */

export type DiscoveryDomainKind = 'vertical' | 'horizontal-capability';

export interface DiscoverySubDomain {
  value: string;
  label: string;
}

export interface DiscoveryDomainDefinition {
  /** The `discovery_candidates.domain` / `discovery_evidence.domain` value. */
  key: string;
  label: string;
  kind: DiscoveryDomainKind;
  /**
   * The domain's CONSTITUTIONAL DEFINITION — carried verbatim from its charter
   * and pinned against the charter text by a docs-mirror canary, so the code
   * and the document can never disagree about what the domain is.
   */
  definition: string;
  /** The chartering document (repo path). */
  charter: string;
  /** The sub-domain ladder offered beneath the domain baseline. */
  subDomains: readonly DiscoverySubDomain[];
  /**
   * For a horizontal-capability domain: the VERTICALS its evidence is observed
   * inside. Empty for a vertical (its corpus is its own).
   */
  observedIn: readonly string[];
  /**
   * Neighbouring domains a discovered candidate is CLASSIFIED against
   * (supported / equivalent / specialized / split / novel). These are
   * comparison references, NOT corpora — nothing is acquired from them.
   */
  tangentialDomains: readonly string[];
}

/** Separator for a qualified observation-domain key. */
export const OBSERVATION_DOMAIN_SEPARATOR = '/';

/** `commercialisation` + `media` → `commercialisation/media`. */
export function observationDomainKey(discoveryDomain: string, observedDomain: string): string {
  return `${discoveryDomain}${OBSERVATION_DOMAIN_SEPARATOR}${observedDomain}`;
}

/**
 * Inverse of {@link observationDomainKey}. An UNQUALIFIED key (a vertical's own
 * corpus) parses to itself as the observed domain — so a vertical candidate's
 * recurrence is 1, which is exactly right: it was observed in one domain.
 */
export function parseObservationDomain(key: string): { discoveryDomain: string; observedDomain: string } {
  const i = key.indexOf(OBSERVATION_DOMAIN_SEPARATOR);
  if (i < 0) return { discoveryDomain: key, observedDomain: key };
  return { discoveryDomain: key.slice(0, i), observedDomain: key.slice(i + 1) };
}

// ── The registry ────────────────────────────────────────────────────────────

/**
 * Financial Services — the first VERTICAL discovery domain. Sub-domains are
 * CRP-003's five capability domains + the sector-native areas the operator
 * named + the QriptoCENT sub-corpus (PRD-MPY-001 §3.5).
 */
const FINANCIAL_SERVICES: DiscoveryDomainDefinition = {
  key: 'financial-services',
  label: 'Financial Services',
  kind: 'vertical',
  definition:
    'An IRL-catalogued area of work with three SIMULTANEOUS outputs — Scientific (candidate invariants + experimental evidence), Platform (reusable constitutional primitives implemented in code), and Commercial (a Founder Office capability or service).',
  charter: 'codexes/packs/irl/foundation/CRP-003_financial-services-constitutional-capability-domain.md',
  subDomains: [
    { value: 'investment-operations', label: 'Investment Operations (CRP-003 D1)' },
    { value: 'market-operations', label: 'Market Operations (CRP-003 D2)' },
    { value: 'financial-intelligence', label: 'Financial Intelligence (CRP-003 D3)' },
    { value: 'financial-integrity', label: 'Constitutional Financial Integrity (CRP-003 D4)' },
    { value: 'constitutional-commerce', label: 'Constitutional Commerce (CRP-003 D5)' },
    { value: 'payments', label: 'Payments' },
    { value: 'trading', label: 'Trading' },
    { value: 'banking', label: 'Banking' },
    { value: 'custody', label: 'Custody' },
    { value: 'cross-border', label: 'Cross-border' },
    { value: 'qriptocent', label: 'QriptoCENT (PRD-MPY-001 D6)' },
  ],
  observedIn: [],
  tangentialDomains: [],
};

/**
 * Commercialisation — the first HORIZONTAL CAPABILITY discovery domain
 * (PRD-IDE-002). Deliberately a PARALLEL programme to Financial Services, not
 * an extension of it: Financial Services is a vertical domain, Commercialisation
 * is a horizontal capability domain that must be discoverable and reusable
 * across every vertical the platform supports.
 *
 * The taxonomy below is the operator's fifteen sub-domains AFTER the corpus-
 * tested revision PRD-IDE-002 §5 records (three merges, one split, three
 * additions, one rejection). The PRD is the argued form; this is the executable
 * form; a canary pins the two together.
 */
const COMMERCIALISATION: DiscoveryDomainDefinition = {
  key: 'commercialisation',
  label: 'Commercialisation',
  kind: 'horizontal-capability',
  // Operator-supplied, verbatim (PRD-IDE-002 §1). Pinned by canary.
  definition:
    'Commercialisation is the discovery of recurring structural patterns governing the creation, delivery, adoption, exchange and sustainable capture of value across domains.',
  charter: 'codexes/packs/irl/foundation/PRD-IDE-002_commercialisation-invariant-discovery.md',
  subDomains: [
    { value: 'value-proposition', label: 'Value Proposition' },
    { value: 'customer-discovery', label: 'Customer Discovery & Fit' },
    { value: 'trust-formation', label: 'Trust Formation (added — §5.3)' },
    { value: 'pricing', label: 'Pricing' },
    { value: 'distribution', label: 'Distribution & Go-to-Market' },
    { value: 'adoption', label: 'Adoption' },
    { value: 'revenue-architecture', label: 'Revenue Architecture' },
    { value: 'settlement-exchange', label: 'Settlement & Exchange (split — §5.2)' },
    { value: 'partnerships', label: 'Partnerships & Ecosystem Development' },
    { value: 'outcome-assurance', label: 'Outcome Assurance & Retention (merged — §5.1)' },
    { value: 'scaling', label: 'Scaling' },
    { value: 'venture-operations', label: 'Venture Operations' },
    { value: 'commercial-governance', label: 'Commercial Governance' },
    { value: 'commercial-failure-modes', label: 'Commercial Failure Modes (added — §5.3)' },
  ],
  // Addendum A's three active platform domains, each with a REAL in-repo corpus.
  observedIn: ['financial-services', 'media', 'human-mobility-services'],
  tangentialDomains: [
    'financial-services',
    'economics',
    'operations',
    'product-management',
    'organisational-behaviour',
    'systems-engineering',
    'service-design',
    'innovation-management',
    'entrepreneurship',
    'platform-economics',
  ],
};

export const DISCOVERY_DOMAINS: readonly DiscoveryDomainDefinition[] = [FINANCIAL_SERVICES, COMMERCIALISATION];

/** The domain a discovery surface opens on when none is specified. */
export const DEFAULT_DISCOVERY_DOMAIN = FINANCIAL_SERVICES.key;

export function discoveryDomain(key: string): DiscoveryDomainDefinition | null {
  return DISCOVERY_DOMAINS.find((d) => d.key === key) ?? null;
}

/** Sub-domain presets for a domain. An unregistered domain gets none (free text only). */
export function subDomainPresets(key: string): DiscoverySubDomain[] {
  return [...(discoveryDomain(key)?.subDomains ?? [])];
}

/**
 * The `discovery_evidence.domain` values a discovery run for `key` should read.
 *
 * - vertical / unregistered → `[key]` (unchanged behaviour, the pre-existing path)
 * - horizontal-capability   → the qualified observation keys, one per vertical
 *
 * This is the ONLY place the horizontal/vertical corpus difference is decided;
 * the engine and the route both call it rather than branching on `kind`.
 */
export function evidenceDomainsFor(key: string): string[] {
  const d = discoveryDomain(key);
  if (!d || d.kind !== 'horizontal-capability' || d.observedIn.length === 0) return [key];
  return d.observedIn.map((observed) => observationDomainKey(key, observed));
}
