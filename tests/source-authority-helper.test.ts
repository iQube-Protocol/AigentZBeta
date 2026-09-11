/**
 * Canary for the canary helper (tests/_lib/sourceAuthority.ts).
 *
 * Every structural authority canary in this repo will lean on `stripComments`
 * and `importAuthority`. If the stripper eats real code, a `.not.toContain`
 * assertion passes on a module that genuinely violates its boundary — a silent
 * false-green on the Principal–Delegate Separation gate. So the helper's own
 * failure modes are pinned here, most importantly the ones that produce
 * false-GREEN rather than false-red.
 */

import { describe, it, expect } from 'vitest';
import {
  stripComments,
  importAuthority,
  forbiddenImportFindings,
} from './_lib/sourceAuthority';

describe('stripComments — removes prose, preserves every code byte', () => {
  it('removes the block comment that documents a forbidden symbol (the false-RED defect)', () => {
    const src = `/**
 * This route never calls authorizeAgreement.
 */
export const x = 1;`;
    const code = stripComments(src);
    expect(code).not.toContain('authorizeAgreement');
    expect(code).toContain('export const x = 1;');
  });

  it('removes a trailing line comment naming a forbidden symbol', () => {
    const code = stripComments(`const a = 1; // never settlementExecutor here\nconst b = 2;`);
    expect(code).not.toContain('settlementExecutor');
    expect(code).toContain('const a = 1;');
    expect(code).toContain('const b = 2;');
  });

  it('KEEPS `//` inside a string literal — a naive line-comment regex deletes the rest of the line', () => {
    // This is the false-GREEN case: eating this line would remove the
    // authorizeAgreement call sitting after it and the canary would pass.
    const src = `const url = 'https://example.com'; authorizeAgreement(x);`;
    const code = stripComments(src);
    expect(code).toContain("'https://example.com'");
    expect(code).toContain('authorizeAgreement(x)');
  });

  it('KEEPS `//` inside a template literal and a double-quoted string', () => {
    const code = stripComments('const a = `x https://y`; const b = "z//w"; call();');
    expect(code).toContain('https://y');
    expect(code).toContain('z//w');
    expect(code).toContain('call()');
  });

  it('KEEPS an escaped `/` inside a regex literal — `/https:\\/\\//` must not read as a comment', () => {
    const src = `const re = /https:\\/\\//; authorizeAgreement(x);`;
    const code = stripComments(src);
    expect(code).toContain('authorizeAgreement(x)');
  });

  it('does not mistake division for a regex literal', () => {
    const code = stripComments('const ratio = total / count; const other = a / b; done();');
    expect(code).toContain('total / count');
    expect(code).toContain('done()');
  });

  it('handles an escaped quote inside a string without losing the rest of the file', () => {
    const code = stripComments(`const s = 'it\\'s fine'; authorizeAgreement(x);`);
    expect(code).toContain('authorizeAgreement(x)');
  });

  it('survives JSX text containing an apostrophe — the case that broke the hand lexer', () => {
    // `<p>don't</p>` is JSX TEXT, not a string literal. A JS-only lexer opens a
    // single-quote state that never closes and silently mangles the rest of the
    // file. This exact shape appears in RuntimePanel.tsx, which the MoneyPenny
    // authority canary reads.
    const src = `export const C = () => <p>don't do it</p>;\nauthorizeAgreement(x);`;
    const code = stripComments(src);
    expect(code).toContain("don't do it");
    expect(code).toContain('authorizeAgreement(x)');
  });

  it('survives JSX text containing a double quote and a nested template interpolation', () => {
    const src = 'export const C = () => <p>say "hi"</p>;\nconst t = `a ${`b ${c}`} d`;\ncall();';
    const code = stripComments(src);
    expect(code).toContain('say "hi"');
    expect(code).toContain('call()');
  });

  it('strips comments that precede a TOKEN, not just a named node (union-type members)', () => {
    // A `forEachChild` traversal misses these: the comment sits before the `|`,
    // and the following member's `pos` starts after it. Three real comments in
    // services/resolution/presentationPolicy.ts survived the strip that way,
    // which is precisely the false-red this helper exists to remove.
    const code = stripComments(
      `export type R =\n  /** first */\n  | 'a'\n  /** authorizeAgreement */\n  | 'b';`,
    );
    expect(code).not.toContain('first');
    expect(code).not.toContain('authorizeAgreement');
    expect(code).toContain("| 'a'");
    expect(code).toContain("| 'b'");
  });

  it('strips a comment sitting at the end of a block, before the closing brace', () => {
    const code = stripComments('function f() {\n  g();\n  // authorizeAgreement\n}');
    expect(code).not.toContain('authorizeAgreement');
    expect(code).toContain('g();');
  });

  it('strips a trailing comment at end of file', () => {
    expect(stripComments('const a = 1;\n// authorizeAgreement')).not.toContain('authorizeAgreement');
  });

  it('blanks comments in place so line numbers still line up', () => {
    const code = stripComments('const a = 1;\n/* two\n   lines */\nconst b = 2;');
    expect(code.split('\n')).toHaveLength(4);
    expect(code.split('\n')[3]).toBe('const b = 2;');
  });
});

