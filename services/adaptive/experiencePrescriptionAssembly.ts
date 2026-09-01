/**
 * experiencePrescriptionAssembly — the ONE shared prescription assembler
 * bridging CFS-007's renderer-neutral `ExperiencePrescription` seam
 * (types/experienceRenderer.ts) and SPEC-AEE-001's live AEE loop
 * (journeyAeeOrchestrator.ts) (AEE-XP-001 §11, XP-2 Experience Architecture
 * → ExperiencePrescription → AEE Projection convergence, 2026-09-01).
 *
 * Phase 0 audit (this session) found these two architectures coexist with
 * ZERO cross-references: `ExperiencePrescription`/`ExperienceRenderer` are
 * consumed by two real renderer adapters (liquid, a2ui) but produced by
 * nothing in production; `AdaptiveExperienceProvider`/`ExperienceProjection`
 * is a live, working pipeline with no renderer-neutral output contract. This
 * module is the FIRST bridge — it invents no second matrix model, no second
 * NBE engine, and does not touch `nativeProvider.ts`'s ranking logic (that
 * is CLOSED per operator directive, commit c330c32ab). It only ASSEMBLES
 * outputs already produced by the existing pieces into the existing
 * `ExperiencePrescription` shape.
 *
 * Responsibility split (unchanged — this module owns none of these
 * decisions, it reads their outputs verbatim):
 *   Journey Spine        — what requirements remain (reachability,
 *                           authority). Read via `aee.nbe.targetStageId` +
 *                           the stage's own definition; never re-derived.
 *   Experience Matrix/Guide — the appropriate DEPTH and experience form for
 *                           THIS persona right now. Read via
 *                           `PersonaMatrixCalibration`
 *                           (services/strategy/experienceMatrixDeriver.ts,
 *                           now uncertainty-safe — see that file's
 *                           `uncertain`/`unreadableSources`).
 *   AEE (journeyAeeOrchestrator) — WHICH reachable experience to project
 *                           now. Read via the already-computed
 *                           `JourneyAeeOutcome`; never recomputed here.
 *   ExperiencePrescription (this module's output) — renderer-agnostic
 *                           architecture instruction: surface + depth +
 *                           label + cta + props.
 *   Renderer              — manifestation only (types/experienceRenderer.ts
 *                           `ExperienceRenderer.render`); never reads
 *                           Journey or matrix state itself — unchanged.
 *
 * Constitutional discipline (unchanged from journeyAeeOrchestrator.ts):
 * different depth/form is a PRESENTATION decision. It never changes Journey
 * reachability, never changes constitutional permission, and never makes a
 * BLOCKED capability actionable — `aee.nbe.targetStageId` (already computed
 * with Journey Spine as the sole reachability authority) is read verbatim;
 * this module cannot pick a different target stage, only how richly to
 * present the one AEE already recommends.
 *
 * Uncertainty discipline (Track 2 invariant applied here too, 2026-09-01):
 * when `matrixCalibration` is null or `uncertain: true`, the assembler falls
 * back to the safest depth ('pill') exactly as a genuine beginner would see
 * — but marks the fallback EXPLICITLY via `props.matrixUncertain` /
 * `props.matrixUnreadableSources`, so an uncertain read never masquerades as
 * a confirmed beginner state to a consumer that inspects the prescription
 * (acceptance criterion 5). A renderer that ignores `props` (as CFS-007
 * requires — opaque pass-through) sees an unremarkable pill prescription,
 * which is the correct, deterministic, useful fallback (acceptance 8).
 */

import type { JourneyDefinition } from '@/types/journey';
import type { JourneyAeeOutcome } from '@/services/adaptive/journeyAeeOrchestrator';
import type { ExperiencePrescription } from '@/types/experienceRenderer';
import type { ExperienceDepth } from '@/types/orchestration';
import type { PersonaMatrixCalibration } from '@/services/strategy/experienceMatrixDeriver';
import { WALLET_CONVERSION_CAPABILITY_ID } from '@/services/financialServices/walletConversionCapability';

export interface AssembleExperiencePrescriptionInput {
  journeyDefinition: JourneyDefinition;
  /** The AEE outcome already computed for this interaction (WHICH reachable
   *  experience) — read-only, never recomputed here. */
  aee: JourneyAeeOutcome;
  /** Persona matrix/guide calibration (Experience Matrix/Guide's contribution
   *  — HOW richly to present it), or null when genuinely unavailable for this
   *  caller (e.g. no persona at all). Distinct from `uncertain: true` (a real
   *  persona whose read failed) — both fall back to the same safe depth, but
   *  only the latter is marked in `props` (see header). */
  matrixCalibration: PersonaMatrixCalibration | null;
  /** Surface directive template — e.g. 'liquidui:cartridge_runtime_v1',
   *  'a2ui:surface_plan_v0'. WHICH renderer/template family to target is a
   *  host/render constraint the caller owns (CFS-007's own architecture/
   *  rendering split); this module only decides depth/label/cta within it. */
  surfaceTemplate: string;
  /** Host/render constraint — the depths this host can actually materialize
   *  (mirrors `RendererCapabilities.depths`). When the matrix-preferred depth
   *  isn't in this list, the assembler substitutes the CLOSEST depth on the
   *  canonical ladder the host does support (e.g. a liquid host that cannot
   *  render 'pill' gets 'capsule', its nearest richer neighbor) — it never
   *  silently drops the prescription. Omit to mean "no constraint". */
  supportedDepths?: ExperienceDepth[];
}

