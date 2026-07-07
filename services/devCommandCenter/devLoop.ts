/**
 * Development Loop State Machine — the Constitutional Development Environment
 *
 * User Intent → Intent Distillation → Context Pack → Gap Analysis →
 * Consequence Canvas → Claude Code → Constitutional Validation →
 * [Remediation fork] → Deployment Authorization → Receipts → Memory Update
 *
 * The linear dev loop becomes constitutional: a failed / partial high-severity
 * consequence check (ICE-6 Constitutional Validation) forks to ICE-7
 * Remediation instead of terminating as "validated"; deployment (ICE-8
 * Deployment Authorization) is gated on the consequence test passing.
 */

import type {
  DevLoopState,
  DevLoopStage,
  StructuredDevIntent,
  ContextPack,
  CapabilityGapAnalysis,
  ConsequenceCanvas,
  ConsequenceValidationReport,
  ImplementationPackage,
  DevLoopReceipt,
  DevReceiptClass,
} from '@/types/devCommandCenter';

export function createDevLoopSession(): DevLoopState {
  return {
    sessionId: `dls-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    stage: 'intent_capture',
    intent: null,
    contextPack: null,
    gapAnalysis: null,
    consequenceCanvas: null,
    validationReport: null,
    receipts: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const STAGE_ORDER: DevLoopStage[] = [
  'intent_capture',
  'context_assembly',
  'gap_analysis',
  'consequence_modeling',
  'implementation',
  'consequence_validation',
  'remediation',
  'deployment_authorization',
  'complete',
];

// ─── Constitutional consequence test (the CDE fork gate) ────────────────────

/**
 * True when the Constitutional Validation report is NOT clean enough to deploy:
 * ANY high/critical consequence came back 'unintended' or 'partial' (a
 * must-not-happen consequence that failed or partially failed), OR the overall
 * verdict is 'fail'/'partial'. When true, the loop forks to Remediation rather
 * than terminating as "validated". Pure — canary-pinned.
 */
export function validationRequiresRemediation(report: ConsequenceValidationReport): boolean {
  if (report.overallVerdict === 'fail' || report.overallVerdict === 'partial') return true;
  const items = [...report.satisfied, ...report.unresolved, ...report.unintended];
  return items.some(
    (i) =>
      (i.severity === 'critical' || i.severity === 'high') &&
      (i.verdict === 'unintended' || i.verdict === 'partial'),
  );
}

/**
 * The consequence-test-before-deploy gate: the validation report exists AND
 * does not require remediation (after any remediation re-validation produced a
 * clean report). Deployment Authorization's canAdvance and its deploy
 * affordance both gate on this. Pure — canary-pinned.
 */
export function constitutionalThresholdMet(state: DevLoopState): boolean {
  return state.validationReport !== null && !validationRequiresRemediation(state.validationReport);
}

// ─── Intelligent affordance liveness (the "no pulsating done actions" gate) ──

/**
 * Whether a stage's artifact already exists in the session. The stage-keyed
 * mirror of the tab's capabilityHasData — kept here so the liveness gate stays
 * pure and canary-pinned rather than reaching into a component. Pure.
 */
export function stageArtifactExists(stage: DevLoopStage, state: DevLoopState): boolean {
  switch (stage) {
    case 'intent_capture':
      return state.intent !== null;
    case 'context_assembly':
      return state.contextPack !== null && state.contextPack.items.length > 0;
    case 'gap_analysis':
      return state.gapAnalysis !== null;
    case 'consequence_modeling':
      return state.consequenceCanvas !== null && state.consequenceCanvas.successState.length > 0;
    case 'implementation':
      return Boolean(state.implementationBrief);
    case 'consequence_validation':
      return state.validationReport !== null;
    case 'remediation':
      return state.remediationPlan != null;
    case 'deployment_authorization':
      return state.deploymentAuthorization != null;
    case 'complete':
      return true;
    default:
      return false;
  }
}

/**
 * A stage's quick-action is STALE when its artifact already exists AND the loop
 * has advanced past it — re-suggesting completed work is exactly the "pulsating
 * done action" the operator flagged (2026-07-07). Pure — canary-pinned.
 */
export function isStageActionStale(stage: DevLoopStage, state: DevLoopState): boolean {
  const idx = STAGE_ORDER.indexOf(stage);
  const cur = STAGE_ORDER.indexOf(state.stage);
  if (idx < 0 || cur < 0) return false;
  if (cur <= idx) return false; // not past it yet — still the live/next work
  return stageArtifactExists(stage, state);
}

/**
 * A stage's quick-action is IRRELEVANT when the loop position makes it
 * inapplicable: Remediation only applies when the consequence test demands it;
 * Deployment Authorization only once the loop reaches remediation/deploy or the
 * constitutional threshold is already met. Pure — canary-pinned.
 */
export function isStageActionIrrelevant(stage: DevLoopStage, state: DevLoopState): boolean {
  if (stage === 'remediation') {
    return !(state.validationReport !== null && validationRequiresRemediation(state.validationReport));
  }
  if (stage === 'deployment_authorization') {
    return !(
      constitutionalThresholdMet(state) ||
      state.stage === 'deployment_authorization' ||
      state.stage === 'remediation'
    );
  }
  return false;
}

/**
 * The intelligent-affordance gate the Dev Command Center quick-action chips
 * consult: a stage's action may pulse only when it is NEITHER completed-and-past
 * NOR contextually irrelevant. This is the session-state half of the "buttons
 * become intelligent" contract; the DCIR D3 affordance service supplies the
 * observed-event half (a positively-live affordance always pulses). Pure.
 */
export function stageActionLive(stage: DevLoopStage, state: DevLoopState): boolean {
  return !isStageActionStale(stage, state) && !isStageActionIrrelevant(stage, state);
}

export function canAdvance(state: DevLoopState): boolean {
  switch (state.stage) {
    case 'intent_capture':
      return state.intent !== null && state.intent.status !== 'draft';
    case 'context_assembly':
      return state.contextPack !== null && state.contextPack.items.length > 0;
    case 'gap_analysis':
      return state.gapAnalysis !== null;
    case 'consequence_modeling':
      return state.consequenceCanvas !== null && state.consequenceCanvas.successState.length > 0;
    case 'implementation':
      // The stage is only passable once an implementation brief exists —
      // either the approved implementation_brief proposal or a generated
      // constitutional Implementation Pack written back into the session.
      return Boolean(state.implementationBrief);
    case 'consequence_validation':
      // A report existing lets the loop advance — but WHERE it advances is the
      // fork (nextStage): to Remediation when the consequence test fails, or
      // to Deployment Authorization when it passes.
      return state.validationReport !== null;
    case 'remediation':
      // Remediation is passable once a remediation plan is recorded.
      return state.remediationPlan != null;
    case 'deployment_authorization':
      // Consequence-test-before-deploy: the loop only completes once the
      // consequence test passes AND deployment is authorized.
      return constitutionalThresholdMet(state) && state.deploymentAuthorization?.authorized === true;
    case 'complete':
      return false;
    default:
      return false;
  }
}

/**
 * The next stage given the current state — a CONDITIONAL walk, not a linear
 * one, because Constitutional Validation forks. Returns null at the terminal
 * stage. Pure — canary-pinned.
 *
 *  - consequence_validation → remediation      (test failed / partial)
 *                           → deployment_authorization (test passed)
 *  - remediation            → consequence_validation   (revalidationRequired)
 *                           → deployment_authorization  (residual risk accepted)
 *  - every other stage      → the linear STAGE_ORDER successor
 */
export function nextStage(state: DevLoopState): DevLoopStage | null {
  const idx = STAGE_ORDER.indexOf(state.stage);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  switch (state.stage) {
    case 'consequence_validation':
      return state.validationReport && !validationRequiresRemediation(state.validationReport)
        ? 'deployment_authorization'
        : 'remediation';
    case 'remediation':
      return state.remediationPlan?.revalidationRequired
        ? 'consequence_validation'
        : 'deployment_authorization';
    default:
      return STAGE_ORDER[idx + 1];
  }
}

export function advanceStage(state: DevLoopState): DevLoopState {
  if (!canAdvance(state)) return state;
  const next = nextStage(state);
  if (!next) return state;
  return {
    ...state,
    stage: next,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Dev Receipts — the three constitutional classes + recorder ─────────────

/**
 * Classify a receipt actionType into one of the three Dev Receipts panel
 * headings. Development = the pack; Constitutional = validation + remediation;
 * Deployment = proposal + authorization.
 */
export function devReceiptClassFor(actionType: string): DevReceiptClass {
  switch (actionType) {
    case 'constitutional_validation_recorded':
    case 'remediation_recorded':
      return 'constitutional';
    case 'deployment_proposed':
    case 'deployment_authorized':
      return 'deployment';
    case 'implementation_pack_generated':
    default:
      return 'development';
  }
}

/**
 * Record a receipt returned by a constitutional route into the session. Fixes
 * the receipt bug at the state layer: idempotent (same receiptId is never
 * double-recorded), pure (returns a new DevLoopState). Empty ids are ignored.
 */
export function recordDevReceipt(
  state: DevLoopState,
  receipt: { id: string; actionType: string },
): DevLoopState {
  if (!receipt.id || state.receipts.some((r) => r.id === receipt.id)) return state;
  const entry: DevLoopReceipt = {
    id: receipt.id,
    actionType: receipt.actionType,
    class: devReceiptClassFor(receipt.actionType),
    at: new Date().toISOString(),
  };
  return { ...state, receipts: [...state.receipts, entry], updatedAt: new Date().toISOString() };
}

export function getStageIndex(stage: DevLoopStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function getStageLabel(stage: DevLoopStage): string {
  const labels: Record<DevLoopStage, string> = {
    intent_capture: 'Intent Capture',
    context_assembly: 'Context Assembly',
    gap_analysis: 'Gap Analysis',
    consequence_modeling: 'Consequence Modeling',
    implementation: 'Implementation',
    consequence_validation: 'Constitutional Validation',
    remediation: 'Remediation',
    deployment_authorization: 'Deployment Authorization',
    complete: 'Complete',
  };
  return labels[stage];
}

export function buildImplementationPackage(state: DevLoopState): ImplementationPackage | null {
  if (!state.intent || !state.contextPack || !state.gapAnalysis || !state.consequenceCanvas) {
    return null;
  }

  // Prefer the LLM-enriched brief (PRD + architecture plan + task list)
  // approved at the implementation stage; fall back to the derived brief.
  const derivedBrief = [
      `# Implementation Brief: ${state.intent.goal}`,
      '',
      `## Goal`,
      state.intent.goal,
      '',
      `## Desired Outcomes`,
      ...state.intent.desiredOutcomes.map(o => `- ${o}`),
      '',
      `## Success Criteria`,
      ...state.intent.successCriteria.map(c => `- ${c}`),
      '',
      `## Constraints`,
      ...state.intent.constraints.map(c => `- ${c}`),
      '',
      `## Reuse First (${state.gapAnalysis.existing.length} existing capabilities)`,
      ...state.gapAnalysis.existing.map(c => `- ${c.name} (${c.reuseStrategy}) — ${c.location}`),
      '',
      `## Build New (${state.gapAnalysis.missing.length} missing capabilities)`,
      ...state.gapAnalysis.missing.map(c => `- ${c.name} [${c.estimatedComplexity}] — ${c.suggestedLocation}`),
      '',
      `## Consequence Guardrails`,
      '### Must happen:',
      ...state.consequenceCanvas.shouldHappen.map(e => `- ${e.description}`),
      '### Must never happen:',
      ...state.consequenceCanvas.shouldNeverHappen.map(e => `- ${e.description}`),
      '',
      `## Success State`,
      state.consequenceCanvas.successState,
    ].join('\n');

  return {
    intentId: state.intent.intentId,
    brief: state.implementationBrief || derivedBrief,
    contextPack: state.contextPack,
    gapAnalysis: state.gapAnalysis,
    consequenceCanvas: state.consequenceCanvas,
    constraints: state.intent.constraints,
    claudeMdRules: [],
    assembledAt: new Date().toISOString(),
  };
}
