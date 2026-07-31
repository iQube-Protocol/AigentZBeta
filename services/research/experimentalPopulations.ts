/**
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ SUPERSEDED FOR EXP-P1 CRYSTAL vP1 ELIGIBILITY (operator ruling,        │
 * │ 2026-07-28). RE-SCOPED, NOT RETIRED.                                   │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * This module's A/B/C partition is NO LONGER the EXP-P1 eligibility gate. The
 * rule it encoded — primary population = A only, with platform doctrine (C)
 * "never in either" — has been superseded because it excludes all internally
 * derived doctrine, which makes constitutional invariants untestable by
 * construction. The governing rule for Crystal vP1 is now:
 *
 *   > EXP-P1 eligibility is determined by source provenance PLUS
 *   > experiment-relative independence. General platform doctrine may be
 *   > admitted when it predates task construction and is independent of the
 *   > target, tasks and observed outcomes.
 *
 * The decisive exclusion layer is the contamination relationship
 * (`target-derived` / `task-derived` / `outcome-informed` / `unknown`) in
 * `services/research/experimentRelation.ts` — one coherent rule instead of two
 * competing partitions.
 *
 * WHAT THIS MODULE IS NOW: a REPORTING / PROVENANCE STRATUM, not a gate.
 *
 *   A — external established or empirical
 *   B — platform-derived or platform-hypothesized, where independently admissible
 *   C — platform doctrine, where independently admissible
 *
 * ALL eligible strata may enter Crystal vP1. Kept live (not deleted) because it
 * remains the historical design record, a provenance-stratified analytical view,
 * and the plausible basis for a separate experiment comparing external-only
 * against mixed provenance.
 *
 * Do NOT reintroduce `PRIMARY_POPULATIONS` as an eligibility filter for P1.
 *
 * ── Original header (2026-07-27), retained ─────────────────────────────────
 *
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
  /**
   * OPTIONAL provenance OF THE FORM ITSELF (2026-07-28). Once the classify form
   * is pre-populated from the stored acquisition record, "the steward cited
   * these URLs" and "the steward accepted the URLs the system offered" stop
   * being the same statement, and a reader of this log must be able to tell
   * them apart. `suggested` = submitted exactly as offered, `edited` = a
   * suggestion was offered and changed, `operator` = typed with no suggestion
   * in play. Absent on events recorded before the suggester existed, which
   * reads as "not recorded" rather than being defaulted into a category
   * nobody assigned — the same discipline as `DiscoveryProvenance`.
   *
   * Optional BY DESIGN: adding it does not change
   * `applyProvenanceReclassification`'s signature or any of its refusals; the
   * function carries it through with the rest of the event.
   */
  fieldOrigin?: {
    evidenceRefs: 'suggested' | 'edited' | 'operator';
    rationale: 'suggested' | 'edited' | 'operator';
  };
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

// ── Pre-populating the classify form — a SUGGESTION, never an assertion ────

/**
 * ONE acquired source document behind an invariant's evidence rows, as read
 * back off the stored record. Every field is either a value COPIED from a
 * stored row or `null`. There is no field this type permits a caller to
 * compose, and in particular `sourceRef` is `discovery_evidence.source_ref`
 * verbatim — the composer below never derives, guesses, or repairs a URL.
 */
