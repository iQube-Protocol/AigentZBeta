/**
 * CFS-048 Phase 1a canaries — the domain ladder + self-measuring signals.
 *
 * Pins the deterministic seams added on top of the discovery engine:
 *   1. computeConvergence — distinct-source support + tier (a priority signal,
 *      not validity: Law XII), deduped on sourceRef/title.
 *   2. abstraction-level normalisation — tolerant of case/whitespace, invalid → null.
 *   3. scope-threading discipline — promotion still lands 'proposed' /
 *      'agent_verified' (unchanged) AND now threads scope into contexts
 *      applicabilityConditions (source-level assertion).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeConvergence, type EvidenceRow } from '@/services/invariants/discoveryEngine';

function ev(id: string, title: string, sourceRef: string | null): EvidenceRow {
  return { id, domain: 'financial-services', subDomain: null, title, sourceKind: 'regulation', content: 'x', sourceRef, createdAt: '' };
}

describe('computeConvergence (cross-framework support — priority, not validity)', () => {
  const evidence: EvidenceRow[] = [
    ev('a', 'FATF R10', 'fatf-r10'),
    ev('b', 'FATF R16', 'fatf-r16'),
    ev('c', 'Basel Core', 'basel'),
    ev('d', 'MiCA', 'mica'),
    ev('e', 'GDPR Art.5', 'gdpr'),
  ];

  it('counts distinct source documents and lists their frameworks', () => {
    const cv = computeConvergence(['a', 'c', 'd'], evidence);
    expect(cv.supportCount).toBe(3);
    expect(cv.frameworks).toEqual(['FATF R10', 'Basel Core', 'MiCA']);
    expect(cv.tier).toBe('strong');
  });

  it('tiers: single (1) / strong (2-4) / broad (>=5)', () => {
    expect(computeConvergence(['a'], evidence).tier).toBe('single');
    expect(computeConvergence(['a', 'b'], evidence).tier).toBe('strong');
    expect(computeConvergence(['a', 'b', 'c', 'd', 'e'], evidence).tier).toBe('broad');
  });

  it('dedups one document ingested twice (same sourceRef → counts once)', () => {
    const dup = [...evidence, { ...ev('f', 'FATF R10 (copy)', 'fatf-r10') }];
    const cv = computeConvergence(['a', 'f'], dup);
    expect(cv.supportCount).toBe(1);
  });

  it('ignores evidence ids not present (stale reference)', () => {
    const cv = computeConvergence(['a', 'zzz'], evidence);
    expect(cv.supportCount).toBe(1);
  });
});

describe('scope-ladder discipline (source-level, mirrors the discovery canary)', () => {
  const src = readFileSync(join(__dirname, '..', 'services', 'invariants', 'discoveryEngine.ts'), 'utf8');

  it("promotion still lands 'proposed' with 'agent_verified' — unchanged by the ladder", () => {
    expect(src).toMatch(/status:\s*'proposed'/);
    expect(src).toMatch(/confidenceBasis:\s*'agent_verified'/);
    expect(src).not.toMatch(/status:\s*'canonical'/);
    expect(src).not.toMatch(/\bcanonizeInvariant\b/);
    expect(src).not.toMatch(/\bvalidateInvariant\b/);
  });

  it('threads the scope ladder into contexts applicabilityConditions (inv.reasoning.341)', () => {
    expect(src).toMatch(/applicabilityConditions:\s*\{/);
    expect(src).toMatch(/scopeLevel/);
    expect(src).toMatch(/subDomain/);
    expect(src).toMatch(/abstractionLevel/);
  });

  it('rejects L0/L1 abstraction candidates (verbatim/summary never emitted)', () => {
    expect(src).toMatch(/lvl !== 'L0' && lvl !== 'L1'/);
  });
});

describe('Compare discipline (Phase 2 — earned domain invariants)', () => {
  const src = readFileSync(join(__dirname, '..', 'services', 'invariants', 'discoveryEngine.ts'), 'utf8');

  it('needs at least 2 sub-domains and never invents unsupported invariants', () => {
    expect(src).toMatch(/comparedSubDomains\.length < 2/);
    expect(src).toMatch(/Do NOT invent invariants unsupported/);
  });

  it('includes PROMOTED sub-domain invariants as compare inputs (promote-first workflow must not break Compare)', () => {
    // Both the sub-domain gather and the baseline gather must admit candidate+promoted,
    // else promoting sub-domain findings (the intended next step) empties the compare set.
    expect(src).toMatch(/\.in\('status', \['candidate', 'promoted'\]\)[\s\S]*?\.not\('sub_domain', 'is', null\)/);
    expect(src).toMatch(/\.is\('sub_domain', null\)[\s\S]*?\.in\('status', \['candidate', 'promoted'\]\)/);
  });
});

describe('Recursive compression discipline (parent-child keystone)', () => {
  const src = readFileSync(join(__dirname, '..', 'services', 'invariants', 'discoveryEngine.ts'), 'utf8');

  it('needs at least 2 domain invariants and grounds strictly (no invented relationships)', () => {
    expect(src).toMatch(/export async function compressDomainInvariants/);
    expect(src).toMatch(/needs at least 2 domain invariants/);
    expect(src).toMatch(/Do NOT invent invariants or relationships/i);
  });

  it('is acyclic + drops self-references, and only accepts in-range parent indices', () => {
    expect(src).toMatch(/MUST be acyclic/);
    // parent-index filter: integer, not self, within [0, items.length)
    expect(src).toMatch(/p !== idx/);
    expect(src).toMatch(/p < items\.length/);
  });

  it('role/derived: a node is derived only when it has ≥1 valid parent, else root', () => {
    expect(src).toMatch(/String\(n\.role\) === 'derived' && parents\.length > 0 \? 'derived' : 'root'/);
  });

  it('is DE-BIASED — the prompt names no worked FS example that steers which invariant is a root', () => {
    const prompt = src.slice(src.indexOf('COMPRESS_DOMAIN_SYSTEM'), src.indexOf('interface CompressExtraction'));
    // must not confirm a preferred ontology
    expect(prompt).toMatch(/DISCOVER the\s+structure the statements actually support|NOT to confirm any preferred/i);
    // no biasing worked examples naming specific FS invariants as roots/derived
    expect(prompt).not.toMatch(/Risk-management practices are required|harmonized regulatory framework/i);
    // a flat all-roots result is explicitly acceptable
    expect(prompt).toMatch(/flat.*all-roots.*acceptable/i);
  });

  it('edges are TYPED (entails/specializes/depends_on/supports); uncertain → weakest (supports)', () => {
    expect(src).toMatch(/COMPRESSION_RELATIONSHIPS = \['entails', 'specializes', 'depends_on', 'supports'\]/);
    // unknown/uncertain relationship coerces to the weakest link, never over-claims entailment
    expect(src).toMatch(/normalizeRelationship[\s\S]*?: 'supports'/);
    // each proposed edge carries a claim + confidence
    expect(src).toMatch(/claim:.*slice\(0, 400\)/);
    expect(src).toMatch(/confidence: Math\.max\(0, Math\.min\(1/);
  });

  it('proposals are NOT auto-materialised — persisted with materialized:false', () => {
    const fn = src.slice(src.indexOf('export async function compressDomainInvariants'));
    const body = fn.slice(0, fn.indexOf('\nexport '));
    expect(body).toMatch(/materialized: false/);
    // structure discovery only — no promotion/canonize/confidence writes
    expect(body).not.toMatch(/status: 'promoted'|canonize|addEdge/);
  });

  it('promotion does NOT auto-insert recursive edges (operator-confirmed only)', () => {
    const promote = src.slice(src.indexOf('export async function promoteCandidate'));
    const body = promote.slice(0, promote.indexOf('\nexport '));
    // the auto-merge of compression parents must be gone from promotion
    expect(body).not.toMatch(/compressionParents|resolveCompressionParentInvariantIds/);
  });

  it('materializeCompressionEdges is operator-confirmed + typed + skips un-promoted parents', () => {
    expect(src).toMatch(/export async function materializeCompressionEdges/);
    // requires the child to be promoted
    expect(src).toMatch(/candidate is not promoted — promote it/);
    // resolves parents, skipping un-promoted
    expect(src).toMatch(/\.not\('promoted_invariant_id', 'is', null\)/);
    // materialises with the PROPOSED relationship's edge type (not hardcoded specializes)
    expect(src).toMatch(/RELATIONSHIP_EDGE_TYPE\[normalizeRelationship\(p\.relationship\)\]/);
  });

  it('confidence is recurrence-based (coverage breadth), not model self-report', () => {
    expect(src).toMatch(/0\.55 \+ 0\.1 \* cov/);
  });

  it('classifies against the baseline (supported/specialized/split/novel/equivalent) and treats baseline as hypotheses', () => {
    for (const k of ['supported', 'specialized', 'split', 'novel', 'equivalent']) expect(src).toContain(`'${k}'`);
    expect(src).toMatch(/NOT ground truth|hypotheses to test/i);
  });
});

describe('parent-linking discipline (keystone — graph, not tree)', () => {
  const src = readFileSync(join(__dirname, '..', 'services', 'invariants', 'discoveryEngine.ts'), 'utf8');

  it('links via specializes edges (child specializes domain parent), idempotently', () => {
    expect(src).toMatch(/edgeType:\s*'specializes'/);
    expect(src).toMatch(/fromInvariantId:\s*childInvariantId/);
    // Dedup: skip parents already linked (out-edges of the child).
    expect(src).toMatch(/listEdgesForInvariants\(\[childInvariantId\], 'out', \['specializes'\]\)/);
  });

  it('allows multiple parents and never fails on an edge error', () => {
    expect(src).toMatch(/new Set\(parentIds\)/);
    expect(src).toMatch(/\[CFS-048\] specializes-edge failed/);
  });

  it('retro-links already-promoted invariants (Investment/Market Ops) without re-promoting', () => {
    expect(src).toMatch(/export async function linkPromotedParents/);
    expect(src).toMatch(/status !== 'promoted'/);
  });

  it('suggests parents from promoted DOMAIN-level invariants, ranked by similarity', () => {
    expect(src).toMatch(/is\('sub_domain', null\)[\s\S]*?eq\('status', 'promoted'\)/);
    expect(src).toMatch(/\.sort\(\(a, b\) => b\.similarity - a\.similarity\)/);
  });
});