describe('importAuthority — binding-level, not module-level', () => {
  it('records named bindings and both sides of an alias', () => {
    const g = importAuthority(`import { authorizeAgreement as authz, formAgreement } from '@/services/x';`);
    expect(g.boundNames.has('authorizeAgreement')).toBe(true);
    expect(g.boundNames.has('authz')).toBe(true);
    expect(g.boundNames.has('formAgreement')).toBe(true);
  });

  it('separates two bindings from the SAME module — the reason module reachability is the wrong granularity', () => {
    // constitutionalAgreement.ts exports both the forbidden authorizeAgreement
    // and the REQUIRED requireAuthorizedAgreement. A module-level check would
    // flag every compliant consumer of the 409 gate.
    const src = `import { requireAuthorizedAgreement } from '@/services/constitutional/constitutionalAgreement';`;
    expect(forbiddenImportFindings(src, ['authorizeAgreement'], ['constitutionalAgreement'])).toEqual([]);
    expect(importAuthority(src).boundNames.has('requireAuthorizedAgreement')).toBe(true);
  });

  it('parses multi-line and type-only import clauses', () => {
    const g = importAuthority(`import type { A } from 'm1';\nimport {\n  b,\n  c as d,\n} from 'm2';`);
    expect(g.boundNames.has('A')).toBe(true);
    expect(g.boundNames.has('b')).toBe(true);
    expect(g.boundNames.has('d')).toBe(true);
    expect(g.records.map((r) => r.specifier)).toEqual(['m1', 'm2']);
  });

  it('records a default import', () => {
    expect(importAuthority(`import react from '@vitejs/plugin-react-swc';`).records[0].defaultName).toBe('react');
  });

  it('ignores an import that appears only in a comment', () => {
    const g = importAuthority(`// import { authorizeAgreement } from '@/services/y';\nexport const z = 1;`);
    expect(g.records).toHaveLength(0);
    expect(g.boundNames.has('authorizeAgreement')).toBe(false);
  });
});

describe('forbiddenImportFindings — the escape hatches are hits, not gaps', () => {
  const HINT = ['constitutionalAgreement'];

  it('flags a direct named import of the forbidden binding', () => {
    const f = forbiddenImportFindings(
      `import { authorizeAgreement } from '@/services/constitutional/constitutionalAgreement';`,
      ['authorizeAgreement'],
      HINT,
    );
    expect(f).toHaveLength(1);
    expect(f[0]).toContain('authorizeAgreement');
  });

  it('flags an aliased import — renaming must not launder the authority', () => {
    expect(
      forbiddenImportFindings(
        `import { authorizeAgreement as go } from '@/services/constitutional/constitutionalAgreement';`,
        ['authorizeAgreement'],
        HINT,
      ),
    ).not.toEqual([]);
  });

  it('flags a namespace import of the exporting module — it re-opens every export', () => {
    expect(
      forbiddenImportFindings(
        `import * as agreements from '@/services/constitutional/constitutionalAgreement';`,
        ['authorizeAgreement'],
        HINT,
      ),
    ).not.toEqual([]);
  });

  it('flags a dynamic import() and a require() of the exporting module', () => {
    expect(
      forbiddenImportFindings(
        `const m = await import('@/services/constitutional/constitutionalAgreement');`,
        ['authorizeAgreement'],
        HINT,
      ),
    ).not.toEqual([]);
    expect(
      forbiddenImportFindings(
        `const m = require('@/services/constitutional/constitutionalAgreement');`,
        ['authorizeAgreement'],
        HINT,
      ),
    ).not.toEqual([]);
  });

  it('stays silent on a module that only NAMES the forbidden symbol in its header', () => {
    const src = `/**\n * Proposal-only: never authorizeAgreement, never settlementExecutor.\n */\nimport { formAgreement } from '@/services/constitutional/constitutionalAgreement';`;
    expect(forbiddenImportFindings(src, ['authorizeAgreement', 'settlementExecutor'], HINT)).toEqual([]);
  });
});