export interface ClassificationSuggestionSource {
  /** `discovery_evidence.source_ref` — the canonical document URL, verbatim. */
  sourceRef: string;
  /** Every evidence row on this invariant that carries this `source_ref`. */
  evidenceIds: string[];
  /** `discovery_evidence.title` for those rows. */
  evidenceTitles: string[];
  /** `corpus_candidate_sources.title` / `.issuer`, when the acquisition record
   *  for this URL could be resolved UNAMBIGUOUSLY. Null otherwise. */
  candidateTitle: string | null;
  issuer: string | null;
  /** `corpus_candidate_sources.provenance_class` — the class the human
   *  reviewer already recorded for this SOURCE at review time. Reported as
   *  context; it is NOT applied, and it does not preselect the class. */
  recordedProvenanceClass: ProvenanceClass | null;
  /** `corpus_candidate_sources.human_review_notes`, verbatim. */
  reviewNotes: string | null;
  /** `corpus_acquisition_seeds.institution_name` / `.claim` — the operator's
   *  own recorded description of why this document was planned for inclusion.
   *  Stored as a CLAIM (the seed table's own discipline), reproduced as one. */
  seedInstitution: string | null;
  seedClaim: string | null;
}

/**
 * What the server offers the steward's classify form. It pre-fills two fields
 * the operator would otherwise re-type from records the system already holds —
 * and it fills them ONLY from those records.
 *
 * It is a CONVENIENCE, never an assertion. Nothing here classifies anything:
 * `to` is not suggested, nothing is submitted, and every refusal in
 * `applyProvenanceReclassification` still runs on the operator's submit. A
 * suggestion assembled entirely from repo-internal citations is still refused
 * on the way into Population A, exactly as a hand-typed one would be.
 */
export interface ClassificationSuggestion {
  invariantId: string;
  /** `provenance.evidence_ids` — what the invariant claims it was compressed from. */
  evidenceIdCount: number;
  /** Evidence ids that resolved to a `discovery_evidence` row. */
  resolvedEvidenceCount: number;
  /** Recorded ids with no matching evidence row. Reported, never quietly dropped. */
  unresolvedEvidenceIds: string[];
  /** Resolved rows carrying NO `source_ref`. They contribute NOTHING — the
   *  alternative (inventing a plausible URL for them) would launder an
   *  unverifiable citation into Population A. */
  evidenceIdsWithoutSourceRef: string[];
  sources: ClassificationSuggestionSource[];
  /** Deduped `source_ref` values, in first-seen order. Every entry appears in
   *  `sources`; nothing else can ever appear here. */
  suggestedEvidenceRefs: string[];
  /** Assembled from stored text only. EMPTY when there is no stored text to
   *  assemble — a blank field the operator must fill is honest; a composed
   *  justification for a class nobody recorded is not. */
  suggestedRationale: string;
  /** True only when every recorded evidence id resolved AND every resolved row
   *  carried a source ref. False ⇒ the surface must say the suggestion is
   *  PARTIAL rather than presenting it as the whole citation set. */
  complete: boolean;
  /** Machine-stated gaps, for the surface to render beside the fields. */
  notes: string[];
}

/**
 * Assemble the suggestion from already-resolved rows. PURE — no I/O, no
 * network, no clock — so the one property that matters can be canaried
 * directly: **every emitted ref is an input `sourceRef`, byte for byte.**
 *
 * The rationale is built from labelled, verbatim stored strings plus counts
 * computed from the inputs. It contains no clause asserting independence,
 * externality, quality, or fit — those are the operator's to write, and are
 * precisely what a pre-filled field must not put in their mouth.
 */
