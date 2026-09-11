/**
 * The Consequence Engineering Operating Model (CFS-006a) — export surface.
 *
 * How constitutional intelligence actually executes: the canonical pipeline
 * over the invariant substrate, recursive through Standing back into Knowledge
 * (the flywheel). Consumes the Invariant Service (services/invariants); does
 * not read the invariant tables directly.
 */

export {
  CONSEQUENCE_PIPELINE,
  PRE_APPROVAL_STAGES,
  POST_APPROVAL_STAGES,
  FLYWHEEL_RETURN,
  stageDefinition,
} from './pipeline';

export {
  knowledgeCuration,
  forecastConsequences,
  assessRiskHeuristic,
  assessValueHeuristic,
  type CurationInput,
} from './stages';

export {
  runConsequencePipeline,
  executeApproved,
  type RunPipelineInput,
  type ExecuteApprovedInput,
} from './operatingModel';
