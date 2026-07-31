/**
 * Liquid Experience Renderer — adapter over liquidTemplateRegistry
 * (CFS-007 §4, Law VI: Separate Architecture from Rendering).
 *
 * Wraps (does not rewrite) the existing liquid-template mechanism: the
 * registry lookup that used to live inline in TabRenderer's liquid-ui branch
 * now goes through this named seam. The adapter resolves a prescription's
 * surface directive to a registered React component and binds the T1-safe
 * citizen context to the component's shared props. It performs NO depth
 * logic and NO gating — access is resolved upstream by the spine.
 *
 * Output kind is a component binding (not an element) so the caller — a
 * React component — owns JSX instantiation and React stays out of the seam
 * types.
 */

import type {
  CitizenContext,
  ExperiencePrescription,
  ExperienceRenderer,
  RendererCapabilities,
} from '@/types/experienceRenderer';
import { liquidTemplateRegistry, type LiquidTemplateComponent } from './registry';

export interface LiquidRenderedExperience {
  kind: 'react-component';
  Component: LiquidTemplateComponent;
  props: Record<string, unknown>;
}

export const liquidExperienceRenderer: ExperienceRenderer<LiquidRenderedExperience | null> = {
  id: 'liquid',

  capabilities(): RendererCapabilities {
    return {
      // Liquid templates materialize the in-cartridge depths; pills are
      // rendered by the capsule/card primitives, not templates.
      depths: ['capsule', 'mini_runtime', 'codex'],
      surfaces: Object.keys(liquidTemplateRegistry),
    };
  },

  render(
    prescription: ExperiencePrescription,
    context: CitizenContext,
  ): LiquidRenderedExperience | null {
    const Component = liquidTemplateRegistry[prescription.surface];
    if (!Component) return null;
    return {
      kind: 'react-component',
      Component,
      props: {
        theme: context.theme,
        density: context.density,
        personaId: context.personaId,
        forcedDevice: context.device,
        ...(prescription.props ?? {}),
      },
    };
  },
};
