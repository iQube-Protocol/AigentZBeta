/**
 * Invariant Discovery Engine (IDE) — CFS-048 Phase 0 (constitutional arm).
 *
 * The UPSTREAM primitive: build a candidate invariant library for a cold
 * domain from evidence, then feed the EXISTING lifecycle + validation harness.
 * This is an orchestration layer — it composes primitives that already ship,
 * it does not re-implement them (charter §3):
 *
 *   Stage 1 Evidence Collection  → discovery_evidence (this module)
 *   Stage 2 Candidate Extraction → callSovereign (invariant-aware inference)
 *   Stage 3 Synthesis            → compression prompt (Phase 1 adds mergeInvariants)
 *   Stage 4 Validation           → the experiment harness (unchanged)
 *   Stage 5 Canonical Publication→ discoverInvariant → validate → canonize
 *
 * Discipline (canon): discovery-not-generation (inv.reasoning.334); evidence-
 * first provenance (335); a candidate is `proposed` until validated, never
 * auto-canonical (337). Promotion here lands a candidate at status `proposed`
 * ONLY — canonisation stays a separate, earned act.
 *
 * T0/T2: added_by is a one-way commitment; server-internal only.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callSovereign } from '@/services/constitutional/modelRouter';
import { discoverInvariant, addEdge } from '@/services/invariants/lifecycle';
import { listEdgesForInvariants } from '@/services/invariants/store';
import { similarity } from '@/services/invariants/comparison';
import { evidenceDomainsFor, parseObservationDomain, discoveryDomain, discoveryNamespace } from '@/services/invariants/discoveryDomains';
import {
  composeClassificationSuggestion,
  type ClassificationSuggestion,
  type ClassificationSuggestionSource,
} from '@/services/research/experimentalPopulations';
import { PROVENANCE_CLASSES, type ProvenanceClass } from '@/services/corpusScout/types';
import type { IsolationException } from '@/services/research/exceptionIsolation';
import {
  partitionEvidence,
  reconcileExtraction,
  renderExtractionAccount,
  type BatchOutcome,
  type ExtractedCandidate,
  type ExtractionReconciliation,
} from '@/services/invariants/batchedExtraction';
import type { InvariantSemanticType } from '@/types/invariants';

export type DiscoveryClass = 'constitutional' | 'structural' | 'experiential';
export type EvidenceKind =
  | 'legislation' | 'regulation' | 'compliance' | 'standard' | 'contract' | 'policy'
  // Additive (PRD-ICA-001 §6, resolved 2026-07-22): the three source-document
  // types Corpus Scout's acquisition campaigns surface that the original
  // policy/regulation-oriented list didn't name — academic/practitioner
  // literature (actuarial standards, risk-science papers), failure post-
  // mortems (bank/insurance/operational incident reports), and financial
  // disclosures (annual reports, risk reports, stress tests — used only in
  // aggregation across multiple institutions, per Crystal Canon Collection H).
  | 'academic-literature' | 'incident-report' | 'disclosure-report'
  | 'other';

/** The scope ladder (CFS-048 Phase 1a). "field" is reserved for the abstract
 *  invariant field — the industry axis is `domain`, areas beneath are sub-domains. */
export type DiscoveryScopeLevel = 'domain' | 'sub-domain' | 'capability';
/** How a Compare output relates to the domain baseline (Aletheon 2026-07-20):
 *  supported = recurs across ≥2 sub-domains; specialized = one branch only;
 *  split = one baseline invariant that is really several; novel = absent from
 *  the baseline; equivalent = the SAME invariant as a baseline item at a different
 *  abstraction level (not two invariants — a level mismatch; keeps abstraction
 *  mismatches from being mislabelled as novelty). */
export type CompareClassification = 'supported' | 'specialized' | 'split' | 'novel' | 'equivalent';
const COMPARE_CLASSES: readonly string[] = ['supported', 'specialized', 'split', 'novel', 'equivalent'];
/** Constitutional-abstraction ladder: L0 verbatim · L1 summary · L2 cross-
 *  regulation · L3 domain-constitutional · L4 domain-independent. Discovery
 *  targets L2-L3; L4 is discovered later by cross-domain comparison. */
export type AbstractionLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export interface EvidenceRow {
  id: string;
  domain: string;
  subDomain: string | null;
  title: string;
  sourceKind: EvidenceKind;
  content: string;
  sourceRef: string | null;
  createdAt: string;
  /**
   * Where this row sits relative to the discovery domain it was fetched for —
   * DERIVED from `domain` via {@link classifyEvidenceProvenance}, never
   * stored (inv.engineering.036). Attached by `listDomainEvidence` at read
   * time, so it always reflects the domain the caller actually asked about.
   * `null` when the distinction doesn't apply (a vertical or unregistered
   * domain has no direct-horizontal/cross-vertical split).
   */
  provenanceClass?: EvidenceProvenanceClass | null;
}

/**
 * The two evidence CLASSES a horizontal-capability domain's corpus is made
 * of (operator ruling 2026-07-28, closing the structural bug where 26
 * genuinely-landed rows at the plain `commercialisation` key were invisible
 * to every read path):
 *
 *   direct-horizontal          evidence acquired ABOUT the capability itself
 *                              — stored UNQUALIFIED at the domain's own key
 *                              (e.g. `commercialisation`).
 *   cross-vertical-observation the capability observed MANIFESTING inside one
 *                              of its verticals — stored under the qualified
 *                              `<domain>/<vertical>` key.
 *
 * The operator was explicit that these stay semantically distinct, not
 * merged into one undifferentiated read: "That is not a workaround. It is
 * the correct ontology." Meaningless for a vertical domain scoring its own
 * corpus (there is no capability/vertical split to classify) — see
 * {@link classifyEvidenceProvenance}.
 */
export type EvidenceProvenanceClass = 'direct-horizontal' | 'cross-vertical-observation';

/**
 * Classify ONE evidence row's `domain` value relative to the discovery
 * `scoringDomain` it is being read for. DERIVED from the domain string alone
 * via `parseObservationDomain` — no stored column, no second source of truth
 * (inv.engineering.036/.037). Returns `null` when the distinction does not
 * apply: `scoringDomain` is not a horizontal-capability domain, or the row
 * doesn't belong to it at all.
 */
export function classifyEvidenceProvenance(evidenceDomain: string, scoringDomain: string): EvidenceProvenanceClass | null {
  if (discoveryDomain(scoringDomain)?.kind !== 'horizontal-capability') return null;
  const { discoveryDomain: root, observedDomain } = parseObservationDomain(evidenceDomain);
  if (root !== scoringDomain) return null;
  return observedDomain === scoringDomain ? 'direct-horizontal' : 'cross-vertical-observation';
}

/** Cross-framework convergence — how many INDEPENDENT source documents imply a
 *  candidate. A PRIORITISATION signal, not validity (Law XII: support is
 *  evidence, not truth). Derived at read time from evidence_ids. */
export interface ConvergenceInfo {
  supportCount: number;
  frameworks: string[];
  tier: 'single' | 'strong' | 'broad';
}

/**
 * Cross-Domain Recurrence — in how many DISTINCT domains does evidence for this
 * candidate exist (PRD-IDE-002 Addendum A). Distinct from `ConvergenceInfo`,
 * which counts distinct SOURCE DOCUMENTS within one corpus: five FATF documents
 * are broad convergence but still ONE domain. Recurrence is the stronger signal —
 * "a candidate that emerges independently in Financial Services, media, and
 * Human Mobility Services is a much stronger prospect than one observed only
 * within a single vertical."
 *
 * DERIVED at read time from the candidate's evidence rows, never stored. A
 * persisted score is a second source of truth for a fact the evidence already
 * carries, and it silently goes stale the moment evidence is added or
 * reclassified (inv.engineering.036). It is a query, not a field.
 */
export interface RecurrenceInfo {
  /**
   * The distinct domains the supporting evidence was observed in, sorted. For
   * a horizontal-capability candidate this EXCLUDES the domain's own direct-
   * horizontal evidence (operator ruling 2026-07-28: "The plain
   * `commercialisation` domain may strengthen evidential support or
   * confidence, but it must not increment the cross-domain recurrence
   * count.") — it lists only genuine cross-vertical observations, exactly as
   * this field has always meant.
   */
  observedDomains: string[];
  /** = observedDomains.length. */
  recurrenceCount: number;
  tier: 'single-domain' | 'cross-domain' | 'broad-cross-domain';
  /**
   * Amendment D §D.4a, made MECHANICAL rather than a matter of judgement: a
   * finding present in only ONE domain is `specialized`, never universal. This
   * is the WEAKEST classification the evidence permits — a reviewer may
   * classify lower (e.g. `novel` is orthogonal), never higher.
   */
  classificationFloor: 'specialized' | 'supported';
  /**
   * Amendment D §D.4a again: an L4 (domain-independent) claim requires a second
   * domain. One domain caps the ladder at L3.
   */
  maxAbstractionLevel: 'L3' | 'L4';
  /**
   * The three-way evidence-support breakdown (operator ruling 2026-07-28). A
   * SIBLING field, not an overload of `recurrenceCount` / `observedDomains` —
   * those two keep EXACTLY their pre-existing meaning, so a reader of old
   * code never silently gets a different number out of the same field name.
   * `null` for a vertical or unregistered domain, where the direct-horizontal
   * / cross-vertical-observation distinction does not exist.
   */
  evidenceSupport: EvidenceSupportBreakdown | null;
}

export interface EvidenceSupportBreakdown {
  /** True when at least one evidence row is the domain's own direct-horizontal corpus. */
  directHorizontal: boolean;
  /** Distinct external source documents backing the direct-horizontal
   *  evidence — deduped by the same source-identity rule `computeConvergence`
   *  uses (`sourceDedupeKey`), so a document ingested through two acquisition
   *  paths is never counted twice (operator ruling 2026-07-28, item 4). */
  externalSourceCount: number;
  /** = `observedDomains`. Carried alongside under the operator's requested
   *  name — never a second source of truth, computed from the same set in
   *  the same pass. */
  observedVerticals: string[];
  /** = `recurrenceCount`, under the operator's requested output name. */
  crossVerticalRecurrence: number;
}

