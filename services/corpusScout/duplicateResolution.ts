/**
 * DUPLICATE RESOLUTION — the smallest safe act for an exact-duplicate group
 * (operator ruling, 2026-08-03).
 *
 * ── The defect this closes ──────────────────────────────────────────────────
 *
 * The exception surface isolated duplicate groups correctly and then STOPPED AT
 * DIAGNOSIS. Its recommended action read *"Decide this source individually in
 * the review queue"* — sending the operator to find a record the system already
 * had in hand, to re-derive a judgement the system could already make, and to
 * re-type a rationale the system could already write.
 *
 *   > "Present the smallest safe decision at the point where the exception
 *   >  appears, with the evidence and consequence already assembled."
 *
 *   > "An exception surface is incomplete unless it offers the next safe act in
 *   >  context."
 *
 * ── What this module is, and what it deliberately is not ────────────────────
 *
 * It DERIVES a recommended canonical copy from quality signals that already
 * exist on the row, explains the derivation in the operator's own terms, and
 * composes the rationale. It performs NO write: the governed treatment is the
 * EXISTING `mark_duplicate` decision in `applyCandidateReviewDecision`, which
 * already does exactly what the ruling describes — sets `reviewWorkflowStatus`
 * to `duplicate` and records `duplicateOfSourceId` pointing at the canonical.
 *
 * **That is an UPDATE, never a delete.** Aliasing preserves both records, which
 * is why no new write path was introduced: the one that exists is already
 * correct, and forking it would be the parallel-implementation defect
 * (inv.engineering.036/037).
 *
 * ── Every signal is a real field. None is invented ──────────────────────────
 *
 * | Operator's phrase | Backing field on `CandidateSourceRow` |
 * |---|---|
 * | complete artifact hash present | `artifactHash` |
 * | successful extraction | `extractionStatus === 'ok'` |
 * | richer metadata | `issuer`, `publicationDate`, `authors`, `pageCount`, `campaignSubDomain` |
 * | earlier admitted lineage | `evidenceRowId` present, and `createdAt` ordering |
 * | same underlying document bytes | equal `artifactHash` — the axis the group matched on |
 * | extraction completeness | `normalizedTextChars` (list projection) / `normalizedText.length` |
 *
 * Pure: no I/O, no clock, no randomness. A group scored twice yields the same
 * recommendation, so the dry run and the execution cannot disagree.
 */

import type { CandidateSourceRow } from './types';
import type { DuplicateGroup } from './intelligence';

/** The subset of a candidate row the scoring reads. Declared structurally so a
 *  list projection and a full row are both acceptable. */
export type DuplicateCandidateFacts = Pick<
  CandidateSourceRow,
  | 'sourceId'
  | 'title'
  | 'canonicalUrl'
  | 'artifactHash'
  | 'pageCount'
  | 'issuer'
  | 'publicationDate'
  | 'authors'
  | 'extractionStatus'
  | 'extractionWarnings'
  | 'reviewWorkflowStatus'
  | 'campaignSubDomain'
  | 'evidenceRowId'
  | 'createdAt'
> & { normalizedTextChars?: number; normalizedText?: string };

/**
 * ONE quality signal, scored and EXPLAINED. The explanation is not decoration:
 * the ruling requires the recommendation to say *why*, and a score with no
 * stated basis is the same "trust me" the diagnosis-only surface offered.
 */
export interface QualitySignal {
  name: string;
  /** Points contributed. Positive favours this copy as canonical. */
  points: number;
  /** What was observed — a fact, not a judgement. */
  detail: string;
}

/** Weights, named so a reader can see what the recommendation rests on. These
 *  are ORDERING heuristics for choosing between two copies of the SAME bytes —
 *  not eligibility thresholds, and they never admit or refuse anything. */
const W_ARTIFACT_HASH = 40;
const W_EXTRACTION_OK = 30;
const W_ALREADY_INGESTED = 25;
const W_METADATA_FIELD = 5;
const W_SUBDOMAIN_PLACED = 5;
const W_EXTRACTION_WARNING = -5;
/** Tie-break only: an earlier record is preferred, worth less than any real
 *  quality difference so it can never outweigh one. */
