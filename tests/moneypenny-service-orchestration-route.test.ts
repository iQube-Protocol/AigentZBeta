/**
 * /api/moneypenny/service-orchestration — POST lifecycle boundary canaries
 * (2026-08-23 repair pass: orchestration/input/error-boundary defects the
 * operator found once eligibility itself was already correct — Nakamoto/
 * Kn0w1 Advisor/Architect read ELIGIBLE, but the POST path still had two
 * deterministic defects and a missing error boundary. Fixed WITHOUT
 * touching admission, assignment, verification, or Gate 1/2/3 — those are
 * frozen for this pass).
 *
 * Proves, at the route level:
 *   1. A service whose execution path is not reachable (Advisor/Architect,
 *      `projectionRequirement: 'NOT_REQUIRED'`) never triggers public
 *      consequence forecasting at all — no hardcoded seed-id string fed to
 *      a UUID-keyed graph API.
 *   2. A service whose execution path IS reachable (Runtime) resolves real
 *      persisted invariant UUIDs through the canonical invariant service
 *      (`knowledgeCuration`, `finance` namespace) rather than a hardcoded
 *      seed id — and when none are live yet, resolves UNRESOLVED with an
 *      explicit reason rather than throwing or fabricating a forecast.
 *   3. An unexpected technical exception is caught by a top-level boundary
 *      and always returns JSON with a bounded `stage`, never an unhandled
 *      500 with no body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (...args: any[]) => mockGetActivePersona(...args),
}));

const mockGetSupabaseServer = vi.fn();
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: (...args: any[]) => mockGetSupabaseServer(...args),
}));

const mockKnowledgeCuration = vi.fn();
const mockForecastConsequences = vi.fn();
vi.mock('@/services/consequence/stages', () => ({
  knowledgeCuration: (...args: any[]) => mockKnowledgeCuration(...args),
  forecastConsequences: (...args: any[]) => mockForecastConsequences(...args),
}));

const mockRequestFinancialService = vi.fn();
vi.mock('@/services/financialServices/serviceRequestOrchestrator', () => ({
  requestFinancialService: (...args: any[]) => mockRequestFinancialService(...args),
}));

const mockDiscoverFinancialServicesForConsumer = vi.fn();
vi.mock('@/services/financialServices/discovery', () => ({
  discoverFinancialServicesForConsumer: (...args: any[]) => mockDiscoverFinancialServicesForConsumer(...args),
}));

import { POST } from '@/app/api/moneypenny/service-orchestration/route';
import { MONEYPENNY_ADVISOR, MONEYPENNY_ARCHITECT, MONEYPENNY_RUNTIME } from '@/services/financialServices/serviceCatalog';
import { readSource, stripComments } from './_lib/sourceAuthority';

const CONSUMER = 'aigent-nakamoto';
const PERSONA_ID = 'persona-operator-1';

function postRequest(body: Record<string, unknown>) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActivePersona.mockResolvedValue({ personaId: PERSONA_ID, authProfileId: 'auth-1' });
  mockGetSupabaseServer.mockReturnValue({} as any);
  mockRequestFinancialService.mockResolvedValue({
    outcome: {
      requestRef: 'ref',
      serviceId: 'x',
      serviceClass: 'INFORMATIONAL',
      providerMode: 'ADVISOR',
      status: 'DELIVERED',
      reason: 'ok',
      authorisationRef: null,
      executionRef: null,
      observedConsequenceRef: null,
      validationState: null,
      projectionDisposition: null,
      providerResultRef: 'abc123',
    },
    causalChain: null,
  });
});

describe('POST /api/moneypenny/service-orchestration — public projection is opt-in, never unconditional', () => {
  it('never calls knowledgeCuration/forecastConsequences for an Advisor request (executionReachable: false)', async () => {
    const res = await POST(postRequest({ agentId: CONSUMER, serviceId: MONEYPENNY_ADVISOR.serviceId, input: { intent: 'help me' } }));
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockKnowledgeCuration).not.toHaveBeenCalled();
    expect(mockForecastConsequences).not.toHaveBeenCalled();
    expect(mockRequestFinancialService).toHaveBeenCalledTimes(1);
    expect(mockRequestFinancialService.mock.calls[0][0].publicForecast).toBeNull();
  });

  it('never calls knowledgeCuration/forecastConsequences for an Architect request (executionReachable: false)', async () => {
    const res = await POST(postRequest({ agentId: CONSUMER, serviceId: MONEYPENNY_ARCHITECT.serviceId, input: { intent: 'design a structure' } }));
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockKnowledgeCuration).not.toHaveBeenCalled();
    expect(mockForecastConsequences).not.toHaveBeenCalled();
  });

  it('resolves real persisted invariant UUIDs through knowledgeCuration (finance namespace) for Runtime, never a hardcoded seed-id string', async () => {
    mockKnowledgeCuration.mockResolvedValue({ invariantIds: ['11111111-1111-1111-1111-111111111111'], closureIds: [], namespaces: ['finance'], coherent: true, intentRef: 'x', contextDomain: null });
    mockForecastConsequences.mockResolvedValue({ seedInvariantIds: ['11111111-1111-1111-1111-111111111111'], nodes: [], enables: 0, constrains: 0, contradicts: 0, forcesEscalation: false, constitutionalConstraint: false, constitutionalConstraintIds: [], rationale: 'ok' });

    const res = await POST(postRequest({ agentId: CONSUMER, serviceId: MONEYPENNY_RUNTIME.serviceId }));
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(mockKnowledgeCuration).toHaveBeenCalledWith(expect.objectContaining({ namespace: 'finance' }));
    expect(mockForecastConsequences).toHaveBeenCalledWith(['11111111-1111-1111-1111-111111111111']);
    expect(mockRequestFinancialService.mock.calls[0][0].publicForecast).toEqual(
      expect.objectContaining({ seedInvariantIds: ['11111111-1111-1111-1111-111111111111'] }),
    );
  });

  it('resolves UNRESOLVED with an explicit reason — never throws, never invents inv.finance.001 — when no finance-namespace invariants are live yet', async () => {
    mockKnowledgeCuration.mockResolvedValue({ invariantIds: [], closureIds: [], namespaces: [], coherent: true, intentRef: 'x', contextDomain: null });

    const res = await POST(postRequest({ agentId: CONSUMER, serviceId: MONEYPENNY_RUNTIME.serviceId }));
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.outcome.status).toBe('UNRESOLVED');
    expect(data.outcome.reason).toContain('finance');
    expect(mockForecastConsequences).not.toHaveBeenCalled();
    expect(mockRequestFinancialService).not.toHaveBeenCalled();
  });
});

describe('POST /api/moneypenny/service-orchestration — top-level error boundary', () => {
  it('catches an unexpected exception and always returns structured JSON with a bounded stage, never an unhandled throw', async () => {
    mockRequestFinancialService.mockRejectedValue(new Error('unexpected db timeout'));

    const res = await POST(postRequest({ agentId: CONSUMER, serviceId: MONEYPENNY_ADVISOR.serviceId, input: { intent: 'x' } }));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('unexpected db timeout');
    expect(typeof data.stage).toBe('string');
    expect(data.stage.length).toBeGreaterThan(0);
  });

  it('returns a specific, visible reason for missing input — never the generic "Request failed"', async () => {
    const res = await POST(postRequest({ serviceId: MONEYPENNY_ADVISOR.serviceId }));
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('agentId and serviceId are required');
  });
});

describe('ServiceOrchestrationPanel — Trigger gating (source-level; no RTL/jsdom in this repo)', () => {
  const PANEL_PATH = 'app/(shell)/moneypenny/components/ServiceOrchestrationPanel.tsx';

  it('requires eligibility?.eligible === true to enable Trigger — an UNDETERMINED (undefined) eligibility must not slip through as clickable', () => {
    const src = stripComments(readSource(PANEL_PATH));
    expect(src).toContain('eligibility?.eligible !== true');
    // The old, defective condition only excluded a confirmed `false` —
    // `undefined` (STANDING_PERSONA_UNRESOLVED, ADMISSION_UNRESOLVED, etc.)
    // was still clickable. Must not regress back to it.
    expect(src).not.toContain('eligibility?.eligible === false');
  });

  it('never synthesizes an intent for Advisor/Architect — the composer requires real operator-entered, non-empty text before Trigger is enabled', () => {
    const src = stripComments(readSource(PANEL_PATH));
    expect(src).toContain('!intentValue.trim()');
  });

  it('never keys intent/outcome state on serviceId alone (2026-08-23 P0 cross-agent isolation) — every read goes through the composite-keyed selectors', () => {
    const src = stripComments(readSource(PANEL_PATH));
    // The pre-repair vulnerable pattern that bled Nakamoto/Kn0w1 state together.
    expect(src).not.toContain('intents[definition.serviceId]');
    expect(src).not.toContain('outcomes[definition.serviceId]');
    expect(src).not.toContain('requesting === definition.serviceId');
    // The composite-keyed reducer/selectors from serviceOrchestrationPanelState.ts.
    expect(src).toContain('selectIntent(state, selectedAgentId, definition.serviceId)');
    expect(src).toContain('selectOutcome(state, selectedAgentId, definition.serviceId)');
    expect(src).toContain('selectIsRequesting(state, selectedAgentId, definition.serviceId)');
  });
});