export interface CandidateRow {
  id: string;
  domain: string;
  subDomain: string | null;
  scopeLevel: DiscoveryScopeLevel;
  abstractionLevel: AbstractionLevel | null;
  discoveryClass: DiscoveryClass;
  statement: string;
  rationale: string;
  evidenceIds: string[];
  confidence: number;
  status: 'candidate' | 'promoted' | 'rejected';
  promotedInvariantId: string | null;
  createdAt: string;
  /** 'compare' = emerged from cross-sub-domain compression, not direct extraction. */
  stage: 'constitutional' | 'compare';
  classification: CompareClassification | null;
  /** Sub-domains that manifest a Compare output (its coverage). */
  coverage: string[] | null;
  /** Recursive-compression proposal (parent-child): the node's role + its TYPED,
   *  not-yet-materialised proposed parent edges. Null until compressed. */
  compression?: {
    role: 'root' | 'derived';
    parents: { parentCandidateId: string; relationship: CompressionRelationship; claim: string; confidence: number }[];
    rationale: string;
    materialized: boolean;
  } | null;
  /** Enriched at read time (route/service), not stored. */
  convergence?: ConvergenceInfo;
  /** Enriched at read time (route/service), not stored — see RecurrenceInfo. */
  recurrence?: RecurrenceInfo;
}

function committer(personaId: string): string {
  return createHash('sha256').update(`discovery:${personaId}`).digest('hex').slice(0, 16);
}

// ── Stage 1 · Evidence ──────────────────────────────────────────────────────