export function composeClassificationSuggestion(input: {
  invariantId: string;
  evidenceIds: readonly string[];
  resolvedEvidenceIds: readonly string[];
  evidenceIdsWithoutSourceRef: readonly string[];
  sources: readonly ClassificationSuggestionSource[];
  /** Gaps the RESOLVER found that this function cannot see — e.g. several
   *  acquisition records sharing one URL, so none of them could be attached
   *  unambiguously. Reported rather than resolved by preference. */
  additionalNotes?: readonly string[];
}): ClassificationSuggestion {
  const evidenceIds = input.evidenceIds.filter((id) => typeof id === 'string' && id.trim());
  const unresolvedEvidenceIds = evidenceIds.filter((id) => !input.resolvedEvidenceIds.includes(id));
  // A source with a blank ref is not a source. Dropping it is the whole
  // discipline: the suggester has nothing to offer for that row, and says so.
  const sources = input.sources.filter((s) => typeof s.sourceRef === 'string' && s.sourceRef.trim().length > 0);

  const suggestedEvidenceRefs: string[] = [];
  for (const s of sources) {
    const ref = s.sourceRef.trim();
    if (!suggestedEvidenceRefs.includes(ref)) suggestedEvidenceRefs.push(ref);
  }

  const notes: string[] = [];
  if (evidenceIds.length === 0) {
    notes.push('This invariant records NO evidence rows, so there is nothing to cite from the stored record. Any evidence ref must be entered by hand.');
  }
  if (unresolvedEvidenceIds.length > 0) {
    notes.push(`${unresolvedEvidenceIds.length} recorded evidence id(s) could not be resolved to a discovery_evidence row: ${unresolvedEvidenceIds.join(', ')}.`);
  }
  if (input.evidenceIdsWithoutSourceRef.length > 0) {
    notes.push(`${input.evidenceIdsWithoutSourceRef.length} evidence row(s) carry no source reference and contribute nothing to this suggestion: ${input.evidenceIdsWithoutSourceRef.join(', ')}.`);
  }
  if (suggestedEvidenceRefs.length === 0 && evidenceIds.length > 0) {
    notes.push('No source reference could be read off any of this invariant\'s evidence rows. Nothing is pre-filled — a URL that is not in the record must not be produced by this suggester.');
  }
  for (const n of input.additionalNotes ?? []) if (n.trim()) notes.push(n.trim());

  const lines: string[] = [];
  if (sources.length > 0) {
    lines.push(
      'Assembled from the stored acquisition record for this invariant\'s evidence rows. ' +
      'Quoted lines are stored text reproduced verbatim; the counts are computed from the evidence rows themselves.',
    );
    lines.push('');
    lines.push(
      `Compressed from ${input.resolvedEvidenceIds.length} evidence row(s) resolving to ` +
      `${sources.length} source document(s).`,
    );
    sources.forEach((s, i) => {
      lines.push('');
      const heading = s.candidateTitle ?? s.evidenceTitles[0] ?? s.sourceRef;
      lines.push(`${i + 1}. ${heading}${s.issuer ? ` — ${s.issuer}` : ''}`);
      lines.push(`   Source: ${s.sourceRef}`);
      if (s.recordedProvenanceClass) {
        lines.push(`   Provenance class recorded on the source at acquisition review: ${s.recordedProvenanceClass}`);
      }
      if (s.seedClaim) {
        lines.push(`   Acquisition claim${s.seedInstitution ? ` (${s.seedInstitution})` : ''}: ${s.seedClaim}`);
      }
      if (s.reviewNotes) lines.push(`   Reviewer note: ${s.reviewNotes}`);
      if (s.evidenceIds.length > 0) lines.push(`   Evidence rows: ${s.evidenceIds.join(', ')}`);
    });
    // The gaps travel INSIDE the rationale, so a suggestion recorded verbatim
    // still states what it could not account for.
    if (notes.length > 0) {
      lines.push('');
      lines.push(`Gaps in this record: ${notes.join(' ')}`);
    }
  }

  return {
    invariantId: input.invariantId,
    evidenceIdCount: evidenceIds.length,
    resolvedEvidenceCount: input.resolvedEvidenceIds.length,
    unresolvedEvidenceIds,
    evidenceIdsWithoutSourceRef: [...input.evidenceIdsWithoutSourceRef],
    sources,
    suggestedEvidenceRefs,
    suggestedRationale: lines.join('\n'),
    complete:
      evidenceIds.length > 0 &&
      unresolvedEvidenceIds.length === 0 &&
      input.evidenceIdsWithoutSourceRef.length === 0 &&
      suggestedEvidenceRefs.length > 0,
    notes,
  };
}

