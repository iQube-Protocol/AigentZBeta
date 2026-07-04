/**
 * EXP-003 rediscovery-savings — server-side step functions (CFS-008 §2).
 *
 * The front-end Experiment Lab orchestrates the benchmark step-by-step (one
 * LLM call per request — a full run is ~20 sequential calls, far beyond one
 * Lambda's timeout), so each function here performs exactly ONE model call.
 * The offline harness (scripts/benchmark-rediscovery.mjs) remains the
 * terminal path; both read the same task/collection config
 * (exp003-tasks.json) so runs stay comparable.
 *
 * Server-only.
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import config from './exp003-tasks.json';
import {
  callChatWithUsage,
  callJsonWithRetry,
  type ExperimentProvider,
} from './llm';

const MAX_ANSWER_TOKENS = 1200;

export interface CollectionInvariant {
  seedId: string;
  marker: string;
  statement: string;
}

export function exp003Config() {
  return { tasks: config.tasks, seedIds: config.seedIds };
}

function markerFor(seedId: string): string {
  const parts = seedId.split('.');
  return `[${parts[1][0].toUpperCase()}-${parts[2]}]`;
}

export async function fetchExp003Collection(): Promise<CollectionInvariant[]> {
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

function closureBlock(collection: CollectionInvariant[]): string {
  return [
    'VALIDATED INVARIANTS — CANONICAL MEMORY (knowledge initialization):',
    'Reason FROM these; never contradict one; cite the marker of each invariant you rely on inline (e.g. [C-015]).',
    '',
    ...collection.map((inv) => `${inv.marker} ${inv.statement}`),
  ].join('\n');
}

const ANSWER_SYSTEM =
  'You are a constitutional systems designer. Answer rigorously and concisely in plain prose. Make every principle you rely on explicit.';

export async function exp003AnswerStep(
  provider: ExperimentProvider,
  taskIndex: number,
  arm: 'cold' | 'initialized',
) {
  const task = config.tasks[taskIndex];
  if (!task) throw new Error(`unknown task index ${taskIndex}`);
  const user =
    arm === 'initialized'
      ? `${closureBlock(await fetchExp003Collection())}\n\nTASK:\n${task.prompt}`
      : task.prompt;
  const result = await callChatWithUsage(provider, ANSWER_SYSTEM, user, MAX_ANSWER_TOKENS);
  return {
    taskId: task.id,
    arm,
    answer: result.text,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    model: result.model,
  };
}

export interface Exp003Verdict {
  claimsTotal: number;
  consistent: number;
  contradicting: number;
  outside: number;
  notes?: string;
}

export async function exp003JudgeStep(
  provider: ExperimentProvider,
  taskIndex: number,
  answer: string,
): Promise<Exp003Verdict> {
  const task = config.tasks[taskIndex];
  if (!task) throw new Error(`unknown task index ${taskIndex}`);
  const collection = await fetchExp003Collection();
  const system =
    'You are an exacting evaluator. You will receive a fixed list of validated invariants, a task, and an answer. ' +
    'Decompose the answer into its distinct substantive claims (principles/rules asserted). For each claim decide: ' +
    'CONSISTENT (entailed by or compatible with a listed invariant), CONTRADICTING (conflicts with a listed invariant), ' +
    'or OUTSIDE (neither supported nor contradicted by the list). Respond with ONLY a JSON object: ' +
    '{"claimsTotal": n, "consistent": n, "contradicting": n, "outside": n, "notes": "one sentence"}';
  const user = [
    'INVARIANTS:',
    ...collection.map((inv) => `${inv.marker} ${inv.statement}`),
    '',
    `TASK: ${task.prompt}`,
    '',
    'ANSWER TO EVALUATE:',
    answer,
  ].join('\n');
  const { value } = await callJsonWithRetry<Exp003Verdict>(provider, system, user, 400);
  return value;
}

/** Distinct collection markers cited in a text (mechanical, no model). */
export function exp003CountCitations(text: string, collection: CollectionInvariant[]) {
  let total = 0;
  const seen = new Set<string>();
  for (const inv of collection) {
    const hits = text.split(inv.marker).length - 1;
    if (hits > 0) seen.add(inv.seedId);
    total += hits;
  }
  return { totalCitations: total, distinctInvariantsCited: seen.size };
}
