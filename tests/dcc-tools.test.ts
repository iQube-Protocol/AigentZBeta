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
];
for (const cmd of WHITELISTED) {
  const r = parseTerminalCommand(cmd);
  ok(`whitelisted parses: ${cmd}`, r.ok === true);
}

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

console.log(`dcc-tools: all ${checks} checks passed`);
