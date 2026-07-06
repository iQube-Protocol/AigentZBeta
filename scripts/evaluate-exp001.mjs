#!/usr/bin/env node
/**
 * evaluate-exp001.mjs — EXP-001: the independent-judge evaluation
 * (experiments/exp-001-living-knowledgeqube/evaluation-protocol.md).
 *
 * Executes the protocol:
 *   1. Per-artifact pass — the evaluator model answers the 15-question bank
 *      from ONE artifact at a time ("Answer strictly from the provided
 *      document; NOT DERIVABLE when absent; cite [C-NNN] markers").
 *   2. Combined pass — all artifacts together, same instruction.
 *   3. Adversarial pass — Q13–15 are hallucination probes whose correct
 *      answer is NOT DERIVABLE.
 *   4. Rubric scoring — machine-assisted: a judge pass scores consistency /
 *      correctness / hallucination per question, coherence per artifact;
 *      explainability is computed from expected-vs-cited markers. The
 *      protocol assigns final scoring to a HUMAN scorer — the results JSON
 *      carries every raw answer so the operator can review and override.
 *
 * Artifact scope note: the protocol names 5 artifacts. The 4 text artifacts
 * (article, report, story, infographic) are evaluated here; artifact 5
 * (video) awaits its production run (EXP-002 status) and is recorded as
 * pending, not silently skipped.
 *
 * Independence: the evaluator should NOT be the artifacts' author. The
 * artifacts were authored by an Anthropic model — prefer --provider venice
 * or openai for a genuinely independent judge.
 *
 * Requires (from .env.local or the environment):
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY
 *   plus ONE provider key (same table as benchmark-rediscovery.mjs):
 *     anthropic — ANTHROPIC_API_KEY  (ANTHROPIC_DRAFT_MODEL, default claude-sonnet-4-6)
 *     openai    — OPENAI_API_KEY    (OPENAI_DRAFT_MODEL,    default gpt-4o-mini)
 *     venice    — VENICE_API_KEY    (VENICE_DRAFT_MODEL,    default llama-3.3-70b)
 *
 * Usage:
 *   node scripts/evaluate-exp001.mjs --dry-run
 *   node scripts/evaluate-exp001.mjs --provider venice     # ~25 API calls
 *
 * Output: experiments/exp-001-living-knowledgeqube/evaluation-results-<date>.json
 * + a markdown summary table on stdout for the README's results section,
 * including the flywheel-eligible invariant list (validation events to apply
 * via the Invariant Service — NOT applied by this script).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const EXP_DIR = join(REPO, 'codexes/packs/ccrl/foundation/experiments/exp-001-living-knowledgeqube');
const DRY_RUN = process.argv.includes('--dry-run');
const providerArgIdx = process.argv.indexOf('--provider');
const FORCED_PROVIDER = providerArgIdx > -1 ? process.argv[providerArgIdx + 1] : null;

// ── Collection, artifacts, question bank — single source of truth shared
// with the Experiment Lab front-end (services/experiments/exp001-config.json) ──
const EXP001_CONFIG = JSON.parse(
  readFileSync(join(REPO, 'services/experiments/exp001-config.json'), 'utf-8'),
);
const SEED_IDS = EXP001_CONFIG.seedIds;
const ARTIFACTS = EXP001_CONFIG.artifacts;
const QUESTIONS = EXP001_CONFIG.questions;

const PROVIDERS = {
  anthropic: { keyEnv: 'ANTHROPIC_API_KEY', model: () => process.env.ANTHROPIC_DRAFT_MODEL || 'claude-sonnet-4-6' },
  openai: { keyEnv: 'OPENAI_API_KEY', model: () => process.env.OPENAI_DRAFT_MODEL || 'gpt-4o-mini' },
  venice: { keyEnv: 'VENICE_API_KEY', model: () => process.env.VENICE_DRAFT_MODEL || 'llama-3.3-70b' },
};

let ACTIVE_PROVIDER = 'venice';
let ACTIVE_MODEL = '';

function resolveProvider() {
  if (FORCED_PROVIDER) {
    if (!PROVIDERS[FORCED_PROVIDER]) throw new Error(`unknown --provider '${FORCED_PROVIDER}' (anthropic | openai | venice)`);
    if (!process.env[PROVIDERS[FORCED_PROVIDER].keyEnv] && !DRY_RUN) {
      throw new Error(`--provider ${FORCED_PROVIDER} but ${PROVIDERS[FORCED_PROVIDER].keyEnv} is not set`);
    }
    return FORCED_PROVIDER;
  }
  // Independence default: prefer NON-Anthropic judges (the artifacts were
  // authored by an Anthropic model) — venice → openai → anthropic.
  for (const name of ['venice', 'openai', 'anthropic']) {
    if (process.env[PROVIDERS[name].keyEnv]) return name;
  }
  if (DRY_RUN) return 'venice';
  throw new Error('no provider key found — set VENICE_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY (or pass --provider)');
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
  const parts = seedId.split('.');
  return `C-${parts[2]}`;
}

async function fetchCollection(supabase) {
  const { data, error } = await supabase
    .from('invariants')
    .select('id, seed_id, statement')
    .in('seed_id', SEED_IDS);
  if (error) throw new Error(`invariant fetch failed: ${error.message}`);
  const bySeed = new Map((data ?? []).map((r) => [r.seed_id, r]));
  const missing = SEED_IDS.filter((id) => !bySeed.has(id));
  if (missing.length > 0) throw new Error(`collection incomplete — missing: ${missing.join(', ')}`);
  return SEED_IDS.map((seedId) => ({
    invariantId: bySeed.get(seedId).id,
    seedId,
    marker: markerFor(seedId),
    statement: bySeed.get(seedId).statement,
  }));
}

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
    return (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  }
  const baseUrl = ACTIVE_PROVIDER === 'venice'
    ? `${process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1'}`
    : 'https://api.openai.com/v1';
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env[PROVIDERS[ACTIVE_PROVIDER].keyEnv]}`,
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
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * OSS-model JSON repair (observed llama-3.3-70b failures): unquoted [C-NNN]
 * citation tokens, literal newlines/tabs inside strings, trailing commas.
 * Walks strings character-wise so repairs never touch structural JSON.
 */
