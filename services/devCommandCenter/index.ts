/**
 * Development Command Center — barrel exports
 * Operation Chrysalis Phase 1
 */

export {
  createEmptyIntent,
  refineIntent,
  isIntentComplete,
  buildIntentSummary,
} from './intentDistillation';

export {
  createEmptyContextPack,
  addContextItem,
  estimateTokens,
  buildContextPackSummary,
  getSourcePaths,
} from './contextPackGenerator';

export {
  createEmptyGapAnalysis,
  addExistingCapability,
  addMissingCapability,
  buildGapAnalysisSummary,
} from './capabilityGapAnalyzer';

export {
  createEmptyCanvas,
  createConsequenceEntry,
  addShouldHappen,
  addShouldNeverHappen,
  buildConsequenceCanvasSummary,
} from './consequenceCanvas';

export {
  createEmptyValidationReport,
  addValidationItem,
  buildValidationSummary,
} from './consequenceValidator';

export {
  createDevLoopSession,
  canAdvance,
  advanceStage,
  getStageIndex,
  getStageLabel,
  buildImplementationPackage,
} from './devLoop';

export {
  buildStageInstructionBlock,
  extractStageProposals,
  applyStageProposal,
  detectRequestedStage,
  STAGE_PROPOSAL_KIND,
  PROPOSAL_KIND_TO_CAPSULE,
  type StageProposal,
  type StageProposalKind,
} from './stageOrchestrator';
