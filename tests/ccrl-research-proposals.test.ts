/**
 * CCRL research proposal engine — Phase C2.1 canary (CFS-019).
 *
 * Pins the constitutional guarantees of services/research/proposals.ts:
 *  1. proposal-kind → lifecycle effect mapping (create-at-entry / legal-advance)
 *  2. extractResearchProposals resilient parsing (a nearly-valid fence still
 *     parses — the exact stageOrchestrator repair, not a weaker fork)
 *  3. applyResearchProposal REJECTS an illegal lifecycle transition
 *     (isLegalExperimentTransition), never silently commits it
 *  4. every proposal is SUGGEST-ONLY: apply is pure — returns a new state,
 *     never mutates the input, never side-effects
 *
 * Runs under vitest in CI; verified in the sandbox via an esbuild-bundle +
 * node drill (vitest is unavailable there).
 */

import { describe, it, expect } from 'vitest';
import {
  RESEARCH_PROPOSAL_EFFECT,
  buildResearchInstructionBlock,
  extractResearchProposals,
  applyResearchProposal,
  createEmptyResearchState,
  type ResearchProposal,
} from '@/services/research/proposals';
import { isLegalExperimentTransition } from '@/types/research';

describe('C2.1 — proposal-kind → lifecycle effect mapping (canary-pinned)', () => {
  it('experiment_proposal CREATES an experiment at lifecycle designed', () => {
    const e = RESEARCH_PROPOSAL_EFFECT.experiment_proposal;
    expect(e.object).toBe('experiment');
    expect(e.action).toBe('create');
    expect(e.entryState).toBe('designed');
  });

  it('protocol_draft ADVANCES designed → protocol-ratified (a legal transition)', () => {
    const e = RESEARCH_PROPOSAL_EFFECT.protocol_draft;
    expect(e.action).toBe('advance');
    expect(e.fromState).toBe('designed');
    expect(e.toState).toBe('protocol-ratified');
    // The advance the mapping declares MUST be legal per the lifecycle SoT.
    expect(isLegalExperimentTransition('designed', 'protocol-ratified')).toBe(true);
  });

  it('finding CREATES a finding at lifecycle observed', () => {
    expect(RESEARCH_PROPOSAL_EFFECT.finding.object).toBe('finding');
    expect(RESEARCH_PROPOSAL_EFFECT.finding.entryState).toBe('observed');
  });

  it('publication_draft CREATES a publication at lifecycle draft', () => {
    expect(RESEARCH_PROPOSAL_EFFECT.publication_draft.object).toBe('publication');
    expect(RESEARCH_PROPOSAL_EFFECT.publication_draft.entryState).toBe('draft');
  });

  it('the instruction block offers all four ```research_data schemas', () => {
    const block = buildResearchInstructionBlock();
    expect(block).toContain('```research_data');
    expect(block).toContain('experiment_proposal');
    expect(block).toContain('protocol_draft');
    expect(block).toContain('finding');
    expect(block).toContain('publication_draft');
    // never-promise + strict-JSON fence contract lessons carried over
    expect(block).toContain('STRICT JSON');
    expect(block).toContain('NEVER say you are preparing');
  });
});

describe('C2.1 — extractResearchProposals resilient parsing', () => {
  it('a nearly-valid fence (literal newline in a string + trailing commas) still parses', () => {
    const reply = [
      'Here is the experiment design I propose.',
      '',
      '```research_data',
      '{',
      '  "kind": "experiment_proposal",',
      '  "summary": "Semantic fidelity under paraphrase",',
      '  "data": {',
      '    "id": "EXP-900",',
      '    "layer": "I",',
      '    "family": "Semantic Fidelity",',
      '    "seriesId": "FVS",',
      '    "hypothesis": "A hypothesis that spans',
      'two physical lines in the fence body",',
      '    "protocolRef": "codexes/packs/ccrl/foundation/experiments/exp-900/README.md",',
      '    "governingInvariants": ["inv.constitutional.060", "inv.reasoning.001",],',
      '  }',
      '}',
      '```',
    ].join('\n');

    const { cleanText, proposals } = extractResearchProposals(reply);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].kind).toBe('experiment_proposal');
    expect(String(proposals[0].data.hypothesis)).toContain('spans');
    expect(proposals[0].data.governingInvariants).toEqual(['inv.constitutional.060', 'inv.reasoning.001']);
    // the fence is stripped from the operator-visible reply
    expect(cleanText).not.toContain('```research_data');
    expect(cleanText).toContain('Here is the experiment design');
  });

  it('a fence with an unknown kind is dropped (never fabricated into an object)', () => {
    const reply = '```research_data\n{ "kind": "not_a_kind", "summary": "x", "data": {} }\n```';
    const { proposals } = extractResearchProposals(reply);
    expect(proposals).toHaveLength(0);
  });
});

