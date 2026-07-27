/**
 * Experimental populations — the MECHANICAL partition of the invariant corpus
 * by EVIDENCE PROVENANCE (operator ruling, 2026-07-27).
 *
 * ── The ruling this module implements ───────────────────────────────────────
 *
 * > "The key question is not where the invariant was discovered, but what its
 * > evidentiary basis is."
 *
 * The codebase previously conflated two different facts. `platform-derived`
 * was read as "IRL made this up", which is a claim about DISCOVERY. What §2a
 * actually needs to exclude is self-affinity — the crystal being tested
 * against its own doctrine restated — which is a claim about the EVIDENCE.
 * An invariant that the Invariant Discovery Engine extracted from FATF, Basel
 * or MiCA was discovered by the platform and authored by nobody in it; the
 * structure it compresses was not created here, so it satisfies the spirit of
 * §2a. An invariant compressed from this repo's own artefacts does not,
 * however it was found.
 *
 * Hence two orthogonal, separately-readable attributes:
 *
 *   evidence provenance  (`ProvenanceClass`, services/corpusScout/types.ts)
 *                        WHERE THE EVIDENCE CAME FROM. Five values. This is
 *                        the ONLY axis that decides the population.
 *   discovery provenance (`DiscoveryProvenance`, below)
 *                        WHO DISCOVERED THE INVARIANT. Has NO bearing on the
 *                        population — asserted by canary, because the whole
 *                        point of the ruling is that these never merge.
 *
 * Two further questions are answered elsewhere and are likewise not folded in
 * here: who RATIFIED it (`InvariantRecord.status` / `ratifiedSource` /
 * `provenance.canonical_basis`, governed by CFS-009 Law XI) and who
 * REPRESENTS it (the Constitutional Representation System).
 *
 * ── The populations ─────────────────────────────────────────────────────────
 *
 *   A  external-derived        external-established | external-empirical
 *   B  platform-derived        platform-derived | platform-hypothesized
 *   C  platform doctrine       platform-doctrine
 *
 *   EXP-P1 primary  = A            (the §2a refinement)
 *   EXP-P1 ablation = A ∪ B        (a permanent feature of every crystal report)
 *   C               = a separate experimental population, never in either.
 *
 * ── Why the population is COMPUTED and never stored ─────────────────────────
 *
 * A record carries its evidence provenance; the population is a function of
 * it. Storing the population too would be a second source of truth for a fact
 * the provenance already answers, and it would go stale silently the moment a
 * reclassification lands — the `inv.engineering.036` defect applied to a
 * label. It is a query, not a field. (Same reasoning as `computeRecurrence`
 * in the discovery engine.)
 *
 * Server-safe and dependency-free: pure functions over plain provenance bags.
 */

import { PROVENANCE_CLASSES, type ProvenanceClass } from '@/services/corpusScout/types';

// ── The orthogonal axis: who discovered the invariant ───────────────────────

/**
 * WHO DISCOVERED the invariant. The ruling names exactly one value today —
 * `ide`, the CFS-048 Invariant Discovery Engine. The vocabulary is deliberately
 * NOT padded with speculative values: an invariant with no recorded discovery
 * provenance reads as `null` ("not recorded"), which is honest, rather than
 * being defaulted into a category nobody assigned it.
 *
 * Recording `ide` here is a statement about process ONLY. It never moves an
 * invariant between populations, and `evidenceProvenanceDecidesPopulation`
 * (canary) asserts that it cannot.
 */
export type DiscoveryProvenance = 'ide';

export const DISCOVERY_PROVENANCES: readonly DiscoveryProvenance[] = ['ide'];

export function isDiscoveryProvenance(v: unknown): v is DiscoveryProvenance {
  return typeof v === 'string' && (DISCOVERY_PROVENANCES as readonly string[]).includes(v);
}

// ── The populations ─────────────────────────────────────────────────────────

export type ExperimentalPopulation = 'A' | 'B' | 'C';