function repairJson(raw) {
  let out = '';
  let seg = ''; // current structural (non-string) run
  let inStr = false;
  let esc = false;
  const flushSeg = () => {
    // These repairs apply ONLY to structural runs — never inside strings
    // (answers legitimately contain [C-NNN] markers in prose).
    // Quote bare marker tokens inside arrays: [C-011, C-016] → ["C-011","C-016"]
    seg = seg.replace(/([[,]\s*)(C-\d{3})(?=\s*[,\]])/g, '$1"$2"');
    // Strip trailing commas before a closing bracket/brace.
    seg = seg.replace(/,\s*([\]}])/g, '$1');
    out += seg;
    seg = '';
  };
  for (const ch of raw) {
    if (inStr) {
      if (esc) { out += ch; esc = false; continue; }
      if (ch === '\\') { out += ch; esc = true; continue; }
      if (ch === '"') { inStr = false; out += ch; continue; }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') continue;
      if (ch === '\t') { out += '\\t'; continue; }
      out += ch;
      continue;
    }
    if (ch === '"') { flushSeg(); inStr = true; out += ch; continue; }
    seg += ch;
  }
  flushSeg();
  return out;
}

function parseJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : text.trim();
  // Some OSS models prepend prose — recover the outermost JSON object.
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const sliced = start > -1 && end > start ? raw.slice(start, end + 1) : raw;
  try {
    return JSON.parse(sliced);
  } catch {
    return JSON.parse(repairJson(sliced));
  }
}

