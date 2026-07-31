/**
 * Every hook a client component calls must actually be imported.
 *
 * WHY A TEST FOR SOMETHING THE COMPILER SHOULD CATCH: this repo's `tsc` does
 * not typecheck. `tsconfig.json` sets `"ignoreDeprecations": "6.0"`, which is
 * invalid for TypeScript 5.x, and `typeRoots` includes the project's own
 * `./types` directory so every subdirectory there is read as a broken `@types`
 * package (`TS2688: Cannot find type definition file for 'iqube'`). Either is
 * fatal at config parse, so `tsc --noEmit` exits reporting only those two and
 * checks **no files at all** — while still exiting 0.
 *
 * That is how a `useMemo` call shipped into `CodexCopilotLayer` without its
 * import (2026-07-26) and took the Companion down with "useMemo is not
 * defined". Until the config is fixed — it currently surfaces ~579
 * pre-existing errors, so it is the operator's call — this canary covers the
 * one defect class that reaches users as a white screen.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['app', 'components', 'hooks'];
const HOOKS = [
  'useState',
  'useEffect',
  'useMemo',
  'useCallback',
  'useRef',
  'useReducer',
  'useLayoutEffect',
  'useContext',
  'useTransition',
  'useDeferredValue',
  'useId',
  'useSyncExternalStore',
];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('client components import the hooks they call', () => {
  it('no file calls a React hook it never imported', () => {
    const offenders: string[] = [];

    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const src = readFileSync(file, 'utf8');
        // Named imports from react, across single/double quotes and multi-line.
        const importBlocks = [...src.matchAll(/import\s+[^;]*?from\s+['"]react['"]/gs)]
          .map((m) => m[0])
          .join(' ');
        const hasDefaultReact = /import\s+(\*\s+as\s+)?React[,\s]/.test(importBlocks);

        for (const hook of HOOKS) {
          // A bare call: `useMemo(` not preceded by `.` (so `React.useMemo` and
          // `foo.useMemo` are excluded) and not its own declaration.
          const called = new RegExp(`(^|[^.\\w])${hook}\\s*\\(`, 'm').test(src);
          if (!called) continue;
          const imported = new RegExp(`\\b${hook}\\b`).test(importBlocks);
          const declared = new RegExp(`(const|let|function)\\s+${hook}\\b`).test(src);
          if (!imported && !declared && !hasDefaultReact) {
            offenders.push(`${file}: calls ${hook} without importing it`);
          }
        }
      }
    }

    expect(offenders, `\n${offenders.join('\n')}`).toEqual([]);
  });
});
