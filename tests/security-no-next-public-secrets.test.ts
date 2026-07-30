/**
 * Canary: no server-only secret may ever be read through a NEXT_PUBLIC_
 * variable name, and no debug endpoint may return a secret's raw value or a
 * fragment of one.
 *
 * WHY THIS EXISTS (2026-07-30 security incident, see
 * codexes/packs/agentiq/updates/2026-07-30_security-incident-agent-key-and-service-role-exposure.md).
 * `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` and, confirmed by the operator,
 * `NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET` were both actually SET in
 * Amplify with real values. Next.js inlines any `NEXT_PUBLIC_*` value
 * referenced anywhere in application source into the client bundle at
 * build time -- so a fallback read of a NEXT_PUBLIC_-prefixed name for a
 * server-only credential is not a naming inconvenience, it is a live public
 * exposure path. The fix was removing every such reference; THIS canary is
 * what stops it from being silently reintroduced.
 *
 * A structural source-scan is the right shape here, not a build-output
 * check: if zero files in the application source ever read
 * `process.env.NEXT_PUBLIC_<secret>`, Next.js's build-time replacement has
 * nothing to inline into ANY bundle -- client or server -- which is a
 * stronger and cheaper guarantee than inspecting one particular build's
 * output after the fact.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const REPO = join(__dirname, '..');

const SCAN_ROOTS = ['app', 'services', 'components', 'scripts', 'packages', 'apps'];
const SKIP_DIR_NAMES = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.turbo']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function listSourceFiles(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) listSourceFiles(full, out);
    else if (SOURCE_EXTENSIONS.has(extname(entry))) out.push(full);
  }
  return out;
}

const ALL_SOURCE_FILES = SCAN_ROOTS.flatMap((root) => listSourceFiles(join(REPO, root)));

// The exact names confirmed or found this session to be dangerous: a
// server-only secret with a NEXT_PUBLIC_-prefixed twin actually referenced
// somewhere as a fallback. New entries should be added here the moment a
// new one is found -- this list is the enforcement surface, not a policy
// statement, so an incomplete list is a real gap, not a rounding error.
const FORBIDDEN_NEXT_PUBLIC_SECRET_NAMES = [
  'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_AGENT_KEY_ENCRYPTION_SECRET',
  'NEXT_PUBLIC_CORE_SUPABASE_SERVICE_ROLE_KEY',
];

describe('security — no NEXT_PUBLIC_-prefixed server secret may be read as a value', () => {
  it('scanned a non-trivial number of source files (the scan itself is not silently empty)', () => {
    expect(ALL_SOURCE_FILES.length).toBeGreaterThan(500);
  });

  for (const name of FORBIDDEN_NEXT_PUBLIC_SECRET_NAMES) {
    it(`no file reads process.env.${name} as an actual value (presence-only booleans are fine)`, () => {
      const offenders: string[] = [];
      for (const file of ALL_SOURCE_FILES) {
        const src = readFileSync(file, 'utf8');
        if (!src.includes(name)) continue;
        // A boolean presence check (`!!process.env.NAME`, `has(process.env.NAME)`,
        // a `present:` field, or negation `!envCheck.NAME`) never leaks a value.
        // Anything else that references the name is a candidate for an actual
        // value read and fails the canary until it is re-examined by hand.
        const lines = src.split('\n').filter((l) => l.includes(name));
        // Safe shapes: a boolean coercion (`!!process.env.NAME`), a
        // presence-only field (`present: ...`), a negation check
        // (`!envCheck.NAME`), or a comment recording the removal. Anything
        // else that mentions the name is treated as a potential value read.
        const isSafeLine = (line: string) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) return true;
          if (line.includes('!!')) return true;
          if (/present:/.test(line)) return true;
          if (new RegExp(`!\\s*[\\w.]*${name}`).test(line)) return true;
          return false;
        };
        const allSafe = lines.every(isSafeLine);
        if (!allSafe) offenders.push(file.replace(REPO + '/', ''));
      }
      expect(offenders, `files with a non-boolean reference to ${name}`).toEqual([]);
    });
  }
});

describe('security — debug endpoints never return a secret value or fragment', () => {
  const debugRouteFiles = [
    'app/api/admin/debug/env-check/route.ts',
    'app/api/admin/debug/check-env/route.ts',
    'app/api/admin/debug/supabase-conflict/route.ts',
    'app/api/dev-command-center/_lib/diagnostics.ts',
  ];

  it('none of these files call .substring(/.slice( on a secret-named env var', () => {
    const SECRET_NAME_FRAGMENT = /(SERVICE_ROLE_KEY|ENCRYPTION_SECRET|PRIVATE_KEY|IDENTITY_PEM|MASTER_KEY|API_KEY)/;
    const offenders: string[] = [];
    for (const rel of debugRouteFiles) {
      const full = join(REPO, rel);
      const src = readFileSync(full, 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (!/\.substring\(|\.slice\(/.test(line)) return;
        if (!SECRET_NAME_FRAGMENT.test(line)) return;
        offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders, 'lines that slice/substring a secret-named value').toEqual([]);
  });

  it('none of these files contain a literal hex/base64/JWT-shaped secret fragment', () => {
    // The 2026-07-30 incident's worst instance hardcoded literal prefixes
    // ('e35c7d79651daadd', 'eyJhbGciOiJIUzI1NiIs') in an "expected" block.
    // A bare high-entropy literal assigned to a *_starts/_prefix-shaped key
    // is exactly that pattern recurring.
    const offenders: string[] = [];
    for (const rel of debugRouteFiles) {
      const full = join(REPO, rel);
      const src = readFileSync(full, 'utf8');
      if (/_starts\s*:\s*['"][0-9a-zA-Z._-]{12,}['"]/.test(src)) offenders.push(rel);
      if (/eyJhbGciOiJ/.test(src)) offenders.push(rel);
    }
    expect(offenders, 'files containing a literal secret-fragment pattern').toEqual([]);
  });
});