/**
 * The evidence-provenance → population map. Exhaustive over `ProvenanceClass`
 * by the Record type, so a sixth provenance class cannot be added without
 * deciding which experimental population it lands in — the same compile-time
 * discipline `COMPOSITION_LAWS` applies to a new invariant namespace.
 */
export const POPULATION_BY_EVIDENCE_PROVENANCE: Record<ProvenanceClass, ExperimentalPopulation> = {
  'external-established': 'A',
  'external-empirical': 'A',
  'platform-derived': 'B',
  'platform-hypothesized': 'B',
  'platform-doctrine': 'C',
};

/** Population A only — the primary EXP-P1 evaluation population (§2a refined). */
export const PRIMARY_POPULATIONS: ReadonlySet<ExperimentalPopulation> = new Set<ExperimentalPopulation>(['A']);

/**
 * Populations A ∪ B — the ablation arm. Reported ALONGSIDE the primary result
 * in every crystal report, permanently: "if the conclusions survive both
 * analyses, that is scientifically stronger than relaxing the original rule."
 */
export const ABLATION_POPULATIONS: ReadonlySet<ExperimentalPopulation> = new Set<ExperimentalPopulation>(['A', 'B']);

// ── Reading the two axes off a record ───────────────────────────────────────

/**
 * The provenance-bag key names this reader accepts for evidence provenance,
 * in precedence order. `provenanceClass` is the structured field Corpus Scout
 * and `crystalReadiness` already use (and the `provenance_class` column's
 * camelCase form); `evidenceProvenance` is the name the 2026-07-27 ruling
 * gives the same attribute. Both are read so that neither surface has to be
 * rewritten to satisfy the other — one reader, two spellings, ONE meaning.
 */
const EVIDENCE_KEYS = ['provenanceClass', 'evidenceProvenance'] as const;
const DISCOVERY_KEYS = ['discoveryProvenance', 'discovery_provenance'] as const;

/**
 * Parse `key=value` pairs out of a free-text provenance `source` string —
 * the idiom the seed file already uses
 * (`"…; inclusionBasis=cross-domain-recurrence; recurrence=3; …"`).
 *
 * A value ends at the first `;`, `.` or whitespace, because both vocabularies
 * are hyphenated single tokens (`platform-derived`, `ide`) and the seed's
 * strings continue into prose immediately after the pair
 * (`"…; discoveryProvenance=ide. The two axes are …"`). Running to the next `;`
 * instead would swallow a sentence, and the swallowed value would then fail
 * validation and read as UNSET — a silent misclassification rather than an
 * error. (It did, on the first run of this parser.)
 */
function readSourceKey(source: unknown, key: string): string | null {
  if (typeof source !== 'string') return null;
  const m = source.match(new RegExp(`(?:^|[\\s;,.])${key}\\s*=\\s*([^;.,\\s]+)`));
  return m ? m[1].trim() : null;
}

