/**
 * Source-of-truth parity canary — the enforcement of `inv.engineering.036`
 * ("one authoritative location per concern") and `inv.engineering.037` ("a
 * parallel implementation of an existing capability is a defect").
 *
 * Operator-ratified 2026-07-22, from the First Invariant Retrospective's
 * headline finding (IRL-017 §2.3): three independent defects in one session —
 * (a) EXPERIMENT_REGISTRY hand-duplicated as col_experiments markdown,
 * (b) the pack-corpus local-fs sniff duplicating the PACK_CORPUS_URL signal,
 * (c) ASSIGNABLE_EXPERIMENTS hand-duplicated from EXPERIMENT_REGISTRY —
 * were all violations of an ALREADY-canonical invariant. The gap was
 * enforcement, not doctrine. This file is the designated home for
 * source-of-truth parity checks: when a surface needs a projection of a
 * registry, DERIVE it in code; where derivation is impossible, add a parity
 * check HERE so drift fails the build instead of reaching production.
 *
 * Existing parity canaries that live elsewhere (indexed here, NOT duplicated —
 * that would itself violate 036):
 *  - EXPERIMENT_REGISTRY ↔ experiments/ disk directories:
 *      tests/constitutional-contracts.test.ts (disk-parity canary)
 *  - PACK_CORPUS_URL pins remote corpus mode over the local-fs sniff:
 *      tests/pack-corpus-store.test.ts (2026-07-22 incident contract)
 *  - PROTOCOL_FREEZE_ARTIFACT_KINDS ⊄ execution artifacts:
 *      tests/prd-epi-001-artifact-model.test.ts
 *  - ActivityActionType (TS) ⊆ activity_receipts_action_type_check (SQL, latest
 *    rebuild) -- the "2026-07-15 constraint-drift incident" class of bug:
 *      tests/activity-receipts-action-type-parity.test.ts
 *  - ARCHETYPE_JOURNEY (SPEC-COS-001 substrate resolver) ⊆ the Threshold
 *    Journey Registry, and the substrate resolver composes rather than
 *    re-derives passport/access/delegation:
 *      tests/onboarding-substrate.test.ts
 *  - CAPABILITY_ROUTES (Companion Overlay capability deep-links) ↔ real,
 *    ENABLED codex/tab slugs in data/codex-configs.ts -- a hand-declared
 *    projection of two sources of truth, so a renamed/disabled tab must fail
 *    the build rather than ship a dead link:
 *      tests/companion-observer.test.ts
 *
 * Canaries defined IN this file:
 *  - ASSIGNABLE_EXPERIMENTS ↔ EXPERIMENT_REGISTRY
 *  - SPEC-CDR-001 execution taxonomy (D-1): EXECUTION_DOMAINS ↔
 *    FINANCIAL_DOMAINS ↔ the SPEC §3 docs mirror, plus the §4.2
 *    non-executability rule for governance domains
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EXPERIMENT_REGISTRY } from '../types/research';
import { ASSIGNABLE_EXPERIMENTS } from '../services/passport/participationAccess';
import { FINANCIAL_DOMAINS } from '../services/constitutional/financialIntelligenceExecutor';
import { EXECUTION_DOMAINS, isExecutionDomain } from '../services/resolution/executionTaxonomy';

describe('source-of-truth parity (inv.engineering.036/037 enforcement)', () => {
  it('ASSIGNABLE_EXPERIMENTS remains a pure derivation of EXPERIMENT_REGISTRY', () => {
    // Regression guard for the 2026-07-22 incident: the invitation-scoping
    // list had drifted to a stale hand-copy missing EXP-009/010, CCE-006/007,
    // ISR-001. It is now derived; this pins that it STAYS derived — if anyone
    // reverts to a hand-maintained array, the ids fall out of sync with the
    // registry and this fails.
    expect(ASSIGNABLE_EXPERIMENTS.map((e) => e.id)).toEqual(
      EXPERIMENT_REGISTRY.map((e) => e.id),
    );
    // Labels carry the registry's family text — a second field that would
    // silently go stale under a hand-copy.
    for (const exp of ASSIGNABLE_EXPERIMENTS) {
      const reg = EXPERIMENT_REGISTRY.find((r) => r.id === exp.id);
      expect(reg).toBeDefined();
      expect(exp.label).toContain(reg!.family);
    }
  });

  it('EXPERIMENT_REGISTRY ids are unique (a registry with duplicate keys is two sources of truth)', () => {
    const ids = EXPERIMENT_REGISTRY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * SPEC-CDR-001 D-1 (RATIFIED 2026-07-25) — execution-taxonomy parity.
 *
 * The taxonomy IS the shipped `FinancialDomain` union. `EXECUTION_DOMAINS`
 * derives from it in code, so THAT pair cannot drift. The one place derivation
 * is impossible is the docs mirror in SPEC-CDR-001 §3 — so it is checked here,
 * per §3's binding derivation rule and CLAUDE.md's parity-canary requirement.
 *
 * This canary also pins the §4.2 non-executability rule: a governance domain
 * must never leak into the executable union. Widening `FinancialDomain` widens
 * the money-moving execution contract, which §10.1 explicitly does not
 * authorise — so that must fail the build, not pass review.
 */