export async function addEvidence(
  admin: SupabaseClient,
  input: { domain: string; subDomain?: string; title: string; sourceKind: EvidenceKind; content: string; sourceRef?: string; personaId: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const content = input.content.trim();
  if (!input.title.trim() || !content) return { ok: false, error: 'title and content are required' };
  const { data, error } = await admin
    .from('discovery_evidence')
    .insert({
      domain: input.domain,
      sub_domain: input.subDomain?.trim() || null,
      title: input.title.trim(),
      source_kind: input.sourceKind,
      content: content.slice(0, 200_000), // sane cap for a single artefact
      source_ref: input.sourceRef?.trim() || null,
      added_by_commitment: committer(input.personaId),
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' };
  return { ok: true, id: String(data.id) };
}

/**
 * List evidence for a domain. When `subDomain` is given, returns domain-wide
 * evidence (sub_domain IS NULL — applies to every sub-domain) PLUS that
 * sub-domain's own evidence, so a sub-domain discovery run leverages the whole
 * domain corpus refined by its sub-domain sources.
 */
export async function listEvidence(admin: SupabaseClient, domain: string, subDomain?: string | null): Promise<EvidenceRow[]> {
  return listDomainEvidence(admin, domain, subDomain);
}

/**
 * The multi-domain form. A HORIZONTAL capability domain (PRD-IDE-002) has no
 * corpus of its own — its evidence is observed inside several verticals and
 * stored under qualified `<domain>/<observedDomain>` keys — so a discovery run
 * for it must read across all of them. `evidenceDomainsFor` decides the list;
 * a vertical resolves to `[itself]`, which is byte-for-byte the previous
 * behaviour.
 */
export async function listEvidenceForDomains(
  admin: SupabaseClient,
  domains: string[],
  subDomain?: string | null,
): Promise<EvidenceRow[]> {
  let query = admin
    .from('discovery_evidence')
    .select('id, domain, sub_domain, title, source_kind, content, source_ref, created_at')
    .in('domain', domains);
  if (subDomain) query = query.or(`sub_domain.is.null,sub_domain.eq.${subDomain}`);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => ({
    id: String(r.id), domain: String(r.domain),
    subDomain: (r.sub_domain as string | null) ?? null,
    title: String(r.title),
    sourceKind: String(r.source_kind) as EvidenceKind,
    content: String(r.content), sourceRef: (r.source_ref as string | null) ?? null,
    createdAt: String(r.created_at),
  }));
}

/**
 * THE ONE PLACE all four read paths (the Stage 1 evidence list, extraction,
 * candidate enrichment, and Compare) fetch a discovery domain's evidence
 * corpus. Routes through `evidenceDomainsFor` — so a horizontal-capability
 * domain reads BOTH its own direct corpus (evidence acquired ABOUT the
 * capability itself, stored unqualified — this is what closes the
 * 2026-07-28 structural bug: 26 rows landed at the plain `commercialisation`
 * key and were invisible because `evidenceDomainsFor` returned only the
 * qualified per-vertical keys) AND its cross-vertical observations — and
 * annotates every row with its provenance relative to `domain` so the
 * distinction is visible in output, not just implicit (operator ruling
 * 2026-07-28, item 2). A vertical domain is unaffected: `evidenceDomainsFor`
 * still resolves to `[domain]` alone and `classifyEvidenceProvenance` returns
 * `null` for every row (inv.engineering.036 — one authoritative fetch path).
 */
async function listDomainEvidence(
  admin: SupabaseClient,
  domain: string,
  subDomain?: string | null,
): Promise<EvidenceRow[]> {
  const rows = await listEvidenceForDomains(admin, evidenceDomainsFor(domain), subDomain);
  return rows.map((e) => ({ ...e, provenanceClass: classifyEvidenceProvenance(e.domain, domain) }));
}

// ── Stage 2-3 · Constitutional candidate extraction + synthesis ─────────────

// Shared mandate for both scope variants. Encodes the operator's methodology
// correction (2026-07-20): discover the invariants OF THE DOMAIN — never force
// them to domain-independent universals. Universality is discovered later by
// cross-domain comparison (inv.reasoning.340), not by this prompt.
const GRAMMAR_MANDATE = `An INVARIANT is a fundamental, reusable structure that stays constant across implementations —
an obligation, permission, prohibition, right, governance rule, or accountability constraint that recurs
across the supplied evidence. You DISCOVER candidates from evidence; you never invent them.

Rules:
- Compress, don't summarise: state the SMALLEST reusable normative structure that explains RECURRING
  patterns across the evidence (e.g. KYC + AML + CDD + sanctions + travel-rule → "Financial actions
  require verifiable accountability").
- Each candidate MUST be grounded in specific evidence items (cite their indices).
- A candidate is a single declarative sentence in the present tense — normative.
- Do NOT restate a regulation verbatim; extract the invariant beneath many regulations.
- Prefer 3-8 high-quality candidates over many shallow ones.

Assign each candidate an ABSTRACTION LEVEL:
- L0 = verbatim regulation  (REJECT — do not emit)
- L1 = regulatory summary   (REJECT — do not emit)
- L2 = cross-regulation principle (recurs across several frameworks in the domain)
- L3 = domain-constitutional invariant (a governing principle of the whole domain)
- L4 = domain-independent invariant (would hold with the domain removed)
Emit ONLY L2 and L3 candidates. Do NOT abstract to L4: naming a universal here is premature —
universality is discovered later by comparing independently-discovered domains, never asserted now.`;

/** Domain-baseline discovery — the governing invariants of the whole domain. */
function domainSystemPrompt(domain: string): string {
  return `You are an Invariant Discovery agent (constitutional class) for the DOMAIN "${domain}".
Discover the governing invariants of ${domain} AS A WHOLE — the baseline that holds across every
sub-area of the domain.

${GRAMMAR_MANDATE}

Output STRICT JSON: {"candidates":[{"statement":"...","rationale":"why this is invariant across the evidence","evidenceIndices":[0,2],"confidence":0.0-1.0,"abstractionLevel":"L2"|"L3"}]}`;
}

/** Sub-domain discovery — invariants specific to a sub-area, refining the baseline. */
function subDomainSystemPrompt(domain: string, subDomain: string): string {
  return `You are an Invariant Discovery agent (constitutional class) for the SUB-DOMAIN "${subDomain}"
within the domain "${domain}".
Discover invariants SPECIFIC to ${subDomain} that REFINE — never contradict — the ${domain} baseline.
A good sub-domain invariant is one that a general ${domain} statement would not fully capture
(e.g. for payments: "Value transfer requires end-to-end provenance"; for custody: "Custody authority
must be separable from beneficial ownership").

${GRAMMAR_MANDATE}

Output STRICT JSON: {"candidates":[{"statement":"...","rationale":"why this is invariant across the evidence","evidenceIndices":[0,2],"confidence":0.0-1.0,"abstractionLevel":"L2"|"L3"}]}`;
}

const ABSTRACTION_LEVELS: readonly AbstractionLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4'];
function normalizeAbstraction(v: unknown): AbstractionLevel | null {
  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  return (ABSTRACTION_LEVELS as readonly string[]).includes(s) ? (s as AbstractionLevel) : null;
}

interface ExtractionResult {
  candidates: { statement: string; rationale?: string; evidenceIndices?: number[]; confidence?: number; abstractionLevel?: string }[];
}

/**
 * Run constitutional discovery over the domain's evidence. Composes the
 * invariant-aware sovereign router (we dogfood our own inference for
 * discovery). Persists candidates; returns them. Idempotency is the operator's
 * call — a re-run adds a fresh discovery pass (dedup happens at promotion via
 * discoverInvariant's duplicate check).
 */
export async function runConstitutionalDiscovery(
  admin: SupabaseClient,
  domain: string,
  opts: { scopeLevel?: DiscoveryScopeLevel; subDomain?: string | null } = {},
): Promise<
  | {
      ok: true;
      candidates: CandidateRow[];
      /** Evidence rows that did not fit this pass's context budget, as typed
       *  exceptions. EMPTY is meaningful (everything was read); a non-empty
       *  list means the extraction was partial and says which rows it missed
       *  (exception-isolation ruling §7). */
      excludedEvidence: IsolationException[];
    }
  | { ok: false; error: string }
> {
  const subDomain = opts.subDomain?.trim() || null;
  const scopeLevel: DiscoveryScopeLevel = subDomain ? (opts.scopeLevel ?? 'sub-domain') : 'domain';
  // A horizontal-capability domain reads its own direct corpus AND the
  // verticals it is observed in; a vertical reads its own corpus. One
  // decision point, in the registry (`listDomainEvidence`).
  const evidence = await listDomainEvidence(admin, domain, subDomain);
  if (evidence.length === 0) {
    return {
      ok: false,
      error: subDomain
        ? `No evidence for ${domain}/${subDomain} — add sub-domain or domain-wide evidence first.`
        : 'No evidence for this domain — add evidence first (Stage 1).',
    };
  }

  // ── Bounded context — and the exclusion it causes is now REPORTED ─────────
  //
  // THE DEFECT THIS CLOSES (2026-08-03, exception-isolation ruling §7).
  //
  // At a 24,000-char budget with 6,000-char chunks, AT MOST FOUR evidence rows
  // enter an extraction pass. The loop `break`s and every remaining row is
  // silently dropped — so a corpus of 32 admitted sources would be compressed
  // from four of them, and the run would report `ok: true` with no indication
  // that 28 sources were never read. That is "safe read as finished" at Stage
  // 3: an operator would see candidates appear and reasonably conclude the
  // corpus had been extracted from.
  //
  // The isolation model's answer is not to raise the budget (the context limit
  // is real) but to make the exclusion VISIBLE: every dropped source becomes a
  // typed exception the operator can see, with the honest remedy. The
  // successful extraction still advances — the eligible cohort proceeds and
  // the excluded remainder is preserved, which is the ruling exactly.
  const MAX_CHARS = 24_000;
  const CHUNK_CHARS = 6_000;
  let used = 0;
  const included: EvidenceRow[] = [];
  const excluded: EvidenceRow[] = [];
  for (const e of evidence) {
    const chunk = e.content.slice(0, CHUNK_CHARS);
    // NOTE: no `break` — a later row that FITS is still included. The old
    // early exit also made inclusion depend on list order rather than on
    // whether the row fit at all.
    if (used + chunk.length > MAX_CHARS) {
      excluded.push(e);
      continue;
    }
    included.push({ ...e, content: chunk });
    used += chunk.length;
  }
  const excludedEvidence: IsolationException[] = excluded.map((e) => ({
    scope: 'source',
    recordId: e.id,
    recordLabel: e.title,
    cause:
      `Did not fit the ${MAX_CHARS.toLocaleString()}-character extraction context budget for this pass ` +
      `(${included.length} of ${evidence.length} evidence row(s) were read).`,
    causeGroup: 'unreadable-content',
    disposition: 'exception',
    stage: 'extract-candidates',
    // The whole ruling: an unread source does not withhold the candidates that
    // WERE extracted from the sources that fit.
    blocksCurrentStage: false,
    blocksCrystalAssignment: false,
    blocksReadiness: false,
    blocksFreeze: false,
    consequence:
      'No candidate invariant was extracted from this source in this pass. It remains admitted evidence and is ' +
      'unchanged; nothing downstream is blocked.',
    recommendedAction:
      'Run extraction again scoped to a sub-domain that includes this source, so it enters a pass with a smaller ' +
      'corpus competing for the same budget.',
    deferrableUntil: null,
  }));
  const system = subDomain ? subDomainSystemPrompt(domain, subDomain) : domainSystemPrompt(domain);
  const scopeLine = subDomain ? `DOMAIN: ${domain}\nSUB-DOMAIN: ${subDomain}` : `DOMAIN: ${domain}`;
  const user = `${scopeLine}\n\nEVIDENCE (cite by index):\n` +
    included.map((e, i) => `[${i}] (${e.sourceKind}) ${e.title}\n${e.content}`).join('\n\n---\n\n');

  let result: ExtractionResult;
  let governing: string[] = [];
  try {
    const call = await callSovereign('analysis', system, user, 1400, 0);
    governing = call.governingInvariants ?? [];
    result = JSON.parse(extractJson(call.text)) as ExtractionResult;
  } catch (e) {
    return { ok: false, error: `discovery inference failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  const raw = Array.isArray(result?.candidates) ? result.candidates : [];
  if (raw.length === 0) return { ok: true, candidates: [], excludedEvidence };

  const rows = raw
    .filter((c) => c && typeof c.statement === 'string' && c.statement.trim())
    // Drop L0/L1 (verbatim/summary) — the mandate forbids emitting them; belt-and-braces.
    .filter((c) => {
      const lvl = normalizeAbstraction(c.abstractionLevel);
      return lvl !== 'L0' && lvl !== 'L1';
    })
    .slice(0, 12)
    .map((c) => {
      const idxs = Array.isArray(c.evidenceIndices) ? c.evidenceIndices : [];
      const evidenceIds = idxs
        .map((i) => included[i]?.id)
        .filter((id): id is string => Boolean(id));
      return {
        domain,
        sub_domain: subDomain,
        scope_level: scopeLevel,
        abstraction_level: normalizeAbstraction(c.abstractionLevel),
        discovery_class: 'constitutional' as const,
        statement: c.statement.trim(),
        rationale: (c.rationale ?? '').trim(),
        evidence_ids: evidenceIds,
        confidence: typeof c.confidence === 'number' ? Math.max(0, Math.min(1, c.confidence)) : 0.5,
        discovery_provenance: {
          stage: 'constitutional', scopeLevel, subDomain,
          governingInvariants: governing, evidenceCount: included.length,
        },
      };
    });
  if (rows.length === 0) return { ok: true, candidates: [], excludedEvidence };

  const { data, error } = await admin.from('discovery_candidates').insert(rows).select('*');
  if (error) return { ok: false, error: error.message };
  const inserted = (data ?? []).map(toCandidateRow);
  return { ok: true, candidates: enrichSignals(inserted, evidence), excludedEvidence };
}

/**
 * BATCHED CONSTITUTIONAL DISCOVERY — the completeness remedy (operator ruling,
 * 2026-08-03).
 *
 *   > "Partial evidence was processed as though the full population had been
 *   >  processed."
 *
 * `runConstitutionalDiscovery` reads ONE bounded context and reports what it
 * could not fit. That is honest but partial. This orchestrator processes the
 * WHOLE admitted population by partitioning it into deterministic batches,
 * running the same extraction over each, and reconciling the results against
 * the arithmetic identity Stage 3's completion now depends on:
 *
 *     processed + explicitly excluded === admitted population
 *
 * ── What it composes, and what it does not duplicate ────────────────────────
 *
 * Partitioning, reconciliation, global dedup and the completion rule all live
 * in `batchedExtraction.ts` as pure functions. The per-batch model call is
 * `extractCandidatesFromBatch` below — the SAME prompt construction, parsing
 * and filtering the single-pass path uses, factored out rather than copied
 * (inv.engineering.036/037). Neither path holds a second copy of the grammar
 * mandate or the L0/L1 rejection rule.
 *
 * ── Rows are inserted ONCE, after global dedup ──────────────────────────────
 *
 * Candidates are accumulated in memory across batches and written in a single
 * insert AFTER reconciliation. Inserting per batch would persist the same
 * invariant twice whenever two batches independently surfaced it — which is
 * exactly the convergence case dedup exists to fold together.
 */
export interface BatchedDiscoveryResult {
  ok: true;
  candidates: CandidateRow[];
  reconciliation: ExtractionReconciliation;
  /** The operator's "total input / processed / excluded", ready to render. */
  account: string;
  /** Per-batch summaries, for the receipt the caller writes. */
  batches: { index: number; evidenceCount: number; ok: boolean; error?: string; candidateCount: number }[];
}

export async function runBatchedConstitutionalDiscovery(
  admin: SupabaseClient,
  domain: string,
  opts: { scopeLevel?: DiscoveryScopeLevel; subDomain?: string | null } = {},
): Promise<BatchedDiscoveryResult | { ok: false; error: string }> {
  const subDomain = opts.subDomain?.trim() || null;
  const scopeLevel: DiscoveryScopeLevel = subDomain ? (opts.scopeLevel ?? 'sub-domain') : 'domain';
  const evidence = await listDomainEvidence(admin, domain, subDomain);
  if (evidence.length === 0) {
    return {
      ok: false,
      error: subDomain
        ? `No evidence for ${domain}/${subDomain} — add sub-domain or domain-wide evidence first.`
        : 'No evidence for this domain — add evidence first (Stage 1).',
    };
  }

  // Deterministic: a function of the SET, never of fetch order or the clock.
  const { batches, unprocessable, truncatedRows } = partitionEvidence(evidence);

  const outcomes: BatchOutcome[] = [];
  for (const batch of batches) {
    const rows = batch.rows.map((r) => evidence.find((e) => e.id === r.id)!).filter(Boolean);
    const result = await extractCandidatesFromBatch(domain, subDomain, rows);
    outcomes.push({
      index: batch.index,
      evidenceIds: batch.rows.map((r) => r.id),
      ok: result.ok,
      ...(result.ok ? {} : { error: result.error }),
      candidates: result.ok ? result.candidates : [],
    });
    // A FAILED BATCH DOES NOT STOP THE RUN. The loop continues; the failure is
    // reconciled as an explicit exclusion of that batch's rows.
  }

  const reconciliation = reconcileExtraction({
    admittedEvidenceIds: evidence.map((e) => e.id),
    batches: outcomes,
    unprocessable,
    truncatedRows,
  });

  // ── ONE insert, after global dedup ────────────────────────────────────────
  let inserted: CandidateRow[] = [];
  if (reconciliation.candidates.length > 0) {
    const toInsert = reconciliation.candidates.map((c) => ({
      domain,
      sub_domain: subDomain,
      scope_level: scopeLevel,
      abstraction_level: normalizeAbstraction(c.abstractionLevel),
      discovery_class: 'constitutional' as const,
      statement: c.statement,
      rationale: c.rationale,
      evidence_ids: c.evidenceIds,
      confidence: c.confidence,
      discovery_provenance: {
        stage: 'constitutional',
        scopeLevel,
        subDomain,
        evidenceCount: reconciliation.processed,
        // The account travels WITH the candidates, so a later reader of these
        // rows can see the population they were compressed from rather than
        // assuming it was the whole corpus.
        batchedExtraction: {
          totalInput: reconciliation.totalInput,
          processed: reconciliation.processed,
          excluded: reconciliation.excluded,
          reconciles: reconciliation.reconciles,
          batchCount: reconciliation.batchCount,
        },
      },
    }));
    const { data, error } = await admin.from('discovery_candidates').insert(toInsert).select('*');
    if (error) return { ok: false, error: error.message };
    inserted = (data ?? []).map(toCandidateRow);
  }

  return {
    ok: true,
    candidates: enrichSignals(inserted, evidence),
    reconciliation,
    account: renderExtractionAccount(reconciliation),
    batches: outcomes.map((o) => ({
      index: o.index,
      evidenceCount: o.evidenceIds.length,
      ok: o.ok,
      ...(o.error ? { error: o.error } : {}),
      candidateCount: o.candidates.length,
    })),
  };
}

/**
 * ONE batch's extraction — the model call, parsing and filtering, factored out
 * of `runConstitutionalDiscovery` so the single-pass and batched paths cannot
 * drift apart. Returns parsed candidates; PERSISTS NOTHING, because the
 * batched path must dedup globally before anything is written.
 */
async function extractCandidatesFromBatch(
  domain: string,
  subDomain: string | null,
  rows: readonly EvidenceRow[],
): Promise<{ ok: true; candidates: ExtractedCandidate[] } | { ok: false; error: string }> {
  const included = rows.map((e) => ({ ...e, content: e.content.slice(0, 6_000) }));
  const system = subDomain ? subDomainSystemPrompt(domain, subDomain) : domainSystemPrompt(domain);
  const scopeLine = subDomain ? `DOMAIN: ${domain}\nSUB-DOMAIN: ${subDomain}` : `DOMAIN: ${domain}`;
  const user =
    `${scopeLine}\n\nEVIDENCE (cite by index):\n` +
    included.map((e, i) => `[${i}] (${e.sourceKind}) ${e.title}\n${e.content}`).join('\n\n---\n\n');

  let parsed: ExtractionResult;
  try {
    const call = await callSovereign('analysis', system, user, 1400, 0);
    parsed = JSON.parse(extractJson(call.text)) as ExtractionResult;
  } catch (e) {
    return { ok: false, error: `discovery inference failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  const raw = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  const candidates: ExtractedCandidate[] = raw
    .filter((c) => c && typeof c.statement === 'string' && c.statement.trim())
    // Drop L0/L1 (verbatim/summary) — the same belt-and-braces filter the
    // single-pass path applies, from the same mandate.
    .filter((c) => {
      const lvl = normalizeAbstraction(c.abstractionLevel);
      return lvl !== 'L0' && lvl !== 'L1';
    })
    .slice(0, 12)
    .map((c) => ({
      statement: c.statement.trim(),
      rationale: (c.rationale ?? '').trim(),
      evidenceIds: (Array.isArray(c.evidenceIndices) ? c.evidenceIndices : [])
        .map((i) => included[i]?.id)
        .filter((id): id is string => Boolean(id)),
      confidence: typeof c.confidence === 'number' ? Math.max(0, Math.min(1, c.confidence)) : 0.5,
      abstractionLevel: c.abstractionLevel ?? null,
    }));
  return { ok: true, candidates };
}

/** Both read-time signals in one pass — convergence (within-corpus support) and
 *  recurrence (across-domain support). Neither is persisted. */
function enrichSignals(candidates: CandidateRow[], evidence: EvidenceRow[]): CandidateRow[] {
  return enrichRecurrence(enrichConvergence(candidates, evidence), evidence);
}

export async function listCandidates(admin: SupabaseClient, domain: string, subDomain?: string | null): Promise<CandidateRow[]> {
  let query = admin
    .from('discovery_candidates')
    .select('*')
    .eq('domain', domain);
  // Domain baseline view = sub_domain IS NULL; a sub-domain view = that sub-domain only.
  query = subDomain ? query.eq('sub_domain', subDomain) : query.is('sub_domain', null);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return [];
  const rows = (data ?? []).map(toCandidateRow);
  const evidence = await listDomainEvidence(admin, domain, subDomain);
  return enrichSignals(rows, evidence);
}

// ── Cross-framework convergence (derived; a priority signal, not validity) ───

/** The identity key used to dedupe ONE SOURCE DOCUMENT across evidence rows —
 *  coalesce(sourceRef, title), case-insensitive. Shared by `computeConvergence`
 *  (within-corpus support) and `computeRecurrence`'s direct-horizontal
 *  external-source count — a document that reaches `discovery_evidence`
 *  through two acquisition paths must not be counted twice (operator ruling
 *  2026-07-28, item 4: use the existing evidence-identity mechanism, don't
 *  invent a second one). */
function sourceDedupeKey(e: EvidenceRow): string {
  return (e.sourceRef?.trim() || e.title.trim()).toLowerCase();
}

/** Distinct-source support for one candidate. A source document is deduped on
 *  coalesce(sourceRef, title) — evidence rows are distinct PKs, but one document
 *  ingested twice should count once. Support is EVIDENCE, not truth (Law XII). */
export function computeConvergence(evidenceIds: string[], evidence: EvidenceRow[]): ConvergenceInfo {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const frameworks = new Map<string, string>(); // dedup key → display title
  for (const id of evidenceIds) {
    const e = byId.get(id);
    if (!e) continue;
    const key = sourceDedupeKey(e);
    if (!frameworks.has(key)) frameworks.set(key, e.title.trim());
  }
  const supportCount = frameworks.size;
  const tier: ConvergenceInfo['tier'] = supportCount >= 5 ? 'broad' : supportCount >= 2 ? 'strong' : 'single';
  return { supportCount, frameworks: [...frameworks.values()], tier };
}

/** Attach convergence to each candidate; keep insertion order stable (the route
 *  or UI sorts by convergence for display). */
export function enrichConvergence(candidates: CandidateRow[], evidence: EvidenceRow[]): CandidateRow[] {
  return candidates.map((c) => ({ ...c, convergence: computeConvergence(c.evidenceIds, evidence) }));
}

// ── Cross-domain recurrence (derived; PRD-IDE-002 Addendum A) ────────────────

/**
 * Count the DISTINCT domains a candidate's evidence was observed in. The
 * observed domain is read straight off each evidence row's `domain`, with a
 * qualified `<discoveryDomain>/<observedDomain>` key parsed down to its observed
 * half — so nothing is inferred, stored, or maintained in parallel.
 *
 * Evidence ids that no longer resolve are ignored (same discipline as
 * `computeConvergence`): a stale reference must not inflate a recurrence score.
 *
 * `domain` — THE LOAD-BEARING PARAMETER (operator ruling 2026-07-28, item 3).
 * When `domain` is the candidate's OWN horizontal-capability domain, evidence
 * rows that are that domain's own direct-horizontal corpus (unqualified —
 * `root === domain === observedDomain`) are EXCLUDED from the cross-domain
 * observed set: "The plain `commercialisation` domain may strengthen
 * evidential support or confidence, but it must not increment the
 * cross-domain recurrence count." Without this exclusion, every candidate
 * with any direct-horizontal evidence gets its recurrence count inflated by
 * one for a domain that isn't a real vertical at all — the exact corruption
 * the ruling forbids.
 *
 * The exclusion applies ONLY when `domain` is genuinely a horizontal-
 * capability domain (`discoveryDomain(domain)?.kind === 'horizontal-capability'`).
 * A VERTICAL domain's own unqualified evidence (e.g. `financial-services`
 * scoring its own corpus) is UNAFFECTED — `isHorizontalCandidate` is false
 * for it, so the exclusion branch never runs and every row counts exactly as
 * it always has. `domain` is optional and defaults to no exclusion at all
 * (byte-for-byte the pre-fix behaviour) — every existing call site that
 * doesn't have domain context keeps working unchanged.
 */
export function computeRecurrence(evidenceIds: string[], evidence: EvidenceRow[], domain?: string): RecurrenceInfo {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const isHorizontalCandidate = Boolean(domain) && discoveryDomain(domain!)?.kind === 'horizontal-capability';

  const observed = new Set<string>();
  let directHorizontalPresent = false;
  const directHorizontalSources = new Map<string, string>();

  for (const id of evidenceIds) {
    const e = byId.get(id);
    if (!e) continue;
    const { discoveryDomain: root, observedDomain } = parseObservationDomain(e.domain);

    if (isHorizontalCandidate && root === domain && observedDomain === domain) {
      // The candidate's own horizontal domain's direct corpus — external
      // evidence ABOUT the capability itself, not a vertical observation.
      // Tracked for `evidenceSupport`, never added to `observed`.
      directHorizontalPresent = true;
      const key = sourceDedupeKey(e);
      if (!directHorizontalSources.has(key)) directHorizontalSources.set(key, e.title.trim());
      continue;
    }
    observed.add(observedDomain);
  }

  const observedDomains = [...observed].sort();
  const recurrenceCount = observedDomains.length;
  const tier: RecurrenceInfo['tier'] =
    recurrenceCount >= 3 ? 'broad-cross-domain' : recurrenceCount === 2 ? 'cross-domain' : 'single-domain';
  return {
    observedDomains,
    recurrenceCount,
    tier,
    classificationFloor: recurrenceCount >= 2 ? 'supported' : 'specialized',
    maxAbstractionLevel: recurrenceCount >= 2 ? 'L4' : 'L3',
    evidenceSupport: isHorizontalCandidate
      ? {
          directHorizontal: directHorizontalPresent,
          externalSourceCount: directHorizontalSources.size,
          observedVerticals: observedDomains,
          crossVerticalRecurrence: recurrenceCount,
        }
      : null,
  };
}

/** Attach recurrence to each candidate; order is preserved (callers sort).
 *  Each candidate's OWN `domain` is threaded through as the scoring context
 *  (the load-bearing exclusion in `computeRecurrence`) — already on every
 *  `CandidateRow`, so no new context needs to be plumbed in. */
export function enrichRecurrence(candidates: CandidateRow[], evidence: EvidenceRow[]): CandidateRow[] {
  return candidates.map((c) => ({ ...c, recurrence: computeRecurrence(c.evidenceIds, evidence, c.domain) }));
}

// ── Cross-sub-domain Compare (CFS-048 Phase 2 — earned domain invariants) ─────

const COMPARE_SYSTEM = `You are the Compare stage of an Invariant Discovery Engine. You are given the candidate
invariants independently discovered for SEVERAL SUB-DOMAINS of one domain, plus the domain's provisional
BASELINE hypotheses. Your job is COMPRESSION, not merging text: find the same governing invariant
manifesting across sub-domains and compress each cluster into ONE domain-level invariant.

Method:
- Cluster manifestations that express the SAME underlying invariant across sub-domains (e.g. "verifiable
  accountability" (payments) + "transaction accountability" (banking) + "market transparency" (trading)
  → one accountability invariant).
- REWRITE UPWARD into invariant form — a timeless governing principle, NOT a policy statement.
  Bad: "Trading activities must ensure transparency." Good: "Traceability enables accountability."
- Classify each compressed candidate against the baseline:
    supported    — recurs INDEPENDENTLY across ≥2 sub-domains (list them in coverage)
    specialized  — appears in only ONE sub-domain (belongs lower in the hierarchy)
    split        — a single baseline hypothesis that actually contains two distinct invariants
    novel        — recurs across sub-domains but is ABSENT from the baseline (the most valuable)
    equivalent   — the SAME invariant as a baseline item but expressed at a different abstraction
                   level (a level mismatch, NOT a new invariant — do not mark these novel or split)
- coverage = the exact sub-domain names (from the input) that manifest this invariant.
- Do NOT invent invariants unsupported by the sub-domain candidates. Compress what is there.
- The baseline hypotheses are NOT ground truth — they may be supported, split, specialized, or found
  incomplete. Treat them as hypotheses to test against the accumulated sub-domain evidence.

Output STRICT JSON: {"candidates":[{"statement":"<invariant form>","rationale":"which manifestations compress into this and how","classification":"supported|specialized|split|novel","coverage":["<sub-domain>",...],"abstractionLevel":"L3"|"L4"}]}`;

interface CompareExtraction {
  candidates: { statement: string; rationale?: string; classification?: string; coverage?: string[]; abstractionLevel?: string }[];
}

/**
 * Compare the independently-discovered sub-domain candidate sets of a domain and
 * compress recurrence into EARNED domain-level invariants (Aletheon 2026-07-20).
 * The original domain baseline is passed as provisional hypotheses to test, not
 * truth. Compare outputs persist as domain-scoped candidates tagged
 * provenance.stage='compare' with their classification + coverage; confidence is
 * driven by INDEPENDENT RECURRENCE (coverage breadth), not model self-report.
 */
export async function compareSubDomains(
  admin: SupabaseClient,
  domain: string,
): Promise<{ ok: true; candidates: CandidateRow[]; comparedSubDomains: string[]; inputInvariantCount: number } | { ok: false; error: string }> {
  // Gather the domain's sub-domain invariants, grouped by sub-domain. Include
  // BOTH un-promoted candidates AND promoted ones: promotion (landing a
  // sub-domain candidate in the registry as `proposed`) is the intended next
  // step, and a promoted sub-domain invariant is the STRONGEST input to
  // cross-sub-domain comparison — it survived review. Excluding promoted rows
  // made Compare spuriously fail after the operator did the right thing and
  // promoted their sub-domain findings (only 'rejected' is excluded).
  const { data: subData, error: subErr } = await admin
    .from('discovery_candidates')
    .select('*')
    .eq('domain', domain)
    .in('status', ['candidate', 'promoted'])
    .not('sub_domain', 'is', null);
  if (subErr) return { ok: false, error: subErr.message };
  const subRows = (subData ?? []).map(toCandidateRow);
  const bySub = new Map<string, CandidateRow[]>();
  for (const r of subRows) {
    if (!r.subDomain) continue;
    const arr = bySub.get(r.subDomain) ?? [];
    arr.push(r);
    bySub.set(r.subDomain, arr);
  }
  const comparedSubDomains = [...bySub.keys()];
  if (comparedSubDomains.length < 2) {
    return {
      ok: false,
      error:
        `Compare needs invariants in at least 2 sub-domains (found ${comparedSubDomains.length}). ` +
        `Run discovery with a SUB-DOMAIN selected for at least two areas — a "Domain baseline" run ` +
        `(no sub-domain) does not count. Promoted sub-domain invariants are included.`,
    };
  }

  // Baseline = the domain's provisional hypotheses (direct-extraction, not
  // compare). Same status breadth as the sub-domain set — a promoted baseline
  // hypothesis is still a valid thing to test recurrence against.
  const { data: baseData } = await admin
    .from('discovery_candidates')
    .select('*')
    .eq('domain', domain)
    .is('sub_domain', null)
    .in('status', ['candidate', 'promoted']);
  const baseline = (baseData ?? []).map(toCandidateRow).filter((c) => c.stage !== 'compare');

  const subBlock = comparedSubDomains
    .map((sd) => `SUB-DOMAIN "${sd}":\n` + bySub.get(sd)!.slice(0, 8).map((c) => `- ${c.statement}`).join('\n'))
    .join('\n\n');
  const baseBlock = baseline.length
    ? `PROVISIONAL DOMAIN BASELINE (hypotheses to test):\n${baseline.slice(0, 12).map((c) => `- ${c.statement}`).join('\n')}`
    : 'PROVISIONAL DOMAIN BASELINE: (none yet)';
  const user = `DOMAIN: ${domain}\n\n${subBlock}\n\n${baseBlock}`;

  let parsed: CompareExtraction;
  let governing: string[] = [];
  try {
    const call = await callSovereign('analysis', COMPARE_SYSTEM, user, 2200, 0);
    governing = call.governingInvariants ?? [];
    parsed = JSON.parse(extractJson(call.text)) as CompareExtraction;
  } catch (e) {
    return { ok: false, error: `compare inference failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  const raw = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  const rows = raw
    .filter((c) => c && typeof c.statement === 'string' && c.statement.trim())
    .slice(0, 16)
    .map((c) => {
      const coverage = (Array.isArray(c.coverage) ? c.coverage : []).filter((s) => comparedSubDomains.includes(s));
      const classification: CompareClassification =
        COMPARE_CLASSES.includes(String(c.classification))
          ? (c.classification as CompareClassification)
          : coverage.length >= 2 ? 'supported' : 'specialized';
      // Confidence from INDEPENDENT RECURRENCE (coverage breadth), not self-report.
      const cov = coverage.length || 1;
      const confidence = Math.min(0.97, 0.55 + 0.1 * cov);
      // Union of evidence across the contributing sub-domains → convergence still meaningful.
      const contributing = subRows.filter((r) => r.subDomain && coverage.includes(r.subDomain));
      const evidenceIds = [...new Set(contributing.flatMap((r) => r.evidenceIds))];
      return {
        domain,
        sub_domain: null,
        scope_level: 'domain' as const,
        abstraction_level: normalizeAbstraction(c.abstractionLevel) ?? 'L3',
        discovery_class: 'constitutional' as const,
        statement: c.statement.trim(),
        rationale: (c.rationale ?? '').trim(),
        evidence_ids: evidenceIds,
        confidence,
        discovery_provenance: {
          stage: 'compare',
          classification,
          coverage,
          contributingCandidateIds: contributing.map((r) => r.id),
          comparedSubDomains,
          governingInvariants: governing,
        },
      };
    });
  // Compression ratio input = the distinct sub-domain invariants that fed the
  // compare (the recurrence substrate); output = the earned domain invariants.
  const inputInvariantCount = subRows.length;
  if (rows.length === 0) return { ok: true, candidates: [], comparedSubDomains, inputInvariantCount };

  const { data, error } = await admin.from('discovery_candidates').insert(rows).select('*');
  if (error) return { ok: false, error: error.message };
  const inserted = (data ?? []).map(toCandidateRow);
  // Convergence + recurrence over the domain's whole evidence corpus.
  const evidence = await listDomainEvidence(admin, domain);
  return { ok: true, candidates: enrichSignals(inserted, evidence), comparedSubDomains, inputInvariantCount };
}

// ── Recursive compression (parent-child keystone) ────────────────────────────

/**
 * The relationship a derived invariant bears to a parent — TYPED, not a generic
 * "derived" (Aletheon 2026-07-21: "enables/governs" ≠ "logically entailed").
 * Each maps to an existing graph edge type at materialisation.
 */
export const COMPRESSION_RELATIONSHIPS = ['entails', 'specializes', 'depends_on', 'supports'] as const;
export type CompressionRelationship = (typeof COMPRESSION_RELATIONSHIPS)[number];

/** Relationship (child→parent) → graph InvariantEdgeType. */
const RELATIONSHIP_EDGE_TYPE: Record<CompressionRelationship, string> = {
  entails: 'derives_from', // parent logically entails child ⇒ child derives_from parent
  specializes: 'specializes',
  depends_on: 'depends_on',
  supports: 'supports',
};

// De-biased: the pass DISCOVERS structure, it does not confirm a preferred
// ontology. No worked FS example names which invariant is a root — that would
// steer the result. Relationship types are defined abstractly; a node may be a
// root, may have several parents, and different valid structures may result.
const COMPRESS_DOMAIN_SYSTEM = `You are the RECURSIVE COMPRESSION stage of an Invariant Discovery Engine. You are given the
DOMAIN-LEVEL invariants discovered for one domain. Discover the DERIVATION STRUCTURE among them: which are
FOUNDATIONAL (roots) and which stand in a relationship to one or more OTHERS. Your task is to DISCOVER the
structure the statements actually support — NOT to confirm any preferred hierarchy. Multiple different
structures may be valid; return the one the statements warrant, even if it is flat (all roots).

For each node, decide its role and — if it relates to others — the TYPED relationship to each parent:
- role "root": foundational; stands on its own; not derived from another invariant in the set.
- role "derived": stands in a relationship to one or more OTHER invariants. For each parent give the
  relationship TYPE (be precise — these differ):
    entails      — the parent LOGICALLY ENTAILS this node (this node necessarily follows from the parent).
    specializes  — this node is a more specific case of the parent.
    depends_on   — this node DEPENDS ON the parent to hold, without being logically entailed by it.
    supports     — this node merely SUPPORTS / is corroborated by the parent (the WEAKEST link; use when
                   it is not entailment, specialisation, or dependence).
  For each parent edge also give: a specific "claim" stating the exact relationship (not a restatement),
  and a "confidence" in [0,1] for that edge.

Rules:
- Ground strictly in the given statements. Do NOT invent invariants or relationships they do not support.
  If unsure whether A entails B or merely supports it, choose the WEAKER type.
- A parent index MUST reference OTHER indices (never itself); the graph MUST be acyclic.
- Prefer fewer, well-justified edges over many weak ones. A flat all-roots result is acceptable.

Output STRICT JSON: {"nodes":[{"index":<i>,"role":"root"|"derived","parents":[{"index":<parent i>,"relationship":"entails|specializes|depends_on|supports","claim":"the specific relationship claim","confidence":<0-1>}],"rationale":"why this role"}]}`;

interface CompressExtraction {
  nodes: {
    index: number;
    role?: string;
    parents?: { index: number; relationship?: string; claim?: string; confidence?: number }[];
    rationale?: string;
  }[];
}

/** A proposed, TYPED, not-yet-materialised parent edge (child → parent). */
export interface ProposedParentEdge {
  parentCandidateId: string;
  parentStatement: string;
  relationship: CompressionRelationship;
  claim: string;
  confidence: number;
}

export interface DomainCompressionNode {
  candidateId: string;
  statement: string;
  role: 'root' | 'derived';
  parents: ProposedParentEdge[];
  rationale: string;
}

function normalizeRelationship(v: unknown): CompressionRelationship {
  const s = String(v);
  // Unknown / uncertain → the weakest link (never over-claim entailment).
  return (COMPRESSION_RELATIONSHIPS as readonly string[]).includes(s) ? (s as CompressionRelationship) : 'supports';
}

/**
 * Recursive compression — a SECOND-order Compare over the domain's own earned
 * invariants: PROPOSE the derivation structure (roots vs derived) with TYPED,
 * evidence-bearing parent edges. Deterministic (temp 0), strictly grounded,
 * acyclic. The proposal is persisted additively into
 * `discovery_provenance.compression`; it is NEVER materialised into graph edges
 * here — materialisation requires explicit operator confirmation
 * (`materializeCompressionEdges`). Confidence/status/promotion untouched
 * (structure discovery, not validity — Law XII).
 */
export async function compressDomainInvariants(
  admin: SupabaseClient,
  domain: string,
): Promise<
  | { ok: true; hierarchy: DomainCompressionNode[]; rootCount: number; derivedCount: number }
  | { ok: false; error: string }
> {
  const { data, error } = await admin
    .from('discovery_candidates')
    .select('*')
    .eq('domain', domain)
    .is('sub_domain', null)
    .in('status', ['candidate', 'promoted']);
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []).map(toCandidateRow);
  if (rows.length < 2) {
    return {
      ok: false,
      error: `Recursive compression needs at least 2 domain invariants (found ${rows.length}). Run Compare first to earn domain invariants.`,
    };
  }
  const rawById = new Map<string, Record<string, unknown>>();
  for (const r of data ?? []) rawById.set(String(r.id), r as Record<string, unknown>);

  const items = rows.slice(0, 24);
  const user =
    `DOMAIN: ${domain}\n\nDOMAIN INVARIANTS (discover the derivation structure; cite by index):\n` +
    items.map((c, i) => `[${i}] ${c.statement}`).join('\n');

  let parsed: CompressExtraction;
  try {
    const call = await callSovereign('analysis', COMPRESS_DOMAIN_SYSTEM, user, 2000, 0);
    parsed = JSON.parse(extractJson(call.text)) as CompressExtraction;
  } catch (e) {
    return { ok: false, error: `compression inference failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];

  const hierarchy: DomainCompressionNode[] = [];
  for (let idx = 0; idx < items.length; idx++) {
    const c = items[idx];
    const n = nodes.find((x) => Number(x.index) === idx);
    const rawParents = Array.isArray(n?.parents) ? n!.parents : [];
    // Valid other-indices only; drop self-refs + out-of-range; dedupe by parent index.
    const seen = new Set<number>();
    const parents: ProposedParentEdge[] = [];
    for (const p of rawParents) {
      const pi = Number(p?.index);
      if (!Number.isInteger(pi) || pi === idx || pi < 0 || pi >= items.length || seen.has(pi)) continue;
      seen.add(pi);
      parents.push({
        parentCandidateId: items[pi].id,
        parentStatement: items[pi].statement,
        relationship: normalizeRelationship(p?.relationship),
        claim: String(p?.claim ?? '').slice(0, 400),
        confidence: Math.max(0, Math.min(1, Number(p?.confidence) || 0.5)),
      });
    }
    const role: 'root' | 'derived' = n && String(n.role) === 'derived' && parents.length > 0 ? 'derived' : 'root';
    const rationale = String(n?.rationale ?? '').slice(0, 600);
    hierarchy.push({ candidateId: c.id, statement: c.statement, role, parents: role === 'derived' ? parents : [], rationale });

    // Persist the PROPOSAL additively into provenance (merge, never clobber). NOT
    // materialised — `materialized: false` until the operator confirms.
    const raw = rawById.get(c.id) ?? {};
    const prov = { ...((raw.discovery_provenance ?? {}) as Record<string, unknown>) };
    prov.compression = {
      role,
      rationale,
      materialized: false,
      parents: (role === 'derived' ? parents : []).map((p) => ({
        parentCandidateId: p.parentCandidateId,
        relationship: p.relationship,
        claim: p.claim,
        confidence: p.confidence,
      })),
    };
    await admin.from('discovery_candidates').update({ discovery_provenance: prov }).eq('id', c.id);
  }

  const rootCount = hierarchy.filter((h) => h.role === 'root').length;
  return { ok: true, hierarchy, rootCount, derivedCount: hierarchy.length - rootCount };
}

/**
 * OPERATOR-CONFIRMED materialisation of a derived candidate's proposed typed
 * edges into the invariant graph. Only runs on explicit operator action (route/
 * UI) — nothing is inserted automatically on promotion (Aletheon 2026-07-21).
 * Requires the child AND each parent to be PROMOTED (have a graph invariant id);
 * parents not yet promoted are reported as skipped. Each edge is created with
 * the PROPOSED relationship's edge type + the entailment claim as its rationale.
 */
export async function materializeCompressionEdges(
  admin: SupabaseClient,
  candidateId: string,
): Promise<{ ok: true; linked: number; skipped: number } | { ok: false; error: string }> {
  const { data: c } = await admin
    .from('discovery_candidates')
    .select('promoted_invariant_id, status, discovery_provenance')
    .eq('id', candidateId)
    .maybeSingle();
  if (!c) return { ok: false, error: 'candidate not found' };
  if (c.status !== 'promoted' || !c.promoted_invariant_id) {
    return { ok: false, error: 'candidate is not promoted — promote it (and its parent roots) first' };
  }
  const prov = (c.discovery_provenance ?? {}) as Record<string, unknown>;
  const comp = prov.compression as { parents?: { parentCandidateId: string; relationship: string; claim?: string }[] } | undefined;
  const proposed = Array.isArray(comp?.parents) ? comp!.parents : [];
  if (proposed.length === 0) return { ok: true, linked: 0, skipped: 0 };

  // Resolve each parent CANDIDATE → its promoted invariant id (skip un-promoted).
  const parentCandidateIds = proposed.map((p) => p.parentCandidateId);
  const { data: parentRows } = await admin
    .from('discovery_candidates')
    .select('id, promoted_invariant_id')
    .in('id', parentCandidateIds)
    .not('promoted_invariant_id', 'is', null);
  const promotedByCandidate = new Map((parentRows ?? []).map((r) => [String(r.id), String(r.promoted_invariant_id)]));

  const childInvariantId = String(c.promoted_invariant_id);
  let linked = 0;
  let skipped = 0;
  for (const p of proposed) {
    const parentInvariantId = promotedByCandidate.get(p.parentCandidateId);
    if (!parentInvariantId) { skipped += 1; continue; }
    const edgeType = RELATIONSHIP_EDGE_TYPE[normalizeRelationship(p.relationship)];
    try {
      await addEdge({
        fromInvariantId: childInvariantId,
        toInvariantId: parentInvariantId,
        edgeType: edgeType as never,
        rationale: `CFS-048 recursive compression (${p.relationship}): ${String(p.claim ?? '').slice(0, 300)}`,
      });
      linked += 1;
    } catch (e) {
      // Cycle/duplicate/etc. — never fail the whole confirmation.
      console.error(`[CFS-048] compression edge failed ${childInvariantId}→${parentInvariantId} (${edgeType}): ${e instanceof Error ? e.message : String(e)}`);
      skipped += 1;
    }
  }
  if (linked > 0) {
    const nextProv = { ...prov, compression: { ...(comp as object), materialized: true } };
    await admin.from('discovery_candidates').update({ discovery_provenance: nextProv }).eq('id', candidateId);
  }
  return { ok: true, linked, skipped };
}

// ── Stage 5 · Promotion into the canonical lifecycle (lands at `proposed`) ──

/**
 * Promote a candidate into the canonical registry as `proposed` — NEVER
 * canonical (inv.reasoning.337). Composes discoverInvariant (dedup + form +
 * receipt). Carries evidence provenance so the invariant traces back to its
 * sources (inv.reasoning.335).
 */
export interface ParentSuggestion {
  invariantId: string;
  statement: string;
  similarity: number;
}

/**
 * Create `specializes` edges from a child invariant to each parent, idempotently
 * (skips parents already linked and self-loops). A graph, not a tree — multiple
 * parents allowed. Edge failures only log; they never throw. Shared by promotion
 * (new invariants) and retro-linking (already-promoted invariants).
 */
async function createSpecializesEdges(childInvariantId: string, parentIds: string[], rationale: string): Promise<number> {
  const uniqueParents = [...new Set(parentIds)].filter((id) => id && id !== childInvariantId);
  if (uniqueParents.length === 0) return 0;
  let existing = new Set<string>();
  try {
    const edges = await listEdgesForInvariants([childInvariantId], 'out', ['specializes']);
    existing = new Set(edges.map((e) => e.toInvariantId));
  } catch { /* best-effort dedup — proceed without it */ }
  let linked = 0;
  for (const parentId of uniqueParents) {
    if (existing.has(parentId)) continue;
    try {
      await addEdge({ fromInvariantId: childInvariantId, toInvariantId: parentId, edgeType: 'specializes', rationale });
      linked += 1;
    } catch (edgeErr) {
      console.error(`[CFS-048] specializes-edge failed ${childInvariantId}→${parentId}: ${edgeErr instanceof Error ? edgeErr.message : String(edgeErr)}`);
    }
  }
  return linked;
}

/**
 * Retro-link an ALREADY-PROMOTED sub-domain invariant to operator-confirmed
 * domain parents — for invariants promoted before parent-linking existed
 * (Investment/Market Ops etc.). Attaches `specializes` edges to the existing
 * invariant without re-promoting. Idempotent. (Recursive-compression domain→
 * domain edges use the TYPED, operator-confirmed `materializeCompressionEdges`.)
 */
export async function linkPromotedParents(
  admin: SupabaseClient,
  candidateId: string,
  parentInvariantIds: string[],
): Promise<{ ok: true; linkedParents: number } | { ok: false; error: string }> {
  const { data: c } = await admin
    .from('discovery_candidates')
    .select('domain, sub_domain, promoted_invariant_id, status')
    .eq('id', candidateId)
    .maybeSingle();
  if (!c) return { ok: false, error: 'candidate not found' };
  if (c.status !== 'promoted' || !c.promoted_invariant_id) return { ok: false, error: 'candidate is not promoted — nothing to link' };
  const linked = await createSpecializesEdges(
    String(c.promoted_invariant_id),
    parentInvariantIds,
    `CFS-048 retro-link: sub-domain invariant specializes domain invariant (${String(c.sub_domain ?? c.domain)})`,
  );
  return { ok: true, linkedParents: linked };
}

/**
 * Suggest parent domain invariants a sub-domain candidate could `specialize`
 * (Aletheon's keystone). Parents = already-promoted DOMAIN-level invariants in
 * the same domain (baseline or Compare-earned), ranked by statement similarity.
 * The engine PROPOSES; the operator confirms — the edge is never automatic.
 */
export async function suggestParents(admin: SupabaseClient, candidateId: string): Promise<ParentSuggestion[]> {
  const { data: c } = await admin
    .from('discovery_candidates')
    .select('domain, sub_domain, statement')
    .eq('id', candidateId)
    .maybeSingle();
  if (!c) return [];
  // Promoted domain-level invariants (sub_domain IS NULL, status promoted) in this domain.
  const { data: parents } = await admin
    .from('discovery_candidates')
    .select('promoted_invariant_id, statement')
    .eq('domain', String(c.domain))
    .is('sub_domain', null)
    .eq('status', 'promoted')
    .not('promoted_invariant_id', 'is', null);
  const stmt = String(c.statement ?? '');
  return (parents ?? [])
    .map((p) => ({
      invariantId: String(p.promoted_invariant_id),
      statement: String(p.statement ?? ''),
      similarity: Number(similarity(stmt, String(p.statement ?? '')).toFixed(3)),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 4);
}

/**
 * The classify form's PRE-POPULATION (operator, 2026-07-28: "the URL and
 * rationale for inclusion was provided with the sources… use that to
 * pre-populate these fields rather than having the operator re-enter them from
 * scratch").
 *
 * Same shape and same discipline as {@link suggestParents}: the server
 * computes a SUGGESTION, the surface shows it, the operator confirms. Nothing
 * is applied here — this function performs no write, proposes no provenance
 * class, and cannot classify anything. It resolves a chain that is already
 * fully recorded:
 *
 *   invariant.provenance.evidence_ids
 *     → discovery_evidence.source_ref            (the canonical document URL,
 *                                                 written by the Ingestion
 *                                                 Broker from the candidate's
 *                                                 canonical_url)
 *     → corpus_candidate_sources                 (title, issuer, the class the
 *                                                 reviewer recorded, notes)
 *     → corpus_acquisition_seeds.claim           (the operator's own recorded
 *                                                 reason for including it)
 *
 * A row that carries no `source_ref` contributes NOTHING and is reported as a
 * gap. Producing a plausible URL for it would launder an unverifiable citation
 * into Population A — worse than an empty field, because the empty field is
 * visibly the operator's to fill.
 */
export async function suggestClassification(
  admin: SupabaseClient,
  invariantId: string,
  provenance: Record<string, unknown> | null | undefined,
): Promise<ClassificationSuggestion> {
  const evidenceIds = Array.isArray(provenance?.evidence_ids)
    ? (provenance!.evidence_ids as unknown[])
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim())
    : [];
  const empty = () =>
    composeClassificationSuggestion({
      invariantId, evidenceIds, resolvedEvidenceIds: [], evidenceIdsWithoutSourceRef: [], sources: [],
    });
  if (evidenceIds.length === 0) return empty();

  const { data: rows, error } = await admin
    .from('discovery_evidence')
    .select('id, title, source_ref')
    .in('id', evidenceIds);
  if (error) {
    return composeClassificationSuggestion({
      invariantId, evidenceIds, resolvedEvidenceIds: [], evidenceIdsWithoutSourceRef: [], sources: [],
      additionalNotes: [`The evidence rows could not be read (${error.message}), so nothing is pre-filled.`],
    });
  }

  const resolvedEvidenceIds: string[] = [];
  const evidenceIdsWithoutSourceRef: string[] = [];
  // Keyed by source_ref: several evidence rows share one URL whenever the
  // Ingestion Broker chunked a long document (it writes one row per ≤200k
  // chunk, all carrying the same canonical_url).
  const byRef = new Map<string, { evidenceIds: string[]; evidenceTitles: string[] }>();
  for (const r of rows ?? []) {
    const id = String(r.id);
    resolvedEvidenceIds.push(id);
    const ref = typeof r.source_ref === 'string' ? r.source_ref.trim() : '';
    if (!ref) { evidenceIdsWithoutSourceRef.push(id); continue; }
    const group = byRef.get(ref) ?? { evidenceIds: [], evidenceTitles: [] };
    group.evidenceIds.push(id);
    const title = typeof r.title === 'string' ? r.title.trim() : '';
    if (title && !group.evidenceTitles.includes(title)) group.evidenceTitles.push(title);
    byRef.set(ref, group);
  }

  const refs = [...byRef.keys()];
  const additionalNotes: string[] = [];
  if (refs.length === 0) {
    return composeClassificationSuggestion({
      invariantId, evidenceIds, resolvedEvidenceIds, evidenceIdsWithoutSourceRef, sources: [],
    });
  }

  const [{ data: candidateRows }, { data: seedRows }] = await Promise.all([
    admin
      .from('corpus_candidate_sources')
      .select('source_id, title, issuer, canonical_url, provenance_class, human_review_notes, evidence_row_id')
      .in('canonical_url', refs),
    admin
      .from('corpus_acquisition_seeds')
      .select('document_url, institution_name, claim')
      .in('document_url', refs),
  ]);

  const sources: ClassificationSuggestionSource[] = refs.map((ref) => {
    const group = byRef.get(ref)!;
    // Disambiguation, fail-closed. `corpus_candidate_sources` deliberately
    // keeps duplicate acquisitions of one URL rather than deleting them, so a
    // URL can match several rows. Prefer the row LINKED to one of this
    // invariant's own evidence rows; else accept a single unambiguous match;
    // else attach none and say why. Picking "the first" would attribute one
    // acquisition's reviewer notes and recorded class to another's evidence.
    const matches = (candidateRows ?? []).filter((c) => String(c.canonical_url) === ref);
    const linked = matches.filter((c) => typeof c.evidence_row_id === 'string' && group.evidenceIds.includes(String(c.evidence_row_id)));
    let candidate: (typeof matches)[number] | null = null;
    if (linked.length === 1) candidate = linked[0];
    else if (linked.length === 0 && matches.length === 1) candidate = matches[0];
    else if (matches.length > 1) {
      additionalNotes.push(`${matches.length} acquisition records share the URL ${ref}; none was attached, because attributing one record's review to another's evidence would misstate the source.`);
    }

    const seeds = (seedRows ?? []).filter((s) => String(s.document_url) === ref);
    let seed: (typeof seeds)[number] | null = null;
    if (seeds.length === 1) seed = seeds[0];
    else if (seeds.length > 1) {
      additionalNotes.push(`${seeds.length} acquisition seeds plan the URL ${ref} under different pillars/institutions; none of their claims was attached.`);
    }

    const recorded = candidate && typeof candidate.provenance_class === 'string' ? candidate.provenance_class : null;
    return {
      sourceRef: ref,
      evidenceIds: group.evidenceIds,
      evidenceTitles: group.evidenceTitles,
      candidateTitle: candidate && typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : null,
      issuer: candidate && typeof candidate.issuer === 'string' && candidate.issuer.trim() ? candidate.issuer.trim() : null,
      recordedProvenanceClass:
        recorded && (PROVENANCE_CLASSES as readonly string[]).includes(recorded) ? (recorded as ProvenanceClass) : null,
      reviewNotes:
        candidate && typeof candidate.human_review_notes === 'string' && candidate.human_review_notes.trim()
          ? candidate.human_review_notes.trim()
          : null,
      seedInstitution: seed && typeof seed.institution_name === 'string' && seed.institution_name.trim() ? seed.institution_name.trim() : null,
      seedClaim: seed && typeof seed.claim === 'string' && seed.claim.trim() ? seed.claim.trim() : null,
    };
  });

  return composeClassificationSuggestion({
    invariantId, evidenceIds, resolvedEvidenceIds, evidenceIdsWithoutSourceRef, sources, additionalNotes,
  });
}

// ── Reverse lineage: candidate SOURCE → discovered/promoted invariants ──────
//
// Track 2 Stage 2 admission recommendation (2026-08-03) needs the OPPOSITE
// direction of `suggestClassification`'s join: given a Corpus Scout candidate
// SOURCE (not yet admitted), which discovery candidates / promoted invariants
// already trace back to it? The join is the SAME one `suggestClassification`
// already performs — `discovery_evidence.source_ref` is matched against a
// document URL — walked the other way, so it is built here beside it rather
// than re-derived in `services/corpusScout` (inv.engineering.036/037).
//
// A source with no prior acquisition of its URL has NO lineage — this is the
// ordinary case for Stage 2 (sources are recommended BEFORE admission, and
// admission is what creates the evidence row `source_ref` would match). The
// caller (`services/corpusScout/admissionRecommendation.ts`) is required to
// treat an empty result as "no lineage", never as an error, and to fall back
// to content-only inference labelled PROVISIONAL — never to synthesize a
// domain/sub-domain placement, which is the same discipline
// `suggestClassification` applies to a missing `source_ref`.

/** Built ONCE per "prepare recommendations" pass — not once per source — so
 *  every pending source in a batch is checked against the SAME evidence and
 *  candidate corpus read. Three DB reads: `discovery_evidence` for the domain
 *  (their `source_ref` is what a candidate source's `canonicalUrl` is matched
 *  against), non-rejected `discovery_candidates` for the domain (their
 *  `domain`/`subDomain` columns ARE the classification — read, never
 *  re-inferred), and the `specializes` PARENT edges of whichever of those
 *  candidates are promoted (so siblings under one parent can be told apart
 *  from independent roots by `groupLineageBySubDomain`). */
export interface DomainLineageIndex {
  domain: string;
  /** `discovery_evidence.source_ref` (verbatim) → the evidence row ids sharing it. */
  evidenceIdsByRef: ReadonlyMap<string, string[]>;
  /** Every non-rejected `discovery_candidates` row for the domain — baseline
   *  (sub_domain IS NULL) AND sub-domain rows alike. */
  candidates: readonly CandidateRow[];
  /** Promoted invariant id → its direct `specializes` PARENT invariant ids. */
  parentsByInvariantId: ReadonlyMap<string, string[]>;
}

export async function buildDomainLineageIndex(admin: SupabaseClient, domain: string): Promise<DomainLineageIndex> {
  const { data: evidenceRows, error: evErr } = await admin
    .from('discovery_evidence')
    .select('id, source_ref')
    .in('domain', evidenceDomainsFor(domain));
  if (evErr) throw new Error(`lineage evidence read failed: ${evErr.message}`);
  const evidenceIdsByRef = new Map<string, string[]>();
  for (const r of evidenceRows ?? []) {
    const ref = typeof r.source_ref === 'string' ? r.source_ref.trim() : '';
    if (!ref) continue;
    const list = evidenceIdsByRef.get(ref) ?? [];
    list.push(String(r.id));
    evidenceIdsByRef.set(ref, list);
  }

  const { data: candidateRows, error: candErr } = await admin
    .from('discovery_candidates')
    .select('*')
    .eq('domain', domain)
    .in('status', ['candidate', 'promoted']);
  if (candErr) throw new Error(`lineage candidate read failed: ${candErr.message}`);
  const candidates = (candidateRows ?? []).map(toCandidateRow);

  const promotedIds = [
    ...new Set(candidates.map((c) => c.promotedInvariantId).filter((id): id is string => Boolean(id))),
  ];
  const parentsByInvariantId = new Map<string, string[]>();
  if (promotedIds.length > 0) {
    const edges = await listEdgesForInvariants(promotedIds, 'out', ['specializes']);
    for (const e of edges) {
      const list = parentsByInvariantId.get(e.fromInvariantId) ?? [];
      list.push(e.toInvariantId);
      parentsByInvariantId.set(e.fromInvariantId, list);
    }
  }
  return { domain, evidenceIdsByRef, candidates, parentsByInvariantId };
}

/** ONE lineage item a source's canonical URL resolved to — a discovery
 *  candidate (promoted or not). `id` is the PROMOTED INVARIANT id when the
 *  candidate has been promoted, else the candidate's own id — the identity
 *  `groupLineageBySubDomain` groups and counts by. */
export interface SourceLineageInvariant {
  id: string;
  promoted: boolean;
  domain: string;
  subDomain: string | null;
  statement: string;
  /** Direct `specializes` parents. Empty for an unpromoted candidate — it has
   *  not been placed in the graph yet, so it is its own family (a root). */
  parentIds: readonly string[];
}

/** ONE source's lineage, resolved from an ALREADY-BUILT index — pure, no I/O,
 *  so a batch of pending sources can each be checked without a query apiece. */
export function deriveSourceLineage(canonicalUrl: string, index: DomainLineageIndex): SourceLineageInvariant[] {
  const ref = typeof canonicalUrl === 'string' ? canonicalUrl.trim() : '';
  if (!ref) return [];
  const evidenceIds = index.evidenceIdsByRef.get(ref);
  if (!evidenceIds || evidenceIds.length === 0) return [];
  const evidenceIdSet = new Set(evidenceIds);
  return index.candidates
    .filter((c) => c.evidenceIds.some((id) => evidenceIdSet.has(id)))
    .map((c) => ({
      id: c.promotedInvariantId ?? c.id,
      promoted: c.promotedInvariantId !== null,
      domain: c.domain,
      subDomain: c.subDomain,
      statement: c.statement,
      parentIds: c.promotedInvariantId ? (index.parentsByInvariantId.get(c.promotedInvariantId) ?? []) : [],
    }));
}

export async function promoteCandidate(
  admin: SupabaseClient,
  candidateId: string,
  actor: { personaId: string; sessionId?: string },
  parentInvariantIds: string[] = [],
): Promise<
  | { ok: true; invariantId: string; linkedParents: number; alreadyExisted?: boolean }
  | { ok: false; error: string }
> {
  const { data: c, error } = await admin
    .from('discovery_candidates')
    .select('*')
    .eq('id', candidateId)
    .maybeSingle();
  if (error || !c) return { ok: false, error: error?.message ?? 'candidate not found' };
  if (c.status !== 'candidate') return { ok: false, error: `candidate is already ${c.status}` };

  // The namespace is RESOLVED FROM THE DISCOVERY DOMAIN REGISTRY, never
  // hardcoded (operator ruling 2026-07-27). Hardcoding 'constitutional' for
  // every promoted candidate would put Financial Services discoveries in the
  // constitutional namespace and destroy the experimental population
  // separation at the point of entry: `constitutional.*` must contain only
  // constitutional invariants, Financial Services promotes into `finance.*`,
  // Commercialisation into `commercialisation.*`. An unregistered domain still
  // resolves to 'constitutional' (unchanged behaviour). Candidates are tagged
  // with the domain context either way so IRE resolves them for that field.
  const namespace = discoveryNamespace(String(c.domain));
  try {
    const result = await discoverInvariant(
      {
        statement: String(c.statement),
        namespace,
        semanticType: 'constraint' as InvariantSemanticType,
        status: 'proposed',
        confidence: Number(c.confidence) || 0.5,
        // Machine-discovered candidate → the 'agent_verified' rung of the
        // CFS-001 §5 confidence ladder (0.6). It EARNS document/principal
        // confidence only through validation (inv.reasoning.337).
        confidenceBasis: 'agent_verified',
        provenance: {
          source: 'CFS-048 Invariant Discovery Engine (constitutional arm)',
          // ── The two ORTHOGONAL provenance axes (operator ruling 2026-07-27) ──
          // WHO DISCOVERED IT: the IDE. Knowable here, and recorded here.
          discoveryProvenance: 'ide',
          // WHERE THE EVIDENCE CAME FROM: deliberately NOT set. `discovery_evidence`
          // carries no provenance class, so the engine cannot know whether the
          // rows it compressed were FATF/Basel/MiCA or this repo's own artefacts.
          // Writing a guess here would be the exact conflation the ruling
          // abolishes — "discovered by the IDE" is not evidence of independence.
          // Unset ⇒ `experimentalPopulation()` returns null (unclassified) ⇒ the
          // invariant is admitted to NO population until a human classifies it or
          // a recorded reclassification supplies the evidence. Fail closed.
          domain: String(c.domain),
          namespace,
          sub_domain: (c.sub_domain as string | null) ?? null,
          scope_level: String(c.scope_level ?? 'domain'),
          abstraction_level: (c.abstraction_level as string | null) ?? null,
          evidence_ids: (c.evidence_ids as string[]) ?? [],
          rationale: String(c.rationale ?? ''),
          discovery_candidate_id: candidateId,
        },
        // Thread the ladder through the existing context mechanism: domain scope
        // + sub-domain interpretation + scope/abstraction in applicabilityConditions.
        // No new field on InvariantRecord (inv.reasoning.341).
        contexts: [{
          domain: String(c.domain),
          interpretation: (c.sub_domain as string | null) ?? null,
          applicabilityConditions: {
            scopeLevel: String(c.scope_level ?? 'domain'),
            subDomain: (c.sub_domain as string | null) ?? null,
            abstractionLevel: (c.abstraction_level as string | null) ?? null,
          },
        }],
      },
      actor,
    );
    await admin
      .from('discovery_candidates')
      .update({ status: 'promoted', promoted_invariant_id: result.invariant.id, updated_at: new Date().toISOString() })
      .eq('id', candidateId);

    // Parent-linking (Aletheon keystone): the promoted invariant `specializes`
    // each OPERATOR-CONFIRMED parent passed in (sub-domain → domain), turning the
    // registry into an ontology (a graph, not a tree). Recursive-compression
    // (domain → domain) edges are NOT auto-created here — they are proposed by
    // compressDomainInvariants and materialised only on explicit operator
    // confirmation (materializeCompressionEdges), per the "confirm before graph
    // insertion" discipline. Edge failures never fail the promotion.
    const linkedParents = await createSpecializesEdges(
      result.invariant.id,
      parentInvariantIds,
      `CFS-048: sub-domain invariant specializes domain invariant (${String(c.sub_domain ?? c.domain)})`,
    );
    return { ok: true, invariantId: result.invariant.id, linkedParents };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'promotion failed';

    // RE-DISCOVERY IS NOT A FAILURE — it is a result, and the queue must be
    // able to record it (operator-reported 2026-07-28: "these 2 FS invariants
    // won't promote to proposed. just processing but not promoting").
    //
    // `discoverInvariant` refuses to insert a second invariant with the same
    // canonicalized statement, and it is right to: that is what keeps the
    // registry from filling with near-identical rows. But it left the
    // candidate PERMANENTLY STUCK. It can never be promoted, because the
    // invariant exists; and rejecting it would be a lie, because the discovery
    // was correct. The only two dispositions the queue offered were both
    // wrong, so the candidate sat in "awaiting review" forever.
    //
    // The truthful disposition is the third one: this candidate RESOLVED TO an
    // invariant that already exists. `promoted_invariant_id` already models
    // exactly that — the candidate's outcome is that invariant — so no new
    // status is needed and no duplicate is created.
    //
    // Auto-resolving is safe here ONLY because the match is EXACT: `exact`
    // means the canonicalized statements are identical, which is a fact, not a
    // similarity judgement. A merely-similar candidate is not auto-resolved
    // and still needs a human.
    //
    // And the recurrence is recorded rather than swallowed. A statement
    // independently re-discovered from different evidence is a RECURRENCE
    // SIGNAL — the same signal the commercialisation recurrence-3 candidates
    // are built on. Discarding it as "duplicate, nothing happened" would throw
    // away the evidence that the discovery converged twice.
    const dup = /duplicate: an invariant with this statement already exists \(([0-9a-f-]{36})\)/.exec(message);
    if (dup) {
      const existingId = dup[1];
      const prov = (c.discovery_provenance ?? {}) as Record<string, unknown>;
      const priorRediscoveries = Array.isArray(prov.rediscoveredEvidence) ? (prov.rediscoveredEvidence as string[]) : [];
      await admin
        .from('discovery_candidates')
        .update({
          status: 'promoted',
          promoted_invariant_id: existingId,
          discovery_provenance: {
            ...prov,
            resolvedAs: 'already-exists',
            // The evidence THIS pass compressed, kept against the existing
            // invariant so the recurrence is auditable rather than asserted.
            rediscoveredEvidence: [...new Set([...priorRediscoveries, ...((c.evidence_ids as string[]) ?? [])])],
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidateId)
        .eq('status', 'candidate');
      return { ok: true, invariantId: existingId, linkedParents: 0, alreadyExisted: true };
    }

    return { ok: false, error: message };
  }
}

export async function rejectCandidate(admin: SupabaseClient, candidateId: string): Promise<{ ok: boolean }> {
  const { error } = await admin
    .from('discovery_candidates')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', candidateId)
    .eq('status', 'candidate');
  return { ok: !error };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function toCandidateRow(r: Record<string, unknown>): CandidateRow {
  const prov = (r.discovery_provenance ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id), domain: String(r.domain),
    subDomain: (r.sub_domain as string | null) ?? null,
    scopeLevel: (String(r.scope_level ?? 'domain') as DiscoveryScopeLevel),
    abstractionLevel: normalizeAbstraction(r.abstraction_level),
    discoveryClass: String(r.discovery_class) as DiscoveryClass,
    statement: String(r.statement), rationale: String(r.rationale ?? ''),
    evidenceIds: (r.evidence_ids as string[]) ?? [],
    confidence: Number(r.confidence) || 0.5,
    status: String(r.status) as CandidateRow['status'],
    promotedInvariantId: (r.promoted_invariant_id as string | null) ?? null,
    createdAt: String(r.created_at),
    stage: prov.stage === 'compare' ? 'compare' : 'constitutional',
    classification: (COMPARE_CLASSES.includes(String(prov.classification))
      ? (prov.classification as CompareClassification) : null),
    coverage: Array.isArray(prov.coverage) ? (prov.coverage as string[]) : null,
    compression: parseCompression(prov.compression),
  };
}

function parseCompression(v: unknown): CandidateRow['compression'] {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const role = o.role === 'derived' || o.depth === 'derived' ? 'derived' : 'root';
  const rawParents = Array.isArray(o.parents) ? (o.parents as Record<string, unknown>[]) : [];
  const parents = rawParents.map((p) => ({
    parentCandidateId: String(p.parentCandidateId ?? ''),
    relationship: (COMPRESSION_RELATIONSHIPS as readonly string[]).includes(String(p.relationship))
      ? (String(p.relationship) as CompressionRelationship)
      : ('supports' as CompressionRelationship),
    claim: String(p.claim ?? ''),
    confidence: Math.max(0, Math.min(1, Number(p.confidence) || 0.5)),
  })).filter((p) => p.parentCandidateId);
  return { role, parents, rationale: String(o.rationale ?? ''), materialized: o.materialized === true };
}

/** Tolerate a model that wraps JSON in prose/fences. Exported for the canary. */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  return first >= 0 && last > first ? text.slice(first, last + 1) : text;
}
