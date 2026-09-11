import { describe, expect, it } from 'vitest';
import {
  FOUNDATIONAL_EXPERIMENT_DOCUMENTS,
  FOUNDATIONAL_EXPERIMENT_IQUBE_IDS,
  experimentIdForResearchDocumentSource,
  experimentIdFromResearchObject,
  pathForResearchDocumentSource,
  researchExperiment,
} from '@/services/research/experimentIQubeSources';
import { projectCartridge } from '@/services/registry/projections/cartridge';
import type { CanonicalIQubeInternalRecord } from '@/types/registry-canonical';
import fs from 'fs';
import path from 'path';

describe('EXP-P1/P2 iQube constitution', () => {
  it('constitutes P1 and the complete P2 family as ClusterQube roots', () => {
    expect(FOUNDATIONAL_EXPERIMENT_IQUBE_IDS).toEqual(['EXP-P1', 'EXP-P2', 'EXP-P2A', 'EXP-P2B']);
    expect(researchExperiment('EXP-P1')?.programmeFocus).toBe('Reasoning Compression');
    expect(researchExperiment('EXP-P2')?.programmeFocus).toBe('Consequential Performance');
    expect(researchExperiment('EXP-P2A')?.instantiationOf).toBe('EXP-P2');
    expect(researchExperiment('EXP-P2B')?.instantiationOf).toBe('EXP-P2');
  });

  it('registers operative documents while preserving the Stage-0 hold', () => {
    expect(FOUNDATIONAL_EXPERIMENT_DOCUMENTS).toHaveLength(18);
    expect(FOUNDATIONAL_EXPERIMENT_DOCUMENTS.some((d) => d.path.endsWith('STAGE-0_HANDOFF.md'))).toBe(false);
    expect(FOUNDATIONAL_EXPERIMENT_DOCUMENTS.some((d) => d.path.endsWith('AUSTIN_REVIEWER_KIT.md'))).toBe(true);
    for (const document of FOUNDATIONAL_EXPERIMENT_DOCUMENTS) {
      expect(fs.existsSync(path.join(process.cwd(), 'codexes/packs/irl', document.path))).toBe(true);
    }
  });

  it('accepts only a registered experiment document inside its own directory', () => {
    const valid = 'EXP-P1|foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md';
    expect(experimentIdForResearchDocumentSource(valid)).toBe('EXP-P1');
    expect(pathForResearchDocumentSource(valid)).toBe('foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md');
    expect(pathForResearchDocumentSource('EXP-P1|../secret.md')).toBeNull();
    expect(pathForResearchDocumentSource('EXP-P1|foundation/experiments/exp-p2-consequential-performance/README.md')).toBeNull();
    expect(pathForResearchDocumentSource('UNKNOWN|foundation/experiments/unknown/README.md')).toBeNull();
  });

  it('derives a research object experiment from canonical payload or object namespace only', () => {
    expect(experimentIdFromResearchObject('EXP-P1/crystal-vP1')).toBe('EXP-P1');
    expect(experimentIdFromResearchObject('opaque', { experimentId: 'EXP-P2' })).toBe('EXP-P2');
    expect(experimentIdFromResearchObject('UNKNOWN/object')).toBeNull();
  });

  it('surfaces the ClusterQube manifest without granting member payload access', () => {
    const internal = {
      iqube_id: 'cluster-id', primitive_type: 'ClusterQube', instance_type: 'instance',
      meta_qube_id: '', creator_identity_state: 'pseudonymous', origin: 'native',
      internal_lifecycle: 'published', surface_lifecycle: 'canonized', canonicalization_status: 'finalized',
      wip_supabase_only: false, visibility_state: 'private', gating: ['persona', 'role'],
      mint_status: 'unminted', instance_model: 'singleton', dvn_receipt_index: { receipt_count: 0 },
      cartridge_bindings: ['EXP-P1'], version: '1', created_at: '', updated_at: '',
      cluster: {
        member_iqubes: [{ iqube_id: 'member-id', role: 'primary' }],
        dependency_graph: { nodes: ['cluster-id', 'member-id'], edges: [] },
        policy_aggregation: 'explicit', receipt_aggregation: 'nested',
        version_compatibility_strategy: 'pin', access_propagation: 'independent',
        revocation_propagation: 'cluster_only',
      },
    } satisfies CanonicalIQubeInternalRecord;
    const view = projectCartridge(internal, false, true);
    expect(view.cluster?.member_iqubes).toEqual([{ iqube_id: 'member-id', role: 'primary' }]);
    expect(view.cluster?.access_propagation).toBe('independent');
  });

  it('migration is reference-only and auto-registers future P1/P2 evidence', () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260909232830_exp_p1_p2_clusterqubes.sql'),
      'utf8',
    );
    expect(sql).toContain("'research_experiment'");
    expect(sql).toContain("'research_document'");
    expect(sql).toContain("'research_object'");
    expect(sql).toContain("'experiment_result'");
    expect(sql).toContain('research_objects_register_foundational_iqube');
    expect(sql).toContain('experiment_results_register_foundational_iqube');
    expect(sql).not.toMatch(/insert\s+into\s+public\.research_objects/i);
    expect(sql).not.toMatch(/insert\s+into\s+public\.experiment_results/i);
  });
});
