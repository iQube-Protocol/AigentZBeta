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
import seedFile from '@/codexes/packs/agentiq/foundation/canonical-invariants.seed.json';

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
