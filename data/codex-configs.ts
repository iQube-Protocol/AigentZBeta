/**
 * Codex Configuration Definitions
 *
 * This file contains the default codex configurations for the multi-codex system.
 * These definitions serve as fallbacks when the database is unavailable or during initial setup.
 *
 * BACKWARD COMPATIBILITY:
 *
 * KNYT Codex Integration:
 * - Scrolls Tab: Uses /api/admin/codex/status?series=metaKnyts (existing Qriptopian API)
 * - Characters Tab: Uses /api/codex/knyt-cards (existing Qriptopian API)
 * - Lore Tab: Uses /api/content/assets?kinds=background_lore_doc,twenty_one_sats_concept
 * - Compatible with Qriptopian hooks: useCodexEpisodes, useCodexCharacters, useCodexLore
 *
 * Qripto Codex Integration:
 * - Features Tab: Integrates Qriptopian home page content
 *   - Hero Articles: /api/content/section/home-hero
 *   - Latest News: /api/content/section/latest-news
 *   - Second Hero: /api/content/section/second-hero
 * - PennyDrops Tab: Uses /api/content/section/pennydrops
 * - Scrolls Tab: Uses /api/content/section/scrolls
 * - Kn0wdZ Tab: Uses /api/content/section/21knowdz
 * - Compatible with existing Supabase content structure and Liquid UI system
 *
 * Living Canon (21 Sats) branch model:
 *   canon        – canonical spine; Codex-authoritative; on-chain (Autodrive)
 *   community    – broad participation layer; Supabase-hosted; Cartridge-surfaced
 *   correspondent – elevated reporting layer; Supabase-hosted; editorially featured
 *
 * Interim cartridge/codex interpretation (per PRD Appendix A1):
 *   KNYT_CODEX menu entry = cartridge-level entry surface
 *   inner 'Codex' tab    = codex layer (secure canonical authority)
 *   'Macro' / outer layer = cartridge framework
 */

import type { CodexConfig } from '@/types/codex';
import type { RuntimeTakeoverConfig } from '@/types/runtimeTakeover';

// =============================================================================
// RUNTIME TAKEOVER CONFIGS
// Reference implementations for each cartridge.
// Attach via CodexConfig.runtimeTakeover.
// =============================================================================

export const KNYT_RUNTIME_TAKEOVER: RuntimeTakeoverConfig = {
  enabled: true,
  priority: 1,
  cartridgeSlug: 'knyt-codex',
  displayName: 'KNYT World',
  contentScope: {
    types: ['smart-content', 'experience', 'codex'],
    cartridgeSlugs: ['knyt-codex', 'qripto-codex', 'agentiq-os'],
    maxCapsules: 12,
    pinHero: true,
  },
  experienceMatrix: {
    axes: [
      {
        id: 'patronage',
        label: 'Patronage Stage',
        stages: ['Outside Order', 'Apprentice', 'Knight', 'Esquire', 'Sennight', 'Satoshi'],
        stateField: 'patronage_stage',
      },
      {
        id: 'pcs',
        label: 'PCS Stage',
        stages: ['Participant', 'Community', 'Correspondent', 'Operator', 'Creator', 'Upstream'],
        stateField: 'pcs_stage',
      },
    ],
  },
  signalTargets: [
    { action: 'view',        endpoint: '/api/runtime/takeover/signal',             triggersReInference: false },
    { action: 'like',        endpoint: '/api/codex/knyt/living-canon/like',        triggersReInference: false },
    { action: 'spark',       endpoint: '/api/codex/knyt/living-canon/spark',       triggersReInference: false },
    { action: 'curate',      endpoint: '/api/codex/knyt/living-canon/curate',      triggersReInference: true  },
    { action: 'vote',        endpoint: '/api/codex/knyt/living-canon/vote',        triggersReInference: true  },
    { action: 'remix',       endpoint: '/api/codex/knyt/living-canon/remix',       triggersReInference: true  },
    { action: 'contribute',  endpoint: '/api/codex/knyt/living-canon/contribute',  triggersReInference: true  },
  ],
  inference: {
    agentPersona: 'aigent-kn0w1',
    domain: 'metaKnyts',
    stateFields: [
      'journey_stage',
      'patronage_stage',
      'pcs_stage',
      'signal_counts',
      'knyt_balance',
      'nbe',
      'recent_participation',
      'active_elections',
    ],
    stateEndpoint: '/api/runtime/knyt-state',
    promptConstraints:
      'Select content that matches the user\'s current stage on both axes. ' +
      'Favour content that advances them toward the next stage unlock. ' +
      'If an active NBE plan exists, include at least one capsule that fulfils it. ' +
      'Include at least one Qriptopian SmartContent or ExperienceQube per manifest ' +
      'to surface cross-world context. Keep the welcome narrative under 40 words.',
    welcomeVariants: {
      onArrival: 'Welcome back to the KNYT World.',
      onToggle:  'Switching to your KNYT Runtime view.',
      onReturn:  'Welcome back — here\'s where you left off.',
    },
    maxTokens: 500,
    nbaTargetMix: {
      experiencesAndArticles: 40,
      storeTab:               30,
      otherTabs:              30,
    },
  },
  manifestTtlMinutes: 30,
};

export const QRIPTO_RUNTIME_TAKEOVER: RuntimeTakeoverConfig = {
  enabled: true,
  priority: 2,
  cartridgeSlug: 'qripto-codex',
  displayName: 'Qriptopian World',
  contentScope: {
    types: ['smart-content', 'experience', 'codex'],
    cartridgeSlugs: ['qripto-codex', 'knyt-codex'],
    maxCapsules: 12,
    pinHero: true,
  },
  experienceMatrix: {
    axes: [
      {
        id: 'journey',
        label: 'Journey Stage',
        stages: ['prospect', 'acolyte', 'keta', 'keji', 'first', 'zero'],
        stateField: 'journey_stage',
      },
    ],
  },
  signalTargets: [],
  inference: {
    agentPersona: 'aigent-kn0w1',
    domain: 'qriptopian',
    stateFields: ['journey_stage', 'signal_counts', 'qc_balance', 'nbe', 'recent_participation'],
    stateEndpoint: '/api/runtime/knyt-state',
    promptConstraints:
      'Select content rooted in the Qriptopian world. ' +
      'Surface at least one KNYT cross-world capsule. ' +
      'Keep the welcome narrative under 40 words.',
    maxTokens: 500,
    nbaTargetMix: {
      experiencesAndArticles: 40,
      storeTab:               30,
      otherTabs:              30,
    },
  },
  manifestTtlMinutes: 30,
};

export const AGENTIQ_OS_RUNTIME_TAKEOVER: RuntimeTakeoverConfig = {
  enabled: true,
  priority: 3,
  cartridgeSlug: 'agentiq-os',
  displayName: 'AgentiQ OS',
  contentScope: {
    types: ['smart-content', 'experience', 'codex'],
    cartridgeSlugs: ['agentiq-os', 'knyt-codex', 'qripto-codex'],
    maxCapsules: 12,
    pinHero: true,
  },
  experienceMatrix: {
    axes: [
      {
        id: 'journey',
        label: 'Journey Stage',
        stages: ['prospect', 'acolyte', 'keta', 'keji', 'first', 'zero'],
        stateField: 'journey_stage',
      },
    ],
  },
  signalTargets: [],
  inference: {
    agentPersona: 'aigent-kn0w1',
    domain: 'metaKnyts',
    stateFields: ['journey_stage', 'signal_counts', 'qc_balance', 'nbe', 'persona_badges'],
    stateEndpoint: '/api/runtime/knyt-state',
    promptConstraints:
      'Select content that helps the developer persona build and progress. ' +
      'Include at least one AgentiQ OS ExperienceQube. ' +
      'Keep the welcome narrative under 40 words.',
    maxTokens: 500,
  },
  manifestTtlMinutes: 30,
};

// metaMe default takeover — fires when no cartridge-specific takeover is active.
// Draws from all cartridges, considers cross-cartridge journey history.
// Priority 10 = lowest; always yields to a cartridge-specific config.
export const METAME_RUNTIME_TAKEOVER: RuntimeTakeoverConfig = {
  enabled: true,
  priority: 10,
  cartridgeSlug: 'metame-codex',
  displayName: 'metaMe',
  contentScope: {
    types: ['smart-content', 'experience', 'codex'],
    cartridgeSlugs: ['knyt-codex', 'qripto-codex', 'agentiq-os', 'metame-codex'],
    maxCapsules: 12,
    pinHero: true,
  },
  experienceMatrix: {
    axes: [
      {
        id: 'journey',
        label: 'Journey Stage',
        stages: ['prospect', 'acolyte', 'keta', 'keji', 'first', 'zero'],
        stateField: 'journey_stage',
      },
    ],
  },
  signalTargets: [],
  inference: {
    agentPersona: 'aigent-kn0w1',
    domain: 'metaKnyts',
    stateFields: [
      'journey_stage', 'patronage_stage', 'pcs_stage',
      'signal_counts', 'knyt_balance', 'qc_balance',
      'nbe', 'recent_participation', 'persona_badges',
    ],
    stateEndpoint: '/api/runtime/knyt-state',
    promptConstraints:
      'This is the default metaMe runtime. Select a balanced mix of content ' +
      'across all worlds relevant to this user\'s journey. ' +
      'Keep the welcome narrative under 40 words.',
    maxTokens: 500,
  },
  manifestTtlMinutes: 30,
};

