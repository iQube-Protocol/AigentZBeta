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
import type { InvariantNamespace, InvariantSemanticType } from '@/types/invariants';

export type DiscoveryClass = 'constitutional' | 'structural' | 'experiential';
export type EvidenceKind =
  | 'legislation' | 'regulation' | 'compliance' | 'standard' | 'contract' | 'policy' | 'other';

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
}

/** Cross-framework convergence — how many INDEPENDENT source documents imply a
 *  candidate. A PRIORITISATION signal, not validity (Law XII: support is
 *  evidence, not truth). Derived at read time from evidence_ids. */
export interface ConvergenceInfo {
  supportCount: number;
  frameworks: string[];
  tier: 'single' | 'strong' | 'broad';
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
  /** Recursive-compression classification (parent-child): where this domain
   *  invariant sits in the derivation hierarchy. Null until compressed. */
  compression?: { depth: 'root' | 'derived'; derivesFromCandidateIds: string[]; rationale: string } | null;
  /** Enriched at read time (route/service), not stored. */
  convergence?: ConvergenceInfo;
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
  let query = admin
    .from('discovery_evidence')
    .select('id, domain, sub_domain, title, source_kind, content, source_ref, created_at')
    .eq('domain', domain);
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
): Promise<{ ok: true; candidates: CandidateRow[] } | { ok: false; error: string }> {
  const subDomain = opts.subDomain?.trim() || null;
  const scopeLevel: DiscoveryScopeLevel = subDomain ? (opts.scopeLevel ?? 'sub-domain') : 'domain';
  const evidence = await listEvidence(admin, domain, subDomain);
  if (evidence.length === 0) {
    return {
      ok: false,
      error: subDomain
        ? `No evidence for ${domain}/${subDomain} — add sub-domain or domain-wide evidence first.`
        : 'No evidence for this domain — add evidence first (Stage 1).',
    };
  }

  // Bounded context: cap total chars so the extraction stays within budget.
  const MAX_CHARS = 24_000;
  let used = 0;
  const included: EvidenceRow[] = [];
  for (const e of evidence) {
    const chunk = e.content.slice(0, 6_000);
    if (used + chunk.length > MAX_CHARS) break;
    included.push({ ...e, content: chunk });
    used += chunk.length;
  }
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
  if (raw.length === 0) return { ok: true, candidates: [] };

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
  if (rows.length === 0) return { ok: true, candidates: [] };

  const { data, error } = await admin.from('discovery_candidates').insert(rows).select('*');
  if (error) return { ok: false, error: error.message };
  const inserted = (data ?? []).map(toCandidateRow);
  return { ok: true, candidates: enrichConvergence(inserted, evidence) };
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
  const evidence = await listEvidence(admin, domain, subDomain);
  return enrichConvergence(rows, evidence);
}

// ── Cross-framework convergence (derived; a priority signal, not validity) ───

/** Distinct-source support for one candidate. A source document is deduped on
 *  coalesce(sourceRef, title) — evidence rows are distinct PKs, but one document
 *  ingested twice should count once. Support is EVIDENCE, not truth (Law XII). */
