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
 *  - STEP_UP_POLICY / GRADE_RANK (the canonical risk→grade binding,
 *    PRD-PAG-001 Amendment A §A.6) pinned as the source of truth, incl.
 *    money-moving = world_id and grade monotonicity:
 *      tests/passport-step-up-policy.test.ts
 *  - CFS-009 Law XVI's ratified text ↔ CFS-052's reproduction of it, and
 *    COMMONS_PROOF_CLASSES ↔ the four proof classes Amendment D §D.1 ratified.
 *    Constitutional text mirrored across two documents and one constant, none
 *    derivable from the others:
 *      tests/evidence-architecture.test.ts
 *  - The CCR-001 completion-artifact template's machine-read headings ↔ the
 *    section names `parseCompletionArtifact` looks for ↔ the reference
 *    artifact's own headings. A docs-file mirror that cannot be derived: if the
 *    template renames a heading the parser reads, artifacts authored from it
 *    parse to empty and validate as incomplete for no visible reason:
 *      tests/capability-completion.test.ts
 *  - DISCOVERY_DOMAINS (the Discovery Domain Registry, PRD-IDE-002) ↔ the
 *    discovery route's sub-domain presets + default domain, CorpusScoutTab's
 *    KNOWN_DOMAINS, and InvariantDiscoveryTab's default domain -- one list that
 *    used to be hand-copied into three surfaces. Plus the PRD's §4 taxonomy
 *    table and its verbatim constitutional definition, mirrored in a docs file
 *    that cannot be derived from the code:
 *      tests/commercialisation-discovery.test.ts
 *  - The CB-1…CB-7 clause statements (CFS-053 §4) ↔ the canary's own copy of
 *    the operator's ruling, and the mechanism-binding registry ↔ CFS-053 §8.1's
 *    table of the same. Constitutional text mirrored across a document and a
 *    hand-maintained registry, neither derivable from the other — plus the
 *    check that no constitutional text names a canary file that does not exist,
 *    which is `inv.engineering.036`'s failure mode applied to ENFORCEMENT
 *    rather than to data (a rule with two homes, one of which is empty):
 *      tests/constitutional-binding.test.ts
 *  - ProvenanceClass (the ONE evidence-provenance vocabulary,
 *    services/corpusScout/types.ts) ↔ the provenance_class CHECK on
 *    corpus_candidate_sources (SQL, latest rebuild) ↔ the
 *    POPULATION_BY_EVIDENCE_PROVENANCE map, which the Record type keeps
 *    exhaustive. Plus the A/B/C partition DERIVED from that one vocabulary
 *    rather than re-listed in crystalReadiness, which used to keep its own copy
 *    of the eligible set:
 *      tests/evidence-provenance-populations.test.ts
 *  - DISCOVERY_DOMAINS[].namespace (the Discovery Domain Registry) ↔ the
 *    namespace promoteCandidate actually passes to discoverInvariant -- a
 *    hardcoded 'constitutional' literal that shadowed the registry, asserted by
 *    CALLING the promotion rather than by reading the registry value:
 *      tests/evidence-provenance-populations.test.ts
 *  - RequestedAction (TS union, connectionChallenge.ts) ↔ the
 *    requested_action CHECK on passport_connection_challenges (SQL, latest
 *    rebuild) -- the constraint-drift bug class:
 *      tests/passport-passkey.test.ts
 *
 * Canaries defined IN this file:
 *  - ASSIGNABLE_EXPERIMENTS ↔ EXPERIMENT_REGISTRY
 *  - EXP-P2 consequence family (ruling 2026-07-27): `instantiationOf` ↔ the CEF
 *    series `members`; the shared constitutional framework defined once and
 *    restated in neither instantiation; the RSS-001 admissibility gate citing
 *    only sections that exist in RSS-001; both programme views recorded and
 *    distinguishable; nothing rendered as a designed protocol
 *  - SPEC-CDR-001 execution taxonomy (D-1): EXECUTION_DOMAINS ↔
 *    FINANCIAL_DOMAINS ↔ the SPEC §3 docs mirror, plus the §4.2
 *    non-executability rule for governance domains
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EXPERIMENT_REGISTRY, SERIES_REGISTRY } from '../types/research';
import { ASSIGNABLE_EXPERIMENTS } from '../services/passport/participationAccess';
import { FINANCIAL_DOMAINS } from '../services/constitutional/financialIntelligenceExecutor';
import { EXECUTION_DOMAINS, isExecutionDomain } from '../services/resolution/executionTaxonomy';
import {
  DOMAIN_PROFILES,
  registeredHostnames,
  resolveDomainProfile,
  overlayContextForDomain,
} from '../services/resolution/domainProfileRegistry';
import { shapeForDomain } from '../services/companion/overlayMapping';
import {
  CAPABILITY_MODULE_IDS,
  capabilityModule,
  capabilityIdsForModules,
  moduleAllowsAction,
  modulePosture,
} from '../services/resolution/capabilityModules';
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

  it('P4: every seed names financial-intelligence and nothing else (migration-equivalent)', () => {
    // Naming a shadow-only or governance module on a seed would be NEW
    // behaviour, which P4 was not authorised to add.
    for (const profile of DOMAIN_PROFILES) {
      expect(profile.capabilityModules).toEqual(['financial-intelligence']);
    }
  });

  it('P4: module posture DERIVES from the execution taxonomy, never restated', () => {
    // A module cannot claim to be authoritative while its execution domain is
    // shadow-only, because it holds no copy of that fact.
    for (const id of CAPABILITY_MODULE_IDS) {
      const def = capabilityModule(id);
      const posture = modulePosture(id);
      if (def.executionDomain) {
        const shipped = EXECUTION_DOMAINS.find((d) => d.id === def.executionDomain)!;
        expect(posture, `${id} posture drifted from ${def.executionDomain}`).toBe(shipped.posture);
      } else {
        // Governance modules are non-executable BY CLASS (D-2/D-3) -- not an
        // execution surface awaiting a flip.
        expect(def.governanceDomain, `${id} has neither domain`).toBeTruthy();
        expect(posture).toBe('non-executable');
      }
    }
  });

  it('P4: only an authoritative module may present an action (D-11 firewall)', () => {
    for (const id of CAPABILITY_MODULE_IDS) {
      expect(moduleAllowsAction(id)).toBe(modulePosture(id) === 'authoritative');
    }
    // Concretely: the two money-moving domains are shadow-only, so neither may
    // render an affordance -- the presentation half of the Domain 1/2 pause.
    expect(moduleAllowsAction('investment-operations')).toBe(false);
    expect(moduleAllowsAction('market-operations')).toBe(false);
    expect(moduleAllowsAction('constitutional-financial-integrity')).toBe(false);
    expect(moduleAllowsAction('constitutional-commerce')).toBe(false);
    expect(moduleAllowsAction('financial-intelligence')).toBe(true);
  });

  it('P4: no governance module renders unless a profile names it', () => {
    const named = new Set(DOMAIN_PROFILES.flatMap((p) => [...p.capabilityModules]));
    expect(named.has('constitutional-financial-integrity')).toBe(false);
    expect(named.has('constitutional-commerce')).toBe(false);
  });

  it('P4: capability ids hang off modules, not a second shape table', () => {
    const src = readFileSync(
      join(__dirname, '../services/companion/overlayMapping.ts'),
      'utf8',
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toContain('SHAPE_CAPABILITY_IDS');
    expect(code).not.toContain('capabilityIdsForShape');
    expect(capabilityIdsForModules(['financial-intelligence'])).toEqual([
      'cap-moneypenny-financial-services',
      'financial-services-capability-suite',
    ]);
    expect(capabilityIdsForModules([])).toEqual([]);
  });

  it('P4: a profile still asserts no execution domain, even naming modules', () => {
    // The point of P4-1: naming a module is a PRESENTATION assertion. If it
    // ever became an execution claim, section 0.3's hazard is back.
    for (const profile of DOMAIN_PROFILES) {
      expect('executionDomains' in profile).toBe(false);
      expect(profile.capabilityModules.length).toBeGreaterThan(0);
    }
  });
});

