/**
 * Relationship suggestion — Track 2 Stage 7's steward-review engine
 * (operator direction, 2026-08-04: "The steward's role becomes constitutional
 * approval, not manual graph construction... The graph engine should perform
 * the reasoning; the human should perform constitutional oversight.").
 *
 * ── What this replaces ────────────────────────────────────────────────────
 *
 * Before this module, Stage 7's queue (components/research/
 * Track2ProgrammePanel.tsx's RelationshipQueue) presented an empty form: pick
 * a related invariant, pick a relation type, write a rationale, from
 * scratch — "exactly the reasoning work the invariant graph already
 * contains," done manually every time. No relationship-suggestion capability
 * existed anywhere in this codebase before this module (confirmed by grep —
 * the only automated edge writers are promoteCandidate's/
 * materializeCompressionEdges's `specializes`-only side effects, keyed by
 * discovery-candidate id, never offering a relation-type choice or a
 * per-pair rationale).
 *
 * ── What this is, and is not ──────────────────────────────────────────────
 *
 * A SUGGESTION engine, never a writer. It calls `callSovereign('classification',
 * ...)` — the platform's designated entry point for exactly this task shape
 * ("new reasoning inference goes through callSovereign", services/
 * constitutional/modelRouter.ts's own migration rule) — and returns ranked
 * candidates for a human to accept, edit, or reject. Nothing in this module
 * writes an edge; `addEdge` (services/invariants/lifecycle.ts) remains the
 * only writer, reached only through an explicit steward act (the queue's
 * Accept button, or the existing single-edge route).
 *
 * `similarity()` (services/invariants/comparison.ts — the SAME token-Jaccard
 * function `findDuplicates` already uses) pre-filters a large cohort down to
 * a candidate pool before the model sees it, purely to bound prompt size —
 * it is NOT the ranking signal itself. Two invariants can be strongly
 * related with almost no literal word overlap ("cybersecurity controls" /
 * "operational resilience"), which is exactly the case the operator's own
 * example turns on; a token-similarity ranking would miss it. The model
 * produces the actual relation type, rationale and confidence.
 *
 * ── Defensive validation, because this output becomes a real graph write ──
 *
 * A hallucinated `relatedInvariantId` outside the candidate pool, or a
 * `relationType` outside the twelve CFS-003 types, is dropped — never
 * coerced to the nearest valid value. Confidence is clamped to [0, 100].
 * A parse failure or provider outage returns `{ ok: false }`, never a
 * fabricated suggestion — the queue's manual "Choose Different" path is the
 * fallback, exactly as if this module did not exist.
 */

import { similarity } from '@/services/invariants/comparison';
import { extractJson } from '@/services/invariants/discoveryEngine';
import { callSovereign } from '@/services/constitutional/modelRouter';
import { INVARIANT_EDGE_TYPES, type InvariantEdgeType } from '@/types/invariants';

/** Bounds the prompt: only the top-N cohort members by textual similarity are offered to the model as candidates. */
const CANDIDATE_POOL_LIMIT = 25;
/** How many ranked suggestions the queue renders per record — matches the operator's own example (~4-5). */
const MAX_SUGGESTIONS = 5;

export interface RelationshipSuggestion {
  relatedInvariantId: string;
  relatedLabel: string;
  relationType: InvariantEdgeType;
  rationale: string;
  /** 0-100. The model's own estimate — advisory, never a measured probability. Clamped, never trusted past the range. */
  confidence: number;
}

export type SuggestRelationshipsResult =
  | { ok: true; suggestions: RelationshipSuggestion[] }
  | { ok: false; error: string };

/**
 * CFS-003 §2's twelve edge types, one line each — given to the model
 * verbatim rather than bare enum names, because several pairs are genuinely
 * close (derives_from / explains / supports all describe "why we believe
 * this"; generalizes / specializes is a true inverse pair) and a model asked
 * to pick among bare labels will plausibly confuse them.
 */
const EDGE_TYPE_SEMANTICS: Record<InvariantEdgeType, string> = {
  derives_from: 'B was reasoned FROM A — A is the premise B was derived from.',
  enables: 'A makes B achievable — without A, B could not hold.',
  constrains: "A bounds B's applicability — A limits when/where B applies.",
  contradicts: 'A and B cannot both be canonical — a genuine logical conflict, not disagreement in wording.',
  supersedes: 'A replaces B — B is an earlier or weaker version of the same claim.',
  generalizes: 'A is the more general form of B (the inverse of specializes).',
  specializes: 'A is a more specific instance of the more general B (the inverse of generalizes).',
  depends_on: 'A requires B to be true/available — a load-order or precondition relationship.',
  supports: 'A is evidence FOR B — A strengthens the case for B without B depending on A structurally.',
  validates: "A's observed consequences confirmed B.",
  explains: 'A is the reasoning ACCOUNT of B — why B is true, as a narrative rather than a premise.',
  composes: 'A is a member/part of the composite B.',
};

