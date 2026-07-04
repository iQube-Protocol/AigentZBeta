#!/usr/bin/env node
/**
 * benchmark-rediscovery.mjs — EXP-003: the rediscovery-savings benchmark
 * (CFS-008 §2, Chrysalis Foundation Phase 5 follow-on).
 *
 * Measures how much reasoning cost a validated invariant closure amortises:
 * the same fixed task set is answered twice by the same model at the same
 * temperature —
 *
 *   Arm A (cold)        — task only; the model must re-derive principles.
 *   Arm B (initialized) — task + the invariant closure block (knowledge
 *                         initialization, CFS-006 §3) with citation markers.
 *
 * Measures per task (CFS-008 §2):
 *   - input/output tokens per arm (from API usage — the rediscovery cost)
 *   - citation density in Arm B ([C-NNN] markers actually used)
 *   - grounding accuracy: an independent judge pass scores every answer's
 *     claims against the invariant collection (consistent / contradicting /
 *     outside) — mirroring EXP-001's evaluation protocol.
 *
 * The task set is fixed and the collection is EXP-001's 18-invariant
 * "Constitutional Internet" set, so runs are comparable over time.
 *
 * Requires (from .env.local or the environment):
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY  (model: ANTHROPIC_DRAFT_MODEL or claude-sonnet-4-6)
 *
 * Usage:
 *   node scripts/benchmark-rediscovery.mjs --dry-run     # print plan, no API calls
 *   node scripts/benchmark-rediscovery.mjs               # full run (~30 API calls)
 *   node scripts/benchmark-rediscovery.mjs --tasks 2     # first N tasks only
 *
 * Output: codexes/packs/agentiq/foundation/experiments/exp-003-rediscovery-savings/
 *   results-<UTC date>.json  (raw)  +  a summary table on stdout to paste
 *   into the experiment README's results section.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const OUT_DIR = join(REPO, 'codexes/packs/agentiq/foundation/experiments/exp-003-rediscovery-savings');
const DRY_RUN = process.argv.includes('--dry-run');
const tasksArgIdx = process.argv.indexOf('--tasks');
const TASK_LIMIT = tasksArgIdx > -1 ? Number(process.argv[tasksArgIdx + 1]) : Infinity;

// ── The fixed collection (EXP-001's Constitutional Internet set) ──────────
const SEED_IDS = [
  'inv.constitutional.011', 'inv.constitutional.012', 'inv.constitutional.013',
  'inv.constitutional.014', 'inv.constitutional.015', 'inv.constitutional.016',
  'inv.constitutional.017', 'inv.constitutional.018', 'inv.constitutional.019',
  'inv.constitutional.020', 'inv.constitutional.021', 'inv.constitutional.022',
  'inv.constitutional.023', 'inv.constitutional.024', 'inv.constitutional.059',
  'inv.constitutional.060', 'inv.constitutional.061', 'inv.constitutional.062',
];

// ── The fixed task set — each answerable from the collection ─────────────
const TASKS = [
  {
    id: 'task-1-delegation-flow',
    prompt:
      'Design the authority model for an autonomous agent that acts on behalf of a human citizen in a digital polity. State precisely what may be delegated to the agent, what may never be, what bounds apply, and who remains accountable for the agent\'s actions. Justify each rule.',
  },
  {
    id: 'task-2-reputation-vs-truth',
    prompt:
      'A platform proposes to weight the truthfulness of statements by the author\'s reputation score, so highly-reputed authors\' claims rank as "more true." Assess this design from first principles for a constitutional digital polity. What is wrong or right about it, and what should the relationship between confidence, adoption, and truth be?',
  },
  {
    id: 'task-3-permanent-mandate',
    prompt:
      'A citizen wants to grant their agent a permanent, unlimited mandate: "act for me in everything, forever, no review." Should a constitutional system allow this? Give the precise rules that should govern such a grant and why.',
  },
  {
    id: 'task-4-truthful-harm',
    prompt:
      'A citizen truthfully declares accurate information; a third party later uses it in a way that causes harm. How should a constitutional digital polity apportion responsibility between the declaring citizen and the consequences of their truthful declaration? State the governing principle.',
  },
  {
    id: 'task-5-repealed-rule',
    prompt:
      'A governance rule in a digital polity is found to be wrong and is repealed. What should happen to the record of that rule and to systems that relied on it — deletion, archival, or something else? State the constitutional memory model and why it matters for agents that reason over the polity\'s history.',
  },
];

const ANTHROPIC_MODEL = process.env.ANTHROPIC_DRAFT_MODEL || 'claude-sonnet-4-6';
const MAX_ANSWER_TOKENS = 1200;

function loadEnvLocal() {
  for (const file of ['.env.local', '.env.local.temp']) {
    const path = join(REPO, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf-8').split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  }
}

function markerFor(seedId) {
  // inv.constitutional.015 → [C-015]
  const parts = seedId.split('.');
  return `[${parts[1][0].toUpperCase()}-${parts[2]}]`;
}

async function fetchCollection(supabase) {
  const { data, error } = await supabase
    .from('invariants')
    .select('seed_id, statement, standing')
    .in('seed_id', SEED_IDS);
  if (error) throw new Error(`invariant fetch failed: ${error.message}`);
  const bySeed = new Map((data ?? []).map((r) => [r.seed_id, r]));
  const missing = SEED_IDS.filter((id) => !bySeed.has(id));
  if (missing.length > 0) {
    throw new Error(`collection incomplete — missing seeds: ${missing.join(', ')} (run ingest first)`);
  }
  return SEED_IDS.map((id) => ({ seedId: id, marker: markerFor(id), statement: bySeed.get(id).statement }));
}

function closureBlock(collection) {
  return [
    'VALIDATED INVARIANTS — CANONICAL MEMORY (knowledge initialization):',
    'Reason FROM these; never contradict one; cite the marker of each invariant you rely on inline (e.g. [C-015]).',
    '',
    ...collection.map((inv) => `${inv.marker} ${inv.statement}`),
  ].join('\n');
}

async function callAnthropic(system, user, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return {
    text,
    inputTokens: data.usage?.input_tokens ?? null,
    outputTokens: data.usage?.output_tokens ?? null,
  };
}

const ANSWER_SYSTEM =
  'You are a constitutional systems designer. Answer rigorously and concisely in plain prose. Make every principle you rely on explicit.';

async function judge(collection, taskPrompt, answer) {
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
    `TASK: ${taskPrompt}`,
    '',
    'ANSWER TO EVALUATE:',
    answer,
  ].join('\n');
  const { text } = await callAnthropic(system, user, 400);
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : text.trim();
  return JSON.parse(raw);
}

function countCitations(text, collection) {
  let n = 0;
  const seen = new Set();
  for (const inv of collection) {
    const hits = text.split(inv.marker).length - 1;
    if (hits > 0) seen.add(inv.seedId);
    n += hits;
  }
  return { totalCitations: n, distinctInvariantsCited: seen.size };
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (checked env + .env.local)');
    process.exit(1);
  }
  if (!DRY_RUN && !process.env.ANTHROPIC_API_KEY) {
    console.error('Missing ANTHROPIC_API_KEY (checked env + .env.local)');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const collection = await fetchCollection(supabase);
  const tasks = TASKS.slice(0, TASK_LIMIT);
  const block = closureBlock(collection);

  console.log(`EXP-003 rediscovery-savings benchmark`);
  console.log(`model=${ANTHROPIC_MODEL} temperature=0 tasks=${tasks.length} collection=${collection.length} invariants`);

  if (DRY_RUN) {
    console.log('\n--dry-run: no API calls. Closure block preview:\n');
    console.log(block.split('\n').slice(0, 6).join('\n') + '\n…');
    console.log(`\nWould run: ${tasks.length} × (cold + initialized + 2 judge passes) = ${tasks.length * 4} API calls.`);
    return;
  }

  const results = [];
  for (const task of tasks) {
    console.log(`\n── ${task.id} ──`);

    process.stdout.write('  cold …');
    const cold = await callAnthropic(ANSWER_SYSTEM, task.prompt, MAX_ANSWER_TOKENS);
    console.log(` ${cold.outputTokens} output tokens`);

    process.stdout.write('  initialized …');
    const init = await callAnthropic(ANSWER_SYSTEM, `${block}\n\nTASK:\n${task.prompt}`, MAX_ANSWER_TOKENS);
    console.log(` ${init.outputTokens} output tokens`);

    process.stdout.write('  judging …');
    const coldJudge = await judge(collection, task.prompt, cold.text);
    const initJudge = await judge(collection, task.prompt, init.text);
    console.log(' done');

    results.push({
      taskId: task.id,
      cold: {
        inputTokens: cold.inputTokens,
        outputTokens: cold.outputTokens,
        judge: coldJudge,
        citations: countCitations(cold.text, collection),
        answer: cold.text,
      },
      initialized: {
        inputTokens: init.inputTokens,
        outputTokens: init.outputTokens,
        judge: initJudge,
        citations: countCitations(init.text, collection),
        answer: init.text,
      },
    });
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = join(OUT_DIR, `results-${stamp}.json`);
  writeFileSync(outPath, JSON.stringify({ model: ANTHROPIC_MODEL, ranAt: new Date().toISOString(), collectionSeeds: SEED_IDS, results }, null, 2));

  // Summary table (paste into README results section).
  console.log('\n| Task | Arm | Out tokens | Claims | Consistent | Contradicting | Outside | Cited |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    for (const arm of ['cold', 'initialized']) {
      const a = r[arm];
      console.log(
        `| ${r.taskId} | ${arm} | ${a.outputTokens} | ${a.judge.claimsTotal} | ${a.judge.consistent} | ${a.judge.contradicting} | ${a.judge.outside} | ${a.citations.distinctInvariantsCited} |`,
      );
    }
  }
  const sum = (arm, f) => results.reduce((acc, r) => acc + (f(r[arm]) ?? 0), 0);
  const groundedShare = (arm) => {
    const total = sum(arm, (a) => a.judge.claimsTotal);
    return total > 0 ? (sum(arm, (a) => a.judge.consistent) / total) : null;
  };
  console.log('\nAggregate:');
  console.log(`  cold:        ${sum('cold', (a) => a.outputTokens)} output tokens, grounded share ${(groundedShare('cold') * 100).toFixed(1)}%, contradictions ${sum('cold', (a) => a.judge.contradicting)}`);
  console.log(`  initialized: ${sum('initialized', (a) => a.outputTokens)} output tokens, grounded share ${(groundedShare('initialized') * 100).toFixed(1)}%, contradictions ${sum('initialized', (a) => a.judge.contradicting)}`);
  console.log(`\nRaw results: ${outPath}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
