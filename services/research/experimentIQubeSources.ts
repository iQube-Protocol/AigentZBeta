import path from 'path';
import { EXPERIMENT_REGISTRY } from '@/types/research';

const IRL_PREFIX = 'codexes/packs/irl/';

export const FOUNDATIONAL_EXPERIMENT_IQUBE_IDS = ['EXP-P1', 'EXP-P2', 'EXP-P2A', 'EXP-P2B'] as const;

/** Operative member files. STAGE-0_HANDOFF is intentionally excluded by its standing hold. */
export const FOUNDATIONAL_EXPERIMENT_DOCUMENTS: ReadonlyArray<{ experimentId: string; path: string }> = [
  ...[
    'README.md', 'AUSTIN_COVER_NOTE.md', 'AUSTIN_EXP_P1_COVER_NOTE.md', 'AUSTIN_ONE_PAGER.md',
    'AUSTIN_REVIEWER_KIT.md', 'CRYSTAL-CANON_source-material-charter.md',
    'CRYSTAL-ENLARGEMENT_plan.md', 'OPERATOR_SIGNING_RUNBOOK.md',
  ].map((name) => ({ experimentId: 'EXP-P1', path: `foundation/experiments/exp-p1-representation-runtime-gauntlet/${name}` })),
  ...[
    'README.md', '01_shared-constitutional-framework.md', '02_protocol-v0.5.md',
    '03_operational-amendment-v0.5.md', '04_statistical-analysis-plan-skeleton.md',
    '05_v0.2-recovered-historical-draft.md', '06_stopping-rule-reconciliation.md',
  ].map((name) => ({ experimentId: 'EXP-P2', path: `foundation/experiments/exp-p2-consequential-performance/${name}` })),
  { experimentId: 'EXP-P2A', path: 'foundation/experiments/exp-p2a-software-consequences/README.md' },
  { experimentId: 'EXP-P2B', path: 'foundation/experiments/exp-p2b-physical-consequences/README.md' },
  { experimentId: 'EXP-P2B', path: 'foundation/experiments/exp-p2b-physical-consequences/01_prior-protocol-v1.0-candidate.md' },
];

export function researchExperiment(experimentId: string) {
  return EXPERIMENT_REGISTRY.find((entry) => entry.id === experimentId) ?? null;
}

export function experimentIdForResearchDocumentSource(sourceId: string): string | null {
  const separator = sourceId.indexOf('|');
  if (separator < 1) return null;
  const experimentId = sourceId.slice(0, separator);
  return researchExperiment(experimentId) ? experimentId : null;
}

export function pathForResearchDocumentSource(sourceId: string): string | null {
  const separator = sourceId.indexOf('|');
  if (separator < 1) return null;
  const raw = sourceId.slice(separator + 1).replace(/^\.\//, '');
  const normalized = path.posix.normalize(raw);
  if (
    normalized.startsWith('../')
    || normalized.startsWith('/')
    || (!normalized.endsWith('.md') && !normalized.endsWith('.json'))
  ) return null;
  const experimentId = experimentIdForResearchDocumentSource(sourceId);
  if (!experimentId) return null;
  const experiment = researchExperiment(experimentId);
  if (!experiment?.protocolRef.startsWith(IRL_PREFIX)) return null;
  const expectedDirectory = `${path.posix.dirname(experiment.protocolRef.slice(IRL_PREFIX.length))}/`;
  return normalized.startsWith(expectedDirectory) ? normalized : null;
}

export function experimentIdFromResearchObject(objectId: string, payload?: unknown): string | null {
  const payloadExperiment = payload && typeof payload === 'object'
    ? (payload as Record<string, unknown>).experimentId
    : null;
  const candidate = typeof payloadExperiment === 'string'
    ? payloadExperiment
    : objectId.split('/')[0];
  return researchExperiment(candidate) ? candidate : null;
}
