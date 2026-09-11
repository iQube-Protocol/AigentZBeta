/**
 * bundleJudgement — the SEPARATE, opt-in fidelity judge (Studio skill).
 *
 * EXP-001 proved the generator works; production does not re-prove it. But an
 * operator may still want independent verification of a specific bundle AFTER
 * it is generated — a judge pass over the produced artefacts. That is what
 * this module is: never part of generation, never mandatory, always invoked
 * as its own task (route action 'judge'). It spends LLM credits, so it is
 * metered and opt-in by design.
 *
 * Reuses the exp001 method WITHOUT touching it: `exp001JudgeCoherence` is
 * already fully generic (arbitrary answers[], zero config) and is imported
 * UNCHANGED — the published EXP-001 record stays byte-for-byte reproducible.
 * The per-invariant fidelity pass is new prompt code (it never existed in
 * exp001.ts) built on the generic `callJsonWithRetry` helper.
 *
 * Server-only.
 */

import { getInvariantsByIds } from '@/services/invariants/store';
import { callJsonWithRetry, type ExperimentProvider } from '@/services/experiments/llm';
import { exp001JudgeCoherence } from '@/services/experiments/exp001';
import type { InvariantRecord } from '@/types/invariants';

export interface JudgeDocument {
  id: string;
  text: string;
}

export type FidelityVerdict = 'preserved' | 'weakened' | 'contradicted' | 'absent';

export interface InvariantFidelity {
  invariantId: string;
  marker: string;
  verdict: FidelityVerdict;
  note: string;
}

export interface RemediationHint {
  documentId: string;
  reason: string;
  suggestion: 'regenerate_segment' | 'redraft_article';
}

export interface JudgementReport {
  score: number; // 0–100: preserved=1, weakened=0.5, contradicted/absent=0
  pass: boolean; // score ≥ 80 AND zero 'contradicted'
  perInvariant: InvariantFidelity[];
  coherence: { coherence: 0 | 1 | 2; notes?: string } | null;
  hallucinationFlags: number;
  remediationHints: RemediationHint[];
  judgedBy: { provider: string; model: string };
  documentIds: string[];
  invariantCount: number;
}

/** Input guards — sized to the 25s-per-call provider budget (llm.ts). */
export const JUDGE_MAX_DOCUMENTS = 4;
export const JUDGE_MAX_INVARIANTS = 40;
export const JUDGE_MAX_CHARS = 24_000;

function markerOf(inv: InvariantRecord, i: number): string {
  if (inv.seedId) {
    const parts = inv.seedId.split('.');
    const ns = parts[1]?.[0]?.toUpperCase() ?? 'X';
    const num = parts[2] ?? String(i).padStart(3, '0');
    return `[${ns}-${num}]`;
  }
  return `[X-${String(i).padStart(3, '0')}]`;
}

const VERDICT_WEIGHT: Record<FidelityVerdict, number> = {
  preserved: 1,
  weakened: 0.5,
  contradicted: 0,
  absent: 0,
};

/** Pure — the aggregate report from per-document verdicts. Canary-pinned. */
export function computeJudgementScore(
  perInvariant: InvariantFidelity[],
): { score: number; pass: boolean } {
  if (perInvariant.length === 0) return { score: 0, pass: false };
  const total = perInvariant.reduce((sum, v) => sum + VERDICT_WEIGHT[v.verdict], 0);
  const score = Math.round((total / perInvariant.length) * 100);
  const anyContradiction = perInvariant.some((v) => v.verdict === 'contradicted');
  return { score, pass: score >= 80 && !anyContradiction };
}

interface DocFidelity {
  verdicts: Array<{ invariantId: string; verdict: FidelityVerdict; note: string }>;
  untraceableClaims: string[];
}

const FIDELITY_SYSTEM =
  'You are an exacting fidelity judge. You receive one produced artefact (text) and a set of ground-truth invariants. ' +
  'For EACH invariant, judge whether the artefact PRESERVES its meaning: "preserved" (faithfully carried), "weakened" ' +
  '(present but diluted/hedged), "contradicted" (the artefact asserts the opposite), or "absent" (not addressed). ' +
  'Also list any claim in the artefact that is NOT traceable to the invariant set (potential hallucination). ' +
  'Respond ONLY with JSON: {"verdicts":[{"invariantId":"<id>","verdict":"preserved|weakened|contradicted|absent","note":"<one clause>"}],"untraceableClaims":["<claim>"]}.';