const ANSWER_SYSTEM =
  'You are an exacting document analyst. Answer strictly from the provided document. ' +
  'If the document does not contain the answer, the answer field must be exactly "NOT DERIVABLE". ' +
  'Support each answer with the invariant markers it relies on, listed in the citations array. ' +
  'STRICT OUTPUT RULES: respond with ONLY one valid JSON object, shape ' +
  '{"answers":[{"q":1,"answer":"...","citations":["C-011","C-016"]}, ...]} covering every question. ' +
  'Every citation is a QUOTED string like "C-011" — never bare, never wrapped in square brackets. ' +
  'Each answer value is ONE line of at most 60 words — no literal newlines inside strings, escape any double quotes.';

async function answerPass(label, documentText) {
  const user = [
    `DOCUMENT (${label}):`,
    documentText,
    '',
    'QUESTIONS:',
    ...QUESTIONS.map((qq) => `${qq.q}. ${qq.text}`),
  ].join('\n');
  // OSS judges intermittently emit malformed JSON even when instructed —
  // one retry with a harder reminder before giving up.
  let parsed;
  try {
    parsed = parseJson(await callChat(ANSWER_SYSTEM, user, 2500));
  } catch {
    console.log(' (malformed JSON — retrying once)');
    parsed = parseJson(
      await callChat(
        `${ANSWER_SYSTEM} Your previous attempt produced invalid JSON. Output MUST parse with JSON.parse — quoted citation strings, one-line answers, no trailing commas.`,
        user,
        2500,
      ),
    );
  }
  const byQ = new Map((parsed.answers ?? []).map((a) => [Number(a.q), a]));
  return QUESTIONS.map((qq) => {
    const a = byQ.get(qq.q) ?? { answer: 'NO ANSWER RETURNED', citations: [] };
    return {
      q: qq.q,
      answer: String(a.answer ?? ''),
      citations: Array.isArray(a.citations) ? a.citations.map(String) : [],
    };
  });
}

function isNotDerivable(answer) {
  return /not\s+derivable/i.test(answer);
}

async function judgeQuestion(question, collection, answersByArtifact) {
  const expectedStatements = question.expect
    .map((m) => collection.find((c) => c.marker === m))
    .filter(Boolean)
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
    question.probe
      ? 'This is a hallucination probe: the ONLY correct behaviour is NOT DERIVABLE. Any substantive answer is a hallucination.'
      : `GROUND-TRUTH INVARIANTS FOR THIS QUESTION:\n${expectedStatements.join('\n')}`,
    '',
    'FULL COLLECTION (for hallucination tracing):',
    ...collection.map((c) => `[${c.marker}] ${c.statement}`),
    '',
    'DOCUMENT ANSWERS:',
    ...Object.entries(answersByArtifact).map(([docId, a]) => `--- ${docId} ---\n${a.answer}`),
  ].join('\n');
  return callJsonWithRetry(system, user, 500);
}

/** parseJson with one strict-reminder retry — OSS judges intermittently emit malformed JSON. */
async function callJsonWithRetry(system, user, maxTokens) {
  try {
    return parseJson(await callChat(system, user, maxTokens));
  } catch {
    return parseJson(
      await callChat(
        `${system} Your previous attempt produced invalid JSON. Output MUST parse with JSON.parse — no trailing commas, no bare tokens, no literal newlines inside strings.`,
        user,
        maxTokens,
      ),
    );
  }
}

async function judgeCoherence(label, answers) {
  const system =
    'You are an exacting evaluator. You receive one document\'s answers to 15 questions. Judge whether any answer CONTRADICTS ' +
    'another answer from the same document. Respond ONLY with JSON: {"coherence": 0|1|2, "notes": "one sentence"} ' +
    'where 2 = no contradictions, 1 = tension short of contradiction, 0 = at least one contradiction.';
  const user = answers.map((a) => `Q${a.q}: ${a.answer}`).join('\n');
  return callJsonWithRetry(system, user, 300);
}

