/**
 * Canary for `types/contextBinding.ts` — Homecoming III Phase 6 live dogfood.
 *
 * Each assertion below operationalizes one of the six causal conditions this
 * session's live discovery pass surfaced while scoping the first internal
 * Crystal 2.0 assignment (see the Phase 6 trace,
 * `codexes/packs/agentiq/updates/2026-08-15_phase6-dogfood-trace.json`):
 * three from the positive (intent-driven) pass, three from the
 * risk-informed negative pass. Comment above each `it` names which.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import {
  CONTEXT_BINDING_LEVELS,
  CONTEXT_BINDING_SCHEMA_VERSION,
  isContextBindingLevel,
} from '@/types/contextBinding';
import { findForbiddenStateKey } from '@/services/devCommandCenter/devLoop';

const CONTRACT_PATH = path.join(process.cwd(), 'types/contextBinding.ts');
const CONTRACT_SOURCE = readFileSync(CONTRACT_PATH, 'utf-8');

describe('positive pass — intent-driven', () => {
  // P1: the six rungs are one pinned, ordered array — never a free-form string.
  it('pins the six-rung order exactly', () => {
    expect([...CONTEXT_BINDING_LEVELS]).toEqual([
      'platform',
      'workspace',
      'project',
      'developer',
      'principal-user',
      'session-intent',
    ]);
  });

  it('the runtime guard accepts only pinned rungs', () => {
    for (const level of CONTEXT_BINDING_LEVELS) expect(isContextBindingLevel(level)).toBe(true);
    expect(isContextBindingLevel('personaId')).toBe(false);
    expect(isContextBindingLevel(42)).toBe(false);
  });

  // P2: every future reader can trace this contract back to the ruling that authorized it.
  it('cross-references the operator ruling that authorized this contract', () => {
    expect(CONTRACT_SOURCE).toMatch(/RES-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001/);
    expect(CONTRACT_SOURCE).toMatch(/CI-2026-08-15-SCOPE-CONTEXT-BINDING-AXIS-001/);
  });

  // P3: schema version follows the repo's <slug>/v<major>.<minor> convention.
  it('the schema version follows the repo convention', () => {
    expect(CONTEXT_BINDING_SCHEMA_VERSION).toMatch(/^[a-z0-9-]+\/v\d+\.\d+$/);
  });
});

describe('risk-informed negative pass', () => {
  // N1 (from RV1 — scope/context-binding reopen risk): import-graph independence
  // from InvariantScope, so the two ladders can never silently couple.
  it('does not import from types/invariantEnvelope.ts', () => {
    // No IMPORT dependency — the file's own doc comment legitimately NAMES
    // `InvariantScope` in prose to explain the orthogonality rule; what must
    // never exist is a real import STATEMENT (one line, anchored at line
    // start) naming either the module or the type.
    const importLines = CONTRACT_SOURCE.split('\n').filter((l) => /^\s*import\b/.test(l));
    expect(importLines).toEqual([]);
  });

  // N2 (from RV2 — T0-identifier-leak risk): reuse the EXISTING predicate
  // (findForbiddenStateKey) against the contract's own source text, rather
  // than writing a second, independently-tuned check.
  it('contains no T0-forbidden identifier key name, checked by the existing predicate', () => {
    // findForbiddenStateKey matches the quoted-key form ("personaId"); probe
    // with the same shape a serialized object would carry.
    const asIfSerialized = JSON.stringify({ source: CONTRACT_SOURCE });
    expect(findForbiddenStateKey(asIfSerialized)).toBeNull();
  });

  // N3 (from RV3 — premature-wiring risk): the contract's existence is not
  // yet its adoption — zero non-test production importers today.
  it('has zero non-test production importers', () => {
    const repoRoot = process.cwd();
    const searchDirs = ['app', 'services', 'components', 'hooks', 'utils'];
    const importers: string[] = [];

    function walk(dir: string) {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
          if (entry === 'node_modules' || entry === '.next') continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry)) {
          const src = readFileSync(full, 'utf-8');
          if (/from ['"]@\/types\/contextBinding['"]/.test(src) || /from ['"].*\/contextBinding['"]/.test(src)) {
            importers.push(full);
          }
        }
      }
    }

    for (const dir of searchDirs) walk(path.join(repoRoot, dir));
    expect(importers).toEqual([]);
  });
});
