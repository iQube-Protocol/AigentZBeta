#!/usr/bin/env node
/**
 * check-persona-spine.mjs — mechanical gate for the PERSONA SPINE client-fetch
 * rule (CLAUDE.md, PARAMOUNT). Identity is the foundation of the whole
 * protocol; a persona-unaware client fetch silently reads the WRONG persona's
 * state. Prose alone did not stop it (2026-07-20 AccessionProgressBar
 * incident), so this runs in the Amplify build and FAILS the deploy on any
 * NEW violation.
 *
 * Forbidden persona-UNAWARE transports in client code (they attach the Bearer
 * but carry no persona selection, so getActivePersona resolves a fallback
 * persona instead of the caller's active one):
 *   - `authedFetchHeaders`  (from utils/supabaseBrowser)
 *   - `getSupabaseAccessToken` used to hand-roll an Authorization header
 * The ONLY sanctioned client transport for spine endpoints is `personaFetch`
 * (utils/personaSpine), which carries the persona hint.
 *
 * Ratchet, not a big-bang: `persona-spine-baseline.json` lists the files that
 * were ALREADY violating when the gate was introduced. Those are allowed (and
 * tracked as debt); the gate fails only when a file NOT in the baseline uses a
 * forbidden pattern. As each baselined file is migrated to personaFetch,
 * delete it from the baseline — the ratchet only tightens.
 *
 * Detection strips comments so a mention of the pattern in a comment (e.g. a
 * "do not use authedFetchHeaders" note) is never a false positive.
 *
 * Run: `node scripts/check-persona-spine.mjs`  (exit 1 on new violation)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Client surfaces to scan. Server code (app/api/**) is exempt — the rule is
// about CLIENT→spine calls.
const SCAN_DIRS = ['components', 'app', 'hooks'];
const SCAN_EXTS = ['.ts', '.tsx'];

// The utilities that DEFINE these primitives — allowed to reference them.
const DEFINITION_FILES = new Set([
  'utils/supabaseBrowser.ts',
  'utils/personaSpine.tsx',
]);

// Forbidden persona-unaware transports (identifier-boundary matched).
const FORBIDDEN = [
  { id: 'authedFetchHeaders', re: /\bauthedFetchHeaders\b/ },
  { id: 'getSupabaseAccessToken', re: /\bgetSupabaseAccessToken\b/ },
];

const BASELINE_PATH = join(ROOT, 'scripts', 'persona-spine-baseline.json');
let baseline = [];
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).knownViolations ?? [];
} catch {
  /* no baseline file → every violation is new */
}
const baselineSet = new Set(baseline);

/** Strip // line and /* block *​/ comments so comment mentions never trip the gate. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (SCAN_EXTS.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

const files = [];
for (const d of SCAN_DIRS) walk(join(ROOT, d), files);

const newViolations = [];
for (const full of files) {
  const rel = relative(ROOT, full).split('\\').join('/');
  if (DEFINITION_FILES.has(rel)) continue;
  const code = stripComments(readFileSync(full, 'utf8'));
  const hits = FORBIDDEN.filter((f) => f.re.test(code)).map((f) => f.id);
  if (hits.length === 0) continue;
  if (baselineSet.has(rel)) continue; // known debt — allowed, tracked
  newViolations.push({ file: rel, patterns: hits });
}

if (newViolations.length > 0) {
  console.error('\n✖ PERSONA SPINE violation — new persona-unaware client fetch detected.\n');
  console.error('  Identity is resolved ONE way, everywhere: personaFetch (utils/personaSpine).');
  console.error('  These files use a persona-UNAWARE transport on a client surface:\n');
  for (const v of newViolations) {
    console.error(`    ${v.file}  →  ${v.patterns.join(', ')}`);
  }
  console.error('\n  Fix: replace with personaFetch("/api/…", { personaIdHint }).');
  console.error('  See CLAUDE.md → "Client-side spine fetches". Do NOT add to the baseline to pass.\n');
  process.exit(1);
}

// Also flag baseline entries that no longer violate — keep the ratchet honest
// (a stale baseline hides that the debt was paid). Non-fatal: just advise.
const stillViolating = new Set();
for (const full of files) {
  const rel = relative(ROOT, full).split('\\').join('/');
  const code = stripComments(readFileSync(full, 'utf8'));
  if (FORBIDDEN.some((f) => f.re.test(code))) stillViolating.add(rel);
}
const paidOff = baseline.filter((b) => !stillViolating.has(b));
if (paidOff.length > 0) {
  console.log('ℹ persona-spine baseline can be trimmed (these no longer violate):');
  for (const p of paidOff) console.log(`    - ${p}`);
}

console.log(`✓ persona-spine gate: no new violations (${baseline.length} baselined debt file(s) remaining).`);
