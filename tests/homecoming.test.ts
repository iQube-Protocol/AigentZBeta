/**
 * Chrysalis Homecoming — contract canaries (CFS-023 + SPEC-HMC-001).
 *
 * Pins the order-constant constitutional data (eras, sovereignties, workstreams,
 * the Constitutional Presence ladder, the Homecoming Test dimensions, the
 * knowledge sources) and the PURE scorer logic (contiguous presence resolution +
 * summary). The impure table reads in constitutionalPresence.ts are not exercised.
 *
 * SPEC-HMC-001 Phase 1 adds two further canary classes at the bottom of this file:
 *   - the agent-continuity contracts (lifecycle stages, the five-dimension
 *     taxonomy, source hosts) + the pure `assembleContinuity` assembler; and
 *   - STRUCTURAL canaries over the continuity service + route source that fail the
 *     build if an auto-authorization path or a T0 leak is ever introduced.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import {
  CHRYSALIS_ERAS,
  CONSTITUTIONAL_SOVEREIGNTIES,
  SOVEREIGNTY_PROGRAMME,
  HOMECOMING_SOVEREIGNTIES,
  HOMECOMING_WORKSTREAMS,
  CONSTITUTIONAL_PRESENCE_LADDER,
  PRESENCE_SIGNAL,
  presenceLevelIndex,
  resolvePresenceLevel,
  HOMECOMING_TEST_DIMENSIONS,
  HOMECOMING_DELEGATES,
  DELEGATE_CHARTER_STATUS,
  KNOWLEDGE_HOMECOMING_SOURCES,
  knowledgeSourceIsNew,
  CONSTITUTIONALIZATION_IDIOMS,
  MIGRATION_LIFECYCLE_STAGES,
  MIGRATION_STAGE_SIGNAL,
  migrationStageIndex,
  resolveMigrationStage,
  stageRequiresHumanAct,
  ASSESSABLE_STAGE_CEILING,
  AGENT_CONTINUITY_DIMENSIONS,
  CONTINUITY_DIMENSION_SPEC,
  MIGRATION_SOURCE_HOSTS,
  migrationSourceParserExists,
} from '@/types/homecoming';
import { assembleRungs, summarizePresence, type DelegatePresence } from '@/services/homecoming/constitutionalPresence';
import {
  assembleContinuity,
  NOT_ASSESSABLE_TODAY,
  HOMECOMING_SEED_PREFIX,
  type ContinuityObservations,
} from '@/services/homecoming/agentContinuity';

describe('Chrysalis Homecoming — order-pinned constitutional data', () => {
  it('sequences the Chrysalis eras with Homecoming strictly between 2.0 and 3.0', () => {
    expect([...CHRYSALIS_ERAS]).toEqual(['chrysalis-1.x', 'chrysalis-2.0', 'chrysalis-homecoming', 'chrysalis-3.0']);
    expect(CHRYSALIS_ERAS.indexOf('chrysalis-2.0')).toBeLessThan(CHRYSALIS_ERAS.indexOf('chrysalis-homecoming'));
    expect(CHRYSALIS_ERAS.indexOf('chrysalis-homecoming')).toBeLessThan(CHRYSALIS_ERAS.indexOf('chrysalis-3.0'));
  });

  it('pins the five sovereignties and attributes agent+knowledge to Homecoming', () => {
    expect([...CONSTITUTIONAL_SOVEREIGNTIES]).toEqual(['computing', 'development', 'agent', 'knowledge', 'operational']);
    expect(SOVEREIGNTY_PROGRAMME.agent).toBe('chrysalis-homecoming');
    expect(SOVEREIGNTY_PROGRAMME.knowledge).toBe('chrysalis-homecoming');
    expect(SOVEREIGNTY_PROGRAMME.computing).toBe('chrysalis-2.0');
    expect(SOVEREIGNTY_PROGRAMME.operational).toBe('operation-leap');
    expect([...HOMECOMING_SOVEREIGNTIES].sort()).toEqual(['agent', 'knowledge']);
    // every sovereignty is attributed to exactly one programme
    for (const s of CONSTITUTIONAL_SOVEREIGNTIES) expect(SOVEREIGNTY_PROGRAMME[s]).toBeTruthy();
  });

  it('orders the four workstreams knowledge → agent → harness → operational', () => {
    expect([...HOMECOMING_WORKSTREAMS]).toEqual(['knowledge', 'agent', 'harness', 'operational']);
  });

  it('pins the Presence ladder L0→L5 with contiguous 0..5 signal indices', () => {
    expect([...CONSTITUTIONAL_PRESENCE_LADDER]).toEqual([
      'card',
      'knowledge',
      'reasoning',
      'studio',
      'development',
      'sovereign',
    ]);
    CONSTITUTIONAL_PRESENCE_LADDER.forEach((level, i) => {
      expect(PRESENCE_SIGNAL[level].level).toBe(i);
      expect(presenceLevelIndex(level)).toBe(i);
    });
    expect(presenceLevelIndex('nonexistent')).toBe(-1);
  });

  it('pins the three Homecoming Test dimensions', () => {
    expect([...HOMECOMING_TEST_DIMENSIONS]).toEqual(['continuity', 'knowledge', 'capability']);
  });

  it('roster is honestly graded — 3 concrete, 1 archetype, 2 conceptual', () => {
    expect([...HOMECOMING_DELEGATES]).toEqual(['aigent-z', 'marketa', 'kn0w1', 'aletheon', 'moneypenny', 'nakamoto']);
    const byStatus = (s: string) =>
      HOMECOMING_DELEGATES.filter((d) => DELEGATE_CHARTER_STATUS[d].status === s);
    expect(byStatus('concrete').sort()).toEqual(['aigent-z', 'kn0w1', 'marketa']);
    expect(byStatus('archetype')).toEqual(['aletheon']);
    expect(byStatus('conceptual').sort()).toEqual(['moneypenny', 'nakamoto']);
  });

  it('only chatgpt-export is a genuinely-new knowledge intake path', () => {
    expect(KNOWLEDGE_HOMECOMING_SOURCES[0]).toBe('chatgpt-export');
    expect(knowledgeSourceIsNew('chatgpt-export')).toBe(true);
    expect(knowledgeSourceIsNew('venture-qubes')).toBe(false);
    expect(knowledgeSourceIsNew('standing')).toBe(false);
    expect([...CONSTITUTIONALIZATION_IDIOMS]).toEqual(['invariant-extraction', 'meta-blak-split']);
  });
});

describe('resolvePresenceLevel — the ladder is contiguous (a gap stops the climb)', () => {
  it('returns null when even L0 (card) is unmet', () => {
    expect(resolvePresenceLevel({})).toBeNull();
    expect(resolvePresenceLevel({ card: false, knowledge: true })).toBeNull();
  });

  it('returns the highest contiguous rung', () => {
    expect(resolvePresenceLevel({ card: true })).toBe('card');
    expect(resolvePresenceLevel({ card: true, knowledge: true, reasoning: true })).toBe('reasoning');
  });

  it('a gap below a satisfied rung caps presence — cannot skip', () => {
    // studio satisfied but reasoning NOT → capped at knowledge (the last contiguous)
    expect(resolvePresenceLevel({ card: true, knowledge: true, reasoning: false, studio: true })).toBe('knowledge');
  });

  it('full ladder resolves to sovereign', () => {
    const all = Object.fromEntries(CONSTITUTIONAL_PRESENCE_LADDER.map((l) => [l, true]));
    expect(resolvePresenceLevel(all)).toBe('sovereign');
  });
});

describe('assembleRungs + summarizePresence — pure scorer core', () => {
  it('a pending rung is NOT satisfied for the climb (undetermined ≠ reached)', () => {
    const { presenceLevel, rungs } = assembleRungs({ card: 'reached', knowledge: 'reached', reasoning: 'pending' });
    expect(presenceLevel).toBe('knowledge'); // pending reasoning stops the climb
    expect(rungs.find((r) => r.level === 'reasoning')?.status).toBe('pending');
    // rungs are always the full ordered ladder
    expect(rungs.map((r) => r.level)).toEqual([...CONSTITUTIONAL_PRESENCE_LADDER]);
  });

  it('missing statuses default to pending', () => {
    const { rungs } = assembleRungs({ card: 'reached' });
    expect(rungs.find((r) => r.level === 'sovereign')?.status).toBe('pending');
  });

  it('summarises presence across delegates by threshold', () => {
    const mk = (presenceIndex: number): DelegatePresence => ({
      delegate: 'marketa',
      agentClass: 'guide-agent',
      charterStatus: 'concrete',
      presenceLevel: null,
      presenceIndex,
      rungs: [],
      passportBound: false,
    });
    const summary = summarizePresence([mk(5), mk(2), mk(1), mk(-1)]);
    expect(summary.total).toBe(4);
    expect(summary.present).toBe(3); // index >= 0
    expect(summary.reasoning).toBe(2); // index >= 2
    expect(summary.sovereign).toBe(1); // index >= 5
    expect(summary.conceptual).toBe(1); // index < 0
  });
});

// ───────────────────────────────────────────────────────────────────────────
// SPEC-HMC-001 Phase 1 — agent continuity assessment substrate
// ───────────────────────────────────────────────────────────────────────────

const REPO = join(__dirname, '..');
const CONTINUITY_SERVICE_PATH = join(REPO, 'services/homecoming/agentContinuity.ts');
const CONTINUITY_ROUTE_PATH = join(REPO, 'app/api/homecoming/agent/continuity/route.ts');
const CONSTITUTIONALIZE_PATH = join(REPO, 'services/homecoming/constitutionalize.ts');

const continuityService = readFileSync(CONTINUITY_SERVICE_PATH, 'utf8');
const continuityRoute = readFileSync(CONTINUITY_ROUTE_PATH, 'utf8');
const constitutionalizeSource = readFileSync(CONSTITUTIONALIZE_PATH, 'utf8');

describe('SPEC-HMC-001 — order-pinned continuity contracts', () => {
  it('pins the six migration lifecycle stages in §3 order with contiguous 0..5 indices', () => {
    expect([...MIGRATION_LIFECYCLE_STAGES]).toEqual([
      'origin-observed',
      'constitutionalized',
      'principal-ratified',
      'presence-reconstituted',
      'delegation-reauthorized',
      'native',
    ]);
    MIGRATION_LIFECYCLE_STAGES.forEach((stage, i) => {
      expect(MIGRATION_STAGE_SIGNAL[stage].index).toBe(i);
      expect(migrationStageIndex(stage)).toBe(i);
    });
    expect(migrationStageIndex('nonexistent')).toBe(-1);
  });

  it('marks exactly the human-act stages — ratification, re-authorization, and native (which depends on it)', () => {
    const humanStages = MIGRATION_LIFECYCLE_STAGES.filter(stageRequiresHumanAct);
    expect([...humanStages]).toEqual(['principal-ratified', 'delegation-reauthorized', 'native']);
    // The two SPEC-HMC-001 §3 names as the import-vs-continuity difference are human acts.
    expect(stageRequiresHumanAct('principal-ratified')).toBe(true);
    expect(stageRequiresHumanAct('delegation-reauthorized')).toBe(true);
    // Everything an assessment CAN observe is machine-observable.
    expect(stageRequiresHumanAct('origin-observed')).toBe(false);
    expect(stageRequiresHumanAct('constitutionalized')).toBe(false);
    expect(stageRequiresHumanAct('presence-reconstituted')).toBe(false);
  });

  it('caps read-only assessment at stage 4 — the last stage provable without a human act', () => {
    expect(ASSESSABLE_STAGE_CEILING).toBe('presence-reconstituted');
    expect(stageRequiresHumanAct(ASSESSABLE_STAGE_CEILING)).toBe(false);
    // every stage ABOVE the ceiling requires a human act — the ceiling is not arbitrary
    const above = MIGRATION_LIFECYCLE_STAGES.slice(migrationStageIndex(ASSESSABLE_STAGE_CEILING) + 1);
    expect(above.length).toBeGreaterThan(0);
    for (const stage of above) expect(stageRequiresHumanAct(stage)).toBe(true);
  });

  it('pins the five-part continuity taxonomy and its §9.2 component mapping', () => {
    expect([...AGENT_CONTINUITY_DIMENSIONS]).toEqual([
      'behavioural',
      'working-context',
      'project',
      'artefact',
      'relationship',
    ]);
    expect(CONTINUITY_DIMENSION_SPEC.behavioural.reconstitutionComponents).toEqual([1, 2]);
    expect(CONTINUITY_DIMENSION_SPEC['working-context'].reconstitutionComponents).toEqual([4]);
    expect(CONTINUITY_DIMENSION_SPEC.project.reconstitutionComponents).toEqual([4]);
    expect(CONTINUITY_DIMENSION_SPEC.artefact.reconstitutionComponents).toEqual([5]);
    // relationship carries BOTH the standing that transfers (3) and the authority
    // that deliberately does NOT (6) — the split §9.2 is explicit about.
    expect(CONTINUITY_DIMENSION_SPEC.relationship.reconstitutionComponents).toEqual([3, 6]);
    // every dimension binds to a real lifecycle stage
    for (const d of AGENT_CONTINUITY_DIMENSIONS) {
      expect(migrationStageIndex(CONTINUITY_DIMENSION_SPEC[d].stage)).toBeGreaterThanOrEqual(0);
    }
  });

  it('names the four migration source hosts, honestly reporting only chatgpt has a parser', () => {
    expect([...MIGRATION_SOURCE_HOSTS]).toEqual(['chatgpt-export', 'claude-ai', 'claude-code', 'codex']);
    expect(migrationSourceParserExists('chatgpt-export')).toBe(true);
    for (const host of ['claude-ai', 'claude-code', 'codex'] as const) {
      expect(migrationSourceParserExists(host)).toBe(false);
    }
  });

  it('SoT parity — the chatgpt source host is the SAME class as the knowledge source, not a second name', () => {
    expect(MIGRATION_SOURCE_HOSTS[0]).toBe(KNOWLEDGE_HOMECOMING_SOURCES[0]);
  });

  it('SoT parity — the seed prefix the assessment reads matches the one constitutionalize.ts writes', () => {
    expect(constitutionalizeSource).toContain(`\`${HOMECOMING_SEED_PREFIX}\${slugify(statement)}\``);
  });
});

describe('resolveMigrationStage — the lifecycle is contiguous (a gap stops the climb)', () => {
  it('returns null when not even stage 1 holds', () => {
    expect(resolveMigrationStage({})).toBeNull();
    expect(resolveMigrationStage({ 'origin-observed': false, constitutionalized: true })).toBeNull();
  });

  it('returns the highest contiguous stage', () => {
    expect(resolveMigrationStage({ 'origin-observed': true })).toBe('origin-observed');
    expect(resolveMigrationStage({ 'origin-observed': true, constitutionalized: true })).toBe('constitutionalized');
  });

  it('skipping principal-ratified caps the climb — an import, not continuity (§3)', () => {
    expect(
      resolveMigrationStage({
        'origin-observed': true,
        constitutionalized: true,
        'principal-ratified': false,
        'presence-reconstituted': true,
        native: true,
      }),
    ).toBe('constitutionalized');
  });
});

describe('assembleContinuity — pure assessment core', () => {
  const base: ContinuityObservations = {
    presenceIndex: -1,
    kb: { ok: true, documentCount: 0 },
    invariants: { ok: true, proposed: 0, ratified: 0 },
    artefacts: { ok: true, total: 0, receiptAnchored: 0 },
    standing: { ok: true, rootSeeded: false, overall: null, trustBandCeiling: null },
  };
  const dim = (r: ReturnType<typeof assembleContinuity>, d: string) =>
    r.dimensions.find((x) => x.dimension === d)!;

  it('always returns all five dimensions in ladder order', () => {
    const r = assembleContinuity(base);
    expect(r.dimensions.map((d) => d.dimension)).toEqual([...AGENT_CONTINUITY_DIMENSIONS]);
    expect(r.summary.total).toBe(5);
  });

  it('working-context and project are reported not-assessable with a concrete stated gap', () => {
    const r = assembleContinuity(base);
    for (const d of ['working-context', 'project'] as const) {
      expect(dim(r, d).status).toBe('not-assessable');
      expect(dim(r, d).scope).toBe('none');
      expect(dim(r, d).gap).toBe(NOT_ASSESSABLE_TODAY[d]);
      expect(String(dim(r, d).gap)).toContain('journey_states');
    }
    expect(r.summary.notAssessable).toBe(2);
  });

  it('a failed read pends the dimension — never assumed satisfiable, never assumed absent', () => {
    const r = assembleContinuity({
      ...base,
      kb: { ok: false, documentCount: 0 },
      invariants: { ok: false, proposed: 0, ratified: 0 },
      artefacts: { ok: false, total: 0, receiptAnchored: 0 },
      standing: { ok: false, rootSeeded: false, overall: null, trustBandCeiling: null },
    });
    expect(dim(r, 'behavioural').status).toBe('pending');
    expect(dim(r, 'artefact').status).toBe('pending');
    expect(dim(r, 'relationship').status).toBe('pending');
    expect(r.summary.pending).toBe(3);
    expect(r.summary.satisfiable).toBe(0);
  });

  it('behavioural is unsatisfied while nothing is ratified — an import is not continuity', () => {
    const r = assembleContinuity({
      ...base,
      kb: { ok: true, documentCount: 12 },
      invariants: { ok: true, proposed: 7, ratified: 0 },
    });
    expect(dim(r, 'behavioural').status).toBe('unsatisfied');
    expect(dim(r, 'behavioural').evidence).toContain('IMPORT');
    // stage 3 is exactly where it stops
    expect(r.lifecycleStage).toBe('constitutionalized');
  });

  it('behavioural is corpus-scoped even when satisfiable — never claims delegate attribution', () => {
    const r = assembleContinuity({
      ...base,
      kb: { ok: true, documentCount: 12 },
      invariants: { ok: true, proposed: 4, ratified: 3 },
    });
    expect(dim(r, 'behavioural').status).toBe('satisfiable');
    expect(dim(r, 'behavioural').scope).toBe('corpus');
  });

  it('artefact continuity is delegate-scoped and keys on real records', () => {
    expect(dim(assembleContinuity(base), 'artefact').status).toBe('unsatisfied');
    const r = assembleContinuity({ ...base, artefacts: { ok: true, total: 4, receiptAnchored: 2 } });
    expect(dim(r, 'artefact').status).toBe('satisfiable');
    expect(dim(r, 'artefact').scope).toBe('delegate');
  });

  it('relationship reports standing carried forward AND that authority is never carried forward', () => {
    const noRoot = assembleContinuity(base);
    expect(dim(noRoot, 'relationship').status).toBe('unsatisfied');

    const seededNoCrm = assembleContinuity({
      ...base,
      standing: { ok: true, rootSeeded: true, overall: null, trustBandCeiling: null, reason: 'no CRM persona yet' },
    });
    expect(dim(seededNoCrm, 'relationship').status).toBe('unsatisfied');

    const earned = assembleContinuity({
      ...base,
      standing: { ok: true, rootSeeded: true, overall: 62, trustBandCeiling: 'L3_PRODUCTION_CANDIDATE' },
    });
    expect(dim(earned, 'relationship').status).toBe('satisfiable');
    expect(dim(earned, 'relationship').evidence).toContain('NOT carried forward');
    // the dimension is bound to a human-act stage, and says so
    expect(dim(earned, 'relationship').requiresHumanAct).toBe(true);
  });

  it('NEVER resolves a lifecycle stage above the assessable ceiling, even with everything else green', () => {
    const maximal = assembleContinuity({
      presenceIndex: 5, // fully sovereign per the presence scorer
      kb: { ok: true, documentCount: 99 },
      invariants: { ok: true, proposed: 10, ratified: 10 },
      artefacts: { ok: true, total: 30, receiptAnchored: 30 },
      standing: { ok: true, rootSeeded: true, overall: 140, trustBandCeiling: 'L5_CORE_SOVEREIGN' },
    });
    expect(maximal.lifecycleStage).toBe(ASSESSABLE_STAGE_CEILING);
    expect(maximal.lifecycleStageIndex).toBe(migrationStageIndex(ASSESSABLE_STAGE_CEILING));
    expect(maximal.lifecycleStage).not.toBe('delegation-reauthorized');
    expect(maximal.lifecycleStage).not.toBe('native');
  });

  it('presence below L2 stops the climb at principal-ratified — no rung by assertion', () => {
    const r = assembleContinuity({
      presenceIndex: 1,
      kb: { ok: true, documentCount: 5 },
      invariants: { ok: true, proposed: 2, ratified: 2 },
      artefacts: { ok: true, total: 1, receiptAnchored: 1 },
      standing: { ok: true, rootSeeded: true, overall: 30, trustBandCeiling: 'L2_VERIFIED_COMMUNITY' },
    });
    expect(r.lifecycleStage).toBe('principal-ratified');
  });
});

describe('SPEC-HMC-001 Phase 1 — structural canaries (no auto-authorize, no T0 leak)', () => {
  it('the continuity service NEVER imports or calls the agreement/delegation authorization primitives', () => {
    for (const source of [continuityService, continuityRoute]) {
      expect(source).not.toContain('constitutionalAgreement');
      expect(source).not.toContain('guidedOnboarding');
      expect(source).not.toMatch(/\bauthorizeAgreement\b/);
      expect(source).not.toMatch(/\bacceptAgreement\b/);
      expect(source).not.toMatch(/\bformAgreement\b/);
      expect(source).not.toMatch(/action:\s*["']authorize["']/);
    }
  });

  it('the continuity service and route are READ-ONLY — no write verb anywhere', () => {
    for (const source of [continuityService, continuityRoute]) {
      expect(source).not.toMatch(/\.insert\(/);
      expect(source).not.toMatch(/\.update\(/);
      expect(source).not.toMatch(/\.upsert\(/);
      expect(source).not.toMatch(/\.delete\(/);
      expect(source).not.toMatch(/createActivityReceipt/);
      expect(source).not.toMatch(/accrue[A-Za-z]*Standing\(/);
    }
  });

  it('the route exposes GET only — there is no mutating handler to reach', () => {
    expect(continuityRoute).toMatch(/export async function GET\(/);
    expect(continuityRoute).not.toMatch(/export async function (POST|PATCH|PUT|DELETE)\(/);
  });

  it('the route is spine-gated and admin-gated, exactly like its five sibling homecoming routes', () => {
    expect(continuityRoute).toContain('getActivePersona');
    expect(continuityRoute).toContain('cartridgeFlags?.isAdmin');
    expect(continuityRoute).toContain("status: 401");
    expect(continuityRoute).toContain("status: 403");
  });

  it('no T0 identifier is ever placed in the response shape', () => {
    // the caller's persona is resolved for the GATE only, never echoed
    const responseBlocks = [...continuityRoute.matchAll(/NextResponse\.json\(([\s\S]*?)\n\s{4}\)/g)].map((m) => m[1]);
    expect(responseBlocks.length).toBeGreaterThan(0);
    for (const block of responseBlocks) {
      for (const forbidden of ['personaId', 'authProfileId', 'rootDid', 'kybeAttestation', 'fioHandle']) {
        expect(block).not.toContain(forbidden);
      }
    }
    // and the assessment contract itself carries no T0 field
    for (const forbidden of ['authProfileId', 'rootDid', 'kybeAttestation', 'fioHandle']) {
      expect(continuityService).not.toContain(forbidden);
    }
    // personaId appears in the service ONLY inside prose, never as a returned field
    expect(continuityService).not.toMatch(/personaId[:,]/);
  });
});
