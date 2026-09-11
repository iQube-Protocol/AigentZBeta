/**
 * Provenance CLASS suggestion — Stage 5's steward-review upgrade (operator
 * direction, 2026-08-05: "Crystal Preparation is a stewardship workflow, not
 * an authoring workflow... The steward should never begin with a blank form
 * when the substrate can derive a reasonable proposal.").
 *
 * ── What already existed, and what this adds ──────────────────────────────
 *
 * `suggestClassification` (services/invariants/discoveryEngine.ts) already
 * resolves an invariant's real evidence — which sources it cites, their
 * titles/issuers, and whatever provenance class a human recorded on the
 * SOURCE at acquisition review — and pre-fills evidence refs + a rationale
 * from that. Its own doc comment is explicit that it does NOT suggest the
 * evidence-provenance CLASS itself: "`recordedProvenanceClass` is reported as
 * context; it is NOT applied, and it does not preselect the class." That
 * restraint is preserved here, not overridden — this module still never
 * WRITES a class. It adds a REVIEWABLE proposal on top: given the same
 * resolved sources, ask the model which of the five `ProvenanceClass` values
 * fits best, with a confidence and a one-sentence reason, naming a primary
 * source and any supporting sources. The steward Accepts, Edits or Rejects
 * it — exactly the same posture `applyProvenanceReclassification`'s own
 * refusals already enforce at write time (an accepted suggestion still runs
 * every existing refusal, including the anti-laundering check that a move
 * into Population A must cite at least one non-repo-internal source).
 *
 * ── Never invents a source ─────────────────────────────────────────────────
 *
 * `primarySource`/`supportingSources` must be drawn from the EXACT source
 * refs `suggestClassification` already resolved — a source the model names
 * that isn't in that list is dropped from the suggestion's own field rather
 * than passed through, because a fabricated citation is worse than none.
 */

import { callSovereign } from '@/services/constitutional/modelRouter';
import { extractJson } from '@/services/invariants/discoveryEngine';
import { PROVENANCE_CLASSES, type ProvenanceClass } from '@/services/corpusScout/types';
import type { ClassificationSuggestion } from '@/services/research/experimentalPopulations';

export interface ProvenanceClassSuggestion {
  suggestedClass: ProvenanceClass;
  /** 0-100. The model's own estimate — advisory, never a measured probability. */
  confidence: number;
  /** A `sourceRef` from the resolved evidence — the strongest single citation for this class. */
  primarySource: string | null;
  /** Other resolved `sourceRef`s that also support this class. */
  supportingSources: string[];
  reason: string;
}

export type SuggestProvenanceClassResult =
  | { ok: true; suggestion: ProvenanceClassSuggestion | null }
  | { ok: false; error: string };

function isValidProvenanceClass(v: unknown): v is ProvenanceClass {
  return typeof v === 'string' && (PROVENANCE_CLASSES as readonly string[]).includes(v);
}

const CLASS_SEMANTICS: Record<ProvenanceClass, string> = {
  'external-established': 'A well-established external authority (standards body, regulator, recognised institution) states this directly.',
  'external-empirical': 'External empirical evidence (data, studies, observed outcomes) supports this, without a single established authority stating it outright.',
  'platform-derived': "This was reasoned by the platform's own logic from other invariants, not asserted by an external source.",
  'platform-hypothesized': "This is the platform's own working hypothesis, not yet confirmed by external or empirical evidence.",
  'platform-doctrine': "This is the platform's own constitutional/governing doctrine, not an external factual claim.",
};

/**
 * Proposes an evidence-provenance class for review. Returns
 * `{ ok: true, suggestion: null }` — never a guess — when the invariant has
 * no resolved evidence sources at all to reason from (mirrors
 * `suggestClassification`'s own "nothing to pre-fill" case).
 */
export async function suggestProvenanceClass(
  candidate: { id: string; statement: string },
  resolved: ClassificationSuggestion,
): Promise<SuggestProvenanceClassResult> {
  if (resolved.sources.length === 0) {
    return { ok: true, suggestion: null };
  }

  const refs = new Set(resolved.sources.map((s) => s.sourceRef));
  const classLines = PROVENANCE_CLASSES.map((c) => `  - ${c}: ${CLASS_SEMANTICS[c]}`).join('\n');
  const sourceLines = resolved.sources
    .map((s, i) => {
      const label = s.candidateTitle || s.evidenceTitles[0] || s.sourceRef;
      const recorded = s.recordedProvenanceClass ? ` (source reviewer recorded: ${s.recordedProvenanceClass})` : '';
      return `${i + 1}. ref=${s.sourceRef} :: ${label}${s.issuer ? ` — ${s.issuer}` : ''}${recorded}`;
    })
    .join('\n');

  const system =
    'You are assisting a human steward in classifying the evidentiary basis of a constitutional invariant. You ' +
    'propose a classification; the human approves, edits or rejects it — you never decide anything by yourself. ' +
    'Choose the ONE evidence-provenance class that best fits, from exactly these five:\n' +
    classLines +
    '\n\nRespond with ONLY a JSON object of this exact shape, no prose, no markdown fences:\n' +
    '{"suggestedClass":"<one of the five classes above>","confidence":<integer 0-100>,' +
    '"primarySource":"<the single ref= value that is the strongest citation, or null>",' +
    '"supportingSources":["<other ref= values that also support this class>"],' +
    '"reason":"<one sentence>"}';
  const user = `Invariant:\n${candidate.statement}\n\nResolved evidence sources:\n${sourceLines}`;

  let raw: string;
  try {
    const call = await callSovereign('classification', system, user, 800, 0);
    raw = call.text;
  } catch (e) {
    return { ok: false, error: `provenance suggestion inference failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return { ok: false, error: 'the model did not return parseable JSON — no suggestion is safer than a guessed one' };
  }

  if (!isValidProvenanceClass(parsed.suggestedClass)) {
    return { ok: false, error: `the model proposed an unrecognised provenance class — refusing rather than guessing which of the five it meant` };
  }
  const confidenceRaw = typeof parsed.confidence === 'number' ? parsed.confidence : Number(parsed.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(100, Math.round(confidenceRaw))) : 0;
  const primarySource = typeof parsed.primarySource === 'string' && refs.has(parsed.primarySource) ? parsed.primarySource : null;
  const supportingSources = Array.isArray(parsed.supportingSources)
    ? parsed.supportingSources.filter((s): s is string => typeof s === 'string' && refs.has(s) && s !== primarySource)
    : [];
  const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : '';
  if (!reason) {
    return { ok: false, error: 'the model did not give a reason — refusing an unexplained suggestion' };
  }

  return {
    ok: true,
    suggestion: { suggestedClass: parsed.suggestedClass, confidence, primarySource, supportingSources, reason },
  };
}