function buildPrompt(candidate: { statement: string }, pool: { id: string; statement: string }[]): { system: string; user: string } {
  const typeLines = INVARIANT_EDGE_TYPES.map((t) => `  - ${t}: ${EDGE_TYPE_SEMANTICS[t]}`).join('\n');
  const system =
    'You are assisting a human steward in reviewing relationships between constitutional invariants in a knowledge ' +
    'graph. You propose candidate relationships; a human approves, edits or rejects every one — you never decide ' +
    'anything by yourself. For the given candidate invariant and list of other invariants already in the same ' +
    'crystal, propose up to 5 of the STRONGEST genuine relationships, ranked by how confident you are. Use ONLY ' +
    'these twelve relation types, choosing the one that best fits the semantics below — do not invent a new one:\n' +
    typeLines +
    '\n\nRespond with ONLY a JSON object of this exact shape, no prose, no markdown fences:\n' +
    '{"suggestions":[{"relatedInvariantId":"<id from the candidate list>","relationType":"<one of the twelve ' +
    'types above>","rationale":"<one sentence, specific to these two statements>","confidence":<integer 0-100>}]}';
  const poolText = pool.map((p, i) => `${i + 1}. id=${p.id} :: ${p.statement}`).join('\n');
  const user = `Candidate invariant:\n${candidate.statement}\n\nOther invariants in the current crystal:\n${poolText}`;
  return { system, user };
}

function isValidEdgeType(v: unknown): v is InvariantEdgeType {
  return typeof v === 'string' && (INVARIANT_EDGE_TYPES as readonly string[]).includes(v);
}

export async function suggestRelationships(
  candidate: { id: string; statement: string },
  members: { id: string; statement: string }[],
): Promise<SuggestRelationshipsResult> {
  const others = members.filter((m) => m.id !== candidate.id);
  if (others.length === 0) {
    return { ok: true, suggestions: [] };
  }

  const pool =
    others.length > CANDIDATE_POOL_LIMIT
      ? [...others].sort((a, b) => similarity(candidate.statement, b.statement) - similarity(candidate.statement, a.statement)).slice(0, CANDIDATE_POOL_LIMIT)
      : others;
  const poolIds = new Set(pool.map((p) => p.id));
  const labelOf = new Map(pool.map((p) => [p.id, p.statement]));

  const { system, user } = buildPrompt(candidate, pool);

  let raw: string;
  try {
    const call = await callSovereign('classification', system, user, 1200, 0);
    raw = call.text;
  } catch (e) {
    return { ok: false, error: `relationship suggestion inference failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  let parsed: { suggestions?: unknown };
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return { ok: false, error: 'the model did not return parseable JSON — no suggestion is safer than a guessed one' };
  }

  const rawSuggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  const suggestions: RelationshipSuggestion[] = [];
  for (const s of rawSuggestions) {
    if (!s || typeof s !== 'object') continue;
    const r = s as Record<string, unknown>;
    const relatedInvariantId = typeof r.relatedInvariantId === 'string' ? r.relatedInvariantId : '';
    // NEVER trust a related-id the model invented — it must be one of the
    // exact candidates offered, because this suggestion becomes a real edge.
    if (!poolIds.has(relatedInvariantId)) continue;
    if (!isValidEdgeType(r.relationType)) continue;
    const rationale = typeof r.rationale === 'string' ? r.rationale.trim() : '';
    if (!rationale) continue;
    const confidenceRaw = typeof r.confidence === 'number' ? r.confidence : Number(r.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(100, Math.round(confidenceRaw))) : 0;
    suggestions.push({
      relatedInvariantId,
      relatedLabel: labelOf.get(relatedInvariantId) ?? relatedInvariantId,
      relationType: r.relationType,
      rationale,
      confidence,
    });
  }

  suggestions.sort((a, b) => b.confidence - a.confidence);
  return { ok: true, suggestions: suggestions.slice(0, MAX_SUGGESTIONS) };
}