/**
 * Did the steward submit the suggestion as offered, change it, or type it with
 * no suggestion in play? Recorded on the reclassification event as
 * {@link ProvenanceReclassification.fieldOrigin} so a later reader can tell a
 * reviewed citation from an accepted default.
 *
 * DERIVED SERVER-SIDE by comparing the submitted values against a freshly
 * recomputed suggestion — never taken from the client, which could assert
 * "operator" for a field it pre-filled.
 */
export function deriveFieldOrigin(
  submitted: { evidenceRefs: readonly string[]; rationale: string },
  suggestion: { suggestedEvidenceRefs: readonly string[]; suggestedRationale: string } | null,
): ProvenanceReclassification['fieldOrigin'] {
  if (!suggestion) return { evidenceRefs: 'operator', rationale: 'operator' };
  const sameRefs =
    suggestion.suggestedEvidenceRefs.length > 0 &&
    submitted.evidenceRefs.length === suggestion.suggestedEvidenceRefs.length &&
    submitted.evidenceRefs.every((r, i) => r.trim() === suggestion.suggestedEvidenceRefs[i].trim());
  const hadRationale = suggestion.suggestedRationale.trim().length > 0;
  const sameRationale = hadRationale && submitted.rationale.trim() === suggestion.suggestedRationale.trim();
  return {
    evidenceRefs: sameRefs ? 'suggested' : suggestion.suggestedEvidenceRefs.length > 0 ? 'edited' : 'operator',
    rationale: sameRationale ? 'suggested' : hadRationale ? 'edited' : 'operator',
  };
}

/** The append-only reclassification history on a provenance bag (oldest first). */
export function readReclassifications(
  provenance: Record<string, unknown> | null | undefined,
): ProvenanceReclassification[] {
  const raw = provenance?.[RECLASSIFICATION_LOG_KEY];
  return Array.isArray(raw) ? (raw as ProvenanceReclassification[]) : [];
}

// ── "Safe" is not "finished" — the classification queue ─────────────────────

/**
 * The operator's ruling of 2026-07-28 on promoting the Invariant Discovery
 * Engine's Financial Services candidates:
 *
 *   "The promotion path is fail-closed, so promotion will not fabricate
 *    Population A membership. That is good. **But 'safe' should not become
 *    'finished.'**"
 *
 * `promoteCandidate` lands an invariant at `status: proposed`,
 * `discoveryProvenance: 'ide'`, evidence provenance UNSET — so
 * `experimentalPopulation()` returns `null` and the record is in no population.
 * That is the fail-closed guarantee and it is deliberately not changed.
 *
 * What it is NOT is a resting state. An unclassified invariant is WORK
 * OUTSTANDING, and a corpus that cannot show which records are outstanding will
 * quietly accumulate them until "unclassified" reads as a category rather than
 * a queue. These are the six checks the ruling requires before a promoted
 * invariant may be classified, carried here so the surface renders the SAME six
 * the ruling names — not a hand-copied list that drifts (inv.engineering.036).
 */
export type ClassificationCheckId =
  | 'evidence-row-inspection'
  | 'source-document-lineage'
  | 'evidence-provenance-assignment'
  | 'domain-namespace-confirmation'
  | 'duplication-equivalence-comparison'
  | 'law-ii-status';

/**
 * `mechanical` — this module can compute the check's state from the record.
 * `steward` — it needs a human to look at something outside the record. A
 * steward check is NEVER auto-satisfied; the queue reports it as outstanding
 * and says what the steward must do, because a check that marks itself done is
 * not a check.
 */
export type ClassificationCheckDecidedBy = 'mechanical' | 'steward';

