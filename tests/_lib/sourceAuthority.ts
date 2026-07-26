/**
 * Source-authority helpers for structural canaries.
 *
 * WHY THIS EXISTS — the grep-vs-comment defect class. Several canaries in this
 * repo assert "module X never imports/calls Y" with a raw `expect(src).not
 * .toContain('Y')` over `readFileSync`. That reads the file's PROSE as well as
 * its code, so a module whose own header DOCUMENTS the boundary by naming the
 * forbidden symbol fails its own canary while being perfectly compliant. That
 * has now happened four separate times (most recently the MoneyPenny Architect
 * route, 2026-07-25). A canary that cries wolf gets ignored — and these guard
 * the Principal–Delegate Separation boundary, so they are the last canaries we
 * can afford to have people learn to skip.
 *
 * The second, quieter failure is the inverse: a naive
 * `src.replace(/\/\/.*$/gm, '')` will eat the tail of any line containing `//`
 * inside a string or regex literal (`'https://…'`, `/https:\/\//`). That
 * DELETES code, so a `.not.toContain` can pass on a module that really does
 * violate the boundary. Silent false-green on an authority canary is strictly
 * worse than false-red.
 *
 * WHY THE TYPESCRIPT PARSER, not a hand lexer. A hand-rolled string/comment
 * state machine was written first and measured against the tree: it mis-parsed
 * 27 of 2,383 source files, INCLUDING `RuntimePanel.tsx`, which the MoneyPenny
 * authority canary reads. The cause is structural, not a bug to patch — JSX
 * text is not lexable as JS (`<p>don't</p>` opens a string that never closes),
 * and nested template interpolations have the same property. Since a canary
 * helper that is 99% right is a canary helper that fails silently on the 1%,
 * this uses `typescript` (already a dependency, no new deps) to get comment
 * ranges and import declarations from a real TSX-aware AST.
 *
 * Ranked by strength, prefer in this order:
 *   1. a BEHAVIOURAL test (call the thing, assert what it did) — see
 *      tests/moneypenny-runtime-authority-boundary.test.ts's payload-boundary
 *      block, which drives the route with an adversarial body;
 *   2. `importAuthority` — import authority is a structural property of the
 *      import declarations, and a module cannot call what it never bound;
 *   3. `stripComments` + a targeted grep, for genuinely source-level
 *      properties with no runtime surface (e.g. "this client uses personaFetch,
 *      never raw fetch").
 *
 * This module is the ONE home for these helpers (inv.engineering.036) —
 * extend it rather than re-deriving a stripper in another test file.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/** Read a repo-relative source file. */
export function readSource(repoRelativePath: string): string {
  return readFileSync(join(process.cwd(), repoRelativePath), 'utf8');
}

/** Parse as TSX always — it is a superset for our purposes and every file the
 *  canaries read is .ts or .tsx. `setParentNodes` is off; we only walk down. */