export function computeConvergence(evidenceIds: string[], evidence: EvidenceRow[]): ConvergenceInfo {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const frameworks = new Map<string, string>(); // dedup key → display title
  for (const id of evidenceIds) {
    const e = byId.get(id);
    if (!e) continue;
    const key = (e.sourceRef?.trim() || e.title.trim()).toLowerCase();
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
  // Convergence over the domain's whole evidence corpus.
  const evidence = await listEvidence(admin, domain);
  return { ok: true, candidates: enrichConvergence(inserted, evidence), comparedSubDomains, inputInvariantCount };
}

// ── Recursive compression (parent-child keystone) ────────────────────────────

const COMPRESS_DOMAIN_SYSTEM = `You are the RECURSIVE COMPRESSION stage of an Invariant Discovery Engine. You are given the
DOMAIN-LEVEL invariants already discovered for one domain (each emerged from cross-sub-domain
compression). Your job is to find the DERIVATION STRUCTURE among them: which invariants are FOUNDATIONAL
(roots) and which are DERIVED (entailed by, a specialisation of, or a downstream consequence of one or
more of the OTHERS).

Method:
- A ROOT is foundational: it does NOT derive from any other invariant in the set — a constitutional
  candidate for the domain (e.g. "Traceability enables accountability").
- A DERIVED invariant is entailed by / specialises / is a consequence of one or more OTHER invariants in
  the set. Examples: "Risk-management practices are required" DERIVES FROM the cybersecurity +
  data-protection invariants; "A harmonized regulatory framework is required" DERIVES FROM the
  accountability + transparency invariants. List the parents by their input index in derivesFrom.
- Compress by RECURRENCE OF ENTAILMENT: prefer the SMALLEST set of roots from which the rest follow.
- Ground strictly in the given statements. Do NOT invent invariants or relationships the statements do not
  support. If two invariants are the same principle at different levels, mark the more specific one derived
  from the more general.
- A node's derivesFrom MUST reference OTHER indices in the set (never itself); the result MUST be acyclic.

Output STRICT JSON: {"nodes":[{"index":<input index>,"depth":"root"|"derived","derivesFrom":[<parent index>,...],"rationale":"why it is a root, or which parents entail it and how"}]}`;

interface CompressExtraction {
  nodes: { index: number; depth?: string; derivesFrom?: number[]; rationale?: string }[];
}

export interface DomainCompressionNode {
  candidateId: string;
  statement: string;
  depth: 'root' | 'derived';
  derivesFrom: { candidateId: string; statement: string }[];
  rationale: string;
}

/**
 * Recursive compression — a SECOND-order Compare over the domain's own earned
 * invariants: find which compress INTO each other, yielding the parent-child
 * derivation hierarchy (roots = constitutional candidates; derived = downstream
 * of a root). Grounded strictly in the candidate statements, deterministic
 * (temperature 0), acyclic. The classification is persisted additively into each
 * candidate's discovery_provenance.compression so promotion can later materialise
 * it as `specializes` edges (via promoteCandidate/linkPromotedParents). Confidence
 * is NOT touched — this is structure discovery, not validity (Law XII).
 */
export async function compressDomainInvariants(
  admin: SupabaseClient,
  domain: string,
): Promise<
  | { ok: true; hierarchy: DomainCompressionNode[]; rootCount: number; derivedCount: number }
  | { ok: false; error: string }
> {
  // The domain-level invariants (Compare outputs + any domain baseline), candidate
  // OR promoted — same status breadth as Compare (promoted are the strongest).
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
    `DOMAIN: ${domain}\n\nDOMAIN INVARIANTS (find the derivation structure; cite by index):\n` +
    items.map((c, i) => `[${i}] ${c.statement}`).join('\n');

  let parsed: CompressExtraction;
  try {
    const call = await callSovereign('analysis', COMPRESS_DOMAIN_SYSTEM, user, 1800, 0);
    parsed = JSON.parse(extractJson(call.text)) as CompressExtraction;
  } catch (e) {
    return { ok: false, error: `compression inference failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];

  const hierarchy: DomainCompressionNode[] = [];
  for (let idx = 0; idx < items.length; idx++) {
    const c = items[idx];
    const n = nodes.find((x) => Number(x.index) === idx);
    const rawParents = Array.isArray(n?.derivesFrom) ? n!.derivesFrom : [];
    // Valid other-indices only; drop self-refs + out-of-range; dedupe.
    const parentIdxs = [
      ...new Set(rawParents.map(Number).filter((p) => Number.isInteger(p) && p !== idx && p >= 0 && p < items.length)),
    ];
    const depth: 'root' | 'derived' = n && String(n.depth) === 'derived' && parentIdxs.length > 0 ? 'derived' : 'root';
    const derivesFrom = depth === 'derived' ? parentIdxs.map((p) => ({ candidateId: items[p].id, statement: items[p].statement })) : [];
    const rationale = String(n?.rationale ?? '').slice(0, 600);
    hierarchy.push({ candidateId: c.id, statement: c.statement, depth, derivesFrom, rationale });

    // Persist additively into provenance (merge, never clobber).
    const raw = rawById.get(c.id) ?? {};
    const prov = { ...((raw.discovery_provenance ?? {}) as Record<string, unknown>) };
    prov.compression = { depth, derivesFromCandidateIds: derivesFrom.map((d) => d.candidateId), rationale };
    await admin.from('discovery_candidates').update({ discovery_provenance: prov }).eq('id', c.id);
  }

  const rootCount = hierarchy.filter((h) => h.depth === 'root').length;
  return { ok: true, hierarchy, rootCount, derivedCount: hierarchy.length - rootCount };
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
 * Resolve a candidate's RECURSIVE-COMPRESSION parents to their promoted invariant
 * ids. `compressDomainInvariants` records, per derived candidate, the CANDIDATE
 * ids of its parents (provenance.compression.derivesFromCandidateIds). This maps
 * those to the parents' `promoted_invariant_id`, SKIPPING any not-yet-promoted
 * parent — so promoting roots-then-derived materialises the domain→domain
 * hierarchy as `specializes` edges. (Promote roots first; a derived child
 * promoted early can be retro-linked once its roots exist.)
 */
async function resolveCompressionParentInvariantIds(
  admin: SupabaseClient,
  candidate: Record<string, unknown>,
): Promise<string[]> {
  const prov = (candidate.discovery_provenance ?? {}) as Record<string, unknown>;
  const comp = prov.compression as { derivesFromCandidateIds?: unknown } | undefined;
  const parentCandidateIds = Array.isArray(comp?.derivesFromCandidateIds)
    ? (comp!.derivesFromCandidateIds as unknown[]).filter((x): x is string => typeof x === 'string' && Boolean(x))
    : [];
  if (parentCandidateIds.length === 0) return [];
  const { data } = await admin
    .from('discovery_candidates')
    .select('promoted_invariant_id')
    .in('id', parentCandidateIds)
    .not('promoted_invariant_id', 'is', null);
  return (data ?? []).map((r) => String(r.promoted_invariant_id)).filter(Boolean);
}

/**
 * Retro-link an ALREADY-PROMOTED invariant to parents — for invariants promoted
 * before parent-linking existed, OR to complete a recursive-compression edge once
 * the parent roots are promoted. Attaches `specializes` edges to the existing
 * invariant without re-promoting. Merges explicit parents with any resolved
 * recursive-compression parents. Idempotent.
 */
export async function linkPromotedParents(
  admin: SupabaseClient,
  candidateId: string,
  parentInvariantIds: string[],
): Promise<{ ok: true; linkedParents: number } | { ok: false; error: string }> {
  const { data: c } = await admin
    .from('discovery_candidates')
    .select('domain, sub_domain, promoted_invariant_id, status, discovery_provenance')
    .eq('id', candidateId)
    .maybeSingle();
  if (!c) return { ok: false, error: 'candidate not found' };
  if (c.status !== 'promoted' || !c.promoted_invariant_id) return { ok: false, error: 'candidate is not promoted — nothing to link' };
  const compressionParents = await resolveCompressionParentInvariantIds(admin, c as Record<string, unknown>);
  const linked = await createSpecializesEdges(
    String(c.promoted_invariant_id),
    [...parentInvariantIds, ...compressionParents],
    `CFS-048 retro-link: invariant specializes parent (${String(c.sub_domain ?? c.domain)})`,
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

export async function promoteCandidate(
  admin: SupabaseClient,
  candidateId: string,
  actor: { personaId: string; sessionId?: string },
  parentInvariantIds: string[] = [],
): Promise<{ ok: true; invariantId: string; linkedParents: number } | { ok: false; error: string }> {
  const { data: c, error } = await admin
    .from('discovery_candidates')
    .select('*')
    .eq('id', candidateId)
    .maybeSingle();
  if (error || !c) return { ok: false, error: error?.message ?? 'candidate not found' };
  if (c.status !== 'candidate') return { ok: false, error: `candidate is already ${c.status}` };

  // Constitutional-class discoveries land in the 'constitutional' namespace,
  // tagged with the domain context so IRE resolves them for that field.
  try {
    const result = await discoverInvariant(
      {
        statement: String(c.statement),
        namespace: 'constitutional' as InvariantNamespace,
        semanticType: 'constraint' as InvariantSemanticType,
        status: 'proposed',
        confidence: Number(c.confidence) || 0.5,
        // Machine-discovered candidate → the 'agent_verified' rung of the
        // CFS-001 §5 confidence ladder (0.6). It EARNS document/principal
        // confidence only through validation (inv.reasoning.337).
        confidenceBasis: 'agent_verified',
        provenance: {
          source: 'CFS-048 Invariant Discovery Engine (constitutional arm)',
          domain: String(c.domain),
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
    // each parent, turning the registry into an ontology (a graph, not a tree).
    // Two parent sources merge here:
    //   1. operator-confirmed parents passed in (sub-domain → domain),
    //   2. RECURSIVE-COMPRESSION parents auto-resolved from provenance (domain →
    //      domain): a `derived` domain invariant specialises its roots once they
    //      are promoted. This materialises the compressDomainInvariants hierarchy
    //      as real edges (promote roots first; derived children link to them).
    // Edge failures never fail the promotion (the invariant already exists).
    const compressionParents = await resolveCompressionParentInvariantIds(admin, c as Record<string, unknown>);
    const linkedParents = await createSpecializesEdges(
      result.invariant.id,
      [...parentInvariantIds, ...compressionParents],
      `CFS-048: invariant specializes parent (${String(c.sub_domain ?? c.domain)})`,
    );
    return { ok: true, invariantId: result.invariant.id, linkedParents };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'promotion failed' };
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
  return {
    depth: o.depth === 'derived' ? 'derived' : 'root',
    derivesFromCandidateIds: Array.isArray(o.derivesFromCandidateIds) ? (o.derivesFromCandidateIds as string[]) : [],
    rationale: String(o.rationale ?? ''),
  };
}

/** Tolerate a model that wraps JSON in prose/fences. Exported for the canary. */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  return first >= 0 && last > first ? text.slice(first, last + 1) : text;
}