export const CLASSIFICATION_CHECKS: readonly {
  id: ClassificationCheckId;
  label: string;
  requirement: string;
  decidedBy: ClassificationCheckDecidedBy;
}[] = [
  {
    id: 'evidence-row-inspection',
    label: 'Evidence-row inspection',
    requirement: 'Open every `discovery_evidence` row the candidate was compressed from and confirm it says what the statement claims.',
    decidedBy: 'mechanical',
  },
  {
    id: 'source-document-lineage',
    label: 'Source-document lineage',
    requirement: 'Trace each evidence row back to the document it came from. An evidence row with no acquired source document cannot support an external classification.',
    decidedBy: 'steward',
  },
  {
    id: 'evidence-provenance-assignment',
    label: 'Evidence provenance assignment',
    requirement: 'Assign one of the five evidence-provenance classes through applyProvenanceReclassification — with evidence refs and a rationale, never a field edit.',
    decidedBy: 'mechanical',
  },
  {
    id: 'domain-namespace-confirmation',
    label: 'Domain namespace confirmation',
    requirement: 'Confirm the invariant landed in the namespace its discovery domain resolves to — a Financial Services discovery in `constitutional.*` destroys the population separation at the point of entry.',
    decidedBy: 'mechanical',
  },
  {
    id: 'duplication-equivalence-comparison',
    label: 'Duplication / equivalence comparison',
    requirement: 'Compare against invariants already in the namespace. A promoted duplicate inflates every count computed over the corpus.',
    decidedBy: 'steward',
  },
  {
    id: 'law-ii-status',
    label: 'Law II status',
    requirement: 'Record whether the pillars this invariant rests on satisfy Law II. An invariant resting on a single institutional tradition is not disqualified — but it must not be read as corroborated.',
    decidedBy: 'steward',
  },
];

export interface ClassificationCheckState {
  id: ClassificationCheckId;
  label: string;
  requirement: string;
  decidedBy: ClassificationCheckDecidedBy;
  /** `true` only when this module can SEE it satisfied. A steward check is
   *  never `true` here — absence of proof is not proof. */
  satisfied: boolean;
  detail: string;
}

/** One promoted-but-unclassified invariant, with its six checks. */
export interface ClassificationQueueEntry {
  invariantId: string;
  statement: string;
  namespace: string;
  status: string;
  domain: string | null;
  discoveryProvenance: DiscoveryProvenance | null;
  evidenceProvenance: ProvenanceClass | null;
  population: ExperimentalPopulation | null;
  checks: ClassificationCheckState[];
  outstandingCheckIds: ClassificationCheckId[];
}

/** The minimum shape the queue reads. Satisfied by `InvariantRecord` and by a
 *  raw `invariants` row alike — the queue is not coupled to either. */
export interface ClassifiableRecord {
  id: string;
  statement: string;
  namespace: string;
  status: string;
  provenance?: Record<string, unknown> | null;
}

/**
 * Is this record the OUTPUT OF A PROMOTION? Read from the provenance bag the
 * discovery engine writes: `discovery_candidate_id` is the promotion's own
 * back-reference, and `discoveryProvenance: 'ide'` is the axis the ruling
 * names. Either is sufficient; neither is invented when absent.
 */
export function isPromotedByDiscoveryEngine(
  provenance: Record<string, unknown> | null | undefined,
): boolean {
  if (!provenance) return false;
  const candidateId = provenance.discovery_candidate_id ?? provenance.discoveryCandidateId;
  if (typeof candidateId === 'string' && candidateId.trim()) return true;
  return readDiscoveryProvenance(provenance) !== null;
}

/**
 * The steward-visible queue: every promoted-but-unclassified record, with the
 * six checks the ruling requires. A record already carrying an evidence
 * provenance is NOT in the queue — it has been classified, whatever population
 * that put it in.
 *
 * `expectedNamespace` is the namespace the record's discovery domain resolves
 * to, supplied by the caller (the Discovery Domain Registry is the authority on
 * that mapping and this module must not fork it). Omitted ⇒ the namespace check
 * reports as un-checkable rather than as passed.
 */
