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
      // CRM-investor gated — hidden from the public pill rail until the
      // persona resolves to a nakamoto_knyt_personas row. Tab component
      // also runs the same check server-side and refuses to render
      // purchase actions for non-investors (defence in depth).
      investorOnly: true,
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

    // ── Quests (sub-tab under Order — task library, canonical home) ──
    {
      id: 'quests',
      label: 'Quests',
      slug: 'quests',
      enabled: true,
      group: 'order-group',
      order: 2.5,
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

    // ── Community Generated Content (under Order — surfaces in metaMe's
    // Order of Metayé via knytOrderTabs() mirror) ──────────────────────
    {
      // Rebrand 2026-05-26: "Community" → "KNYT Pulse" per the Qriptopian
      // restructure brief. The id stays `community-content` for slug /
      // permalink stability; the user-visible label and route slug both
      // move to "pulse". The deeper 21 Sats voting handoff nuance lands
      // separately — see codexes/packs/agentiq/updates/
      // 2026-05-26_knyt-pulse-21sats-handoff-backlog.md.
      id: 'community-content',
      label: 'KNYT Pulse',
      slug: 'pulse',
      enabled: true,
      group: 'order-group',
      order: 6,
      type: 'static',
      config: { component: 'KnytCommunityContentTab' },
      metadata: {
        icon: 'Radio',
        description: 'KNYT Pulse — community-remixed articles and KNYT stories',
        color: 'violet'
      }
    },

    // Admin under Order — KNYT cartridge owns the inclusion logic
    // natively. The mirror in metaMe (`knytOrderTabs()`) picks this up
    // automatically, so the same Admin sub-menu appears inside metaMe's
    // Order of Metayé tier-3 nav without any metaMe-side wiring.
    //
    // Per-cartridge gate: only personas listed as admins of KNYT in CRM
    // see this tab (via cartridgeFlags.adminCartridges from the spine).
    // Global uber/platform admins satisfy the gate too. The cloned
    // subTabs inherit the same gate as defense in depth.
    {
      id: 'order-admin',
      label: 'Admin',
      slug: 'order-admin',
      enabled: true,
      adminOfCartridge: 'knyt-codex',
      group: 'order-group',
      order: 7,
      type: 'static',
      config: { component: 'TabRendererFallback', props: {} },
      metadata: {
        icon: 'Settings',
        description: 'KNYT admin surface — visible only to KNYT cartridge admins',
        color: 'indigo'
      },
      // Reference the same admin tab definitions used by the standalone
      // KNYT Admin tabGroup — but clone with adminOnly dropped and the
      // per-cartridge gate applied so tenant-admins (not just global
      // uber-admins) see them.
      get subTabs() {
        // Lazy getter — KNYT_CODEX.tabs isn't fully constructed when
        // this object literal evaluates inside the same tabs array.
        // Reading via a getter defers until KNYT_CODEX is complete.
        return KNYT_CODEX.tabs
          .filter((t) => t.group === 'admin' && t.enabled)
          .sort((a, b) => a.order - b.order)
          .map((t) => ({
            ...t,
            id: `order-admin-${t.id}`,
            slug: `order-admin-${t.slug}`,
            adminOnly: false,
            adminOfCartridge: 'knyt-codex',
            group: 'order-group',
          }));
      },
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
        description: 'Partner and customer outreach — 18 MVL partner contacts, KS Prospects funnel, campaign composer for Marketa email dispatch',
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
  version: '2.0.0',
  owner: 'qriptopian',
  metadata: {
    description: 'The Qriptopian knowledge base, features, and community',
    icon: 'Newspaper',
    color: 'indigo',
    category: 'publication',
    tags: ['qriptopian', 'news', 'features', 'community']
  },
  // ─── 2026-05-26 restructure ────────────────────────────────────────────────
  // Five top-level menu items per the agreed brief:
  //   1. Codex          — canonical, finished content (Magazines · Papers · Polity)
  //   2. Live Magazine  — works-in-progress, community-evolving editorial
  //   3. Store          — Premium Content + Affiliates and Partners
  //   4. Qriptopia      — Community (21 Sats cluster mirror) · Qriptopian Pulse · PCS Ladder
  //   5. Admin          — first-class, admin-gated (Pulse / Premium / Partners /
  //                       Polity / Magazine and Codex admin views)
  // The deeper KNYT Pulse ↔ 21 Sats handoff nuance is backlogged separately —
  // see codexes/packs/agentiq/updates/2026-05-26_knyt-pulse-21sats-handoff-backlog.md.
  tabGroups: [
    { id: 'web',           label: 'qriptopia.com', icon: 'Globe',     order: -1, iconOnly: true },
    { id: 'codex',         label: 'Codex',         icon: 'BookOpen',  order: 0 },
    { id: 'live-magazine', label: 'Live Magazine', icon: 'Newspaper', order: 1 },
    { id: 'store',         label: 'Store',         icon: 'ShoppingBag', order: 2 },
    { id: 'qriptopia',     label: 'Qriptopia',     icon: 'Sparkles',  order: 3 },
    { id: 'admin',         label: 'Admin',         icon: 'Settings',  order: 4, adminOnly: true },
  ],
  tabs: [
    // ── web group (qriptopia.com embed) ───────────────────────────────────
    // First-class persistent tab that renders qriptopia.com inside an
    // iframe. Mirrors the metaMe cartridge's metame.com tab pattern (same
    // iconOnly group chip, same IframeTab component, no activation
    // gating).
    //
    // Hard constraint: qriptopia.com must permit framing from the
    // embedding host. If the page renders blank, the cause is on the
    // qriptopia.com server config (X-Frame-Options / CSP
    // frame-ancestors) — not on this tab.
    {
      id: 'qriptopia-web-embed',
      label: 'qriptopia.com',
      slug: 'qriptopia-web',
      enabled: true,
      group: 'web',
      order: 0,
      type: 'static',
      config: {
        component: 'IframeTab',
        props: { src: 'https://qriptopia.com', title: 'qriptopia.com' },
      },
      metadata: {
        icon: 'Globe',
        description: 'qriptopia.com website embedded inside the cartridge',
        color: 'sky',
      },
    },
    // ── Codex group — canonical / finished content ─────────────────────────
    {
      // Existing 'codex' tab kept verbatim, relabelled "Magazines" and re-homed.
      // The current issue-number toggle stays exactly as it functions today;
      // it now scopes to "canonical magazine editions" rather than acting as
      // a global cartridge filter.
      id: 'codex',
      label: 'Magazines',
      slug: 'magazines',
      enabled: true,
      group: 'codex',
      order: 0,
      type: 'liquid-ui',
      config: {
        liquidTemplate: 'qripto-codex-home',
        dataSource: '/api/codex/qripto/home'
      },
      metadata: {
        icon: 'BookOpen',
        description: 'Canonical Qriptopian magazine editions',
        color: 'indigo'
      }
    },
    {
      id: 'papers',
      label: 'Papers',
      slug: 'papers',
      enabled: true,
      group: 'codex',
      order: 1,
      type: 'static',
      config: {
        component: 'QriptoPapersTab',
        props: {
          group: 'papers',
        },
      },
      metadata: {
        icon: 'FileText',
        description: 'Codex-grade white papers — Polity and Qriptopian series',
        color: 'indigo'
      }
    },
    {
      id: 'polity',
      label: 'Polity',
      slug: 'polity',
      enabled: true,
      group: 'codex',
      order: 2,
      type: 'static',
      config: {
        component: 'PlaceholderTab',
        props: {
          title: 'Polity',
          description: 'The Qriptopian Polity — governance, principles, and the steward circle. Content surface coming soon.',
        },
      },
      metadata: {
        icon: 'Landmark',
        description: 'Qriptopian Polity — governance and principles',
        color: 'indigo'
      }
    },

    // ── Live Magazine group — works-in-progress editorial ──────────────────
    {
      id: 'features',
      label: 'Features',
      slug: 'features',
      enabled: true,
      group: 'live-magazine',
      order: 0,
      type: 'static',
      config: {
        component: 'FeaturesTab',
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
      group: 'live-magazine',
      order: 1,
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
      group: 'live-magazine',
      order: 2,
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
      group: 'live-magazine',
      order: 3,
      type: 'static',
      config: {
        component: 'Kn0wdZTab'
      },
      metadata: {
        icon: 'Brain',
        description: 'Knowledge base and learning resources'
      }
    },

    // ── Store group ────────────────────────────────────────────────────────
    {
      id: 'premium-content',
      label: 'Premium Content',
      slug: 'premium-content',
      enabled: true,
      group: 'store',
      order: 0,
      type: 'static',
      config: {
        component: 'PlaceholderTab',
        props: {
          title: 'Premium Content',
          description: 'Gated Qriptopian content. Entitlement pattern mirrors metaKnyts in the KNYT cartridge. First premium pieces coming soon.',
        },
      },
      metadata: {
        icon: 'Lock',
        description: 'Gated Qriptopian premium content',
        color: 'indigo'
      }
    },
    {
      // KNYT promoted to its own top-level Store sub-tab per the v3.1
      // refinement (was previously nested inside Affiliates & Partners).
      // Renders the canonical KnytStoreBundlesTab directly — no host
      // wrapper needed.
      id: 'store-knyt',
      label: 'KNYT',
      slug: 'knyt',
      enabled: true,
      group: 'store',
      order: 1,
      type: 'static',
      config: {
        component: 'KnytStoreBundlesTab'
      },
      metadata: {
        icon: 'Layers',
        description: 'KNYT episode and card bundles available to the Qriptopian audience',
        color: 'violet'
      }
    },
    {
      id: 'partners-affiliates',
      label: 'Affiliates & Partners',
      slug: 'partners-affiliates',
      enabled: true,
      group: 'store',
      order: 2,
      type: 'static',
      config: {
        component: 'PlaceholderTab',
        props: {
          title: 'Affiliates & Partners',
          description: 'Future partner offerings will surface here alongside KNYT (now its own sub-tab). Roster managed via Admin › Partners Admin.',
        },
      },
      metadata: {
        icon: 'Handshake',
        description: 'Cross-cartridge partner offerings — future partners',
        color: 'indigo'
      }
    },

    // ── Qriptopia group — community surfaces ──────────────────────────────
    // Order per v3.1: Features → Qriptopian Pulse → Community Correspondent
    // → PCS Ladder. Features is the same component as Live Magazine ›
    // Features (component re-use); it surfaces here too so the Qriptopia
    // group travels cleanly when mirrored into the metaMe cartridge.
    {
      id: 'qriptopia-features',
      label: 'Features',
      slug: 'qriptopia-features',
      enabled: true,
      group: 'qriptopia',
      order: 0,
      type: 'static',
      config: {
        component: 'FeaturesTab',
      },
      metadata: {
        icon: 'Star',
        description: 'Featured articles — same as Live Magazine › Features, repeated in Qriptopia for cross-cartridge travel',
        color: 'indigo'
      }
    },
    {
      id: 'pulse',
      label: 'Qriptopian Pulse',
      slug: 'pulse',
      enabled: true,
      group: 'qriptopia',
      order: 1,
      type: 'static',
      config: {
        // Live wiring: renders the existing KnytCommunityContentTab
        // with cartridge='qripto' so the list endpoint scopes to
        // Qriptopian rows only. Notes published from myCanvas › New
        // Ideas with destination=Qriptopian Pulse appear here.
        component: 'QriptoPulseTab'
      },
      metadata: {
        icon: 'Radio',
        description: 'Qriptopian publishing surface — community contributions',
        color: 'indigo'
      }
    },
    {
      id: 'community-correspondent',
      label: 'Community Correspondent',
      slug: 'community-correspondent',
      enabled: true,
      group: 'qriptopia',
      order: 2,
      type: 'static',
      config: {
        // QriptoCommunityCorrespondentTab renders the three-pill structure
        // (Canon · Community · Correspondent) mirroring the KNYT 21 Sats
        // Living Canon cluster, but scoped to Qriptopian Pulse content.
        // Real data pipe lands when the cartridge-parameterized Living
        // Canon refactor + Qriptopian Pulse publish wiring ships (see
        // codexes/packs/agentiq/updates/
        // 2026-05-26_qriptopian-pulse-wiring-and-moderation-backlog.md).
        component: 'QriptoCommunityCorrespondentTab'
      },
      metadata: {
        icon: 'Megaphone',
        description: 'Canon / Community / Correspondent — Qriptopian voting and curation',
        color: 'indigo'
      }
    },
    {
      id: 'pcs-ladder',
      label: 'PCS Ladder',
      slug: 'pcs-ladder',
      enabled: true,
      group: 'qriptopia',
      order: 3,
      type: 'static',
      config: {
        component: 'PlaceholderTab',
        props: {
          title: 'PCS Ladder',
          description: 'Progressive Creative Sovereignty Ladder — tracks the user\'s tasks completed in the Polity, badges earned, and ladder rungs achieved. Clones the KNYT Order tab pattern, Polity-progress-flavoured.',
        },
      },
      metadata: {
        icon: 'TrendingUp',
        description: 'Progressive Creative Sovereignty progression',
        color: 'indigo'
      }
    },
    {
      // Replicated admin surface inside Qriptopia per operator request —
      // 5th tab, admin-gated. Renders the canonical Qriptopian content
      // management view (QriptopianAdminTab) so admins working inside
      // the Qriptopia user-facing area can reach moderation without
      // context-switching to the standalone Admin group. Non-admins
      // don't see this tab.
      id: 'qriptopia-admin',
      label: 'Admin',
      slug: 'qriptopia-admin',
      enabled: true,
      adminOnly: true,
      group: 'qriptopia',
      order: 4,
      type: 'static',
      config: { component: 'QriptopianAdminTab' },
      metadata: {
        icon: 'Settings',
        description: 'Qriptopian admin shortcut — same surface as Admin › Magazine and Codex',
        color: 'indigo'
      }
    },

    // ── Admin group — first-class, admin-gated ────────────────────────────
    // Order per v3.1 refinement: Magazine and Codex Admin first (existing
    // QriptopianAdminTab — anchors the admin surface for backwards
    // continuity), then Pulse Admin (with moderation duties — see backlog),
    // then Premium, Partners, Polity, Edit.
    // Admin sub-tab labels intentionally drop the word "Admin" — every
    // tab in this group is admin-only, so the suffix is redundant. Per
    // operator: "for all these Admin sub tabs we can remove the word
    // Admin as its redundant being they are all admin sub menu items".
    {
      id: 'admin-magazine-codex',
      label: 'Magazine and Codex',
      slug: 'admin-magazine-codex',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 0,
      type: 'static',
      config: {
        component: 'QriptopianAdminTab'
      },
      metadata: {
        icon: 'Settings',
        description: 'Magazine and Codex content management',
        color: 'indigo'
      }
    },
    {
      id: 'admin-pulse',
      label: 'Pulse',
      slug: 'admin-pulse',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 1,
      type: 'static',
      config: {
        // Live wiring — clone of KnytCommunityContentAdminTab with
        // cartridge='qripto'. Inherits Promote / Reject / Delete actions.
        // Delete is real (DELETE /api/community-content/[id], admin-gated,
        // also clears the matching publication-state mirror).
        component: 'QriptoPulseAdminTab'
      },
      metadata: { icon: 'Shield', description: 'Qriptopian Pulse moderation queue', color: 'indigo' }
    },
    {
      id: 'admin-premium',
      label: 'Premium',
      slug: 'admin-premium',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 2,
      type: 'static',
      config: {
        component: 'PlaceholderTab',
        props: {
          title: 'Premium',
          description: 'Manage gated Qriptopian content — entitlement bindings, pricing, and Q¢ rails.',
        },
      },
      metadata: { icon: 'Lock', description: 'Premium content gating administration', color: 'indigo' }
    },
    {
      id: 'admin-partners',
      label: 'Partners',
      slug: 'admin-partners',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 3,
      type: 'static',
      config: {
        component: 'PlaceholderTab',
        props: {
          title: 'Partners & Affiliates',
          description: 'Manage the partner roster surfaced in Store › Affiliates and Partners — KNYT (now its own Store sub-tab) and any future partners.',
        },
      },
      metadata: { icon: 'Handshake', description: 'Partner roster administration', color: 'indigo' }
    },
    {
      id: 'admin-polity',
      label: 'Polity',
      slug: 'admin-polity',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 4,
      type: 'static',
      config: {
        component: 'PlaceholderTab',
        props: {
          title: 'Polity',
          description: 'Rewards and PCS status ascension management — configure tasks, badges, and ladder rungs for the Polity progression.',
        },
      },
      metadata: { icon: 'Landmark', description: 'Polity rewards and PCS ascension administration', color: 'indigo' }
    },
    {
      // Edit was previously a standalone admin tab. Re-homed into the Admin
      // group so the content-authoring surface sits alongside the new admin
      // views. Component unchanged.
      id: 'edit',
      label: 'Edit',
      slug: 'edit',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 5,
      type: 'static',
      config: {
        component: 'QriptopianEditTab'
      },
      metadata: {
        icon: 'FileEdit',
        description: 'Create, edit and publish articles to the Qriptopian cartridge',
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
  tabGroups: [
    { id: 'agentz',      label: 'aigentZ',      icon: 'Cpu',      order: 0 },
    { id: 'projects',    label: 'Projects',     icon: 'Target',   order: 1, adminOnly: true },
    { id: 'development', label: 'Development',  icon: 'Code',     order: 2 },
    { id: 'memory',      label: 'Memory',       icon: 'Brain',    order: 3 },
    { id: 'registry',    label: 'Registry',     icon: 'Database', order: 4 },
    { id: 'governance',  label: 'Governance',   icon: 'Scale',    order: 5 },
    // Polity Passport replaces the former Operations menu (operator
    // decision 2026-06-12). Group is NOT adminOnly — Apply + Registry are
    // public; the Steward sub-tab carries its own adminOnly gate.
    { id: 'passport',    label: 'Polity Passport', icon: 'ShieldCheck', order: 6 },
    { id: 'ecosystem',   label: 'Ecosystem',    icon: 'Users',    order: 7 },
  ],
  tabs: [
    // ── aigentZ group (front door) ─────────────────────────────
    {
      id: 'dev-command-center',
      label: 'Command Center',
      slug: 'dev-command-center',
      enabled: true,
      group: 'agentz',
      order: 0,
      type: 'static',
      config: { component: 'DevCommandCenterTab', props: {} },
      metadata: { icon: 'Cpu', description: 'aigentZ Development Command Center — consequence engineering workflow', color: 'green' }
    },
    // Start Here lives under Development so the aigentZ group has a single
    // tab (Command Center) and the sub-menu row auto-hides — same
    // screen-space treatment as the aigentMe tab.
    {
      id: 'start',
      label: 'Start Here',
      slug: 'start',
      enabled: true,
      group: 'development',
      order: -1,
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

    // ── Projects group (Venture Lab, Alpha) ────────────────────
    {
      id: 'agentiq-knyt',
      label: 'Venture Lab α',
      slug: 'agentiq-knyt',
      enabled: true,
      adminOnly: true,
      group: 'projects',
      order: 0,
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
      // VL Admin — first-class menu item grouping the admin-only Venture Lab
      // tabs (α Programme, AgentiQ OS α, α Docs). Lazy getter: VENTURE_LAB_CODEX
      // + the mirror helper are declared later in this module.
      id: 'aiq-vl-admin',
      label: 'VL Admin',
      slug: 'vl-admin',
      enabled: true,
      adminOnly: true,
      group: 'projects',
      order: 3,
      type: 'static',
      config: { component: 'TabRendererFallback', props: {} },
      metadata: { icon: 'Settings', description: 'Venture Lab admin — α Programme, AgentiQ OS α, α Docs.', color: 'amber' },
      get subTabs() { return ventureLabAdminTabsForMetameVl(); },
    },
    {
      id: 'alpha-program',
      label: 'AgentiQ α',
      slug: 'alpha-program',
      enabled: true,
      adminOnly: true,
      group: 'projects',
      order: 1,
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
      group: 'projects',
      order: 2,
      type: 'static',
      config: {
        component: 'AgentiQOSTab',
        props: {}
      },
      metadata: {
        icon: 'Code',
        description: 'AgentiQ OS — live builder substrate dashboard',
        color: 'green'
      }
    },

    // ── Development group (architecture, codebase, commits) ────
    {
      id: 'architecture',
      label: 'Architecture',
      slug: 'architecture',
      enabled: true,
      group: 'development',
      order: 0,
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
      group: 'development',
      order: 1,
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
      id: 'changelog',
      label: 'Changelog',
      slug: 'changelog',
      enabled: true,
      group: 'development',
      order: 2,
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
      group: 'development',
      order: 3,
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
      group: 'development',
      order: 4,
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

    // ── Memory group (knowledge, decisions, updates) ───────────
    {
      id: 'knowledge',
      label: 'Knowledge',
      slug: 'knowledge',
      enabled: true,
      group: 'memory',
      order: 0,
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
      group: 'memory',
      order: 1,
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
      id: 'updates',
      label: 'Updates',
      slug: 'updates',
      enabled: true,
      group: 'memory',
      order: 2,
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
      id: 'foundation',
      label: 'Foundation',
      slug: 'foundation',
      enabled: true,
      group: 'memory',
      order: 2.1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'ccrl',
          collectionId: 'col_foundation'
        }
      },
      metadata: {
        icon: 'Layers',
        description: 'Chrysalis Foundation — Invariant Intelligence Specification Bundle (CFS-000..014)'
      }
    },
    {
      id: 'experiments',
      label: 'Experiments',
      slug: 'experiments',
      enabled: true,
      group: 'memory',
      order: 2.2,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'ccrl',
          collectionId: 'col_experiments'
        }
      },
      metadata: {
        icon: 'Target',
        description: 'Chrysalis flywheel experiments — Living KnowledgeQube + Invariant Video'
      }
    },
    {
      id: 'experiment-lab',
      label: 'Experiment Lab',
      slug: 'experiment-lab',
      enabled: true,
      adminOnly: true,
      group: 'memory',
      order: 2.3,
      type: 'static',
      config: {
        component: 'InvariantExperimentLab',
        props: {}
      },
      metadata: {
        icon: 'FlaskConical',
        description: 'Run the Foundational Validation Series (EXP-001/002/003) live — admin-only, runs spend provider credits'
      }
    },
    {
      id: 'capability-pipeline',
      label: 'Capability Pipeline',
      slug: 'capability-pipeline',
      enabled: true,
      adminOnly: true,
      group: 'memory',
      order: 2.4,
      type: 'static',
      config: {
        component: 'CapabilityPipelineTab',
        props: {}
      },
      metadata: {
        icon: 'Hammer',
        description: 'Aigent Z as development interface (CFS-015 Strand Two): state a capability goal, get the constitutionally grounded Implementation Pack — admin-only'
      }
    },
    {
      id: 'retrieval-index',
      label: 'Retrieval Index',
      slug: 'retrieval-index',
      enabled: true,
      group: 'memory',
      order: 3,
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

    // ── Registry group (factory, supply) ───────────────────────
    {
      id: 'factory-intake',
      label: 'Factory',
      slug: 'factory-intake',
      enabled: true,
      adminOnly: true,
      group: 'registry',
      order: 0,
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
      group: 'registry',
      order: 1,
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
      id: 'invariant-registry',
      label: 'Invariant Registry',
      slug: 'invariant-registry',
      enabled: true,
      group: 'registry',
      order: 2,
      type: 'static',
      config: {
        component: 'InvariantRegistryTab',
        props: {}
      },
      metadata: {
        icon: 'BookMarked',
        description: 'Browse the live invariant substrate (CFS-001..014) — namespace, status, Standing, Reach, contexts, graph edges',
        color: 'violet'
      }
    },

    // ── Governance group (Operation Chrysalis Phase 0) ────────
    {
      id: 'governance-constitution',
      label: 'Constitution',
      slug: 'governance-constitution',
      enabled: true,
      group: 'governance',
      order: 0,
      type: 'static',
      config: { component: 'GovernanceConstitutionTab', props: {} },
      metadata: { icon: 'Scale', description: 'AgentiQ Constitution of Aigents — sovereign roles, authority matrix, and constitutional principles' }
    },
    {
      id: 'governance-roles',
      label: 'Roles',
      slug: 'governance-roles',
      enabled: true,
      group: 'governance',
      order: 1,
      type: 'static',
      config: { component: 'GovernanceRolesTab', props: {} },
      metadata: { icon: 'Shield', description: 'Sovereign agent roles, authority domains, and escalation paths' }
    },
    {
      id: 'governance-decisions',
      label: 'Decision Log',
      slug: 'governance-decisions',
      enabled: true,
      group: 'governance',
      order: 2,
      type: 'static',
      config: { component: 'GovernanceDecisionLogTab', props: {} },
      metadata: { icon: 'FileText', description: 'Ratified governance decisions and constitutional amendments' }
    },
    {
      id: 'governance-authority-matrix',
      label: 'Authority Matrix',
      slug: 'governance-authority-matrix',
      enabled: true,
      group: 'governance',
      order: 3,
      type: 'static',
      config: { component: 'GovernanceAuthorityMatrixTab', props: {} },
      metadata: { icon: 'Grid3X3', description: 'Cross-reference: roles × authority domains' }
    },
    {
      id: 'governance-receipts',
      label: 'Receipts',
      slug: 'governance-receipts',
      enabled: true,
      group: 'governance',
      order: 4,
      type: 'static',
      config: { component: 'GovernanceReceiptsTab', props: {} },
      metadata: { icon: 'Receipt', description: 'DVN-anchored governance decision receipts' }
    },

    // ── Operators manual — re-homed from the retired Operations group
    // (Polity Passport took its menu slot, 2026-06-12). Stays admin-only.
    {
      id: 'operators-manual',
      label: 'Operators',
      slug: 'operators-manual',
      enabled: true,
      adminOnly: true,
      group: 'governance',
      order: 90,
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
    },

    // ── Polity Passport group — first-class mirror of the Polity
    // Passport Bureau cartridge (operator decision 2026-06-12; replaced
    // the placeholder Operations Hub). Each Bureau tabGroup becomes a
    // tab here, with lazy subTabs cloning that group's Bureau tabs so
    // sub-menus stay in lockstep with the canonical cartridge (3 levels:
    // AgentiQ → Polity Passport → Apply/Registry/Steward → sub-tabs).
    // Steward keeps its adminOnly gate at both levels. (Restored after
    // the 2026-06-12 Chrysalis merge textually relocated these tabs
    // into AGENTIQ_OS_CARTRIDGE, leaving this menu empty.)
    {
      // No subTabs getter — single-entry subTabs would block SubHeaderSlot,
      // and the tab's own badge (Citizen / Participant Application) is now
      // portaled into the tier-3 row right-justified by PassportBureauApplyTab.
      id: 'agentiq-passport-apply',
      label: 'Apply',
      slug: 'passport-apply',
      enabled: true,
      group: 'passport',
      order: 0,
      type: 'static',
      config: { component: 'PassportBureauApplyTab' },
      metadata: { icon: 'FileCheck2', description: 'Apply for a Polity Passport — anonymous citizen personhood', color: 'violet' },
    },
    {
      id: 'agentiq-passport-registry',
      label: 'Registry',
      slug: 'passport-registry',
      enabled: true,
      group: 'passport',
      order: 1,
      type: 'static',
      config: { component: 'PassportRegistryTab' },
      metadata: { icon: 'BookOpenCheck', description: 'Public record of issued passports', color: 'violet' },
    },
    {
      id: 'agentiq-passport-locker',
      label: 'Locker',
      slug: 'passport-locker',
      enabled: true,
      group: 'passport',
      order: 2,
      type: 'static',
      config: { component: 'LockerTab' },
      metadata: { icon: 'Lock', description: 'Encrypted vault for passport-related items — agent-gated access', color: 'violet' },
    },
    {
      id: 'agentiq-passport-delegation',
      label: 'Delegation',
      slug: 'passport-delegation',
      enabled: true,
      group: 'passport',
      order: 3,
      type: 'static',
      config: { component: 'BoundedDelegationTab' },
      metadata: { icon: 'Link2', description: 'Grant bounded delegations to sponsored agents — AgentKit attestation when sponsor is World ID verified', color: 'violet' },
    },
    {
      id: 'agentiq-passport-steward',
      label: 'Steward',
      slug: 'passport-steward',
      enabled: true,
      adminOnly: true,
      group: 'passport',
      order: 2,
      type: 'static',
      config: { component: 'PassportBureauStewardTab' },
      metadata: { icon: 'Gavel', description: 'Steward review queue — admin only', color: 'violet' },
      get subTabs() {
        return polityPassportTabsByGroup('steward', 'agentiq-passport-steward');
      },
    },

    // ── Ecosystem group ────────────────────────────────────────
    {
      id: 'dev-resources',
      label: 'Dev Resources',
      slug: 'dev-resources',
      enabled: true,
      group: 'ecosystem',
      order: 0,
      type: 'static',
      config: { component: 'Kn0wdZTab', props: {} },
      metadata: { icon: 'Users', description: 'Community resources and Kn0wdZ' }
    },
    {
      id: 'qriptopian',
      label: 'Qriptopian',
      slug: 'qriptopian',
      enabled: true,
      group: 'ecosystem',
      order: 1,
      type: 'static',
      config: { component: 'FeaturesTab', props: {} },
      metadata: { icon: 'Sparkles', description: 'Qriptopian editorial features' }
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
    // Operation Chrysalis target nav — constitutionally governed sovereign fulfillment system
    // aigentZ Command Center is NOT mirrored here — it lives exclusively as a
    // first-class metaMe menu item gated by the 'aigent-z' activation card.
    { id: 'projects',    label: 'Projects',     icon: 'Target',     order: 1 },
    { id: 'development', label: 'Development',  icon: 'Code',       order: 2 },
    { id: 'memory',      label: 'Memory',       icon: 'Brain',      order: 3 },
    { id: 'registry',    label: 'Registry',     icon: 'Database',   order: 4 },
    { id: 'governance',  label: 'Governance',   icon: 'Scale',      order: 5 },
    // Polity Passport replaces the (empty) Operations group — same operator
    // decision as AGENTIQ_CARTRIDGE (2026-06-12): menu between Governance
    // and Ecosystem; Apply + Registry public, Steward adminOnly on the tab.
    { id: 'passport',    label: 'Polity Passport', icon: 'ShieldCheck', order: 6 },
    { id: 'ecosystem',   label: 'Ecosystem',    icon: 'Users',      order: 7 },
  ],
  tabs: [
    {
      id: 'agentiq-os-start-here',
      label: 'Start Here',
      slug: 'start-here',
      enabled: true,
      group: 'development',
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
      group: 'development',
      order: 1,
      type: 'static',
      config: { component: 'AigentCOSTab', props: {} },
      metadata: { icon: 'Bot', description: 'Your grounded onboarding copilot' },
    },

    // ── Projects group ─────────────────────────────────────────
    {
      id: 'agentiq-os-dev-missions',
      label: 'Dev Missions',
      slug: 'dev-missions',
      enabled: true,
      group: 'projects',
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
      group: 'projects',
      order: 1,
      type: 'static',
      config: { component: 'DevMissionBoardTab', props: { panel: 'knyt-reference' } },
      metadata: { icon: 'Award', description: 'KNYT Wheel — live reference cartridge' },
    },

    // ── Development group ──────────────────────────────────────
    {
      id: 'agentiq-os-sdk-api',
      label: 'SDK / API',
      slug: 'sdk-api',
      enabled: true,
      group: 'development',
      order: 2,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_sdk_api' } },
      metadata: { icon: 'Code', description: 'AgentiQ SDK install, init, and API reference' },
    },
    {
      id: 'agentiq-os-smarttriad',
      label: 'SmartTriad',
      slug: 'smarttriad',
      enabled: true,
      group: 'development',
      order: 3,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_smarttriad' } },
      metadata: { icon: 'Layers', description: 'SmartTriad menu and drawer primitives' },
    },
    {
      id: 'agentiq-os-liquid-ui',
      label: 'Liquid UI',
      slug: 'liquid-ui',
      enabled: true,
      group: 'development',
      order: 4,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_liquid_ui' } },
      metadata: { icon: 'Sparkles', description: 'Liquid UI templates and motion patterns' },
    },
    {
      id: 'agentiq-os-runtime-ref',
      label: 'Runtime Ref',
      slug: 'runtime-ref',
      enabled: true,
      group: 'development',
      order: 5,
      type: 'static',
      config: { component: 'RefRuntimeTab', props: {} },
      metadata: { icon: 'Zap', description: 'Reference runtime patterns' },
    },
    {
      id: 'agentiq-os-studio-ref',
      label: 'Studio Ref',
      slug: 'studio-ref',
      enabled: true,
      group: 'development',
      order: 6,
      type: 'static',
      config: { component: 'RefStudioTab', props: {} },
      metadata: { icon: 'Wrench', description: 'Reference studio composer patterns' },
    },
    {
      id: 'agentiq-os-aigent-ref',
      label: 'Aigent Ref',
      slug: 'aigent-ref',
      enabled: true,
      group: 'development',
      order: 7,
      type: 'static',
      config: { component: 'RefAigentTab', props: {} },
      metadata: { icon: 'Shield', description: 'Bounded delegation reference and demo' },
    },

    // ── Memory group ───────────────────────────────────────────
    {
      id: 'agentiq-os-docs-kb',
      label: 'Docs / KB',
      slug: 'docs-kb',
      enabled: true,
      group: 'memory',
      order: 0,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_docs_kb' } },
      metadata: { icon: 'BookOpen', description: 'Protocol reference, identity sovereignty, dev standards' },
    },
    {
      id: 'agentiq-os-updates',
      label: 'Updates',
      slug: 'updates',
      enabled: true,
      group: 'memory',
      order: 1,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq', collectionId: 'col_updates' } },
      metadata: { icon: 'FileText', description: 'Platform updates and release notes' },
    },

    // ── Registry group ─────────────────────────────────────────
    {
      id: 'agentiq-os-ingestion-factory',
      label: 'Ingestion Factory',
      slug: 'ingestion-factory',
      enabled: true,
      group: 'registry',
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
      group: 'registry',
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
      group: 'registry',
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
      group: 'registry',
      order: 3,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_codex' } },
      metadata: { icon: 'BookOpen', description: 'Codex publishing and pack composition' },
    },
    {
      id: 'agentiq-os-persona',
      label: 'Persona',
      slug: 'persona',
      enabled: true,
      group: 'registry',
      order: 4,
      type: 'static',
      config: { component: 'DevPersonaTab', props: {} },
      metadata: { icon: 'User', description: 'Create and manage your developer persona' },
    },
    {
      id: 'agentiq-os-delegation',
      label: 'Aigent Delegates',
      slug: 'delegation',
      enabled: true,
      group: 'registry',
      order: 5,
      type: 'static',
      config: { component: 'BoundedDelegationTab', props: {} },
      metadata: { icon: 'Shield', description: 'Grant bounded authority to Aigent C with audit logs' },
    },

    // ── Governance group (Operation Chrysalis Phase 0) ─────────
    {
      id: 'agentiq-os-constitution',
      label: 'Constitution',
      slug: 'constitution',
      enabled: true,
      group: 'governance',
      order: 0,
      type: 'static',
      config: { component: 'GovernanceConstitutionTab', props: {} },
      metadata: { icon: 'Scale', description: 'AgentiQ Constitution of Aigents — sovereign roles, authority matrix, and constitutional principles' },
    },
    {
      id: 'agentiq-os-governance-roles',
      label: 'Roles',
      slug: 'governance-roles',
      enabled: true,
      group: 'governance',
      order: 1,
      type: 'static',
      config: { component: 'GovernanceRolesTab', props: {} },
      metadata: { icon: 'Shield', description: 'Sovereign agent roles, authority domains, and escalation paths' },
    },
    {
      id: 'agentiq-os-governance-decisions',
      label: 'Decision Log',
      slug: 'governance-decisions',
      enabled: true,
      group: 'governance',
      order: 2,
      type: 'static',
      config: { component: 'GovernanceDecisionLogTab', props: {} },
      metadata: { icon: 'FileText', description: 'Ratified governance decisions and constitutional amendments' },
    },
    {
      id: 'agentiq-os-authority-matrix',
      label: 'Authority Matrix',
      slug: 'authority-matrix',
      enabled: true,
      group: 'governance',
      order: 3,
      type: 'static',
      config: { component: 'GovernanceAuthorityMatrixTab', props: {} },
      metadata: { icon: 'Grid3X3', description: 'Cross-reference: roles × authority domains' },
    },
    {
      id: 'agentiq-os-governance-receipts',
      label: 'Receipts',
      slug: 'governance-receipts',
      enabled: true,
      group: 'governance',
      order: 4,
      type: 'static',
      config: { component: 'GovernanceReceiptsTab', props: {} },
      metadata: { icon: 'Receipt', description: 'DVN-anchored governance decision receipts' },
    },

    // ── Polity Passport group — first-class mirror of the Polity
    // Passport Bureau cartridge (operator decision 2026-06-12; replaced
    // the empty Operations group). Same pattern as AGENTIQ_CARTRIDGE:
    // lazy subTabs keep sub-menus in lockstep with the canonical
    // cartridge; Steward keeps its adminOnly gate at both levels.
    {
      id: 'agentiq-os-passport-apply',
      label: 'Apply',
      slug: 'os-passport-apply',
      enabled: true,
      group: 'passport',
      order: 0,
      type: 'static',
      config: { component: 'PassportBureauApplyTab' },
      metadata: { icon: 'FileCheck2', description: 'Apply for a Polity Passport — anonymous citizen personhood', color: 'violet' },
      // No subTabs getter — see note on agentiq-passport-apply above.
    },
    {
      id: 'agentiq-os-passport-registry',
      label: 'Registry',
      slug: 'os-passport-registry',
      enabled: true,
      group: 'passport',
      order: 1,
      type: 'static',
      config: { component: 'PassportRegistryTab' },
      metadata: { icon: 'BookOpenCheck', description: 'Public record of issued passports', color: 'violet' },
    },
    {
      id: 'agentiq-os-passport-locker',
      label: 'Locker',
      slug: 'os-passport-locker',
      enabled: true,
      group: 'passport',
      order: 2,
      type: 'static',
      config: { component: 'LockerTab' },
      metadata: { icon: 'Lock', description: 'Encrypted vault for passport-related items — agent-gated access', color: 'violet' },
    },
    {
      id: 'agentiq-os-passport-delegation',
      label: 'Delegation',
      slug: 'os-passport-delegation',
      enabled: true,
      group: 'passport',
      order: 3,
      type: 'static',
      config: { component: 'BoundedDelegationTab' },
      metadata: { icon: 'Link2', description: 'Grant bounded delegations to sponsored agents — AgentKit attestation when sponsor is World ID verified', color: 'violet' },
    },
    {
      id: 'agentiq-os-passport-steward',
      label: 'Steward',
      slug: 'os-passport-steward',
      enabled: true,
      adminOnly: true,
      group: 'passport',
      order: 2,
      type: 'static',
      config: { component: 'PassportBureauStewardTab' },
      metadata: { icon: 'Gavel', description: 'Steward review queue — admin only', color: 'violet' },
      get subTabs() {
        return polityPassportTabsByGroup('steward', 'agentiq-os-passport-steward');
      },
    },

    // ── Standing group — first-class mirror of the Standing Cartridge
    // (root-DID capability & standing ledger). Gated on the
    // 'standing-cartridge' activation via the group's activationId so it
    // only surfaces once the persona activates the surface. The
    // StandingCartridgeTab component houses the evidence domains, fact
    // review, compile, asset graph, and output generation in one surface.
    {
      id: 'metame-standing-ledger',
      label: 'Standing',
      slug: 'standing',
      enabled: true,
      group: 'standing',
      order: 0,
      type: 'static' as const,
      config: { component: 'StandingCartridgeTab', props: {} },
      metadata: { icon: 'Star', description: 'Verified Standing Profile — evidence-derived capability and reputation profile', color: 'violet' },
    },

    // ── Ecosystem group ───────────────────────────────────────
    {
      id: 'agentiq-os-dev-resources',
      label: 'Dev Resources',
      slug: 'dev-resources',
      enabled: true,
      group: 'ecosystem',
      order: 0,
      type: 'static',
      config: { component: 'Kn0wdZTab', props: {} },
      metadata: { icon: 'Users', description: 'Community resources and Kn0wdZ' },
    },
    {
      id: 'agentiq-os-qriptopian',
      label: 'Qriptopian',
      slug: 'qriptopian',
      enabled: true,
      group: 'ecosystem',
      order: 1,
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
      id: 'founder-office',
      label: 'Founder Office',
      slug: 'founder-office',
      enabled: true,
      adminOnly: false,
      order: 0,
      type: 'static',
      config: {
        component: 'FounderOfficeTab',
        props: {}
      },
      metadata: {
        icon: 'Rocket',
        description: 'Venture formation OS — Discover / Validate / Architect a venture into an executable Venture Blueprint (VentureQube v1.0)',
        color: 'amber'
      }
    },
    {
      id: 'commercial-funnel',
      label: 'Commercial Funnel',
      slug: 'commercial-funnel',
      enabled: true,
      adminOnly: false,
      order: 1,
      type: 'static',
      config: {
        component: 'VentureFunnelTab',
        props: {}
      },
      metadata: {
        icon: 'Grid3x3',
        description: 'Matrix funnel — venture progress (maturity × commercialization) consolidated with customer progress (engagement × sovereignty journey)',
        color: 'amber'
      }
    },
    {
      id: 'alpha-programme',
      label: 'α Programme',
      slug: 'alpha-programme',
      enabled: true,
      adminOnly: true,
      order: 2,
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
      adminOnly: false,
      order: 3,
      type: 'static',
      config: {
        component: 'RelationshipBuilderTab',
        props: {}
      },
      metadata: {
        icon: 'Users',
        description: 'Partner and customer outreach — MVL partner contacts, KS Prospects funnel, campaign composer, and QubeTalk agent coordination',
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
      id: 'plan-pricing',
      label: 'Plan Pricing',
      slug: 'plan-pricing',
      enabled: true,
      adminOnly: true,
      order: 4.5,
      type: 'static',
      config: {
        component: 'PlanPriceConfigAdminTab',
        props: {}
      },
      metadata: {
        icon: 'DollarSign',
        description: 'Plan price editor (mirror of canonical metaMe Admin → Plan Pricing) — view and update tier prices for the Polity Alpha citizen and Founder Office ladders',
        color: 'amber'
      }
    },
    {
      id: 'growth-matrix',
      label: 'Growth Matrix',
      slug: 'growth-matrix',
      enabled: true,
      adminOnly: false,
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
      adminOnly: false,
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

// Pull Polity Passport Bureau tabs by group so AGENTIQ_CARTRIDGE's
// Polity Passport menu can expose them as sub-tabs without modifying the
// canonical Bureau cartridge. Function declaration (hoisted) because
// AGENTIQ_CARTRIDGE is defined before POLITY_PASSPORT_BUREAU_CARTRIDGE;
// the lazy `get subTabs()` callers only run at render time. adminOnly
// gates are preserved on the clones (Steward stays admin-gated).
function polityPassportTabsByGroup(groupId: string, idPrefix: string) {
  return POLITY_PASSPORT_BUREAU_CARTRIDGE.tabs
    .filter((t) => t.group === groupId && t.enabled)
    .sort((a, b) => a.order - b.order)
    .map((t) => ({
      ...t,
      id: `${idPrefix}-${t.id}`,
      slug: `${idPrefix}-${t.slug}`,
      group: 'passport',
    }));
}

// Pull AgentiQ OS source tabs by group so the metaMe agentiqos tabs can
// expose them as 3rd-tier sub-tabs without modifying the source cartridge.
const aiqOsTabsByGroup = (groupId: string) =>
  AGENTIQ_OS_CARTRIDGE.tabs
    .filter((t) => t.group === groupId && t.enabled)
    .sort((a, b) => a.order - b.order);

// Pull KNYT codex Order-group tabs so metaMe can mirror the "Order of Metayé"
// active surface without modifying the KNYT cartridge source. Same pattern
// as aiqOsTabsByGroup.
const knytOrderTabs = () =>
  KNYT_CODEX.tabs
    .filter((t) => t.group === 'order-group' && t.enabled)
    .sort((a, b) => a.order - b.order);

// (knytAdminTabsForMetameOrder removed 2026-05-26 — admin is now a
// native sub-item under KNYT's Order group via the order-admin tab,
// so the existing knytOrderTabs() mirror flows it through into metaMe
// automatically. The per-cartridge admin gate stays — it's set on the
// order-admin tab inside KNYT, not in the metaMe mirror.)

// Mirror the OPERATOR-facing Venture Lab cartridge tabs into metaMe's "Venture
// Lab" (vl) group as first-class items (Founder Office, Commercial Funnel,
// Relationship Builder, Growth Matrix, Portfolio — anything not adminOnly).
// Admin-only VL tabs are grouped separately under the VL Admin item via
// ventureLabAdminTabsForMetameVl(). Same mirror pattern as aiqOsTabsByGroup.
const ventureLabTabsForMetameVl = () =>
  VENTURE_LAB_CODEX.tabs
    .filter((t) => t.enabled && !t.adminOnly)
    .sort((a, b) => a.order - b.order)
    .map((t, i) => ({
      ...t,
      id: `vl-${t.id}`,
      slug: `vl-${t.slug}`,
      group: 'vl',
      order: 10 + i,
    }));

// Qriptopian admin tabs mirrored into metaMe's qriptopia group. Qripto's
// admin tabs live at top level (no group), gated by adminOnly: true. We
// filter on adminOnly === true to pick them up. Same clone pattern as
// the KNYT mirror — drop adminOnly, set adminOfCartridge gate, prefix
// slug to avoid collision in metaMe's namespace.
const qriptoAdminTabsForMetameQriptopia = () =>
  QRIPTO_CODEX.tabs
    .filter((t) => t.adminOnly === true && t.enabled && !t.group)
    .sort((a, b) => a.order - b.order)
    .map((t) => ({
      ...t,
      id: `metame-qripto-admin-${t.id}`,
      slug: `qripto-admin-${t.slug}`,
      adminOnly: false,
      adminOfCartridge: 'qripto',
      group: 'qriptopia',
    }));

// Qriptopian Codex group (Magazines, Papers, Polity, …) mirrored into
// metaMe's qriptopia surface so the metaMe view stays in sync with the
// canonical Qripto cartridge. Without this, metaMe shows only the
// stub Features / Community / 21 Sats tabs and the operator has to
// jump cartridges to read a paper. Slug-prefixed to avoid namespace
// collision; order rebased so they appear before the existing stubs.
const qriptoCodexTabsForMetameQriptopia = () =>
  QRIPTO_CODEX.tabs
    .filter((t) => t.group === 'codex' && t.enabled)
    .sort((a, b) => a.order - b.order)
    .map((t, idx) => ({
      ...t,
      id: `metame-qripto-codex-${t.id}`,
      slug: `qripto-codex-${t.slug}`,
      group: 'qriptopia',
      order: 40 + idx, // Sits ABOVE Features (50), Community (51), 21 Sats (52)
    }));

// AgentiQ OS operations tabs mirrored into metaMe's agentiqos group.
// Pulls from the AgentiQ OS cartridge's `operations` tabGroup — currently
// a single stub PlaceholderTab; real content lands in Phase 1. Same
// clone pattern as the KNYT mirror.
const agentiqOsAdminTabsForMetameAgentiqos = () =>
  AGENTIQ_OS_CARTRIDGE.tabs
    .filter((t) => t.group === 'operations' && t.enabled)
    .sort((a, b) => a.order - b.order)
    .map((t) => ({
      ...t,
      id: `metame-aiqos-ops-${t.id}`,
      slug: `aiqos-ops-${t.slug}`,
      adminOnly: false,
      adminOfCartridge: 'agentiq-os',
      group: 'agentiqos',
    }));

// Venture Lab α currently has no top-level "Admin" tab — every tab on
// the cartridge is adminOnly already. To keep the metaMe activation
// surface consistent with the protocol (every cartridge with admin
// content exposes it inside its metaMe activation group when the
// persona is admin of that cartridge), we synthesise a single
// placeholder "VL Admin" entry for now. When VL grows a proper
// adminOnly tabGroup like KNYT's, swap this stub for the same clone
// pattern used above.
// Mirror the ADMIN-only Venture Lab cartridge tabs (α Programme, AgentiQ OS α,
// α Docs) as sub-items grouped under the "VL Admin" surface — used both by
// metaMe's VL group and the AgentiQ cartridge's VL Admin tab. adminOnly is
// preserved so the gating travels with each tab.
const ventureLabAdminTabsForMetameVl = () =>
  VENTURE_LAB_CODEX.tabs
    .filter((t) => t.enabled && t.adminOnly)
    .sort((a, b) => a.order - b.order)
    .map((t, i) => ({
      ...t,
      id: `vl-admin-${t.id}`,
      slug: `vl-admin-${t.slug}`,
      group: 'vl',
      order: i,
    }));

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
    { id: 'web',          label: 'metame.com',       icon: 'Globe',      order: -1,  iconOnly: true },
    { id: 'aigentme',     label: 'aigentMe',         icon: 'Sparkles',   order: 0 },
    { id: 'mycluster',    label: 'myCluster',        icon: 'PenSquare',  order: 0.5, activationId: 'mycanvas' },
    { id: 'activations',  label: 'Activations',      icon: 'Zap',        order: 0.6 },
    { id: 'order',        label: 'KNYT',             icon: 'Shield',     order: 0.7, activationId: 'order-of-metaye' },
    { id: 'agentz',       label: 'aigentZ',          icon: 'Cpu',        order: 0.8, activationId: 'aigent-z' },
    { id: 'vl',           label: 'Venture Lab',      icon: 'TrendingUp', order: 1,   activationId: 'venture-lab' },
    { id: 'marketa',      label: 'Marketa',          icon: 'Megaphone',  order: 2,   activationId: 'marketa' },
    { id: 'studio',       label: 'metaMe Studio',    icon: 'Wand2',      order: 3,   activationId: 'metame-studio' },
    { id: 'hms',          label: 'Human Mobility',   icon: 'Plane',      order: 3.5, activationId: 'human-mobility-services' },
    { id: 'polity-core',  label: 'Polity Core',      icon: 'Landmark',   order: 0.55, activationId: 'polity-core' },
    { id: 'agentiqos',    label: 'AgentiQ OS',       icon: 'Cpu',        order: 4,   activationId: 'agentiq-os' },
    { id: 'passport',     label: 'Passport',          icon: 'ShieldCheck',order: -0.5 },
    { id: 'standing',     label: 'Standing',         icon: 'Star',       order: 4.6, activationId: 'standing-cartridge' },
    { id: 'qriptopia',    label: 'Qriptopia',        icon: 'Globe',      order: 5,   activationId: 'qriptopian' },
    { id: 'admin',        label: 'Admin',            icon: 'Settings',   order: 6,   adminOnly: true },
  ],
  tabs: [
    // ── web group (metame.com embed) ─────────────────────────────────────────
    // First-class persistent tab that renders metame.com inside an iframe.
    // No label on the group chip (iconOnly: true above) — small Globe icon
    // sitting before aigentMe. Not gated by activations.
    //
    // Hard constraint: metame.com must permit framing from the embedding
    // host (no X-Frame-Options: DENY/SAMEORIGIN and no CSP
    // frame-ancestors that excludes our domain). If the page renders
    // blank, that's the cause — operator action is on the metame.com
    // server config, not on this tab.
    {
      id: 'metame-web-embed',
      label: 'metame.com',
      slug: 'metame-web',
      enabled: true,
      group: 'web',
      order: 0,
      type: 'static',
      config: {
        component: 'IframeTab',
        props: { src: 'https://metame.com', title: 'metame.com' },
      },
      metadata: {
        icon: 'Globe',
        description: 'metame.com website embedded inside the cartridge',
        color: 'sky',
      },
    },
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

    // ── Activations group (always visible) ───────────────────────────────────
    {
      id: 'activations',
      label: 'Activations',
      slug: 'activations',
      enabled: true,
      group: 'activations',
      order: 0,
      type: 'static',
      config: { component: 'ActivationsTab', props: {} },
      metadata: {
        icon: 'Zap',
        description: 'Switch on the active surfaces you want in your metaMe runtime',
        color: 'violet',
      },
    },

    // ── myCluster group (activation-gated; auto-granted) ──────────────────
    //
    // Renamed from "myArtifacts" 2026-06-01 per myCartridge PRD v0.2 — adds
    // myCartridge as a fourth sub-tab between Workspace and Ledger.
    //
    // Four sub-tabs under one group chip:
    //   myCanvas    — public-publishable experiences (articles, stories,
    //                 remixable templates). Includes the Qriptopian Agents
    //                 of Change 15-min reading-sprint seed
    //                 (exp_1773512145689_1vnt1jcnt) as a remix-from-empty
    //                 affordance.
    //   myWorkspace — private work artifacts (docs, reports, tools,
    //                 workflows, briefs). Separate kind column on the
    //                 entries table to prevent leak risk between public
    //                 + private surfaces.
    //   myCartridge — owner-side view of the user's cartridge engagement
    //                 estate. Wizard CTA when unconfigured. External-facing
    //                 summary when configured.
    //   myLedger    — the persona's personal ledger of canvas + workspace
    //                 artifacts (formerly myWorkbench's content).
    {
      id: 'mycanvas',
      label: 'myCluster',
      slug: 'mycanvas',
      enabled: true,
      activationId: 'mycanvas',
      group: 'mycluster',
      order: 0,
      type: 'static',
      config: { component: 'MyCanvasTab', props: {} },
      metadata: {
        icon: 'PenSquare',
        description: 'Personal publishing surface — articles, stories, remixable experiences',
        color: 'violet',
      },
    },
    {
      id: 'myworkspace',
      label: 'myWorkspace',
      slug: 'my-workspace',
      enabled: true,
      activationId: 'mycanvas',
      group: 'mycluster',
      order: 1,
      type: 'static',
      config: { component: 'MyWorkspaceTab', props: {} },
      metadata: {
        icon: 'Hammer',
        description: 'Private work artifacts — docs, reports, tools, workflows, briefs',
        color: 'violet',
      },
    },
    {
      id: 'mycartridge',
      label: 'myCartridge',
      slug: 'my-cartridge',
      enabled: true,
      activationId: 'mycanvas',
      group: 'mycluster',
      order: 3,
      type: 'static',
      config: { component: 'MyCartridgeTab', props: {} },
      metadata: {
        icon: 'Boxes',
        description: 'The owner-side view of your cartridge — identity, primary tab, copilot stance, wallet stance, activation requests',
        color: 'violet',
      },
    },
    {
      id: 'myledger',
      label: 'myLedger',
      slug: 'my-ledger',
      enabled: true,
      activationId: 'mycanvas',
      group: 'mycluster',
      order: 2,
      type: 'static',
      config: { component: 'MyLedgerTab', props: {} },
      metadata: {
        icon: 'BookMarked',
        description: 'Personal ledger of canvas + workspace artifacts — activity, receipts, audit',
        color: 'violet',
      },
    },

    // ── Order of Metayé group (activation-gated; auto-granted) ───────────────
    // Mirrors the KNYT codex Order group + sub-tabs via the subTabs mechanism.
    // Source KNYT cartridge is not modified.
    {
      id: 'order-of-metaye',
      label: 'KNYT',
      slug: 'order-of-metaye',
      enabled: true,
      activationId: 'order-of-metaye',
      group: 'order',
      order: 0,
      type: 'static',
      config: { component: 'TabRendererFallback', props: {} },
      metadata: {
        icon: 'Shield',
        description: 'Active surface of the KNYT world inside metaMe',
        color: 'amber',
      },
      // KNYT now owns the Admin sub-menu under its own order-group
      // (see KNYT_CODEX 'order-admin' tab). knytOrderTabs() flows it
      // through here automatically — no metaMe-side admin mirror needed
      // for KNYT. Per-cartridge gate stays at the source declaration.
      subTabs: knytOrderTabs(),
    },

    // ── VL group (activation-gated) — full mirror of the Venture Lab cartridge ──
    // Renders every first-class VL tab natively under metaMe → Venture Lab
    // (Founder Office, Commercial Funnel, α Programme, AgentiQ OS α, Relationship
    // Builder, α Docs, Growth Matrix, Portfolio). Each tab's adminOnly /
    // adminOfCartridge gating is preserved by the mirror.
    ...ventureLabTabsForMetameVl(),
    // Venture Lab admin stub — VL doesn't yet have a dedicated
    // adminOnly tabGroup on its own cartridge, so we ship a single
    // placeholder admin tab here gated by adminOfCartridge: 'venture-lab'.
    // When VL grows a proper admin surface, replace the placeholder
    // child with the same clone pattern used for KNYT / Qripto / AIQ OS.
    {
      id: 'vl-admin',
      label: 'VL Admin',
      slug: 'vl-admin',
      enabled: true,
      adminOfCartridge: 'venture-lab',
      group: 'vl',
      order: 90,
      type: 'static',
      config: { component: 'TabRendererFallback', props: {} },
      metadata: { icon: 'Settings', description: 'Venture Lab admin surface — stubbed until VL ships its own adminOnly tabGroup. Visible only when the active persona admins the Venture Lab cartridge.', color: 'amber' },
      subTabs: ventureLabAdminTabsForMetameVl(),
    },

    // ── Human Mobility group (payment-gated via activationId) ────────────────
    // Flat tabs, each a real registered component (the proven pattern — no
    // parent/ghost-subtab nesting). Group activationId gates access.
    {
      id: 'hms-services', label: 'Mobility Services', slug: 'hms', enabled: true, group: 'hms', order: 0,
      type: 'static', config: { component: 'HumanMobilityServicesTab', props: {} },
      metadata: { icon: 'Plane', description: 'Human Mobility Services — business + emergency mobility', color: 'cyan' },
    },
    {
      id: 'hms-doctrine', label: 'Doctrine', slug: 'hms-doctrine', enabled: true, group: 'hms', order: 1,
      type: 'static', config: { component: 'MobilityDoctrineTab', props: {} },
      metadata: { icon: 'BookOpen', description: 'Mobility doctrine', color: 'cyan' },
    },
    {
      id: 'hms-activations', label: 'Activations', slug: 'hms-activations', enabled: true, group: 'hms', order: 2,
      type: 'static', config: { component: 'MobilityActivationsTab', props: {} },
      metadata: { icon: 'Zap', description: 'Mobility activations', color: 'cyan' },
    },
    {
      id: 'hms-housing', label: 'Housing', slug: 'hms-housing', enabled: true, group: 'hms', order: 3,
      type: 'static', config: { component: 'MobilityWorkstreamShellTab', props: { workstream: 'housing' } },
      metadata: { icon: 'Home', description: 'Housing workstream', color: 'cyan' },
    },
    {
      id: 'hms-education', label: 'Education', slug: 'hms-education', enabled: true, group: 'hms', order: 4,
      type: 'static', config: { component: 'MobilityWorkstreamShellTab', props: { workstream: 'education' } },
      metadata: { icon: 'GraduationCap', description: 'Education workstream', color: 'cyan' },
    },
    {
      id: 'hms-relocation', label: 'Relocation', slug: 'hms-relocation', enabled: true, group: 'hms', order: 5,
      type: 'static', config: { component: 'MobilityWorkstreamShellTab', props: { workstream: 'relocation' } },
      metadata: { icon: 'Map', description: 'Relocation workstream', color: 'cyan' },
    },
    {
      id: 'hms-business', label: 'Business', slug: 'hms-business', enabled: true, group: 'hms', order: 6,
      type: 'static', config: { component: 'MobilityWorkstreamShellTab', props: { workstream: 'business' } },
      metadata: { icon: 'Briefcase', description: 'Business mobility workstream', color: 'cyan' },
    },
    {
      id: 'hms-economic', label: 'Emergency', slug: 'hms-economic', enabled: true, group: 'hms', order: 7,
      type: 'static', config: { component: 'MobilityWorkstreamShellTab', props: { workstream: 'economic' } },
      metadata: { icon: 'LifeBuoy', description: 'Emergency / economic mobility workstream', color: 'cyan' },
    },
    {
      id: 'hms-family', label: 'Family', slug: 'hms-family', enabled: true, group: 'hms', order: 8,
      type: 'static', config: { component: 'MobilityWorkstreamShellTab', props: { workstream: 'family' } },
      metadata: { icon: 'Users', description: 'Family mobility workstream', color: 'cyan' },
    },
    {
      id: 'hms-case-management', label: 'Case Management', slug: 'hms-case-management', enabled: true, group: 'hms', order: 9,
      type: 'static', config: { component: 'MobilityCaseManagementTab', props: {} },
      metadata: { icon: 'ClipboardList', description: 'Mobility case management', color: 'cyan' },
    },

    // ── Polity Core group (FREE — open activation) ───────────────────────────
    // Flat AgentiqCartridgeTab tabs per collection (real component, each with
    // its own doc sidebar). No ghost tabs.
    {
      id: 'pc-constitution', label: 'Constitution', slug: 'polity-core', enabled: true, group: 'polity-core', order: 0,
      type: 'static', config: { component: 'AgentiqCartridgeTab', props: { packId: 'polity-core', collectionId: 'col_constitution', defaultPath: 'items/CONSTITUTION.md' } },
      metadata: { icon: 'Landmark', description: 'The Polity Constitution', color: 'violet' },
    },
    {
      id: 'pc-invariant-intelligence', label: 'Invariant Intelligence', slug: 'pc-invariant-intelligence', enabled: true, group: 'polity-core', order: 0.5,
      type: 'static', config: { component: 'AgentiqCartridgeTab', props: { packId: 'polity-core', collectionId: 'col_invariant_intelligence', defaultPath: 'constitutional-records/invariant-intelligence.md' } },
      metadata: { icon: 'BookMarked', description: 'Foundational Constitutional Record — Invariant Intelligence (Chrysalis anchor)', color: 'violet' },
    },
    {
      id: 'pc-agent-charter', label: 'Agent Charter', slug: 'pc-agent-charter', enabled: true, group: 'polity-core', order: 1,
      type: 'static', config: { component: 'AgentiqCartridgeTab', props: { packId: 'polity-core', collectionId: 'col_agent_charter', defaultPath: 'items/AGENT_CHARTER.md' } },
      metadata: { icon: 'Bot', description: 'Autonomous Agent Charter', color: 'violet' },
    },
    {
      id: 'pc-standing-charter', label: 'Standing Charter', slug: 'pc-standing-charter', enabled: true, group: 'polity-core', order: 2,
      type: 'static', config: { component: 'AgentiqCartridgeTab', props: { packId: 'polity-core', collectionId: 'col_standing_charter', defaultPath: 'items/STANDING_CHARTER.md' } },
      metadata: { icon: 'Award', description: 'The Standing Charter', color: 'violet' },
    },
    {
      id: 'pc-metacommons-charter', label: 'metaCommons Charter', slug: 'pc-metacommons-charter', enabled: true, group: 'polity-core', order: 3,
      type: 'static', config: { component: 'AgentiqCartridgeTab', props: { packId: 'polity-core', collectionId: 'col_metacommons_charter', defaultPath: 'items/METACOMMONS_CHARTER.md' } },
      metadata: { icon: 'Globe', description: 'The metaCommons Charter', color: 'violet' },
    },
    {
      id: 'pc-founder-office-charter', label: 'Founder Office Charter', slug: 'pc-founder-office-charter', enabled: true, group: 'polity-core', order: 4,
      type: 'static', config: { component: 'AgentiqCartridgeTab', props: { packId: 'polity-core', collectionId: 'col_founder_office_charter', defaultPath: 'items/FOUNDER_OFFICE_CHARTER.md' } },
      metadata: { icon: 'Rocket', description: 'Founder Office Charter (sub-metaCommons)', color: 'violet' },
    },
    {
      id: 'pc-amendments', label: 'Amendment Records', slug: 'pc-amendments', enabled: true, group: 'polity-core', order: 5,
      type: 'static', config: { component: 'AgentiqCartridgeTab', props: { packId: 'polity-core', collectionId: 'col_amendment_records', defaultPath: 'items/AMENDMENT_RECORDS.md' } },
      metadata: { icon: 'FileText', description: 'Amendment Records', color: 'violet' },
    },

    // ── Marketa group (admin-gated; Partner sub-tabs) ────────────────────────
    {
      id: 'marketa-my-campaign',
      label: 'My Campaign',
      slug: 'marketa-my-campaign',
      enabled: true,
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
      group: 'marketa',
      order: 24,
      type: 'static',
      config: { component: 'MarketaQubeTalk', props: {} },
      metadata: { icon: 'MessageSquare', description: 'Marketa coordination channel', color: 'violet' }
    },
    // Chief-of-staff unlock: Marketa Admin mirrored into metaMe's
    // marketa group. metaMe's marketa group is hand-written (no pure
    // mirror), so we declare the Admin sub-tab explicitly here.
    // subTabs reuse the same helper Marketa cartridge uses internally
    // (the partner-admin definition lives inside MARKETA_CARTRIDGE) by
    // cloning admin tabGroup tabs with the per-cartridge gate.
    {
      id: 'marketa-admin',
      label: 'Admin',
      slug: 'marketa-admin',
      enabled: true,
      adminOfCartridge: 'marketa',
      group: 'marketa',
      order: 25,
      type: 'static',
      config: { component: 'TabRendererFallback', props: {} },
      metadata: { icon: 'Settings', description: 'Marketa admin surface — visible only to Marketa cartridge admins', color: 'indigo' },
      get subTabs() {
        return MARKETA_CARTRIDGE.tabs
          .filter((t) => t.group === 'admin' && t.enabled)
          .sort((a, b) => a.order - b.order)
          .map((t) => ({
            ...t,
            id: `metame-marketa-admin-${t.id}`,
            slug: `marketa-admin-${t.slug}`,
            adminOnly: false,
            adminOfCartridge: 'marketa',
            group: 'marketa',
          }));
      },
    },

    // ── metaMe Studio group (admin-gated) ────────────────────────────────────
    {
      id: 'studio-composer',
      label: 'metaMe Studio',
      slug: 'studio',
      enabled: true,
      group: 'studio',
      order: 30,
      type: 'static',
      config: { component: 'MetaMeStudioTab', props: {} },
      metadata: { icon: 'Wand2', description: 'Build Experiences using guided templates, the Composer API and receipt pipeline.', color: 'violet' }
    },
    // Studio Admin stub — metaMe Studio is the active surface for the
    // Composer Copilot / Experience Template authoring flow; it has no
    // tier-2 sub-tabs today. Adding an Admin sub-tab here makes the
    // chief-of-staff protocol consistent across every metaMe activation
    // group: admins always have an Admin entry to reach
    // configuration / governance. Stubbed via PlaceholderTab until real
    // Studio admin tooling lands (template publishing controls, bundle
    // versioning, surface plan review queues, etc.).
    {
      id: 'studio-admin',
      label: 'Studio Admin',
      slug: 'studio-admin',
      enabled: true,
      adminOfCartridge: 'metame',
      group: 'studio',
      order: 31,
      type: 'static',
      config: {
        component: 'PlaceholderTab',
        props: {
          title: 'metaMe Studio Admin',
          description: 'Studio admin surface — stub. Real admin tooling (template publishing, bundle versioning, surface-plan review) lands when the first Studio admin workflow ships.',
        },
      },
      metadata: { icon: 'Settings', description: 'metaMe Studio admin surface — visible only to metaMe cartridge admins', color: 'indigo' },
    },

    // ── aigentZ group (first-class, activation-gated) ────────────────────────
    // The Development Command Center as a top-level metaMe menu item.
    // Gated by the 'aigent-z' activation. Multiple tabs so the sub-menu row
    // renders, in line with aigentMe — additional tab content TBD.
    {
      id: 'metame-agentz-command-center',
      label: 'Command Center',
      slug: 'aigent-z',
      enabled: true,
      group: 'agentz',
      order: 0,
      type: 'static',
      config: { component: 'DevCommandCenterTab', props: {} },
      metadata: { icon: 'Cpu', description: 'aigentZ Development Command Center — consequence engineering workflow', color: 'green' },
    },
    {
      id: 'metame-agentz-sessions',
      label: 'Sessions',
      slug: 'aigent-z-sessions',
      enabled: true,
      group: 'agentz',
      order: 1,
      type: 'static',
      config: {
        component: 'PlaceholderTab',
        props: {
          title: 'aigentZ Sessions',
          description: 'Dev loop session history — stub. Persisted ICE sessions (intents, context packs, gap reports, consequence canvases, validation reports) land here when Phase 2 session persistence ships.',
        },
      },
      metadata: { icon: 'History', description: 'Dev loop session history — placeholder until Phase 2 session persistence', color: 'green' },
    },

    // ── AgentiQ OS group (admin-gated) — mirrors AgentiQ OS cartridge top groups ──
    // metaMe mirror of AgentiQ OS — Operation Chrysalis target nav.
    // No aigentZ mirror here — the Command Center is accessed exclusively via
    // the first-class metaMe aigentZ menu (agentz group, 'aigent-z' activation).
    {
      id: 'agentiqos-projects',
      label: 'Projects',
      slug: 'agentiqos-projects',
      enabled: true,
      group: 'agentiqos',
      order: 41,
      type: 'static',
      config: { component: 'DevMissionBoardTab', props: { panel: 'your-missions' } },
      metadata: { icon: 'Target', description: 'Projects and mission tracks', color: 'emerald' },
      subTabs: aiqOsTabsByGroup('projects'),
    },
    {
      id: 'agentiqos-development',
      label: 'Development',
      slug: 'agentiqos-development',
      enabled: true,
      group: 'agentiqos',
      order: 42,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_sdk_api' } },
      metadata: { icon: 'Code', description: 'SDK, SmartTriad, Liquid UI, reference patterns', color: 'emerald' },
      subTabs: aiqOsTabsByGroup('development'),
    },
    {
      id: 'agentiqos-memory',
      label: 'Memory',
      slug: 'agentiqos-memory',
      enabled: true,
      group: 'agentiqos',
      order: 43,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'agentiq-os', collectionId: 'col_docs_kb' } },
      metadata: { icon: 'Brain', description: 'Docs, KB, and platform updates', color: 'emerald' },
      subTabs: aiqOsTabsByGroup('memory'),
    },
    {
      id: 'agentiqos-registry',
      label: 'Registry',
      slug: 'agentiqos-registry',
      enabled: true,
      group: 'agentiqos',
      order: 44,
      type: 'static',
      config: { component: 'DevRegistryTab', props: {} },
      metadata: { icon: 'Database', description: 'Registry, persona, delegation, codex publishing', color: 'emerald' },
      subTabs: aiqOsTabsByGroup('registry'),
    },
    {
      id: 'agentiqos-governance',
      label: 'Governance',
      slug: 'agentiqos-governance',
      enabled: true,
      group: 'agentiqos',
      order: 45,
      type: 'static',
      config: { component: 'GovernanceConstitutionTab', props: {} },
      metadata: { icon: 'Scale', description: 'Constitution, roles, authority matrix, receipts', color: 'emerald' },
      subTabs: aiqOsTabsByGroup('governance'),
    },
    // Polity Passport — mirrored from AGENTIQ_OS_CARTRIDGE's passport group.
    // Same pattern as the other agentiqos tabs: top-level tab in the metaMe
    // agentiqos group with subTabs pulled from the source cartridge.
    {
      id: 'agentiqos-passport',
      label: 'Polity Passport',
      slug: 'agentiqos-passport',
      enabled: true,
      group: 'agentiqos',
      order: 45.5,
      type: 'static',
      config: { component: 'PassportBureauApplyTab' },
      metadata: { icon: 'ShieldCheck', description: 'Polity Passport — apply, registry, steward', color: 'violet' },
      subTabs: aiqOsTabsByGroup('passport'),
    },
    // Chief-of-staff unlock: AgentiQ OS operations tabs mirrored into
    // metaMe. Visible only to personas admin of the agentiq-os cartridge.
    {
      id: 'agentiqos-operations',
      label: 'Operations',
      slug: 'agentiqos-operations',
      enabled: true,
      adminOfCartridge: 'agentiq-os',
      group: 'agentiqos',
      order: 46,
      type: 'static',
      config: { component: 'TabRendererFallback', props: {} },
      metadata: { icon: 'Settings', description: 'AgentiQ OS operations — visible only when the active persona admins the AgentiQ OS cartridge', color: 'indigo' },
      subTabs: agentiqOsAdminTabsForMetameAgentiqos(),
    },
    {
      id: 'agentiqos-ecosystem',
      label: 'Ecosystem',
      slug: 'agentiqos-ecosystem',
      enabled: true,
      group: 'agentiqos',
      order: 47,
      type: 'static',
      config: { component: 'Kn0wdZTab', props: {} },
      metadata: { icon: 'Users', description: 'Community resources and Qriptopian', color: 'emerald' },
      subTabs: aiqOsTabsByGroup('ecosystem'),
    },

    // ── Passport group (permanently active) ──────────────────────────────────
    // Mirrors the Polity Passport Bureau cartridge tabs so the full Bureau
    // experience is available inside metaMe as a first-class tab.
    // Uses the same polityPassportTabsByGroup() clone pattern as the
    // AgentiQ / AgentiQ OS passport mirrors.
    {
      id: 'polity-passport',
      label: 'Passport',
      slug: 'polity-passport',
      enabled: true,
      group: 'passport',
      order: 0,
      type: 'static',
      config: { component: 'PassportBureauApplyTab', props: {} },
      metadata: {
        icon: 'ShieldCheck',
        description: 'Apply for an anonymous Citizen Passport — proof of personhood with self-custody privacy',
        color: 'violet',
      },
      get subTabs() {
        return polityPassportTabsByGroup('apply', 'metame-passport')
          .concat(polityPassportTabsByGroup('doctrine', 'metame-passport'))
          .concat(polityPassportTabsByGroup('registry', 'metame-passport'))
          .concat(polityPassportTabsByGroup('locker', 'metame-passport'))
          .concat(polityPassportTabsByGroup('delegation', 'metame-passport'))
          .concat(polityPassportTabsByGroup('ens', 'metame-passport'))
          .concat(polityPassportTabsByGroup('being', 'metame-passport'))
          .concat(polityPassportTabsByGroup('steward', 'metame-passport'));
      },
    },

    // ── Standing group ───────────────────────────────────────────────────────
    // First-class metaMe tab that mounts the StandingCartridgeTab component
    // (evidence intake, fact review, compile, asset graph, output generation).
    // The 'standing' group is declared in METAME_CODEX.tabGroups above; this
    // tab is what handleGroupClick resolves to when the operator clicks the
    // Standing label.
    {
      id: 'metame-standing-ledger',
      label: 'Standing',
      slug: 'standing',
      enabled: true,
      group: 'standing',
      order: 0,
      type: 'static' as const,
      config: { component: 'StandingCartridgeTab', props: {} },
      metadata: {
        icon: 'Star',
        description: 'Verified Standing Profile — evidence-derived capability and reputation profile',
        color: 'violet',
      },
    },

    // ── Qriptopia group ──────────────────────────────────────────────────────
    // Canonical Qripto Codex tabs (Magazines, Papers, Polity) are mirrored
    // in from QRIPTO_CODEX so metaMe stays in lock-step with the cartridge.
    // The mirror sits at order 40..49 so it appears BEFORE the existing
    // Features / Community / 21 Sats / Admin stubs without renumbering them.
    ...qriptoCodexTabsForMetameQriptopia(),
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
    // Chief-of-staff unlock: Qriptopian admin tabs mirrored into the
    // metaMe qriptopia group. Visible only to personas admin of the
    // qripto cartridge.
    {
      id: 'qriptopia-admin',
      label: 'Qriptopian Admin',
      slug: 'qriptopia-admin',
      enabled: true,
      adminOfCartridge: 'qripto',
      group: 'qriptopia',
      order: 53,
      type: 'static',
      config: { component: 'TabRendererFallback', props: {} },
      metadata: { icon: 'Settings', description: 'Qriptopian admin surface — visible only when the active persona admins the Qripto cartridge', color: 'indigo' },
      subTabs: qriptoAdminTabsForMetameQriptopia(),
    },

    // ── Admin group (admin-gated) ────────────────────────────────────────────
    // 2026-05-27 — Journey Dashboard surfaces first so admins land on the
    // live operational view; Experience Framework moves last as
    // canonical reference reading. Order numbers shifted accordingly.
    {
      id: 'admin-journey-dashboard',
      label: 'Journey Dashboard',
      slug: 'experience-dashboard',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 60,
      type: 'static',
      config: { component: 'ExperienceDashboardTab', props: { tenantId: 'metame' } },
      metadata: { icon: 'BarChart3', description: 'User journey states, progression, NBE opportunities', color: 'violet' }
    },
    {
      id: 'admin-access-requests',
      label: 'Access Requests',
      slug: 'access-requests',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 61,
      type: 'static',
      config: { component: 'AdminAccessRequestsTab', props: {} },
      metadata: {
        icon: 'ShieldCheck',
        description: 'Review persona-submitted cartridge access + admin requests',
        color: 'emerald'
      }
    },
    {
      id: 'admin-persona-360',
      label: 'Persona 360',
      slug: 'persona-360',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 62,
      type: 'static',
      config: { component: 'Persona360InspectorTab', props: {} },
      metadata: {
        icon: 'User',
        description: 'Look up any persona and inspect the full identity / asset graph',
        color: 'violet'
      }
    },
    {
      id: 'admin-cartridge-catalogue',
      label: 'Catalogue Requests',
      slug: 'cartridge-catalogue-requests',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 62.5,
      type: 'static',
      config: { component: 'CartridgeCatalogueAdminTab', props: {} },
      metadata: {
        icon: 'PackageCheck',
        description: 'Review persona-submitted requests to publish their cartridge to the metaMe activations catalogue',
        color: 'emerald'
      }
    },
    {
      id: 'admin-runtime-settings',
      label: 'Runtime Settings',
      slug: 'runtime-settings',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 62.8,
      type: 'static',
      config: { component: 'MetaMeRuntimeSettingsTab', props: {} },
      metadata: {
        icon: 'Zap',
        description: 'Set the default Runtime takeover context (metaMe / KNYT) — the same toggle the in-runtime ⚡ flips',
        color: 'amber'
      }
    },
    {
      id: 'admin-metame-pulse',
      label: 'Runtime Content',
      slug: 'metame-pulse',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 62.9,
      type: 'static',
      config: { component: 'MetaMePulseAdminTab', props: {} },
      metadata: {
        icon: 'Sparkles',
        description: 'Controller for what surfaces in the metaMe Runtime — approve launches, assign be/make/play/earn/share placement, and publish/unpublish/archive live content',
        color: 'emerald'
      }
    },
    {
      id: 'admin-experience-framework',
      label: 'Experience Framework',
      slug: 'experience-framework',
      enabled: true,
      group: 'admin',
      order: 63,
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
      id: 'admin-plan-pricing',
      label: 'Plan Pricing',
      slug: 'plan-pricing',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 64,
      type: 'static',
      config: { component: 'PlanPriceConfigAdminTab', props: {} },
      metadata: {
        icon: 'DollarSign',
        description: 'Canonical pricing admin — view and update tier prices for the Polity Alpha citizen and Founder Office subscription ladders. Accepted rails: Q¢ · USDC · PayPal.',
        color: 'amber'
      }
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
    // Tailwind JIT safelist for the dynamic `${accentColor}` chrome classes
    // (only generated when the literal appears in scanned source):
    // bg-pink-500/10 ring-pink-500/30 ring-pink-500/25 border-pink-500/30
    // text-pink-200 text-pink-300 text-pink-400 text-pink-400/70 text-pink-600
    // text-pink-700 border-pink-300 bg-pink-50
    color: 'pink',
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
      id: 'marketa-activation-engine',
      label: 'Activation Engine',
      slug: 'marketa-activation-engine',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 3,
      type: 'static',
      config: { component: 'MarketaActivationEngineTab', props: {} },
      metadata: { icon: 'Bot', description: 'Candidate-agent recruitment: discovery, scoring, registry/reputation/passport/outreach handoffs' },
    },
    {
      id: 'marketa-partners',
      label: 'Partners',
      slug: 'marketa-partners',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 4,
      type: 'static',
      config: { component: 'MarketaPartnersAdminTab', props: {} },
      metadata: { icon: 'Users', description: 'MVL pipeline, activation actions, wave management' },
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
    // Chief-of-staff unlock: Admin sub-menu inside the Partner group,
    // visible only to personas listed as Marketa cartridge admins
    // (cartridgeFlags.adminCartridges includes 'marketa'). Global
    // uber/platform admins satisfy the gate too. Native to Marketa
    // — any future cartridge that mirrors the Marketa partner group
    // would inherit this Admin sub-menu for free via the same
    // mechanism. Same protocol as KNYT order > Admin.
    {
      id: 'partner-admin',
      label: 'Admin',
      slug: 'partner-admin',
      enabled: true,
      adminOfCartridge: 'marketa',
      group: 'partner',
      order: 5,
      type: 'static',
      config: { component: 'TabRendererFallback', props: {} },
      metadata: {
        icon: 'Settings',
        description: 'Marketa admin surface — visible only to Marketa cartridge admins',
      },
      // Lazy getter — MARKETA_CARTRIDGE.tabs isn't fully constructed
      // when this literal evaluates. Reading via a getter defers until
      // tab.subTabs is consumed at render time.
      get subTabs() {
        return MARKETA_CARTRIDGE.tabs
          .filter((t) => t.group === 'admin' && t.enabled)
          .sort((a, b) => a.order - b.order)
          .map((t) => ({
            ...t,
            id: `partner-admin-${t.id}`,
            slug: `partner-admin-${t.slug}`,
            adminOnly: false,
            adminOfCartridge: 'marketa',
            group: 'partner',
          }));
      },
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

// ───────────────────────────────────────────────────────────────────────────
// IQUBE_REGISTRY_CARTRIDGE — Stage 1 stub (PRD v1.1 §A.1)
// Reserves the 'iqube-registry' slug as a top-level cartridge. Tabs are
// PlaceholderTab stubs; real components land in Stage 8 of the registry
// operating-plane plan. The slug is verified free of collision (Stage 0
// audit Deliverable 5). Operator confirmed standalone + deep-link from
// AgentiQ OS Registry tab.
// ───────────────────────────────────────────────────────────────────────────
export const IQUBE_REGISTRY_CARTRIDGE: CodexConfig = {
  id: 'iqube-registry-codex',
  name: 'iQube Registry',
  slug: 'iqube-registry',
  enabled: true,
  version: '0.1.0',
  owner: 'aigent-z',
  metadata: {
    description: 'Canonical orientation layer for every iQube — browse, receipts, mints, governance.',
    icon: 'Database',
    color: 'violet',
    category: 'platform',
    tags: ['registry', 'iqube', 'governance', 'dvn'],
  },
  tabGroups: [
    { id: 'browse', label: 'Browse', icon: 'Search',   order: 0 },
    { id: 'admin',  label: 'Admin',  icon: 'Settings', order: 1, adminOnly: true },
    { id: 'docs',   label: 'Docs',   icon: 'FileText', order: 2 },
  ],
  tabs: [
    {
      id: 'iqube-registry-browse',
      label: 'Browse iQubes',
      slug: 'browse',
      enabled: true,
      group: 'browse',
      order: 0,
      type: 'static',
      config: { component: 'IQubeRegistryBrowseTab' },
      metadata: { icon: 'Search', description: 'iQube discovery + filter + detail view', color: 'violet' },
    },
    {
      id: 'iqube-registry-intake',
      label: 'Intake',
      slug: 'intake',
      enabled: true,
      adminOnly: true,
      group: 'browse',
      order: 1,
      type: 'static',
      config: { component: 'IQubeRegistryIntakeTab' },
      metadata: { icon: 'Factory', description: 'Ingestion Factory — canonical intake', color: 'violet' },
    },
    {
      id: 'iqube-registry-receipts',
      label: 'DVN Receipts',
      slug: 'receipts',
      enabled: true,
      group: 'browse',
      order: 1,
      type: 'static',
      config: { component: 'IQubeRegistryReceiptsTab' },
      metadata: { icon: 'Receipt', description: 'DVN receipt audit + block analysis', color: 'violet' },
    },
    {
      id: 'iqube-registry-mints',
      label: 'Mints + Sagas',
      slug: 'mints',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 0,
      type: 'static',
      config: { component: 'IQubeRegistryMintsTab' },
      metadata: { icon: 'Hammer', description: 'Mint saga state + recovery', color: 'violet' },
    },
    {
      id: 'iqube-registry-canonization',
      label: 'Canonization Queue',
      slug: 'canonization',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 1,
      type: 'static',
      config: { component: 'IQubeRegistryCanonizationTab' },
      metadata: { icon: 'CheckCircle', description: 'Canonization governance', color: 'violet' },
    },
    {
      id: 'iqube-registry-vocabulary',
      label: 'Action Vocabulary',
      slug: 'vocabulary',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 2,
      type: 'static',
      config: { component: 'IQubeRegistryVocabularyTab' },
      metadata: { icon: 'Code2', description: 'Action vocabulary governance', color: 'violet' },
    },
    {
      id: 'iqube-registry-health',
      label: 'Registry Health',
      slug: 'health',
      enabled: true,
      adminOnly: true,
      group: 'admin',
      order: 3,
      type: 'static',
      config: { component: 'IQubeRegistryHealthTab' },
      metadata: { icon: 'Activity', description: 'Registry operational health', color: 'violet' },
    },
    {
      id: 'iqube-registry-passports',
      label: 'Passports',
      slug: 'passports',
      enabled: true,
      group: 'browse',
      order: 2,
      type: 'static',
      config: { component: 'PassportRegistryTab' },
      metadata: { icon: 'BookOpenCheck', description: 'Public Polity Passport registry — issued citizen + participant passports', color: 'violet' },
    },
    {
      id: 'iqube-registry-invariants',
      label: 'Invariants',
      slug: 'invariants',
      enabled: true,
      group: 'browse',
      order: 3,
      type: 'static',
      config: { component: 'InvariantRegistryTab' },
      metadata: {
        icon: 'BookMarked',
        description:
          'The constitutional substrate (CFS-001..014) — namespace/status/Standing/Reach, contexts, graph edges. Distinct from iQube primitives: raw invariants are pre-iQube rows, not iqube_id_map entries (only published InvariantQubes register there, staged as DataQube per CFS-004 §3).',
        color: 'violet',
      },
    },
    {
      id: 'iqube-registry-docs',
      label: 'PRD + Docs',
      slug: 'docs',
      enabled: true,
      group: 'docs',
      order: 0,
      type: 'static',
      config: { component: 'IQubeRegistryDocsTab' },
      metadata: { icon: 'FileText', description: 'Registry PRDs + reference docs', color: 'violet' },
    },
  ],
  permissions: {
    view: ['*'],
    edit: ['aigent-z', 'admin'],
    admin: ['aigent-z', 'admin'],
  },
  liquidUI: { enabled: false },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ───────────────────────────────────────────────────────────────────────────
// POLITY_PASSPORT_BUREAU_CARTRIDGE — Stage 3/5/6 UI surface
// PRD: codexes/packs/agentiq/updates/2026-06-10_polity-passport-bureau-prd-v1.md
// The canonical application, registration, and issuance surface for Polity
// Passports. Citizen apply flow + public registry + steward review queue.
// Steward gate resolves server-side via admin-cartridge:polity-passport-bureau
// (operator decision 3); adminOnly here is the optimistic client-side gate.
// ───────────────────────────────────────────────────────────────────────────
export const POLITY_PASSPORT_BUREAU_CARTRIDGE: CodexConfig = {
  id: 'polity-passport-bureau-cartridge',
  name: 'Polity Passport Bureau',
  slug: 'polity-passport-bureau',
  enabled: true,
  version: '0.1.0',
  owner: 'aigent-z',
  metadata: {
    description: 'Apply for, issue, and steward Polity Passports — anonymous citizen personhood + conditional participant standing.',
    icon: 'ShieldCheck',
    color: 'violet',
    category: 'platform',
    tags: ['passport', 'identity', 'kybe', 'polity', 'registry'],
  },
  tabGroups: [
    { id: 'doctrine', label: 'Doctrine', icon: 'BookOpen', order: 0, adminOnly: true },
    { id: 'apply',   label: 'Apply',   icon: 'FileCheck2', order: 1 },
    { id: 'registry', label: 'Registry', icon: 'BookOpenCheck', order: 2 },
    { id: 'locker',  label: 'Locker',  icon: 'Lock', order: 3 },
    { id: 'delegation', label: 'Delegation', icon: 'Link2', order: 4 },
    { id: 'ens',     label: 'ENS',     icon: 'Globe', order: 5 },
    { id: 'being',   label: 'Mobility Services',   icon: 'Home', order: 6, adminOnly: true },
    { id: 'steward', label: 'Steward', icon: 'Gavel', order: 7, adminOnly: true },
  ],
  tabs: [
    {
      id: 'passport-bureau-doctrine',
      label: 'Doctrine',
      slug: 'doctrine',
      enabled: true,
      group: 'doctrine',
      order: 0,
      type: 'static',
      config: { component: 'PassportDoctrineTab' },
      metadata: { icon: 'BookOpen', description: 'Constitutional framework, passport types, identity model, rights and obligations', color: 'violet' },
    },
    {
      id: 'passport-bureau-apply',
      label: 'Citizen Application',
      slug: 'apply',
      enabled: true,
      group: 'apply',
      order: 0,
      type: 'static',
      config: { component: 'PassportBureauApplyTab' },
      metadata: { icon: 'ShieldCheck', description: 'Apply for an anonymous Citizen Passport — proof of personhood with self-custody privacy', color: 'violet' },
    },
    {
      id: 'passport-bureau-locker',
      label: 'Locker',
      slug: 'locker',
      enabled: true,
      group: 'locker',
      order: 0,
      type: 'static',
      config: { component: 'LockerTab' },
      metadata: { icon: 'Lock', description: 'Holder-owned encrypted vault — Sui+Walrus storage, agent-gated access', color: 'violet' },
    },
    {
      id: 'passport-bureau-delegation',
      label: 'Delegation',
      slug: 'delegation',
      enabled: true,
      group: 'delegation',
      order: 0,
      type: 'static',
      config: { component: 'BoundedDelegationTab' },
      metadata: { icon: 'Link2', description: 'Grant bounded delegations to sponsored agents — AgentKit attestation when sponsor is World ID verified', color: 'violet' },
    },
    {
      id: 'passport-bureau-ens',
      label: 'ENS Identity',
      slug: 'ens',
      enabled: true,
      group: 'ens',
      order: 0,
      type: 'static',
      config: { component: 'PassportEnsTab' },
      metadata: { icon: 'Globe', description: 'Mint a gasless ENS subname for your persona — discoverable, privacy-preserving', color: 'violet' },
    },
    {
      id: 'passport-bureau-registry',
      label: 'Passport Registry',
      slug: 'registry',
      enabled: true,
      group: 'registry',
      order: 0,
      type: 'static',
      config: { component: 'PassportRegistryTab' },
      metadata: { icon: 'BookOpenCheck', description: 'Public record of issued passports', color: 'violet' },
    },
    {
      id: 'passport-bureau-being',
      label: 'Mobility Services',
      slug: 'being',
      enabled: true,
      group: 'being',
      order: 0,
      type: 'static',
      config: { component: 'PassportBeingTab' },
      metadata: { icon: 'Home', description: 'Mobility Services — immigration, housing, shelter, legal assistance routing', color: 'emerald' },
    },
    {
      id: 'passport-bureau-steward',
      label: 'Review Queue',
      slug: 'steward',
      enabled: true,
      adminOnly: true,
      group: 'steward',
      order: 0,
      type: 'static',
      config: { component: 'PassportBureauStewardTab' },
      metadata: { icon: 'Gavel', description: 'Steward review queue — approve, deny, request info', color: 'violet' },
    },
  ],
  permissions: {
    view: ['*'],
    edit: ['aigent-z', 'admin'],
    admin: ['aigent-z', 'admin'],
  },
  liquidUI: { enabled: false },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── HUMAN MOBILITY SERVICES CARTRIDGE ───────────────────────────────────────
// PSC-001: Polity Capability Preservation — Strategic Repatriation.
// Registered as adminOnly pending first citizen-facing release.
export const HUMAN_MOBILITY_SERVICES_CARTRIDGE: CodexConfig = {
  id: 'human-mobility-services-cartridge',
  name: 'Human Mobility Services',
  slug: 'human-mobility-services',
  enabled: true,
  version: '0.1.0',
  owner: 'aigent-z',
  metadata: {
    description: 'Polity capability preservation — strategic repatriation, relocation, and family mobility services.',
    icon: 'Home',
    color: 'emerald',
    category: 'platform',
    tags: ['mobility', 'repatriation', 'housing', 'education', 'polity', 'psc-001'],
  },
  tabGroups: [
    { id: 'activation', label: 'Activation',  icon: 'FolderOpen',    order: 1 },
    { id: 'housing',    label: 'Housing',     icon: 'Home',          order: 2, adminOnly: true },
    { id: 'education',  label: 'Education',   icon: 'GraduationCap', order: 3, adminOnly: true },
    { id: 'relocation', label: 'Relocation',  icon: 'Package',       order: 4, adminOnly: true },
    { id: 'business',   label: 'Business',    icon: 'Briefcase',     order: 5, adminOnly: true },
    { id: 'economic',   label: 'Economic',    icon: 'TrendingUp',    order: 6, adminOnly: true },
    { id: 'family',     label: 'Family',      icon: 'Heart',         order: 7, adminOnly: true },
  ],
  tabs: [
    {
      id: 'hms-standing',
      label: 'Standing',
      slug: 'standing',
      enabled: true,
      type: 'dynamic' as const,
      group: 'activation',
      order: 0,
      adminOnly: true,
      config: { component: 'StandingCartridgeTab' },
      metadata: { description: 'Verified Standing Profile — evidence-derived capability and reputation profile', icon: 'Star', color: 'violet', category: 'platform', tags: [] },
    },
    {
      id: 'hms-activation',
      label: 'Cases',
      slug: 'activation',
      enabled: true,
      type: 'dynamic' as const,
      group: 'activation',
      order: 1,
      adminOnly: true,
      config: { component: 'HumanMobilityServicesTab' },
      metadata: { description: 'Mobility case list and MAF intake wizard', icon: 'FolderOpen', color: 'emerald', category: 'platform', tags: [] },
    },
    {
      id: 'hms-doctrine',
      label: 'Doctrine',
      slug: 'doctrine',
      enabled: true,
      type: 'static' as const,
      group: 'activation',
      order: 2,
      adminOnly: true,
      config: { component: 'MobilityDoctrineTab' },
      metadata: { description: 'PSC-001 Polity Capability Preservation Standard', icon: 'Shield', color: 'violet', category: 'platform', tags: [] },
    },
    {
      id: 'hms-activations',
      label: 'Engagements',
      slug: 'engagements',
      enabled: true,
      type: 'dynamic' as const,
      group: 'activation',
      order: 3,
      adminOnly: true,
      config: { component: 'MobilityActivationsTab' },
      metadata: { description: 'PDEP-governed institutional engagement tracker', icon: 'Target', color: 'violet', category: 'platform', tags: [] },
    },
    {
      id: 'hms-housing',
      label: 'Housing',
      slug: 'housing',
      enabled: true,
      type: 'dynamic' as const,
      group: 'housing',
      order: 1,
      adminOnly: true,
      config: { component: 'MobilityWorkstreamShellTab', props: { workstream: 'housing' } },
      metadata: { description: 'Workstream B — Housing acquisition and rental market strategy', icon: 'Home', color: 'emerald', category: 'platform', tags: [] },
    },
    {
      id: 'hms-education',
      label: 'Education',
      slug: 'education',
      enabled: true,
      type: 'dynamic' as const,
      group: 'education',
      order: 1,
      adminOnly: true,
      config: { component: 'MobilityWorkstreamShellTab', props: { workstream: 'education' } },
      metadata: { description: 'Workstream C — Educational continuity and school placement', icon: 'GraduationCap', color: 'sky', category: 'platform', tags: [] },
    },
    {
      id: 'hms-relocation',
      label: 'Relocation',
      slug: 'relocation',
      enabled: true,
      type: 'dynamic' as const,
      group: 'relocation',
      order: 1,
      adminOnly: true,
      config: { component: 'MobilityWorkstreamShellTab', props: { workstream: 'relocation' } },
      metadata: { description: 'Workstream D — Physical relocation logistics', icon: 'Package', color: 'amber', category: 'platform', tags: [] },
    },
    {
      id: 'hms-business',
      label: 'Business',
      slug: 'business',
      enabled: true,
      type: 'dynamic' as const,
      group: 'business',
      order: 1,
      adminOnly: true,
      config: { component: 'MobilityWorkstreamShellTab', props: { workstream: 'business' } },
      metadata: { description: 'Workstream E — Business continuity and entity migration', icon: 'Briefcase', color: 'violet', category: 'platform', tags: [] },
    },
    {
      id: 'hms-economic',
      label: 'Economic',
      slug: 'economic',
      enabled: true,
      type: 'dynamic' as const,
      group: 'economic',
      order: 1,
      adminOnly: true,
      config: { component: 'MobilityWorkstreamShellTab', props: { workstream: 'economic' } },
      metadata: { description: 'Workstream F — Economic reactivation and banking', icon: 'TrendingUp', color: 'emerald', category: 'platform', tags: [] },
    },
    {
      id: 'hms-family',
      label: 'Family',
      slug: 'family',
      enabled: true,
      type: 'dynamic' as const,
      group: 'family',
      order: 1,
      adminOnly: true,
      config: { component: 'MobilityWorkstreamShellTab', props: { workstream: 'family' } },
      metadata: { description: 'Workstream G — Family stabilization and wellbeing', icon: 'Heart', color: 'rose', category: 'platform', tags: [] },
    },
  ],
  permissions: {
    view: ['*'],
    edit: ['aigent-z', 'admin'],
    admin: ['aigent-z', 'admin'],
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const STANDING_CARTRIDGE: CodexConfig = {
  id: 'standing-cartridge',
  name: 'Standing Cartridge',
  slug: 'standing-cartridge',
  enabled: true,
  version: '0.1.0',
  owner: 'aigent-z',
  metadata: {
    description: 'Your personal capability & standing ledger — evidence-derived, principal-verified, anchored to your Polity Passport.',
    icon: 'Star',
    color: 'violet',
    category: 'platform',
    tags: ['standing', 'capability', 'vsp', 'evidence', 'identity', 'root-did'],
  },
  tabGroups: [
    { id: 'ledger', label: 'Standing Ledger', icon: 'Star', order: 1 },
  ],
  tabs: [
    {
      id: 'standing-ledger',
      label: 'Standing',
      slug: 'standing',
      enabled: true,
      type: 'static' as const,
      group: 'ledger',
      order: 0,
      config: { component: 'StandingCartridgeTab', props: {} },
      metadata: { description: 'Verified Standing Profile — evidence-derived capability and reputation profile', icon: 'Star', color: 'violet', category: 'platform', tags: [] },
    },
  ],
  permissions: {
    view: ['*'],
    edit: ['aigent-z', 'admin'],
    admin: ['aigent-z', 'admin'],
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ───────────────────────────────────────────────────────────────────────────
// POLITY CORE CARTRIDGE
// The authoritative constitutional repository + machine-readable source of
// legitimacy for autonomous agents. Human-readable docs live in the
// codexes/packs/polity-core/ pack; machine-readable frameworks live in
// services/polity/frameworks/*.json and are served at
// GET /api/polity-core/constitution. Pack auto-generation is suppressed for
// 'polity-core' in packRegistry so this hand-curated surface is canonical.
// ───────────────────────────────────────────────────────────────────────────
export const POLITY_CORE_CARTRIDGE: CodexConfig = {
  id: 'polity-core-cartridge',
  name: 'Polity Core',
  slug: 'polity-core',
  enabled: true,
  version: '0.1.0',
  owner: 'aigent-z',
  metadata: {
    description: 'The authoritative constitutional repository — Constitution, Charters, Governance, Agent, and Standing frameworks, and Amendment Records. The machine-readable source of legitimacy for autonomous agents.',
    icon: 'Landmark',
    color: 'violet',
    category: 'platform',
    tags: ['polity', 'constitution', 'governance', 'agent', 'legitimacy'],
  },
  tabGroups: [
    { id: 'constitution', label: 'Constitution', icon: 'Landmark', order: 0 },
    { id: 'frameworks', label: 'Frameworks', icon: 'BookOpen', order: 1 },
    { id: 'commentary', label: 'Commentary', icon: 'BookOpen', order: 2 },
    { id: 'records', label: 'Records', icon: 'FileText', order: 3 },
  ],
  tabs: [
    {
      id: 'polity-core-constitution',
      label: 'Constitution',
      slug: 'constitution',
      enabled: true,
      group: 'constitution',
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_constitution', defaultPath: 'items/CONSTITUTION.md' },
      },
      metadata: { icon: 'Landmark', description: 'The Polity Constitution — sovereignty and the chain of legitimacy', color: 'violet' },
    },
    {
      id: 'polity-core-constitution-agentic-polity',
      label: 'Constitution of the Agentic Polity',
      slug: 'constitution-agentic-polity',
      enabled: true,
      group: 'constitution',
      order: 0.5,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_constitution_agentic_polity', defaultPath: 'items/CONSTITUTION_OF_AGENTIC_POLITY.md' },
      },
      metadata: { icon: 'Landmark', description: 'The foundational constitutional text — 4th paper of the Polity series, elevated to ratified status', color: 'violet' },
    },
    {
      id: 'polity-core-invariant-intelligence',
      label: 'Invariant Intelligence',
      slug: 'invariant-intelligence',
      enabled: true,
      group: 'constitution',
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_invariant_intelligence', defaultPath: 'constitutional-records/invariant-intelligence.md' },
      },
      metadata: { icon: 'BookMarked', description: 'Foundational Constitutional Record — Invariant Intelligence (Chrysalis anchor)', color: 'violet' },
    },
    {
      id: 'polity-core-commentary-experience-sovereignty',
      label: 'Experience Sovereignty',
      slug: 'commentary-experience-sovereignty',
      enabled: true,
      group: 'commentary',
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_commentary_experience_sovereignty', defaultPath: 'items/commentary/README.md' },
      },
      metadata: { icon: 'BookOpen', description: 'Constitutional commentary — Experience Sovereignty paper series', color: 'violet' },
    },
    {
      id: 'polity-core-commentary-coyn-thesis',
      label: 'COYN Thesis',
      slug: 'commentary-coyn-thesis',
      enabled: true,
      group: 'commentary',
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_commentary_coyn_thesis', defaultPath: 'items/commentary/README.md' },
      },
      metadata: { icon: 'BookOpen', description: 'Constitutional commentary — COYN Thesis paper series', color: 'violet' },
    },
    {
      id: 'polity-core-commentary-polity',
      label: 'The Polity',
      slug: 'commentary-polity',
      enabled: true,
      group: 'commentary',
      order: 2,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_commentary_polity', defaultPath: 'items/commentary/README.md' },
      },
      metadata: { icon: 'BookOpen', description: 'Constitutional commentary — the Polity paper series', color: 'violet' },
    },
    {
      id: 'polity-core-agent-charter',
      label: 'Agent Charter',
      slug: 'agent-charter',
      enabled: true,
      group: 'frameworks',
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_agent_charter', defaultPath: 'items/AGENT_CHARTER.md' },
      },
      metadata: { icon: 'Bot', description: 'Autonomous Agent Constitutional Charter — ADID class and Phase 1 guardrails', color: 'violet' },
    },
    {
      id: 'polity-core-delegation',
      label: 'Delegation',
      slug: 'delegation-framework',
      enabled: true,
      group: 'frameworks',
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_delegation_framework', defaultPath: 'items/DELEGATION_FRAMEWORK.md' },
      },
      metadata: { icon: 'Link2', description: 'Bounded delegation framework', color: 'violet' },
    },
    {
      id: 'polity-core-standing-charter',
      label: 'Standing Charter',
      slug: 'standing-charter',
      enabled: true,
      group: 'frameworks',
      order: 2,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_standing_charter', defaultPath: 'items/STANDING_CHARTER.md' },
      },
      metadata: { icon: 'Award', description: 'Standing as confidence in the veracity of declarations', color: 'violet' },
    },
    {
      id: 'polity-core-metacommons-charter',
      label: 'metaCommons Charter',
      slug: 'metacommons-charter',
      enabled: true,
      group: 'frameworks',
      order: 3,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_metacommons_charter', defaultPath: 'items/METACOMMONS_CHARTER.md' },
      },
      metadata: { icon: 'Globe', description: 'The second institution — sovereign signals into collective intelligence', color: 'violet' },
    },
    {
      id: 'polity-core-founder-office',
      label: 'Founder Office Charter',
      slug: 'founder-office-charter',
      enabled: true,
      group: 'frameworks',
      order: 4,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_founder_office_charter', defaultPath: 'items/FOUNDER_OFFICE_CHARTER.md' },
      },
      metadata: { icon: 'Rocket', description: 'Sub-metaCommons artefact — capability discovery, opportunity intelligence, venture formation', color: 'violet' },
    },
    {
      id: 'polity-core-standing',
      label: 'Standing Framework',
      slug: 'standing-framework',
      enabled: true,
      group: 'frameworks',
      order: 5,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_standing_framework', defaultPath: 'items/STANDING_FRAMEWORK.md' },
      },
      metadata: { icon: 'Award', description: 'Operational companion to the Standing Charter', color: 'violet' },
    },
    {
      id: 'polity-core-governance',
      label: 'Governance',
      slug: 'governance-framework',
      enabled: true,
      group: 'frameworks',
      order: 6,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_governance_framework', defaultPath: 'items/GOVERNANCE_FRAMEWORK.md' },
      },
      metadata: { icon: 'Scale', description: 'Governance authority is reserved to citizens', color: 'violet' },
    },
    {
      id: 'polity-core-ventureqube-spec',
      label: 'VentureQube Spec (WIP)',
      slug: 'ventureqube-spec',
      enabled: true,
      group: 'records',
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_ventureqube_spec', defaultPath: 'items/VENTUREQUBE_SPEC.md' },
      },
      metadata: { icon: 'Layers', description: 'Work-in-progress constitutional primitive — VentureQube v1 (stubbed for canonization)', color: 'amber' },
    },
    {
      id: 'polity-core-amendments',
      label: 'Amendment Records',
      slug: 'amendment-records',
      enabled: true,
      group: 'records',
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_amendment_records', defaultPath: 'items/AMENDMENT_RECORDS.md' },
      },
      metadata: { icon: 'FileText', description: 'Append-only ledger of constitutional changes + Autodrive CIDs', color: 'violet' },
    },
    {
      id: 'polity-core-machine-readable',
      label: 'Machine-Readable',
      slug: 'machine-readable',
      enabled: true,
      group: 'records',
      order: 2,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'polity-core', collectionId: 'col_machine_readable', defaultPath: 'items/MACHINE_READABLE.md' },
      },
      metadata: { icon: 'Code', description: 'Machine-readable source of legitimacy — endpoint, sources, accessor', color: 'violet' },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CCRL — Constitutional Cybernetics Research Laboratory (CFS-019, Phase B)
// The canonical research SURFACE: every research asset reachable here, in
// place (canonical-surface-first migration; physical consolidation into a
// ccrl pack is Phase D). Hand-curated per the dual-source rule.
// ─────────────────────────────────────────────────────────────────────────────
export const CCRL_CARTRIDGE: CodexConfig = {
  id: 'ccrl-cartridge',
  name: 'CCRL — Research Laboratory',
  slug: 'ccrl-cartridge',
  enabled: true,
  version: '1.0.0',
  owner: 'aigent-z',
  metadata: {
    description: 'Constitutional Cybernetics Research Laboratory — the constitutional scientific institution: experiments, series, programmes, publications, and the living invariant substrate (CFS-019)',
    icon: 'FlaskConical',
    color: 'violet',
    category: 'cartridge',
    tags: ['ccrl', 'research', 'constitutional-cybernetics', 'experiments', 'invariants', 'publications'],
  },
  tabGroups: [
    { id: 'institution', label: 'Institution', icon: 'Landmark', order: 0 },
    { id: 'research', label: 'Research', icon: 'Layers', order: 1 },
    { id: 'laboratory', label: 'Laboratory', icon: 'FlaskConical', order: 2 },
    { id: 'knowledge', label: 'Living Knowledge', icon: 'BookMarked', order: 3 },
    { id: 'publications', label: 'Publications', icon: 'BookOpen', order: 4 },
    { id: 'programme', label: 'Programme', icon: 'Target', order: 5 },
  ],
  tabs: [
    {
      id: 'ccrl-dashboard',
      label: 'Dashboard',
      slug: 'ccrl-dashboard',
      enabled: true,
      group: 'institution',
      order: 0,
      type: 'static',
      config: { component: 'CCRLDashboardTab', props: {} },
      metadata: { icon: 'Landmark', description: 'Mission, live programme status (Chrysalis Test), recent canonical results, roadmap', color: 'violet' },
    },
    {
      id: 'ccrl-research-copilot',
      label: 'Research Copilot',
      slug: 'ccrl-research-copilot',
      enabled: true,
      group: 'institution',
      order: 0.5,
      type: 'static',
      config: { component: 'CCRLResearchCopilotTab', props: {} },
      metadata: { icon: 'FlaskConical', description: 'aigentZ narrates the live lab state — DCIR-conforming, narrate-only (research proposal kinds are C2.1, CFS-019)', color: 'violet' },
    },
    {
      id: 'ccrl-charter',
      label: 'Charter',
      slug: 'ccrl-charter',
      enabled: true,
      group: 'institution',
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'ccrl', collectionId: 'col_foundation', defaultPath: 'foundation/CFS-019_ccrl-charter.md' },
      },
      metadata: { icon: 'Scale', description: 'CFS-019 — the CCRL constitution: layers, object model, lifecycles, migration, phases' },
    },
    // ── Research, by constitutional layer ─────────────────────────
    {
      id: 'layer-i',
      label: 'Layer I — Invariant Intelligence',
      slug: 'layer-i',
      enabled: true,
      group: 'research',
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'ccrl', collectionId: 'col_foundation', defaultPath: 'foundation/appendix-a_canonical-invariants.md' },
      },
      metadata: { icon: 'BookMarked', description: 'Constitutional knowledge — the canon, the CFS corpus, the Foundational Validation Series (foundation complete)' },
    },
    {
      id: 'layer-ii',
      label: 'Layer II — Constitutional Computing',
      slug: 'layer-ii',
      enabled: true,
      group: 'research',
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'ccrl', collectionId: 'col_foundation', defaultPath: 'foundation/CFS-015_operation-chrysalis-2-prd.md' },
      },
      metadata: { icon: 'Cpu', description: 'Constitutional execution — Operation Chrysalis 2.0, the Capability Pipeline, deployment authority (alpha)' },
    },
    {
      id: 'layer-iii',
      label: 'Layer III — Constitutional Cybernetics',
      slug: 'layer-iii',
      enabled: true,
      group: 'research',
      order: 2,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'ccrl', collectionId: 'col_foundation', defaultPath: 'foundation/CFS-019_ccrl-charter.md' },
      },
      metadata: { icon: 'RefreshCw', description: 'Constitutional evolution — feedback, adaptation, multi-agent governance (nascent: the frontier)' },
    },
    // ── Experiment Laboratory ─────────────────────────────────────
    {
      id: 'ccrl-experiment-lab',
      label: 'Experiment Lab',
      slug: 'ccrl-experiment-lab',
      enabled: true,
      adminOnly: true,
      group: 'laboratory',
      order: 0,
      type: 'static',
      config: { component: 'InvariantExperimentLab', props: {} },
      metadata: { icon: 'FlaskConical', description: 'Run the series live: EXP-001–004 + Results (canonical publish) + Report + Chrysalis Test — admin-only, runs spend provider credits' },
    },
    {
      id: 'ccrl-protocols',
      label: 'Protocols & Articles',
      slug: 'ccrl-protocols',
      enabled: true,
      group: 'laboratory',
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'ccrl', collectionId: 'col_experiments' },
      },
      metadata: { icon: 'Target', description: 'Experiment designs, protocols, canonical articles, evaluation frameworks' },
    },
    // ── Living Knowledge ──────────────────────────────────────────
    {
      id: 'ccrl-invariant-registry',
      label: 'Invariant Registry',
      slug: 'ccrl-invariant-registry',
      enabled: true,
      group: 'knowledge',
      order: 0,
      type: 'static',
      config: { component: 'InvariantRegistryTab', props: {} },
      metadata: { icon: 'BookMarked', description: 'The live substrate — namespaces, status, Standing, Reach, contexts, graph edges', color: 'violet' },
    },
    {
      id: 'ccrl-glossary',
      label: 'Glossary & Ontology',
      slug: 'ccrl-glossary',
      enabled: true,
      group: 'knowledge',
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'ccrl', collectionId: 'col_foundation', defaultPath: 'foundation/constitutional-glossary.md' },
      },
      metadata: { icon: 'BookOpen', description: 'The runtime-resolved constitutional vocabulary — one canon for every agent' },
    },
    // ── Publications ──────────────────────────────────────────────
    {
      id: 'ccrl-records',
      label: 'Records & Findings',
      slug: 'ccrl-records',
      enabled: true,
      group: 'publications',
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'agentiq', collectionId: 'col_updates' },
      },
      metadata: { icon: 'BookOpen', description: 'The constitutional record — every increment, finding, and session record (publication lineage)' },
    },
    // ── Programme Management ──────────────────────────────────────
    {
      id: 'ccrl-programmes',
      label: 'Research Programmes',
      slug: 'ccrl-programmes',
      enabled: true,
      group: 'programme',
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'ccrl', collectionId: 'col_foundation', defaultPath: 'foundation/CRP-001_constitutional-research-program-charter.md' },
      },
      metadata: { icon: 'Target', description: 'CRP-001 — the twelve research programmes; roadmap and backlog live in the charter (CFS-019 §8)' },
    },
  ],
};