/**
 * Judge the fidelity of one or more produced documents against a grounding
 * invariant set. One JSON call per document (fidelity) + one coherence call
 * across the documents. Bounded; opt-in; spends credits.
 */
export async function judgeBundleFidelity(
  provider: ExperimentProvider,
  documents: JudgeDocument[],
  invariantIds: string[],
  model?: string,
): Promise<JudgementReport> {
  const docs = documents.slice(0, JUDGE_MAX_DOCUMENTS).filter((d) => d.text.trim().length > 0);
  const totalChars = docs.reduce((n, d) => n + d.text.length, 0);
  if (docs.length === 0) throw new Error('no non-empty documents to judge');
  if (totalChars > JUDGE_MAX_CHARS) throw new Error(`bundle too large to judge in one pass (${totalChars} > ${JUDGE_MAX_CHARS} chars) — split it`);

  const invariants = (await getInvariantsByIds(invariantIds.slice(0, JUDGE_MAX_INVARIANTS)).catch(() => [])) as InvariantRecord[];
  const markerById = new Map(invariants.map((inv, i) => [inv.id, markerOf(inv, i)]));
  const invBlock = invariants.map((inv, i) => `${markerOf(inv, i)} id=${inv.id}: ${inv.statement}`).join('\n');

  const perInvariant: InvariantFidelity[] = [];
  const remediationHints: RemediationHint[] = [];
  let hallucinationFlags = 0;

  for (const doc of docs) {
    const user = `GROUND-TRUTH INVARIANTS:\n${invBlock}\n\nPRODUCED ARTEFACT (id=${doc.id}):\n${doc.text.slice(0, 12_000)}`;
    let result: DocFidelity;
    try {
      const { value } = await callJsonWithRetry<DocFidelity>(provider, FIDELITY_SYSTEM, user, 900, model);
      result = value;
    } catch {
      continue; // a failed doc pass drops that doc's verdicts, never the report
    }
    const verdicts = Array.isArray(result?.verdicts) ? result.verdicts : [];
    for (const v of verdicts) {
      const verdict = (['preserved', 'weakened', 'contradicted', 'absent'] as FidelityVerdict[]).includes(v?.verdict as FidelityVerdict)
        ? (v.verdict as FidelityVerdict)
        : 'absent';
      perInvariant.push({
        invariantId: String(v?.invariantId ?? ''),
        marker: markerById.get(String(v?.invariantId ?? '')) ?? '[X-000]',
        verdict,
        note: String(v?.note ?? '').slice(0, 200),
      });
      if (verdict === 'contradicted' || verdict === 'absent') {
        remediationHints.push({
          documentId: doc.id,
          reason: `${verdict} invariant ${markerById.get(String(v?.invariantId ?? '')) ?? ''}`.trim(),
          suggestion: doc.id.startsWith('segment') ? 'regenerate_segment' : 'redraft_article',
        });
      }
    }
    hallucinationFlags += Array.isArray(result?.untraceableClaims) ? result.untraceableClaims.length : 0;
  }

  // Cross-document coherence — the generic exp001 pass, imported unchanged.
  let coherence: JudgementReport['coherence'] = null;
  try {
    const answers = docs.map((d, i) => ({ q: i + 1, answer: d.text.slice(0, 2000) }));
    const c = await exp001JudgeCoherence(provider, answers, model);
    coherence = { coherence: c.coherence as 0 | 1 | 2, notes: c.notes };
  } catch {
    coherence = null;
  }

  const { score, pass } = computeJudgementScore(perInvariant);
  return {
    score,
    pass,
    perInvariant,
    coherence,
    hallucinationFlags,
    remediationHints,
    judgedBy: { provider, model: model ?? 'default' },
    documentIds: docs.map((d) => d.id),
    invariantCount: invariants.length,
  };
}