export function buildClassificationQueue(
  records: readonly ClassifiableRecord[],
  expectedNamespace?: (record: ClassifiableRecord) => string | null,
): ClassificationQueueEntry[] {
  const out: ClassificationQueueEntry[] = [];
  for (const record of records) {
    const provenance = record.provenance ?? null;
    if (!isPromotedByDiscoveryEngine(provenance)) continue;
    const evidenceProvenance = readEvidenceProvenance(provenance);
    if (evidenceProvenance !== null) continue; // classified — not outstanding

    const evidenceIds = Array.isArray(provenance?.evidence_ids)
      ? (provenance!.evidence_ids as unknown[]).filter((v) => typeof v === 'string' && v.trim())
      : [];
    const expected = expectedNamespace?.(record) ?? null;
    const domain = typeof provenance?.domain === 'string' ? (provenance.domain as string) : null;

    const detail: Record<ClassificationCheckId, { satisfied: boolean; detail: string }> = {
      'evidence-row-inspection': evidenceIds.length > 0
        ? { satisfied: false, detail: `${evidenceIds.length} evidence row(s) recorded and awaiting inspection` }
        : { satisfied: false, detail: 'NO evidence rows are recorded on this invariant — there is nothing to inspect, and nothing that could support an external classification' },
      'source-document-lineage': {
        satisfied: false,
        detail: 'discovery_evidence carries no source-document reference, so lineage cannot be read off the record — a steward must trace it',
      },
      'evidence-provenance-assignment': {
        satisfied: false,
        detail: 'unset — the promotion deliberately did not guess it; assign via applyProvenanceReclassification with at least one evidence ref',
      },
      'domain-namespace-confirmation': expected === null
        ? { satisfied: false, detail: `landed in '${record.namespace}'; no expected namespace supplied, so this cannot be confirmed here` }
        : expected === record.namespace
          ? { satisfied: true, detail: `landed in '${record.namespace}', which is what its discovery domain resolves to` }
          : { satisfied: false, detail: `landed in '${record.namespace}' but its discovery domain resolves to '${expected}' — the population separation is broken at the point of entry` },
      'duplication-equivalence-comparison': {
        satisfied: false,
        detail: `compare against the invariants already in '${record.namespace}' — a promoted duplicate inflates every count computed over the corpus`,
      },
      'law-ii-status': {
        satisfied: false,
        detail: domain
          ? `record the Law II verdict for the '${domain}' pillars this invariant rests on`
          : 'no discovery domain recorded on the invariant — the Law II verdict cannot be located without one',
      },
    };

    const checks: ClassificationCheckState[] = CLASSIFICATION_CHECKS.map((c) => ({
      ...c,
      satisfied: c.decidedBy === 'steward' ? false : detail[c.id].satisfied,
      detail: detail[c.id].detail,
    }));

    out.push({
      invariantId: record.id,
      statement: record.statement,
      namespace: record.namespace,
      status: record.status,
      domain,
      discoveryProvenance: readDiscoveryProvenance(provenance),
      evidenceProvenance: null,
      population: null,
      checks,
      outstandingCheckIds: checks.filter((c) => !c.satisfied).map((c) => c.id),
    });
  }
  return out;
}

// ── The prohibition, as a gate that refuses with a reason ───────────────────

/**
 * The three uses the ruling forbids for an unclassified invariant:
 *
 *   "Until classified, they may be reviewed and compared but must not be used
 *    as: external Crystal population; canonical Financial Services invariants;
 *    confirmatory experimental treatment."
 *
 * Reviewing and comparing stay ALLOWED — that is the point of the queue.
 */
export type RestrictedInvariantUse =
  | 'external-crystal-population'
  | 'canonical-domain-invariant'
  | 'confirmatory-experimental-treatment';

export const RESTRICTED_INVARIANT_USES: readonly RestrictedInvariantUse[] = [
  'external-crystal-population',
  'canonical-domain-invariant',
  'confirmatory-experimental-treatment',
];

