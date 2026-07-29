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
 *  - The Companion extension ID DERIVED from manifest.json's pinned `key`
 *    (Chromium's own sha256/first-16-bytes/a-p mapping) ↔ the
 *    `chrome-extension://` origin in configs/embed/policy.v1.json's
 *    frame-ancestors allowlist. Two places name one identity: the ID a partner
 *    reads off chrome://extensions to verify their load-unpacked install, and
 *    the origin the platform trusts to frame its surfaces. Drift here breaks
 *    pairing in a way that is near-undiagnosable from the partner's side.
 *    The distribution bundle is likewise DERIVED (read from
 *    extension/companion-observer/ at request time, never a committed zip):
 *      tests/companion-extension-artifact.test.ts
 *  - The ERC-8004 agent-binding model (services/horizen/agentBinding.ts) ↔ the
 *    agent_identity_bindings schema. Four things that cannot be derived from
 *    each other and must not drift: the four AgentAuthorityFacets ↔ four
 *    NON-GENERATED boolean columns (a GENERATED column would BE the collapse
 *    the operator ruled against); the four AgentBindingStatus values ↔ the
 *    status CHECK; the network-qualified uniqueness (network, chain_id,
 *    token_id) — a unique index on token_id alone would silently merge two
 *    different agents; and the canonical claim message, pinned byte-exact as a
 *    fixture because a signature is over those exact bytes:
 *      tests/horizen-agent-binding.test.ts
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
 *    parse to empty and validate as incomplete for no visible reason. The same
 *    file also owns the capability-artefact VERSION parity canary (operator
 *    ruling 2026-07-28): CAPABILITY_COMPLETION_SCHEMA_VERSION is the one source
 *    of truth, and CFS-049, CCR-001, the CCA template and the type's own header
 *    must state it and must not still state a superseded version — the expected
 *    string is DERIVED from the constant, never hand-copied, because a hand-copy
 *    would be a fourth home for the fact. Found stale after the v2.0 bump:
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
 *  - The Institutional Registry TEMPLATE (SPEC-CIR-001,
 *    services/corpusScout/institutionalRegistry.ts) ↔ the two seed migrations
 *    that put its rows in the database (20260817000000 financial-services,
 *    20260827000000 commercialisation), ↔ the operator-supplied URLs in
 *    canonicalInstitutionHomepages.ts, ↔ PRD-IDE-002 §4's pillars and §11.2's
 *    acquisition-gap order, ↔ discoveryDomains' tangentialDomains. ONE template
 *    serves both domains on purpose: a template Commercialisation uses and
 *    Financial Services does not is two registries again. Also the home of the
 *    Law II diversity check, asserted by DRIVING getDomainConstitution rather
 *    than by reading the source for a call:
 *      tests/commercialisation-institutional-registry.test.ts
 *  - An INSTITUTION ↔ its institutional TRADITION. One institution has ONE
 *    tradition, however many pillars it serves (operator ruling 2026-07-28:
 *    "Diversity checks should not count one institution three times as
 *    independent traditions"). `institutionTraditionConflicts` is the mechanism;
 *    the canary asserts its result equals an EXACT pending-ruling set, so a new
 *    multi-tradition institution fails the build rather than quietly inflating
 *    Law II. `assessRegistryDiversity` carries the same rule at the counting end
 *    by deduplicating rows by institution:
 *      tests/commercialisation-institutional-registry.test.ts
 *  - A `CFS-0NN` designation ↔ the document that carries it ↔ its registration
 *    in `codexes/packs/irl/collections.json`. A designation is one concern with
 *    three homes, and CFS-048 sat with two of them empty: twelve source files and
 *    six foundation documents cited it as a foundation filing that git history
 *    shows was never created, while the real charter sat in the agentiq updates
 *    pack. Writing the check found CFS-045 in the same state; the operator ruled
 *    it a contiguous filing defect across CFS-045…CFS-048 and all four were filed
 *    on 2026-07-28. Every cited designation must resolve to a real document AND
 *    through the foundation REGISTRY (disk presence alone resolves for a reader
 *    with a checkout and for nobody else), or carry a relocation claim that is
 *    itself proven (path exists, filename and title carry the id, the target is
 *    the charter and not a phase record), is earned by a real citation, and
 *    expires the moment the document IS filed. The claim contract is exercised
 *    against synthetic known-bad claims so an EMPTY exception list never means an
 *    unenforced one (CFS-053 CB-1):
 *      tests/canon-document-resolution.test.ts
 *  - RequestedAction (TS union, connectionChallenge.ts) ↔ the
 *    requested_action CHECK on passport_connection_challenges (SQL, latest
 *    rebuild) -- the constraint-drift bug class:
 *      tests/passport-passkey.test.ts
 *  - A RESEARCH WORKSPACE ↔ its SERIES_REGISTRY series ↔ the spine projection ↔
 *    the client surface. One programme with four readers: the registry declares
 *    only the instance (id, series id, layer owners, links) and DERIVES name,
 *    claim, members and objectives from SERIES_REGISTRY / EXPERIMENT_REGISTRY;
 *    `experimentWorkspaceFromResearch` and `PartnerProgrammesTab` both consume
 *    those same derivation helpers, because the client cannot import the spine
 *    (it reaches Supabase, the ontology resolver and the invariant store) and a
 *    second projection in the surface layer would drift. Also the home of the
 *    reachability triple ruling A requires — positive, read-only, fail-closed —
 *    asserted as EXACT slug sets rather than counts:
 *      tests/research-lab-workspace.test.ts
 *  - ASSIGNABLE_RESEARCH_WORKSPACES ↔ RESEARCH_WORKSPACES, and its COMPOSITION
 *    with ASSIGNABLE_EXPERIMENTS in the steward route. A workspace that no
 *    invitation can be scoped to is grantable to nobody, which is invisible to
 *    every denial canary:
 *      tests/research-lab-workspace.test.ts
 *  - The VL-CT-001 venture substrate's THREE declarations of one vocabulary:
 *    VENTURE_RECEIPT_ACTION_TYPES (the emitter's own list) ↔ the
 *    ActivityActionType union ↔ ANCHORABLE_ACTION_TYPES. A venture receipt type
 *    present in the emitter but absent from the anchorable set writes a receipt
 *    that is never anchored — the ledger's whole claim (that a correct refusal
 *    earned compensation) then rests on an unanchored database row. The SQL
 *    CHECK-constraint leg is covered by the existing action-type parity canary
 *    indexed above. The same file carries the V-10 Standing-neutrality parity
 *    check the gap register requires: no Standing input derives from executed-
 *    trade count, notional or fee revenue, asserted against a HAND-WRITTEN list
 *    of the seven prohibited commercial metrics (deriving it from the module's
 *    own constant would only prove the module equals itself), plus a pin on the
 *    existing veracity-led composition in services/standing/standingScore.ts so
 *    a trading-outcome term added there fails the build:
 *      tests/venture-trading-substrate.test.ts
 *
 * Canaries defined IN this file:
 *  - ASSIGNABLE_EXPERIMENTS ↔ EXPERIMENT_REGISTRY
 *  - EXP-P2 consequence family (ruling 2026-07-27) and the v0.5 protocol:
 *    `instantiationOf` ↔ the CEF series `members`; v0.5 as the ONE authoritative
 *    text, so no framework doc reproduces a normative sentence of it outside an
 *    attributed quotation; every `⟦…⟧` parameter placeholder survives unresolved
 *    unless it cites the sealed pilot report that authorised the value, and no
 *    unpinned placeholder appears; §49's protected elements enforced against
 *    EVERY protocol draft in the directory (so a successor v0.6 is checked too),
 *    with §38's four non-droppable items cross-checked against §49's statuses;
 *    W2.5 kept out of the §41 aggregation rule and the primary multiplicity
 *    sequence; the programme stopping rule left unresolved with its missing
 *    source named, failing the moment a v0.2/v0.3 source appears; both programme
 *    views recorded and distinguishable; nothing rendered as preregistered
 *  - SPEC-CDR-001 execution taxonomy (D-1): EXECUTION_DOMAINS ↔
 *    FINANCIAL_DOMAINS ↔ the SPEC §3 docs mirror, plus the §4.2
 *    non-executability rule for governance domains
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EXPERIMENT_REGISTRY, SERIES_REGISTRY } from '../types/research';
import { CAPABILITY_COMPLETION_SCHEMA_VERSION } from '../types/capabilityCompletion';
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
 * EXP-P2 consequence family + the v0.5 protocol (operator, 2026-07-27).
 *
 * WHAT THIS GUARDS. EXP-P2 became "a family of consequence experiments that
 * share the same constitutional framework but operate in different consequence
 * domains", and the operator then supplied the full v0.5 protocol. v0.5 is now
 * the authoritative text; every other document in the family is a pointer.
 * Four failure modes, each with a canary below:
 *
 *  1. A framework doc RESTATES v0.5 prose, so a constitutional rule acquires a
 *     second home and the copies drift (inv.engineering.036).
 *  2. A `⟦…⟧` placeholder gets FILLED. v0.5's own notation rule is that no
 *     value or procedural choice is implied by a placeholder; a filled one is a
 *     fabricated experimental parameter that reads as a ratified one.
 *  3. A successor draft DROPS a protected element. v0.5 §49 says such a draft
 *     "fails constitutional review automatically" — that has to be mechanical,
 *     and it must fire on a FUTURE file, not just this one.
 *  4. W2.5, the diagnostic decomposition cell, LEAKS into the confirmatory
 *     path — into the §41 aggregation rule or the primary multiplicity
 *     sequence — and a diagnostic estimate gets reported as confirmatory.
 */
describe('EXP-P2 consequence family + v0.5 protocol (operator 2026-07-27)', () => {
  const P2_DIR = 'codexes/packs/irl/foundation/experiments/exp-p2-consequential-performance';
  const FAMILY_INDEX = `${P2_DIR}/README.md`;
  const FRAMEWORK = `${P2_DIR}/01_shared-constitutional-framework.md`;
  const PROTOCOL = `${P2_DIR}/02_protocol-v0.5.md`;
  const AMENDMENT = `${P2_DIR}/03_operational-amendment-v0.5.md`;
  const SAP = `${P2_DIR}/04_statistical-analysis-plan-skeleton.md`;
  const RECONCILIATION = `${P2_DIR}/06_stopping-rule-reconciliation.md`;
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
    expect(cef!.members).toEqual(derived);
    for (const e of instantiations()) expect(e.seriesId).toBe('CEF');
  });

  it('an instantiation is never a foundational slot, and never a renumbering of one', () => {
    const ids = new Set(EXPERIMENT_REGISTRY.map((e) => e.id));
    const vp1 = SERIES_REGISTRY.find((s) => s.id === 'VP1')!;
    expect(instantiations().length).toBeGreaterThan(0);
    for (const e of instantiations()) {
      expect(ids.has(e.instantiationOf!), `${e.id} instantiates an unregistered id`).toBe(true);
      expect(e.instantiationOf, `${e.id} instantiates itself`).not.toBe(e.id);
      expect(e.programmeFocus, `${e.id} claims a programme focus`).toBeUndefined();
      expect(vp1.members, `${e.id} sits in the foundational series`).not.toContain(e.id);
      expect(e.formerly, `${e.id} claims to be its parent renumbered`).toBeUndefined();
    }
    for (const id of ['EXP-P1', 'EXP-P2', 'EXP-P3', 'EXP-P4']) {
      const slot = EXPERIMENT_REGISTRY.find((e) => e.id === id)!;
      expect(slot.instantiationOf, `${id} is registered as an instantiation`).toBeUndefined();
    }
    expect(p2().programmeFocus).toBe('Consequential Performance');
    // The registered mechanism-level construct (v0.5 §7.3) must lead, with the
    // programme-facing constitutional question kept as framing, not as the claim.
    expect(p2().hypothesis).toMatch(/Condition-Directed Gated Verification Workflow/);
    expect(p2().hypothesis).toMatch(/improve consequential task performance/);
    expect(p2().hypothesis).toMatch(/equivalent informational content/);
    // The registry must resolve to the authoritative text, not to an index.
    expect(p2().protocolRef).toContain('02_protocol-v0.5.md');
  });

  it('v0.5 is the authoritative text: no framework document restates its prose', () => {
    // Pointers and attributed quotations are fine; silently re-authoring a
    // normative sentence in a second document is the defect. Blockquoted lines
    // are explicit citation and are exempt; everything else is checked.
    const protocolLines = new Set(
      readSource(PROTOCOL)
        .split('\n')
        .map((l) => l.replace(/[*`>|#_]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase())
        .filter((l) => l.split(' ').length >= 9),
    );
    expect(protocolLines.size, 'the protocol did not parse into sentences').toBeGreaterThan(50);
    for (const doc of [FAMILY_INDEX, FRAMEWORK, AMENDMENT, SAP, RECONCILIATION]) {
      for (const raw of readSource(doc).split('\n')) {
        if (raw.trimStart().startsWith('>')) continue; // attributed quotation
        const norm = raw.replace(/[*`>|#_]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        if (norm.split(' ').length < 9) continue;
        expect(
          protocolLines.has(norm),
          `${doc} reproduces a normative sentence of v0.5 outside a quotation:\n  ${norm}`,
        ).toBe(false);
      }
    }
  });

  it('every ⟦…⟧ parameter placeholder survives unresolved, or names a sealed pilot report', () => {
    // v0.5's parameter-notation rule: "No numerical value or procedural choice
    // is implied by a placeholder." Filling one without the sealed report that
    // authorises it fabricates an experimental parameter. The two generic ⟦…⟧
    // tokens are the notation's own self-reference, not parameters.
    const CONFIRMATORY_PLACEHOLDERS = [
      '⟦frozen after pilot⟧',
      '⟦insert preregistered text⟧',
      '⟦n_fabricated per arm × class⟧',
      '⟦to be frozen after pilot feasibility testing⟧',
      '⟦to be frozen before confirmation⟧',
      '⟦to be frozen⟧',
      '⟦δ_correct,A⟧',
      '⟦δ_correct,B⟧',
      '⟦δ_correct,d⟧',
      '⟦δ_effort,A⟧',
      '⟦δ_effort,B⟧',
      '⟦δ_effort,d⟧',
      '⟦δ_ni-effort,A⟧',
      '⟦δ_ni-effort,B⟧',
      '⟦δ_ni-effort,d⟧',
      '⟦δ_ni-fail,A⟧',
      '⟦δ_ni-fail,B⟧',
      '⟦δ_ni-fail,d⟧',
      '⟦θ_false-ready⟧',
      '⟦θ_proxy⟧',
    ];
    const doc = readSource(PROTOCOL);
    for (const ph of CONFIRMATORY_PLACEHOLDERS) {
      if (doc.includes(ph)) continue;
      // Lawful resolution: the parameter name appears on a line that also cites
      // the sealed pilot report which authorised the value.
      const name = ph.slice(1, -1);
      const resolved = doc
        .split('\n')
        .some((l) => l.includes(name) && /sealed pilot report/i.test(l));
      expect(
        resolved,
        `placeholder ${ph} was resolved without citing the sealed pilot report that authorised it`,
      ).toBe(true);
    }
    // No placeholder may be silently INTRODUCED either — but this must be a
    // subset check, not a count pin. A count pin would make the sealed-report
    // resolution path above unreachable (removing a resolved placeholder drops
    // the count), i.e. a rule whose only lawful exit can never be taken. Found
    // by mutation-testing the lawful path rather than only the unlawful one.
    const distinct = new Set((doc.match(/⟦[^⟧]*⟧/g) ?? []).filter((t) => t !== '⟦…⟧'));
    for (const ph of distinct) {
      expect(
        CONFIRMATORY_PLACEHOLDERS,
        `${ph} is a placeholder the canary does not know about — pin it or remove it`,
      ).toContain(ph);
    }
  });

  it('§49 protected elements are enforced against every protocol draft in the directory', () => {
    // v0.5 §49: a successor draft omitting a protected element "fails
    // constitutional review automatically". That has to be mechanical AND it
    // has to fire on a FUTURE draft, so this globs the directory rather than
    // naming one file — an inert check that can only ever see v0.5 would be the
    // latent-mechanism defect (CFS-053).
    const PROTECTED: Record<string, string> = {
      'Process recentering and P2/P3 boundary': 'Constitutional',
      'Null symmetry': 'Constitutional',
      'P2A/P2B family structure': 'Design',
      'W0–W3 ladder': 'Design',
      'W2 directed-review control': 'Non-droppable',
      'W2/W3 review-content equivalence audit': 'Non-droppable',
      'Representation Firewall': 'Non-droppable',
      'Tool/compute/pass parity': 'Design',
      'Condition-set independent authorship and validation': 'Design',
      'Effort decomposition': 'Design',
      'Structural modification count': 'Design',
      'Failure taxonomy and adjudication': 'Design',
      'Honest blinding limitation and mitigation': 'Design',
      'Acceptance threshold machinery': 'Design',
      'P2B fabrication anchor or explicit downgrade': 'Design',
      'P2A contamination controls and executable ground truth': 'Design',
      'Experimental unit': 'Design',
      'Decision and Falsification Procedure': 'Non-droppable',
      'Cross-domain aggregation rule': 'Non-droppable',
      'Programme stopping-rule linkage': 'Constitutional',
      'Bidirectional P2/P3 anti-goalpost clause': 'Constitutional',
      'Mechanism-level construct naming': 'Constitutional',
    };
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const dir = path.join(process.cwd(), P2_DIR);
    const drafts = fs.readdirSync(dir).filter((f) => /protocol-v[\d.]+\.md$/.test(f));
    expect(drafts.length, 'no protocol draft found to check').toBeGreaterThan(0);

    for (const draft of drafts) {
      const src = fs.readFileSync(path.join(dir, draft), 'utf8');
      const registry = src.slice(
        src.indexOf('## 49. Protected-element registry'),
        src.indexOf('## 50. Execution sequence'),
      );
      expect(registry.length, `${draft} has no §49 protected-element registry`).toBeGreaterThan(100);
      const rows = new Map(
        [...registry.matchAll(/^\| (.+?) \| (Constitutional|Design|Non-droppable) \|$/gm)].map(
          (m) => [m[1].trim(), m[2]] as const,
        ),
      );
      for (const [element, status] of Object.entries(PROTECTED)) {
        expect(rows.get(element), `${draft} drops protected element '${element}'`).toBe(status);
      }
      // §38 names four non-droppable items; every one must carry that status in
      // §49. Two sections of one document disagreeing is the same defect class.
      for (const element of [
        'Decision and Falsification Procedure',
        'W2 directed-review control',
        'Representation Firewall',
        'Cross-domain aggregation rule',
      ]) {
        expect(rows.get(element), `${draft} §49 downgrades a §38 non-droppable element`).toBe(
          'Non-droppable',
        );
      }
    }
  });

  it('W2.5 is diagnostic and never leaks into the confirmatory path', () => {
    const amendment = readSource(AMENDMENT);
    const protocol = readSource(PROTOCOL);
    const sap = readSource(SAP);

    // Defined in the amendment, not the frozen protocol.
    expect(amendment, 'W2.5 is not defined').toMatch(/W2\.5 — Enumerated Directed Review/);
    expect(amendment).toMatch(/[Dd]iagnostic, not confirmatory/);
    // Role and stage parity is a REQUIREMENT of the decomposition, not a note.
    expect(amendment, 'role/stage parity is not recorded').toMatch(/[Rr]ole and stage parity must be exact/);
    expect(amendment).toMatch(/requirement, not a note|not a recommendation/i);

    // Excluded from the cross-domain constitutional decision: it must not
    // appear anywhere in v0.5's §41 aggregation section.
    const agg = protocol.slice(
      protocol.indexOf('## 41. Cross-domain aggregation'),
      protocol.indexOf('## 42. Harmful and adverse results'),
    );
    expect(agg.length).toBeGreaterThan(100);
    expect(agg.includes('W2.5'), 'W2.5 leaked into the §41 aggregation rule').toBe(false);
    expect(amendment).toMatch(/[Ee]xcluded from the cross-domain constitutional decision/);

    // Excluded from the primary multiplicity sequence: the SAP's multiplicity
    // section must say so, and must not spend α on it.
    const mult = sap.slice(sap.indexOf('## S5. Multiplicity structure'), sap.indexOf('## S6.'));
    expect(mult.length).toBeGreaterThan(100);
    expect(mult, 'the SAP does not exclude W2.5 from the multiplicity sequence').toMatch(
      /Outside the sequence entirely|no α is spent/,
    );
    // And the SAP's frozen contrast table must mark the W2.5 contrasts as
    // diagnostic-only rather than confirmatory.
    const contrasts = sap.slice(sap.indexOf('## S2. Frozen contrast set'), sap.indexOf('## S3.'));
    for (const row of contrasts.split('\n').filter((l) => l.includes('W2.5'))) {
      if (!row.startsWith('|')) continue;
      expect(row, `a W2.5 contrast row is not marked diagnostic: ${row}`).toMatch(/Diagnostic/);
    }
  });

  it('the programme stopping rule is filed unresolved, naming the source that is missing', () => {
    // The instruction was to copy it faithfully from v0.2 §38 and its v0.3
    // binding "rather than reconstructed from memory". Neither document exists
    // in this repo, so the only honest artefact is an unresolved item that says
    // which source is absent. A plausible reconstruction would be
    // indistinguishable from the real thing to every future reader.
    const amendment = readSource(AMENDMENT);
    expect(amendment, 'the stopping-rule item is not marked unresolved').toMatch(
      /UNRESOLVED — Appendix C item 19/,
    );
    expect(amendment, 'the missing source is not named').toMatch(/v0\.2 §38/);
    expect(amendment).toMatch(/v0\.3 binding/);
    expect(amendment, 'the amendment does not disclaim reconstruction').toMatch(
      /[Nn]o reconstruction has been attempted/,
    );
    // The sources really are absent — if they are ever added, this fails and the
    // item can be filled from them rather than staying unresolved by habit.
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const sourceDir = path.join(
      process.cwd(),
      'codexes/packs/irl/foundation/experiments/_source',
    );
    const p2Sources = fs
      .readdirSync(sourceDir)
      .filter((f) => /exp-p2/i.test(f) && /v0\.[23]/.test(f));
    expect(
      p2Sources,
      'a v0.2/v0.3 P2 source now exists — fill Appendix C item 19 from it instead of leaving it unresolved',
    ).toEqual([]);
  });

  it('the seven shared concerns are indexed in one place and restated in neither instantiation', () => {
    const framework = readSource(FRAMEWORK);
    const concerns = [...framework.matchAll(/^### §\d+ (.+)$/gm)].map((m) => m[1].trim());
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
          `${e.id} takes the shared concern '${name}' as its own section instead of pointing at v0.5`,
        ).toBe(false);
      }
    }
  });

  it('the framework index records that v0.5 narrowed RSS-001s P2 role, citing real RSS sections', () => {
    // The family ruling made RSS-001 a five-step admissibility gate. v0.5 §14
    // narrows it to three functions and drops the substrate comparison. The
    // narrowing must be VISIBLE — a silent deletion would let the wider gate be
    // reintroduced by citing the pre-v0.5 wording.
    const framework = readSource(FRAMEWORK);
    expect(framework, 'the supersession is not recorded').toMatch(/Supersession recorded/);
    expect(framework).toMatch(/narrows that to three functions/);
    expect(framework, 'Section T is not excluded explicitly').toMatch(
      /Tiered Computational Equivalence.*is not part of P2/s,
    );
    // Every RSS-001 section it cites must exist in RSS-001.
    const headings = new Set(
      [...readSource(RSS).matchAll(/^#{1,4}\s+§?([\w.]+)/gm)].map((m) => m[1]),
    );
    expect(headings.size).toBeGreaterThan(20);
    const cited = new Set([...framework.matchAll(/RSS-001 §([\w.]+)/g)].map((m) => m[1]));
    expect(cited.size, 'the index cites almost no RSS-001 sections').toBeGreaterThanOrEqual(6);
    for (const c of cited) {
      expect(headings.has(c), `the index cites RSS-001 §${c}, which is not a section of RSS-001`).toBe(true);
    }
    // v0.5 §14 is the authority for the narrowing; the pointer must resolve there.
    expect(readSource(PROTOCOL)).toMatch(/## 14\. RSS-001 role within EXP-P2/);
  });

  it('each instantiation points at its own v0.5 domain section and holds no domain content', () => {
    const DOMAIN_SECTION: Record<string, string> = {
      'EXP-P2A': 'v0.5 §19',
      'EXP-P2B': 'v0.5 §20',
    };
    expect(instantiations().length).toBe(2);
    for (const e of instantiations()) {
      const doc = readSource(e.protocolRef);
      expect(doc, `${e.id} does not point at its v0.5 domain section`).toContain(
        DOMAIN_SECTION[e.id],
      );
      expect(doc, `${e.id} does not point at the framework index`).toContain(
        '01_shared-constitutional-framework.md',
      );
      expect(doc, `${e.id} does not declare itself a pointer`).toMatch(/carries no domain content/i);
    }
  });

  it('nothing in the family is presented as preregistered', () => {
    // The architecture is settled; the protocol is NOT registerable until
    // Appendix C is resolved. A surface that renders these as live experiments
    // would misreport the programme's state.
    for (const e of [p2(), ...instantiations()]) {
      expect(e.hypothesis, `${e.id} does not declare its registration state`).toMatch(
        /PREREGISTRATION NOT YET AUTHORIZED/,
      );
    }
    const protocol = readSource(PROTOCOL);
    expect(protocol).toMatch(/\*\*Preregistration:\*\* not yet authorized/);
    expect(protocol).toMatch(/incomplete until Appendix C is resolved/);
    expect(readSource(FAMILY_INDEX)).toMatch(/PREREGISTRATION NOT YET AUTHORIZED/);
  });

  it('both programme views are recorded, and neither can be read as the other', () => {
    const idx = readSource(FAMILY_INDEX);
    expect(idx, 'the conceptual sequence is missing').toMatch(
      /P1 Compression\s*→\s*P2 Consequence\s*→\s*P3 Representation\s*→\s*P4 Interaction/,
    );
    expect(idx).toMatch(/numbering should remain P1 → P2 → P3 → P4/);
    expect(idx, 'the methodological dependency is missing').toMatch(
      /P3 Representation Science\s*→\s*RSS-001 Certification/,
    );
    expect(idx).toMatch(/methodological dependency now runs through P3/);
    expect(idx, 'the index never denies the renumbering reading').toMatch(/not a renumbering/i);
    expect(SERIES_REGISTRY.find((s) => s.id === 'VP1')!.members).toEqual([
      'EXP-P1', 'EXP-P2', 'EXP-P3', 'EXP-P4',
    ]);
    // v0.5 §2 carries the same distinction — the protocol and the index must agree.
    expect(readSource(PROTOCOL)).toMatch(/Compression → Consequence → Representation → Interaction/);
    expect(readSource(PROTOCOL)).toMatch(/methodological dependency is not strictly sequential/);
  });
});

/**
 * Canonical Completion Rule (operator proposal, 2026-07-28) — PROPOSED, not canon.
 *
 * THE RULE: "No experimental draft, amendment, decision procedure, review
 * finding, or stopping rule shall be treated as an inherited normative
 * authority unless it has been persisted and registered as a canonical platform
 * artifact." Corollary: a review cycle is not complete until its accepted
 * output, disposition and protected design elements are canonized on-platform.
 *
 * WHY IT EXISTS. EXP-P2 v0.5 attributes load-bearing design elements to v0.2,
 * v0.3 and v0.4 in its supersession notice and Appendix A. When v0.5 was filed
 * NONE of those drafts existed as an artifact: the lineage column read as
 * provenance and resolved to nothing. An instruction to copy the stopping rule
 * "faithfully from the existing v0.2 §38 rather than reconstructed from memory"
 * could not be executed, because there was nothing to copy from — and a
 * plausible reconstruction is indistinguishable from the real thing to every
 * future reader. v0.2 has since been RECOVERED, which demonstrates the other
 * half of the rule: recovery is not ratification.
 *
 * Full statement, dispositions, and what still needs an operator decision:
 * codexes/packs/irl/foundation/experiments/CANONICAL-COMPLETION-RULE.md
 */
describe('Canonical Completion Rule (proposed 2026-07-28)', () => {
  const EXP_DIR = 'codexes/packs/irl/foundation/experiments';
  const P2_DIR = `${EXP_DIR}/exp-p2-consequential-performance`;
  const RULE = `${EXP_DIR}/CANONICAL-COMPLETION-RULE.md`;
  const PROTOCOL = `${P2_DIR}/02_protocol-v0.5.md`;
  const AMENDMENT = `${P2_DIR}/03_operational-amendment-v0.5.md`;
  const RECOVERED = `${P2_DIR}/05_v0.2-recovered-historical-draft.md`;

  const fs = () => require('node:fs') as typeof import('node:fs');
  const path = () => require('node:path') as typeof import('node:path');

  /** Files registered in the IRL pack — "canonized on-platform" in the rule's sense. */
  function registeredItems(): Set<string> {
    const pack = JSON.parse(
      readFileSync(join(process.cwd(), 'codexes/packs/irl/collections.json'), 'utf8'),
    ) as { collections: { items: string[] }[] };
    return new Set(pack.collections.flatMap((c) => c.items));
  }

  /** Versions a protocol claims to consolidate/supersede, from its lineage notice. */
  function citedLineageVersions(src: string): string[] {
    const notice = src.slice(
      src.indexOf('## Supersession and lineage notice'),
      src.indexOf('## Abstract'),
    );
    return [...new Set([...notice.matchAll(/v(0\.\d)/g)].map((m) => m[1]))].sort();
  }

  /** Does a version have an artifact file of its own in the experiment directory? */
  function artifactFor(version: string): string | null {
    const dir = path().join(process.cwd(), P2_DIR);
    const hit = fs()
      .readdirSync(dir)
      .find((f) => f.endsWith('.md') && f.includes(`v${version}`));
    return hit ?? null;
  }

  it('the rule itself is filed as PROPOSED, never as canon', () => {
    // A governance rule asserting that nothing inherits authority without
    // ratification must not itself claim ratified standing. Hypothesis vs Canon
    // applied to the rule's own text.
    const rule = readSource(RULE);
    expect(rule).toMatch(/Status: `proposed`/);
    expect(rule).toMatch(/NOT ratified, NOT canon/);
    expect(rule, 'the rule claims canonical standing').not.toMatch(/Status: `canonical`/);
  });

  it('Canary 1 — no draft is superseded unless it has an artifact or is named uncanonized', () => {
    const protocol = readSource(PROTOCOL);
    const amendment = readSource(AMENDMENT);
    const versions = citedLineageVersions(protocol);
    expect(versions.length, 'the lineage notice cites no versions — parse failed').toBeGreaterThan(2);

    for (const v of versions) {
      if (v === '0.5') continue; // the document itself
      const artifact = artifactFor(v);
      if (artifact) {
        // An artifact exists: it must declare whether it is canonical. A
        // recovered draft that does not say so would read as governing.
        const src = readSource(`${P2_DIR}/${artifact}`);
        expect(
          /NON-NORMATIVE|RECOVERED HISTORICAL DRAFT|uncanonized/i.test(src),
          `v${v} has an artifact (${artifact}) that never states its canonization status`,
        ).toBe(true);
      } else {
        // No artifact at all: the amendment must say so in as many words.
        expect(
          new RegExp(`v${v.replace('.', '\\.')}[^|\\n]*\\|[^|\\n]*\\|[^|\\n]*Absent`, 'i').test(
            amendment,
          ),
          `v${v} is superseded by v0.5 but has no artifact and is not recorded as absent`,
        ).toBe(true);
      }
    }
  });

  it('Canary 2 — every inherited element resolves to an inspectable source or a recorded gap', () => {
    // Appendix A's "Source lineage" column IS EXP-P2's inheritance claim. Every
    // version it names must be accounted for in the amendment's lineage-status
    // table — resolvable, or explicitly recorded as unresolvable.
    const protocol = readSource(PROTOCOL);
    const amendment = readSource(AMENDMENT);
    const appendixA = protocol.slice(
      protocol.indexOf('# Appendix A — Inheritance Register'),
      protocol.indexOf('# Appendix B'),
    );
    expect(appendixA.length, 'Appendix A did not parse').toBeGreaterThan(200);

    const inherited = [...new Set([...appendixA.matchAll(/v(0\.\d)/g)].map((m) => m[1]))];
    expect(inherited.length, 'Appendix A names no inherited versions').toBeGreaterThan(1);

    const statusTable = amendment.slice(amendment.indexOf('### A7.3'));
    for (const v of inherited) {
      expect(
        statusTable.includes(`v${v}`),
        `Appendix A inherits from v${v}, which the lineage-status record never accounts for`,
      ).toBe(true);
    }
  });

  it('Canary 3 — an attested-but-uncanonized element is labelled, and stays non-governing', () => {
    const recovered = readSource(RECOVERED);
    expect(recovered).toMatch(/RECOVERED HISTORICAL DRAFT/);
    expect(recovered).toMatch(/NON-NORMATIVE/);
    // It must disclaim governing force, not merely be dated.
    expect(recovered, 'the recovered draft does not disclaim normative weight').toMatch(
      /does not supersede, amend, or bind|Normative weight.*None/is,
    );
    // And the amendment relying on it must say recovery is not ratification.
    expect(readSource(AMENDMENT), 'the amendment treats recovery as ratification').toMatch(
      /Recovery is not ratification/i,
    );
  });

  it('Canary 4 — every EXP-P2 artifact is registered on-platform', () => {
    // "Canonized on-platform" is operationalised as registration in the pack's
    // collections.json — an unregistered file renders nowhere and cannot be a
    // canonical artifact, whatever it says about itself.
    const registered = registeredItems();
    const dir = path().join(process.cwd(), P2_DIR);
    const files = fs().readdirSync(dir).filter((f) => f.endsWith('.md'));
    expect(files.length, 'no EXP-P2 documents found').toBeGreaterThan(3);
    // The rule conditions REGISTRATION ON NORMATIVE RELIANCE, not on existence:
    // nothing "shall be treated as an inherited normative authority unless it
    // has been persisted and registered". So a document that declares itself
    // `proposed` — relied upon by nothing yet — is not yet required to be
    // registered; it becomes required the moment it is ratified. Everything
    // that does NOT disclaim normative standing must be registered now.
    let required = 0;
    for (const f of files) {
      const src = readSource(`${P2_DIR}/${f}`);
      const disclaimsStanding = /Status: `proposed`|NON-NORMATIVE|RECOVERED HISTORICAL DRAFT/.test(src);
      if (disclaimsStanding) continue;
      required += 1;
      expect(
        registered.has(`foundation/experiments/exp-p2-consequential-performance/${f}`),
        `${f} is relied on normatively but is not registered in the IRL pack — it is not canonized on-platform`,
      ).toBe(true);
    }
    expect(required, 'every EXP-P2 document disclaimed standing — the check was vacuous').toBeGreaterThan(2);
    // The authoritative protocol is never exempt, whatever it says about itself.
    expect(
      registered.has('foundation/experiments/exp-p2-consequential-performance/02_protocol-v0.5.md'),
      'the authoritative v0.5 protocol is not registered on-platform',
    ).toBe(true);
    // The rule document itself must be registered too.
    expect(
      registered.has('foundation/experiments/CANONICAL-COMPLETION-RULE.md'),
      'the Canonical Completion Rule is not registered on-platform',
    ).toBe(true);
  });

  it('Canary 5 — v0.5 does not rely normatively on a draft it cannot inherit from', () => {
    // v0.5 §45 carries the stopping rule forward "from the prior P2 lineage".
    // That is a normative reliance on a draft which is recovered but NOT
    // canonized, plus a v0.3 binding that does not exist at all. The reliance
    // must stand recorded as unresolved.
    const amendment = readSource(AMENDMENT);
    expect(amendment).toMatch(/UNRESOLVED — Appendix C item 19/);
    expect(amendment, 'the v0.3 binding is no longer recorded as absent').toMatch(
      /v0\.3 binding is still absent|Still absent/i,
    );
    expect(amendment).toMatch(/[Nn]o reconstruction has been attempted/);

    // No EXP-P2 document may declare the inheritance settled without a
    // ratification act — that is the failure the rule forbids.
    const dir = path().join(process.cwd(), P2_DIR);
    for (const f of fs().readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      const src = readSource(`${P2_DIR}/${f}`);
      for (const claim of [
        /§38 is bound to/i,
        /binds §38/i,
        /§38 now governs/i,
        /stopping rule is (?:now )?(?:resolved|ratified)/i,
      ]) {
        expect(claim.test(src), `${f} claims the stopping-rule inheritance is settled`).toBe(false);
      }
    }
  });

  it('Canary 6 — a completed review cycle must be registered and name its emitted artifact', () => {
    // CONDITIONAL by construction: no protocol is complete today, so this takes
    // the not-complete branch. It must still be able to FIRE, or it is an inert
    // mechanism (the CB-1 defect) — flipping a disposition is what trips it.
    const registered = registeredItems();
    const dir = path().join(process.cwd(), P2_DIR);
    const drafts = fs().readdirSync(dir).filter((f) => /protocol-v[\d.]+\.md$/.test(f));
    expect(drafts.length, 'no protocol draft found — the check would be vacuous').toBeGreaterThan(0);

    let inspected = 0;
    for (const draft of drafts) {
      const src = readSource(`${P2_DIR}/${draft}`);
      const disposition = /\*\*Preregistration:\*\*\s*(.+)/.exec(src)?.[1]?.trim() ?? '';
      expect(disposition, `${draft} states no preregistration disposition`).not.toBe('');
      inspected += 1;
      const complete = !/not yet authorized/i.test(disposition);
      if (!complete) continue;
      // The cycle claims completion — now the rule's corollary binds.
      expect(
        registered.has(`foundation/experiments/exp-p2-consequential-performance/${draft}`),
        `${draft} declares its review cycle complete but is not registered on-platform`,
      ).toBe(true);
      // RULED 2026-07-28: the emitted artifact is a capabilityCompletionArtifact.
      // A ResearchPublication proves findings; it does not prove a capability is
      // reproducible, locatable and safely usable. Different evidentiary
      // functions, so a publication offered INSTEAD is refused.
      expect(
        /capabilityCompletionArtifact/i.test(src),
        `${draft} declares its review cycle complete but names no capabilityCompletionArtifact`,
      ).toBe(true);
    }
    expect(inspected, 'no disposition was inspected').toBeGreaterThan(0);

    // RULED 2026-07-28: the form is decided. The rule document must name it,
    // and must not have drifted back to describing it as an open question.
    const rule = readSource(RULE);
    expect(rule, 'the rule doc no longer names the ruled artifact form').toMatch(
      /capabilityCompletionArtifact/,
    );
    expect(rule, 'the artifact form has drifted back to undecided').not.toMatch(
      /CONDITIONALLY ENFORCED/,
    );
  });
});

/**
 * Operator rulings of 2026-07-28 on the two questions left open by the
 * Canonical Completion Rule work.
 *
 * RULING 6 — the completion artifact form is `capabilityCompletionArtifact`,
 * not `ResearchPublication`: "A ResearchPublication proves findings. It does
 * not prove that a capability is reproducible, locatable and safely usable."
 * The capability artifact REFERENCES publications rather than becoming one.
 *
 * RULING 7 — v0.2 §38 is NOT bound into v0.5. It is treated as a historical
 * design constraint and a v0.5-native successor derived, expressed
 * independently of arm names and substrate count, with an explicit statement of
 * what no longer maps. A reconciliation in which everything maps cleanly is
 * concealing a mismatch, so the non-mapping section is the load-bearing half
 * and is canaried as such.
 */
describe('operator rulings 2026-07-28 — completion artifact form + §38 successor', () => {
  const EXP_DIR = 'codexes/packs/irl/foundation/experiments';
  const P2_DIR = `${EXP_DIR}/exp-p2-consequential-performance`;
  const RULE = `${EXP_DIR}/CANONICAL-COMPLETION-RULE.md`;
  const RECONCILIATION = `${P2_DIR}/06_stopping-rule-reconciliation.md`;
  const AMENDMENT = `${P2_DIR}/03_operational-amendment-v0.5.md`;

  it('Ruling 6 — the completion artifact form is decided, and a publication cannot substitute', () => {
    const rule = readSource(RULE);
    expect(rule).toMatch(/capabilityCompletionArtifact/);
    // The distinction the ruling turns on must survive in the document, not
    // just the conclusion — otherwise a later reader re-litigates it.
    expect(rule, 'the evidentiary distinction is not recorded').toMatch(
      /proves findings.*does not prove that a capability is reproducible/s,
    );
    expect(rule, 'canary 6 is still described as form-undecided').not.toMatch(
      /CONDITIONALLY ENFORCED/,
    );
    expect(rule, 'the artifact-form question is still listed as open').not.toMatch(
      /Choosing one is an operator act/,
    );
  });

  it('Ruling 6 — the schema version is derived from the type, never hardcoded stale', () => {
    // The operator called out duplicate-source-of-truth defects separately today.
    // The rule doc names a schema version; it must be THE version, so a bump
    // fails the build here rather than leaving a stale claim in the prose.
    const version = CAPABILITY_COMPLETION_SCHEMA_VERSION.split('/')[1];
    expect(version, 'the schema version constant did not parse').toMatch(/^v\d+\.\d+$/);
    const rule = readSource(RULE);
    expect(
      rule.includes(`schema version ${version}`),
      `the rule doc names a schema version other than the current ${version}`,
    ).toBe(true);
    // And it must not assert a field the schema does not carry.
    const type = readSource('types/capabilityCompletion.ts');
    if (!type.includes('relatedEvidence')) {
      expect(
        rule,
        'the rule claims relatedEvidence exists when the schema does not carry it',
      ).toMatch(/relatedEvidence.*(does not yet exist|is not present)/s);
    }
  });

  it('Ruling 7 — the §38 successor is derived, arm-free, and filed as proposed', () => {
    const rec = readSource(RECONCILIATION);
    expect(rec).toMatch(/Status: `proposed`/);
    expect(rec, 'the reconciliation claims governing standing').not.toMatch(/Status: `canonical`/);
    // SR-0..SR-5 present.
    for (const sr of ['SR-0', 'SR-1', 'SR-2', 'SR-3', 'SR-4', 'SR-5']) {
      expect(rec, `${sr} is missing from the successor`).toContain(sr);
    }
    // Arm-name-free and substrate-count-free is the ruling's requirement. The
    // successor clauses themselves must not name v0.2 or v0.5 arms.
    const successor = rec.slice(rec.indexOf('## 3. The derived successor'), rec.indexOf('## 4.'));
    expect(successor.length).toBeGreaterThan(400);
    for (const armName of ['W0', 'W1', 'W2', 'W3', 'B+R', 'Arm A', 'Arm C', 'Arm D']) {
      expect(
        successor.includes(armName),
        `the successor clause set names the arm '${armName}' — it must be arm-independent`,
      ).toBe(false);
    }
    // Operator wording adopted must be DECLARED as adopted, not passed off as derived.
    expect(rec, 'adopted operator wording is not declared as such').toMatch(
      /adoption of operator wording rather than[\s\n]+independent derivation/,
    );
  });

  it('Ruling 7 — the non-mapping half is present and names the real gaps', () => {
    // "identify anything that no longer maps" is load-bearing: a reconciliation
    // that maps everything is hiding a mismatch. These three gaps are real and
    // must survive any later tidying of the document.
    const rec = readSource(RECONCILIATION);
    const gaps = rec.slice(rec.indexOf('## 6. What no longer maps'), rec.indexOf('## 7.'));
    expect(gaps.length, 'the non-mapping section is missing or empty').toBeGreaterThan(800);
    // (a) the construct under test changed
    expect(gaps, 'the construct-scope gap is not recorded').toMatch(
      /construct under test is not the same construct/i,
    );
    // (b) the repeated-task condition has no experiment anywhere
    expect(gaps, 'the untested repeated-task condition is not recorded').toMatch(
      /repeated-task|amortization/i,
    );
    expect(gaps).toMatch(/no experiment/i);
    // (c) v0.2's representation contrast is forbidden in v0.5 by construction
    expect(gaps, 'the representation-contrast gap is not recorded').toMatch(
      /representation contrast has no v0\.5 counterpart|Principle I/,
    );
    // And the absent v0.3 binding must still not be claimed as recovered.
    expect(gaps).toMatch(/not reconstructed, inferred, or worked around/);
  });

  it('Ruling 7 — the reconciliation does not resolve Appendix C item 19 by itself', () => {
    // Deriving a successor is not ratifying one. Until the operator approves,
    // v0.5 still has no frozen programme decision point — and the amendment
    // must not have been quietly flipped to resolved.
    const rec = readSource(RECONCILIATION);
    expect(rec).toMatch(/Appendix C item 19 is still open/);
    expect(rec, 'the reconciliation claims to bind §38').not.toMatch(/§38 is bound to v0\.5/);
    expect(readSource(AMENDMENT)).toMatch(/UNRESOLVED — Appendix C item 19/);
  });
});

/**
 * Cartridge display naming — the ontology is the source of truth for what a
 * cartridge is CALLED, and `data/codex-configs.ts` is a projection of it that
 * cannot be derived in code (a docs-file mirror, per this file's charter).
 *
 * TWO SEPARATE RULES, BOTH LEARNED FROM THE SAME OPERATOR PASS (2026-07-28):
 *
 *  1. "Remove **cartridge** from the names of any cartridge that includes it."
 *     The word is the platform's noun for the container, not part of any
 *     cartridge's name. It had crept into five of fifteen display names.
 *  2. A cartridge may need TWO names — a picker name and a header name — and
 *     they are DIFFERENT NAMES, not one name at two lengths. `shortName` is
 *     the picker's; deriving it by truncating `name` is the defect this pins
 *     against, because a truncation rule silently mangles the other fourteen.
 *
 * The IRL check reads `docs/platform-ontology.md` rather than restating the
 * ratified names — restating them here would make this file a second home for
 * the fact, which is exactly the class of defect the rest of the file exists
 * to catch.
 */
describe('cartridge display naming (docs/platform-ontology.md is the source of truth)', () => {
  const ONTOLOGY = 'docs/platform-ontology.md';

  it('no cartridge display name carries the container noun "Cartridge"', async () => {
    const { CODEX_DEFINITIONS } = await import('../data/codex-configs');
    expect(CODEX_DEFINITIONS.length, 'no cartridges loaded — the import broke').toBeGreaterThan(5);
    const offenders = CODEX_DEFINITIONS.filter(
      (c: { name: string; shortName?: string }) =>
        /\bcartridges?\b/i.test(c.name) || /\bcartridges?\b/i.test(c.shortName ?? ''),
    ).map((c: { id: string; name: string }) => `${c.id}: "${c.name}"`);
    expect(offenders, `cartridge names still containing "Cartridge":\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the ids that end in -cartridge are untouched — a display rename is never an identifier rename', async () => {
    // The dual-source rule (CLAUDE.md) turns on these ids: QuickLinksCard,
    // buildCodexUrl, aiqOsTabsByGroup and the pack skip-list all target them.
    // Renaming a DISPLAY string must never migrate into the id, so the ids that
    // carry the suffix are pinned here as the thing that must NOT change.
    const { CODEX_DEFINITIONS } = await import('../data/codex-configs');
    const ids = new Set(CODEX_DEFINITIONS.map((c: { id: string }) => c.id));
    for (const id of ['agentiq-os-cartridge', 'standing-cartridge', 'irl-cartridge']) {
      expect(ids, `${id} was renamed — inter-cartridge navigation targets it`).toContain(id);
    }
  });

  it('IRL carries two ontology-ratified names, and neither is derived from the other', async () => {
    const { IRL_CARTRIDGE } = await import('../data/codex-configs');
    const ontology = readSource(ONTOLOGY);
    const section = ontology.slice(ontology.indexOf('## Invariant Research Lab (IRL)'));
    expect(section.length, 'the Invariant Research Lab ontology entry is missing').toBeGreaterThan(200);

    // Both names must be strings the ontology itself ratifies.
    expect(section, 'the header name is not an ontology-ratified name').toContain(IRL_CARTRIDGE.name);
    expect(IRL_CARTRIDGE.shortName, 'IRL has no picker name').toBeTruthy();
    expect(section, 'the picker name is not an ontology-ratified name').toContain(IRL_CARTRIDGE.shortName!);

    // …and they are genuinely two names, not one collapsed into the other.
    // The real guard against derivation-by-slicing is already above: both
    // `name` and `shortName` must independently appear as ratified forms in
    // the ontology section. A plain startsWith/endsWith check is NOT a safe
    // second guard here, because the ontology's three forms legitimately nest
    // — "metaMe IRL" ends in "IRL" by construction, since that form exists
    // precisely to name IRL in a product/brand context. Flagging that nesting
    // would penalise the correct configuration, not a truncation artifact.
    expect(IRL_CARTRIDGE.name).not.toBe(IRL_CARTRIDGE.shortName);

    // The superseded lab name must not have come back with the rename.
    expect(IRL_CARTRIDGE.name).not.toMatch(/CCRL|Constitutional Cybernetics Research Laborator/);
  });

  it('the picker resolves shortName ?? name in ONE place, and never truncates', () => {
    const picker = stripComments(readSource('app/(shell)/codex/viewer/page.tsx'));
    expect(picker, 'the picker does not consume shortName').toMatch(/shortName\s*\?\?\s*codex\.name/);
    // A `.replace(/ cartridge$/)`-style derivation in the picker would be the
    // truncation rule this design rejects.
    expect(picker, 'the picker derives its label by stripping text').not.toMatch(
      /codex\.name\s*\.\s*replace/,
    );
    // And the list endpoint must actually carry the field, or the picker's
    // fallback silently becomes the only branch that ever runs (MS-7: an
    // inert mechanism is a defect even though nothing errors).
    const list = stripComments(readSource('app/api/codex/registry/_lib/packRegistry.ts'));
    expect(list, 'codexToListItem drops shortName').toMatch(/shortName/);
  });
});