export const CODEX_DEFINITIONS: CodexConfig[] = [
  KNYT_CODEX,
  QRIPTO_CODEX,
  AGENTIQ_CARTRIDGE,
  // AGENTIQ_OS_CARTRIDGE is restored 2026-05-26: the previous archive
  // dropped the hand-curated registration in favour of the pack-driven
  // duplicate (`agentiq-os-codex` auto-generated by packRegistry from
  // codexes/packs/agentiq-os/). The wrong one ended up visible. The
  // hand-curated cartridge below is the canonical surface — it carries
  // the rich tab structure (Home/Docs/Build/Bind/Deploy/Missions/
  // Community) with interactive React components, and metaMe's
  // QuickLinksCard targets its slug ('agentiq-os-cartridge'). The
  // pack-driven duplicate is now suppressed in packRegistry's skip
  // list (see app/api/codex/registry/_lib/packRegistry.ts).
  AGENTIQ_OS_CARTRIDGE,
  VENTURE_LAB_CODEX,
  METAME_CODEX,
  MARKETA_CARTRIDGE,
  IQUBE_REGISTRY_CARTRIDGE,
  POLITY_PASSPORT_BUREAU_CARTRIDGE,
  HUMAN_MOBILITY_SERVICES_CARTRIDGE,
  STANDING_CARTRIDGE,
  POLITY_CORE_CARTRIDGE,
  CCRL_CARTRIDGE,
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