describe('SPEC-CDR-001 execution taxonomy parity (D-1)', () => {
  const SPEC_PATH = join(
    __dirname,
    '../codexes/packs/irl/foundation/SPEC-CDR-001_constitutional-domain-resolution.md',
  );
  const spec = readFileSync(SPEC_PATH, 'utf8');

  /** Pull the markdown between one `## <heading>` and the next `## `. */
  const section = (startsWith: string): string => {
    const from = spec.indexOf(`\n## ${startsWith}`);
    expect(from, `section "## ${startsWith}" not found in SPEC-CDR-001`).toBeGreaterThan(-1);
    const rest = spec.slice(from + 1);
    const to = rest.indexOf('\n## ', 1);
    return to === -1 ? rest : rest.slice(0, to);
  };

  /** Rows whose first cell is a backticked id: | `id` | col2 | col3 | */
  const idRows = (md: string): { id: string; c2: string; c3: string }[] =>
    Array.from(md.matchAll(/^\|\s*`([a-z-]+)`\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/gm)).map((m) => ({
      id: m[1],
      c2: m[2],
      c3: m[3],
    }));

  it('EXECUTION_DOMAINS is a pure derivation of FINANCIAL_DOMAINS', () => {
    expect(EXECUTION_DOMAINS.map((d) => d.id)).toEqual([...FINANCIAL_DOMAINS]);
  });

  it('the §3 docs table matches the shipped union — ids, labels, and posture', () => {
    const rows = idRows(section('3. Canonical execution taxonomy'));
    expect(rows.length, '§3 table rows not parsed').toBe(FINANCIAL_DOMAINS.length);
    expect(rows.map((r) => r.id)).toEqual([...FINANCIAL_DOMAINS]);

    for (const row of rows) {
      const shipped = EXECUTION_DOMAINS.find((d) => d.id === row.id)!;
      // Column 2 is "Label (shipped)" — must be the real label, not a retitle.
      expect(row.c2).toBe(shipped.label);
      // Column 3 states the CRP-003a posture in prose; the code records it as
      // an enum. A doc that says "Authoritative" for a shadow-only domain (or
      // the reverse) is exactly the drift that must fail the build.
      const documented = row.c3.toLowerCase().startsWith('authoritative')
        ? 'authoritative'
        : 'shadow-only';
      expect(documented, `posture drift for "${row.id}"`).toBe(shipped.posture);
    }
  });

  it('no governance domain has leaked into the executable union (§4.2)', () => {
    const governance = idRows(section('4. Proposed governance domains'));
    // Guard the guard: if §4.1's table is ever restructured away, this test
    // would silently pass on an empty list.
    expect(governance.length).toBeGreaterThan(0);
    for (const g of governance) {
      expect(
        (FINANCIAL_DOMAINS as readonly string[]).includes(g.id),
        `"${g.id}" is a governance domain and must never be executable`,
      ).toBe(false);
      expect(isExecutionDomain(g.id)).toBe(false);
    }
  });

  it('no surface restates the execution-domain list instead of deriving it', () => {
    // The two API routes each carried a hand-copied
    // `['intelligence','investment','market']` array before D-1 was
    // implemented. This pins that they stay derived.
    for (const rel of [
      '../app/api/moneypenny/runtime/route.ts',
      '../app/api/constitutional/service-pipeline/route.ts',
    ]) {
      const src = readFileSync(join(__dirname, rel), 'utf8');
      expect(src, `${rel} restates the domain list`).not.toMatch(
        /\[\s*'intelligence'\s*,\s*'investment'\s*,\s*'market'\s*\]/,
      );
      expect(src).toContain('isExecutionDomain');
    }
  });
});
