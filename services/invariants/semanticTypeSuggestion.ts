/**
 * Semantic-type suggestion — Track 2 Stage 9's structural-diversity
 * remediation (operator direction, 2026-08-05: "search the already-admitted
 * evidence and previously extracted candidates for material capable of
 * producing a different legitimate semantic type... Do not relabel an
 * existing invariant merely to pass the check.").
 *
 * ── The gap this closes ────────────────────────────────────────────────────
 *
 * `promoteCandidate` (services/invariants/discoveryEngine.ts) hardcodes
 * `semanticType: 'constraint'` on every single promotion, and there is no
 * PATCH route for `semanticType` on an existing invariant — it is settable
 * only at creation. That means the automated pipeline has never been able to
 * produce a second semantic type on its own: every crystal's
 * structural-diversity check (services/research/crystalReadiness.ts) is
 * permanently stuck at one shape (100% `constraint`) until a human
 * deliberately classifies a NEW candidate as something else BEFORE it is
 * promoted. This module is that classification step — a proposal, never a
 * write, exactly like `suggestProvenanceClass`'s posture.
 *
 * ── Never relabels an existing crystal member ─────────────────────────────
 *
 * This module only ever classifies a candidate that has NOT yet been
 * promoted (an extracted `discovery_candidates` row) — the caller passes it
 * a still-unpromoted candidate's statement, and the resulting suggestion is
 * consumed only by a promotion call that sets `semanticType` for the FIRST
 * time. Nothing in this module, and nothing calling it, may use its output
 * to change an already-promoted invariant's existing type — that would be
 * exactly the "relabel to pass the check" gaming the operator ruled out.
 */

import { callSovereign } from '@/services/constitutional/modelRouter';
import { extractJson } from '@/services/invariants/discoveryEngine';
import { INVARIANT_SEMANTIC_TYPES, type InvariantSemanticType } from '@/types/invariants';

export interface SemanticTypeSuggestion {
  semanticType: InvariantSemanticType;
  /** 0-100. The model's own estimate — advisory, never a measured probability. */
  confidence: number;
  reason: string;
}

export type SuggestSemanticTypeResult =
  | { ok: true; suggestion: SemanticTypeSuggestion | null }
  | { ok: false; error: string };

function isValidSemanticType(v: unknown): v is InvariantSemanticType {
  return typeof v === 'string' && (INVARIANT_SEMANTIC_TYPES as readonly string[]).includes(v);
}

const TYPE_SEMANTICS: Record<InvariantSemanticType, string> = {
  principle: 'A broad guiding value or goal the system optimizes toward — not itself a single testable rule.',
  constraint: "A limiting condition — restricts which states or actions are permissible.",
  definition: 'Defines a term or concept precisely, without itself asserting a limiting, causal, or evaluative claim.',
  heuristic: 'A practical rule of thumb — usually reliable in practice, not claimed to hold universally.',
  law: 'A universal, exceptionless regularity — holds in every case within its stated scope, no exceptions.',
  epistemic: "A claim about knowledge, evidence, or certainty itself — about what can be known or how, not about the world directly.",
};

/**
 * Classifies ONE unpromoted candidate's most natural semantic type. Returns
 * `{ ok: true, suggestion: null }` only if the model's answer fails
 * validation (never a guessed fallback type) — a null suggestion means "the
 * steward must classify this one manually," exactly like the sibling
 * provenance-suggestion module's own null case.
 */
export async function suggestSemanticType(candidate: { id: string; statement: string }): Promise<SuggestSemanticTypeResult> {
  const typeLines = INVARIANT_SEMANTIC_TYPES.map((t) => `  - ${t}: ${TYPE_SEMANTICS[t]}`).join('\n');
  const system =
    'You are assisting a human steward in classifying the semantic shape of a candidate constitutional invariant, ' +
    'before it is promoted. You propose a classification; the human approves, edits or rejects it — you never decide ' +
    'anything by yourself. Choose the ONE semantic type that best fits the statement, from exactly these six:\n' +
    typeLines +
    '\n\nRespond with ONLY a JSON object of this exact shape, no prose, no markdown fences:\n' +
    '{"semanticType":"<one of the six types above>","confidence":<integer 0-100>,"reason":"<one sentence>"}';
  const user = `Candidate statement:\n${candidate.statement}`;

  let raw: string;
  try {
    const call = await callSovereign('classification', system, user, 500, 0);
    raw = call.text;
  } catch (e) {
    return { ok: false, error: `semantic-type suggestion inference failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return { ok: false, error: 'the model did not return parseable JSON — no suggestion is safer than a guessed one' };
  }

  if (!isValidSemanticType(parsed.semanticType)) {
    return { ok: true, suggestion: null };
  }
  const confidenceRaw = typeof parsed.confidence === 'number' ? parsed.confidence : Number(parsed.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(100, Math.round(confidenceRaw))) : 0;
  const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : '';
  if (!reason) {
    return { ok: true, suggestion: null };
  }

  return { ok: true, suggestion: { semanticType: parsed.semanticType, confidence, reason } };
}
