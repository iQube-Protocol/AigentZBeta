import { describe, expect, it } from 'vitest';
import {
  LEHIGH_CORE_RISK_DIMENSIONS,
  adjustRiskForVerification,
  calculateVerificationFactor,
  convergeDiscoveryBearings,
  discoveryBearing,
  modulateRiskByIntent,
  researchRiskAdjustedValue,
  selectMaterialRiskVectors,
  type IntentRiskVector,
} from '@/services/invariants/riskField';

describe('IDE v2 risk field', () => {
  it('preserves the original Lehigh 23-dimension core taxonomy', () => {
    expect(LEHIGH_CORE_RISK_DIMENSIONS).toHaveLength(23);
    expect(new Set(LEHIGH_CORE_RISK_DIMENSIONS).size).toBe(23);
  });

  it('computes normalized verification strength × recency × authority', () => {
    const result = calculateVerificationFactor([
      { strength: 1, recency: 1, authority: 1 },
      { strength: 0.5, recency: 0.8, authority: 0.5 },
    ]);
    expect(result.evidenceCount).toBe(2);
    expect(result.factor).toBeCloseTo(0.6, 8);
  });

  it('applies verification without allowing negative residual risk', () => {
    expect(adjustRiskForVerification(100, 1, 0.5)).toBe(50);
    expect(adjustRiskForVerification(10, 1, 2)).toBe(0);
  });

  it('keeps intent factors caller-calibrated', () => {
    expect(modulateRiskByIntent(100, 0.8)).toBe(80);
    expect(modulateRiskByIntent(100, 1.4)).toBe(140);
    expect(() => modulateRiskByIntent(100, -1)).toThrow();
  });

  it('separates material from unresolved vectors using relevance and confidence', () => {
    const vectors: IntentRiskVector[] = [
      {
        id: 'security',
        dimension: { id: 'security', family: 'core' },
        relevance: 0.9,
        confidence: 0.9,
        evidenceRefs: [],
      },
      {
        id: 'operational',
        dimension: { id: 'operational', family: 'core' },
        relevance: 0.8,
        confidence: 0.2,
        evidenceRefs: [],
      },
      {
        id: 'diplomatic',
        dimension: { id: 'diplomatic', family: 'core' },
        relevance: 0.1,
        confidence: 0.9,
        evidenceRefs: [],
      },
    ];

    expect(selectMaterialRiskVectors(vectors, {
      relevanceThreshold: 0.5,
      confidenceThreshold: 0.5,
    })).toEqual({
      materialVectorIds: ['security'],
      unresolvedVectorIds: ['operational'],
    });
  });

  it('treats dual-bearing as provenance convergence, not a validity state', () => {
    expect(discoveryBearing(true, true)).toBe('dual-bearing');
    expect(discoveryBearing(true, false)).toBe('ttv-only');
    expect(discoveryBearing(false, true)).toBe('ror-only');
    expect(discoveryBearing(false, false)).toBeNull();

    const merged = convergeDiscoveryBearings([
      { candidateId: 'a', pass: 'forward_ttv' },
      { candidateId: 'a', pass: 'reverse_ror' },
      { candidateId: 'b', pass: 'reverse_ror' },
    ]);
    expect(merged.get('a')).toBe('dual-bearing');
    expect(merged.get('b')).toBe('ror-only');
  });

  it('retains the Lehigh v2 risk-adjusted-value projection as a research function', () => {
    expect(researchRiskAdjustedValue({
      overallValueScore: 100,
      overallRiskScore: 40,
      riskAversion: 1,
    })).toBe(60);
  });
});