/** The uses the ruling explicitly PERMITS while unclassified. Named so a caller
 *  can ask for them without having to infer permission from silence. */
export const PERMITTED_UNCLASSIFIED_USES = ['review', 'comparison'] as const;
export type PermittedUnclassifiedUse = (typeof PERMITTED_UNCLASSIFIED_USES)[number];

export type UseGateResult = { allowed: true } | { allowed: false; reason: string };

/**
 * **The prohibition gate.** Same shape and same discipline as
 * `canRunInstitutionDiscovery` in `services/corpusScout/registryVerification.ts`:
 * it returns a REASON, never a bare `false`.
 *
 * That is not cosmetic. A silent exclusion from a population is
 * indistinguishable from a bug — the operator hit exactly that on the IDE's
 * Discover button (`7edfadf52`), where a correct refusal with no reason read as
 * a broken instrument and sent the diagnosis in the wrong direction. A gate
 * that refuses silently trains its reader to treat every refusal as a defect.
 *
 * COMPOSES with the population machinery rather than reimplementing it:
 * membership comes from `experimentalPopulation` / `inPrimaryPopulation`, which
 * remain the single authority (inv.engineering.036).
 */
export function canUseInvariantFor(
  record: { provenance?: Record<string, unknown> | null; status?: string | null },
  use: RestrictedInvariantUse,
): UseGateResult {
  const provenance = record.provenance ?? null;
  const population = experimentalPopulation(provenance);
  const unclassified = population === null;

  switch (use) {
    case 'external-crystal-population':
      if (unclassified) {
        return {
          allowed: false,
          reason:
            'unclassified: no evidence provenance is recorded, so this invariant is in NO experimental population. ' +
            'It cannot serve as external Crystal population — admitting it would assume the external evidentiary ' +
            'basis that §2a exists to require proof of. Assign an evidence provenance through the classification queue first.',
        };
      }
      if (!inPrimaryPopulation(provenance)) {
        return {
          allowed: false,
          reason:
            `classified '${readEvidenceProvenance(provenance)}' ⇒ Population ${population}. The external Crystal ` +
            'population is Population A only; B and C are reported in the ablation arm and as platform doctrine respectively.',
        };
      }
      return { allowed: true };

    case 'canonical-domain-invariant':
      if (unclassified) {
        return {
          allowed: false,
          reason:
            'unclassified: promotion lands an invariant at `proposed`, and an invariant whose evidentiary basis ' +
            'has not been established cannot be read as canonical for its domain. Work the classification queue ' +
            '— evidence rows, source lineage, provenance, namespace, duplication, Law II — then ratify.',
        };
      }
      if (record.status !== 'canonical') {
        return {
          allowed: false,
          reason:
            `status is '${record.status ?? 'unset'}', not 'canonical'. Classification establishes the evidentiary ` +
            'basis; it does not ratify. Ratification is a separate steward act (CFS-009 Law XI).',
        };
      }
      return { allowed: true };

    case 'confirmatory-experimental-treatment':
      if (unclassified) {
        return {
          allowed: false,
          reason:
            'unclassified: a confirmatory treatment asserts that the result was predicted in advance by an ' +
            'independently grounded invariant. An invariant with no established evidentiary basis can be REVIEWED ' +
            'and COMPARED — both remain permitted — but using it confirmatorily would make the experiment ' +
            'self-affirming, which is the exact conflation the population partition exists to prevent.',
        };
      }
      if (!inPrimaryPopulation(provenance)) {
        return {
          allowed: false,
          reason:
            `classified '${readEvidenceProvenance(provenance)}' ⇒ Population ${population}. A confirmatory treatment ` +
            'requires Population A; a platform-derived invariant confirming a platform experiment is self-affinity, ' +
            'and belongs in the ablation arm where it is reported as such.',
        };
      }
      return { allowed: true };
  }
}
