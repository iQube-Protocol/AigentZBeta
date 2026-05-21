/**
 * Activation catalog — the canonical list of runtime surfaces a persona
 * can switch on inside the metaMe cartridge.
 *
 * Each entry maps to:
 *   - the tab/group it surfaces in the metaMe codex
 *   - the gate that controls activation
 *   - whether the surface auto-grants on first read
 *
 * `tabSlug` is the slug in the metaMe codex that should become visible
 * when the activation is `active` for the persona. `CodexPanelDynamic`
 * reads this mapping to gate tab visibility.
 *
 * The catalog is static — adding or removing entries is a code change.
 * Cohort definitions and payment / token gating live elsewhere; the
 * `gate` here is just the high-level mode.
 */

import type { ActiveCartridgeSlug } from '@/services/iqube/experienceQube';

export type ActivationGate = 'open' | 'gated';

export interface ActivationCatalogEntry {
  /** Stable id — persisted in persona_activations.activation_id. */
  id: string;
  /** User-facing label. */
  label: string;
  /** Short one-line description shown in the Activations grid. */
  description: string;
  /** Slightly longer copy for the activation card body. */
  longDescription: string;
  /** Gate type — drives the activation flow on the Activations tab. */
  gate: ActivationGate;
  /**
   * Slug of the metaMe codex tab/group that becomes visible when this
   * activation is `active`. Drives CodexPanelDynamic gating.
   */
  tabSlug: string;
  /** Source cartridge the surface ultimately came from. */
  sourceCartridge: ActiveCartridgeSlug | 'metame';
  /** Optional icon key from the metaMe icon map. */
  icon?: string;
  /** Optional accent color. */
  color?: string;
}

export const ACTIVATION_CATALOG: ActivationCatalogEntry[] = [
  {
    id: 'mycanvas',
    label: 'myCanvas',
    description: 'Your private publishing surface for works-in-progress and ideas.',
    longDescription:
      'A personal surface to publish drafts, half-formed thoughts, and works-in-progress that aigentMe or the Studio produces with you. Private by default — invite specific people, or later republish into a community surface or social platform.',
    gate: 'open',
    tabSlug: 'mycanvas',
    sourceCartridge: 'metame',
    icon: 'PenSquare',
    color: 'violet',
  },
  {
    id: 'order-of-metaye',
    label: 'Order of Metayé',
    description: 'Active surface of the KNYT world — Order rituals, missions, and standing.',
    longDescription:
      'The participation layer of the KNYT cartridge. Surfaces the Order tab and its sub-tabs (rituals, standing, and missions) directly inside metaMe.',
    gate: 'open',
    tabSlug: 'order-of-metaye',
    sourceCartridge: 'knyt',
    icon: 'Shield',
    color: 'amber',
  },
  {
    id: 'agentiq-os',
    label: 'AgentiQ OS',
    description: 'Build, bind, and deploy your own agents on the AgentiQ runtime.',
    longDescription:
      'Activate the AgentiQ OS surfaces — Home, Docs, Build, Bind, Deploy, Missions, and Community — so you can spin up your own agents, connect them to iQubes, and ship them into the network from inside metaMe.',
    gate: 'open',
    tabSlug: 'agentiqos',
    sourceCartridge: 'metame',
    icon: 'Cpu',
    color: 'cyan',
  },
  {
    id: 'qriptopian',
    label: 'Qriptopian',
    description: 'The editorial surface — frame moments, briefs, and angles with Quill.',
    longDescription:
      'Activate the Qriptopian active surfaces so you can collaborate with Quill on editorial angles, issue briefs, and longer-form narrative work that ties back to your venture motion.',
    gate: 'open',
    tabSlug: 'qriptopian',
    sourceCartridge: 'qriptopian',
    icon: 'Globe',
    color: 'slate',
  },
  {
    id: 'venture-lab',
    label: 'Venture Lab',
    description: 'Venture-building workspace — KPIs, partners, and runway moves.',
    longDescription:
      'Operate your venture through the AgentiQ Venture Lab α surfaces — track KPIs, manage priority partners and campaigns, generate venture progress reports, and run the alpha-activation checkpoints with Aigent Z.',
    gate: 'gated',
    tabSlug: 'venture-lab',
    sourceCartridge: 'avl',
    icon: 'TrendingUp',
    color: 'emerald',
  },
  {
    id: 'marketa',
    label: 'Marketa',
    description: 'Campaign + partner motion — sequences, proposals, and outreach.',
    longDescription:
      'Activate the Marketa surfaces to draft partner proposals with the Marketa agent, run campaign sequences, and route outreach through the connector pipeline. Invite-only during alpha.',
    gate: 'gated',
    tabSlug: 'marketa',
    sourceCartridge: 'marketa',
    icon: 'Megaphone',
    color: 'rose',
  },
  {
    id: 'metame-studio',
    label: 'metaMe Studio',
    description: 'Author experiences, briefs, and runtime artifacts at full depth.',
    longDescription:
      'The full-depth authoring surface — build StudioArtifacts (briefs, post-sets, image prompts, video scripts, slide outlines) that flow into your codex and runtime. Invite-only during alpha.',
    gate: 'gated',
    tabSlug: 'metame-studio',
    sourceCartridge: 'metame',
    icon: 'PenTool',
    color: 'indigo',
  },
];

export function getActivationEntry(id: string): ActivationCatalogEntry | null {
  return ACTIVATION_CATALOG.find((e) => e.id === id) ?? null;
}

export function activationIdForTabSlug(slug: string): string | null {
  const hit = ACTIVATION_CATALOG.find((e) => e.tabSlug === slug);
  return hit?.id ?? null;
}