// =============================================================================
// LIVING CANON BRANCH CONFIG
// Cartridge-level branch definition for 21 Sats.
// One active canonical community world at launch.
// =============================================================================

export interface LivingCanonBranchConfig {
  /** Unique world identifier */
  worldId: string;
  /** Human-readable world name */
  worldName: string;
  /** Whether this world is publicly active */
  active: boolean;
  /** Canon branch — Codex-authoritative */
  canon: {
    label: string;
    dataSource: string;
  };
  /** Community branch — broad participation, Supabase-hosted */
  community: {
    label: string;
    dataSource: string;
    submissionSchemaEndpoint: string;
    electionConfigEndpoint: string;
  };
  /** Correspondent branch — elevated, editorially surfaced */
  correspondent: {
    label: string;
    dataSource: string;
    submissionSchemaEndpoint: string;
    requiredEntitlement: string;
  };
}

/** One active canonical community world for v1 launch */
export const KNYT_LIVING_CANON: LivingCanonBranchConfig = {
  worldId: '21sats',
  worldName: '21 Sats',
  active: true,
  canon: {
    label: 'Canon',
    dataSource: '/api/codex/knyt/living-canon/canon',
  },
  community: {
    label: 'Community',
    dataSource: '/api/codex/knyt/living-canon/community',
    submissionSchemaEndpoint: '/api/codex/knyt/living-canon/schemas',
    electionConfigEndpoint: '/api/codex/knyt/living-canon/elections',
  },
  correspondent: {
    label: 'Correspondent',
    dataSource: '/api/codex/knyt/living-canon/correspondent',
    submissionSchemaEndpoint: '/api/codex/knyt/living-canon/schemas?branch=correspondent',
    requiredEntitlement: 'knyt:correspondent',
  },
};