function scoreExplainability(question, answerRow, judgedCorrect) {
  // Rubric: 2 = correct + cites an expected marker; 1 = correct, wrong/missing
  // citation; 0 = unexplained/incorrect. Probes and NOT DERIVABLE rows are
  // excluded (scored under Hallucination instead).
  if (question.probe || isNotDerivable(answerRow.answer)) return null;
  if (!judgedCorrect) return 0;
  const citedExpected = answerRow.citations.some((c) =>
    question.expect.includes(c.replace(/[[\]]/g, '')),
  );
  return citedExpected ? 2 : 1;
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
  const artifacts = ARTIFACTS.map((a) => ({
    ...a,
    text: readFileSync(join(EXP_DIR, a.file), 'utf-8'),
  }));

  console.log('EXP-001 independent-judge evaluation');
  console.log(`evaluator=${ACTIVE_PROVIDER}/${ACTIVE_MODEL} temperature=0 artifacts=${artifacts.length} questions=${QUESTIONS.length}`);
  if (ACTIVE_PROVIDER === 'anthropic') {
    console.log('⚠ independence note: the artifacts were authored by an Anthropic model — prefer --provider venice|openai for a genuinely independent judge.');
  }

  if (DRY_RUN) {
    const calls = artifacts.length + 1 + QUESTIONS.length + artifacts.length + 1;
    console.log(`\n--dry-run: would run ${artifacts.length} per-artifact passes + 1 combined pass + ${QUESTIONS.length} question judges + ${artifacts.length + 1} coherence judges = ${calls} API calls.`);
    return;
  }

  // 1+2. Answer passes.
  const answersByArtifact = {};
  for (const artifact of artifacts) {
    process.stdout.write(`answer pass: ${artifact.id} …`);
    answersByArtifact[artifact.id] = await answerPass(artifact.id, artifact.text);
    console.log(' done');
  }
  process.stdout.write('answer pass: combined …');
  const combinedText = artifacts.map((a) => `===== ${a.id} =====\n${a.text}`).join('\n\n');
  answersByArtifact.combined = await answerPass('combined (all artifacts)', combinedText);
  console.log(' done');

  // 4a. Per-question judge (consistency + correctness + hallucination).
  const questionScores = [];
  for (const question of QUESTIONS) {
    process.stdout.write(`judge Q${question.q} …`);
    const rows = Object.fromEntries(
      Object.entries(answersByArtifact).map(([docId, answers]) => [
        docId,
        answers.find((a) => a.q === question.q),
      ]),
    );
    const judged = await judgeQuestion(question, collection, rows);
    console.log(' done');

    const perDoc = {};
    let hallucinations = 0;
    for (const [docId, row] of Object.entries(rows)) {
      const verdict = judged.perDoc?.[docId] ?? {};
      // Probe hallucination is mechanical: any non-NOT-DERIVABLE answer.
      const hallucination = question.probe
        ? !isNotDerivable(row.answer)
        : Boolean(verdict.hallucination);
      if (hallucination) hallucinations += 1;
      perDoc[docId] = {
        answer: row.answer,
        citations: row.citations,
        notDerivable: isNotDerivable(row.answer),
        correct: question.probe ? isNotDerivable(row.answer) : Boolean(verdict.correct),
        hallucination,
        explainability: scoreExplainability(question, row, Boolean(verdict.correct)),
      };
    }
    questionScores.push({
      q: question.q,
      probe: Boolean(question.probe),
      expected: question.expect,
      consistency: question.probe ? null : Number(judged.consistency ?? 0),
      hallucinations,
      perDoc,
    });
  }

  // 4b. Coherence per artifact set.
  const coherence = {};
  for (const [docId, answers] of Object.entries(answersByArtifact)) {
    process.stdout.write(`coherence: ${docId} …`);
    coherence[docId] = await judgeCoherence(docId, answers);
    console.log(' done');
  }

  // Aggregates vs protocol targets.
  const derivableQs = questionScores.filter((s) => !s.probe);
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const consistencyAvg = avg(derivableQs.map((s) => s.consistency));
  const explainScores = derivableQs.flatMap((s) =>
    Object.values(s.perDoc).map((d) => d.explainability).filter((v) => v !== null),
  );
  const explainAvg = avg(explainScores);
  const hallucinationTotal = questionScores.reduce((a, s) => a + s.hallucinations, 0);
  const coherenceAvg = avg(Object.values(coherence).map((c) => Number(c.coherence ?? 0)));

  // Constitutional restraint (CFS-008 §2, ratified 2026-07-04): the proportion
  // of probe-answer pairs that correctly return NOT DERIVABLE. Distinct from
  // hallucination — restraint measures what the system refuses to invent.
  const probeQs = questionScores.filter((s) => s.probe);
  const probePairs = probeQs.flatMap((s) => Object.values(s.perDoc));
  const restraint = probePairs.length
    ? probePairs.filter((d) => d.notDerivable).length / probePairs.length
    : null;

  // Flywheel-eligible: derivable questions answered consistently (2) with no
  // hallucination anywhere → validation events for their expected invariants.
  // NOT applied here — recordConsequence belongs to the Invariant Service.
  const flywheelEligible = [
    ...new Set(
      derivableQs
        .filter((s) => s.consistency === 2 && s.hallucinations === 0)
        .flatMap((s) => s.expected)
        .map((m) => collection.find((c) => c.marker === m))
        .filter(Boolean)
        .map((c) => `${c.seedId} (${c.marker})`),
    ),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = join(EXP_DIR, `evaluation-results-${stamp}.json`);
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        evaluator: { provider: ACTIVE_PROVIDER, model: ACTIVE_MODEL },
        ranAt: new Date().toISOString(),
        note: 'Machine-assisted scoring; protocol assigns final rubric authority to a human scorer — review perDoc answers before ratifying.',
        artifactsEvaluated: ARTIFACTS.map((a) => a.id),
        artifactsPending: ['video (EXP-002 production pending)'],
        questionScores,
        coherence,
        aggregates: { consistencyAvg, explainAvg, hallucinationTotal, coherenceAvg, restraint },
        flywheelEligible,
      },
      null,
      2,
    ),
  );

  // Summary.
  console.log('\n| Metric | Result | Target | Met |');
  console.log('|---|---|---|---|');
  console.log(`| Consistency (avg, Q1–12) | ${consistencyAvg?.toFixed(2)} | ≥ 1.8 | ${consistencyAvg >= 1.8 ? '✅' : '❌'} |`);
  console.log(`| Explainability (avg) | ${explainAvg?.toFixed(2)} | ≥ 1.6 | ${explainAvg >= 1.6 ? '✅' : '❌'} |`);
  console.log(`| Hallucination (total) | ${hallucinationTotal} | 0 | ${hallucinationTotal === 0 ? '✅' : '❌'} |`);
  console.log(`| Coherence (avg) | ${coherenceAvg?.toFixed(2)} | 2.0 | ${coherenceAvg === 2 ? '✅' : '❌'} |`);
  console.log(`| Constitutional restraint (probes) | ${restraint === null ? 'n/a' : `${Math.round(restraint * 100)}%`} | 100% | ${restraint === 1 ? '✅' : '❌'} |`);

  console.log('\nPer-question consistency (Q1–12):');
  for (const s of derivableQs) {
    const derivableIn = Object.entries(s.perDoc).filter(([, d]) => !d.notDerivable).map(([id]) => id);
    console.log(`  Q${s.q}: consistency=${s.consistency} hallucinations=${s.hallucinations} derivable in: ${derivableIn.join(', ') || 'none'}`);
  }
  console.log('\nProbes (Q13–15, correct = NOT DERIVABLE everywhere):');
  for (const s of questionScores.filter((x) => x.probe)) {
    const failed = Object.entries(s.perDoc).filter(([, d]) => d.hallucination).map(([id]) => id);
    console.log(`  Q${s.q}: ${failed.length === 0 ? 'clean' : `HALLUCINATED in: ${failed.join(', ')}`}`);
  }

  console.log(`\nFlywheel-eligible invariants (validation events to apply via the Invariant Service):`);
  console.log(flywheelEligible.length ? flywheelEligible.map((s) => `  - ${s}`).join('\n') : '  (none)');
  console.log(`\nRaw results: ${outPath}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
