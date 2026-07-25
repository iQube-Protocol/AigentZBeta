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
import {
  DOMAIN_PROFILES,
  registeredHostnames,
  resolveDomainProfile,
  overlayContextForDomain,
} from '../services/resolution/domainProfileRegistry';
import { shapeForDomain, SHAPE_CAPABILITY_IDS } from '../services/companion/overlayMapping';
import {
  resolveDomain,
  classifyProfile,
  assertedContextFor,
} from '../services/resolution/domainResolver';
import type { DomainProfile } from '../services/resolution/domainProfileRegistry';

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

  it('P2 seed profiles assert NO execution domain (presentation must not imply executability)', () => {
    // D-11's presentation/execution firewall, enforced rather than asserted.
    // A hostname profile says which CONTEXT to render; claiming an execution
    // domain for a hostname would let a presentation surface imply that money
    // may move there.
    for (const profile of DOMAIN_PROFILES) {
      expect(
        'executionDomains' in profile,
        `${profile.subject} asserts executionDomains — presentation must not imply executability`,
      ).toBe(false);
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

/**
 * SPEC-CDR-001 P2 (D-14 / D-15, RATIFIED 2026-07-25) — Domain Profile registry.
 *
 * P2 is MIGRATION-EQUIVALENT, not feature-expanding (operator, binding): the
 * same five hostnames must render materially the same experience as before.
 * The constitutional improvement is that the *reason* they resolve is now
 * explicit, inspectable and governed — so these canaries pin both halves:
 * behaviour unchanged, and the governance metadata actually present.
 */
describe('SPEC-CDR-001 domain profile registry (D-15)', () => {
  /** The exact membership the operator ratified. Restated here ON PURPOSE:
   *  this is the independent statement of the decision that the registry is
   *  checked against. Drift in either direction fails. */
  const RATIFIED_SEEDS: Record<string, 'first-party' | 'curated'> = {
    'metame.com': 'first-party',
    'www.metame.com': 'first-party',
    'dev-beta.aigentz.me': 'first-party',
    'coinbase.com': 'curated',
    'www.coinbase.com': 'curated',
  };

  it('resolves exactly the five ratified hostnames — no more, no fewer', () => {
    expect(new Set(registeredHostnames())).toEqual(new Set(Object.keys(RATIFIED_SEEDS)));
  });

  it('migration equivalence: every legacy BANKING_DOMAINS host still resolves', () => {
    // The five hosts the removed hardcoded Set contained. If P2 changed which
    // pages get a card, it stopped being a migration.
    for (const host of Object.keys(RATIFIED_SEEDS)) {
      expect(overlayContextForDomain(host), `${host} lost its overlay context`).toBe(
        'financial-context',
      );
      expect(shapeForDomain(host)).toBe('financial-context');
    }
  });

  it('aliases resolve to the IDENTICAL profile object, not a duplicated body', () => {
    // D-15: "avoid duplicating the complete profile body if an alias mechanism
    // can preserve a single source of truth." Object identity is the strongest
    // available statement of that — a copy-paste twin would fail here even if
    // every field happened to match today.
    expect(resolveDomainProfile('www.metame.com')).toBe(resolveDomainProfile('metame.com'));
    expect(resolveDomainProfile('www.coinbase.com')).toBe(resolveDomainProfile('coinbase.com'));
    // Three profiles behind five hostnames.
    expect(DOMAIN_PROFILES).toHaveLength(3);
  });

  it('every seed carries the ratified provenance, and all are verified', () => {
    for (const [host, provenance] of Object.entries(RATIFIED_SEEDS)) {
      const profile = resolveDomainProfile(host);
      expect(profile, `${host} unresolved`).not.toBeNull();
      expect(profile!.assertionProvenance, `${host} provenance drift`).toBe(provenance);
      expect(profile!.verificationStatus, `${host} is not verified`).toBe('verified');
    }
  });

  it('no provisional and no discovered profiles exist yet (P3/P5 are unbuilt)', () => {
    for (const profile of DOMAIN_PROFILES) {
      expect(profile.verificationStatus).toBe('verified');
      expect(profile.assertionProvenance).not.toBe('discovered');
      // D-6: confidence belongs only to inferred assertions. Its presence on
      // an asserted profile would imply a classification that never ran.
      expect('confidence' in profile, `${profile.subject} carries a confidence score`).toBe(false);
    }
  });

  it('every seed states an authority and evidence — a claim, never a bare assertion', () => {
    for (const profile of DOMAIN_PROFILES) {
      expect(profile.verifiedBy, `${profile.subject} has no authority`).toBeTruthy();
      expect(profile.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(profile.evidence.length, `${profile.subject} has no evidence`).toBeGreaterThan(0);
      expect(profile.rationale.trim().length).toBeGreaterThan(0);
    }
  });

  it('verifiedBy carries no T0 identifier (tier discipline — profiles are network-bound)', () => {
    const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    for (const profile of DOMAIN_PROFILES) {
      const serialised = JSON.stringify(profile.verifiedBy);
      expect(serialised, `${profile.subject} verifiedBy looks like a raw identifier`).not.toMatch(
        UUID,
      );
    }
  });

  it('abstains for unmapped hostnames rather than fabricating a context', () => {
    // SPEC-CDR-001 §6.2 — abstention is preferable to fabricated context.
    for (const host of ['google.com', 'example.com', 'metame.com.evil.test', '', '   ']) {
      expect(overlayContextForDomain(host), `${host} should not resolve`).toBeNull();
    }
    expect(overlayContextForDomain(null)).toBeNull();
    // Normalisation still applies, exactly as the old Set-based lookup did.
    expect(overlayContextForDomain('  MetaMe.COM ')).toBe('financial-context');
  });

  it('the legacy `banking` identifier is gone from every companion surface', () => {
    // D-14 renamed the overlay context. A surviving `banking` literal would
    // mean a consumer still switches on the old wire value — the card would
    // silently stop rendering.
    for (const rel of [
      '../services/companion/overlayMapping.ts',
      '../services/companion/overlayComposition.ts',
      '../components/companion/CompanionOverlayPanel.tsx',
    ]) {
      const src = readFileSync(join(__dirname, rel), 'utf8');
      // Strip block comments: overlayMapping.ts documents the rename in prose,
      // and the historical record is worth keeping. Only live code counts.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code, `${rel} still uses the legacy banking identifier`).not.toMatch(
        /['"]banking['"]/,
      );
    }
  });

  it('shapeForDomain derives membership from the registry, not a hardcoded set', () => {
    const src = readFileSync(
      join(__dirname, '../services/companion/overlayMapping.ts'),
      'utf8',
    );
    // Membership comes from services/resolution/* -- via the registry in P2,
    // and via the resolver on top of it from P3 onward. Either way it is
    // derived, never restated here.
    expect(src).toContain('@/services/resolution/');
    // The removed hostname Set, in any revived form.
    expect(src).not.toMatch(/new Set<string>\(\s*\[/);
    expect(src.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('coinbase.com');
  });

  it('P3: every seed resolves at L1 and is assertable', () => {
    for (const host of Object.keys(RATIFIED_SEEDS)) {
      const r = resolveDomain(host);
      // All five seeds are asserted-and-verified, so all five are L1. L2
      // requires a DISCOVERED profile that was later verified, and none
      // exists yet -- P5 produces the first.
      expect(r.level, `${host} did not resolve at L1`).toBe('L1');
      expect(r.reason).toBe('asserted-verified');
      expect(r.assert).toBe(true);
      expect(r.overlayContext).toBe('financial-context');
    }
  });

  it('P3: an unmapped subject abstains at L4 with a stated reason', () => {
    const r = resolveDomain('google.com');
    expect(r.level).toBe('L4');
    expect(r.reason).toBe('no-profile');
    expect(r.assert).toBe(false);
    expect(r.overlayContext).toBeNull();
    expect(r.profile).toBeNull();
  });

  it('P3: no shipped profile can reach L3 — the provisional path is unbuilt', () => {
    // The registry contains no provisional or discovered profiles, so L3 is
    // unreachable today. If a later change seeds one before P5 ships the
    // hedged forms, this fails and forces the decision to be deliberate.
    for (const host of registeredHostnames()) {
      expect(resolveDomain(host).level, `${host} reached L3`).not.toBe('L3');
    }
  });

  it('P3: a provisional profile is classified but NEVER asserted', () => {
    // The behaviour that matters most, exercised directly rather than
    // inferred from the registry's current contents. Constructed locally --
    // seeding one into the real registry would ship an unverified profile.
    const provisional = {
      schemaVersion: 'cdr-domain-profile/v1',
      subjectType: 'hostname',
      subject: 'unverified.test',
      overlayContext: 'financial-context',
      assertionProvenance: 'discovered',
      confidence: 0.97,
      verificationStatus: 'provisional',
      verifiedBy: { kind: 'operator-ratification', decisionRef: 'test' },
      verifiedAt: '2026-07-25T00:00:00Z',
      evidence: [{ type: 'page-content', ref: 'test' }],
      rationale: 'test fixture',
    } as const satisfies DomainProfile;

    // THE assertion this whole phase exists to make. Even at 0.97 confidence:
    // classified as L3, never asserted, no context to render, and presented
    // as L4 -- §6.2's always-permitted implementation of L3.
    const r = classifyProfile(provisional);
    expect(r.level).toBe('L3');
    expect(r.reason).toBe('unverified');
    expect(r.assert, 'a provisional profile must NEVER be asserted').toBe(false);
    expect(r.overlayContext, 'a provisional profile must expose no context').toBeNull();
    expect(r.presentAs).toBe('L4');
    // It is still visible for inspection -- refused, not silently dropped.
    expect(r.profile).toBe(provisional);

    // Control: a verified profile does assert, so the test above is proving
    // refusal rather than a resolver that never asserts anything.
    expect(classifyProfile(resolveDomainProfile('metame.com')).assert).toBe(true);

    // Structural backstop: overlayContext is null whenever assert is false, so
    // a caller that ignores `assert` still cannot render an unverified context.
    for (const host of [...registeredHostnames(), 'google.com', '', null]) {
      const res = resolveDomain(host);
      if (!res.assert) expect(res.overlayContext).toBeNull();
    }
  });

  it('P3: the resolver carries no authorization verdict (D-22)', () => {
    // Composition never grants authority. A resolution that carried an
    // allow/deny would be a second access gate beside the Identity & Access
    // Spine -- the exact parallel-gate defect the SPEC forbids.
    const r = resolveDomain('metame.com') as Record<string, unknown>;
    for (const forbidden of ['allowed', 'permitted', 'authorized', 'verdict', 'personaId']) {
      expect(forbidden in r, `resolution carries "${forbidden}"`).toBe(false);
    }
  });

  it('P3: shapeForDomain consumes the resolver rather than the registry directly', () => {
    // A resolver nothing consumes is the "shipped but unwired" defect. The
    // overlay's only path to a context must run through the precedence rules.
    const src = readFileSync(
      join(__dirname, '../services/companion/overlayMapping.ts'),
      'utf8',
    );
    expect(src).toContain('assertedContextFor');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code, 'shapeForDomain bypasses the resolver').not.toContain(
      'overlayContextForDomain',
    );
    // And the wired path still produces the same answers.
    expect(shapeForDomain('coinbase.com')).toBe('financial-context');
    expect(assertedContextFor('coinbase.com')).toBe('financial-context');
    expect(shapeForDomain('google.com')).toBeNull();
  });

  it('the capability table stays exhaustive over the renamed shape', () => {
    // Keyed by OverlayShape, so a renamed or added context that forgets this
    // table is a compile error -- this pins the runtime side of that contract.
    expect(Object.keys(SHAPE_CAPABILITY_IDS).sort()).toEqual(
      ['financial-context', 'github-repo'],
    );
    expect(SHAPE_CAPABILITY_IDS['financial-context']).toContain(
      'cap-moneypenny-financial-services',
    );
  });
});
