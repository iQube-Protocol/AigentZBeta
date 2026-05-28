/**
 * AigentQube source adapter — reads from `RUNTIME_AGENT_IDS` in
 * `services/metame/agentLlmOrchestra.ts`, which is the canonical
 * list of runtime aigents in the system today (aigent-me,
 * aigent-kn0w1, aigent-moneypenny, aigent-nakamoto, aigent-marketa).
 *
 * The orchestra carries provider/model bindings; this adapter
 * pairs each aigent id with a human-readable profile (description,
 * role, tools referenced) and emits a LegibilitySource the card
 * builder understands.
 *
 * Marketa is the canonical "aigent that uses tools" example — its
 * profile lists referenced tool iqube ids so an agent reading
 * Marketa's card can follow the trail back to those ToolQubes via
 * the catalog.
 *
 * Fast-follow promotion path: when we add an `aigent_qubes` table
 * with per-aigent owner, version, provenance and ledger metadata,
 * this adapter swaps the in-memory profile map for a live DB
 * query — the card builder doesn't change.
 */

import { RUNTIME_AGENT_IDS } from '@/services/metame/agentLlmOrchestra';
import type { LegibilitySource } from '../cardBuilder';
import type { IQubeSupportedInterfaces } from '@/types/iqube/legibility';

type AigentRole = 'orchestrator' | 'specialist' | 'guardian' | 'partner';

interface AigentProfile {
  /** Stable iqube id (same as the orchestra's RUNTIME_AGENT_ID). */
  id: (typeof RUNTIME_AGENT_IDS)[number];
  display_name: string;
  description: string;
  role: AigentRole;
  /** ToolQube iqube ids this aigent uses, for cross-card discovery. */
  references_tool_iqubes?: string[];
  supported_interfaces?: IQubeSupportedInterfaces;
}

/**
 * Hand-curated profile map for the five canonical runtime aigents.
 * Each entry is the v0.1 portrait. Sources of truth:
 * - id ←→ RUNTIME_AGENT_IDS (orchestra)
 * - description / role ←→ codexes/packs/metame/items/AIGENT_TRINITY_Z_C_ME.md
 *   and the in-code comments where the aigent is registered.
 *
 * When the fast-follow promotes aigents into a DB table, this map
 * becomes the seed migration.
 */
const PROFILES: Record<(typeof RUNTIME_AGENT_IDS)[number], AigentProfile> = {
  'aigent-me': {
    id: 'aigent-me',
    display_name: 'Aigent Me',
    description:
      'Personalised sovereign aigent — the user-facing surface of the metaMe trinity. '
      + 'Routes intent across specialists, mediates persona-bound disclosure, and emits NBE plans.',
    role: 'orchestrator',
    references_tool_iqubes: [
      'tool_owned_content_scan',
      'tool_web_search',
    ],
    supported_interfaces: {
      runtime_url: 'https://dev-beta.aigentz.me/runtime',
      api_catalog: 'https://dev-beta.aigentz.me/api/aa/v1/runtime',
    },
  },
  'aigent-marketa': {
    id: 'aigent-marketa',
    display_name: 'Marketa',
    description:
      'Cartridge-level specialist for marketing, partner activation, and campaign ops. '
      + 'Uses multiple ToolQubes to draft campaigns, score cohorts, and emit send pipelines.',
    role: 'specialist',
    references_tool_iqubes: [
      'tool_web_search',
      'tool_owned_content_scan',
    ],
    supported_interfaces: {
      runtime_url: 'https://dev-beta.aigentz.me/marketa',
      api_catalog: 'https://dev-beta.aigentz.me/api/marketa',
    },
  },
  'aigent-kn0w1': {
    id: 'aigent-kn0w1',
    display_name: 'Kn0w1',
    description:
      'Qriptopian editorial specialist — long-form research, scroll authoring, '
      + 'lore continuity, and canon stewardship.',
    role: 'specialist',
    supported_interfaces: {
      runtime_url: 'https://dev-beta.aigentz.me/triad/embed/codex/qripto',
    },
  },
  'aigent-moneypenny': {
    id: 'aigent-moneypenny',
    display_name: 'Aigent MoneyPenny',
    description:
      'Finance + wallet specialist — Q¢ ledger reads, KNYT balance queries, '
      + 'fiat/crypto purchase flows, and reward attribution.',
    role: 'specialist',
    supported_interfaces: {
      runtime_url: 'https://dev-beta.aigentz.me/wallet',
      api_catalog: 'https://dev-beta.aigentz.me/api/wallet',
    },
  },
  'aigent-nakamoto': {
    id: 'aigent-nakamoto',
    display_name: 'Aigent Nakamoto',
    description:
      'Investor + Satoshi-era franchise specialist — KNYT investor lane, '
      + '21 Sats Guild allocations, and franchise PoA mediation.',
    role: 'specialist',
    supported_interfaces: {
      runtime_url: 'https://dev-beta.aigentz.me/triad/embed/codex/knyt',
    },
  },
};

function profileToSource(profile: AigentProfile): LegibilitySource {
  return {
    iqube_id: profile.id,
    name: profile.display_name,
    description: profile.description,
    primitive_type: 'AigentQube',
    raw_lifecycle_state: 'canonized',
    visibility_state: 'public',
    gating: ['open'],
    private_payload_available: false,
    creator_identity_state: 'identifiable',
    owner_identity_state: 'identifiable',
    title: profile.display_name,
    summary: profile.description,
    tags: ['aigent', profile.role, ...(profile.references_tool_iqubes ? ['uses-tools'] : [])],
    canonicalized_at: undefined,
    supported_interfaces: profile.supported_interfaces,
    // The references_tool_iqubes list is carried separately into
    // the catalog entry's relations bag in fast-follow; for v0.1
    // the relationship is implicit via the description.
  };
}

export function getAigentQubeSource(iqubeId: string): LegibilitySource | null {
  const id = iqubeId as (typeof RUNTIME_AGENT_IDS)[number];
  const profile = PROFILES[id];
  if (!profile) return null;
  return profileToSource(profile);
}

export function listAigentQubeSources(): LegibilitySource[] {
  return RUNTIME_AGENT_IDS
    .map((id) => PROFILES[id])
    .filter((p): p is AigentProfile => !!p)
    .map(profileToSource);
}
