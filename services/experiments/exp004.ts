/**
 * EXP-004 — the Sovereignty Drill (CFS-015 principle 4, Sovereign
 * Survivability). Claim under test: the Human Agency System remains
 * CONSTITUTIONALLY operational using only the open-weight provider (venice).
 * Operational quality may degrade; constitutional operation shall not.
 *
 * Design: a fixed battery — the five EXP-003 constitutional tasks
 * (initialized arm: grounded in the 18-seed collection) plus one
 * implementation-pack generation — executed VENICE-ONLY. The provider is
 * pinned explicitly at every call site (no env manipulation, no router
 * changes). Judged by a venice judge (the drill's evaluator must itself be
 * sovereign).
 *
 * Pass/fail semantics, stated precisely:
 *   - CONSTITUTIONAL failure = a battery task cannot complete at all.
 *   - Quality deltas versus the recorded EXP-003 run-1 numbers are the
 *     DEGRADATION REPORT — reported, never scored as failure.
 *
 * The drill doubles as the first CRP hand-back: Chrysalis consumes it as an
 * acceptance test; the CRP owns its research interpretation (CRP-001).
 */

import {
  exp003AnswerStep,
  exp003Config,
  exp003CountCitations,
  exp003JudgeStep,
  fetchExp003Collection,
  type Exp003Verdict,
} from '@/services/experiments/exp003';
import { generateImplementationPack, type ImplementationPack } from '@/services/constitutional/implementationPack';
import type { ExperimentProvider } from '@/services/experiments/llm';

/**
 * Sovereignty is a PROVIDER-CLASS property, not a vendor name (operator
 * refinement, 2026-07-06): the claim is that constitutional operation
 * survives on a NON-FRONTIER (open-weight) provider alone. Venice is the
 * platform's only open-weight adapter today, so it is the sovereign
 * provider — but the definition travels with the class, and a canary pins
 * this constant to the `open-weight` kind in the constitutional provider
 * inventory (services/constitutional/inferenceProviders.ts). Frontier runs
 * (e.g. forced openai) exercise the full capability end-to-end; they can
 * never satisfy the sovereignty claim.
 */
export const SOVEREIGN_CLASS = 'open-weight' as const;
export const SOVEREIGN_PROVIDER = 'venice' as const;

/**
 * REHEARSAL arm (2026-07-06, operator-directed): venice credits are pending,
 * so the identical battery may run on a substitute provider to validate the
 * drill MACHINERY end-to-end. A rehearsal completion is NEVER a sovereignty
 * claim — sovereignty is definitionally open-weight-only — and rehearsal
 * publishes carry `rehearsal: true` with no `sovereigntyHolds` field. The
 * Chrysalis sovereignty criterion treats a rehearsal as `partial`, never
 * `pass`. Venice is deliberately NOT in this list (a venice run IS the
 * sovereign drill).
 *
 * ORDER IS THE OPERATOR'S PREFERENCE CHAIN (2026-07-06): chaingpt default,
 * openai fallback — then venice as the sovereign run once credits land. The
 * runner defaults to the first AVAILABLE provider in this order.
 */
export const REHEARSAL_PROVIDERS = ['chaingpt', 'openai'] as const;
export type RehearsalProvider = (typeof REHEARSAL_PROVIDERS)[number];

export function isRehearsalProvider(p: string): p is RehearsalProvider {
  return (REHEARSAL_PROVIDERS as readonly string[]).includes(p);
}

/**
 * Graded sovereignty-scale mapping (operator correction 2026-07-07; apex
 * recalibration 2026-07-09). Every completed EXP-004 run is legitimate
 * sovereignty data — the PSE series claim is that platform sovereignty is a
 * MEASURABLE BUNDLE (model, provider choice, commercial independence,
 * infrastructure), and each run measures real bundle components at some rung of
 * the Sovereignty Scale. A frontier substitute run demonstrates S2
 * (substitutable): provider interchangeability + commercial independence from
 * any single vendor. The open-weight (venice) run reaches S3 — but S3 is open
 * weights on THIRD-PARTY hosting, NOT the apex.
 *
 * Apex recalibration (2026-07-09): the true apex of model sovereignty is
 * open-weight inference on our OWN decentralised infra (S4 self-hosted) — no
 * third party can rate-limit, price-gate, or disappear it. That tier is now
 * measurable: a run pinned to the self-hosted node (services/constitutional/
 * sovereignNode.ts) is the 'self-hosted' arm → S4. Beyond it, S5 (sovereign
 * platform) applies the SAME principle to the whole platform substrate
 * (storage/execution/hosting on sovereign infra, e.g. AutoDrive/Autonomys vs
 * centralised AWS) — inv.sovereignty.104/105, a Chrysalis 3.0 horizon that
 * THIS drill does not measure (it measures the intelligence supply, not the
 * platform substrate); the infrastructure drill (PSE-4) will. An incomplete run
 * measures no rung (constitutional operation did not complete).
 */