export const KNYT_CODEX: CodexConfig = {
  id: 'knyt-codex',
  name: 'KNYT Cartridge',
  slug: 'knyt-codex',
  enabled: true,
  version: '1.0.0',
  owner: 'aigent-kn0w1',
  metadata: {
    description: 'KNYT Protocol knowledge base, lore, and world-building',
    icon: 'BookOpen',
    color: 'purple',
    category: 'protocol',
    tags: ['knyt', 'protocol', 'lore', 'world-building']
  },
  tabGroups: [
    { id: 'codex',       label: 'Codex',  icon: 'BookOpen',    order: 0 },
    { id: 'store',       label: 'Store',  icon: 'ShoppingBag', order: 1 },
    { id: 'order-group', label: 'Order',  icon: 'Shield',      order: 3 },
    { id: 'admin',       label: 'Admin',  icon: 'Settings',    order: 5, adminOnly: true },
    { id: 'docs',        label: 'Docs',   icon: 'FileText',    order: 6, adminOnly: true },
  ],
  tabs: [
    // ── Codex group ────────────────────────────────────────────
    {
      id: 'scrolls',
      label: 'Scrolls',
      slug: 'scrolls',
      enabled: true,
      group: 'codex',
      order: 0,
      type: 'liquid-ui',
      config: {
        liquidTemplate: 'knyt:motion_stage_v1',
        dataSource: '/api/admin/codex/status?series=metaKnyts',
      },
      metadata: {
        icon: 'Scroll',
        description: 'Episode scrolls and stories',
        badge: '13 Episodes',
        color: 'purple'
      }
    },
    {
      id: 'characters',
      label: 'Characters',
      slug: 'characters',
      enabled: true,
      group: 'codex',
      order: 1,
      type: 'liquid-ui',
      config: {
        liquidTemplate: 'knyt:dual_poster_stage_v1',
        dataSource: '/api/codex/knyt-cards',
      },
      metadata: {
        icon: 'Users',
        description: 'Character cards and profiles',
        badge: '13 Characters',
        color: 'purple'
      }
    },
    {
      id: 'lore',
      label: 'Lore',
      slug: 'lore',
      enabled: true,
      group: 'codex',
      adminOnly: true,
      order: 2,
      type: 'liquid-ui',
      config: {
        liquidTemplate: 'knyt:drawer_grid_v1',
        dataSource: '/api/content/assets?kinds=background_lore_doc,twenty_one_sats_concept',
      },
      metadata: {
        icon: 'FileText',
        description: 'World lore and background — admin access',
        color: 'purple'
      }
    },

    // ── Store group (placeholder — content TBD) ────────────────
    {
      id: 'store-episodes',
      label: 'Episodes',
      slug: 'store-episodes',
      enabled: true,
      group: 'store',
      order: 0,
      type: 'static',
      config: { component: 'KnytStoreEpisodesTab' },
      metadata: { icon: 'Film', description: 'Episode drops and collectibles', color: 'teal' }
    },
    {
      id: 'store-characters',
      label: 'KNYT Cards',
      slug: 'store-characters',
      enabled: true,
      group: 'store',
      order: 1,
      type: 'static',
      config: { component: 'KnytStoreCardsTab' },
      metadata: { icon: 'UserSquare', description: 'KNYT Cards — digital, physical, and Qripto packs', color: 'cyan' }
    },
    {
      id: 'store-bundles',
      label: 'Bundles',
      slug: 'store-bundles',
      enabled: true,
      group: 'store',
      order: 2,
      type: 'static',
      config: { component: 'KnytStoreBundlesTab' },
      metadata: { icon: 'Package', description: 'Episode bundles and Graphic Novel editions', color: 'cyan' }
    },
    {
      id: 'store-investor',
      label: 'Investor KNYT',
      slug: 'store-investor',
      enabled: true,
      group: 'store',
      order: 3,
      type: 'static',
      config: { component: 'KnytStoreInvestorTab' },
      metadata: { icon: 'Crown', description: 'Investor bundle pricing and exclusive tiers', color: 'yellow' }
    },
    {
      id: 'store-admin',
      label: 'Store Admin',
      slug: 'store-admin',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 5,
      type: 'static',
      config: { component: 'KnytStoreAdminTab' },
      metadata: { icon: 'Settings', description: 'Admin controls for store pricing and bundles', color: 'indigo' }
    },
    {
      id: 'treasury-admin',
      label: 'Treasury Admin',
      slug: 'treasury-admin',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 6,
      type: 'static',
      config: { component: 'KnytTreasuryAdminTab' },
      metadata: { icon: 'Vault', description: 'EVM treasury balances, on-chain deposit log, and $KNYT airdrop', color: 'amber' }
    },
    {
      id: 'community-content-admin',
      label: 'Community Admin',
      slug: 'community-content-admin',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 7,
      type: 'static',
      config: { component: 'KnytCommunityContentAdminTab' },
      metadata: { icon: 'Sparkles', description: 'Promotion queue and Q¢ pricing for community-generated content', color: 'violet' }
    },
    {
      id: 'tasks-rewards-admin',
      label: 'Tasks & Rewards Admin',
      slug: 'tasks-rewards-admin',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 8,
      type: 'static',
      config: { component: 'KnytTasksRewardsAdminTab' },
      metadata: { icon: 'Coins', description: 'Live CRUD over KNYT task templates + reward amounts; aggregates from crm_rewards', color: 'amber' }
    },
    {
      id: 'codex-admin',
      label: 'Codex Admin',
      slug: 'codex-admin',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 9,
      type: 'static',
      config: { component: 'KnytCodexAdminTab' },
      metadata: { icon: 'BookOpen', description: 'Canonical reference for the metaKnyt content corpus — IDs, episode_number conventions, CIDs, completeness, mismatch detector. Human + Machine views.', color: 'sky' }
    },
    {
      id: 'terra',
      label: 'Terra',
      slug: 'terra',
      enabled: true,
      order: 2,
      type: 'static',
      config: {
        component: 'TerraTab',
        dataSource: '/api/codex/knyt/terra',
        props: {},
      },
      metadata: {
        icon: 'Globe',
        description: 'metaKNYT content from Qriptopian — share to earn Herald rewards',
        color: 'green'
      }
    },

    // ── Order group ────────────────────────────────────────────
    {
      id: 'order',
      label: 'Order',
      slug: 'order',
      enabled: true,
      group: 'order-group',
      order: 0,
      type: 'liquid-ui',
      config: {
        liquidTemplate: 'knyt:quest_hud_hub_v1',
        dataSource: '/api/codex/knyt/order',
      },
      metadata: {
        icon: 'Shield',
        description: 'Order of Metaiye — progression, ascension, and reputation',
        color: 'purple'
      }
    },
    {
      id: 'treasury',
      label: 'Treasury',
      slug: 'treasury',
      enabled: true,
      group: 'order-group',
      order: 1,
      type: 'static',
      config: {
        component: 'KnytTreasuryTab',
        props: {}
      },
      metadata: {
        icon: 'Vault',
        description: 'KNYT Treasury, rewards model, Qc vs $KNYT distinction — explained plainly',
        color: 'amber'
      }
    },
    {
      id: 'runtime',
      label: 'Runtime',
      slug: 'runtime',
      enabled: true,
      group: 'order-group',
      order: 2,
      type: 'static',
      config: {
        component: 'KnytRuntimeTab',
        props: {},
      },
      metadata: {
        icon: 'Zap',
        description: 'KNYT Live Runtime Surface — reactive journey surface driven by SSE stream',
        color: 'amber',
      },
    },
    {
      id: 'shelf',
      label: 'KNYT Shelf',
      slug: 'shelf',
      enabled: true,
      group: 'order-group',
      order: 3,
      type: 'static',
      config: { component: 'KnytShelfTab' },
      metadata: {
        icon: 'Library',
        description: "Owned codex, cartridge, and provenance assets — your KNYT library",
        color: 'indigo'
      }
    },
    {
      id: 'investor',
      label: 'Investor',
      slug: 'investor',
      enabled: true,
      investorOnly: true,
      group: 'order-group',
      order: 4,
      type: 'static',
      config: { component: 'KnytInvestorDashboardTab' },
      metadata: {
        icon: 'Briefcase',
        description: 'Investor dashboard — capital events, equity, token allocations, and documents',
        color: 'emerald'
      }
    },
    {
      id: 'investments',
      label: 'Investments',
      slug: 'investments',
      enabled: true,
      adminOnly: true,
      group: 'order-group',
      order: 5,
      type: 'static',
      config: { component: 'KnytInvestmentsAdminTab' },
      metadata: {
        icon: 'ShieldCheck',
        description: 'Admin: per-investor capital events, document upload, and visibility toggle',
        color: 'amber'
      }
    },

    // ── Quests (standalone — canonical task library) ──────────
    {
      id: 'quests',
      label: 'Quests',
      slug: 'quests',
      enabled: true,
      order: 3.5,
      type: 'static',
      config: { component: 'KnytQuestsTab' },
      metadata: {
        icon: 'Crown',
        description: 'Canonical KNYT task library — Bring a Knight, Knight of Attention, Herald, and the Living Canon archetypes',
        color: 'purple'
      }
    },

    // ── 21 Sats (standalone) ───────────────────────────────────
    {
      id: 'living-canon',
      label: '21 Sats',
      slug: 'living-canon',
      enabled: true,
      order: 4,
      type: 'liquid-ui',
      config: {
        liquidTemplate: 'knyt:living_canon_v1',
        dataSource: '/api/codex/knyt/living-canon',
      },
      metadata: {
        icon: 'Layers',
        description: 'Living Canon — Canon, Community, and Correspondent branches',
        color: 'amber',
        badge: 'Active'
      }
    },

    // ── Community Generated Content (standalone) ───────────────
    {
      id: 'community-content',
      label: 'Community',
      slug: 'community-content',
      enabled: true,
      order: 5,
      type: 'static',
      config: { component: 'KnytCommunityContentTab' },
      metadata: {
        icon: 'Sparkles',
        description: 'Community-remixed articles and KNYT stories',
        color: 'violet'
      }
    },

    // ── Admin group (admin-gated) ──────────────────────────────
    {
      id: 'knyt-alpha',
      label: 'Venture Labs',
      slug: 'knyt-alpha',
      enabled: true,
      group: 'admin',
      adminOnly: true,
      order: 0,
      type: 'static',
      config: {
        component: 'KnytAlphaTab',
        props: {}
      },
      metadata: {
        icon: 'FlaskConical',
        description: 'Kn0w1-first Venture Lab α entry — alpha programme framing, Know1 guide, 8 alpha skills, AgentiQ OS primitives',
        color: 'amber'
      }
    },
    {
      id: 'knyt-wheel',
      label: 'KNYT Wheel',
      slug: 'knyt-wheel',
      enabled: true,
      group: 'admin',
      adminOnly: true,
      order: 1,
      type: 'static',
      config: { component: 'AigentMissionsBoardTab' },
      metadata: {
        icon: 'Target',
        description: 'KNYT Wheel constitutional pilot — Mythos, Ethos, and Logos participation surfaces',
        color: 'emerald',
        badge: 'Pilot'
      }
    },
    {
      id: 'experience-dashboard',
      label: 'Experience',
      slug: 'experience-dashboard',
      enabled: true,
      group: 'admin',
      adminOnly: true,
      order: 2,
      type: 'static',
      config: {
        component: 'ExperienceDashboardTab',
        props: { tenantId: 'nakamoto' }
      },
      metadata: {
        icon: 'Layers',
        description: 'Experience journey dashboard — franchise health, cohorts, NBE, guardian',
        color: 'violet'
      }
    },
    {
      id: 'investors',
      label: 'Investors',
      slug: 'investors',
      enabled: true,
      group: 'admin',
      adminOnly: true,
      order: 3,
      type: 'static',
      config: {
        component: 'InvestorDirectoryTab',
      },
      metadata: {
        icon: 'TrendingUp',
        description: 'Full investor directory — all 3,501 StartEngine / Metaiye Media investors with campaign cohort tagging, bulk sequence dispatch, and the KNYT Wheel campaign dashboard',
        color: 'amber'
      }
    },
    {
      id: 'outreach',
      label: 'Outreach',
      slug: 'outreach',
      enabled: true,
      group: 'admin',
      adminOnly: true,
      order: 4,
      type: 'static',
      config: {
        component: 'RelationshipBuilderTab',
        props: {}
      },
      metadata: {
        icon: 'Users',
        description: 'Partner and customer outreach — 18 AVL partner contacts, KS Prospects funnel, campaign composer for Marketa email dispatch',
        color: 'violet'
      }
    },

    // ── Docs tabs ──────────────────────────────────────────────
    {
      id: 'experience-pack',
      label: 'Experience Pack',
      slug: 'experience-pack',
      enabled: true,
      group: 'docs',
      adminOnly: true,
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'knyt',
          collectionId: 'col_experience_pack',
          defaultPath: 'items/KNYT_EXPERIENCE_PACK_PRD.md'
        }
      },
      metadata: {
        icon: 'BookOpen',
        description: 'KNYT Experience Pack — PRD, matrices, runtime surface spec and wireframe',
        color: 'amber'
      }
    },
    {
      id: 'wheel',
      label: 'KNYT Wheel',
      slug: 'wheel',
      enabled: true,
      group: 'docs',
      adminOnly: true,
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'knyt',
          collectionId: 'col_knyt_campaign',
          defaultPath: 'items/KNYT_CAMPAIGN_OPERATOR_BRIEF.md'
        }
      },
      metadata: {
        icon: 'Megaphone',
        description: 'KNYT Wheel — the KNYT Activation Campaign genesis bundle',
        color: 'rose'
      }
    },
  ],
  permissions: {
    view: ['*'],
    edit: ['admin', 'aigent-kn0w1'],
    admin: ['admin', 'aigent-kn0w1']
  },
  liquidUI: {
    enabled: true,
    templateId: 'knyt:drawer_grid_v1',
    defaultTemplate: 'knyt:drawer_grid_v1'
  },
  runtimeTakeover: KNYT_RUNTIME_TAKEOVER,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const QRIPTO_CODEX: CodexConfig = {
  id: 'qripto-codex',
  name: 'Qriptopian Cartridge',
  slug: 'qripto',
  enabled: true,
  version: '1.0.0',
  owner: 'qriptopian',
  metadata: {
    description: 'The Qriptopian knowledge base, features, and community',
    icon: 'Newspaper',
    color: 'indigo',
    category: 'publication',
    tags: ['qriptopian', 'news', 'features', 'community']
  },
  tabs: [
    {
      id: 'codex',
      label: 'Codex',
      slug: 'codex',
      enabled: true,
      order: 0,
      type: 'liquid-ui',
      config: {
        liquidTemplate: 'qripto-codex-home',
        dataSource: '/api/codex/qripto/home'
      },
      metadata: {
        icon: 'Home',
        description: 'Qripto Codex home and overview',
        color: 'indigo'
      }
    },
    {
      id: 'features',
      label: 'Features',
      slug: 'features',
      enabled: true,
      order: 1,
      type: 'static',
      config: {
        component: 'FeaturesTab',
        // Integrates Qriptopian home content: hero articles, latest news, second hero
        // Backward compatible with existing Supabase content structure
        // Uses APIs: /api/content/section/home-hero, /api/content/section/latest-news, /api/content/section/second-hero
      },
      metadata: {
        icon: 'Star',
        description: 'Featured articles and stories from The Qriptopian home page'
      }
    },
    {
      id: 'pennydrops',
      label: 'PennyDrops',
      slug: 'pennydrops',
      enabled: true,
      order: 2,
      type: 'dynamic',
      config: {
        component: 'PennyDropsTab',
        dataSource: '/api/codex/qripto/pennydrops'
      },
      metadata: {
        icon: 'Coins',
        description: 'MoneyPenny wisdom and insights',
        badge: 'New'
      }
    },
    {
      id: 'scrolls',
      label: 'Scrolls',
      slug: 'scrolls',
      enabled: true,
      order: 3,
      type: 'static',
      config: {
        component: 'QriptoScrollsTab'
      },
      metadata: {
        icon: 'Scroll',
        description: 'Qriptopian scrolls and archives'
      }
    },
    {
      id: 'kn0wdz',
      label: 'Kn0wdZ',
      slug: 'kn0wdz',
      enabled: true,
      order: 4,
      type: 'static',
      config: {
        component: 'Kn0wdZTab'
      },
      metadata: {
        icon: 'Brain',
        description: 'Knowledge base and learning resources'
      }
    },
    {
      id: 'rewards',
      label: 'Rewards',
      slug: 'rewards',
      enabled: true,
      order: 5,
      type: 'dynamic',
      config: {
        component: 'RewardsTab',
        dataSource: '/api/codex/qripto/rewards'
      },
      metadata: {
        icon: 'Gift',
        description: 'Community rewards and achievements'
      }
    },
    {
      id: 'qriptopia',
      label: 'Qriptopia',
      slug: 'qriptopia',
      enabled: true,
      order: 6,
      type: 'static',
      config: {
        component: 'QriptopiaTab'
      },
      metadata: {
        icon: 'Sparkles',
        description: 'The vision of Qriptopia'
      }
    },
    {
      id: 'edit',
      label: 'Edit',
      slug: 'edit',
      enabled: true,
      adminOnly: true,
      order: 7,
      type: 'static',
      config: {
        component: 'QriptopianEditTab'
      },
      metadata: {
        icon: 'FileEdit',
        description: 'Create, edit and publish articles to the Qriptopian cartridge',
        color: 'indigo'
      }
    },
    {
      id: 'admin',
      label: 'Admin',
      slug: 'admin',
      enabled: true,
      adminOnly: true,
      order: 8,
      type: 'static',
      config: {
        component: 'QriptopianAdminTab'
      },
      metadata: {
        icon: 'Settings',
        description: 'Content management admin portal',
        color: 'indigo'
      }
    }
  ],
  permissions: {
    view: ['*'],
    edit: ['qriptopian', 'aigent-z'],
    admin: ['aigent-z']
  },
  liquidUI: {
    enabled: true,
    templateId: 'qripto-codex-v1'
  },
  runtimeTakeover: QRIPTO_RUNTIME_TAKEOVER,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const AGENTIQ_CARTRIDGE: CodexConfig = {
  // Canonical single definition for the AgentiQ Codex.
  // id matches the aigency pack slug so the registry dedup keeps this config and
  // skips the auto-generated version (packRegistry skips 'aigency' directory).
  // Content sources:
  //   packId 'aigency' → codexes/packs/aigency/  (rich engineering KB: arch, knowledge, PRs, commits)
  //   packId 'agentiq' → codexes/packs/agentiq/  (build-layer docs: AgentiQ OS, Alpha Program)
  //   static components → FactoryIntakeTab, RegistrySupplyTab
  id: 'agentiq-codex',
  name: 'AgentiQ Cartridge',
  slug: 'agentiq',
  enabled: true,
  version: '1.0.0',
  owner: 'aigent-z',
  metadata: {
    description: 'AgentiQ engineering KB: architecture, knowledge, decisions, PR history, OS builder docs, and registry tooling',
    icon: 'Brain',
    color: 'blue',
    category: 'cartridge',
    tags: ['agentiq', 'cartridge', 'platform', 'decisions', 'pr-briefs', 'architecture', 'knowledge']
  },
  tabs: [
    // ─── aigency pack — canonical engineering KB ──────────────────────────
    {
      id: 'start',
      label: 'Start Here',
      slug: 'start',
      enabled: true,
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'aigency',
          collectionId: 'col_start_here',
          defaultPath: 'items/00_START_HERE.md'
        }
      },
      metadata: {
        icon: 'Home',
        description: 'Codex orientation and navigation guide',
        color: 'blue'
      }
    },
    {
      id: 'architecture',
      label: 'Architecture',
      slug: 'architecture',
      enabled: true,
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'aigency',
          collectionId: 'col_architecture'
        }
      },
      metadata: {
        icon: 'Layers',
        description: 'System architecture: topology, data/identity, payments, protocols'
      }
    },
    {
      id: 'codebase',
      label: 'Codebase',
      slug: 'codebase',
      enabled: true,
      order: 2,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'aigency',
          collectionId: 'col_codebase'
        }
      },
      metadata: {
        icon: 'Code',
        description: 'Repo map, modules, conventions, release tracks'
      }
    },
    {
      id: 'knowledge',
      label: 'Knowledge',
      slug: 'knowledge',
      enabled: true,
      order: 3,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'aigency',
          collectionId: 'col_knowledge'
        }
      },
      metadata: {
        icon: 'BookMarked',
        description: 'API reference, schemas, docs, snippets, DVN, ICP, identity, operators manual'
      }
    },
    {
      id: 'decisions',
      label: 'Decisions',
      slug: 'decisions',
      enabled: true,
      order: 4,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'aigency',
          collectionId: 'col_decisions'
        }
      },
      metadata: {
        icon: 'GitBranch',
        description: 'Decision briefs, backlog, work allocation'
      }
    },
    {
      id: 'changelog',
      label: 'Changelog',
      slug: 'changelog',
      enabled: true,
      order: 5,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'aigency',
          collectionId: 'col_changelog'
        }
      },
      metadata: {
        icon: 'GitCommit',
        description: 'Release history and changelog'
      }
    },
    {
      id: 'pr-briefs',
      label: 'PR Briefs',
      slug: 'pr-briefs',
      enabled: true,
      order: 6,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'aigency',
          collectionId: 'col_pr_briefs'
        }
      },
      metadata: {
        icon: 'FileText',
        description: 'PR summaries and impact (PR-78 through PR-1)'
      }
    },
    {
      id: 'recent-commits',
      label: 'Recent Commits',
      slug: 'recent-commits',
      enabled: true,
      order: 7,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'aigency',
          collectionId: 'col_recent_commits'
        }
      },
      metadata: {
        icon: 'GitBranch',
        description: 'Latest direct-push commits with context'
      }
    },
    // ─── Venture Lab α group — build-layer docs ───────────────────────────
    // All three tabs live together: Venture Lab α (planning corpus), AgentiQ α
    // (platform build programme), AgentiQ OS (builder layer).
    {
      id: 'agentiq-knyt',
      label: 'Venture Lab α',
      slug: 'agentiq-knyt',
      enabled: true,
      adminOnly: true,
      order: 8,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'alpha-knyt',
          collectionId: 'col_venture_lab',
          defaultPath: 'items/01-alpha-program-positioning.md'
        }
      },
      metadata: {
        icon: 'Zap',
        description: 'Venture Lab α — planning corpus, KNYT live cartridge programme, AgentiQ OS engine, and Qriptopian support layer.',
        color: 'amber'
      }
    },
    {
      id: 'alpha-program',
      label: 'AgentiQ α',
      slug: 'alpha-program',
      enabled: true,
      adminOnly: true,
      order: 9,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'agentiq',
          collectionId: 'col_alpha_program',
          defaultPath: 'items/ALPHA_PROGRAM_OVERVIEW.md'
        }
      },
      metadata: {
        icon: 'Rocket',
        description: 'Alpha launch program — architecture, build plan, asset map',
        color: 'amber'
      }
    },
    {
      id: 'agentiq-os',
      label: 'AgentiQ OS α',
      slug: 'agentiq-os',
      enabled: true,
      adminOnly: true,
      order: 10,
      type: 'static',
      config: {
        component: 'AgentiQOSTab',
        props: {}
      },
      metadata: {
        icon: 'Code',
        description: 'AgentiQ OS — live builder substrate dashboard: agent registry, skill catalog, factory pipeline, contribution types',
        color: 'green'
      }
    },
    {
      id: 'updates',
      label: 'Updates',
      slug: 'updates',
      enabled: true,
      order: 11,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'agentiq',
          collectionId: 'col_updates'
        }
      },
      metadata: {
        icon: 'Sparkles',
        description: 'Latest cartridge updates'
      }
    },
    {
      id: 'retrieval-index',
      label: 'Retrieval Index',
      slug: 'retrieval-index',
      enabled: true,
      order: 12,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'agentiq',
          collectionId: 'col_retrieval_index'
        }
      },
      metadata: {
        icon: 'BookMarked',
        description: 'Index schema and lookup'
      }
    },
    // ─── static component tabs — Phase C ─────────────────────────────────
    {
      id: 'factory-intake',
      label: 'Factory',
      slug: 'factory-intake',
      enabled: true,
      adminOnly: true,
      order: 13,
      type: 'static',
      config: {
        component: 'FactoryIntakeTab',
        props: {}
      },
      metadata: {
        icon: 'Factory',
        description: 'Registry Ingestion Factory — track intake submissions through the full pipeline',
        color: 'amber'
      }
    },
    {
      id: 'registry-supply',
      label: 'Registry',
      slug: 'registry-supply',
      enabled: true,
      order: 14,
      type: 'static',
      config: {
        component: 'RegistrySupplyTab',
        props: {}
      },
      metadata: {
        icon: 'Database',
        description: 'Registry supply — browse all published assets by trust band and class',
        color: 'emerald'
      }
    },
    {
      id: 'operators-manual',
      label: 'Operators',
      slug: 'operators-manual',
      enabled: true,
      adminOnly: true,
      order: 15,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'agentiq',
          collectionId: 'col_operators'
        }
      },
      metadata: {
        icon: 'BookOpen',
        description: 'Operators manual — trust scoring, pipeline reference, Aigent roster',
        color: 'slate'
      }
    }
  ],
  permissions: {
    view: ['*'],
    edit: ['aigent-z'],
    admin: ['aigent-z']
  },
  liquidUI: {
    enabled: true,
    templateId: 'agentiq-cartridge-v1'
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// ─── AgentiQ OS Cartridge — public developer onboarding surface ──────────────
// Separate from AGENTIQ_CARTRIDGE (private engineering KB for Aigent Z).
// This cartridge is developer-facing, grounded in codexes/packs/agentiq-os/,
// and served by Aigent C-OS (aigent-c-os persona, agentiq-os chat route).
export const AGENTIQ_OS_CARTRIDGE: CodexConfig = {
  id: 'agentiq-os-cartridge',
  name: 'AgentiQ OS',
  slug: 'agentiq-os',
  enabled: true,
  version: '0.1.0',
  owner: 'system',
  metadata: {
    description: 'Developer onboarding and reference for AgentiQ OS — protocols, SDK, runtime, studio, registry, and bounded delegation',
    icon: 'Brain',
    color: 'green',
    category: 'cartridge',
    tags: ['agentiq-os', 'developer', 'sdk', 'open-source', 'protocols', 'delegation'],
  },
  tabGroups: [
    { id: 'home',      label: 'Home',      icon: 'Home',     order: 0 },
    { id: 'docs',      label: 'Docs',      icon: 'BookOpen', order: 1 },
    { id: 'build',     label: 'Build',     icon: 'Code',     order: 2 },
    { id: 'bind',      label: 'Bind',      icon: 'Link',     order: 3 },
    { id: 'deploy',    label: 'Deploy',    icon: 'Rocket',   order: 4 },
    { id: 'missions',  label: 'Missions',  icon: 'Target',   order: 5 },
    { id: 'community', label: 'Community', icon: 'Users',    order: 6 },
  ],
  tabs: [
    // ── Home group ─────────────────────────────────────────────
    {
      id: 'agentiq-os-start-here',
      label: 'Start Here',
      slug: 'start-here',
      enabled: true,
      group: 'home',
      order: 0,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_start_here' } },
      metadata: { icon: 'BookOpen', description: 'Get oriented to AgentiQ OS' },
    },
    {
      id: 'agentiq-os-aigent-c',
      label: 'Aigent C',
      slug: 'aigent-c',
      enabled: true,
      group: 'home',
      order: 1,
      type: 'static',
      config: { component: 'AigentCOSTab', props: {} },
      metadata: { icon: 'Bot', description: 'Your grounded onboarding copilot' },
    },

    // ── Docs group ─────────────────────────────────────────────
    {
      id: 'agentiq-os-docs-kb',
      label: 'Docs / KB',
      slug: 'docs-kb',
      enabled: true,
      group: 'docs',
      order: 0,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_docs_kb' } },
      metadata: { icon: 'BookOpen', description: 'Protocol reference, identity sovereignty, dev standards' },
    },

    // ── Build group ────────────────────────────────────────────
    {
      id: 'agentiq-os-sdk-api',
      label: 'SDK / API',
      slug: 'sdk-api',
      enabled: true,
      group: 'build',
      order: 0,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_sdk_api' } },
      metadata: { icon: 'Code', description: 'AgentiQ SDK install, init, and API reference' },
    },
    {
      id: 'agentiq-os-smarttriad',
      label: 'SmartTriad',
      slug: 'smarttriad',
      enabled: true,
      group: 'build',
      order: 1,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_smarttriad' } },
      metadata: { icon: 'Layers', description: 'SmartTriad menu and drawer primitives' },
    },
    {
      id: 'agentiq-os-liquid-ui',
      label: 'Liquid UI',
      slug: 'liquid-ui',
      enabled: true,
      group: 'build',
      order: 2,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_liquid_ui' } },
      metadata: { icon: 'Sparkles', description: 'Liquid UI templates and motion patterns' },
    },
    {
      id: 'agentiq-os-runtime-ref',
      label: 'Runtime Ref',
      slug: 'runtime-ref',
      enabled: true,
      group: 'build',
      order: 3,
      type: 'static',
      config: { component: 'RefRuntimeTab', props: {} },
      metadata: { icon: 'Zap', description: 'Reference runtime patterns' },
    },
    {
      id: 'agentiq-os-studio-ref',
      label: 'Studio Ref',
      slug: 'studio-ref',
      enabled: true,
      group: 'build',
      order: 4,
      type: 'static',
      config: { component: 'RefStudioTab', props: {} },
      metadata: { icon: 'Wrench', description: 'Reference studio composer patterns' },
    },
    {
      id: 'agentiq-os-aigent-ref',
      label: 'Aigent Ref',
      slug: 'aigent-ref',
      enabled: true,
      group: 'build',
      order: 5,
      type: 'static',
      config: { component: 'RefAigentTab', props: {} },
      metadata: { icon: 'Shield', description: 'Bounded delegation reference and demo' },
    },

    // ── Bind group ─────────────────────────────────────────────
    {
      id: 'agentiq-os-persona',
      label: 'Persona',
      slug: 'persona',
      enabled: true,
      group: 'bind',
      order: 0,
      type: 'static',
      config: { component: 'DevPersonaTab', props: {} },
      metadata: { icon: 'User', description: 'Create and manage your developer persona' },
    },
    {
      id: 'agentiq-os-delegation',
      label: 'Aigent Delegates',
      slug: 'delegation',
      enabled: true,
      group: 'bind',
      order: 1,
      type: 'static',
      config: { component: 'BoundedDelegationTab', props: {} },
      metadata: { icon: 'Shield', description: 'Grant bounded authority to Aigent C with audit logs' },
    },

    // ── Deploy group ───────────────────────────────────────────
    {
      id: 'agentiq-os-ingestion-factory',
      label: 'Ingestion Factory',
      slug: 'ingestion-factory',
      enabled: true,
      group: 'deploy',
      order: 0,
      type: 'static',
      config: { component: 'DevRegistryTab', props: {} },
      metadata: { icon: 'Box', description: 'Type-aware iQube registration' },
    },
    {
      id: 'agentiq-os-build-dashboard',
      label: 'Build Dashboard',
      slug: 'build-dashboard',
      enabled: true,
      group: 'deploy',
      order: 1,
      type: 'static',
      config: { component: 'AgentiQOSTab', props: {} },
      metadata: { icon: 'LayoutDashboard', description: 'Builder substrate dashboard' },
    },
    {
      id: 'agentiq-os-nanos-bridge',
      label: 'nanOS Bridge',
      slug: 'nanos-bridge',
      enabled: true,
      group: 'deploy',
      order: 2,
      type: 'static',
      config: { component: 'NanOSBridgeTab', props: {} },
      metadata: { icon: 'Network', description: 'Open and proprietary nanOS bridge' },
    },
    {
      id: 'agentiq-os-codex',
      label: 'Codex',
      slug: 'codex',
      enabled: true,
      group: 'deploy',
      order: 3,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_codex' } },
      metadata: { icon: 'BookOpen', description: 'Codex publishing and pack composition' },
    },

    // ── Missions group ─────────────────────────────────────────
    {
      id: 'agentiq-os-dev-missions',
      label: 'Dev Missions',
      slug: 'dev-missions',
      enabled: true,
      group: 'missions',
      order: 0,
      type: 'static',
      config: { component: 'DevMissionBoardTab', props: { panel: 'your-missions' } },
      metadata: { icon: 'Target', description: 'Your AgentiQ OS learning tracks' },
    },
    {
      id: 'agentiq-os-knyt-missions',
      label: 'KNYT Missions',
      slug: 'knyt-missions',
      enabled: true,
      group: 'missions',
      order: 1,
      type: 'static',
      config: { component: 'DevMissionBoardTab', props: { panel: 'knyt-reference' } },
      metadata: { icon: 'Award', description: 'KNYT Wheel — live reference cartridge' },
    },

    // ── Community group ────────────────────────────────────────
    {
      id: 'agentiq-os-dev-resources',
      label: 'Dev Resources',
      slug: 'dev-resources',
      enabled: true,
      group: 'community',
      order: 0,
      type: 'static',
      config: { component: 'Kn0wdZTab', props: {} },
      metadata: { icon: 'Users', description: 'Community resources and Kn0wdZ' },
    },
    {
      id: 'agentiq-os-updates',
      label: 'Updates',
      slug: 'updates',
      enabled: true,
      group: 'community',
      order: 1,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq', collectionId: 'col_updates' } },
      metadata: { icon: 'FileText', description: 'Platform updates and release notes' },
    },
    {
      id: 'agentiq-os-qriptopian',
      label: 'Qriptopian',
      slug: 'qriptopian',
      enabled: true,
      group: 'community',
      order: 2,
      type: 'static',
      config: { component: 'FeaturesTab', props: {} },
      metadata: { icon: 'Sparkles', description: 'Qriptopian editorial features' },
    },
  ],
  permissions: {
    view: ['*'],
    edit: ['admin'],
    admin: ['admin'],
  },
  liquidUI: { enabled: false },
  runtimeTakeover: AGENTIQ_OS_RUNTIME_TAKEOVER,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── Venture Lab α — dedicated cartridge for the 3 build-layer tabs ──────────
// Overrides the pack-loaded alpha-knyt-codex with AgentiQ α + AgentiQ OS
// tabs in addition to the Venture Lab α planning corpus.
export const VENTURE_LAB_CODEX: CodexConfig = {
  id: 'alpha-knyt-codex',
  name: 'Venture Lab α',
  slug: 'venture-lab',
  enabled: true,
  version: '1.0.0',
  owner: 'aigent-z',
  metadata: {
    description: 'Venture Lab α — planning corpus, AgentiQ OS engine, and platform build programme',
    icon: 'Zap',
    color: 'amber',
    category: 'build',
    tags: ['venture-lab', 'alpha-knyt', 'agentiq', 'build', 'planning']
  },
  tabs: [
    {
      id: 'alpha-programme',
      label: 'α Programme',
      slug: 'alpha-programme',
      enabled: true,
      adminOnly: true,
      order: 1,
      type: 'static',
      config: {
        component: 'AlphaProgrammeTab',
        props: {}
      },
      metadata: {
        icon: 'LayoutDashboard',
        description: 'Six-workstream programme overview with live progress report',
        color: 'violet'
      }
    },
    {
      id: 'agentiq-os-vl',
      label: 'AgentiQ OS α',
      slug: 'agentiq-os-vl',
      enabled: true,
      adminOnly: true,
      order: 2,
      type: 'static',
      config: {
        component: 'AgentiQOSTab',
        props: {}
      },
      metadata: {
        icon: 'Code',
        description: 'AgentiQ OS — live builder substrate dashboard: agent registry, skill catalog, factory pipeline, contribution types',
        color: 'green'
      }
    },
    {
      id: 'relationship-builder',
      label: 'Relationship Builder',
      slug: 'relationship-builder',
      enabled: true,
      adminOnly: true,
      order: 3,
      type: 'static',
      config: {
        component: 'RelationshipBuilderTab',
        props: {}
      },
      metadata: {
        icon: 'Users',
        description: 'Partner and customer outreach — AVL partner contacts, KS Prospects funnel, campaign composer, and QubeTalk agent coordination',
        color: 'violet'
      }
    },
    {
      id: 'alpha-docs',
      label: 'α Docs',
      slug: 'alpha-docs',
      enabled: true,
      adminOnly: true,
      order: 4,
      type: 'static',
      config: {
        component: 'AlphaDocsTab',
        props: {}
      },
      metadata: {
        icon: 'BookOpen',
        description: 'All planning corpora — Venture Labs α, AgentiQ α, AgentiQ OS α, and Programme α docs in one place',
        color: 'amber'
      }
    },
    {
      id: 'growth-matrix',
      label: 'Growth Matrix',
      slug: 'growth-matrix',
      enabled: true,
      adminOnly: true,
      order: 5,
      type: 'static',
      config: {
        component: 'VentureLabGrowthMatrixTab',
        props: {}
      },
      metadata: {
        icon: 'Grid3x3',
        description: 'Interactive 7×7 venture growth matrix — plot ventures by development maturity and commercialization strength',
        color: 'amber'
      }
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      slug: 'portfolio',
      enabled: true,
      adminOnly: true,
      order: 6,
      type: 'static',
      config: {
        component: 'VentureLabPortfolioTab',
        props: {}
      },
      metadata: {
        icon: 'Briefcase',
        description: 'Venture portfolio board — scorecards, council agenda, and action tracking',
        color: 'violet'
      }
    }
  ],
  permissions: {
    view: ['*'],
    edit: ['aigent-z'],
    admin: ['aigent-z']
  },
  liquidUI: {
    enabled: false
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Pull AgentiQ OS source tabs by group so the metaMe agentiqos tabs can
// expose them as 3rd-tier sub-tabs without modifying the source cartridge.
const aiqOsTabsByGroup = (groupId: string) =>
  AGENTIQ_OS_CARTRIDGE.tabs
    .filter((t) => t.group === groupId && t.enabled)
    .sort((a, b) => a.order - b.order);

export const METAME_CODEX: CodexConfig = {
  id: 'metame-codex',
  name: 'metaMe Cartridge',
  slug: 'metame',
  enabled: true,
  version: '1.0.0',
  owner: 'metame-guardian',
  metadata: {
    description: 'metaMe sovereignty layer: experience framework, progression model, PCS ladder, and next-best-pathway logic',
    icon: 'Hexagon',
    color: 'emerald',
    category: 'sovereignty',
    tags: ['metame', 'experience', 'pcs', 'sovereignty', 'progression', 'nbe']
  },
  tabGroups: [
    { id: 'aigentme',  label: 'aigentMe',      icon: 'Sparkles',   order: 0 },
    { id: 'vl',        label: 'Venture Lab',   icon: 'TrendingUp', order: 1, adminOnly: true },
    { id: 'marketa',   label: 'Marketa',       icon: 'Megaphone',  order: 2, adminOnly: true },
    { id: 'studio',    label: 'metaMe Studio', icon: 'Wand2',      order: 3, adminOnly: true },
    { id: 'agentiqos', label: 'AgentiQ OS',    icon: 'Cpu',        order: 4, adminOnly: true },
    { id: 'qriptopia', label: 'Qriptopia',     icon: 'Globe',      order: 5 },
    { id: 'admin',     label: 'Admin',         icon: 'Settings',   order: 6, adminOnly: true }
  ],
  tabs: [
    // ── aigentMe group ───────────────────────────────────────────────────────
    {
      id: 'aigent-me-welcome-classic',
      label: 'aigentMe (classic)',
      slug: 'aigent-me-classic',
      enabled: false,
      adminOnly: true,
      group: 'aigentme',
      order: 0.1,
      type: 'static',
      config: { component: 'AigentMeWelcomeTab', props: {} },
      metadata: {
        icon: 'Sparkles',
        description: 'Classic single-column aigentMe welcome (legacy, disabled)',
        color: 'violet'
      }
    },
    {
      id: 'aigent-me-welcome',
      label: 'aigentMe',
      slug: 'aigent-me',
      enabled: true,
      group: 'aigentme',
      order: 0,
      type: 'static',
      config: { component: 'AigentMeWelcomeSplitTab', props: {} },
      metadata: {
        icon: 'Sparkles',
        description: 'metaMe Personal Assistant — persistent copilot on the left, dynamic action surface on the right',
        color: 'violet'
      }
    },
    {
      id: 'aigentme-strategy',
      label: 'Strategy',
      slug: 'strategy',
      enabled: true,
      group: 'aigentme',
      order: 1,
      type: 'static',
      config: { component: 'MetaMeStrategyTab', props: {} },
      metadata: { icon: 'Layers', description: 'Strategic posture — venture + personal layer', color: 'violet' }
    },
    {
      id: 'aigentme-experience-matrix',
      label: 'Experience Matrix',
      slug: 'experience-matrix',
      enabled: true,
      group: 'aigentme',
      order: 2,
      type: 'static',
      config: { component: 'PersonalExperienceMatrixTab', props: {} },
      metadata: { icon: 'Grid3x3', description: 'Personal Experience Matrix — Sphere of Agency × Experience Maturity', color: 'violet' }
    },
    {
      id: 'aigentme-experience-alignment',
      label: 'Alignment Helper',
      slug: 'experience-alignment',
      enabled: true,
      group: 'aigentme',
      order: 3,
      type: 'static',
      config: { component: 'ExperienceAlignmentTab', props: {} },
      metadata: { icon: 'Target', description: 'Personal ExperienceGuide alignment helper — bars, repair risks, precedence', color: 'violet' }
    },
    {
      id: 'aigentme-status',
      label: 'Status',
      slug: 'status',
      enabled: true,
      group: 'aigentme',
      order: 4,
      type: 'static',
      config: { component: 'MetaMeStatusTab', props: {} },
      metadata: { icon: 'Activity', description: 'Current operational status — alignment, repair risks, recent activity', color: 'violet' }
    },
    {
      id: 'aigentme-nbe',
      label: 'NBE',
      slug: 'nbe',
      enabled: true,
      group: 'aigentme',
      order: 5,
      type: 'static',
      config: { component: 'MetaMeNbeTab', props: {} },
      metadata: { icon: 'Sparkles', description: 'Next Best Experiences — ranked actions across active cartridges', color: 'violet' }
    },
    {
      id: 'aigentme-analysis',
      label: 'Analysis',
      slug: 'analysis',
      enabled: true,
      group: 'aigentme',
      order: 6,
      type: 'static',
      config: { component: 'MetaMeAnalysisTab', props: {} },
      metadata: { icon: 'BarChart3', description: 'Pattern analysis — action types, cartridges, daily rhythm', color: 'violet' }
    },

    // ── VL group (admin-gated) ───────────────────────────────────────────────
    {
      id: 'vl-growth-matrix',
      label: 'Growth Matrix',
      slug: 'vl-growth-matrix',
      enabled: true,
      adminOnly: true,
      group: 'vl',
      order: 10,
      type: 'static',
      config: { component: 'VentureLabGrowthMatrixTab', props: {} },
      metadata: { icon: 'Grid3x3', description: 'Venture Lab growth matrix', color: 'violet' }
    },
    {
      id: 'vl-relationship-builder',
      label: 'Relationship Builder',
      slug: 'vl-relationship-builder',
      enabled: true,
      adminOnly: true,
      group: 'vl',
      order: 11,
      type: 'static',
      config: { component: 'RelationshipBuilderTab', props: {} },
      metadata: { icon: 'Users', description: 'Partner / relationship builder', color: 'violet' }
    },

    // ── Marketa group (admin-gated; Partner sub-tabs) ────────────────────────
    {
      id: 'marketa-my-campaign',
      label: 'My Campaign',
      slug: 'marketa-my-campaign',
      enabled: true,
      adminOnly: true,
      group: 'marketa',
      order: 20,
      type: 'static',
      config: { component: 'MarketaMyCampaignTab', props: {} },
      metadata: { icon: 'Megaphone', description: 'Active campaign view', color: 'violet' }
    },
    {
      id: 'marketa-propose',
      label: 'Propose',
      slug: 'marketa-propose',
      enabled: true,
      adminOnly: true,
      group: 'marketa',
      order: 21,
      type: 'static',
      config: { component: 'MarketaProposeTab', props: {} },
      metadata: { icon: 'Wand2', description: 'Propose a content pack or campaign', color: 'violet' }
    },
    {
      id: 'marketa-my-packs',
      label: 'My Packs',
      slug: 'marketa-my-packs',
      enabled: true,
      adminOnly: true,
      group: 'marketa',
      order: 22,
      type: 'static',
      config: { component: 'MarketaMyPacksTab', props: {} },
      metadata: { icon: 'Package', description: 'Your content packs', color: 'violet' }
    },
    {
      id: 'marketa-reports',
      label: 'Reports',
      slug: 'marketa-reports',
      enabled: true,
      adminOnly: true,
      group: 'marketa',
      order: 23,
      type: 'static',
      config: { component: 'MarketaMyReportsTab', props: {} },
      metadata: { icon: 'BarChart3', description: 'Campaign reports', color: 'violet' }
    },
    {
      id: 'marketa-qubetalk',
      label: 'QubeTalk',
      slug: 'marketa-qubetalk',
      enabled: true,
      adminOnly: true,
      group: 'marketa',
      order: 24,
      type: 'static',
      config: { component: 'MarketaQubeTalk', props: {} },
      metadata: { icon: 'MessageSquare', description: 'Marketa coordination channel', color: 'violet' }
    },

    // ── metaMe Studio group (admin-gated) ────────────────────────────────────
    {
      id: 'studio-composer',
      label: 'metaMe Studio',
      slug: 'studio',
      enabled: true,
      adminOnly: true,
      group: 'studio',
      order: 30,
      type: 'static',
      config: { component: 'MetaMeStudioTab', props: {} },
      metadata: { icon: 'Wand2', description: 'Build Experiences using guided templates, the Composer API and receipt pipeline.', color: 'violet' }
    },

    // ── AgentiQ OS group (admin-gated) — mirrors AgentiQ OS cartridge top groups ──
    {
      id: 'agentiqos-home',
      label: 'Home',
      slug: 'agentiqos-home',
      enabled: true,
      adminOnly: true,
      group: 'agentiqos',
      order: 40,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_start_here' } },
      metadata: { icon: 'Home', description: 'AgentiQ OS — start here', color: 'emerald' },
      subTabs: aiqOsTabsByGroup('home'),
    },
    {
      id: 'agentiqos-docs',
      label: 'Docs',
      slug: 'agentiqos-docs',
      enabled: true,
      adminOnly: true,
      group: 'agentiqos',
      order: 41,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_docs_kb' } },
      metadata: { icon: 'BookOpen', description: 'Protocol reference and developer standards', color: 'emerald' },
      subTabs: aiqOsTabsByGroup('docs'),
    },
    {
      id: 'agentiqos-build',
      label: 'Build',
      slug: 'agentiqos-build',
      enabled: true,
      adminOnly: true,
      group: 'agentiqos',
      order: 42,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_sdk_api' } },
      metadata: { icon: 'Code', description: 'SDK / API reference', color: 'emerald' },
      subTabs: aiqOsTabsByGroup('build'),
    },
    {
      id: 'agentiqos-bind',
      label: 'Bind',
      slug: 'agentiqos-bind',
      enabled: true,
      adminOnly: true,
      group: 'agentiqos',
      order: 43,
      type: 'static',
      config: { component: 'DevPersonaTab', props: {} },
      metadata: { icon: 'User', description: 'Persona and bounded delegation', color: 'emerald' },
      subTabs: aiqOsTabsByGroup('bind'),
    },
    {
      id: 'agentiqos-deploy',
      label: 'Deploy',
      slug: 'agentiqos-deploy',
      enabled: true,
      adminOnly: true,
      group: 'agentiqos',
      order: 44,
      type: 'static',
      config: { component: 'DevRegistryTab', props: {} },
      metadata: { icon: 'Package', description: 'Ingestion factory and registry', color: 'emerald' },
      subTabs: aiqOsTabsByGroup('deploy'),
    },
    {
      id: 'agentiqos-missions',
      label: 'Missions',
      slug: 'agentiqos-missions',
      enabled: true,
      adminOnly: true,
      group: 'agentiqos',
      order: 45,
      type: 'static',
      config: { component: 'DevMissionBoardTab', props: { panel: 'your-missions' } },
      metadata: { icon: 'Target', description: 'Dev missions and learning tracks', color: 'emerald' },
      subTabs: aiqOsTabsByGroup('missions'),
    },
    {
      id: 'agentiqos-community',
      label: 'Community',
      slug: 'agentiqos-community',
      enabled: true,
      adminOnly: true,
      group: 'agentiqos',
      order: 46,
      type: 'static',
      config: { component: 'Kn0wdZTab', props: {} },
      metadata: { icon: 'Users', description: 'Community resources and Kn0wdZ', color: 'emerald' },
      subTabs: aiqOsTabsByGroup('community'),
    },

    // ── Qriptopia group ──────────────────────────────────────────────────────
    {
      id: 'qriptopia-features',
      label: 'Features',
      slug: 'qriptopia-features',
      enabled: true,
      group: 'qriptopia',
      order: 50,
      type: 'static',
      config: { component: 'FeaturesTab', props: {} },
      metadata: { icon: 'Star', description: 'Qriptopian featured content', color: 'violet' }
    },
    {
      id: 'qriptopia-community',
      label: 'Community',
      slug: 'qriptopia-community',
      enabled: true,
      group: 'qriptopia',
      order: 51,
      type: 'static',
      config: {
        component: 'PlaceholderTab',
        props: { title: 'Community', description: 'Qriptopia community surface. Coming soon.' }
      },
      metadata: { icon: 'Users', description: 'Qriptopia community', color: 'violet' }
    },
    {
      id: 'qriptopia-21sats',
      label: '21 Sats',
      slug: 'qriptopia-21sats',
      enabled: true,
      group: 'qriptopia',
      order: 52,
      type: 'static',
      config: {
        component: 'PlaceholderTab',
        props: { title: '21 Sats', description: 'Bitcoin-native rewards surface. Coming soon.' }
      },
      metadata: { icon: 'Bitcoin', description: '21 Sats rewards', color: 'violet' }
    },

    // ── Admin group (admin-gated) ────────────────────────────────────────────
    {
      id: 'admin-experience-framework',
      label: 'Experience Framework',
      slug: 'experience-framework',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 60,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'metame',
          collectionId: 'col_experience_framework',
          defaultPath: 'items/METAME_EXPERIENCE_FRAMEWORK.md'
        }
      },
      metadata: {
        icon: 'Layers',
        description: 'Canonical experience framework — strategy, model, matrix, ladder, governance',
        color: 'violet'
      }
    },
    {
      id: 'admin-journey-dashboard',
      label: 'Journey Dashboard',
      slug: 'experience-dashboard',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 61,
      type: 'static',
      config: { component: 'ExperienceDashboardTab', props: { tenantId: 'metame' } },
      metadata: { icon: 'BarChart3', description: 'User journey states, progression, NBE opportunities', color: 'violet' }
    }
  ],
  permissions: {
    view: ['*'],
    edit: ['metame-guardian', 'aigent-z'],
    admin: ['metame-guardian']
  },
  liquidUI: {
    enabled: false
  },
  runtimeTakeover: METAME_RUNTIME_TAKEOVER,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const MARKETA_CARTRIDGE: CodexConfig = {
  id: 'marketa-codex',
  name: 'Marketa',
  slug: 'marketa',
  enabled: true,
  version: '1.0.0',
  owner: 'aigent-marketa',
  metadata: {
    description: 'Venture Studio Partner OS — campaign management, partner co-design, and pack publishing',
    icon: 'TrendingUp',
    color: 'rose',
    category: 'campaign',
    tags: ['marketa', 'campaign', 'partners', 'packs'],
  },
  tabGroups: [
    { id: 'admin',   label: 'Admin',   icon: 'Settings', order: 0, adminOnly: true },
    { id: 'partner', label: 'Partner', icon: 'Users',    order: 1 },
  ],
  tabs: [
    // ── Admin group ──────────────────────────────────────────────────────────
    {
      id: 'marketa-dashboard',
      label: 'Dashboard',
      slug: 'marketa-dashboard',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 0,
      type: 'static',
      config: { component: 'MarketaCampaignDashboardTab', props: {} },
      metadata: { icon: 'BarChart2', description: 'Campaign KPIs and cohort overview' },
    },
    {
      id: 'marketa-campaigns',
      label: 'Campaign Ops',
      slug: 'marketa-campaigns',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 1,
      type: 'static',
      config: { component: 'MarketaCampaignOpsTab', props: {} },
      metadata: { icon: 'Send', description: 'Campaign command centre — sequences, fire, dispatch' },
    },
    {
      id: 'marketa-launch-ops',
      label: 'Launch Ops',
      slug: 'marketa-launch-ops',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 2,
      type: 'static',
      config: { component: 'MarketaLaunchOpsTab', props: {} },
      metadata: { icon: 'Rocket', description: 'metaKnyt 30-day sprint board and readiness scoring' },
    },
    {
      id: 'marketa-partners',
      label: 'Partners',
      slug: 'marketa-partners',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 3,
      type: 'static',
      config: { component: 'MarketaPartnersAdminTab', props: {} },
      metadata: { icon: 'Users', description: 'AVL pipeline, activation actions, wave management' },
    },
    {
      id: 'marketa-approvals',
      label: 'Approval Queue',
      slug: 'marketa-approvals',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 4,
      type: 'static',
      config: { component: 'MarketaApprovalQueueTab', props: {} },
      metadata: { icon: 'CheckSquare', description: 'Review and approve partner-proposed content packs' },
    },
    {
      id: 'marketa-reports',
      label: 'Reports',
      slug: 'marketa-reports',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 5,
      type: 'static',
      config: { component: 'MarketaReportsTab', props: {} },
      metadata: { icon: 'FileText', description: 'Aggregate stats across all partners and cohorts' },
    },
    {
      id: 'marketa-publish',
      label: 'Publish',
      slug: 'marketa-publish',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 5,
      type: 'static',
      config: { component: 'MarketaPublishTab', props: {} },
      metadata: { icon: 'Send', description: 'Publish approved content packs to Qriptopian and partner channels' },
    },
    {
      id: 'marketa-qubetalk',
      label: 'QubeTalk',
      slug: 'marketa-qubetalk',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 6,
      type: 'static',
      config: { component: 'MarketaQubeTalk', props: {} },
      metadata: { icon: 'MessageSquare', description: 'Marketa agent comms channel' },
    },
    // ── Partner group ────────────────────────────────────────────────────────
    {
      id: 'my-campaign',
      label: 'My Campaign',
      slug: 'my-campaign',
      enabled: true,
      partnerOnly: true,
      group: 'partner',
      order: 0,
      type: 'static',
      config: { component: 'MarketaMyCampaignTab', props: {} },
      metadata: { icon: 'Star', description: 'Your campaign invitation and channel join flow' },
    },
    {
      id: 'propose-campaign',
      label: 'Propose Campaign',
      slug: 'propose-campaign',
      enabled: true,
      partnerOnly: true,
      group: 'partner',
      order: 1,
      type: 'static',
      config: { component: 'MarketaProposeTab', props: {} },
      metadata: { icon: 'PenTool', description: 'Build a content pack with Marketa AI' },
    },
    {
      id: 'my-packs',
      label: 'My Content Packs',
      slug: 'my-packs',
      enabled: true,
      partnerOnly: true,
      group: 'partner',
      order: 2,
      type: 'static',
      config: { component: 'MarketaMyPacksTab', props: {} },
      metadata: { icon: 'Package', description: 'Your content packs, status, and publish actions' },
    },
    {
      id: 'my-reports',
      label: 'My Reports',
      slug: 'my-reports',
      enabled: true,
      partnerOnly: true,
      group: 'partner',
      order: 3,
      type: 'static',
      config: { component: 'MarketaMyReportsTab', props: {} },
      metadata: { icon: 'TrendingUp', description: 'Your delivery and engagement stats' },
    },
    {
      id: 'partner-qubetalk',
      label: 'QubeTalk',
      slug: 'partner-qubetalk',
      enabled: true,
      partnerOnly: true,
      group: 'partner',
      order: 4,
      type: 'static',
      config: { component: 'MarketaQubeTalk', props: { scopedToPartner: true } },
      metadata: { icon: 'MessageSquare', description: 'Direct comms with Marketa agent' },
    },
  ],
  permissions: {
    view: ['*'],
    edit: ['aigent-marketa', 'admin'],
    admin: ['aigent-marketa', 'admin'],
  },
  liquidUI: { enabled: false },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const CODEX_DEFINITIONS: CodexConfig[] = [
  KNYT_CODEX,
  QRIPTO_CODEX,
  AGENTIQ_CARTRIDGE,
  AGENTIQ_OS_CARTRIDGE,
  VENTURE_LAB_CODEX,
  METAME_CODEX,
  MARKETA_CARTRIDGE,
];

export function getCodexById(id: string): CodexConfig | undefined {
  return CODEX_DEFINITIONS.find(codex => codex.id === id);
}

export function getCodexBySlug(slug: string): CodexConfig | undefined {
  return CODEX_DEFINITIONS.find(codex => codex.slug === slug);
}

export function getEnabledCodexes(): CodexConfig[] {
  return CODEX_DEFINITIONS.filter(codex => codex.enabled);
}
