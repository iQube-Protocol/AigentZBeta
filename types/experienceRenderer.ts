/**
 * Experience Renderer — the named rendering seam (CFS-007, Law VI:
 * Separate Architecture from Rendering).
 *
 * The architecture layer (depth ladders, matrix cells, capsule contracts,
 * invariants) is canonical; rendering is contextual. This contract names the
 * seam between them so Law VI is enforceable in review: adapters translate an
 * ExperiencePrescription into surface-specific output and MUST NOT interpret
 * architecture — no depth logic, no gating decisions. Access is resolved
 * upstream by the spine; renderers render.
 *
 * Adapters (each registered where its mechanism runs — there is deliberately
 * no cross-bundle runtime registry, since the liquid path is client React and
 * the generative path is server-side):
 *   - 'liquid'  — app/triad/components/codex/liquidTemplates/liquidExperienceRenderer.ts
 *                 (wraps liquidTemplateRegistry; caller: TabRenderer)
 *   - 'a2ui'    — services/a2ui/a2uiExperienceRenderer.ts
 *                 (wraps surface-plan → A2UI payload; caller: the CopilotKit
 *                 a2ui actions)
 *
 * This file is intentionally React-free so both sides can import it.
 */

import type { ExperienceDepth } from './orchestration';

/**
 * The wire format of /api/experience/capsule uses 'mini_rt' where the
 * canonical ExperienceDepth type says 'mini_runtime'. This normalizer is the
 * single documented bridge — use it at every boundary that ingests a depth
 * string, instead of scattering ad-hoc mappings.
 */
export function normalizeExperienceDepth(value: string | null | undefined): ExperienceDepth {
  if (value === 'mini_rt' || value === 'mini_runtime') return 'mini_runtime';
  if (value === 'pill' || value === 'capsule' || value === 'codex') return value;
  return 'pill';
}

/**
 * The architecture-side output — renderer-agnostic (CFS-007 §3). Only
 * `surface` is required: the surface directive the adapter resolves (a liquid
 * template id, an A2UI plan directive). Everything else is the prescription
 * meta a richer caller can supply (the capsule route's matrix-cell resolution,
 * invariant grounding refs per CFS-007 §5).
 */
export interface ExperiencePrescription {
  /** Surface directive — e.g. 'liquidui:cartridge_runtime_v1', 'a2ui:surface_plan_v0'. */
  surface: string;
  depth?: ExperienceDepth;
  /** Matrix cell that produced this prescription (patronage × pcs), when known. */
  matrixCellKey?: string;
  label?: string;
  ctaLabel?: string;
  ctaAction?: string;
  nextDepth?: ExperienceDepth;
  /** Invariant grounding refs (seed ids) — CFS-007 §5 explainable rendering. */
  invariantSeedIds?: string[];
  /** Surface-specific pass-through (template props, module refs). Opaque to the seam. */
  props?: Record<string, unknown>;
}

/** T1-safe render context — identity surface + device + journey state. No T0. */
export interface CitizenContext {
  personaId?: string;
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  device?: 'mobile' | 'tablet' | 'desktop';
  sessionId?: string;
  cartridge?: string;
  journeyStage?: string;
}

export interface RendererCapabilities {
  /** Depths this renderer can materialize. */
  depths: ExperienceDepth[];
  /** Surface directives it can resolve (template ids / plan directives). */
  surfaces: string[];
}

/**
 * The renderer contract (CFS-007 §3). TOutput is adapter-specific — a React
 * component binding for the liquid adapter, a declarative payload for the
 * A2UI adapter — because the two mechanisms genuinely produce different
 * artifact kinds; the shared seam is the prescription/context contract, not
 * a lowest-common-denominator output.
 */
export interface ExperienceRenderer<TOutput> {
  id: string;
  capabilities(): RendererCapabilities;
  render(
    prescription: ExperiencePrescription,
    context: CitizenContext,
  ): TOutput | Promise<TOutput>;
}