export const BUNDLE_COMPONENTS_FRONTIER = [
  'provider-interchangeability',
  'commercial-independence',
  'constitutional-operation',
] as const;

export const BUNDLE_COMPONENTS_OPEN_WEIGHT = [
  ...BUNDLE_COMPONENTS_FRONTIER,
  'open-weight-independence',
] as const;

/** Self-hosted (S4) adds model-hosting sovereignty atop open-weight independence:
 *  the model runs on OUR infra, so no third-party host can deny inference. */
export const BUNDLE_COMPONENTS_SELF_HOSTED = [
  ...BUNDLE_COMPONENTS_OPEN_WEIGHT,
  'model-hosting-sovereignty',
] as const;

/** 'frontier' = a substitute (S2) run; 'open-weight' = the third-party-hosted
 *  venice (S3) run; 'self-hosted' = the apex-model run on our own node (S4). */
export type SovereigntyArm = 'open-weight' | 'frontier' | 'self-hosted';

/** The Sovereignty Scale rung a completed run measures — 's4-self-hosted' for
 * the apex-model (own-infra) arm, 's3-open-weight' for the third-party-hosted
 * open-weight arm, 's2-substitutable' for a substitutable frontier run; null
 * when constitutional operation did not complete (no rung is claimed on
 * failure). S5 (sovereign platform) is NOT reachable by this drill — it grades
 * the platform substrate, measured by the infrastructure drill, not the model.
 * Pure — canary-pinned in tests/constitutional-contracts.test.ts. */
export function sovereigntyRungForRun(arm: SovereigntyArm, completed: boolean): string | null {
  if (!completed) return null;
  if (arm === 'self-hosted') return 's4-self-hosted';
  return arm === 'open-weight' ? 's3-open-weight' : 's2-substitutable';
}

/** The bundle components a run of this arm measures. */
export function bundleComponentsForArm(arm: SovereigntyArm): readonly string[] {
  if (arm === 'self-hosted') return BUNDLE_COMPONENTS_SELF_HOSTED;
  return arm === 'open-weight' ? BUNDLE_COMPONENTS_OPEN_WEIGHT : BUNDLE_COMPONENTS_FRONTIER;
}

export interface Exp004Battery {
  /** The five EXP-003 constitutional tasks, initialized arm only. */
  tasks: { id: string; prompt: string }[];
  /** Plus one implementation-pack generation task. */
  packTask: { id: string; goal: string };
}

export function exp004Battery(): Exp004Battery {
  const { tasks } = exp003Config();
  return {
    tasks: tasks.map((t) => ({ id: t.id, prompt: t.prompt })),
    packTask: {
      id: 'task-6-implementation-pack',
      goal: 'Add a per-persona export of activity receipts as a signed, verifiable JSON bundle, honouring the identifier-tier rules (no T0 identifiers in the export).',
    },
  };
}

/** One grounded answer, venice-pinned by default (initialized arm —
 * sovereignty tests the CONSTITUTIONAL mode of operation, which is grounded
 * by definition). A rehearsal provider may substitute for machinery drills. */
export async function exp004AnswerStep(
  taskIndex: number,
  model?: string,
  provider: ExperimentProvider = SOVEREIGN_PROVIDER,
) {
  return exp003AnswerStep(provider, taskIndex, 'initialized', model);
}

/** Groundedness judged by the SAME provider as the answers (the sovereign
 * drill's evaluator must itself be sovereign; a rehearsal's evaluator rides
 * the rehearsal provider). */
export async function exp004JudgeStep(
  taskIndex: number,
  answer: string,
  model?: string,
  provider: ExperimentProvider = SOVEREIGN_PROVIDER,
): Promise<Exp003Verdict & { citations: number }> {
  const verdict = await exp003JudgeStep(provider, taskIndex, answer, model);
  const collection = await fetchExp003Collection();
  const { totalCitations } = exp003CountCitations(answer, collection);
  return { ...verdict, citations: totalCitations };
}

/** The pack-generation task. composedBy tells the truth:
 * 'llm' = the provider drafted the plan; 'template' = it failed and the
 * deterministic fallback carried constitutional operation (which is itself
 * the survivability contract working — record it, don't mask it). */
export async function exp004PackStep(
  provider: ExperimentProvider = SOVEREIGN_PROVIDER,
): Promise<{
  completed: boolean;
  composedBy: ImplementationPack['composedBy'];
  bindings: number;
  areas: number;
  mechanism: string;
}> {
  const battery = exp004Battery();
  const pack = await generateImplementationPack({
    goal: battery.packTask.goal,
    providerPin: provider,
  });
  return {
    completed: true,
    composedBy: pack.composedBy,
    bindings: pack.invariantBindings.length,
    areas: pack.areasToTouch.length,
    mechanism: pack.implementationMechanism,
  };
}
