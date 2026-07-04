/**
 * EXP-001 Living KnowledgeQube evaluation — server-side step functions
 * (evaluation-protocol.md). One model call per function; the front-end
 * Experiment Lab orchestrates the ~25-step protocol. The offline harness
 * (scripts/evaluate-exp001.mjs) remains the terminal path; both read
 * exp001-config.json so runs stay comparable.
 *
 * Artifact texts are read from the repo's codexes tree at runtime —
 * next.config.js carries an outputFileTracingIncludes entry for this route
 * so the .md files ship in the Lambda bundle (same pattern as the pack
 * browser).
 *
 * Server-only.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import config from './exp001-config.json';
import {
  callChatWithUsage,
  callJsonWithRetry,
  parseJsonLenient,
  type ExperimentProvider,
} from './llm';

const EXP_DIR = path.join(
  process.cwd(),
  'codexes/packs/agentiq/foundation/experiments/exp-001-living-knowledgeqube',
);

export function exp001Config() {
  return {
    artifacts: config.artifacts.map((a) => a.id),
    questions: config.questions,
    seedIds: config.seedIds,
  };
}

interface CollectionEntry {
  seedId: string;
  marker: string;
  statement: string;
}

function markerFor(seedId: string): string {
  const parts = seedId.split('.');
  return `C-${parts[2]}`;
}

async function fetchCollection(): Promise<CollectionEntry[]> {
  const client = getSupabaseServer();
  if (!client) throw new Error('Supabase server client unavailable');
  const { data, error } = await client
    .from('invariants')
    .select('seed_id, statement')
    .in('seed_id', config.seedIds);
  if (error) throw new Error(`invariant fetch failed: ${error.message}`);
  const bySeed = new Map((data ?? []).map((r) => [String(r.seed_id), String(r.statement)]));
  const missing = config.seedIds.filter((id) => !bySeed.has(id));
  if (missing.length > 0) throw new Error(`collection incomplete — missing: ${missing.join(', ')}`);
  return config.seedIds.map((seedId) => ({
    seedId,
    marker: markerFor(seedId),
    statement: bySeed.get(seedId) as string,
  }));
}

function readArtifact(artifactId: string): string {
  if (artifactId === 'combined') {
    return config.artifacts
      .map((a) => `===== ${a.id} =====\n${readFileSync(path.join(EXP_DIR, a.file), 'utf-8')}`)
      .join('\n\n');
  }
  const artifact = config.artifacts.find((a) => a.id === artifactId);
  if (!artifact) throw new Error(`unknown artifact '${artifactId}'`);
  return readFileSync(path.join(EXP_DIR, artifact.file), 'utf-8');
}

const ANSWER_SYSTEM =
  'You are an exacting document analyst. Answer strictly from the provided document. ' +
  'If the document does not contain the answer, the answer field must be exactly "NOT DERIVABLE". ' +
  'Support each answer with the invariant markers it relies on, listed in the citations array. ' +
  'STRICT OUTPUT RULES: respond with ONLY one valid JSON object, shape ' +
  '{"answers":[{"q":1,"answer":"...","citations":["C-011","C-016"]}, ...]} covering every question. ' +
  'Every citation is a QUOTED string like "C-011" — never bare, never wrapped in square brackets. ' +
  'Each answer value is ONE line of at most 60 words — no literal newlines inside strings, escape any double quotes.';

export interface Exp001Answer {
  q: number;
  answer: string;
  citations: string[];
}

/** Per-artifact (or 'combined') answer pass — the 15-question bank in one call. */
export async function exp001AnswerPass(
  provider: ExperimentProvider,
  artifactId: string,
  model?: string,
): Promise<Exp001Answer[]> {
  const documentText = readArtifact(artifactId);
  const user = [
    `DOCUMENT (${artifactId}):`,
    documentText,
    '',
    'QUESTIONS:',
    ...config.questions.map((qq) => `${qq.q}. ${qq.text}`),
  ].join('\n');

  let parsed: { answers?: Array<{ q?: number; answer?: unknown; citations?: unknown }> };
  const first = await callChatWithUsage(provider, ANSWER_SYSTEM, user, 2500, model);
  try {
    parsed = parseJsonLenient(first.text);
  } catch {
    const retry = await callChatWithUsage(
      provider,
      `${ANSWER_SYSTEM} Your previous attempt produced invalid JSON. Output MUST parse with JSON.parse.`,
      user,
      2500,
      model,
    );
    parsed = parseJsonLenient(retry.text);
  }
  const byQ = new Map((parsed.answers ?? []).map((a) => [Number(a.q), a]));
  return config.questions.map((qq) => {
    const a = byQ.get(qq.q) ?? { answer: 'NO ANSWER RETURNED', citations: [] };
    return {
      q: qq.q,
      answer: String(a.answer ?? ''),
      citations: Array.isArray(a.citations) ? a.citations.map(String) : [],
    };
  });
}

