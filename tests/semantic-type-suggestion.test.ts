/**
 * services/invariants/semanticTypeSuggestion.ts — Stage 9's
 * structural-diversity remediation classifier (operator direction,
 * 2026-08-05). Never writes anything; defensive validation throughout so a
 * parse/provider failure returns `suggestion: null`, never a guessed type.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallSovereign = vi.fn();
vi.mock('@/services/constitutional/modelRouter', () => ({
  callSovereign: (...args: any[]) => mockCallSovereign(...args),
}));

import { suggestSemanticType } from '@/services/invariants/semanticTypeSuggestion';

const CANDIDATE = { id: 'cand-1', statement: 'Every settlement instruction must be receipted within 24 hours.' };

beforeEach(() => {
  mockCallSovereign.mockReset();
});

describe('suggestSemanticType — happy path', () => {
  it('returns a validated suggestion', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({ semanticType: 'law', confidence: 82, reason: 'States an exceptionless timing requirement.' }),
    });
    const result = await suggestSemanticType(CANDIDATE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.suggestion).toEqual({
      semanticType: 'law',
      confidence: 82,
      reason: 'States an exceptionless timing requirement.',
    });
  });

  it('clamps confidence to [0,100]', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({ semanticType: 'definition', confidence: 500, reason: 'x' }),
    });
    const result = await suggestSemanticType(CANDIDATE);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.suggestion) return;
    expect(result.suggestion.confidence).toBe(100);
  });
});

describe('suggestSemanticType — defensive validation', () => {
  it('never trusts a semantic type outside the six canonical values', async () => {
    mockCallSovereign.mockResolvedValue({
      text: JSON.stringify({ semanticType: 'rule-of-thumb', confidence: 90, reason: 'x' }),
    });
    const result = await suggestSemanticType(CANDIDATE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.suggestion).toBeNull();
  });

  it('returns suggestion:null, never a fabricated reason, when the model omits one', async () => {
    mockCallSovereign.mockResolvedValue({ text: JSON.stringify({ semanticType: 'law', confidence: 80, reason: '' }) });
    const result = await suggestSemanticType(CANDIDATE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.suggestion).toBeNull();
  });

  it('returns ok:false when the provider call throws', async () => {
    mockCallSovereign.mockRejectedValue(new Error('all providers failed'));
    const result = await suggestSemanticType(CANDIDATE);
    expect(result.ok).toBe(false);
  });

  it('returns ok:false when the model does not return parseable JSON', async () => {
    mockCallSovereign.mockResolvedValue({ text: 'Looks like a law to me!' });
    const result = await suggestSemanticType(CANDIDATE);
    expect(result.ok).toBe(false);
  });
});
