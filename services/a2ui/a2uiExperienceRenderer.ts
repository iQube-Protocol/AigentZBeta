/**
 * A2UI Experience Renderer — adapter over the generative surface-plan path
 * (CFS-007 §4, Law VI: Separate Architecture from Rendering).
 *
 * Wraps (does not rewrite) the CopilotKit-side rendering mechanism: the
 * surface-plan generation + A2UI payload adaptation that previously lived
 * inline in the a2ui_generate_surface_payload action handler. The action is
 * now a caller of this named seam. The adapter translates a prescription +
 * citizen context into the declarative A2UI payload; it performs NO depth
 * logic and NO gating — access is resolved upstream by the spine.
 *
 * Server-only (fetches the runtime planning endpoint).
 */

import {
  mapDeviceTypeToDeviceContext,
  mapRuntimeIntent,
} from '@/services/metame/surfacePlanningService';
import { surfacePlanToA2UIPayload } from './surfacePlanAdapter';
import type {
  CitizenContext,
  ExperiencePrescription,
  ExperienceRenderer,
  RendererCapabilities,
} from '@/types/experienceRenderer';

/** The surface directive this adapter resolves. */
export const A2UI_SURFACE_PLAN = 'a2ui:surface_plan_v0';

export interface A2UIModuleRef {
  module_id: string;
  module_type: string;
  source_refs?: Array<{ kind: 'schema_ref' | 'doc_ref' | 'uri_ref'; id: string }>;
}

export interface A2UIRenderedExperience {
  kind: 'surface-payload';
  surfacePlan: unknown;
  a2uiPayload: ReturnType<typeof surfacePlanToA2UIPayload>;
}

export const a2uiExperienceRenderer: ExperienceRenderer<A2UIRenderedExperience> = {
  id: 'a2ui',

  capabilities(): RendererCapabilities {
    return {
      // The generative path composes screen-scale surfaces.
      depths: ['mini_runtime', 'codex'],
      surfaces: [A2UI_SURFACE_PLAN],
    };
  },

  async render(
    prescription: ExperiencePrescription,
    context: CitizenContext,
  ): Promise<A2UIRenderedExperience> {
    if (prescription.surface !== A2UI_SURFACE_PLAN) {
      throw new Error(`a2ui renderer cannot resolve surface '${prescription.surface}'`);
    }
    const props = prescription.props ?? {};
    const modules = (props.modules ?? []) as A2UIModuleRef[];
    const runtimeIntent = typeof props.runtimeIntent === 'string' ? props.runtimeIntent : 'read';
    const cartridge = context.cartridge ?? 'Qriptopian';
    const deviceType = context.device ?? 'desktop';

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const planId = `a2ui_plan_${Date.now()}_${deviceType}_${runtimeIntent}`;

    const surfacePlanResponse = await fetch(`${baseUrl}/api/metame/runtime/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: planId,
        session_id: context.sessionId,
        cartridge,
        intent: mapRuntimeIntent(runtimeIntent),
        device_context: mapDeviceTypeToDeviceContext(deviceType),
        codex_id: props.codexId,
        capsule_id: props.capsuleId,
        thread_id: props.threadId,
        modules,
        verification: {
          dis_ref: { kind: 'doc_ref', id: `dis:${cartridge}:v0` },
          constraint_manifest_ref: { kind: 'doc_ref', id: `constraints:${cartridge}:v0` },
          parity_report_ref: { kind: 'doc_ref', id: 'parity:pending' },
        },
      }),
    });

    if (!surfacePlanResponse.ok) {
      const errorText = await surfacePlanResponse.text();
      throw new Error(`Surface plan generation failed: ${errorText}`);
    }

    const surfacePlan = await surfacePlanResponse.json();
    const a2uiPayload = surfacePlanToA2UIPayload(surfacePlan);
    return { kind: 'surface-payload', surfacePlan, a2uiPayload };
  },
};