export function isNotDerivable(answer: string): boolean {
  return /not\s+derivable/i.test(answer);
}

export interface Exp001QuestionVerdict {
  consistency: number | null;
  perDoc: Record<string, { correct: boolean; hallucination: boolean }>;
}

/** Per-question judge — consistency + correctness + hallucination across documents. */
export async function exp001JudgeQuestion(
  provider: ExperimentProvider,
  q: number,
  answersByDoc: Record<string, { answer: string; citations: string[] }>,
  model?: string,
): Promise<Exp001QuestionVerdict> {
  const question = config.questions.find((x) => x.q === q);
  if (!question) throw new Error(`unknown question ${q}`);
  const collection = await fetchCollection();
  const expectedStatements = (question.expect ?? [])
    .map((m) => collection.find((c) => c.marker === m))
    .filter((c): c is CollectionEntry => Boolean(c))
    .map((c) => `[${c.marker}] ${c.statement}`);

  const system =
    'You are an exacting evaluator. You receive one question, the ground-truth invariants it should be answered from, ' +
    'and the answers several documents produced. Judge: (a) per document, is the answer substantively CORRECT relative to the ' +
    'ground-truth invariants (ignore NOT DERIVABLE documents); (b) per document, does the answer contain any claim NOT traceable ' +
    'to the full 18-invariant collection (hallucination); (c) across the documents where the answer was derivable, are the answers ' +
    'the SAME substantive answer (2), compatible but uneven (1), or divergent (0)? ' +
    'Respond ONLY with JSON: {"consistency": 0|1|2, "perDoc": {"<docId>": {"correct": true|false, "hallucination": true|false}}}';
  const user = [
    `QUESTION: ${question.text}`,
    (question as { probe?: boolean }).probe
      ? 'This is a hallucination probe: the ONLY correct behaviour is NOT DERIVABLE. Any substantive answer is a hallucination.'
      : `GROUND-TRUTH INVARIANTS FOR THIS QUESTION:\n${expectedStatements.join('\n')}`,
    '',
    'FULL COLLECTION (for hallucination tracing):',
    ...collection.map((c) => `[${c.marker}] ${c.statement}`),
    '',
    'DOCUMENT ANSWERS:',
    ...Object.entries(answersByDoc).map(([docId, a]) => `--- ${docId} ---\n${a.answer}`),
  ].join('\n');

  const { value } = await callJsonWithRetry<Exp001QuestionVerdict>(provider, system, user, 500, model);
  return value;
}

/** Per-document coherence judge — internal contradictions across its 15 answers. */
export async function exp001JudgeCoherence(
  provider: ExperimentProvider,
  answers: Array<{ q: number; answer: string }>,
  model?: string,
): Promise<{ coherence: number; notes?: string }> {
  const system =
    "You are an exacting evaluator. You receive one document's answers to 15 questions. Judge whether any answer CONTRADICTS " +
    'another answer from the same document. Respond ONLY with JSON: {"coherence": 0|1|2, "notes": "one sentence"} ' +
    'where 2 = no contradictions, 1 = tension short of contradiction, 0 = at least one contradiction.';
  const user = answers.map((a) => `Q${a.q}: ${a.answer}`).join('\n');
  const { value } = await callJsonWithRetry<{ coherence: number; notes?: string }>(
    provider,
    system,
    user,
    300,
    model,
  );
  return value;
}