describe('Laboratory ↔ EXPERIMENT_REGISTRY parity (the EXP-P3 drift, 2026-07-27)', () => {
  // WHAT WENT WRONG. `InvariantExperimentLab` hand-authors its navigator —
  // grouping and one-line overviews — because several entries have no registry
  // id and cannot be derived. That is legitimate. What is NOT legitimate is a
  // hand-authored entry whose EXPERIMENT ID has been reassigned underneath it:
  // when EXP-P3 was reassigned from Capability Validation to Representation of
  // Structural Invariants, the Lab kept presenting the capability RUNNER under
  // the EXP-P3 designation, so the Laboratory showed one experiment while the
  // registry, the docs, and the partner packet said another (operator: "EXP P3
  // is still showing the old experiment").
  //
  // These pin the join, not the prose — labels are deliberately shorter than
  // registry families and must stay free to differ.
  const LAB = 'components/composer/InvariantExperimentLab.tsx';

  function itemExperimentMap(src: string): Record<string, string> {
    const block = src.slice(
      src.indexOf('const ITEM_EXPERIMENT'),
      src.indexOf('};', src.indexOf('const ITEM_EXPERIMENT')),
    );
    const out: Record<string, string> = {};
    for (const m of block.matchAll(/["']?([\w-]+)["']?:\s*"([A-Z]+-[\w-]+)"/g)) {
      out[m[1]] = m[2];
    }
    return out;
  }

  it('every experiment id the Lab mounts exists in the registry', () => {
    const ids = new Set(EXPERIMENT_REGISTRY.map((e) => e.id));
    const map = itemExperimentMap(stripComments(readSource(LAB)));
    expect(Object.keys(map).length).toBeGreaterThan(5); // guards a vacuous parse
    for (const [tab, expId] of Object.entries(map)) {
      expect(ids.has(expId), `Lab tab '${tab}' mounts unknown experiment '${expId}'`).toBe(true);
    }
  });

  it('a reserved P-slot is never bound to a renumbered legacy harness', () => {
    // The four core designations are reserved. EXP-P1 has a harness; P2/P3/P4
    // do not, so they must NOT be hand-mounted — that way their panel text is
    // read from EXPERIMENT_REGISTRY and cannot go stale. The two legacy
    // harnesses belong to the renumbered ids.
    const map = itemExperimentMap(stripComments(readSource(LAB)));
    const mounted = new Set(Object.values(map));
    expect(mounted.has('EXP-P1')).toBe(true);
    for (const reserved of ['EXP-P2', 'EXP-P3', 'EXP-P4']) {
      expect(
        mounted.has(reserved),
        `${reserved} is hand-mounted in the Lab — it has no runner, so its panel must come from the registry`,
      ).toBe(false);
    }
    expect(map.vp2, 'the structural-invariance harness is not bound to EXP-011').toBe('EXP-011');
    expect(map.vp3, 'the capability harness is not bound to EXP-012').toBe('EXP-012');
  });

  it('no hand-authored Lab label claims a designation the map assigns elsewhere', () => {
    // The precise drift: a label reading "EXP-P3 · …" while the entry is bound
    // to a different id (or vice versa). Label prefix and mapped id must agree.
    const src = stripComments(readSource(LAB));
    const map = itemExperimentMap(src);
    const labels = [...src.matchAll(/\{\s*id:\s*"([\w:-]+)",\s*label:\s*"([^"]+)"/g)];
    expect(labels.length).toBeGreaterThan(5);
    for (const [, tabId, label] of labels) {
      const prefix = label.match(/^([A-Z]+-[\w]+)\s*·/)?.[1];
      if (!prefix) continue; // labels without a designation are free text
      const mappedId = map[tabId];
      if (!mappedId) continue; // unmapped entries carry no registry claim
      expect(
        prefix,
        `Lab tab '${tabId}' is labelled '${prefix}' but mounts '${mappedId}'`,
      ).toBe(mappedId);
    }
  });
  it('Canary 2 — the foundational slots are reserved to their programme focus', () => {
    // P1 Compression → P2 Consequence → P3 Representation → P4 Interaction.
    // The family carries the programme focus FIRST so every surface that renders
    // a family reads the sequence; the protocol title may follow after a dash.
    const byId = new Map(EXPERIMENT_REGISTRY.map((e) => [e.id, e]));
    // Focus and protocol title are SEPARATE fields (operator, 2026-07-27):
    // forcing them into one label made them read as competing descriptions.
    // The slot is pinned on `programmeFocus`; `family` stays the protocol title
    // and is deliberately NOT asserted to contain the focus.
    const FOCUS: Record<string, string> = {
      'EXP-P1': 'Reasoning Compression',
      'EXP-P2': 'Consequential Performance',
      'EXP-P3': 'Representation',
      'EXP-P4': 'Interaction',
    };
    for (const [id, focus] of Object.entries(FOCUS)) {
      const entry = byId.get(id);
      expect(entry, `${id} is missing from the registry`).toBeTruthy();
      expect(entry!.programmeFocus, `${id} does not declare its programme focus`).toBe(focus);
      expect(entry!.family, `${id} has no protocol title`).toBeTruthy();
      // A displaced design must never reclaim a foundational slot.
      expect(entry!.formerly, `${id} carries renumbering lineage — a P-slot must not be a renumbered design`).toBeUndefined();
    }
  });

  it('only the foundational slots carry a programme focus', () => {
    // The focus names a role in the four-part sequence. An experiment outside
    // that sequence declaring one would imply a fifth slot.
    for (const e of EXPERIMENT_REGISTRY) {
      if (e.programmeFocus) {
        expect(['EXP-P1', 'EXP-P2', 'EXP-P3', 'EXP-P4'], `${e.id} declares a programme focus`).toContain(e.id);
      }
    }
  });

  it('the Laboratory renders focus in the series list and title in the detail view', () => {
    // Two truths, two contexts. A list entry reads EXP-P1 · Reasoning
    // Compression; the panel leads with the protocol title and carries the
    // focus as metadata beneath it.
    const lab = stripComments(readSource(LAB));
    expect(lab, 'the series list does not prefer the programme focus').toMatch(
      /label: `\$\{e\.id\} · \$\{e\.programmeFocus \?\? e\.family\}`/,
    );
    expect(lab).toMatch(/programmeFocus=\{reg\?\.programmeFocus\}/);
    const panel = stripComments(readSource('components/composer/ExperimentDesignStagePanel.tsx'));
    expect(panel, 'the detail panel does not lead with the protocol title').toMatch(
      /\{experimentId\} · \{family\}/,
    );
    expect(panel, 'the detail panel does not carry the focus as metadata').toMatch(
      /Foundational focus:/,
    );
  });

  it('Canary 5 — EXP-P4 stays a reservation, not an experiment', () => {
    const p4 = EXPERIMENT_REGISTRY.find((e) => e.id === 'EXP-P4')!;
    // Declared reserved in both the family and the hypothesis, so no surface can
    // render it as an active design by reading either one.
    expect(p4.family).toMatch(/RESERVED/);
    expect(p4.hypothesis).toMatch(/^RESERVED/);
    // No runner may be bound to it.
    const map = itemExperimentMap(stripComments(readSource(LAB)));
    expect(Object.values(map)).not.toContain('EXP-P4');
    // Its reference is a reservation note, never a protocol set.
    expect(p4.protocolRef).toContain('exp-p4-invariant-interaction');
    const note = readSource(p4.protocolRef);
    expect(note, 'the P4 note does not declare itself a reservation').toMatch(/RESERVED/);
    expect(note, 'the P4 note reads as a design').toMatch(/reservation, not a design/i);
    // The candidate topics must stay candidates — not settled scope.
    expect(note).toMatch(/candidates, not scope/i);
    // And it must not claim results or predictions.
    expect(/\bpredictions:/i.test(note)).toBe(false);
  });

  it('Canary 6 — the canonical documentation joins are pinned', () => {
    const byId = new Map(EXPERIMENT_REGISTRY.map((e) => [e.id, e]));
    const JOINS: Record<string, string> = {
      'EXP-P2': 'exp-p2-consequential-performance',
      'EXP-P2A': 'exp-p2a-software-consequences',
      'EXP-P2B': 'exp-p2b-physical-consequences',
      'EXP-P3': 'exp-p3-representation-of-structural-invariants',
      'EXP-P4': 'exp-p4-invariant-interaction',
      'EXP-011': 'exp-011-structural-invariance',
      'EXP-012': 'exp-012-capability-validation',
    };
    for (const [id, dir] of Object.entries(JOINS)) {
      const ref = byId.get(id)!.protocolRef;
      expect(ref, `${id} protocolRef does not point at ${dir}`).toContain(dir);
      // The referenced document must actually exist — a dangling join is the
      // same failure as a stale one, just quieter.
      expect(() => readSource(ref), `${id} protocolRef does not resolve on disk`).not.toThrow();
    }
  });

  it('Canary 7 — the renumbered designs keep their lineage and stay out of the P-series', () => {
    const byId = new Map(EXPERIMENT_REGISTRY.map((e) => [e.id, e]));
    for (const [id, was] of [['EXP-011', 'EXP-P2'], ['EXP-012', 'EXP-P3']] as const) {
      const e = byId.get(id)!;
      expect(e.formerly, `${id} lost its lineage metadata`).toBe(was);
      // Never silently returned to the foundational grouping.
      expect(e.seriesId, `${id} is back in the foundational series`).not.toBe('VP1');
      expect(e.seriesId).toBe('SCS');
      // The document itself must state the lineage in words too.
      const doc = readSource(e.protocolRef);
      expect(doc, `${id} has no lineage banner`).toMatch(
        new RegExp(`Formerly designated ${was}`),
      );
    }
    // The foundational series holds exactly the four reserved slots.
    const vp1 = SERIES_REGISTRY.find((x) => x.id === 'VP1')!;
    expect(vp1.members).toEqual(['EXP-P1', 'EXP-P2', 'EXP-P3', 'EXP-P4']);
    const scs = SERIES_REGISTRY.find((x) => x.id === 'SCS')!;
    expect(scs.members).toEqual(['EXP-011', 'EXP-012']);
  });
});

/**
 * EXP-P2 consequence family (operator ruling, 2026-07-27).
 *
 * WHAT THE RULING DID. P2 stopped being one monolithic protocol and became "a
 * family of consequence experiments that share the same constitutional
 * framework but operate in different consequence domains" — P2A software, P2B
 * physical. Three things about that are exactly the shape this file exists to
 * guard:
 *
 *  1. A SHARED framework with two consumers is one authoritative location with
 *     two references (inv.engineering.036). Copied into two experiment
 *     documents it diverges, and the divergence is invisible until the two
 *     experiments disagree about what they were measuring.
 *  2. The family membership is expressed TWICE by necessity — as
 *     `instantiationOf` on each member and as `members` on the series — so the
 *     two must be pinned against each other.
 *  3. The ruling records TWO views of the programme (conceptual numbering;
 *     methodological dependency through P3/RSS-001) and explicitly denies that
 *     the second renumbers the first. A reader who collapses them concludes P3
 *     precedes P2 in the programme, which the ruling denies in the same breath.
 */
describe('EXP-P2 consequence family (operator ruling 2026-07-27)', () => {
  const P2_DIR = 'codexes/packs/irl/foundation/experiments/exp-p2-consequential-performance';
  const FAMILY_INDEX = `${P2_DIR}/README.md`;
  const FRAMEWORK = `${P2_DIR}/01_shared-constitutional-framework.md`;
  const RSS =
    'codexes/packs/irl/foundation/experiments/exp-p3-representation-of-structural-invariants/03_RSS-001_representation-science-standard.md';

  const p2 = () => EXPERIMENT_REGISTRY.find((e) => e.id === 'EXP-P2')!;
  const instantiations = () => EXPERIMENT_REGISTRY.filter((e) => e.instantiationOf === 'EXP-P2');
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');

  it('family membership is derived from instantiationOf, not maintained as a second list', () => {
    const derived = instantiations().map((e) => e.id);
    expect(derived).toEqual(['EXP-P2A', 'EXP-P2B']);
    const cef = SERIES_REGISTRY.find((s) => s.id === 'CEF');
    expect(cef, 'the consequence family has no series').toBeTruthy();
    // The series list and the per-experiment field are two statements of one
    // fact; drift between them is the defect, so they are pinned to each other.
    expect(cef!.members).toEqual(derived);
    for (const e of instantiations()) expect(e.seriesId).toBe('CEF');
  });

  it('an instantiation is never a foundational slot, and never a renumbering of one', () => {
    const ids = new Set(EXPERIMENT_REGISTRY.map((e) => e.id));
    const vp1 = SERIES_REGISTRY.find((s) => s.id === 'VP1')!;
    expect(instantiations().length).toBeGreaterThan(0); // guards a vacuous loop
    for (const e of instantiations()) {
      expect(ids.has(e.instantiationOf!), `${e.id} instantiates an unregistered id`).toBe(true);
      expect(e.instantiationOf, `${e.id} instantiates itself`).not.toBe(e.id);
      // The focus belongs to the SLOT. An instantiation declaring one would
      // imply a fifth foundational question.
      expect(e.programmeFocus, `${e.id} claims a programme focus`).toBeUndefined();
      expect(vp1.members, `${e.id} sits in the foundational series`).not.toContain(e.id);
      // Instantiation is NOT renumbering: the parent slot still exists and
      // still holds the constitutional question. `formerly` would say P2 moved.
      expect(e.formerly, `${e.id} claims to be its parent renumbered`).toBeUndefined();
    }
    // Conversely: a foundational slot instantiates nothing.
    for (const id of ['EXP-P1', 'EXP-P2', 'EXP-P3', 'EXP-P4']) {
      const slot = EXPERIMENT_REGISTRY.find((e) => e.id === id)!;
      expect(slot.instantiationOf, `${id} is registered as an instantiation`).toBeUndefined();
    }
    // The slot kept the question and the focus when the family formed.
    expect(p2().programmeFocus).toBe('Consequential Performance');
    expect(p2().hypothesis).toMatch(/improve consequential task performance/);
    expect(p2().hypothesis).toMatch(/equivalent informational content/);
  });

  it('the RSS-001 admissibility gate cites sections that really exist in RSS-001', () => {
    // Citing an invented section id is the failure this catches: it reads as a
    // real methodological binding and resolves to nothing.
    const headings = new Set(
      [...readSource(RSS).matchAll(/^#{1,4}\s+§?([\w.]+)/gm)].map((m) => m[1]),
    );
    expect(headings.size, 'RSS-001 headings did not parse').toBeGreaterThan(20);
    const framework = readSource(FRAMEWORK);
    const cited = new Set([...framework.matchAll(/RSS-001 §([\w.]+)/g)].map((m) => m[1]));
    expect(cited.size, 'the gate cites almost nothing').toBeGreaterThanOrEqual(8);
    for (const c of cited) {
      expect(headings.has(c), `the gate cites RSS-001 §${c}, which is not a section of RSS-001`).toBe(true);
    }
    // The ruling names five certification steps; all five must be present.
    for (const step of [
      'Atomic Content Mapping',
      'Informational Equivalence',
      'Tiered Computational Equivalence',
      'Representation Certification',
      'Assumption Back-Propagation',
    ]) {
      expect(framework, `the gate omits the step '${step}'`).toContain(step);
    }
    // It is a PRECONDITION of entry, not an outcome measured inside the run.
    expect(framework, 'the gate is not stated as a precondition').toMatch(/precondition of admissibility/i);
    // And RSS-001 records the downstream adoption, so the join is discoverable
    // from the standard's end too — without a second copy of the mapping.
    expect(readSource(RSS), 'RSS-001 does not record its downstream adoption').toContain(
      '01_shared-constitutional-framework.md',
    );
  });

  it('every instantiation declares the gate and defers to the shared framework', () => {
    expect(instantiations().length).toBeGreaterThan(0);
    for (const e of instantiations()) {
      const doc = readSource(e.protocolRef);
      expect(doc, `${e.id} does not declare RSS-001 certification`).toMatch(/RSS-001 certification/);
      expect(doc, `${e.id} does not state admissibility`).toMatch(/admissible/i);
      expect(doc, `${e.id} does not point at the shared framework`).toContain(
        '01_shared-constitutional-framework.md',
      );
    }
  });

  it('the seven shared concerns are defined in one place and restated in neither instantiation', () => {
    const framework = readSource(FRAMEWORK);
    const concerns = [...framework.matchAll(/^### §\d+ (.+)$/gm)].map((m) => m[1].trim());
    // The ruling's own list, in its own words and order.
    expect(concerns.map((c) => c.split(' — ')[0].toLowerCase())).toEqual([
      'constitutional principles',
      'claims discipline',
      'representation certification',
      'statistical analysis',
      'decision procedure',
      'audit framework',
      'information equivalence',
    ]);
    for (const e of instantiations()) {
      const doc = readSource(e.protocolRef);
      for (const c of concerns) {
        const name = c.split(' — ')[0];
        expect(
          new RegExp(`^#{1,6}\\s.*${escape(name)}`, 'im').test(doc),
          `${e.id} takes the shared concern '${name}' as its own section instead of referencing the framework`,
        ).toBe(false);
      }
    }
  });

  it('both programme views are recorded, and neither can be read as the other', () => {
    const idx = readSource(FAMILY_INDEX);
    // View 1 — the conceptual sequence. The numbering did NOT change.
    expect(idx, 'the conceptual sequence is missing').toMatch(
      /P1 Compression\s*→\s*P2 Consequence\s*→\s*P3 Representation\s*→\s*P4 Interaction/,
    );
    expect(idx).toMatch(/numbering should remain P1 → P2 → P3 → P4/);
    // View 2 — the methodological dependency, which runs through P3/RSS-001.
    expect(idx, 'the methodological dependency is missing').toMatch(
      /P3 Representation Science\s*→\s*RSS-001 Certification/,
    );
    expect(idx).toMatch(/methodological dependency now runs through P3/);
    // The distinction itself must be stated. Without it the dependency graph
    // reads as a reordering of the programme — which the ruling denies.
    expect(idx, 'the index never denies the renumbering reading').toMatch(/not a renumbering/i);
    // And the registry agrees with view 1: order preserved, no slot renumbered.
    expect(SERIES_REGISTRY.find((s) => s.id === 'VP1')!.members).toEqual([
      'EXP-P1', 'EXP-P2', 'EXP-P3', 'EXP-P4',
    ]);
  });

  it('nothing in the family is presented as a designed protocol', () => {
    // The framework was set up from a ruling; the protocol comes later, from
    // the operator. A later reader must be able to tell the two apart, and the
    // registry must not let a surface render these as designed experiments.
    for (const e of [p2(), ...instantiations()]) {
      expect(e.hypothesis, `${e.id} does not declare its protocol pending`).toMatch(/PROTOCOL PENDING/);
      expect(readSource(e.protocolRef), `${e.protocolRef} does not mark itself pending`).toContain(
        'PENDING OPERATOR PROTOCOL',
      );
    }
    // The family holds no protocol by design — only the shared framework.
    expect(readSource(FAMILY_INDEX)).toMatch(/carries no experimental protocol/i);
  });
});
