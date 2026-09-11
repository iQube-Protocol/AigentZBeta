/**
 * app/api/assistant/ask-agent/route.ts — the two new capability-invocation
 * call sites added 2026-08-06 (design doc §8's remaining follow-ons):
 *   1. a direct 'aigent-nakamoto' consultation is gated through
 *      invokeCapability() (direct pattern, no orchestrator) before her LLM
 *      chain runs at all — refused means the route answers 403, never a
 *      silent fallback to the ungoverned path.
 *   2. a 'moneypenny' consultation whose prompt is in Nakamoto's declared
 *      capability lane (bitcoin/decentralisation) triggers MoneyPenny's own
 *      decision to bring in Nakamoto as a helper (orchestrated pattern) —
 *      enrichment only, MoneyPenny's own answer is never blocked by it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: vi.fn(async () => ({ personaId: 'persona-test-1' })),
}));
vi.mock('@/services/iqube/experienceQube', () => ({ getExperienceQube: vi.fn(async () => null) }));
vi.mock('@/services/iqube/intentQube', () => ({ getIntentQube: vi.fn(async () => null) }));
vi.mock('@/services/capabilities/preflight', () => ({ runPreflightGather: vi.fn(async () => null) }));
vi.mock('@/services/invariants/resolution', () => ({ resolveConstitutionalField: vi.fn(async () => ({ snapshot: null })) }));
vi.mock('@/app/api/_lib/supabaseServer', () => ({ getSupabaseServer: vi.fn(() => null) }));
vi.mock('@/services/receipts/activityReceiptService', () => ({ createActivityReceipt: vi.fn(async () => null) }));

const mockInvokeCapability = vi.fn();
vi.mock('@/services/registry/invocationGateway', () => ({
  invokeCapability: (...args: any[]) => mockInvokeCapability(...args),
}));

const mockAskSpecialist = vi.fn();
vi.mock('@/services/agents/specialistRouter', () => ({
  askSpecialist: (...args: any[]) => mockAskSpecialist(...args),
}));

import { POST } from '@/app/api/assistant/ask-agent/route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('https://dev-beta.aigentz.me/api/assistant/ask-agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const NAKAMOTO_RESPONSE = {
  specialistId: 'aigent-nakamoto',
  specialistLabel: 'Aigent Nakamoto',
  requestType: 'decentralisation_brief',
  title: 'Bitcoin L2 comparison',
  summary: 'Lightning offers instant settlement; sidechains trade off trust assumptions.',
  recommendations: ['Evaluate Lightning for micro-settlement', 'Consider RGB for asset issuance'],
  suggestedArtifacts: [],
  requiresApproval: false,
  confidence: 'medium' as const,
  source: 'template' as const,
  generatedAt: '2026-08-06T00:00:00Z',
};

const MONEYPENNY_RESPONSE = {
  ...NAKAMOTO_RESPONSE,
  specialistId: 'moneypenny',
  specialistLabel: 'MoneyPenny',
  title: 'Treasury settlement options',
  summary: "Here's how Q¢ settlement compares across rails.",
  recommendations: ['Use USDC for cross-chain settlement'],
};

beforeEach(() => {
  mockInvokeCapability.mockReset();
  mockAskSpecialist.mockReset();
});

describe('POST /api/assistant/ask-agent — direct Nakamoto consultation is gated', () => {
  it('calls invokeCapability with the direct pattern (requestingAgentId === target, no orchestrator) before askSpecialist runs', async () => {
    mockInvokeCapability.mockResolvedValue({ decision: 'allow', envelope: {} });
    mockAskSpecialist.mockResolvedValue(NAKAMOTO_RESPONSE);

    const res = await POST(makeRequest({ specialistId: 'aigent-nakamoto', prompt: 'What is self-custody?' }));

    expect(res.status).toBe(200);
    expect(mockInvokeCapability).toHaveBeenCalledTimes(1);
    const [envelope, personaId] = mockInvokeCapability.mock.calls[0];
    expect(envelope).toMatchObject({
      mode: 'capability',
      requestingAgentId: 'aigent-nakamoto',
      capabilityId: 'bitcoin_decentralisation_expertise',
      executionMode: 'shadow',
    });
    expect(envelope.orchestratorAgentId).toBeUndefined();
    expect(personaId).toBe('persona-test-1');
    expect(mockAskSpecialist).toHaveBeenCalledTimes(1);
  });

  it('refuses with 403 and never calls askSpecialist when the gateway refuses', async () => {
    mockInvokeCapability.mockResolvedValue({ decision: 'refuse', code: 'PROVIDER_NOT_ADMITTED', reason: 'not admitted' });

    const res = await POST(makeRequest({ specialistId: 'aigent-nakamoto', prompt: 'What is self-custody?' }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'capability-invocation-refused', code: 'PROVIDER_NOT_ADMITTED' });
    expect(mockAskSpecialist).not.toHaveBeenCalled();
  });

  it('never gates other specialists — marketa consultations never call invokeCapability', async () => {
    mockAskSpecialist.mockResolvedValue({ ...MONEYPENNY_RESPONSE, specialistId: 'marketa', specialistLabel: 'Marketa' });

    const res = await POST(makeRequest({ specialistId: 'marketa', prompt: 'Find me some partners' }));

    expect(res.status).toBe(200);
    expect(mockInvokeCapability).not.toHaveBeenCalled();
  });
});

describe('POST /api/assistant/ask-agent — MoneyPenny helper decision', () => {
  it('attributes Nakamoto\'s contribution when the prompt is in her declared capability lane', async () => {
    mockAskSpecialist.mockImplementation(async ({ specialistId }: { specialistId: string }) =>
      specialistId === 'moneypenny' ? MONEYPENNY_RESPONSE : NAKAMOTO_RESPONSE,
    );
    mockInvokeCapability.mockResolvedValue({ decision: 'allow', envelope: {} });

    const res = await POST(makeRequest({ specialistId: 'moneypenny', prompt: 'Which Lightning Network settlement approach should we use?' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.specialistId).toBe('moneypenny'); // MoneyPenny keeps the response identity
    expect(body.summary).toContain('Aigent Nakamoto');
    expect(body.recommendations.some((r: string) => r.startsWith('[Aigent Nakamoto]'))).toBe(true);

    // Orchestrated pattern: requestingAgentId === orchestratorAgentId === moneypenny
    const [envelope] = mockInvokeCapability.mock.calls[0];
    expect(envelope).toMatchObject({ requestingAgentId: 'aigent-moneypenny', orchestratorAgentId: 'aigent-moneypenny' });
  });

  it('never brings in Nakamoto for an unrelated MoneyPenny question, and never calls invokeCapability', async () => {
    mockAskSpecialist.mockResolvedValue(MONEYPENNY_RESPONSE);

    const res = await POST(makeRequest({ specialistId: 'moneypenny', prompt: 'What is my current Q¢ balance?' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).not.toContain('Aigent Nakamoto');
    expect(mockInvokeCapability).not.toHaveBeenCalled();
  });

  it("MoneyPenny's own answer is unaffected when the gateway refuses the helper call — enrichment only", async () => {
    mockAskSpecialist.mockResolvedValue(MONEYPENNY_RESPONSE);
    mockInvokeCapability.mockResolvedValue({ decision: 'refuse', code: 'CAPABILITY_NOT_PROVIDED', reason: 'no provider' });

    const res = await POST(makeRequest({ specialistId: 'moneypenny', prompt: 'Which layer 2 should we use for Bitcoin settlement?' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toBe(MONEYPENNY_RESPONSE.summary); // unchanged — the refusal never surfaces as an error to the operator
  });
});
