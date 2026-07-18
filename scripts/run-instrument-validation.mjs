#!/usr/bin/env node
/**
 * run-instrument-validation.mjs — Stage-0 instrument validation for the
 * Invariant Resolution Engine (IRE) and Invariant Projection Engine (IPE),
 * BEFORE they are used in the live science experiments (EXP-P1/P2/P3).
 *
 *   IRV-001 — Invariant Resolution Validation. Compares the IRE's resolved
 *             field against a Synthetic Expert Baseline (SEB): several LLM
 *             expert personas independently name the governing properties of a
 *             task (never using the word "invariant"), a consensus set is
 *             formed, and a judge maps SEB properties <-> IRE invariants to
 *             score coverage / compression / novelty. Also scores IRE
 *             STABILITY (Jaccard of resolved seed-id sets across repeated runs).
 *   IPV-001 — Invariant Projection Validation. Scores IPE reproducibility:
 *             does the projection (standing vs coordinate dimension weights,
 *             meanAbsDelta, diverges) come out identical across repeated runs?
 *
 * HONEST FRAMING (Aletheon, 2026-07-17): SEB is NOT a Delphi study — the
 * personas are correlated models, not independent human experts. This is
 * ENGINEERING calibration of the instrument, not scientific validation. It
 * scores the ENGINES, not LLM task performance.
 *
 * IRE/IPE are read via the PUBLIC route POST {host}/api/public/irl/resolve
 * (persona-free, no credentials). Invariant statements are read via the PUBLIC
 * route GET {host}/api/public/irl/invariants. The SEB personas + the overlap
 * judge use one LLM provider (your key).
 *
 * Requirements:
 *   --host=https://dev-beta.aigentz.me        (the IRE/IPE + invariants routes)
 *   one provider key: VENICE_API_KEY | OPENAI_API_KEY | ANTHROPIC_API_KEY
 *     (default provider order venice -> openai -> anthropic; override --provider)
 *
 * Usage:
 *   node scripts/run-instrument-validation.mjs --host=https://dev-beta.aigentz.me --dry-run
 *   node scripts/run-instrument-validation.mjs --host=... --exp irv --limit 3 --personas 3
 *   node scripts/run-instrument-validation.mjs --host=... --exp both --reps 3
 *
 * Flags: --exp irv|ipv|both (default both) · --reps N (IRE/IPE repeats, default 3)
 *   · --limit N (first N intents) · --personas N (cap personas/intent)
 *   · --provider venice|openai|anthropic · --intents <path> · --out <dir> · --dry-run
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');

// ── args ──────────────────────────────────────────────────────────────────
const ARGS = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
function flag(name, def) { const i = process.argv.indexOf(`--${name}`); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : (ARGS[name] ?? def); }
const HOST = String(ARGS.host || '').replace(/\/$/, '');
const EXP = String(flag('exp', 'both'));
const REPS = Number(flag('reps', 3));
const LIMIT = ARGS.limit ? Number(flag('limit', Infinity)) : Infinity;
const PERSONA_CAP = ARGS.personas ? Number(flag('personas', 99)) : 99;
const DRY = !!ARGS['dry-run'];
const INTENTS_PATH = String(flag('intents', 'services/experiments/instrument-validation-intents.json'));
const OUT_DIR = String(flag('out', 'codexes/packs/irl/foundation/experiments/irv-001-invariant-resolution-validation/results'));
if (!HOST) { console.error('Missing --host (e.g. --host=https://dev-beta.aigentz.me)'); process.exit(1); }

// ── provider (mirrors scripts/evaluate-exp001.mjs) ─────────────────────────
const PROVIDERS = {
  anthropic: { keyEnv: 'ANTHROPIC_API_KEY', model: () => process.env.ANTHROPIC_DRAFT_MODEL || 'claude-sonnet-4-6' },
  openai: { keyEnv: 'OPENAI_API_KEY', model: () => process.env.OPENAI_DRAFT_MODEL || 'gpt-4o-mini' },
  venice: { keyEnv: 'VENICE_API_KEY', model: () => process.env.VENICE_DRAFT_MODEL || 'llama-3.3-70b' },
};
let ACTIVE_PROVIDER = 'venice';
function resolveProvider() {
  const forced = flag('provider', null);
  if (forced) {
    if (!PROVIDERS[forced]) throw new Error(`unknown --provider '${forced}'`);
    // In --dry-run no API call is made, so a missing key is fine — let the
    // operator validate the openai/anthropic path without a key present.
    if (!DRY && !process.env[PROVIDERS[forced].keyEnv]) throw new Error(`--provider ${forced} but ${PROVIDERS[forced].keyEnv} not set`);
    return forced;
  }
  for (const name of ['venice', 'openai', 'anthropic']) if (process.env[PROVIDERS[name].keyEnv]) return name;
  if (DRY) return 'venice';
  throw new Error('no provider key — set VENICE_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY');
}
let ACTIVE_MODEL = '';
let TOKENS = 0;
async function callModel(system, user, maxTokens = 1200) {
  if (DRY) return '{"properties":[]}';
  if (ACTIVE_PROVIDER === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: ACTIVE_MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const d = await res.json();
    TOKENS += (d.usage?.input_tokens || 0) + (d.usage?.output_tokens || 0);
    return (d.content || []).map((b) => b.text || '').join('');
  }
  const baseUrl = ACTIVE_PROVIDER === 'venice' ? (process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1') : 'https://api.openai.com/v1';
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env[PROVIDERS[ACTIVE_PROVIDER].keyEnv]}` },
    body: JSON.stringify({ model: ACTIVE_MODEL, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`${ACTIVE_PROVIDER} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const d = await res.json();
  TOKENS += d.usage?.total_tokens || 0;
  return d.choices?.[0]?.message?.content || '';
}
function parseJson(text) {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const start = body.indexOf('{'); const end = body.lastIndexOf('}');
  if (start < 0 || end < 0) return null;
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return null; }
}
const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); const inter = [...A].filter((x) => B.has(x)).length; const uni = new Set([...A, ...B]).size; return uni === 0 ? 1 : inter / uni; };

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${url} -> ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}
async function ireResolve(intent) {
  return fetchJson(`${HOST}/api/public/irl/resolve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intent }) });
}

async function main() {
  const cfg = JSON.parse(readFileSync(join(REPO, INTENTS_PATH), 'utf8'));
  let intents = cfg.intents.slice(0, Number.isFinite(LIMIT) ? LIMIT : cfg.intents.length);
  ACTIVE_PROVIDER = resolveProvider();
  ACTIVE_MODEL = PROVIDERS[ACTIVE_PROVIDER].model();
  console.log(`[iv] host=${HOST} · exp=${EXP} · reps=${REPS} · intents=${intents.length} · provider=${ACTIVE_PROVIDER}/${ACTIVE_MODEL}${DRY ? ' · DRY-RUN' : ''}`);

  // seedId -> statement map (public, no creds)
  let stmtBySeed = {};
  if (!DRY) {
    const inv = await fetchJson(`${HOST}/api/public/irl/invariants?limit=500`);
    for (const r of inv.invariants || []) if (r.seedId) stmtBySeed[r.seedId] = r.statement;
    console.log(`[iv] loaded ${Object.keys(stmtBySeed).length} invariant statements`);
  }

  const results = [];
  for (const it of intents) {
    const row = { id: it.id, domain: it.domain, intent: it.intent };
    // ── IRE resolve (reps) → stability ──
    let ireRuns = [];
    if (!DRY) { for (let r = 0; r < REPS; r++) ireRuns.push(await ireResolve(it.intent)); }
    const seedSets = ireRuns.map((f) => (f.coordinates || []).map((c) => c.seedId).filter(Boolean));
    const ireField = ireRuns[0] || { coordinates: [], ipeProjection: {} };
    const ireSeeds = seedSets[0] || [];
    const stabilityPairs = [];
    for (let i = 0; i < seedSets.length; i++) for (let j = i + 1; j < seedSets.length; j++) stabilityPairs.push(jaccard(seedSets[i], seedSets[j]));
    const ireStability = stabilityPairs.length ? stabilityPairs.reduce((a, b) => a + b, 0) / stabilityPairs.length : 1;

    if (EXP === 'irv' || EXP === 'both') {
      // ── SEB: personas extract governing properties (never "invariant") ──
      const roles = (it.personas || []).slice(0, PERSONA_CAP);
      const perExpert = [];
      for (const role of roles) {
        const sys = `You are a ${role}. ${cfg.seb.extraction_instruction}`;
        const out = DRY ? '{"properties":[]}' : await callModel(sys, `Task: ${it.intent}`);
        const p = parseJson(out);
        if (p?.properties) perExpert.push({ role, properties: p.properties });
      }
      // consensus
      const consIn = JSON.stringify(perExpert.map((e) => ({ role: e.role, properties: e.properties })));
      const consOut = DRY ? '{"consensus":[]}' : await callModel(cfg.seb.consensus_instruction, consIn, 1500);
      const consensus = parseJson(consOut)?.consensus || [];
      // ── overlap judge: SEB consensus <-> IRE invariants ──
      const ireStatements = ireSeeds.map((s) => stmtBySeed[s]).filter(Boolean);
      const judgeSys = 'You compare two lists describing what governs a task. List E = experts\' consensus properties. List I = the engine\'s selected statements. Map them: a MATCH is an expert property whose meaning is captured by some engine statement. Return JSON {"matched":[{"expert":"...","engine":"..."}],"omitted":["expert property with no engine match"],"discovered":["engine statement with no expert match"]}. Judge meaning, not wording.';
      const judgeUser = `E = ${JSON.stringify(consensus.map((c) => c.property || c))}\nI = ${JSON.stringify(ireStatements)}`;
      const judged = DRY ? { matched: [], omitted: [], discovered: [] } : (parseJson(await callModel(judgeSys, judgeUser, 1500)) || { matched: [], omitted: [], discovered: [] });
      const nSeb = consensus.length || (judged.matched.length + judged.omitted.length);
      const nIre = ireStatements.length || (judged.matched.length + judged.discovered.length);
      row.irv = {
        sebExperts: perExpert.length,
        sebConsensusCount: consensus.length,
        ireInvariantCount: ireStatements.length,
        matched: judged.matched.length,
        omitted: judged.omitted.length,          // expert concerns IRE missed
        discovered: judged.discovered.length,     // IRE-only (potential structural discovery)
        coverage: nSeb ? judged.matched.length / nSeb : null,       // fraction of expert properties IRE covers
        compression: nSeb ? nIre / nSeb : null,                     // <1 => IRE selects fewer than experts
        novelty: nIre ? judged.discovered.length / nIre : null,     // fraction of IRE selections experts didn't name
        ireStability,
        detail: DRY ? undefined : { consensus, ireStatements, judged },
      };
    }

    if (EXP === 'ipv' || EXP === 'both') {
      const projs = ireRuns.map((f) => f.ipeProjection || {});
      const meanDeltas = projs.map((p) => p.meanAbsDelta).filter((x) => typeof x === 'number');
      const divergeVals = projs.map((p) => !!p.diverges);
      const stdKeysStable = projs.every((p) => JSON.stringify(p.standing) === JSON.stringify(projs[0]?.standing));
      const coordKeysStable = projs.every((p) => JSON.stringify(p.coordinates) === JSON.stringify(projs[0]?.coordinates));
      const meanDeltaVar = meanDeltas.length > 1 ? (() => { const m = meanDeltas.reduce((a, b) => a + b, 0) / meanDeltas.length; return meanDeltas.reduce((a, b) => a + (b - m) ** 2, 0) / meanDeltas.length; })() : 0;
      row.ipv = {
        reps: projs.length,
        standingWeightsReproducible: stdKeysStable,
        coordinateWeightsReproducible: coordKeysStable,
        meanAbsDelta: meanDeltas[0] ?? null,
        meanAbsDeltaVariance: meanDeltaVar,
        divergesConsistent: divergeVals.every((v) => v === divergeVals[0]),
        ireSeedSetStability: ireStability,
      };
    }
    results.push(row);
    process.stdout.write(`\r[iv] ${results.length}/${intents.length} intents processed   `);
  }
  process.stdout.write('\n');

  // ── aggregate ──
  const irv = results.map((r) => r.irv).filter(Boolean);
  const ipv = results.map((r) => r.ipv).filter(Boolean);
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const summary = {
    irv: irv.length ? {
      meanCoverage: avg(irv.map((r) => r.coverage).filter((x) => x != null)),
      meanCompression: avg(irv.map((r) => r.compression).filter((x) => x != null)),
      meanNovelty: avg(irv.map((r) => r.novelty).filter((x) => x != null)),
      meanIreStability: avg(irv.map((r) => r.ireStability)),
      intents: irv.length,
    } : null,
    ipv: ipv.length ? {
      standingReproducibleRate: avg(ipv.map((r) => (r.standingWeightsReproducible ? 1 : 0))),
      coordinateReproducibleRate: avg(ipv.map((r) => (r.coordinateWeightsReproducible ? 1 : 0))),
      meanIreSeedStability: avg(ipv.map((r) => r.ireSeedSetStability)),
      intents: ipv.length,
    } : null,
  };
  console.log('\n[iv] SUMMARY', JSON.stringify(summary, null, 2));

  if (DRY) { console.log('\n[iv] DRY-RUN — no API calls, no files written.'); return; }
  const outDir = join(REPO, OUT_DIR);
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const payload = { experiment: EXP === 'ipv' ? 'IPV-001' : 'IRV-001', kind: 'instrument-validation', framing: 'Synthetic Expert Baseline (SEB) — engineering calibration, NOT a Delphi study; personas are correlated models, not independent experts.', host: HOST, provider: ACTIVE_PROVIDER, model: ACTIVE_MODEL, reps: REPS, tokens: TOKENS, generatedAt: new Date().toISOString(), summary, results };
  const json = JSON.stringify(payload, null, 2);
  const hash = createHash('sha256').update(json).digest('hex');
  const base = `${EXP}-results-${stamp}`;
  writeFileSync(join(outDir, `${base}.json`), json);
  writeFileSync(join(outDir, `${base}.manifest.json`), JSON.stringify({ file: `${base}.json`, sha256: hash, experiment: payload.experiment, provider: ACTIVE_PROVIDER, model: ACTIVE_MODEL, intents: results.length, reps: REPS, tokens: TOKENS, generatedAt: payload.generatedAt }, null, 2) + '\n');
  console.log(`[iv] wrote ${base}.json  (sha256 ${hash.slice(0, 16)}…)  ${TOKENS} tokens`);
  console.log('[iv] next: review coverage/compression/novelty + stability; iron out any pathological intents before the live experiments.');
}
main().catch((e) => { console.error('[iv] error:', e); process.exit(1); });