const W_EARLIER = 1;

export interface ScoredCopy {
  sourceId: string;
  score: number;
  signals: QualitySignal[];
  facts: DuplicateCandidateFacts;
}

/** Count of metadata fields actually captured — the backing for "richer
 *  metadata". Each is a real column; none is inferred. */
export function metadataCompleteness(row: DuplicateCandidateFacts): { captured: string[]; missing: string[] } {
  const fields: [string, boolean][] = [
    ['issuer', Boolean(row.issuer?.trim())],
    ['publicationDate', Boolean(row.publicationDate)],
    ['authors', (row.authors?.length ?? 0) > 0],
    ['pageCount', row.pageCount !== null && row.pageCount !== undefined],
  ];
  return {
    captured: fields.filter(([, ok]) => ok).map(([n]) => n),
    missing: fields.filter(([, ok]) => !ok).map(([n]) => n),
  };
}

/** Characters of extracted text this row actually carries. `normalizedTextChars`
 *  is the true length on a list projection; `normalizedText.length` on a full
 *  row. Absent ⇒ `null`, never 0 — unknown and empty are different facts. */
export function extractedChars(row: DuplicateCandidateFacts): number | null {
  if (typeof row.normalizedTextChars === 'number') return row.normalizedTextChars;
  if (typeof row.normalizedText === 'string') return row.normalizedText.length;
  return null;
}

/** Score ONE copy. Pure and deterministic. */
export function scoreCopy(row: DuplicateCandidateFacts, groupEarliestCreatedAt: string): ScoredCopy {
  const signals: QualitySignal[] = [];

  if (row.artifactHash) {
    signals.push({ name: 'artifact-hash', points: W_ARTIFACT_HASH, detail: 'complete artifact hash present — the bytes were verified' });
  } else {
    signals.push({ name: 'artifact-hash', points: 0, detail: 'no artifact hash recorded — the bytes were never verified' });
  }

  if (row.extractionStatus === 'ok') {
    signals.push({ name: 'extraction', points: W_EXTRACTION_OK, detail: 'successful extraction' });
  } else {
    signals.push({ name: 'extraction', points: 0, detail: `extraction status '${row.extractionStatus}'` });
  }

  if (row.evidenceRowId) {
    signals.push({ name: 'lineage', points: W_ALREADY_INGESTED, detail: 'already admitted as evidence — it carries existing lineage downstream' });
  } else {
    signals.push({ name: 'lineage', points: 0, detail: 'not yet admitted as evidence' });
  }

  const meta = metadataCompleteness(row);
  signals.push({
    name: 'metadata',
    points: meta.captured.length * W_METADATA_FIELD,
    detail:
      meta.captured.length > 0
        ? `${meta.captured.length}/4 metadata field(s) captured (${meta.captured.join(', ')})`
        : 'no bibliographic metadata captured',
  });

  if (row.campaignSubDomain) {
    signals.push({ name: 'placement', points: W_SUBDOMAIN_PLACED, detail: `sub-domain placement recorded: '${row.campaignSubDomain}'` });
  }

  if (row.extractionWarnings.length > 0) {
    signals.push({
      name: 'extraction-warnings',
      points: row.extractionWarnings.length * W_EXTRACTION_WARNING,
      detail: `${row.extractionWarnings.length} extraction warning(s) recorded`,
    });
  }

  if (row.createdAt === groupEarliestCreatedAt) {
    signals.push({ name: 'earliest', points: W_EARLIER, detail: 'earliest acquisition in the group' });
  }

  return { sourceId: row.sourceId, score: signals.reduce((s, x) => s + x.points, 0), signals, facts: row };
}

// ── The recommendation ──────────────────────────────────────────────────────