function readAxis(
  provenance: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): string | null {
  if (!provenance) return null;
  for (const k of keys) {
    const v = provenance[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  for (const k of keys) {
    const v = readSourceKey(provenance.source, k);
    if (v) return v;
  }
  return null;
}

/**
 * WHERE THE EVIDENCE CAME FROM, or `null` when unrecorded. A record with no
 * recorded evidence provenance is NEVER assumed eligible — it falls outside
 * every population (fail closed; see {@link experimentalPopulation}).
 */
export function readEvidenceProvenance(
  provenance: Record<string, unknown> | null | undefined,
): ProvenanceClass | null {
  const raw = readAxis(provenance, EVIDENCE_KEYS);
  return raw && (PROVENANCE_CLASSES as readonly string[]).includes(raw) ? (raw as ProvenanceClass) : null;
}

/** WHO DISCOVERED IT, or `null` when unrecorded. Never affects the population. */
export function readDiscoveryProvenance(
  provenance: Record<string, unknown> | null | undefined,
): DiscoveryProvenance | null {
  const raw = readAxis(provenance, DISCOVERY_KEYS);
  return isDiscoveryProvenance(raw) ? raw : null;
}

/**
 * The record's experimental population, computed from its evidence provenance
 * ALONE. `null` means "unclassified" — not "A". An untagged invariant is not
 * silently admitted to the primary population; that would be the exact
 * assumption §2a exists to forbid.
 */
export function experimentalPopulation(
  provenance: Record<string, unknown> | null | undefined,
): ExperimentalPopulation | null {
  const ev = readEvidenceProvenance(provenance);
  return ev ? POPULATION_BY_EVIDENCE_PROVENANCE[ev] : null;
}

/** Eligible for the PRIMARY EXP-P1 evaluation population (Population A only). */
export function inPrimaryPopulation(provenance: Record<string, unknown> | null | undefined): boolean {
  const p = experimentalPopulation(provenance);
  return p !== null && PRIMARY_POPULATIONS.has(p);
}

/** Eligible for the ABLATION arm (Populations A ∪ B). */
export function inAblationPopulation(provenance: Record<string, unknown> | null | undefined): boolean {
  const p = experimentalPopulation(provenance);
  return p !== null && ABLATION_POPULATIONS.has(p);
}

export interface PopulationPartition<T> {
  A: T[];
  B: T[];
  C: T[];
  /** No recorded evidence provenance — in no population, and reported as such. */
  unclassified: T[];
}

/**
 * Partition any collection of provenance-bearing records into A / B / C /
 * unclassified. This is how a reader COMPUTES the populations from the records
 * rather than reading them out of prose — the ruling's "population
 * partitioning must be mechanical".
 */
export function partitionByPopulation<T>(
  records: readonly T[],
  getProvenance: (r: T) => Record<string, unknown> | null | undefined,
): PopulationPartition<T> {
  const out: PopulationPartition<T> = { A: [], B: [], C: [], unclassified: [] };
  for (const r of records) {
    const p = experimentalPopulation(getProvenance(r));
    if (p === null) out.unclassified.push(r);
    else out[p].push(r);
  }
  return out;
}

// ── Reclassification — a recorded event, never a quiet field edit ───────────

/**
 * A change of evidence provenance. When PRD-IDE-002 §7's external corpus lands
 * and independently re-derives a candidate that today is `platform-derived`,
 * that invariant's evidence provenance changes and it becomes eligible for the
 * primary population. That transition is a CLAIM ABOUT EVIDENCE, so it must
 * arrive with the evidence that justifies it and leave a trace — not be a
 * field someone edited.
 */
export interface ProvenanceReclassification {
  from: ProvenanceClass | null;
  to: ProvenanceClass;
  /**
   * The independent sources that justify the new class — DOIs, URLs, corpus
   * source ids, `discovery_evidence` ids. At least one is REQUIRED; a
   * reclassification with no evidence is refused, which is the whole point.
   */
  evidenceRefs: string[];
  rationale: string;
  /** ISO timestamp of the reclassification act. */
  at: string;
  /** Who performed it — a T2-safe commitment or an agent id, never a raw T0 id. */
  actor: string;
}

/**
 * A citation that is obviously a REPO-INTERNAL artefact. Used only to refuse a
 * reclassification INTO Population A that cites nothing but internal material —
 * the laundering failure mode: relabelling platform evidence as external by
 * editing a field and citing the same repo files it was compressed from.
 *
 * HEURISTIC and stated as such: it cannot verify that a DOI resolves or that a
 * URL is an independent publisher. It refuses the obvious case, which is the
 * case that would actually occur. A human reviewer remains the real gate.
 */
const INTERNAL_CITATION_PATTERN =
  /^(codexes|services|app|components|docs|scripts|tests|types|supabase|packages)\//i;
const INTERNAL_DOCUMENT_PATTERN = /^(CFS|CRP|IRL|PRD|SPEC|CCR|EXP|CLAUDE)[-.\s]/i;

function looksInternal(ref: string): boolean {
  const r = ref.trim();
  return INTERNAL_CITATION_PATTERN.test(r) || INTERNAL_DOCUMENT_PATTERN.test(r);
}

export type ReclassificationResult =
  | { ok: true; provenance: Record<string, unknown>; from: ProvenanceClass | null; to: ProvenanceClass }
  | { ok: false; error: string };

/** Where the append-only reclassification history lives inside the bag. */
export const RECLASSIFICATION_LOG_KEY = 'provenanceReclassifications';

/**
 * Apply a reclassification to a provenance bag, returning a NEW bag.
 *
 * Refuses (never throws) when:
 *  - `to` is not one of the ratified evidence-provenance values;
 *  - `evidenceRefs` is empty — reclassifying without new evidence is exactly
 *    the quiet field edit this function exists to prevent;
 *  - `rationale` is blank;
 *  - the record is already at `to` (nothing happened; recording an event for a
 *    non-event would pollute the history).
 *
 * On success it sets `provenanceClass` to the new value AND appends the event
 * to an append-only log, so the prior class and the evidence that moved it are
 * both still readable. The previous value is never dropped.
 */
export function applyProvenanceReclassification(
  provenance: Record<string, unknown> | null | undefined,
  event: Omit<ProvenanceReclassification, 'from'>,
): ReclassificationResult {
  if (!(PROVENANCE_CLASSES as readonly string[]).includes(event.to)) {
    return { ok: false, error: `'${event.to}' is not a ratified evidence-provenance class` };
  }
  if (!Array.isArray(event.evidenceRefs) || event.evidenceRefs.filter((r) => typeof r === 'string' && r.trim()).length === 0) {
    return {
      ok: false,
      error:
        'a provenance reclassification requires at least one evidenceRef — a class change without new ' +
        'evidence is a quiet field edit, not a recorded event',
    };
  }
  if (typeof event.rationale !== 'string' || !event.rationale.trim()) {
    return { ok: false, error: 'a provenance reclassification requires a rationale' };
  }
  // A move INTO the primary population is the act by which EXP-P1 acquires a
  // primary population at all (Population A is currently EMPTY — every seed
  // record cites a metaProof artefact). It must be backed by at least one
  // citation that is not repo-internal, or it is laundering rather than
  // acquisition.
  const refs = event.evidenceRefs.filter((r) => typeof r === 'string' && r.trim());
  if (
    PRIMARY_POPULATIONS.has(POPULATION_BY_EVIDENCE_PROVENANCE[event.to]) &&
    refs.every(looksInternal)
  ) {
    return {
      ok: false,
      error:
        `reclassification to '${event.to}' (Population A) cites only repo-internal material — an external ` +
        'evidence provenance requires at least one independently authored source; relabelling platform ' +
        'evidence as external is laundering, not acquisition',
    };
  }
  const from = readEvidenceProvenance(provenance);
  if (from === event.to) {
    return { ok: false, error: `already classified '${event.to}' — nothing to reclassify` };
  }
  const prior = Array.isArray(provenance?.[RECLASSIFICATION_LOG_KEY])
    ? (provenance![RECLASSIFICATION_LOG_KEY] as unknown[])
    : [];
  const record: ProvenanceReclassification = { ...event, from };
  return {
    ok: true,
    from,
    to: event.to,
    provenance: {
      ...(provenance ?? {}),
      provenanceClass: event.to,
      [RECLASSIFICATION_LOG_KEY]: [...prior, record],
    },
  };
}

/** The append-only reclassification history on a provenance bag (oldest first). */
export function readReclassifications(
  provenance: Record<string, unknown> | null | undefined,
): ProvenanceReclassification[] {
  const raw = provenance?.[RECLASSIFICATION_LOG_KEY];
  return Array.isArray(raw) ? (raw as ProvenanceReclassification[]) : [];
}
