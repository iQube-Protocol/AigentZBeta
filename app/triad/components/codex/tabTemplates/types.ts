/**
 * Tab Template Framework — shared types.
 *
 * Phase 5 of the myCartridge PRD (see codexes/packs/agentiq/updates/
 * 2026-06-02_mycartridge-phase-5-tab-templates.md and the framework
 * specification at PRD §22).
 *
 * Templates are cartridge-agnostic React components dispatched by
 * `TabRenderer` when `CodexTab.type === 'template'`. They receive a
 * uniform `TabTemplateProps` envelope so the wizard (Phase 6) can
 * configure any template against any cartridge without forking a
 * bespoke React component per tab.
 */

import type { CartridgeTabTemplateId } from "@/types/ventureQube";

/**
 * Props every TabTemplate receives. Cartridge-agnostic — the template
 * derives its rendering from `cartridgeSlug` + `config` only. No
 * template should hardcode a cartridge id; if it does, that's a Phase
 * 5b regression and the lint should catch the literal slug.
 *
 * `permissions` mirrors the gate posture the spine resolved for this
 * persona on this cartridge (Phase 4b output). Templates use it for
 * conditional UI (e.g. show the "Settings" link only when isAdmin), not
 * for security gates — the security gate already fired before the
 * template was mounted.
 */
export interface TabTemplateProps {
  /** Which cartridge this tab is rendering for. T1-safe slug. */
  cartridgeSlug: string;
  /** Active persona id forwarded from the spine. May be undefined for
   *  embed surfaces without a resolved persona yet. */
  personaId?: string;
  /** Theme + density forwarded from CodexPanelDynamic. */
  theme?: "light" | "dark";
  density?: "narrow" | "wide";
  /** Cartridge-level permissions snapshot for this persona. T1-safe
   *  projections from `cartridgeFlags`; never persona ids or
   *  granted_by. Optional fields mirror the optional T1 shape. */
  permissions?: {
    isAdmin?: boolean;
    isPartner?: boolean;
    /** From the Phase 4b spine projection — slug → role. */
    cartridgeRole?: string;
  };
  /** Free-form config the wizard wrote when creating the tab. Each
   *  template documents the keys it consumes; unknown keys are ignored
   *  (forward-compatible). */
  config?: Record<string, unknown>;
  /** Rendering shell — forwarded from CodexPanelDynamic. */
  shell?: "embed" | "viewer";
}

/**
 * The map from template id → React component. Populated in
 * `./registry.tsx`. The id type comes from `types/ventureQube.ts` so
 * the v0.4 Venture iQube schema and the runtime registry stay in
 * lockstep.
 */
export type TabTemplateRegistry = Record<
  CartridgeTabTemplateId,
  React.ComponentType<TabTemplateProps>
>;
