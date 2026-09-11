/**
 * 2026-08-23 repair pass, Part A/C — inference-provider-unavailable
 * classification.
 *
 * Live evidence: Anthropic -> insufficient credits, OpenAI -> insufficient
 * quota, Venice -> timeout, ModelRouter -> "all providers failed". That is an
 * INFRASTRUCTURE condition, never an Architect/Advisor regression and never a
 * governance refusal. These canaries prove:
 *   - the classifier matches ONLY the exact `callStage()` throw shape, never
 *     a broader guess;
 *   - the diagnostic string stays bounded and never a raw stack trace;
 *   - the ladder-availability audit never returns a credential value, only
 *     per-provider booleans;
 *   - `/api/moneypenny/architect` maps the classified failure to HTTP 503
 *     (infrastructure), never 400 (client error).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isProviderUnavailableError,
  describeInferenceUnavailability,
  describeProviderLadderAvailability,
  INFERENCE_PROVIDER_UNAVAILABLE,
} from '@/services/constitutional/modelRouter';

describe('isProviderUnavailableError — exact-marker classification, never a broad heuristic', () => {
  it('matches the exact callStage() "all providers failed" throw', () => {
    const err = new Error(
      '[ModelRouter] stage=reasoning: all providers failed — anthropic: 429 insufficient credits | openai: 429 insufficient quota | venice: timed out',
    );
    expect(isProviderUnavailableError(err)).toBe(true);
  });

  it('does NOT match a single-provider failure that still left the ladder reachable (callStage would have degraded, not thrown)', () => {
    const err = new Error('anthropic 429: insufficient credits');
    expect(isProviderUnavailableError(err)).toBe(false);
  });

  it('does NOT match an unrelated error (a content-quality or governance refusal must never be misclassified as infrastructure)', () => {
    expect(isProviderUnavailableError(new Error('inference returned no content'))).toBe(false);
    expect(isProviderUnavailableError(new Error('grounding failed'))).toBe(false);
  });

  it('does NOT match a non-Error value', () => {
    expect(isProviderUnavailableError('all providers failed')).toBe(false);
    expect(isProviderUnavailableError(null)).toBe(false);
    expect(isProviderUnavailableError(undefined)).toBe(false);
  });
});

describe('describeInferenceUnavailability — bounded, receipt-safe diagnostic', () => {
  it('returns the error message verbatim when short', () => {
    const err = new Error('all providers failed — anthropic: 429 | openai: 429');
    expect(describeInferenceUnavailability(err)).toBe(err.message);
  });

  it('truncates a very long message defensively, never a raw unbounded stack trace', () => {
    const err = new Error(`all providers failed — ${'x'.repeat(1000)}`);
    const described = describeInferenceUnavailability(err);
    expect(described.length).toBeLessThanOrEqual(401); // 400 chars + ellipsis
    expect(described.endsWith('…')).toBe(true);
  });

  it('handles a non-Error thrown value without crashing', () => {
    expect(describeInferenceUnavailability('plain string failure')).toBe('plain string failure');
  });
});

describe('describeProviderLadderAvailability — booleans only, never a credential value', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.VENICE_API_KEY;
  });

  it('returns one entry per fallback-ladder provider, each a boolean `configured` flag', () => {
    const availability = describeProviderLadderAvailability();
    expect(availability.map((a) => a.provider)).toEqual(['anthropic', 'openai', 'venice']);
    for (const entry of availability) {
      expect(typeof entry.configured).toBe('boolean');
    }
  });

  it('never leaks a credential value — the serialized audit contains only provider ids and booleans', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-super-secret-value-do-not-leak';
    const availability = describeProviderLadderAvailability();
    const serialized = JSON.stringify(availability);
    expect(serialized).not.toContain('sk-ant-super-secret-value-do-not-leak');
    expect(serialized).not.toContain(process.env.ANTHROPIC_API_KEY);
  });

  it('reflects configuration state — a provider with no key present is reported unconfigured', () => {
    const availability = describeProviderLadderAvailability();
    const anthropic = availability.find((a) => a.provider === 'anthropic');
    expect(anthropic?.configured).toBe(false);
  });
});

describe('/api/moneypenny/architect — maps INFERENCE_PROVIDER_UNAVAILABLE to 503, never 400', () => {
  const mockGetActivePersona = vi.fn();
  const mockDraftFinancialStructure = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    mockGetActivePersona.mockReset();
    mockDraftFinancialStructure.mockReset();
    vi.doMock('@/services/identity/getActivePersona', () => ({
      getActivePersona: (...args: unknown[]) => mockGetActivePersona(...args),
    }));
    vi.doMock('@/services/constitutional/moneyPennyArchitect', () => ({
      draftFinancialStructure: (...args: unknown[]) => mockDraftFinancialStructure(...args),
    }));
  });

  async function callArchitectRoute(intent: string) {
    const { POST } = await import('@/app/api/moneypenny/architect/route');
    const request = { json: async () => ({ intent }) } as unknown as Parameters<typeof POST>[0];
    return POST(request);
  }

  it('returns 503 (infrastructure), not 400 (client error), when the Architect result carries errorCode INFERENCE_PROVIDER_UNAVAILABLE', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1' });
    mockDraftFinancialStructure.mockResolvedValue({
      ok: false,
      error: 'inference provider unavailable: all providers failed — anthropic: 429 | openai: 429 | venice: timeout',
      errorCode: INFERENCE_PROVIDER_UNAVAILABLE,
    });
    const response = await callArchitectRoute('design a fee split');
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.errorCode).toBe('INFERENCE_PROVIDER_UNAVAILABLE');
  });

  it('still returns 400 for a non-infrastructure Architect failure (e.g. grounding failed)', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1' });
    mockDraftFinancialStructure.mockResolvedValue({ ok: false, error: 'grounding failed' });
    const response = await callArchitectRoute('design a fee split');
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errorCode).toBeUndefined();
  });

  it('returns 200 on a successful draft, unaffected by the new error-code branch', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1' });
    mockDraftFinancialStructure.mockResolvedValue({
      ok: true,
      artifactId: 'moneypenny-architect-x',
      recordId: 'rec-x',
      title: 'Structure',
      body: 'body',
      citedInvariantIds: [],
    });
    const response = await callArchitectRoute('design a fee split');
    expect(response.status).toBe(200);
  });
});