function parse(src: string): ts.SourceFile {
  return ts.createSourceFile('canary.tsx', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/**
 * Remove comments while preserving every code byte, including `//` and `/*`
 * sequences inside string, template, regex, or JSX-text content.
 *
 * Comments are blanked in place (newlines kept) rather than deleted, so line
 * numbers in a failure message still point at the real source line.
 */
export function stripComments(src: string): string {
  const sf = parse(src);
  const ranges: Array<{ pos: number; end: number }> = [];

  // Every comment is trivia leading some TOKEN. Traversal must therefore use
  // `getChildren()` (which yields tokens) and NOT `forEachChild` (which yields
  // only named nodes). Measured difference: with `forEachChild`, comments
  // sitting before a `|` in a union type survive the strip — e.g. three of
  // them in services/resolution/presentationPolicy.ts — because the following
  // member's `pos` starts AFTER the `|`. A surviving comment is exactly the
  // false-red this helper exists to eliminate.
  const visit = (node: ts.Node) => {
    for (const r of ts.getLeadingCommentRanges(src, node.pos) ?? []) ranges.push(r);
    const children = node.getChildren(sf);
    if (children.length) children.forEach(visit);
    else for (const r of ts.getTrailingCommentRanges(src, node.end) ?? []) ranges.push(r);
  };
  visit(sf);

  if (!ranges.length) return src;

  const blanked = src.split('');
  for (const { pos, end } of ranges) {
    for (let i = pos; i < end && i < blanked.length; i++) {
      if (blanked[i] !== '\n' && blanked[i] !== '\r') blanked[i] = ' ';
    }
  }
  return blanked.join('');
}

export interface ImportRecord {
  /** The module specifier, verbatim. */
  specifier: string;
  /** Named bindings — BOTH the exported name and any local alias. */
  names: string[];
  defaultName: string | null;
  /** Set for `import * as Ns from '…'` — a namespace binding re-opens access to
   *  every export of the module, so authority canaries must treat it as a hit. */
  namespaceName: string | null;
}

export interface ImportAuthority {
  records: ImportRecord[];
  /** Specifiers reached via `import('…')`. */
  dynamicSpecifiers: string[];
  /** Specifiers reached via `require('…')`. */
  requireSpecifiers: string[];
  /** Every name the module bound from anywhere — exported names and aliases. */
  boundNames: Set<string>;
}

function literalText(node: ts.Node | undefined): string | null {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

/**
 * The module's import graph, read from a real AST.
 *
 * Import authority is the right granularity for these canaries: a module
 * cannot call a server function it never bound, and — critically — module-level
 * reachability would be WRONG here, because
 * `services/constitutional/constitutionalAgreement.ts` exports both the
 * forbidden `authorizeAgreement` and the required `requireAuthorizedAgreement`.
 * The boundary is the binding, not the file.
 */
export function importAuthority(src: string): ImportAuthority {
  const sf = parse(src);
  const records: ImportRecord[] = [];
  const dynamicSpecifiers: string[] = [];
  const requireSpecifiers: string[] = [];
  const boundNames = new Set<string>();

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const specifier = literalText(node.moduleSpecifier);
      if (specifier) {
        const record: ImportRecord = { specifier, names: [], defaultName: null, namespaceName: null };
        const clause = node.importClause;
        if (clause?.name) record.defaultName = clause.name.text;
        const bindings = clause?.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) {
          record.namespaceName = bindings.name.text;
        } else if (bindings && ts.isNamedImports(bindings)) {
          for (const el of bindings.elements) {
            // `a as b` binds b locally but still grants access to a — record both.
            if (el.propertyName) record.names.push(el.propertyName.text);
            record.names.push(el.name.text);
          }
        }
        records.push(record);
        record.names.forEach((n) => boundNames.add(n));
        if (record.defaultName) boundNames.add(record.defaultName);
        if (record.namespaceName) boundNames.add(record.namespaceName);
      }
    } else if (ts.isCallExpression(node)) {
      const spec = literalText(node.arguments[0]);
      if (spec) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) dynamicSpecifiers.push(spec);
        else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
          requireSpecifiers.push(spec);
        }
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);

  return { records, dynamicSpecifiers, requireSpecifiers, boundNames };
}

/**
 * Every reason `src` might have authority over `forbidden`, as human-readable
 * findings — empty means the boundary holds. Covers the three ways a binding
 * can be acquired: a named/default import, a namespace import of the module
 * that exports it, and a dynamic `import()`/`require()` of that module.
 *
 * `moduleHints` are substrings of specifiers that export the forbidden names;
 * they are what make the namespace/dynamic escape hatches detectable.
 */
export function forbiddenImportFindings(
  src: string,
  forbidden: readonly string[],
  moduleHints: readonly string[] = [],
): string[] {
  const graph = importAuthority(src);
  const findings: string[] = [];

  for (const name of forbidden) {
    for (const r of graph.records) {
      if (r.names.includes(name) || r.defaultName === name) {
        findings.push(`imports '${name}' from '${r.specifier}'`);
      }
    }
  }

  const hit = (spec: string) => moduleHints.some((h) => spec.includes(h));
  for (const r of graph.records) {
    if (r.namespaceName && hit(r.specifier)) {
      findings.push(`namespace-imports '${r.specifier}' as '${r.namespaceName}' — re-opens every export`);
    }
  }
  for (const spec of graph.dynamicSpecifiers) {
    if (hit(spec)) findings.push(`dynamically imports '${spec}'`);
  }
  for (const spec of graph.requireSpecifiers) {
    if (hit(spec)) findings.push(`requires '${spec}'`);
  }

  return findings;
}