export interface DuplicateResolutionPlan {
  /** Stable key of the group this plan resolves. */
  groupKey: string;
  matchType: DuplicateGroup['matchType'];
  /** Every member, scored and explained — rendered SIDE BY SIDE by the panel. */
  copies: ScoredCopy[];
  /** `null` when the signals do not separate the copies — genuine judgement. */
  canonicalSourceId: string | null;
  /** The copies that would become aliases. Empty when `canonicalSourceId` is null. */
  aliasSourceIds: string[];
  /**
   * Whether a deterministic recommendation exists. This is the split the ruling
   * requires: only `false` warrants deeper manual inspection.
   */
  kind: 'recommended-resolution-available' | 'genuine-judgment-required';
  /** Why this copy — in the operator's own register, assembled from the signals. */
  why: string[];
  /** Why the system considers these duplicates at all. */
  duplicateBasis: string;
  /** What approving does, stated before it is done. */
  consequence: string[];
  /** PRE-POPULATED and editable. Never blank. */
  rationale: string;
  /** Present only for `genuine-judgment-required` — what the system could not
   *  determine, so the operator knows what they are being asked to decide. */
  ambiguity: string | null;
}

/** The distinct treatments the panel offers. Declared once so the surface and
 *  the executor cannot disagree about what is on offer. */
export const DUPLICATE_TREATMENTS = [
  'accept-recommendation',
  'choose-other-copy',
  'keep-both-as-distinct-editions',
  'defer',
] as const;
export type DuplicateTreatment = (typeof DUPLICATE_TREATMENTS)[number];

/**
 * Compose the resolution plan for ONE exact-duplicate group.
 *
 * A recommendation is only offered when the signals genuinely separate the
 * copies. Equal scores mean the system cannot tell which copy is better, and
 * the honest answer is that this is a judgement — the ruling's second class,
 * where the system "cannot determine whether two records are different
 * editions, translations, revisions or distinct works".
 */
export function composeDuplicateResolution(input: {
  group: DuplicateGroup;
  rows: readonly DuplicateCandidateFacts[];
}): DuplicateResolutionPlan {
  const rows = input.rows.filter((r) => input.group.sourceIds.includes(r.sourceId));
  const earliest = rows.map((r) => r.createdAt).sort()[0] ?? '';
  // Scored in a stable order so two runs over the same group agree.
  const copies = [...rows]
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId))
    .map((r) => scoreCopy(r, earliest));

  const ranked = [...copies].sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId));
  const top = ranked[0];
  const runnerUp = ranked[1];
  const separated = Boolean(top && runnerUp && top.score > runnerUp.score);

  const duplicateBasis =
    input.group.matchType === 'artifact-hash'
      ? `Identical artifact hash (${input.group.key.slice(0, 16)}…) — the same underlying document bytes.`
      : input.group.matchType === 'normalized-text-hash'
        ? 'Identical normalised text — the same extracted content behind different bytes.'
        : `Identical canonical URL (${input.group.key}) — the same document re-submitted.`;

  if (!separated || !top) {
    const ambiguity =
      copies.length < 2
        ? 'Fewer than two members resolved from the queue, so there is nothing to compare.'
        : 'The quality signals do not separate these copies — they score identically on artifact hash, extraction, ' +
          'lineage and metadata. The system cannot determine whether they are the same document, different editions, ' +
          'revisions, translations, or genuinely distinct works.';
    return {
      groupKey: `${input.group.matchType}:${input.group.key}`,
      matchType: input.group.matchType,
      copies,
      canonicalSourceId: null,
      aliasSourceIds: [],
      kind: 'genuine-judgment-required',
      why: [],
      duplicateBasis,
      consequence: [
        'Nothing is recommended for this group. It stays isolated for individual review.',
        'The unaffected set continues — this group blocks nothing.',
      ],
      // Even here the rationale is pre-populated: the operator edits a stated
      // starting point rather than authoring from a blank field.
      rationale:
        `Deferred the duplicate group ${input.group.sourceIds.join(' / ')} for individual review. ` +
        'The recorded quality signals do not separate the copies, so the choice of canonical source is a judgement.',
      ambiguity,
    };
  }

  const aliasSourceIds = ranked.slice(1).map((c) => c.sourceId);
  // The `why` reads back only the signals that actually FAVOURED the winner —
  // listing a zero-point signal as a reason would overstate the basis.
  const why = top.signals.filter((s) => s.points > 0).map((s) => s.detail);
  const aliasList = aliasSourceIds.join(', ');

  return {
    groupKey: `${input.group.matchType}:${input.group.key}`,
    matchType: input.group.matchType,
    copies,
    canonicalSourceId: top.sourceId,
    aliasSourceIds,
    kind: 'recommended-resolution-available',
    why,
    duplicateBasis,
    consequence: [
      `${top.sourceId} is recorded as the canonical source and keeps its sub-domain placement${top.facts.campaignSubDomain ? ` ('${top.facts.campaignSubDomain}')` : ''}.`,
      `${aliasList} ${aliasSourceIds.length === 1 ? 'is' : 'are'} recorded as an exact-duplicate alias pointing at the canonical source.`,
      'BOTH RECORDS ARE PRESERVED. Aliasing is not deletion — the alias keeps its row, its provenance and its history.',
      'The alias is excluded from ingestion, so the same document cannot enter the corpus twice.',
      'The decision and this rationale are receipted.',
      'No unrelated record is affected, and the freeze is not impacted.',
    ],
    rationale:
      `Selected ${top.sourceId} as the canonical copy because it has ${why.length > 0 ? why.join('; ') : 'the stronger recorded quality signals'}. ` +
      `Preserved ${aliasList} as an exact-duplicate alias and excluded it from duplicate ingestion.`,
    ambiguity: null,
  };
}

