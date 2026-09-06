/**
 * Aigent Factor capability-runtime contract closure (2026-09-05) —
 * behavioral tests for the gaps identified in the operator's code audit of
 * the 2026-09-05 Factor cognitive-runtime fix:
 *
 *   1. Explicit capability selection is validated server-side in
 *      POST /api/assistant/ask-agent and never reaches askSpecialist when
 *      invalid.
 *   2. Live-LLM and deterministic-template responses share the SAME
 *      server-derived affordance/requiresApproval — the model may author
 *      prose, never policy.
 *   3. Affordance is never mechanical from `status` alone — a capability
 *      with no real handler can never read ACTION_AVAILABLE/PREPARABLE.
 *   4. The Aegis-referral capability is honestly distinguished as
 *      host-local UI navigation, never advertised as externally
 *      actionable on the Agent Card.
 *   5. The Agent Card's primary_duty is not intake-centric.
 *   6. /health separates runtime reachability from per-capability
 *      readiness — a permanently-planned capability never makes the whole
 *      runtime read "degraded".
 *
 * None of these are source-string canaries — every assertion calls real
 * code (the real route handlers, the real manifest, the real policy
 * function) and checks behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────
// 1. Explicit capability transport + server-side validation on the route.
// ─────────────────────────────────────────────────────────────────────────

vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: vi.fn(async () => ({ personaId: 'persona-test-1' })),
}));
vi.mock('@/services/iqube/experienceQube', () => ({ getExperienceQube: vi.fn(async () => null) }));
vi.mock('@/services/iqube/intentQube', () => ({ getIntentQube: vi.fn(async () => null) }));
vi.mock('@/services/capabilities/preflight', () => ({ runPreflightGather: vi.fn(async () => null) }));
vi.mock('@/services/invariants/resolution', () => ({ resolveConstitutionalField: vi.fn(async () => ({ snapshot: null })) }));
vi.mock('@/app/api/_lib/supabaseServer', () => ({ getSupabaseServer: vi.fn(() => null) }));
vi.mock('@/services/receipts/activityReceiptService', () => ({ createActivityReceipt: vi.fn(async () => null) }));
vi.mock('@/services/registry/invocationGateway', () => ({ invokeCapability: vi.fn(async () => ({ decision: 'allow', envelope: {} })) }));

const mockAskSpecialist = vi.fn();
vi.mock('@/services/agents/specialistRouter', () => ({
  askSpecialist: (...args: any[]) => mockAskSpecialist(...args),
}));

import { POST } from '@/app/api/assistant/ask-agent/route';

function makeAskAgentRequest(body: unknown): NextRequest {
  return new NextRequest('https://dev-beta.aigentz.me/api/assistant/ask-agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const FACTOR_RESPONSE = {
  specialistId: 'factor',
  specialistLabel: 'Aigent Factor',
  requestType: 'system_guidance',
  title: 'Candidate intake and evidence preparation',
  summary: 'Test summary',
  recommendations: ['a'],
  suggestedArtifacts: [],
  requiresApproval: true,
  confidence: 'high' as const,
  source: 'template' as const,
  generatedAt: '2026-09-05T00:00:00Z',
  affordance: 'ACTION_AVAILABLE' as const,
  resolvedCapabilityId: 'candidate_intake' as const,
  capabilityStatus: 'operational' as const,
  availableActions: [],
  blockers: [],
};

beforeEach(() => {
  mockAskSpecialist.mockReset();
  mockAskSpecialist.mockResolvedValue(FACTOR_RESPONSE);
});

describe('POST /api/assistant/ask-agent — explicit factorCapabilityId transport', () => {
  it('an invalid factorCapabilityId is rejected with 400 and never reaches askSpecialist', async () => {
    const res = await POST(makeAskAgentRequest({ specialistId: 'factor', prompt: 'hi', factorCapabilityId: 'not-a-real-capability' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid-factor-capability-id');
    expect(mockAskSpecialist).not.toHaveBeenCalled();
  });

  it('a non-string factorCapabilityId is also rejected with 400, never coerced', async () => {
    const res = await POST(makeAskAgentRequest({ specialistId: 'factor', prompt: 'hi', factorCapabilityId: 12345 }));
    expect(res.status).toBe(400);
    expect(mockAskSpecialist).not.toHaveBeenCalled();
  });

  it('a valid factorCapabilityId is forwarded verbatim into the specialist context', async () => {
    const res = await POST(makeAskAgentRequest({ specialistId: 'factor', prompt: 'irrelevant free text', factorCapabilityId: 'standing_proposal' }));
    expect(res.status).toBe(200);
    expect(mockAskSpecialist).toHaveBeenCalledTimes(1);
    const [{ context }] = mockAskSpecialist.mock.calls[0];
    expect(context.factorCapabilityId).toBe('standing_proposal');
  });

  it('is validated even for a non-factor specialist (never a smuggled-through unvalidated value)', async () => {
    const res = await POST(makeAskAgentRequest({ specialistId: 'marketa', prompt: 'hi', factorCapabilityId: 'bogus' }));
    expect(res.status).toBe(400);
    expect(mockAskSpecialist).not.toHaveBeenCalled();
  });

  it('omitting factorCapabilityId entirely is fine — no field is forwarded', async () => {
    const res = await POST(makeAskAgentRequest({ specialistId: 'factor', prompt: 'hi' }));
    expect(res.status).toBe(200);
    const [{ context }] = mockAskSpecialist.mock.calls[0];
    expect(context.factorCapabilityId).toBeUndefined();
  });

  it('factorScope is sanitized to known string fields only — an arbitrary shape never reaches the specialist context', async () => {
    const res = await POST(
      makeAskAgentRequest({
        specialistId: 'factor',
        prompt: 'hi',
        factorScope: { caseId: 'case-1', notAField: 'should be dropped', agentRef: 42 },
      }),
    );
    expect(res.status).toBe(200);
    const [{ context }] = mockAskSpecialist.mock.calls[0];
    expect(context.factorScope).toEqual({ caseId: 'case-1' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Live-LLM and template paths share the SAME server-derived envelope.
// ─────────────────────────────────────────────────────────────────────────

describe('askSpecialist(factor) — live-LLM affordance/approval are server-derived, never model-authored', () => {
  let askSpecialist: typeof import('@/services/agents/specialistRouter').askSpecialist;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    vi.doUnmock('@/services/agents/specialistRouter');
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-not-real');
    vi.resetModules();
    const mod = await import('@/services/agents/specialistRouter');
    askSpecialist = mod.askSpecialist;
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockLlmJson(json: Record<string, unknown>) {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(json) } }] }),
    } as unknown as Response);
  }

  function ctx(userPrompt: string) {
    return {
      activeCartridge: 'moneypenny',
      experienceName: null,
      experienceType: 'venture_building',
      primaryGoal: null,
      currentStage: 'setup',
      activeCartridges: ['moneypenny'],
      intentName: userPrompt,
      intentRationale: null,
      userPrompt,
    };
  }

  it('an LLM claiming requiresApproval:false for candidate_intake is overridden by the server policy (true)', async () => {
    mockLlmJson({
      title: 'Fake LLM title',
      summary: 'Fake LLM summary',
      recommendations: ['a'],
      requiresApproval: false,
    });
    const res = await askSpecialist({ specialistId: 'factor', context: ctx('Help Atlas prepare for iQube Registry admission') });
    expect(res.source).toBe('llm');
    expect(res.requiresApproval).toBe(true);
    expect(res.affordance).toBe('ACTION_AVAILABLE');
    expect(res.resolvedCapabilityId).toBe('candidate_intake');
  });

  it('a PLANNED capability stays PLANNED even when the LLM response reads confident and actionable', async () => {
    mockLlmJson({
      title: 'Sure, we can do that',
      summary: 'Runtime activation is fully live and ready to use right now.',
      recommendations: ['Activate the runtime immediately'],
      requiresApproval: false,
    });
    // bankr_tokenization gained real handlers in Phase 5 (services/factor/
    // bankrCapabilityHandlers.ts) and is no longer PLANNED (now 'partial') —
    // runtime_activation remains genuinely unimplemented and is the current
    // illustrative PLANNED example.
    const res = await askSpecialist({ specialistId: 'factor', context: ctx('Activate this agent\'s runtime') });
    expect(res.source).toBe('llm');
    expect(res.affordance).toBe('PLANNED');
    expect(res.resolvedCapabilityId).toBe('runtime_activation');
  });

  it('a partial capability (standing_proposal) is PREPARABLE on the live-LLM path too, matching the template path', async () => {
    mockLlmJson({ title: 'x', summary: 'y', recommendations: ['a'] });
    const res = await askSpecialist({ specialistId: 'factor', context: ctx('How can this agent gain standing?') });
    expect(res.source).toBe('llm');
    expect(res.affordance).toBe('PREPARABLE');
    expect(res.capabilityStatus).toBe('partial');
  });

  it('a non-Factor specialist keeps trusting the model\'s own requiresApproval — this contract is Factor-only', async () => {
    mockLlmJson({ title: 'x', summary: 'y', recommendations: ['a'], requiresApproval: false });
    const res = await askSpecialist({ specialistId: 'marketa', context: ctx('Find me some partners') });
    expect(res.source).toBe('llm');
    expect(res.requiresApproval).toBe(false);
    expect(res.affordance).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. Affordance is never mechanical from `status` alone.
// ─────────────────────────────────────────────────────────────────────────

describe('deriveFactorResponseEnvelope — cross-checks status against handlerKind, never status alone', () => {
  it('every capability with handlerKind "none" is capped at ADVISORY or PLANNED, never ACTION_AVAILABLE/PREPARABLE', async () => {
    const { FACTOR_CAPABILITIES, deriveFactorResponseEnvelope } = await import('@/services/factor/factorCapabilityManifest');
    for (const cap of FACTOR_CAPABILITIES) {
      if (cap.handlerKind !== 'none') continue;
      const envelope = deriveFactorResponseEnvelope(cap.id);
      expect(['ADVISORY', 'PLANNED'], `${cap.id} has handlerKind "none" but resolved to ${envelope.affordance}`).toContain(envelope.affordance);
    }
  });

  it('aegis_referral is BLOCKED with no bound case, and ACTION_AVAILABLE once a caseId is bound', async () => {
    const { deriveFactorResponseEnvelope } = await import('@/services/factor/factorCapabilityManifest');
    const unbound = deriveFactorResponseEnvelope('aegis_referral');
    expect(unbound.affordance).toBe('BLOCKED');
    expect(unbound.blockers.length).toBeGreaterThan(0);

    const bound = deriveFactorResponseEnvelope('aegis_referral', { caseId: 'case-1' });
    expect(bound.affordance).toBe('ACTION_AVAILABLE');
    expect(bound.blockers).toEqual([]);
  });

  it('requiresApproval is a static policy fact per capability, not recomputed ad hoc per call', async () => {
    const { deriveFactorResponseEnvelope } = await import('@/services/factor/factorCapabilityManifest');
    expect(deriveFactorResponseEnvelope('candidate_intake').requiresApproval).toBe(true);
    expect(deriveFactorResponseEnvelope('general_orientation').requiresApproval).toBe(false);
    expect(deriveFactorResponseEnvelope('agent_service_discovery').requiresApproval).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4 & 5. Agent Card — handler-kind projection + non-intake-centric identity.
// ─────────────────────────────────────────────────────────────────────────

describe('GET /api/agents/factor/agent-card.json — handler-kind honesty', () => {
  it('primary_duty is not intake-centric — candidate intake is a skill, not the identity', async () => {
    const { GET } = await import('@/app/api/agents/factor/agent-card.json/route');
    const res = await GET(new NextRequest('https://dev-beta.aigentz.me/api/agents/factor/agent-card.json'));
    const body = await res.json();
    expect(body.metadata.primary_duty.toLowerCase()).not.toMatch(/^facilitate a candidate agent's journey to admission/);
    expect(body.metadata.primary_duty.toLowerCase()).toMatch(/discover|prepare|connect|activate/);
  });

  it('the aegis-referral skill is marked host-local, never externally actionable', async () => {
    const { GET } = await import('@/app/api/agents/factor/agent-card.json/route');
    const res = await GET(new NextRequest('https://dev-beta.aigentz.me/api/agents/factor/agent-card.json'));
    const body = await res.json();
    const referral = body.skills.find((s: { id: string }) => s.id === 'aegis-referral');
    expect(referral).toBeTruthy();
    expect(referral.hostLocalOnly).toBe(true);
    expect(referral.externallyActionable).toBe(false);
  });

  it('candidate-intake (a real REST-backed capability) IS marked externally actionable', async () => {
    const { GET } = await import('@/app/api/agents/factor/agent-card.json/route');
    const res = await GET(new NextRequest('https://dev-beta.aigentz.me/api/agents/factor/agent-card.json'));
    const body = await res.json();
    const intake = body.skills.find((s: { id: string }) => s.id === 'candidate-intake');
    expect(intake.externallyActionable).toBe(true);
    expect(intake.hostLocalOnly).toBe(false);
  });

  it('a planned capability (runtime-activation) is neither externally actionable nor host-local', async () => {
    const { GET } = await import('@/app/api/agents/factor/agent-card.json/route');
    const res = await GET(new NextRequest('https://dev-beta.aigentz.me/api/agents/factor/agent-card.json'));
    const body = await res.json();
    // bankr_tokenization gained a real 'service' handlerKind in Phase 5 and
    // is now externally actionable — runtime_activation remains the
    // illustrative still-unimplemented example.
    const runtimeActivation = body.skills.find((s: { id: string }) => s.id === 'runtime-activation');
    expect(runtimeActivation.externallyActionable).toBe(false);
    expect(runtimeActivation.hostLocalOnly).toBe(false);
  });

  it('bankr-tokenization is externally actionable now that a real service handler exists (Phase 5)', async () => {
    const { GET } = await import('@/app/api/agents/factor/agent-card.json/route');
    const res = await GET(new NextRequest('https://dev-beta.aigentz.me/api/agents/factor/agent-card.json'));
    const body = await res.json();
    const bankr = body.skills.find((s: { id: string }) => s.id === 'bankr-tokenization');
    expect(bankr.externallyActionable).toBe(true);
    expect(bankr.hostLocalOnly).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 6. Health — runtime reachability vs. capability readiness.
// ─────────────────────────────────────────────────────────────────────────

describe('GET /api/agents/factor/health — runtime status never blended with capability readiness', () => {
  it('reports status "ok" unconditionally, even though several capabilities are permanently planned', async () => {
    const { GET } = await import('@/app/api/agents/factor/health/route');
    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('separately reports a truthful capability-readiness summary distinguishing operational from planned', async () => {
    const { GET } = await import('@/app/api/agents/factor/health/route');
    const { FACTOR_CAPABILITIES } = await import('@/services/factor/factorCapabilityManifest');
    const res = await GET();
    const body = await res.json();
    const planned = FACTOR_CAPABILITIES.find((c) => c.status === 'planned')!;
    expect(body.capabilityReadiness.byCapability[planned.id]).toBe('planned');
    const operationalCount = FACTOR_CAPABILITIES.filter((c) => c.status === 'operational').length;
    expect(body.capabilityReadiness.summary).toContain(`${operationalCount}/${FACTOR_CAPABILITIES.length}`);
  });
});