/**
 * Engagement (Studio/customer-matrix axis, ENGAGEMENT_LEVELS in
 * experienceMatrixDeriver.ts) → the depth an Experience Guide-calibrated
 * persona warrants. Tunable, documented design decision (same discipline as
 * the deriver's own axis mappings) — not a second source of truth for the
 * axis vocabulary itself, which stays exported from experienceMatrixDeriver.
 */
const ENGAGEMENT_TO_DEPTH: Record<string, ExperienceDepth> = {
  Recipient: 'pill',
  Selector: 'pill',
  Modifier: 'capsule',
  Producer: 'capsule',
  Builder: 'mini_runtime',
  Steward: 'mini_runtime',
};

const DEPTH_LADDER: ExperienceDepth[] = ['pill', 'capsule', 'mini_runtime', 'codex'];

interface DepthDecision {
  depth: ExperienceDepth;
  uncertain: boolean;
  unreadableSources?: PersonaMatrixCalibration['unreadableSources'];
}

/**
 * PURE — the Experience Matrix/Guide → depth mapping. Never reads Journey
 * state; never decides reachability.
 */
function depthFromCalibration(calibration: PersonaMatrixCalibration | null): DepthDecision {
  if (!calibration || calibration.uncertain) {
    return {
      depth: 'pill',
      uncertain: !!calibration?.uncertain,
      unreadableSources: calibration?.unreadableSources,
    };
  }
  return { depth: ENGAGEMENT_TO_DEPTH[calibration.experience.engagement] ?? 'pill', uncertain: false };
}

/** PURE — substitutes the CLOSEST depth on the canonical ladder the host
 *  actually supports when the matrix-preferred depth isn't in its list
 *  (ties broken toward the SAFER/lower depth). Never drops the prescription. */
function resolveSupportedDepth(depth: ExperienceDepth, supported: ExperienceDepth[] | undefined): ExperienceDepth {
  if (!supported || supported.length === 0 || supported.includes(depth)) return depth;
  const targetIdx = DEPTH_LADDER.indexOf(depth);
  let best = supported[0];
  let bestDist = Infinity;
  for (const candidate of supported) {
    const candidateIdx = DEPTH_LADDER.indexOf(candidate);
    const dist = Math.abs(candidateIdx - targetIdx);
    if (dist < bestDist || (dist === bestDist && candidateIdx < DEPTH_LADDER.indexOf(best))) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * PURE — no I/O. Assembles the existing `ExperiencePrescription` type from
 * already-computed AEE/matrix outputs. Returns null when AEE has nothing
 * reachable to recommend (Journey Spine's own call — never invented here).
 */
export function assembleExperiencePrescription(
  input: AssembleExperiencePrescriptionInput,
): ExperiencePrescription | null {
  const { journeyDefinition, aee, matrixCalibration, surfaceTemplate, supportedDepths } = input;

  const targetStageId = aee.nbe.targetStageId;
  if (!targetStageId) return null;

  const stage = journeyDefinition.stages.find((s) => s.id === targetStageId);
  if (!stage) return null;

  const { depth: preferredDepth, uncertain, unreadableSources } = depthFromCalibration(matrixCalibration);
  const depth = resolveSupportedDepth(preferredDepth, supportedDepths);

  const prescription: ExperiencePrescription = {
    surface: surfaceTemplate,
    depth,
    label: stage.label,
    ctaLabel: aee.crossingRecommended ? 'Cross' : 'Continue',
    ctaAction: stage.permittedActions[0],
    props: {
      journeyId: journeyDefinition.id,
      stageId: stage.id,
      disposition: aee.nbe.disposition,
      matrixSource: matrixCalibration?.source ?? null,
      matrixUncertain: uncertain,
      ...(unreadableSources && unreadableSources.length > 0 ? { matrixUnreadableSources: unreadableSources } : {}),
      // AEE-Next (2026-09-01) — capability READINESS, not exercise. At
      // fs-cross, AEE projects that the real wallet-conversion capability
      // WILL become available once the crossing completes — it never
      // implies a conversion happened, and this module performs no I/O.
      // The same id also rides the ExperienceHandoff created at Cross
      // (FinancialSovereigntyPrepareCrossStage.tsx) — one constant, never
      // two hand-copied literals.
      ...(stage.id === 'fs-cross' ? { capabilityFocus: [WALLET_CONVERSION_CAPABILITY_ID] } : {}),
    },
  };

  return prescription;
}