// ── The dry run, in the operator's own shape ────────────────────────────────

export interface DuplicateResolutionDryRun {
  duplicateRecords: number;
  canonicalRetained: number;
  aliasesExcluded: number;
  /** ALWAYS 0. Asserted as a field rather than assumed, because "preserve both
   *  records" is the property most easily lost in a later refactor. */
  recordsDeleted: 0;
  unrelatedRecordsAffected: 0;
  freezeImpact: 'none';
  /** The groups this act would resolve; ambiguous ones are excluded by name. */
  groupKeys: string[];
  /** Groups deliberately NOT acted on, with why. */
  skipped: { groupKey: string; reason: string }[];
}

/**
 * Summarise what "Resolve all recommended exceptions" would do — computed from
 * the plans, so the preview and the act cannot disagree.
 *
 * Operates ONLY on groups carrying a deterministic recommendation. Genuinely
 * ambiguous groups are listed in `skipped` rather than silently omitted: a
 * group that vanished from the summary would look resolved.
 */
export function dryRunDuplicateResolution(plans: readonly DuplicateResolutionPlan[]): DuplicateResolutionDryRun {
  const actionable = plans.filter((p) => p.kind === 'recommended-resolution-available' && p.canonicalSourceId);
  const skipped = plans
    .filter((p) => p.kind !== 'recommended-resolution-available' || !p.canonicalSourceId)
    .map((p) => ({
      groupKey: p.groupKey,
      reason: p.ambiguity ?? 'no deterministic recommendation is available for this group',
    }));

  return {
    duplicateRecords: actionable.reduce((n, p) => n + p.copies.length, 0),
    canonicalRetained: actionable.length,
    aliasesExcluded: actionable.reduce((n, p) => n + p.aliasSourceIds.length, 0),
    recordsDeleted: 0,
    unrelatedRecordsAffected: 0,
    freezeImpact: 'none',
    groupKeys: actionable.map((p) => p.groupKey),
    skipped,
  };
}

/** The dry run rendered in the operator's own lines. */
export function renderDuplicateDryRun(d: DuplicateResolutionDryRun): string[] {
  return [
    `${d.duplicateRecords} duplicate record(s)`,
    `${d.canonicalRetained} canonical source(s) retained`,
    `${d.aliasesExcluded} duplicate alias(es) excluded from ingestion`,
    `${d.recordsDeleted} record(s) deleted`,
    `${d.unrelatedRecordsAffected} unrelated record(s) affected`,
    `Freeze impact: ${d.freezeImpact}`,
  ];
}
