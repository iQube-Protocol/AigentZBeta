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
 *   plus ONE provider key. Providers mirror the platform's LLM chain
 *   (services/agents/_lib/llmDraftHelper.ts) exactly — same env names,
 *   endpoints, and default models:
 *     anthropic — ANTHROPIC_API_KEY  (ANTHROPIC_DRAFT_MODEL, default claude-sonnet-4-6)
 *     openai    — OPENAI_API_KEY    (OPENAI_DRAFT_MODEL,    default gpt-4o-mini)
 *     venice    — VENICE_API_KEY    (VENICE_DRAFT_MODEL,    default llama-3.3-70b,
 *                 at VENICE_BASE_URL or https://api.venice.ai/api/v1)
 *
 * Usage:
 *   node scripts/benchmark-rediscovery.mjs --dry-run             # print plan, no API calls
 *   node scripts/benchmark-rediscovery.mjs                       # full run (~20 API calls)
 *   node scripts/benchmark-rediscovery.mjs --provider openai     # force a provider
 *   node scripts/benchmark-rediscovery.mjs --tasks 2             # first N tasks only
 *   node scripts/benchmark-rediscovery.mjs --broad               # + grounding-breadth arm
 *
 * The --broad arm adds a third grounding regime per task: instead of the
 * fixed 18-invariant collection, it grounds on a domain-scoped slice drawn
 * LIVE from the whole groundable crystal (canonical+validated in the
 * constitutional/reasoning/engineering namespaces, top 24 by
 * standing→confidence→reach — mirroring buildInvariantSlice). It reports the
 * narrow→broad BREADTH DELTA: the extra rediscovery savings that come purely
 * from a richer discoverable crystal. Advance the crystal to 'validated'
 * before running --broad, else the broad slice ≈ the narrow collection and
 * the delta is uninformative (the harness warns when that happens).
 *
 * Without --provider the first provider with a key (platform order:
 * anthropic → openai → venice) is used. Both arms and the judge always run
 * on the SAME provider+model — never mix providers within a run, the
 * comparison would be meaningless.
 *
 * Output: codexes/packs/irl/foundation/experiments/exp-003-rediscovery-savings/
 *   results-<UTC date>.json  (raw)  +  a summary table on stdout to paste
 *   into the experiment README's results section.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const OUT_DIR = join(REPO, 'codexes/packs/irl/foundation/experiments/exp-003-rediscovery-savings');
const DRY_RUN = process.argv.includes('--dry-run');
const tasksArgIdx = process.argv.indexOf('--tasks');
const TASK_LIMIT = tasksArgIdx > -1 ? Number(process.argv[tasksArgIdx + 1]) : Infinity;

// Grounding-BREADTH arm (2026-07-14): a third arm grounded not by the fixed
// 18-invariant collection but by a domain-scoped slice drawn LIVE from the
// whole groundable crystal, ranked exactly as services/invariants/grounding.ts
// buildInvariantSlice ranks (standing → confidence → reach). Measures what
// broadening the discoverable crystal DOES: does richer grounding reduce
// output-token rediscovery and/or raise grounded share vs the narrow
// collection? The narrow→broad delta is the value of crystal breadth.
const BROAD = process.argv.includes('--broad');
// The domains these constitutional-reasoning tasks operate in — the slice is
// scoped to them exactly as a real governance reasoning call would scope.
const BROAD_NAMESPACES = ['constitutional', 'reasoning', 'engineering'];
// 2× the platform's default grounding limit (12) — a generous governance slice.
const BROAD_LIMIT = 24;
// Grounding-eligible statuses — mirrors GROUNDING_STATUSES in grounding.ts.
const BROAD_STATUSES = ['canonical', 'validated'];

// ── The fixed collection + task set — single source of truth shared with
// the Experiment Lab front-end (services/experiments/exp003-tasks.json) ──
const EXP003_CONFIG = JSON.parse(
  readFileSync(join(REPO, 'services/experiments/exp003-tasks.json'), 'utf-8'),
);
const SEED_IDS = EXP003_CONFIG.seedIds;
const TASKS = EXP003_CONFIG.tasks;

const MAX_ANSWER_TOKENS = 1200;
const providerArgIdx = process.argv.indexOf('--provider');
const FORCED_PROVIDER = providerArgIdx > -1 ? process.argv[providerArgIdx + 1] : null;

/**
 * Provider table — env names, endpoints, and default models mirror
 * services/agents/_lib/llmDraftHelper.ts verbatim. Order = the platform's
 * fallback chain.
 */
const PROVIDERS = {
  anthropic: {
    keyEnv: 'ANTHROPIC_API_KEY',
    model: () => process.env.ANTHROPIC_DRAFT_MODEL || 'claude-sonnet-4-6',
  },
  openai: {
    keyEnv: 'OPENAI_API_KEY',
    model: () => process.env.OPENAI_DRAFT_MODEL || 'gpt-4o-mini',
  },
  venice: {
    keyEnv: 'VENICE_API_KEY',
    model: () => process.env.VENICE_DRAFT_MODEL || 'llama-3.3-70b',
  },
};

function resolveProvider() {
  if (FORCED_PROVIDER) {
    if (!PROVIDERS[FORCED_PROVIDER]) {
      throw new Error(`unknown --provider '${FORCED_PROVIDER}' (anthropic | openai | venice)`);
    }
    if (!process.env[PROVIDERS[FORCED_PROVIDER].keyEnv] && !DRY_RUN) {
      throw new Error(`--provider ${FORCED_PROVIDER} but ${PROVIDERS[FORCED_PROVIDER].keyEnv} is not set (checked env + .env.local)`);
    }
    return FORCED_PROVIDER;
  }
  for (const name of ['anthropic', 'openai', 'venice']) {
    if (process.env[PROVIDERS[name].keyEnv]) return name;
  }
  if (DRY_RUN) return 'anthropic';
  throw new Error('no provider key found — set ANTHROPIC_API_KEY, OPENAI_API_KEY, or VENICE_API_KEY (or pass --provider)');
}

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

/**
 * The BROAD slice — the domain-scoped top-N of the live groundable crystal,
 * ranked as buildInvariantSlice ranks (standing → confidence → reach). This
 * is what a real governance reasoning call would ground on once the crystal
 * is advanced; the harness reads it straight from the DB so the measured
 * breadth delta reflects the ACTUAL groundable state, not a fixture.
 */
async function fetchBroadSlice(supabase) {
  const { data, error } = await supabase
    .from('invariants')
    .select('seed_id, statement, standing, confidence, reach, namespace, status')
    .in('status', BROAD_STATUSES)
    .in('namespace', BROAD_NAMESPACES)
    .order('standing', { ascending: false })
    .order('confidence', { ascending: false })
    .order('reach', { ascending: false })
    .limit(BROAD_LIMIT);
  if (error) throw new Error(`broad slice fetch failed: ${error.message}`);
  return (data ?? [])
    .filter((r) => typeof r.seed_id === 'string' && r.seed_id.startsWith('inv.'))
    .map((r) => ({ seedId: r.seed_id, marker: markerFor(r.seed_id), statement: r.statement }));
}

let ACTIVE_PROVIDER = 'anthropic';
let ACTIVE_MODEL = '';

/** One chat call on the active provider. Same shape for both arms + judge. */
async function callChat(system, user, maxTokens) {
  if (ACTIVE_PROVIDER === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ACTIVE_MODEL,
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

  // openai + venice — both OpenAI-compatible chat/completions with `usage`.
  const baseUrl =
    ACTIVE_PROVIDER === 'venice'
      ? `${process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1'}`
      : 'https://api.openai.com/v1';
  const apiKey = process.env[PROVIDERS[ACTIVE_PROVIDER].keyEnv];
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: ACTIVE_MODEL,
      temperature: 0,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${ACTIVE_PROVIDER} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
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
  const { text } = await callChat(system, user, 400);
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
  ACTIVE_PROVIDER = resolveProvider();
  ACTIVE_MODEL = PROVIDERS[ACTIVE_PROVIDER].model();

  const supabase = createClient(url, key);
  const collection = await fetchCollection(supabase);
  const tasks = TASKS.slice(0, TASK_LIMIT);
  const block = closureBlock(collection);

  // BROAD arm slice + block (only when --broad).
  const broadSlice = BROAD ? await fetchBroadSlice(supabase) : [];
  const broadBlock = BROAD ? closureBlock(broadSlice) : '';

  console.log(`EXP-003 rediscovery-savings benchmark${BROAD ? ' + grounding-breadth arm' : ''}`);
  console.log(`provider=${ACTIVE_PROVIDER} model=${ACTIVE_MODEL} temperature=0 tasks=${tasks.length} collection=${collection.length} invariants`);
  if (BROAD) {
    console.log(`broad slice=${broadSlice.length} invariants (live, ${BROAD_STATUSES.join('+')} in ${BROAD_NAMESPACES.join('/')}, top ${BROAD_LIMIT} by standing→confidence→reach)`);
    if (broadSlice.length <= collection.length) {
      console.log(`  ⚠ broad slice (${broadSlice.length}) is not larger than the narrow collection (${collection.length}) — advance the crystal to 'validated' first, else the breadth delta is uninformative.`);
    }
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: no API calls. Closure block preview:\n');
    console.log(block.split('\n').slice(0, 6).join('\n') + '\n…');
    if (BROAD) {
      console.log('\nBroad slice preview:\n');
      console.log(broadBlock.split('\n').slice(0, 8).join('\n') + '\n…');
    }
    const armsPerTask = BROAD ? 3 : 2;
    const judgesPerTask = BROAD ? 3 : 2;
    console.log(`\nWould run: ${tasks.length} × (${armsPerTask} answers + ${judgesPerTask} judge passes) = ${tasks.length * (armsPerTask + judgesPerTask)} API calls.`);
    return;
  }

  const results = [];
  for (const task of tasks) {
    console.log(`\n── ${task.id} ──`);

    process.stdout.write('  cold …');
    const cold = await callChat(ANSWER_SYSTEM, task.prompt, MAX_ANSWER_TOKENS);
    console.log(` ${cold.outputTokens} output tokens`);

    process.stdout.write('  initialized …');
    const init = await callChat(ANSWER_SYSTEM, `${block}\n\nTASK:\n${task.prompt}`, MAX_ANSWER_TOKENS);
    console.log(` ${init.outputTokens} output tokens`);

    let broad = null;
    if (BROAD) {
      process.stdout.write('  broad …');
      broad = await callChat(ANSWER_SYSTEM, `${broadBlock}\n\nTASK:\n${task.prompt}`, MAX_ANSWER_TOKENS);
      console.log(` ${broad.outputTokens} output tokens`);
    }

    process.stdout.write('  judging …');
    const coldJudge = await judge(collection, task.prompt, cold.text);
    const initJudge = await judge(collection, task.prompt, init.text);
    // The broad arm is judged against the broad slice it was grounded on.
    const broadJudge = BROAD ? await judge(broadSlice, task.prompt, broad.text) : null;
    console.log(' done');

    const entry = {
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
    };
    if (BROAD) {
      entry.broad = {
        inputTokens: broad.inputTokens,
        outputTokens: broad.outputTokens,
        judge: broadJudge,
        citations: countCitations(broad.text, broadSlice),
        answer: broad.text,
      };
    }
    results.push(entry);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = join(OUT_DIR, `results-${stamp}.json`);
  const arms = BROAD ? ['cold', 'initialized', 'broad'] : ['cold', 'initialized'];
  writeFileSync(outPath, JSON.stringify({
    provider: ACTIVE_PROVIDER,
    model: ACTIVE_MODEL,
    ranAt: new Date().toISOString(),
    collectionSeeds: SEED_IDS,
    ...(BROAD ? { broadSliceSeeds: broadSlice.map((i) => i.seedId), broadNamespaces: BROAD_NAMESPACES, broadLimit: BROAD_LIMIT } : {}),
    results,
  }, null, 2));

  // Summary table (paste into README results section).
  console.log('\n| Task | Arm | Out tokens | Claims | Consistent | Contradicting | Outside | Cited |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    for (const arm of arms) {
      const a = r[arm];
      if (!a) continue;
      console.log(
        `| ${r.taskId} | ${arm} | ${a.outputTokens} | ${a.judge.claimsTotal} | ${a.judge.consistent} | ${a.judge.contradicting} | ${a.judge.outside} | ${a.citations.distinctInvariantsCited} |`,
      );
    }
  }
  const sum = (arm, f) => results.reduce((acc, r) => acc + (r[arm] ? (f(r[arm]) ?? 0) : 0), 0);
  const groundedShare = (arm) => {
    const total = sum(arm, (a) => a.judge.claimsTotal);
    return total > 0 ? (sum(arm, (a) => a.judge.consistent) / total) : null;
  };
  const pct = (v) => (v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`);
  console.log('\nAggregate:');
  for (const arm of arms) {
    console.log(`  ${arm.padEnd(11)}: ${sum(arm, (a) => a.outputTokens)} output tokens, grounded share ${pct(groundedShare(arm))}, contradictions ${sum(arm, (a) => a.judge.contradicting)}`);
  }
  // Rediscovery savings (cold is the shared baseline).
  const coldTokens = sum('cold', (a) => a.outputTokens);
  const saving = (arm) => (coldTokens > 0 ? ((coldTokens - sum(arm, (a) => a.outputTokens)) / coldTokens) : null);
  console.log('\nRediscovery savings vs cold (output tokens):');
  console.log(`  narrow (initialized, ${collection.length} invariants): ${pct(saving('initialized'))}`);
  if (BROAD) {
    console.log(`  broad  (live slice, ${broadSlice.length} invariants):   ${pct(saving('broad'))}`);
    const narrowTok = sum('initialized', (a) => a.outputTokens);
    const broadTok = sum('broad', (a) => a.outputTokens);
    const breadthDelta = narrowTok > 0 ? ((narrowTok - broadTok) / narrowTok) : null;
    console.log(`\n★ BREADTH DELTA (narrow → broad): ${pct(breadthDelta)} further output-token reduction, grounded-share ${pct(groundedShare('initialized'))} → ${pct(groundedShare('broad'))}.`);
    console.log(`  Positive token delta + non-falling grounded share = broadening the discoverable crystal measurably improves reasoning economy. This is the "invariants must be discoverable to earn their keep" claim, measured.`);
  }
  console.log(`\nRaw results: ${outPath}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