describe('C2.1 — applyResearchProposal rejects illegal lifecycle transitions', () => {
  const experimentProposal: ResearchProposal = {
    kind: 'experiment_proposal',
    summary: 'X',
    data: { id: 'EXP-900', layer: 'I', family: 'Semantic Fidelity', seriesId: 'FVS', hypothesis: 'h', protocolRef: 'p', governingInvariants: ['inv.a'] },
  };
  const protocolDraft: ResearchProposal = {
    kind: 'protocol_draft',
    summary: 'ratify EXP-900',
    data: { experimentId: 'EXP-900', protocolRef: 'p2', evidence: 'design reviewed' },
  };

  it('legal path: design → ratify commits, advancing designed → protocol-ratified', () => {
    let s = createEmptyResearchState();
    const r1 = applyResearchProposal(s, experimentProposal);
    expect(r1.committed).toBe(true);
    s = r1.state;
    expect(s.experiments[0].lifecycle).toBe('designed');

    const r2 = applyResearchProposal(s, protocolDraft);
    expect(r2.committed).toBe(true);
    s = r2.state;
    expect(s.experiments[0].lifecycle).toBe('protocol-ratified');
  });

  it('illegal path: re-ratifying an already-ratified experiment is REJECTED, state unchanged', () => {
    let s = createEmptyResearchState();
    s = applyResearchProposal(s, experimentProposal).state;
    s = applyResearchProposal(s, protocolDraft).state; // now protocol-ratified

    const rBad = applyResearchProposal(s, protocolDraft); // protocol-ratified → protocol-ratified is illegal
    expect(rBad.committed).toBe(false);
    expect(rBad.rejection).toMatch(/illegal transition/);
    // state is returned UNCHANGED — no silent commit
    expect(rBad.state).toBe(s);
    expect(rBad.state.experiments).toHaveLength(1);
    expect(rBad.state.experiments[0].lifecycle).toBe('protocol-ratified');
  });

  it('protocol_draft for an unknown experiment is REJECTED (never fabricates one)', () => {
    const s = createEmptyResearchState();
    const r = applyResearchProposal(s, { kind: 'protocol_draft', summary: 'y', data: { experimentId: 'EXP-DOES-NOT-EXIST' } });
    expect(r.committed).toBe(false);
    expect(r.rejection).toMatch(/unknown experiment/);
    expect(r.state.experiments).toHaveLength(0);
  });
});

describe('C2.1 — every proposal is suggest-only (apply is pure)', () => {
  it('apply returns a NEW state and never mutates the input', () => {
    const s0 = createEmptyResearchState();
    const finding: ResearchProposal = {
      kind: 'finding',
      summary: 'observed groundedness gain',
      data: { experimentId: 'EXP-003', claim: 'initialized reasoning reduces rediscovery cost', evidenceRefs: ['a1b2c3d4'], governingInvariants: ['inv.constitutional.062'] },
    };
    const r = applyResearchProposal(s0, finding);
    expect(r.committed).toBe(true);
    // input untouched
    expect(s0.findings).toHaveLength(0);
    // new state, not the same reference
    expect(r.state).not.toBe(s0);
    expect(r.state.findings).toHaveLength(1);
    // finding enters at 'observed' — never asserted higher
    expect(r.state.findings[0].lifecycle).toBe('observed');
  });

  it('publication_draft creates a draft-lifecycle publication without side-effects', () => {
    const s0 = createEmptyResearchState();
    const pub: ResearchProposal = {
      kind: 'publication_draft',
      summary: 'FVS working paper',
      data: { title: 'Foundational Validation Series — interim', publicationKind: 'working', sourceArtifacts: ['EXP-001', 'EXP-003'], abstract: 'grounded abstract' },
    };
    const r = applyResearchProposal(s0, pub);
    expect(r.committed).toBe(true);
    expect(s0.publications).toHaveLength(0);
    expect(r.state.publications[0].lifecycle).toBe('draft');
    expect(r.state.publications[0].kind).toBe('working');
  });
});
