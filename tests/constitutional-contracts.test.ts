/**
 * Constitutional-services canary suite (CFS-015 Phase 1).
 *
 * Pure-logic tests — no network, no Supabase (store/grounding calls are
 * mocked). Guards the three Phase-1 foundations:
 *
 *   1. Ontology resolver — terminology-canon drift correction (non-canonical
 *      spellings resolve to canon), concept→seed mapping integrity (every
 *      mapped seed id EXISTS in canonical-invariants.seed.json — the
 *      canary that keeps the resolver honest against the seed crystal),
 *      unresolved-drift surfacing, and the prompt block contract.
 *   2. Model router — per-stage routes stay on the provider allowlist;
 *      env overrides validated (invalid → ignored, never guessed through);
 *      the fallback ladder terminates at venice (sovereign survivability);
 *      degradation is flagged, and total failure only occurs when NO
 *      provider is reachable.
 *   3. Pipeline constant — the canonical development pipeline order is
 *      pinned (sequencing corollary: order is constitutional data).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the invariant substrate modules the resolver imports — the canary
// exercises resolution logic, not the DB.
vi.mock('@/services/invariants/store', () => ({
  getCanonVersionStamp: vi.fn(async () => 'canon-test-1'),
  getInvariantsBySeedIds: vi.fn(async (ids: string[]) => ids.map((id) => ({ id: `uuid-${id}` }))),
}));
vi.mock('@/services/invariants/grounding', () => ({
  buildInvariantSlice: vi.fn(async () => ({ generatedAt: null, context: {}, items: [], citedIds: [] })),
  citeInvariants: vi.fn(async () => undefined),
}));

import {
  resolveOntology,
  ontologyPromptBlock,
  loadTerminologyCanon,
  CONCEPT_SEEDS,
} from '@/services/constitutional/ontologyResolver';
import { routeFor, describeRoutes } from '@/services/constitutional/modelRouter';
import {
  REASONING_STAGES,
  CONSTITUTIONAL_CAPABILITY_PIPELINE,
  CONSTITUTIONAL_IMPROVEMENT_LOOP,
} from '@/types/constitutional';
import { EXPERIMENT_MODEL_OPTIONS, isAllowedExperimentModel } from '@/services/experiments/llm';
import seedFile from '@/codexes/packs/ccrl/foundation/canonical-invariants.seed.json';
import {
  projectCounterfactual,
  type CounterfactualEdge,
} from '@/services/consequence/counterfactual';

describe('Canonical Ontology Service (CFS-015)', () => {
  it('parses the terminology canon from docs/platform-ontology.md (not the fallback)', () => {
    const canon = loadTerminologyCanon();
    const names = canon.map((t) => t.canonical);
    // The doc's core terms — and Enforcement (a section, not a term) excluded.
    for (const expected of ['BlakQube', 'aigentMe', 'iQube', 'AigentZ', 'DVN']) {
      expect(names).toContain(expected);
    }
    expect(names).not.toContain('Enforcement');
  });

  it('resolves non-canonical drift spellings to canon', async () => {
    const r = await resolveOntology('the black qube tier and the agent me guardian, per the DVN');
    const canonicals = r.resolvedTerms.map((t) => t.canonical);
    expect(canonicals).toContain('BlakQube');
    expect(canonicals).toContain('aigentMe');
    expect(canonicals).toContain('DVN');
  });

  it('CONCEPT_SEEDS — every mapped seed id exists in the seed crystal', () => {
    const seedIds = new Set(
      (seedFile as { invariants: { id: string }[] }).invariants.map((i) => i.id),
    );
    for (const [concept, ids] of Object.entries(CONCEPT_SEEDS)) {
      for (const id of ids) {
        expect(seedIds.has(id), `${concept} → ${id} missing from canonical-invariants.seed.json`).toBe(true);
      }
    }
  });

  it('attaches governing invariants to resolved concepts', async () => {
    const r = await resolveOntology('How does Standing differ from Reach?');
    const standing = r.resolvedTerms.find((t) => t.canonical === 'standing');
    expect(standing?.invariantIds).toContain('inv.constitutional.061');
    const reach = r.resolvedTerms.find((t) => t.canonical === 'reach');
    expect(reach?.invariantIds).toContain('inv.constitutional.062');
  });

  it('surfaces unresolvable qube-flavoured drift instead of dropping it', async () => {
    const r = await resolveOntology('what is a FroopyQube exactly?');
    expect(r.unresolved.length).toBeGreaterThan(0);
    expect(r.unresolved.join(' ')).toMatch(/froopyqube/i);
  });

  it('prompt block: empty on empty resolution, canonical guidance otherwise', async () => {
    const none = await resolveOntology('hello there, nice weather');
    expect(ontologyPromptBlock(none)).toBe('');
    const some = await resolveOntology('tell me about the iqube protocol and standing');
    const block = ontologyPromptBlock(some);
    expect(block).toContain('CANONICAL ONTOLOGY');
    expect(block).toContain('iQube');
    expect(block).toContain('inv.constitutional.061');
  });
});

describe('Model Router v1 (CFS-015)', () => {
  const ENV_KEYS = REASONING_STAGES.map((s) => `CONSTITUTIONAL_ROUTE_${s.toUpperCase()}`);
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });
  afterEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });

  it('every stage has a route, and every default is on the provider allowlist', () => {
    const routes = describeRoutes();
    expect(routes.map((r) => r.stage).sort()).toEqual([...REASONING_STAGES].sort());
    for (const r of routes) {
      expect(isAllowedExperimentModel(r.provider, r.model), `${r.stage} → ${r.provider}:${r.model}`).toBe(true);
      expect(r.source).toBe('default');
    }
  });

  it('valid env override wins; invalid and off-allowlist overrides are ignored', () => {
    process.env.CONSTITUTIONAL_ROUTE_CONSEQUENCE = 'openai:gpt-4o';
    expect(routeFor('consequence')).toMatchObject({ provider: 'openai', model: 'gpt-4o', source: 'override' });

    process.env.CONSTITUTIONAL_ROUTE_RISK = 'not-a-provider:whatever';
    expect(routeFor('risk').source).toBe('default');

    process.env.CONSTITUTIONAL_ROUTE_VALUE = 'anthropic:made-up-model-9000';
    expect(routeFor('value').source).toBe('default');
  });

  it('the sovereign fallback (venice) has allowlisted models available', () => {
    // The ladder terminates at venice — sovereignty requires the open-weight
    // provider to be a real routing target, not a dead end.
    expect(EXPERIMENT_MODEL_OPTIONS.venice.length).toBeGreaterThan(0);
    for (const m of EXPERIMENT_MODEL_OPTIONS.venice) {
      expect(isAllowedExperimentModel('venice', m.id)).toBe(true);
    }
  });
});

describe('Constitutional pipeline + improvement loop constants (sequencing corollary)', () => {
  it('Capability Pipeline order is pinned — order is constitutional data', () => {
    expect([...CONSTITUTIONAL_CAPABILITY_PIPELINE]).toEqual([
      'intent',
      'context',
      'capability',
      'risk',
      'value',
      'price',
      'consequence',
      'implementation',
      'validation',
      'receipt',
      'learning',
    ]);
  });

  it('Improvement Loop order is pinned — terminus is improved CAPABILITY', () => {
    expect([...CONSTITUTIONAL_IMPROVEMENT_LOOP]).toEqual([
      'capability',
      'operation',
      'observation',
      'receipt',
      'learning',
      'improved-capability',
    ]);
  });
});

describe('Strand-2 capability services (Phase 2 Agent B)', () => {
  const PROVIDER_KEYS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'VENICE_API_KEY'];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of PROVIDER_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of PROVIDER_KEYS) {
      if (saved[k] !== undefined) process.env[k] = saved[k];
    }
  });

  it('inference providers: five slots, honest stubs for gemini/codex, venice is open-weight', async () => {
    const { CONSTITUTIONAL_PROVIDERS, getProvider } = await import(
      '@/services/constitutional/inferenceProviders'
    );
    expect(CONSTITUTIONAL_PROVIDERS.map((p: { id: string }) => p.id).sort()).toEqual(
      ['anthropic', 'codex', 'gemini', 'openai', 'venice'],
    );
    const venice = getProvider('venice');
    expect(venice?.kind).toBe('open-weight');
    for (const stubId of ['gemini', 'codex']) {
      const stub = getProvider(stubId);
      expect(stub?.available()).toBe(false);
      const out = await stub!.infer({ system: 's', user: 'u' });
      expect(out.evaluated).toBe(false);
      if (out.evaluated === false) expect(out.reason).toMatch(/not implemented/i);
    }
  });

  it('implementation pack degrades to the honest template when no provider is reachable', async () => {
    const { generateImplementationPack } = await import(
      '@/services/constitutional/implementationPack'
    );
    // No provider keys in env → callStage throws naturally → template pack.
    const pack = await generateImplementationPack({ goal: 'test the fallback discipline' });
    expect(pack.composedBy).toBe('template');
    expect(pack.implementationMechanism).toBe('code');
    expect(pack.areasToTouch).toEqual([]);
    expect(pack.validationPlan.length).toBeGreaterThan(0);
    expect(pack.receiptPlan.length).toBeGreaterThan(0);
    expect(pack.goal).toBe('test the fallback discipline');
    expect(pack.canonVersion).toBe('canon-test-1'); // from the mocked store
    // Preflight null-tolerance: with a mocked empty slice the forecast runs
    // over zero bindings — the pack must remain valid whether preflight is
    // a real block or null (best-effort by design).
    expect(pack.preflight === null || typeof pack.preflight === 'object').toBe(true);
    if (pack.preflight) {
      expect(pack.preflight.risk.basis).toBe('heuristic');
      expect(pack.preflight.value.basis).toBe('heuristic');
      expect(['proceed', 'escalate']).toContain(pack.preflight.disposition);
    }
  });
});

describe('Chrysalis Test criteria (CFS-015 final acceptance test)', () => {
  it('acceptance-criterion ids are pinned — criteria never silently vanish', async () => {
    const { CHRYSALIS_CRITERIA_IDS } = await import('@/types/constitutional');
    expect([...CHRYSALIS_CRITERIA_IDS]).toEqual([
      'constitutional-reasoning',
      'reasoning-surfaces-governed',
      'rendering-governed',
      'develops-capabilities',
      'generates-receipts',
      'validates-outcomes',
      'learns-operationally',
      'sovereignty',
      'provider-interchangeability',
      'deployment-native',
    ]);
  });
});

describe('EXP-004 Sovereignty Drill (CFS-015 principle 4)', () => {
  it('provider is pinned to the open-weight provider by definition', async () => {
    const { SOVEREIGN_PROVIDER } = await import('@/services/experiments/exp004');
    expect(SOVEREIGN_PROVIDER).toBe('venice');
  });

  it('battery shape is stable: five grounded tasks + one pack task', async () => {
    const { exp004Battery } = await import('@/services/experiments/exp004');
    const battery = exp004Battery();
    expect(battery.tasks.length).toBe(5);
    expect(battery.packTask.id).toBe('task-6-implementation-pack');
    expect(battery.packTask.goal.length).toBeGreaterThan(20);
    // Task ids are the EXP-003 ids — the degradation report compares
    // like-for-like against the frontier record.
    for (const t of battery.tasks) expect(t.id).toMatch(/^task-\d/);
  });

  it('rehearsal arm never includes the sovereign provider (a venice run IS the drill)', async () => {
    const { REHEARSAL_PROVIDERS, SOVEREIGN_PROVIDER, isRehearsalProvider } = await import(
      '@/services/experiments/exp004'
    );
    // Operator preference chain (2026-07-06): chaingpt default → openai
    // fallback → venice as the sovereign run. Order is meaningful.
    expect(REHEARSAL_PROVIDERS).toEqual(['chaingpt', 'openai']);
    expect((REHEARSAL_PROVIDERS as readonly string[]).includes(SOVEREIGN_PROVIDER)).toBe(false);
    expect(isRehearsalProvider('venice')).toBe(false);
    expect(isRehearsalProvider('chaingpt')).toBe(true);
    expect(isRehearsalProvider('openai')).toBe(true);
  });

  it('chaingpt is a real experiment adapter with honest usage semantics', async () => {
    const { EXPERIMENT_MODEL_OPTIONS, EXPERIMENT_PROVIDERS } = await import('@/services/experiments/llm');
    expect(EXPERIMENT_PROVIDERS.chaingpt.model()).toBe('general_assistant');
    expect(EXPERIMENT_MODEL_OPTIONS.chaingpt.map((m) => m.id)).toEqual(['general_assistant']);
  });

  it('sovereignty is a provider-CLASS property: the sovereign provider is open-weight in the inventory', async () => {
    const { SOVEREIGN_PROVIDER, SOVEREIGN_CLASS } = await import('@/services/experiments/exp004');
    const { CONSTITUTIONAL_PROVIDERS } = await import('@/services/constitutional/inferenceProviders');
    expect(SOVEREIGN_CLASS).toBe('open-weight');
    const sovereign = CONSTITUTIONAL_PROVIDERS.find((p) => p.id === SOVEREIGN_PROVIDER);
    expect(sovereign?.kind).toBe(SOVEREIGN_CLASS);
    // Frontier members measure a real (S2, substitutable) rung of the bundle
    // but do not reach the S3 open-weight rung — openai is frontier in the
    // inventory (apex recalibration 2026-07-09: S3 is open-weight/third-party
    // hosted, the apex tiers S4/S5 are higher — none are the gate).
    expect(CONSTITUTIONAL_PROVIDERS.find((p) => p.id === 'openai')?.kind).toBe('frontier');
  });

  it('graded sovereignty-scale mapping: frontier→S2, open-weight→S3, self-hosted→S4, incomplete→null (apex recalibration 2026-07-09)', async () => {
    const { sovereigntyRungForRun, bundleComponentsForArm } = await import('@/services/experiments/exp004');
    // A completed frontier substitute run measures S2 (substitutable); a
    // completed open-weight (third-party hosted) run reaches S3; a self-hosted
    // (own-infra) run reaches the S4 model apex. No rung is claimed when
    // constitutional operation did not complete.
    expect(sovereigntyRungForRun('frontier', true)).toBe('s2-substitutable');
    expect(sovereigntyRungForRun('open-weight', true)).toBe('s3-open-weight');
    expect(sovereigntyRungForRun('self-hosted', true)).toBe('s4-self-hosted');
    expect(sovereigntyRungForRun('frontier', false)).toBeNull();
    expect(sovereigntyRungForRun('open-weight', false)).toBeNull();
    expect(sovereigntyRungForRun('self-hosted', false)).toBeNull();
    // Frontier measures interchangeability + commercial independence; the
    // open-weight run adds open-weight independence; the self-hosted run adds
    // model-hosting sovereignty (the apex-model component).
    expect(bundleComponentsForArm('frontier')).toContain('commercial-independence');
    expect(bundleComponentsForArm('frontier')).not.toContain('open-weight-independence');
    expect(bundleComponentsForArm('open-weight')).toContain('open-weight-independence');
    expect(bundleComponentsForArm('open-weight')).not.toContain('model-hosting-sovereignty');
    expect(bundleComponentsForArm('self-hosted')).toContain('model-hosting-sovereignty');
  });

  it('sovereignty is a SCALE, not a boolean — rung order pinned incl. apex tiers (apex recalibration 2026-07-09)', async () => {
    const { SOVEREIGNTY_SCALE } = await import('@/types/constitutional');
    expect(SOVEREIGNTY_SCALE).toEqual([
      's0-dependent',
      's1-interchangeable',
      's2-substitutable',
      's3-open-weight',
      's4-self-hosted',
      's5-sovereign-platform',
    ]);
    // The essence (interchangeability, operator choice without lock-in) precedes
    // the open-weight rung — order is meaning. And S3 (third-party-hosted open
    // weights) is NOT the maximum: the model apex (S4 self-hosted) and platform
    // apex (S5 sovereign-platform) sit above it.
    expect(SOVEREIGNTY_SCALE.indexOf('s1-interchangeable')).toBeLessThan(
      SOVEREIGNTY_SCALE.indexOf('s3-open-weight'),
    );
    expect(SOVEREIGNTY_SCALE.indexOf('s3-open-weight')).toBeLessThan(
      SOVEREIGNTY_SCALE.indexOf('s4-self-hosted'),
    );
    expect(SOVEREIGNTY_SCALE.indexOf('s4-self-hosted')).toBeLessThan(
      SOVEREIGNTY_SCALE.indexOf('s5-sovereign-platform'),
    );
  });

  it('the Sovereignty Scale resolves through the constitutional glossary', async () => {
    const r = await resolveOntology('Where does this run land on the sovereignty scale?');
    expect(r.resolvedTerms.map((t) => t.canonical)).toContain('Sovereignty Scale');
  });

  it('Platform Sovereignty is a bundle (CFS-018): term resolves and carries its governing invariants', async () => {
    const r = await resolveOntology(
      'Is platform sovereignty infringed when commercial independence fails despite open weights?',
    );
    const canonicals = r.resolvedTerms.map((t) => t.canonical);
    expect(canonicals).toContain('Platform Sovereignty');
    const ps = r.resolvedTerms.find((t) => t.canonical.toLowerCase() === 'platform sovereignty');
    expect(ps?.invariantIds).toContain('inv.sovereignty.100');
    // The Venice lesson pinned: the commercial-gate invariant governs the bundle.
    expect(ps?.invariantIds).toContain('inv.sovereignty.103');
  });

  it('sovereignty seed crystal: the bundle invariants 100-107 exist in the sovereignty namespace', () => {
    const seeds = (seedFile as { invariants: { id: string; namespace: string }[] }).invariants;
    const sovereignty = seeds.filter((s) => s.namespace === 'sovereignty').map((s) => s.id);
    for (let n = 100; n <= 107; n += 1) {
      expect(sovereignty).toContain(`inv.sovereignty.${n}`);
    }
  });

  it('research object model (CFS-019 Phase C): lifecycle orders + registries pinned', async () => {
    const {
      EXPERIMENT_LIFECYCLE,
      PUBLICATION_LIFECYCLE,
      EXPERIMENT_REGISTRY,
      SERIES_REGISTRY,
      isLegalExperimentTransition,
    } = await import('@/types/research');
    expect(EXPERIMENT_LIFECYCLE).toEqual([
      'designed', 'protocol-ratified', 'running', 'evaluated', 'published', 'replicated',
    ]);
    expect(PUBLICATION_LIFECYCLE).toEqual(['draft', 'internal', 'canonical', 'superseded']);
    expect(EXPERIMENT_REGISTRY.map((e) => e.id)).toEqual(['EXP-001', 'EXP-002', 'EXP-003', 'EXP-004']);
    // Every registry member belongs to a registered series; every governing
    // invariant exists in the seed crystal (no invented ids).
    const seriesIds = new Set(SERIES_REGISTRY.map((s) => s.id));
    const seedIds = new Set((seedFile as { invariants: { id: string }[] }).invariants.map((i) => i.id));
    for (const e of EXPERIMENT_REGISTRY) {
      expect(seriesIds.has(e.seriesId)).toBe(true);
      for (const inv of e.governingInvariants) expect(seedIds.has(inv), `${e.id} → ${inv}`).toBe(true);
    }
    // Transition legality: forward steps + running re-entry only.
    expect(isLegalExperimentTransition('designed', 'protocol-ratified')).toBe(true);
    expect(isLegalExperimentTransition('published', 'running')).toBe(true);
    expect(isLegalExperimentTransition('designed', 'published')).toBe(false);
    expect(isLegalExperimentTransition('designed', 'running')).toBe(false);
  });

  it('Constitutional Cybernetics (CFS-019): glossary term resolves with its governing invariants', async () => {
    const r = await resolveOntology(
      'How does constitutional cybernetics govern constitutional feedback in the CCRL?',
    );
    const cc = r.resolvedTerms.find((t) => t.canonical.toLowerCase() === 'constitutional cybernetics');
    expect(cc).toBeTruthy();
    expect(cc?.invariantIds).toContain('inv.cybernetics.108');
    const seeds = (seedFile as { invariants: { id: string; namespace: string }[] }).invariants;
    const cyb = seeds.filter((s) => s.namespace === 'cybernetics').map((s) => s.id);
    for (let n = 108; n <= 111; n += 1) {
      expect(cyb).toContain(`inv.cybernetics.${n}`);
    }
  });
});

describe('Constitutional Glossary — resolver-wired vocabulary (CFS-015 amendment)', () => {
  it('glossary terms resolve as terminology canon', async () => {
    const r = await resolveOntology(
      'How does consequence engineering relate to sovereign survivability under constitutional computing?',
    );
    const canonicals = r.resolvedTerms.map((t) => t.canonical);
    expect(canonicals).toContain('Consequence Engineering');
    expect(canonicals).toContain('Sovereign Survivability');
    expect(canonicals).toContain('Constitutional Computing');
  });

  it('the superseded pipeline name resolves to the canonical rename', async () => {
    const r = await resolveOntology('update the constitutional development pipeline docs');
    const pipeline = r.resolvedTerms.find((t) => t.canonical === 'Constitutional Capability Pipeline');
    expect(pipeline).toBeTruthy();
  });
});

describe('Computational Epistemology — Aletheon institute-standing amendment (CFS-019)', () => {
  it('the glossary term resolves with its governing invariant attached', async () => {
    const r = await resolveOntology(
      'What does computational epistemology say about knowledge as a computational object?',
    );
    const ce = r.resolvedTerms.find(
      (t) => t.canonical.toLowerCase() === 'computational epistemology',
    );
    expect(ce).toBeTruthy();
    expect(ce?.invariantIds).toContain('inv.epistemology.119');
  });

  it('epistemology seed crystal: invariants 119-120 exist in the epistemology namespace', () => {
    const seeds = (seedFile as { invariants: { id: string; namespace: string }[] }).invariants;
    const epi = seeds.filter((s) => s.namespace === 'epistemology').map((s) => s.id);
    for (let n = 119; n <= 120; n += 1) {
      expect(epi).toContain(`inv.epistemology.${n}`);
    }
  });

  it('RESEARCH_PROGRAMMES pinned — the A/B/C nomenclature maps to registered experiments', async () => {
    const { RESEARCH_PROGRAMMES, EXPERIMENT_REGISTRY } = await import('@/types/research');
    expect(RESEARCH_PROGRAMMES.map((p) => `${p.id}:${p.name}`)).toEqual([
      'A:Invariant Knowledge',
      'B:Temporal Composition',
      'C:Reasoning Compression',
    ]);
    // Every programme experiment exists in the pinned experiment registry.
    const experimentIds = new Set(EXPERIMENT_REGISTRY.map((e) => e.id));
    for (const p of RESEARCH_PROGRAMMES) {
      for (const exp of p.experiments) {
        expect(experimentIds.has(exp), `Programme ${p.id} → ${exp} not in EXPERIMENT_REGISTRY`).toBe(true);
      }
    }
  });
});

describe('DCIR — Dynamic Constitutional Interaction Runtime (CFS-020 D0)', () => {
  it('the closed loop and runtime domain orders are pinned — order is constitutional data', async () => {
    const { DCIR_LOOP, DCIR_RUNTIMES } = await import('@/types/dcir');
    expect([...DCIR_LOOP]).toEqual([
      'conversation',
      'inference',
      'action',
      'observation',
      'state-update',
      'recommendation',
    ]);
    expect([...DCIR_RUNTIMES]).toEqual(['conversational', 'action', 'observation']);
  });

  it('interaction seed crystal: the seven core invariants 112-118 exist in the interaction namespace', () => {
    const seeds = (seedFile as { invariants: { id: string; namespace: string }[] }).invariants;
    const interaction = seeds.filter((s) => s.namespace === 'interaction').map((s) => s.id);
    for (let n = 112; n <= 118; n += 1) {
      expect(interaction).toContain(`inv.interaction.${n}`);
    }
  });

  it('both DCIR glossary terms resolve with their governing invariants attached', async () => {
    const r = await resolveOntology(
      'how does the dynamic constitutional interaction runtime treat a behavioural invariant?',
    );
    const canonicals = r.resolvedTerms.map((t) => t.canonical);
    expect(canonicals).toContain('Dynamic Constitutional Interaction Runtime');
    expect(canonicals).toContain('Behavioural Invariant');
    const dcir = r.resolvedTerms.find(
      (t) => t.canonical.toLowerCase() === 'dynamic constitutional interaction runtime',
    );
    expect(dcir?.invariantIds).toContain('inv.interaction.112');
    expect(dcir?.invariantIds).toContain('inv.interaction.118');
    const bi = r.resolvedTerms.find((t) => t.canonical.toLowerCase() === 'behavioural invariant');
    expect(bi?.invariantIds).toContain('inv.interaction.115');
  });
});

describe('CCRL Phase E — counterfactual projection (CFS-019 §5 item 6)', () => {
  // A small, canonical field: A enables B, A constrains C (C canonical).
  const edge = (
    id: string,
    from: string,
    to: string,
    edgeType: CounterfactualEdge['edgeType'],
  ): CounterfactualEdge => ({ id, fromInvariantId: from, toInvariantId: to, edgeType });

  const baseline: CounterfactualEdge[] = [
    edge('e1', 'A', 'B', 'enables'),
    edge('e2', 'A', 'C', 'constrains'),
    edge('e3', 'A', 'D', 'contradicts'),
  ];
  const invariants = [
    { id: 'A', status: 'validated' },
    { id: 'B', status: 'validated' },
    { id: 'C', status: 'canonical' },
    { id: 'D', status: 'validated' },
  ];

  it('is deterministic — identical inputs yield identical output', () => {
    const h = { mode: 'add-node' as const, proposedEdges: [{ toInvariantId: 'B', edgeType: 'enables' as const }] };
    const first = projectCounterfactual(baseline, h, invariants);
    const second = projectCounterfactual(baseline, h, invariants);
    expect(second).toEqual(first);
  });

  it('a proposed contradicts edge flips the set incoherent and forces escalation', () => {
    // Start from a coherent field (no contradicts) so the flip is observable.
    const coherent: CounterfactualEdge[] = [edge('e1', 'A', 'B', 'enables')];
    const p = projectCounterfactual(
      coherent,
      { mode: 'add-node', proposedEdges: [{ toInvariantId: 'B', edgeType: 'contradicts' }] },
      invariants,
    );
    expect(p.coherentBefore).toBe(true);
    expect(p.coherentAfter).toBe(false);
    expect(p.coherenceFlips).toBe(true);
    expect(p.forcesEscalationAfter).toBe(true);
    expect(p.delta.contradicts).toBe(1);
  });

  it('remove-edge lowers the relevant count', () => {
    const p = projectCounterfactual(
      baseline,
      { mode: 'remove-edge', edgeId: 'e3' },
      invariants,
    );
    expect(p.baseline.contradicts).toBe(1);
    expect(p.projected.contradicts).toBe(0);
    expect(p.delta.contradicts).toBe(-1);
    // Removing the only contradiction restores coherence.
    expect(p.coherentBefore).toBe(false);
    expect(p.coherentAfter).toBe(true);
    expect(p.coherenceFlips).toBe(true);
  });

  it('a no-op hypothetical yields zero delta', () => {
    // remove-edge targeting an id absent from the field changes nothing.
    const p = projectCounterfactual(
      baseline,
      { mode: 'remove-edge', edgeId: 'does-not-exist' },
      invariants,
    );
    expect(p.delta).toEqual({ enables: 0, constrains: 0, contradicts: 0 });
    expect(p.coherenceFlips).toBe(false);
    expect(p.forcesEscalationChange).toBe(false);
    expect(p.readout).toMatch(/no-op|zero delta/i);
  });

  it('a constrains edge onto a canonical invariant forces escalation without breaking coherence', () => {
    const p = projectCounterfactual(
      [edge('e1', 'A', 'B', 'enables')],
      { mode: 'add-node', proposedEdges: [{ toInvariantId: 'C', edgeType: 'constrains' }] },
      invariants,
    );
    expect(p.coherentAfter).toBe(true); // no contradiction introduced
    expect(p.forcesEscalationBefore).toBe(false);
    expect(p.forcesEscalationAfter).toBe(true); // C is canonical
    expect(p.forcesEscalationChange).toBe(true);
  });
});

describe('DCIR generic surface helpers (CFS-020 composition — added for CCRL C2)', () => {
  it('surface events ride the DcirEvent contract: pinned kinds, surface as capsuleScope, no forbidden identifier keys', async () => {
    const {
      surfaceOpenedEvent,
      surfaceDataRefreshedEvent,
      surfacePromptSelectedEvent,
      DCIR_EVENT_SUMMARY_MAX,
    } = await import('@/services/dcir/eventStream');

    const events = [
      surfaceOpenedEvent('ccrl-research'),
      surfaceDataRefreshedEvent('ccrl-research', '4 experiments · 8 canonical results'),
      surfacePromptSelectedEvent('ccrl-research', 'Where does the research programme stand?'),
    ];

    // Kind vocabulary pinned — each helper's kind sits on the DcirEventKind union.
    expect(events.map((e) => e.kind)).toEqual(['NavigationOccurred', 'SystemEvent', 'ConversationTurn']);
    const kindUnion = [
      'DocumentCreated', 'DocumentEdited', 'SelectionChanged', 'RecommendationAccepted',
      'RecommendationRejected', 'ArtifactApproved', 'ArtifactRejected', 'UndoPerformed',
      'NavigationOccurred', 'WorkflowAdvanced', 'ToolOutputProduced', 'ConversationTurn',
      'PersonaChanged', 'SystemEvent',
    ];
    for (const e of events) {
      expect(kindUnion).toContain(e.kind);
      // The emitting surface rides capsuleScope (capsule containment applied to observation).
      expect(e.capsuleScope).toBe('ccrl-research');
      // Session-scoped D1 ceiling — nothing here is DVN-bound.
      expect(e.tier).toBe('t1-browser-safe');
      // Summaries are labels, never bodies.
      expect(e.summary.length).toBeLessThanOrEqual(DCIR_EVENT_SUMMARY_MAX);
      // T0 identifiers are inexpressible on the event shape.
      for (const forbidden of ['personaId', 'authProfileId', 'rootDid', 'fioHandle']) {
        expect(Object.keys(e)).not.toContain(forbidden);
      }
    }
  });
});

describe('DCIR D2 — Constitutional State Engine, observe-mode slice (CFS-020)', () => {
  it('the state snapshot keeps the contract shape and cannot express T0 identifiers', async () => {
    const { buildStateSnapshot } = await import('@/services/dcir/stateEngine');
    const {
      devImplementationPackGeneratedEvent,
      devProposalApprovedEvent,
      devCapsuleOpenedEvent,
    } = await import('@/services/dcir/eventStream');

    const events = [
      devCapsuleOpenedEvent('intent'),
      devImplementationPackGeneratedEvent(),
      devProposalApprovedEvent('dev_intent', 'intent'),
    ];
    const snap = buildStateSnapshot(events, {
      surface: 'dev-command-center',
      workflowStage: 'intent_capture',
      activeCapsule: 'intent',
    });

    // Contract shape (ConstitutionalStateSnapshot) — hardened fields carry
    // observed data; deferred fields stay at honest defaults.
    expect(Array.isArray(snap.intent)).toBe(true);
    expect(snap.persona).toBeNull(); // the T1 persona surface is deliberately not threaded here
    expect(snap.activeArtefacts.length).toBe(1); // the DocumentCreated-class event
    expect(snap.operatorDecisions.length).toBe(1); // the approval
    expect(snap.confidence).toBeGreaterThan(0);
    expect(snap.confidence).toBeLessThanOrEqual(0.6); // observe-mode never claims high confidence
    expect(typeof snap.capturedAt).toBe('string');

    // T0 identifiers are inexpressible anywhere in the serialised snapshot.
    const json = JSON.stringify(snap);
    for (const forbidden of ['personaId', 'authProfileId', 'rootDid', 'fioHandle', 'kybeAttestation']) {
      expect(json).not.toContain(forbidden);
    }
  });

  it('the miner is deterministic — same events yield identical patterns, ids, and evidence', async () => {
    const { mineBehaviouralInvariants } = await import('@/services/dcir/stateEngine');
    const { devProposalDismissedEvent, devCapsuleOpenedEvent, surfaceDataRefreshedEvent } =
      await import('@/services/dcir/eventStream');

    const events = [
      devProposalDismissedEvent('dev_gap_analysis', 'gap-analysis'),
      devProposalDismissedEvent('dev_gap_analysis', 'gap-analysis'),
      devCapsuleOpenedEvent('intent'),
      devCapsuleOpenedEvent('intent'),
      devCapsuleOpenedEvent('intent'),
      surfaceDataRefreshedEvent('ccrl-research', '4 experiments'),
      surfaceDataRefreshedEvent('ccrl-research', '4 experiments'),
      surfaceDataRefreshedEvent('ccrl-research', '5 experiments'),
    ];
    const first = mineBehaviouralInvariants(events);
    const second = mineBehaviouralInvariants(events);
    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first); // no clock, no randomness — ids included
  });

  it('below-threshold behaviour emits nothing', async () => {
    const { mineBehaviouralInvariants } = await import('@/services/dcir/stateEngine');
    const {
      devProposalDismissedEvent,
      devProposalApprovedEvent,
      devCapsuleOpenedEvent,
      surfaceDataRefreshedEvent,
    } = await import('@/services/dcir/eventStream');

    // One dismissal (<2), two capsule opens (<3), two refreshes (<3),
    // two approvals (<3): none of the patterns reaches its threshold.
    const events = [
      devProposalDismissedEvent('dev_intent', 'intent'),
      devCapsuleOpenedEvent('context'),
      devCapsuleOpenedEvent('context'),
      surfaceDataRefreshedEvent('ccrl-research', '4 experiments'),
      surfaceDataRefreshedEvent('ccrl-research', '4 experiments'),
      devProposalApprovedEvent('dev_intent', 'intent'),
      devProposalApprovedEvent('dev_context', 'context'),
    ];
    expect(mineBehaviouralInvariants(events)).toEqual([]);
  });

  it('mined invariants are always status observed — never proposed, never canonical — with honest evidence', async () => {
    const { mineBehaviouralInvariants, compactBehaviouralInvariants, DCIR_OBSERVED_PATTERN_LIMIT } =
      await import('@/services/dcir/stateEngine');
    const {
      devProposalDismissedEvent,
      devProposalApprovedEvent,
      devCapsuleOpenedEvent,
      surfaceDataRefreshedEvent,
    } = await import('@/services/dcir/eventStream');

    const events = [
      devProposalDismissedEvent('dev_gap_analysis', 'gap-analysis'),
      devProposalDismissedEvent('dev_gap_analysis', 'gap-analysis'),
      devProposalDismissedEvent('dev_gap_analysis', 'gap-analysis'),
      devProposalApprovedEvent('dev_intent', 'intent'),
      devProposalApprovedEvent('dev_context', 'context'),
      devProposalApprovedEvent('dev_consequence_canvas', 'consequence-canvas'),
      devCapsuleOpenedEvent('validation'),
      devCapsuleOpenedEvent('validation'),
      devCapsuleOpenedEvent('validation'),
      surfaceDataRefreshedEvent('ccrl-research', '4 experiments'),
      surfaceDataRefreshedEvent('ccrl-research', '4 experiments'),
      surfaceDataRefreshedEvent('ccrl-research', '4 experiments'),
    ];
    const mined = mineBehaviouralInvariants(events);
    expect(mined.length).toBeGreaterThanOrEqual(4); // dismissal + approval-style + revisit + refresh
    for (const inv of mined) {
      // Ratification boundary: the miner emits runtime-local observations
      // ONLY. 'proposed' is the substrate submission path; 'canonical' is
      // unrepresentable on the type at all (inv.interaction.115).
      expect(inv.status).toBe('observed');
      expect(inv.evidenceCount).toBeGreaterThanOrEqual(2);
      expect(inv.evidenceEventIds.length).toBe(inv.evidenceCount);
      expect(typeof inv.firstObservedAt).toBe('string');
    }
    // The compact ground-context form is bounded at the pinned limit.
    expect(DCIR_OBSERVED_PATTERN_LIMIT).toBe(3);
    expect(compactBehaviouralInvariants(mined).length).toBeLessThanOrEqual(DCIR_OBSERVED_PATTERN_LIMIT);
  });
});
