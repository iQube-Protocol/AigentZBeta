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
// THE EIGHT RESEARCH WORKSPACE VIEWS + THEIR ROLE MATRIX, from the one place
// they are defined (SPEC-IRL-WORKSPACE-001 §7/§8). A VALUE import, deliberately:
// the IRL cartridge's (and, as of 2026-07-29, the IRL OS cartridge's) top-level
// "Workspace" tab and its subTabs are BUILT from this registry rather than
// transcribing it, so the shipped access matrix and the specified one cannot
// diverge. The module is pure (no server imports, no I/O) and safe in the
// browser bundle this file already ships in.
import {
  RESEARCH_WORKSPACE_VIEWS,
  RESEARCH_WORKSPACE_ADMIN_VIEW,
} from '@/services/research/researchWorkspaceViews';

/**
 * Builds the "Workspace" tab (SPEC-IRL-WORKSPACE-001) — the collaborative
 * Research Workspace surface — for whichever cartridge mounts it. ONE
 * function, TWO callers (`IRL_CARTRIDGE` and, per the operator's 2026-07-29
 * correction "workspace should also be added to the IRL OS cartridge... reuse
 * the same underlying tab/view definitions... rather than duplicating them",
 * `IRL_OS_CARTRIDGE`): hand-copying this object a second time for IRL OS would
 * be exactly the stale-duplicate defect inv.engineering.037 names — if
 * `RESEARCH_WORKSPACE_VIEWS` ever gains a ninth view, both cartridges must
 * pick it up from one call site, not two hand-maintained ones.
 *
 * `idPrefix` scopes every id/slug this generates so the two cartridges' deep
 * links never collide (same convention as `polityPassportTabsByGroup` below).
 * Callers place the returned tab in their own top-level `workspace` tabGroup
 * (a sibling of Institution/Research/Laboratory/Publications/Participation,
 * sited immediately after Participation) — see `IRL_CARTRIDGE.tabGroups` for
 * the full rationale, including why this stays ONE tab with its own `subTabs`
 * (the "single-tab group with subTabs" / Order-of-Metayé pattern
 * `CodexPanelDynamic` already renders as two effective tiers).
 *
 * Locker and Participants stay pruned from the subTab row (operator
 * instruction, 2026-07-29 — each cartridge's own Participation group already
 * covers that ground); both remain real SPEC views in the registry and in
 * `PartnerProgrammesTab`'s own surface list, just not offered as tabs here.
 */
// `RESEARCH_WORKSPACE_VIEWS`' own `slug` field bakes in a literal
// `irl-workspace-` prefix (it was authored for the one original mount before
// this became a two-cartridge, prefix-parameterised builder). Strip that
// baked-in prefix and re-apply the CALLER's own `idPrefix` so `IRL_CARTRIDGE`
// (idPrefix `irl-workspace`) reproduces byte-identical ids/slugs to before
// this function existed, while `IRL_OS_CARTRIDGE` (idPrefix `irl-os-workspace`)
// gets its own non-colliding namespace instead of a doubled prefix.
function workspaceSlugSuffix(fullSlug: string): string {
  return fullSlug.replace(/^irl-workspace-/, '');
}

/**
 * SECURITY (2026-08-27 IRL OS scoped restoration): the IRL OS mount
 * (`idPrefix` starting `irl-os-`) is a PUBLIC host — its Workspace tab must
 * never hand a viewer (even one holding a genuine research-lab grant for
 * whichever workspace they're scoped to) a navigable DeepLinkCard into the
 * private `irl-cartridge`. `forbiddenCodexSlugs` is a render-boundary guard
 * (PartnerProgrammesTab.tsx) — it does not touch researchWorkspace.ts's
 * shared link data, so the identical workspace mounted inside the PRIVATE
 * `irl-cartridge`'s own Workspace tab (idPrefix `irl-workspace`) keeps its
 * legitimate `irl-cartridge` self-links unchanged. See the prop's own doc
 * comment on PartnerProgrammesTabProps and the containment audit's Residual
 * Risk 1 (docs/security/2026-08-27_irl-os-containment-breach-audit.md).
 */
function buildResearchWorkspaceTab(idPrefix: string) {
  const forbiddenCodexSlugs = idPrefix.startsWith('irl-os-') ? ['irl-cartridge'] : undefined;
  return {
    id: idPrefix,
    label: 'Workspace',
    slug: idPrefix,
    enabled: true,
    group: 'workspace',
    order: 0,
    type: 'static' as const,
    participationDomain: 'research-lab',
    config: {
      component: 'PartnerProgrammesTab',
      props: { initialSurface: 'overview', workspaceDomain: 'research', forbiddenCodexSlugs },
    },
    metadata: {
      icon: 'LayoutGrid',
      description:
        'The collaborative Research Workspace — programmes, pipeline, review, working materials, QubeTalk and the internal programme space',
      color: 'violet',
    },
    subTabs: [
      ...RESEARCH_WORKSPACE_VIEWS.filter((view) => view.id !== 'locker' && view.id !== 'participants').map(
        (view, index) => ({
          id: `${idPrefix}-${workspaceSlugSuffix(view.slug)}`,
          label: view.label,
          slug: `${idPrefix}-${workspaceSlugSuffix(view.slug)}`,
          enabled: true,
          order: index,
          type: 'static' as const,
          participationDomain: 'research-lab',
          participationRoles: [...view.roles],
          config: {
            component: 'PartnerProgrammesTab',
            props: { initialSurface: view.id, workspaceDomain: 'research', forbiddenCodexSlugs },
          },
          metadata: { icon: view.icon, description: view.description, color: 'violet' },
        }),
      ),
      {
        // TIER 0 — the internal programme space, exactly as the Venture Lab's
        // Partner Administration is. `adminOnly` is applied to subTabs the
        // same way it is to top-level tabs (CodexPanelDynamic's
        // `activeSubTabs` filter calls the same `tabPassesAccessGates`), so
        // no research-lab grant of any role can open it.
        id: `${idPrefix}-${workspaceSlugSuffix(RESEARCH_WORKSPACE_ADMIN_VIEW.slug)}`,
        label: RESEARCH_WORKSPACE_ADMIN_VIEW.label,
        slug: `${idPrefix}-${workspaceSlugSuffix(RESEARCH_WORKSPACE_ADMIN_VIEW.slug)}`,
        enabled: true,
        adminOnly: true,
        order: 100,
        type: 'static' as const,
        config: {
          component: 'PartnerProgrammesTab',
          props: { initialSurface: RESEARCH_WORKSPACE_ADMIN_VIEW.id, workspaceDomain: 'research', forbiddenCodexSlugs },
        },
        metadata: {
          icon: RESEARCH_WORKSPACE_ADMIN_VIEW.icon,
          description: RESEARCH_WORKSPACE_ADMIN_VIEW.description,
          color: 'slate',
        },
      },
    ],
  };
}

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
  name: 'KNYT',
  slug: 'knyt-codex',
  enabled: true,
  version: '1.0.0',
  owner: 'aigent-kn0w1',
  copilot: {
    accentColor: 'amber',
    agent: { id: 'aigent-kn0w1', name: 'KNYT Copilot' },
    promptPlaceholder: 'Ask about episodes, characters, bundles...',
    quickPrompts: ['What episodes are available?', 'Show me bundle deals', 'KNYT Cards explained', 'Investor pricing'],
  },
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
  name: 'Qriptopian',
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
  name: 'AgentiQ',
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
          packId: 'irl',
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
          packId: 'irl',
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
      label: 'metaMe IRL',
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
        description: 'metaMe Invariant Research Lab — run the Foundational Validation Series + the constitutional tests (Chrysalis, Homecoming) live. Admin-only; runs spend provider credits.'
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

    {
      // CAPABILITY ARTEFACT HOME (operator ruling 2026-07-27: "the natural home
      // for these would be the registries tabs for AgentiQ and AgentiQ OS —
      // AgentiQ should be the home and AgentiQ OS a mirror").
      //
      // Constitutional Capability Briefs previously existed ONLY as dated
      // entries in the Updates tab, indistinguishable from a deploy note among
      // 300+ other docs. They are registry material — the backward-looking
      // record of what exists — so they belong beside the Factory, the Supply
      // registry and the Invariant Registry.
      //
      // Composition, not a new surface: `AgentiqCartridgeTab` over a dedicated
      // `col_capabilities` collection. The DOCS are unmoved and unduplicated —
      // the collection references the same files the Updates collection does,
      // so there is one copy of every brief and no second source of truth.
      id: 'capability-briefs',
      label: 'Capabilities',
      slug: 'capabilities',
      enabled: true,
      group: 'registry',
      order: 3,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'agentiq',
          collectionId: 'col_capabilities'
        }
      },
      metadata: {
        icon: 'FileBadge',
        description: 'Constitutional Capability Briefs — what shipped, where it lives, how to use it, and what must stay true (CFS-049 + CCR-001)',
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

    {
      // MIRROR of the AgentiQ cartridge's capability-artefact home (same
      // operator ruling). Same pack, same collection, same component — a
      // mirror is a second ENTRANCE, never a second copy. Editing a brief in
      // one place changes it in both because there is only one file.
      id: 'agentiq-os-capability-briefs',
      label: 'Capabilities',
      slug: 'os-capabilities',
      enabled: true,
      group: 'registry',
      order: 6,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'agentiq',
          collectionId: 'col_capabilities'
        }
      },
      metadata: { icon: 'FileBadge', description: 'Constitutional Capability Briefs (mirrors the AgentiQ cartridge home)' },
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
  // SPEC-VLM-001 Phase 1 (2026-07-24) — the five-domain regroup, CFS-050
  // Sovereignty Navigation's first applied test case. Eleven flat top-level
  // tabs collapse into five intent-driven domains via the Standard Cartridge
  // Navigation Framework (the same TabGroup/group mechanism IRL OS, Polity
  // Core, and Marketa already use) -- re-grouping only, per SPEC-VLM-001 §11:
  // every tab below keeps its own id/slug/component/adminOnly unchanged,
  // gaining only a `group` + a re-sequenced `order` local to that group.
  tabGroups: [
    { id: 'operate',    label: 'Operate',    icon: 'Rocket',    order: 0 },
    { id: 'connect',    label: 'Connect',    icon: 'Users',     order: 1 },
    // "Service" (singular) — SUPERSEDES the same day's earlier "Services"
    // (plural) ruling. Operator, 2026-07-28 (second ruling): tab-GROUP labels
    // are VERBS — Operate, Connect, Grow, Participate, Administer — so the
    // domain that serves is "Service", not the noun-plural "Services". The
    // family of capability suites the earlier comment pointed at has not gone
    // away; it now lives entirely in the sub menu, whose first member is
    // "Financial Services" (relabelled from "Financial" in the same ruling —
    // "epistemically coherent": the suite names itself, the group names the act).
    { id: 'service',    label: 'Service',    icon: 'Landmark',  order: 2 },
    { id: 'grow',       label: 'Grow',       icon: 'TrendingUp', order: 3 },
    // PARTICIPATE (Phase 1, 2026-07-27) — the participant-facing expression of
    // the SAME domain-scoped participation substrate the Research Lab already
    // surfaces (`ACCESS_DOMAINS` × `DOMAIN_ROLES`, one mechanism, five domains).
    // Its own cross-programme group rather than a Partner sub-item: participation
    // spans every venture programme, not one partner. The tabs below mount the
    // SAME components the IRL cartridge mounts — the ruling was "do not copy
    // Research Lab Participation into Venture Lab", and these are the identical
    // modules, configured for the venture domain.
    //
    // AHEAD OF PARTNER since 2026-07-28 (operator ruling — the two groups
    // SWAPPED). Participate is the CROSS-PARTNER, CROSS-PROGRAMME surface:
    // every user with Venture Lab access gets an iteration of it, metaMe runs
    // cross-partner pilots through it, and partners invite their own
    // ecosystems through the SAME invitation system. Partner is the narrow
    // bilateral space by comparison, so the broad surface now comes first.
    { id: 'participate', label: 'Participate', icon: 'ShieldCheck', order: 3.5 },
    // FIRST-CLASS PARTNER DOMAIN (operator, 2026-07-27, seeing it in situ):
    // "Partner should be a first class menu item between grow and administer,
    // and that sub menu should then drive the content across the sub sections
    // … we don't need the duplicate sub menus." The Partner Workspace's areas
    // are the STANDARD cartridge tabs of this group — the cartridge's own
    // navigation drives what renders beneath the Pilot Command Center,
    // instead of a second surface row inside the tab body.
    //
    // TIER SPLIT (Horizen Phase 3, audit §B.3; operator ruling "Partner gate =
    // split agreed", 2026-07-27). The group is NO LONGER adminOnly, because it
    // now holds two tiers at once:
    //
    //   Tier 2 — Collaborate · Operate · Evidence
    //            `participationDomain: 'venture-lab'` + `participationRoles`:
    //            the SHARED workspace record a partner operator must be able
    //            to see, without becoming a platform admin. That requirement
    //            was the hard blocker recorded in the base audit (§7 item 4).
    //   Tier 0 — Communicate · Administration
    //            `adminOnly`: internal drafting and internal partner
    //            assessment. Communicate becomes two-stage (draft internal,
    //            share approved output) in a later increment; until then the
    //            SAFE half is the one that ships.
    //
    // THIS GROUP IS THE PARTNER **PRIVATE** WORKSPACE (operator ruling,
    // 2026-07-28). Its public counterpart — the Overview surface, which was
    // this group's `partner-programmes` tab — MOVED OUT to Participate as
    // "Public Workspace". What remains here is the partner↔metaProof bilateral
    // record and the internal programme space, and the operator's requirement
    // is that it "renders only to partner ops/personnel cohorts and metaMe
    // admins — invisible to everyone else, not merely empty".
    //
    // That invisibility is STRUCTURAL, not a group-level `adminOnly` (which
    // would also hide it from the partner operators who must see it): every
    // remaining tab carries either `participationRoles: ['partner-operator',
    // 'workspace-steward']` or `adminOnly`, and CodexPanelDynamic does not
    // render a group whose every tab is gated away (MS-9 — a control that
    // cannot act must not render). A caller with a plain `venture-participant`
    // or `observer` grant therefore sees no Partner pill at all.
    // `tests/venture-lab-cohort-isolation.test.ts` canary 10 asserts exactly
    // that, from both sides.
    { id: 'partner',    label: 'Partner',    icon: 'Handshake',  order: 3.7 },
    // adminOnly on the GROUP itself, not just its children: every current
    // Administer tab (Plan Pricing, α Docs) is adminOnly:true -- without this,
    // a non-admin founder would see an "Administer" pill that renders nothing
    // when clicked (its enabledTabs would filter to empty). AgentiQ OS α left
    // this group for Grow on 2026-07-28 — it is a public surface.
    //
    // VERIFIED 2026-07-28 (operator asked whether a PARTNER admin could satisfy
    // this): `adminOnly` resolves against the PLATFORM admin flag only. The
    // group gate is `if (g.adminOnly && !isAdmin) return false` in
    // CodexPanelDynamic's `visibleGroups`, and `isAdmin` there is
    // `isAdminProp === true`, fed from the server-resolved
    // `cartridgeFlags.isAdmin`. The per-cartridge grant set travels in a
    // SEPARATE argument (`cartridgeAdminGrants`) that `getEnabledTabs` consults
    // only for `adminOfCartridge` — never for `adminOnly`. So no
    // `cartridgeFlags.adminCartridges` entry, partner or otherwise, can open
    // this group. No tightening was required; the canary in
    // `tests/venture-lab-cohort-isolation.test.ts` now pins that separation so
    // a future edit cannot quietly fold the two admin notions together.
    { id: 'administer', label: 'Administer', icon: 'Settings',  order: 4, adminOnly: true },
  ],
  tabs: [
    {
      id: 'founder-office',
      label: 'Founder Office',
      slug: 'founder-office',
      enabled: true,
      adminOnly: false,
      group: 'operate',
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
      // PRD-FDC-001 (Founders Club, ratified 2026-07-22) — the Human Domain
      // counterpart to the Founder Office tab above (Operational Domain).
      // A second PRIMARY section, coordinate with Founder Office, per §2.1 —
      // explicitly NOT a sub-view folded into FounderOfficeTab's own
      // Workspace/Discover/Validate/Architect/Blueprint switcher, and
      // explicitly NOT named "Community" (Community is one of the Club's own
      // internal sub-bodies, §2.2 — naming the section after one of its parts
      // would be a category error).
      id: 'founders-club',
      label: 'Founders Club',
      slug: 'founders-club',
      enabled: true,
      adminOnly: false,
      group: 'connect',
      order: 0,
      type: 'static',
      config: {
        component: 'FoundersClubTab',
        props: {}
      },
      metadata: {
        icon: 'Users',
        description: 'The Human Domain of the Founder Office — connection, collaboration, opportunity, wellbeing, recognition, community, and mentoring',
        color: 'violet'
      }
    },
    {
      // CRP-003a Increment 3 — the first Founder Office Capability Suite.
      // Runs the canonical constitutional service pattern (N1 agreement gate +
      // N2 12-step pipeline) on a Domain-3 (Financial Intelligence, read-only)
      // capability. Constitutional-agreement (409) gated; commercial tier-gating
      // is Increment 3b.
      id: 'financial-services',
      label: 'Financial Services',
      slug: 'financial-services',
      enabled: true,
      adminOnly: false,
      group: 'service',
      order: 0,
      type: 'static',
      config: {
        component: 'FinancialServicesTab',
        props: {}
      },
      metadata: {
        icon: 'Landmark',
        description: 'Constitutional Financial Services Programme (CRP-003a) — Pilot Series 001 with Horizen. Domain 3 Financial Intelligence, constitutional service loop.',
        color: 'emerald'
      },
      // THE SERVICE SUB MENU (operator, 2026-07-28: "VL Services should have a
      // sub menu with Financial"). A single-tab group renders no sub-header row
      // at all — deliberately, so a lone tab does not cost a row of chrome — so
      // Services appeared without the sub menu every sibling group has. Declaring
      // the domain's capability suites as `subTabs` uses the SAME third-tier
      // mechanism the Passport Steward group and metaMe's Order of Metayé
      // already use (no new nav concept, MS-1), and gives the next suite a home
      // to be added beside Financial rather than a second navigation.
      subTabs: [
        {
          // "Financial Services", not "Financial" (operator, 2026-07-28,
          // second ruling — "epistemically coherent"): the group label is the
          // verb (Service), so the suite inside it must name itself in full.
          // A bare adjective under a verb reads as a fragment, not a suite.
          id: 'vl-services-financial',
          label: 'Financial Services',
          slug: 'vl-services-financial',
          enabled: true,
          order: 0,
          type: 'static',
          config: { component: 'FinancialServicesTab', props: {} },
          metadata: {
            icon: 'Landmark',
            description: 'Constitutional Financial Services Programme (CRP-003a) — Intelligence, Investment and Market domains under the 12-step constitutional service pattern',
            color: 'emerald',
          },
        },
      ],
    },
    {
      // The Agent Bench (2026-08-05 canonical Threshold Cohort Activation +
      // Founder Office Agent Bench plan, §5) — "a new tab alongside
      // FinancialServicesTab, registered the same way in TabRenderer.tsx."
      // A read-only projection over Marketa candidates, Access &
      // Invitations, the admission journey's facts, and the registry's
      // publication/trust state — organized around what the founder DOES
      // (Discover/Invite/Sponsor/Admit/Deploy/Operate), not which table a
      // row lives in.
      id: 'agent-bench',
      label: 'Agent Bench',
      slug: 'agent-bench',
      enabled: true,
      adminOnly: true,
      group: 'service',
      order: 1,
      type: 'static',
      config: {
        component: 'AgentBenchTab',
        props: {}
      },
      metadata: {
        icon: 'Rocket',
        description: 'Founder Office operating console for admitting external agents — Discover, Invite, Sponsor, Admit, Deploy, Operate.',
        color: 'emerald'
      },
    },
    {
      id: 'commercial-funnel',
      label: 'Commercial Funnel',
      slug: 'commercial-funnel',
      enabled: true,
      adminOnly: false,
      group: 'operate',
      order: 2,
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
      // Partner Workspace pattern (operator + Aletheon, 2026-07-26) — a pilot
      // workspace COMPOSED from existing Venture Lab capabilities, instantiated
      // first with Horizen (Pilot Series 001, CRP-003a). Partner instances live
      // in services/venture/partnerWorkspace.ts (single source); this tab only
      // renders that registry. adminOnly during the pilot.
      //
      // ── Participate group (Phase 1) ───────────────────────────────────
      //
      // ONE participation mechanism, two Lab expressions. Every component here
      // is the module the Research Lab's Participation group already mounts;
      // none is a venture-specific fork. What differs is the DOMAIN they are
      // configured for and the language around them — exactly the asymmetry the
      // cross-Lab ruling preserves.
      id: 'venture-participate-overview',
      label: 'Overview',
      slug: 'venture-participate-overview',
      enabled: true,
      group: 'participate',
      order: 0,
      type: 'static',
      config: { component: 'AgentiqCartridgeTab', props: { packId: 'alpha-knyt', collectionId: 'col_venture_lab' } },
      metadata: { icon: 'LayoutDashboard', description: 'How participation works in the Venture Lab — roles, entry, and what a participant can do', color: 'amber' },
    },
    {
      id: 'venture-participate-apply',
      label: 'Apply',
      slug: 'venture-participate-apply',
      enabled: true,
      group: 'participate',
      order: 1,
      type: 'static',
      config: { component: 'PassportBureauApplyTab', props: {} },
      metadata: { icon: 'FileSignature', description: 'Apply or claim an invitation to a venture programme or partner pilot', color: 'amber' },
    },
    {
      id: 'venture-participate-delegation',
      label: 'Delegation',
      slug: 'venture-participate-delegation',
      enabled: true,
      group: 'participate',
      order: 2,
      type: 'static',
      config: { component: 'BoundedDelegationTab', props: {} },
      metadata: { icon: 'Bot', description: 'Sponsor and bound an agent to act for you in a venture programme', color: 'amber' },
    },
    {
      id: 'venture-participate-locker',
      label: 'Locker',
      slug: 'venture-participate-locker',
      enabled: true,
      group: 'participate',
      order: 3,
      type: 'static',
      config: { component: 'LockerTab', props: {} },
      metadata: { icon: 'Lock', description: 'Your sovereign Locker — private by default, shared only by explicit act (Tier 1)', color: 'amber' },
    },
    {
      id: 'venture-participate-standing',
      label: 'Standing',
      slug: 'venture-participate-standing',
      enabled: true,
      group: 'participate',
      order: 4,
      type: 'static',
      config: { component: 'ParticipationStandingTab', props: {} },
      metadata: { icon: 'Award', description: 'Your standing, reach and receipted contribution history', color: 'amber' },
    },
    {
      id: 'venture-participate-steward',
      label: 'Steward',
      slug: 'venture-participate-steward',
      enabled: true,
      // TIER 0 — THE PLATFORM STEWARD SURFACE. Stays admin-gated (operator,
      // 2026-07-28: "VL — Steward should be admin gated"), and two ratified
      // canaries hold it there: `tests/tier-surface-map.test.ts` ("every
      // entrance keeps a steward, and it stays admin-gated") and
      // `tests/partner-workspace.test.ts` ("the steward surface is the only
      // adminOnly one" in the Participate group).
      //
      // TWO-TIER AUTHORITY LIVES ACROSS TWO SURFACES, NOT ON THIS ONE. The
      // operator's follow-on requirement — a partner administrator invites into
      // their own pilot "so that we don't become the gate for that" — is served
      // by the Partner group's Tier 2 `partner-collaborate` tab (ratified
      // 2026-07-27, `participationDomain: 'venture-lab'`), whose Invitations
      // view mounts this SAME StewardParticipationTab on the venture domain.
      // Widening this tab instead would have collapsed the two tiers back onto
      // one surface and removed the platform gate the operator asked to keep.
      //
      // What changed on 2026-07-28 is the SERVER, not this gate:
      // /api/steward/participation[/invitations] now derives a delegated tier
      // from the caller's own grants, so a venture-lab steward can issue from
      // the Tier 2 surface — bounded to the domains and pilots their grant
      // covers, and never able to confer a steward role (no grant-upward).
      // See services/passport/participationAccess.ts.
      adminOnly: true,
      group: 'participate',
      order: 5,
      type: 'static',
      // The SAME steward workspace the Passport and Research Lab domains use,
      // opened on the venture-lab domain. `initialDomain` is the only difference.
      config: { component: 'StewardParticipationTab', props: { initialDomain: 'venture-lab' } },
      metadata: { icon: 'Gavel', description: 'Issue and revoke venture-domain invitations — steward only', color: 'amber' },
    },
    {
      // ── THE PUBLIC WORKSPACE (operator ruling, 2026-07-28) ────────────────
      //
      // MOVED OUT OF THE PARTNER GROUP INTO PARTICIPATE. This is the workspace
      // Overview surface — objectives, layer owners, the Command Center, and
      // the overview-area deep links. It was the Partner group's first tab
      // ("Partner Workspace"); it is now the Participate group's public
      // entrance, and its label is deliberately PARTNER-AGNOSTIC.
      //
      // THE OPERATOR'S SPECIFICATION, which matters more than the mechanics:
      // Participate is the cross-partner, cross-programme surface. Every user
      // with Venture Lab access gets an iteration of it. metaMe can run
      // cross-partner pilots here and invite (e.g.) Founder Office operators
      // into partner programmes; partners can invite their own ecosystems. The
      // SAME invitation system serves both directions. This tab dynamically
      // surfaces whichever partner public space the viewing cohort qualifies
      // for — which is why the label must not say "Partner", and why NOTHING
      // here names a partner.
      //
      // HORIZEN IS NOT HARDCODED, AND MUST NEVER BE. The qualifying
      // workspace(s) resolve from the caller's own cohort grants inside
      // PartnerProgrammesTab (`scopesGrantedIn` over the registry), and the
      // pilot badge/selector chip is the mechanism that lets one partner-
      // agnostic tab serve N partners. That today only Horizen qualifies falls
      // out of the DATA (`PARTNER_WORKSPACES` has one entry), not out of any
      // conditional here. This is the scaling path for pilots and ventures
      // across both ecosystems.
      //
      // WHY THIS DOES NOT WIDEN ANYTHING (the highest-risk part of the move —
      // a surface leaving an admin-adjacent group for one every Venture Lab
      // user can see):
      //   · `participationDomain: 'venture-lab'` is KEPT — "Venture Lab
      //     access" is exactly a venture-lab grant, so a caller with no grant
      //     still never sees the tab (canary 6).
      //   · `participationRoles` is DROPPED — deliberately, and it is the one
      //     genuine access-model change in this ruling. The Amendment G
      //     restriction ("Partner access requires domain + scope + role")
      //     continues to hold in full over the PARTNER group, which is what it
      //     was written to protect. This is a different, deliberately public
      //     surface.
      //   · COHORT ISOLATION IS UNTOUCHED and is the invariant that actually
      //     matters here: the workspace CONTENT is scope-filtered per caller
      //     (`satisfiesWorkspaceScope` / `scopesGrantedIn`, deny-by-default),
      //     server-enforced in /api/venture/workspace/[workspaceId]. The tab
      //     may be visible while it resolves to "no qualifying workspace";
      //     what can never happen is one cohort seeing another's public
      //     workspace. Canaries 1, 4 and 11 hold that from both sides.
      //   · `workspaceVisibility: 'public'` clamps the component to its public
      //     surface set, so no private area (Collaborate / Operate /
      //     Communicate / Administration) is reachable from this entrance even
      //     if a future edit mis-set `initialSurface`.
      //
      // The id and slug are UNCHANGED across the move — they are what existing
      // `?tab=` deep links and the workspace's own `fromTab` resolve against,
      // and a dangling `?tab=` silently lands the operator on the cartridge's
      // default tab rather than erroring.
      id: 'partner-programmes',
      label: 'Public Workspace',
      slug: 'partner-programmes',
      enabled: true,
      // Tier 2 — visible on venture-lab participation, not platform admin.
      participationDomain: 'venture-lab',
      group: 'participate',
      order: 6,
      type: 'static',
      config: {
        component: 'PartnerProgrammesTab',
        props: { initialSurface: 'overview', workspaceVisibility: 'public' }
      },
      metadata: {
        icon: 'LayoutDashboard',
        description: 'Public Workspace — the partner public space your cohort qualifies for: Command Center, objectives, and layer owners',
        color: 'amber'
      }
    },
    {
      // ── THE PARTNER PRIVATE WORKSPACE'S TABS ─────────────────────────────
      //
      // THE PARTNER DOMAIN'S TABS (operator, 2026-07-27, revising the same
      // day's first cut). Seen in situ, the earlier shape rendered TWO menus for
      // one concept: a tier-3 row above and the component's own surface row
      // below the Pilot Command Center. The operator's correction — "we use the
      // standard cartridge menu and use that to drive the content beneath the
      // pilot command centre rather than having another menu again beneath the
      // command centre" — makes each area a first-class tab of the Partner
      // group. One navigation, the cartridge's own.
      //
      // ONE component, N entrances: every tab renders `PartnerProgrammesTab`
      // with its area pre-selected (`inv.engineering.036` — a component per area
      // would be the parallel implementation this avoids). The component keeps
      // the Pilot Command Center above the area content, so the command centre
      // is present on every tab exactly as it was.
      //
      // Collaborate is now the group's FIRST tab: the Overview entrance moved
      // to Participate as "Public Workspace" (see above), so what remains is
      // the partner↔metaProof bilateral record, which is what the component's
      // header now names — "Partner Private Workspace".
      id: 'partner-collaborate',
      label: 'Collaborate',
      slug: 'partner-collaborate',
      enabled: true,
      // Tier 2 — visible on venture-lab participation, not platform admin.
      participationDomain: 'venture-lab',
      // ROLE RESTRICTION — see partner-programmes above.
      participationRoles: ['partner-operator', 'workspace-steward'],
      group: 'partner',
      order: 0,
      type: 'static',
      config: {
        component: 'PartnerProgrammesTab',
        props: { initialSurface: 'collaborate' }
      },
      metadata: {
        icon: 'Users',
        description: 'Invitations, peer exchange, and the venture-scoped Locker',
        color: 'amber'
      }
    },
    {
      id: 'partner-operate',
      label: 'Operate',
      slug: 'partner-operate',
      enabled: true,
      // Tier 2 — visible on venture-lab participation, not platform admin.
      participationDomain: 'venture-lab',
      // ROLE RESTRICTION — see partner-programmes above.
      participationRoles: ['partner-operator', 'workspace-steward'],
      group: 'partner',
      order: 1,
      type: 'static',
      config: {
        component: 'PartnerProgrammesTab',
        props: { initialSurface: 'operate' }
      },
      metadata: {
        icon: 'Rocket',
        description: 'Delivery surfaces the pilot runs on',
        color: 'amber'
      }
    },
    {
      id: 'partner-evidence',
      label: 'Evidence',
      slug: 'partner-evidence',
      enabled: true,
      // Tier 2 — visible on venture-lab participation, not platform admin.
      participationDomain: 'venture-lab',
      // ROLE RESTRICTION — see partner-programmes above.
      participationRoles: ['partner-operator', 'workspace-steward'],
      group: 'partner',
      order: 2,
      type: 'static',
      config: {
        component: 'PartnerProgrammesTab',
        props: { initialSurface: 'evidence' }
      },
      metadata: {
        icon: 'FileCheck',
        description: 'Receipts and the canonical evidence record',
        color: 'amber'
      }
    },
    {
      id: 'partner-communicate',
      label: 'Communicate',
      slug: 'partner-communicate',
      enabled: true,
      // Tier 0 for now. The audit's target posture is two-stage — drafting
      // internal, approved output shared (§B.3) — and until the approval step
      // exists, the whole surface stays internal. Widening it first would
      // publish drafts, which is the failure the two-stage design prevents.
      adminOnly: true,
      group: 'partner',
      order: 3,
      type: 'static',
      config: {
        component: 'PartnerProgrammesTab',
        props: { initialSurface: 'communicate' }
      },
      metadata: {
        icon: 'MessageSquare',
        description: 'Partner communication surfaces — linked, never forked',
        color: 'amber'
      }
    },
    {
      // TIER 0 — Partner Administration. The internal programme space the
      // audit found had no home (§B.3): internal partner assessment,
      // negotiation posture, commercial assumptions, internal risk analysis,
      // pre-release reporting. Splitting it out is what lets the Tier 2 views
      // above open to partner operators without exposing any of this.
      id: 'partner-administration',
      label: 'Administer',
      slug: 'partner-administration',
      enabled: true,
      adminOnly: true,
      group: 'partner',
      order: 4,
      type: 'static',
      config: {
        component: 'PartnerProgrammesTab',
        props: { initialSurface: 'administration' }
      },
      metadata: {
        icon: 'Lock',
        description: 'Internal programme space — assessment, posture, assumptions, risk. Never shared with the partner',
        color: 'slate'
      }
    },
    {
      // PRD-GJR-001 (Guided Journey Runtime) — the Pilot > Journey view
      // (§6.1, §14). Orchestrates the Horizen x MoneyPenny constitutional
      // admission pilot: a compact stage bar over real, live platform
      // surfaces, never a parallel demo app. See services/journey/. Ordered
      // last in the Partner sub-menu, per operator UI review (2026-07-31).
      id: 'partner-pilot-journey',
      label: 'Journey',
      slug: 'partner-pilot-journey',
      enabled: true,
      // Tier 2 — visible on venture-lab participation, not platform admin.
      participationDomain: 'venture-lab',
      // ROLE RESTRICTION — see partner-programmes above.
      participationRoles: ['partner-operator', 'workspace-steward'],
      group: 'partner',
      order: 5,
      type: 'static',
      config: {
        component: 'PartnerProgrammesTab',
        props: { initialSurface: 'journey' }
      },
      metadata: {
        icon: 'Milestone',
        description: 'The Guided Journey Runtime — Horizen x MoneyPenny constitutional admission pilot',
        color: 'amber'
      }
    },
    {
      id: 'alpha-programme',
      label: 'α Programme',
      slug: 'alpha-programme',
      enabled: true,
      adminOnly: true,
      group: 'grow',
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
      // GROW, NOT ADMINISTER (operator ruling, 2026-07-28). AgentiQ OS α is a
      // PUBLIC surface — the builder substrate dashboard anyone growing on the
      // platform needs — and it sat in the internal Administer group behind
      // `adminOnly`, which both hid it from its own audience and mis-stated
      // what it is. It joins Grow as a sub-item beside Growth Matrix (order 0,
      // public) and α Programme (order 1, adminOnly); the gate it drops was
      // mis-scoping, not protection, so nothing behind it becomes newly
      // readable that was not already public.
      id: 'agentiq-os-vl',
      label: 'AgentiQ OS α',
      slug: 'agentiq-os-vl',
      enabled: true,
      adminOnly: false,
      group: 'grow',
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
      group: 'connect',
      order: 1,
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
      group: 'administer',
      order: 2,
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
      /*
       * REVIEW QUEUE, MIRRORED (operator, 2026-08-03).
       *
       * The SAME component the Polity Passport Bureau's own Steward tab mounts
       * (`passport-bureau-steward`) — never a second queue, so the two
       * surfaces cannot disagree about which applications are open
       * (inv.engineering.036/037). Mirrored here so a Delegate Passport
       * application raised by the Venture Lab Journey can be decided without
       * leaving the cartridge.
       *
       * `adminOnly: true` carries the ORIGINAL's gate. Mirroring a surface must
       * never become a route around one (CLAUDE.md Security — never weaken an
       * access gate).
       */
      id: 'venture-lab-steward-queue',
      label: 'Review Queue',
      slug: 'review-queue',
      enabled: true,
      adminOnly: true,
      group: 'administer',
      order: 0,
      type: 'static',
      config: {
        component: 'PassportBureauStewardTab',
        props: {}
      },
      metadata: {
        icon: 'Gavel',
        description: 'Steward review queue — approve, deny or request info on passport applications, mirrored from the Polity Passport Bureau',
        color: 'violet'
      }
    },
    {
      id: 'plan-pricing',
      label: 'Plan Pricing',
      slug: 'plan-pricing',
      enabled: true,
      adminOnly: true,
      group: 'administer',
      order: 1,
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
      group: 'grow',
      order: 0,
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
      group: 'operate',
      order: 1,
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
  name: 'metaMe',
  slug: 'metame',
  enabled: true,
  version: '1.0.0',
  owner: 'metame-guardian',
  copilot: {
    accentColor: 'emerald',
    agent: { id: 'aigent-me', name: 'aigentMe' },
    promptPlaceholder: 'Ask aigentMe about your ExperienceModel, briefs, or next move...',
    initialMessage: "I'm aigentMe — your sovereign chief of staff inside metaMe. I know your active ExperienceModel, your goals, the cartridges you're moving forward, and which specialists I can coordinate. Ask me anything.",
    quickPrompts: ['Brief me', 'Move this forward', 'Review venture progress', 'Ask Marketa', 'Ask Quill', 'Ask Kn0w1', 'Ask Nakamoto'],
  },
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
    { id: 'research',     label: 'Research',         icon: 'FlaskConical', order: 0.85, activationId: 'researcher' },
    { id: 'vl',           label: 'Venture Lab',      icon: 'TrendingUp', order: 1,   activationId: 'venture-lab' },
    { id: 'marketa',      label: 'Marketa',          icon: 'Megaphone',  order: 2,   activationId: 'marketa' },
    { id: 'studio',       label: 'metaMe Studio',    icon: 'Wand2',      order: 3,   activationId: 'metame-studio' },
    { id: 'hms',          label: 'Human Mobility',   icon: 'Plane',      order: 3.5, activationId: 'human-mobility-services' },
    { id: 'polity-core',  label: 'Polity Core',      icon: 'Landmark',   order: 0.55, activationId: 'polity-core' },
    { id: 'agentiqos',    label: 'AgentiQ OS',       icon: 'Cpu',        order: 4,   activationId: 'agentiq-os' },
    { id: 'passport',     label: 'Passport',          icon: 'ShieldCheck',order: -0.5 },
    { id: 'standing',     label: 'Standing',         icon: 'Star',       order: 4.6, activationId: 'standing-cartridge' },
    { id: 'moneypenny',   label: 'MoneyPenny',       icon: 'TrendingUp', order: 3.9, activationId: 'moneypenny' },
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
      label: 'myCanvas',
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
      order: 5,
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
    {
      id: 'myresearch',
      label: 'myResearch',
      slug: 'my-research',
      enabled: true,
      activationId: 'mycanvas',
      group: 'mycluster',
      order: 3,
      type: 'static',
      config: { component: 'MyResearchTab', props: {} },
      metadata: {
        icon: 'FlaskConical',
        description: 'Live research programme state — experiments, lifecycle, recent findings',
        color: 'violet',
      },
    },
    {
      id: 'mysoftware',
      label: 'mySoftware',
      slug: 'my-software',
      enabled: true,
      activationId: 'mycanvas',
      group: 'mycluster',
      order: 4,
      type: 'static',
      config: { component: 'MySoftwareTab', props: {} },
      metadata: {
        icon: 'Code',
        description: 'Software, agents, and capabilities you have built through the Developer strand',
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

    // ── MoneyPenny group (activation-gated) — mirrors the real MoneyPenny
    // Orchestration console into metaMe via the SAME MoneyPennyPanelTab
    // component + panel prop the standalone MONEYPENNY_CARTRIDGE's own
    // 'moneypenny-service-orchestration' tab uses (see that cartridge's
    // definition below) — never a bespoke FS-only card. Orchestration is
    // deliberately the ONLY mirrored panel: it's the mode chooser, and
    // Advisor/Architect/Runtime stay reachable only from there, never
    // defaulted into directly from the catalogue.
    {
      id: 'metame-moneypenny-orchestration',
      label: 'MoneyPenny',
      slug: 'moneypenny-orchestration',
      enabled: true,
      activationId: 'moneypenny',
      group: 'moneypenny',
      order: 0,
      type: 'static',
      config: { component: 'MoneyPennyPanelTab', props: { panel: 'service-orchestration' } },
      metadata: {
        icon: 'TrendingUp',
        description: 'Aigent MoneyPenny — Orchestration console (choose Advisor / Architect / Runtime)',
        color: 'emerald',
      },
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

    // ── research group (first-class, activation-gated) ───────────────────────
    // The Research Copilot as a top-level metaMe menu item — the researcher
    // pathway's peer to the aigentZ Command Center. Gated by the 'researcher'
    // activation (Sovereignty T1, same tier + entitlement as aigentZ). Feeds
    // the gated internal Research Copilot; IRL OS carries the public edition.
    {
      id: 'metame-research-copilot',
      label: 'Research Copilot',
      slug: 'irl-research-copilot',
      enabled: true,
      group: 'research',
      order: 0,
      type: 'static',
      config: { component: 'IRLResearchCopilotTab', props: {} },
      metadata: { icon: 'FlaskConical', description: 'IRL Research Copilot — invariant substrate, experiments, and validation workflow', color: 'violet' },
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
      // Wired 2026-08-11 (was PlaceholderTab, "Coming soon") — the canonical
      // Qriptopian Pulse moderation queue, mirroring KNYT > Admin > Community
      // Admin's exact reuse pattern: QriptoPulseAdminTab is the SAME
      // KnytCommunityContentAdminTab component, scoped via cartridge='qripto'
      // (app/triad/components/codex/tabs/QriptoPulseAdminTab.tsx) — inherits
      // Promote / Runtime / Reject / Delete and the existing
      // requireCommunityAdmin gate unchanged. Gated the SAME way its sibling
      // 'qriptopia-admin' tab is (adminOfCartridge, not the platform-wide
      // adminOnly flag) so a Qriptopian-cartridge admin who isn't a
      // platform-wide admin can still moderate. No new table, no new
      // approval workflow — this is the same surface QRIPTO_CODEX's own
      // 'admin-pulse' tab already wires, reached here via metaMe's mirror.
      id: 'qriptopia-community',
      label: 'Community',
      slug: 'qriptopia-community',
      enabled: true,
      adminOfCartridge: 'qripto',
      group: 'qriptopia',
      order: 51,
      type: 'static',
      config: {
        component: 'QriptoPulseAdminTab'
      },
      metadata: { icon: 'Shield', description: 'Qriptopian Pulse moderation queue', color: 'violet' }
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
  copilot: {
    accentColor: 'rose',
    agent: { id: 'aigent-marketa', name: 'Marketa' },
    promptPlaceholder: 'Ask Marketa about campaigns, partners, or content...',
    initialMessage: "I'm Marketa — your venture studio copilot. Ask me about the active campaigns, partner activation, content packs, or what to do next.",
    quickPrompts: ['Campaign status', 'Next email to fire', 'Partner pipeline', 'Write a social post', 'Propose a content pack'],
  },
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
// MONEYPENNY_CARTRIDGE — hand-curated (SPEC-VLM-001 Phase 2, 2026-07-24 —
// CFS-050 Sovereignty Navigation's second applied test case, after Venture
// Lab). Before this, MoneyPenny's codex was auto-generated by packRegistry
// from a single collection into ONE CodexTab wrapping the whole
// `MoneyPennyCartridge` component -- which forced her to hand-roll her own
// flat ten-tab bar, since `CodexPanelDynamic` skips its own two-level nav
// chrome whenever a cartridge has ≤1 tab. This hand-curated definition
// gives her ten real CodexTabs (grouped Operate/Connect/Service/Administer,
// same Standard Cartridge Navigation Framework Venture Lab now uses)
// instead. Its id ('moneypenny-codex') intentionally matches the auto-gen
// codex's own id -- `app/api/codex/registry/route.ts`'s
// `CODEX_DEFINITIONS.filter(...)` dedup already suppresses the pack-driven
// duplicate by id collision, the exact same mechanism MARKETA_CARTRIDGE
// above already relies on (no packRegistry.ts skip-list edit needed).
//
// The pre-existing standalone `/moneypenny` route
// (`app/(shell)/moneypenny/page.tsx` → `MoneyPennyCartridge.tsx`) is
// UNTOUCHED by this -- it keeps its own flat ten-tab bar exactly as
// before. The ten panel components it wraps (`HFTConsole`,
// `MoneyPennyChat`, etc.) are reused unchanged by the codex-side tabs
// below via `MoneyPennyPanelTab.tsx`'s dispatcher -- extend, don't
// duplicate.
export const MONEYPENNY_CARTRIDGE: CodexConfig = {
  id: 'moneypenny-codex',
  name: 'Aigent MoneyPenny',
  slug: 'moneypenny',
  enabled: true,
  version: '1.0.0',
  owner: 'aigent-moneypenny',
  metadata: {
    description: 'Aigent MoneyPenny — the Constitutional Financial Services Agent. Real-time HFT console, portfolio analytics, strategy building, and the constitutional Financial Services Runtime (PRD-MPY-001)',
    icon: 'TrendingUp',
    color: 'emerald',
    category: 'finance',
    tags: ['moneypenny', 'finance', 'trading', 'hft', 'constitutional-runtime'],
  },
  // Journey Runtime copilot invariant (item 1, semantic repair 2026-08-25) —
  // this cartridge previously had no `copilot` config; the Financial
  // Services Bridge (components/journey/FinancialServicesBridgeFrontDoor.tsx)
  // hand-duplicated this exact identity locally. Now the canonical source
  // both that page and the Horizen/FS Journey's copilot reference resolve
  // from.
  copilot: {
    accentColor: 'emerald',
    agent: { id: 'aigent-moneypenny', name: 'MoneyPenny' },
    promptPlaceholder: 'Ask MoneyPenny...',
    quickPrompts: [
      'What can MoneyPenny help me with here?',
      'What is my Financial Services status?',
      'What can Runtime actually do for me?',
    ],
  },
  tabGroups: [
    // Label-only rebrand (2026-08-25, operator direction): this group is
    // principally the HFT capability cluster (HFT Console / Portfolio /
    // Strategies / SmartTriad) — the LABEL changes to "HFT"; the id stays
    // 'operate' so deep links, stored tab state, bridge descriptors, tests,
    // activation references, and Differ baselines that key on the id are
    // unaffected.
    { id: 'operate',    label: 'HFT',        icon: 'Rocket',   order: 0 },
    { id: 'connect',    label: 'Connect',    icon: 'Users',    order: 1 },
    { id: 'service',    label: 'Service',    icon: 'Landmark', order: 2 },
    { id: 'administer', label: 'Administer', icon: 'Settings', order: 3 },
  ],
  tabs: [
    // SPEC-MPY-002 (2026-09-01) MPY2-1 — the capability-led landing hub
    // ("OVERVIEW" in the spec's §2.1 capability axis). Added as a TAB, not a
    // new tabGroup: `tabGroups` below is deliberately left untouched
    // (pinned exactly by tests/fs-operate-embed-viewport-parity.test.ts's
    // groupIds canary) — the Understand/Design/Markets/Operate/Monitor
    // capability grouping lives one level down, inside this tab and the
    // MoneyPennyCapabilityRail every panel renders alongside its content
    // (app/(shell)/moneypenny/components/moneypennyCapabilities.ts).
    // order: -1 so it renders first without renumbering the existing HFT
    // Console/Portfolio/Strategies/SmartTriad siblings.
    {
      id: 'moneypenny-overview',
      label: 'Overview',
      slug: 'overview',
      enabled: true,
      adminOnly: false,
      group: 'operate',
      order: -1,
      type: 'static',
      config: { component: 'MoneyPennyPanelTab', props: { panel: 'overview' } },
      metadata: { icon: 'LayoutGrid', description: 'Capability overview — Understand, Design, Markets, Operate, Monitor', color: 'emerald' },
    },
    {
      id: 'moneypenny-hft-console',
      label: 'HFT Console',
      slug: 'hft-console',
      enabled: true,
      adminOnly: false,
      group: 'operate',
      order: 0,
      type: 'static',
      config: { component: 'MoneyPennyPanelTab', props: { panel: 'hft-console' } },
      metadata: { icon: 'TrendingUp', description: 'Real-time quotes and execution', color: 'emerald' },
    },
    // SPEC-MPY-002 (2026-09-01) MPY2-2 — Understand / Financial Profile.
    // group: 'operate' — tabGroups itself is pinned exactly by
    // tests/fs-operate-embed-viewport-parity.test.ts (groupIds canary);
    // this reuses the existing group, same as every sibling tab below.
    {
      id: 'moneypenny-financial-profile',
      label: 'Financial Profile',
      slug: 'financial-profile',
      enabled: true,
      adminOnly: false,
      group: 'operate',
      order: 0.5,
      type: 'static',
      config: { component: 'MoneyPennyPanelTab', props: { panel: 'financial-profile' } },
      metadata: { icon: 'FileText', description: 'Bank-statement-derived aggregates and a candidate risk envelope', color: 'emerald' },
    },
    // SPEC-MPY-002 (2026-09-01) MPY2-3 — Design / Risk & Limits.
    {
      id: 'moneypenny-risk-envelope',
      label: 'Risk & Limits',
      slug: 'risk-envelope',
      enabled: true,
      adminOnly: false,
      group: 'operate',
      order: 0.6,
      type: 'static',
      config: { component: 'MoneyPennyPanelTab', props: { panel: 'risk-envelope' } },
      metadata: { icon: 'ShieldAlert', description: 'Risk factors and recommended limits derived from the Financial Profile', color: 'emerald' },
    },
    {
      id: 'moneypenny-portfolio',
      label: 'Portfolio',
      slug: 'portfolio',
      enabled: true,
      adminOnly: false,
      group: 'operate',
      order: 1,
      type: 'static',
      config: { component: 'MoneyPennyPanelTab', props: { panel: 'portfolio' } },
      metadata: { icon: 'BarChart3', description: 'Analytics and performance', color: 'emerald' },
    },
    {
      id: 'moneypenny-strategies',
      label: 'Strategies',
      slug: 'strategies',
      enabled: true,
      adminOnly: false,
      group: 'operate',
      order: 2,
      type: 'static',
      config: { component: 'MoneyPennyPanelTab', props: { panel: 'strategies' } },
      metadata: { icon: 'Target', description: 'Build and manage strategies', color: 'emerald' },
    },
    {
      id: 'moneypenny-smarttriad',
      label: 'SmartTriad',
      slug: 'smarttriad',
      enabled: true,
      adminOnly: false,
      group: 'operate',
      order: 3,
      type: 'static',
      config: { component: 'MoneyPennyPanelTab', props: { panel: 'smarttriad' } },
      metadata: { icon: 'Settings', description: 'Trading operations hub', color: 'emerald' },
    },
    {
      id: 'moneypenny-chat',
      label: 'AI Assistant',
      slug: 'chat',
      enabled: true,
      adminOnly: false,
      group: 'connect',
      order: 0,
      type: 'static',
      config: { component: 'MoneyPennyPanelTab', props: { panel: 'chat' } },
      metadata: { icon: 'MessageCircle', description: 'MoneyPenny trading assistant', color: 'emerald' },
    },
    {
      id: 'moneypenny-crm',
      label: 'CRM',
      slug: 'crm',
      enabled: true,
      adminOnly: false,
      group: 'connect',
      order: 1,
      type: 'static',
      config: { component: 'MoneyPennyPanelTab', props: { panel: 'crm' } },
      metadata: { icon: 'Users', description: 'Contributions and tasks', color: 'emerald' },
    },
    {
      id: 'moneypenny-x402',
      label: 'X402',
      slug: 'x402',
      enabled: true,
      adminOnly: false,
      group: 'service',
      order: 0,
      type: 'static',
      config: { component: 'MoneyPennyPanelTab', props: { panel: 'x402' } },
      metadata: { icon: 'Zap', description: 'Payment settlements', color: 'emerald' },
    },
    {
      id: 'moneypenny-architect',
      label: 'Architect',
      slug: 'architect',
      enabled: true,
      adminOnly: false,
      group: 'service',
      order: 1,
      type: 'static',
      config: { component: 'MoneyPennyPanelTab', props: { panel: 'architect' } },
      metadata: { icon: 'Compass', description: 'Design constitutional financial structures (PRD-MPY-001)', color: 'emerald' },
    },
    {
      id: 'moneypenny-runtime',
      label: 'Runtime',
      slug: 'runtime',
      enabled: true,
      adminOnly: false,
      group: 'service',
      order: 2,
      type: 'static',
      config: { component: 'MoneyPennyPanelTab', props: { panel: 'runtime' } },
      metadata: { icon: 'Cpu', description: 'Constitutional service pattern — shadow/authoritative runtime (PRD-MPY-001)', color: 'emerald' },
    },
    {
      id: 'moneypenny-service-orchestration',
      label: 'Orchestration',
      slug: 'service-orchestration',
      enabled: true,
      adminOnly: false,
      group: 'service',
      order: 3,
      type: 'static',
      config: { component: 'MoneyPennyPanelTab', props: { panel: 'service-orchestration' } },
      metadata: { icon: 'Network', description: 'Oversight console — admitted agents consuming MoneyPenny Financial Services (Phase 3)', color: 'emerald' },
    },
    {
      id: 'moneypenny-identity',
      label: 'Identity',
      slug: 'identity',
      enabled: true,
      adminOnly: false,
      group: 'administer',
      order: 0,
      type: 'static',
      config: { component: 'MoneyPennyPanelTab', props: { panel: 'identity' } },
      metadata: { icon: 'Wallet', description: 'FIO and persona management', color: 'emerald' },
    },
  ],
  permissions: {
    view: ['*'],
    edit: ['aigent-moneypenny', 'admin'],
    admin: ['aigent-moneypenny', 'admin'],
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
  copilot: {
    accentColor: 'violet',
    agent: { id: 'aigent-z', name: 'Aigent Z' },
    promptPlaceholder: 'Ask about your passport, agent delegation, or locker…',
    initialMessage: "I'm Aigent Z — your guide through the Polity Passport Bureau. Citizen Passports, Participant Passports, agent genesis, bounded delegation, the Locker, ENS, and verifiable credentials — ask me anything.",
    quickPrompts: ['How do I claim a Citizen Passport?', 'How do I sponsor an agent?', 'What does World ID verification add?', 'Show my bound agents', 'How does the Locker work?'],
  },
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
    {
      // Constitutional Access Service (2026-07-18): one invitation/grant
      // mechanism across every permissioned area (passport, research lab,
      // venture lab, metaMe studio, developer studio). Surfaces as a
      // Steward sub-tab wherever the Steward tab mounts (subTabs getter).
      id: 'passport-bureau-access',
      label: 'Access & Invitations',
      slug: 'access-invitations',
      enabled: true,
      adminOnly: true,
      group: 'steward',
      order: 1,
      type: 'static',
      config: { component: 'StewardParticipationTab' },
      metadata: { icon: 'Award', description: 'Issue and steward bounded bearer invitations and access grants across all permissioned domains', color: 'violet' },
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
  copilot: {
    accentColor: 'emerald',
    agent: { id: 'aigent-z', name: 'aigentMe' },
    promptPlaceholder: 'Ask about your case, workstreams, or critical dates…',
    initialMessage: "I'm aigentMe — your confidentiality guardian for this mobility case. BlakQube protocol is active. Ask me about housing, education, relocation timelines, or workstream status.",
    quickPrompts: ['What are the most urgent deadlines?', 'What is the housing workstream status?', 'What school applications are pending?', 'Summarise the relocation timeline', 'What does BlakQube compartmentalisation mean for this case?'],
  },
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
  name: 'Standing',
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
      id: 'polity-core-commentary-constitutional-internet',
      label: 'The Constitutional Internet',
      slug: 'commentary-constitutional-internet',
      enabled: true,
      // Working-manuscript development material — admin-only (2026-08-12
      // forensic correction pass). This tab surfaces the book's live
      // manuscript, editorial master, register and source/evidence matrix;
      // the public-facing Bridge deep-links to the Qriptopian Codex's
      // published "Polity Papers" series instead (never this tab). Uses the
      // existing Codex access-gate system — no second CI-specific
      // permission mechanism.
      adminOnly: true,
      group: 'commentary',
      order: 3,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'polity-core',
          collectionId: 'col_commentary_constitutional_internet',
          defaultPath: 'items/commentary/constitutional-internet/00-project-structure.md',
        },
      },
      metadata: { icon: 'BookOpen', description: 'The Constitutional Internet book project — manuscript, editorial master, register, and source & evidence matrix', color: 'violet' },
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
// IRL — Constitutional Cybernetics Research Laboratory (CFS-019, Phase B)
// The canonical research SURFACE: every research asset reachable here, in
// place (canonical-surface-first migration; physical consolidation into a
// irl pack is Phase D). Hand-curated per the dual-source rule.
// ─────────────────────────────────────────────────────────────────────────────
export const IRL_CARTRIDGE: CodexConfig = {
  id: 'irl-cartridge',
  // TWO NAMES, ONE CARTRIDGE. `name` is the header, `shortName` is the
  // sidebar/picker — not a truncation of each other.
  //
  // Operator ruling 2026-07-28: "metaMe IRL is fine for header. IRL for
  // sidebar. Invariant Research Lab should be added as well — doesn't always
  // need the metaMe qualifier — so this should be added to the ontology."
  // `docs/platform-ontology.md` § Invariant Research Lab (amended same date)
  // now carries three contextual forms — full name, IRL, metaMe IRL — none a
  // fallback for the others. This cartridge uses the branded form in the
  // header (product context) and the abbreviation in the sidebar, per the
  // operator's explicit choice for THIS surface.
  name: 'metaMe IRL',
  shortName: 'IRL',
  slug: 'irl-cartridge',
  enabled: true,
  version: '1.0.0',
  owner: 'aigent-z',
  copilot: {
    accentColor: 'violet',
    agent: { id: 'aigent-researcher', name: 'IRL Guide' },
    promptPlaceholder: 'Ask about metaMe IRL research...',
    initialMessage: "I'm your guide to the internal Invariant Research Laboratory — instruments, live experiments, publications, and stewardship. Ask me anything about the lab.",
    quickPrompts: ['What experiments are running?', 'Show the latest results', 'Explain the Chrysalis Test', 'What needs steward approval?'],
  },
  metadata: {
    description: 'Constitutional Cybernetics Research Laboratory — the constitutional scientific institution: experiments, series, programmes, publications, and the living invariant substrate (CFS-019)',
    icon: 'FlaskConical',
    color: 'violet',
    category: 'cartridge',
    tags: ['irl', 'research', 'constitutional-cybernetics', 'experiments', 'invariants', 'publications'],
  },
  // Five-space IA (operator + Aletheon, 2026-07-18 — mirrors IRL_OS_CARTRIDGE):
  // Institution → Research → Laboratory → Publications → Participation.
  // Consequence Engineering + Living Knowledge fold into Laboratory/Research
  // as capabilities; Programme joins Institution; Participation is the
  // constitutional collaboration space.
  //
  // RESEARCH WORKSPACE — its OWN top-level group again, sited immediately
  // AFTER Participation (operator correction, 2026-07-29, later the same day
  // as the ruling below — see
  // codexes/packs/agentiq/updates/2026-07-29_workspace-restored-top-level-plus-color-and-irl-os.md).
  // The immediately-prior ruling ("RESEARCH WORKSPACE RELOCATED INSIDE
  // PARTICIPATION") folded Workspace into a tab nested inside Participation,
  // with its own former top-level tabs pushed one tier deeper into that tab's
  // `subTabs` — three tiers deep end to end (group → Workspace tab among
  // Participation's siblings → its subTabs). The operator tried the shipped
  // result and found it too deeply nested ("the triple menu system is looking
  // messy") and asked for Workspace to be elevated back to a first-class
  // top-level group, positioned right after Participation ("logical place
  // after request for participation then the user gets access to the
  // workspace").
  //
  // THE FIX IS DELIBERATELY MINIMAL: the `irl-workspace` tab object below is
  // UNCHANGED in every field except `group` (now `'workspace'`, was
  // `'participation'`) and `order` (now `0`, the sole tab in its own group).
  // Its `subTabs` array — the former nine (now seven, Locker/Participants
  // still pruned) top-level views — is untouched. Because `irl-workspace` is
  // the ONLY tab in the new `workspace` group, `CodexPanelDynamic` renders it
  // via the SAME "single-tab group with subTabs" path already used for
  // "Order of Metayé" (see that literal comment at
  // `app/triad/components/CodexPanelDynamic.tsx` — the subTabs row renders
  // inline on the breadcrumb instead of requiring an extra tab-selection step)
  // — so a caller clicks "Workspace" once and lands directly on its subTabs
  // (Overview, Pipeline, Review, Working Materials, QubeTalk, Administration).
  // That is the same two-tier shape every other top-level cartridge tab in
  // this system already has; nothing new was invented to achieve it.
  tabGroups: [
    { id: 'institution', label: 'Institution', icon: 'Landmark', order: 0 },
    { id: 'research', label: 'Research', icon: 'Layers', order: 1 },
    { id: 'laboratory', label: 'Laboratory', icon: 'FlaskConical', order: 2 },
    { id: 'publications', label: 'Publications', icon: 'BookOpen', order: 3 },
    { id: 'participation', label: 'Participation', icon: 'ShieldCheck', order: 4 },
    // Sited immediately after Participation (operator: "the user gets access
    // to the workspace" once they've joined) — LayoutGrid ties it visually to
    // the Companion's own "Workspace" nav item, unchanged from the prior ruling.
    { id: 'workspace', label: 'Workspace', icon: 'LayoutGrid', order: 5 },
  ],
  tabs: [
    {
      // IRL home / welcome landing (observer-aware) — first tab so the
      // internal lab also lands here. Mirrors the IRL OS welcome.
      id: 'irl-welcome',
      label: 'Welcome',
      slug: 'irl-welcome',
      enabled: true,
      // Access-boundary correction (2026-08-26): metaMe IRL is strictly
      // admin-gated — external IRL participation is always mediated through
      // IRL OS (irl-os-cartridge's own irl-os-welcome).
      adminOnly: true,
      group: 'institution',
      order: -1,
      type: 'static',
      config: { component: 'IRLWelcomeTab' },
      metadata: { icon: 'Sparkles', description: 'Welcome to the Invariant Research Lab — how to join, and where to go once you have', color: 'violet' },
    },
    {
      // Reciprocal Artifact Exchange (PRD-IRL-AX-001) — a GENERIC engagement
      // type: bilateral, receipted exchange of independently frozen research
      // artifacts, gated by reciprocal disclosure and a signing ritual. Not
      // admin-only: an invited counterparty (e.g. a partner researcher) must
      // reach this tab once their Passport/persona resolves. Server-side
      // membership enforcement (services/research/reciprocalExchange.ts)
      // means an uninvolved persona sees an empty/refused view regardless.
      id: 'irl-exchange',
      label: 'Exchange',
      slug: 'irl-exchange',
      enabled: true,
      group: 'laboratory',
      order: 5,
      type: 'static',
      config: { component: 'IRLExchangeTab' },
      metadata: { icon: 'GitBranch', description: 'Reciprocal Artifact Exchange — bilateral, receipted exchange of independently frozen research artifacts', color: 'violet' },
    },
    {
      id: 'irl-dashboard',
      label: 'Dashboard',
      slug: 'irl-dashboard',
      enabled: true,
      // Access-boundary correction (2026-08-26): metaMe IRL strictly admin-gated.
      adminOnly: true,
      group: 'institution',
      order: 0,
      type: 'static',
      config: { component: 'IRLDashboardTab', props: {} },
      metadata: { icon: 'Landmark', description: 'Mission, live programme status (Chrysalis Test), recent canonical results, roadmap', color: 'violet' },
    },
    {
      id: 'irl-research-copilot',
      label: 'Research Copilot',
      slug: 'irl-research-copilot',
      enabled: true,
      // Access-boundary correction (2026-08-26): metaMe IRL strictly admin-gated.
      adminOnly: true,
      group: 'institution',
      order: 0.5,
      type: 'static',
      // Ungated inside the internal research-lab workspace (the institution's
      // own surface). The PAID researcher-pathway route to this same copilot is
      // the metaMe 'research' group, gated by the 'researcher' activation
      // (Sovereignty T1) — peer to the aigentZ developer copilot. IRL OS carries
      // the free public instruments (Dashboard/Field/Registry) instead.
      config: { component: 'IRLResearchCopilotTab', props: {} },
      metadata: { icon: 'FlaskConical', description: 'aigentZ narrates the live lab state — DCIR-conforming, narrate-only (research proposal kinds are C2.1, CFS-019)', color: 'violet' },
    },
    {
      id: 'irl-charter',
      label: 'Charter',
      slug: 'irl-charter',
      enabled: true,
      // Access-boundary correction (2026-08-26): metaMe IRL strictly admin-gated.
      adminOnly: true,
      group: 'institution',
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_foundation', defaultPath: 'foundation/CFS-019_irl-charter.md' },
      },
      metadata: { icon: 'Scale', description: 'CFS-019 — the IRL constitution: layers, object model, lifecycles, migration, phases' },
    },
    // ── Research, by constitutional layer ─────────────────────────
    {
      id: 'layer-i',
      label: 'Layer I — Invariant Intelligence',
      slug: 'layer-i',
      enabled: true,
      // Access-boundary correction (2026-08-26): metaMe IRL strictly admin-gated.
      adminOnly: true,
      group: 'research',
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_foundation', defaultPath: 'foundation/appendix-a_canonical-invariants.md' },
      },
      metadata: { icon: 'BookMarked', description: 'Constitutional knowledge — the canon, the CFS corpus, the Foundational Validation Series (foundation complete)' },
    },
    {
      id: 'layer-ii',
      label: 'Layer II — Constitutional Computing',
      slug: 'layer-ii',
      enabled: true,
      // Access-boundary correction (2026-08-26): metaMe IRL strictly admin-gated.
      adminOnly: true,
      group: 'research',
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_foundation', defaultPath: 'foundation/CFS-015_operation-chrysalis-2-prd.md' },
      },
      metadata: { icon: 'Cpu', description: 'Constitutional execution — Operation Chrysalis 2.0, the Capability Pipeline, deployment authority (alpha)' },
    },
    {
      id: 'layer-iii',
      label: 'Layer III — Constitutional Cybernetics',
      slug: 'layer-iii',
      enabled: true,
      // Access-boundary correction (2026-08-26): metaMe IRL strictly admin-gated.
      adminOnly: true,
      group: 'research',
      order: 2,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_foundation', defaultPath: 'foundation/CFS-019_irl-charter.md' },
      },
      metadata: { icon: 'RefreshCw', description: 'Constitutional evolution — feedback, adaptation, multi-agent governance (nascent: the frontier)' },
    },
    // ── metaMe IRL — Invariant Research Lab ────────────────────────
    {
      id: 'irl-experiment-lab',
      label: 'Experiments',
      slug: 'irl-experiment-lab',
      enabled: true,
      adminOnly: true,
      group: 'laboratory',
      order: 0,
      type: 'static',
      config: { component: 'InvariantExperimentLab', props: {} },
      metadata: { icon: 'FlaskConical', description: 'metaMe Invariant Research Lab — run the series live: EXP-001–005 + Results (canonical publish) + Report + Chrysalis Test + Homecoming Test. Admin-only; runs spend provider credits.' },
    },
    {
      id: 'irl-protocols',
      label: 'Protocols & Articles',
      slug: 'irl-protocols',
      enabled: true,
      // Access-boundary correction (2026-08-26): metaMe IRL strictly
      // admin-gated — external participants use IRL OS's irl-os-protocols.
      adminOnly: true,
      group: 'laboratory',
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_experiments' },
      },
      metadata: { icon: 'Target', description: 'Experiment designs, protocols, canonical articles, evaluation frameworks' },
    },
                {
      id: 'irl-invariant-field',
      label: 'Invariant Field',
      slug: 'irl-invariant-field',
      enabled: true,
      // Access-boundary correction (2026-08-26): metaMe IRL strictly admin-gated.
      adminOnly: true,
      group: 'laboratory',
      order: 3,
      type: 'static',
      config: { component: 'InvariantFieldExplorerTab', props: {} },
      metadata: { icon: 'Network', description: 'Computational Epistemology made visible — the live enables/constrains/contradicts field + consequence forecast (CFS-019 Phase E first slice)', color: 'violet' },
    },
    // ── Corpus Scout + EXP-P1 Readiness — PRIMARY HOME (2026-07-23,
    // operator-directed). These are internal experimentation instruments;
    // metaMe IRL (this cartridge) is their canonical home, not IRL OS. The
    // irl-os-corpus-scout / irl-os-exp-p1-readiness entries in
    // IRL_OS_CARTRIDGE below are kept (not removed) — admin-visible there
    // too, deliberately stubbed as the future access point IF invariant
    // aggregation opens beyond admin (cohort/token/payment-gated), but not
    // built now. Both stay adminOnly: true in both cartridges either way.
    {
      id: 'irl-corpus-scout',
      label: 'Corpus Scout',
      slug: 'irl-corpus-scout',
      enabled: true,
      adminOnly: true,
      group: 'laboratory',
      order: 4,
      type: 'static',
      config: { component: 'CorpusScoutTab', props: {} },
      metadata: { icon: 'FileSearch', description: 'PRD-ICA-001 §9 — verify, review, and hand approved sources to the Discovery Engine. Retrieval → byte verification → human approval → add-evidence.', color: 'violet' },
    },
    {
      id: 'irl-exp-p1-readiness',
      label: 'EXP-P1 Readiness',
      slug: 'irl-exp-p1-readiness',
      enabled: true,
      adminOnly: true,
      group: 'laboratory',
      order: 5,
      type: 'static',
      config: { component: 'ExpP1ReadinessTab', props: {} },
      metadata: { icon: 'Gauge', description: 'PRD-EPI-001 §10 — seven per-gate readiness sections for EXP-P1 (protocol-ratified derivation, live). Execution/Publication are expected red pre-run.', color: 'violet' },
    },
    // ── Experiment / Constitutional / Invariant Registry (CFS-051,
    // Strand 1 build 2026-07-24) — the living register of candidate
    // experiments, candidate constitutional principles, candidate
    // structural invariants, and the research backlog.
    //
    // The API gate (services/research/registryAccess.ts) was WIDENED 2026-07-25
    // per the operator's "both" answer: admin OR a CAS `research-lab` grant OR
    // the configured token grants read+propose; CURATE stays platform-admin.
    // This TAB stays `adminOnly: true` deliberately — widening the API is
    // additive, but exposing a public proposal surface needs its own operator
    // authorization (CLAUDE.md "Security — Access Gates").
    {
      id: 'irl-experiment-registry',
      label: 'Experiment Pipeline',
      slug: 'irl-experiment-registry',
      enabled: true,
      adminOnly: true,
      group: 'laboratory',
      order: 6,
      type: 'static',
      config: { component: 'ExperimentRegistryTab', props: {} },
      metadata: { icon: 'ListTodo', description: 'CFS-051 — the informal idea pipeline that feeds the formal, ratified experiment/invariant registry: candidate experiments, candidate constitutional principles, candidate structural invariants, and the research backlog, before anything enters the official process unchanged elsewhere.', color: 'violet' },
    },
    // ── Living Knowledge ──────────────────────────────────────────
    {
      id: 'irl-invariant-registry',
      label: 'Invariant Registry',
      slug: 'irl-invariant-registry',
      enabled: true,
      // Access-boundary correction (2026-08-26): metaMe IRL strictly admin-gated.
      adminOnly: true,
      group: 'laboratory',
      order: 2,
      type: 'static',
      config: { component: 'InvariantRegistryTab', props: {} },
      metadata: { icon: 'BookMarked', description: 'The live substrate — namespaces, status, Standing, Reach, contexts, graph edges', color: 'violet' },
    },
    {
      id: 'irl-glossary',
      label: 'Glossary & Ontology',
      slug: 'irl-glossary',
      enabled: true,
      // Access-boundary correction (2026-08-26): metaMe IRL strictly admin-gated.
      adminOnly: true,
      group: 'research',
      order: 3,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_foundation', defaultPath: 'foundation/constitutional-glossary.md' },
      },
      metadata: { icon: 'BookOpen', description: 'The runtime-resolved constitutional vocabulary — one canon for every agent' },
    },
    // ── Publications ──────────────────────────────────────────────
    {
      id: 'irl-records',
      label: 'Records & Findings',
      slug: 'irl-records',
      enabled: true,
      // Access-boundary correction (2026-08-26): metaMe IRL strictly
      // admin-gated — external participants use IRL OS's irl-os-records.
      adminOnly: true,
      group: 'publications',
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'agentiq', collectionId: 'col_updates' },
      },
      metadata: { icon: 'BookOpen', description: 'The constitutional record — every increment, finding, and session record (publication lineage)' },
    },
    {
      // Stage 3 of the report lifecycle — canonical reports an admin published.
      // Same public surface as IRL OS: published reports are public by definition.
      id: 'irl-reports',
      label: 'Reports',
      slug: 'irl-reports',
      enabled: true,
      // Access-boundary correction (2026-08-26): metaMe IRL strictly admin-gated.
      adminOnly: true,
      group: 'publications',
      order: 1,
      type: 'static',
      config: { component: 'PublishedReportsTab', props: {} },
      metadata: { icon: 'BookOpen', description: 'Published research reports — canonical, DVN-receipted findings reports made public' },
    },
    // ── Programme Management ──────────────────────────────────────
    {
      id: 'irl-programmes',
      label: 'Research Programmes',
      slug: 'irl-programmes',
      enabled: true,
      // Access-boundary correction (2026-08-26): metaMe IRL strictly admin-gated.
      adminOnly: true,
      group: 'institution',
      order: 2,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_foundation', defaultPath: 'foundation/CRP-001_constitutional-research-program-charter.md' },
      },
      metadata: { icon: 'Target', description: 'CRP-001 — the twelve research programmes; roadmap and backlog live in the charter (CFS-019 §8)' },
    },
    // ── Participation ─────────────────────────────────────────────
    // The constitutional collaboration space (five-space IA, 2026-07-18 —
    // mirrors IRL_OS_CARTRIDGE). Overview lands first; passport capabilities
    // follow. Components already in TabRenderer.componentRegistry.
    {
      id: 'irl-participation-overview',
      label: 'Overview',
      slug: 'irl-participation-overview',
      enabled: true,
      // NOT admin-gated (access-boundary correction, 2026-08-26 — corrected
      // after tests/lab-tab-restructure-and-locker-ux.test.ts caught the
      // regression): the whole 'participation' group, like irl-workspace,
      // is SHARED infrastructure a delegated steward and ordinary
      // research-lab participants reach directly in metaMe IRL — a
      // pre-existing, tested surface this pass does not redesign. IRL OS's
      // own Participation group (irl-os-participation-overview and
      // siblings) remains the parallel EXTERNAL entrance for the same
      // audience.
      group: 'participation',
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_foundation', defaultPath: 'foundation/PARTICIPATION_overview.md' },
      },
      metadata: { icon: 'ShieldCheck', description: 'How to join the Invariant Research Lab — roles, the passport → delegation → agreement path, and the public API for delegated agents', color: 'violet' },
    },
    {
      id: 'irl-passport-apply',
      label: 'Apply',
      slug: 'irl-passport-apply',
      enabled: true,
      // NOT admin-gated — see irl-participation-overview's comment above:
      // the whole 'participation' group is pre-existing shared
      // infrastructure, not redesigned by this pass.
      group: 'participation',
      order: 1,
      type: 'static',
      config: { component: 'PassportBureauApplyTab' },
      metadata: { icon: 'FileCheck2', description: 'Apply for a Polity Passport — anonymous citizen personhood (World ID upgrades to verified citizen)', color: 'violet' },
    },
    {
      id: 'irl-passport-delegation',
      label: 'Delegation',
      slug: 'irl-passport-delegation',
      enabled: true,
      // NOT admin-gated — see irl-participation-overview's comment above.
      group: 'participation',
      order: 2,
      type: 'static',
      config: { component: 'BoundedDelegationTab' },
      metadata: { icon: 'Link2', description: 'Grant bounded delegations to sponsored agents — the sponsor authorizes; agents never self-delegate (CFS-043)', color: 'violet' },
    },
    // REMOVED 2026-07-28 (operator ruling): the Passport Registry tab is gone
    // from BOTH Labs. The public passport record is not a Lab surface — it
    // keeps its homes in the AgentiQ cartridge (`passport-registry`), AgentiQ
    // OS (`os-passport-registry`), the iQube registry (`passports`) and the
    // Passport Bureau (`registry`). The one inbound deep link that pointed
    // here (`passportDeepLinks().registry` in
    // services/constitutional/guidedOnboarding.ts) was repointed at the
    // AgentiQ OS entrance in the same change — a dangling `?tab=` silently
    // lands the operator on the cartridge's default tab, which is the defect
    // this note exists to stop being reintroduced.
    {
      id: 'irl-passport-locker',
      label: 'Locker',
      slug: 'irl-passport-locker',
      enabled: true,
      // NOT admin-gated — see irl-participation-overview's comment above.
      group: 'participation',
      order: 3,
      type: 'static',
      config: { component: 'LockerTab' },
      metadata: { icon: 'Lock', description: 'Encrypted vault for passport-related items — agent-gated access', color: 'violet' },
    },
    {
      // Participation v1 (2026-07-18): the participant's constitutional
      // standing — lanes, reach, receipted contribution history.
      id: 'irl-participation-standing',
      label: 'Standing',
      slug: 'irl-participation-standing',
      enabled: true,
      // NOT admin-gated — see irl-participation-overview's comment above.
      group: 'participation',
      order: 5,
      type: 'static',
      config: { component: 'ParticipationStandingTab' },
      metadata: { icon: 'Award', description: 'Your standing with the Institute — lanes, reach, and receipted contribution history', color: 'violet' },
    },
    {
      id: 'irl-passport-steward',
      label: 'Steward',
      slug: 'irl-passport-steward',
      enabled: true,
      adminOnly: true,
      group: 'participation',
      order: 6,
      type: 'static',
      config: { component: 'PassportBureauStewardTab' },
      metadata: { icon: 'Gavel', description: 'Steward review queue — admin only', color: 'violet' },
      get subTabs() {
        return polityPassportTabsByGroup('steward', 'irl-passport-steward');
      },
    },
    // ── Workspace (SPEC-IRL-WORKSPACE-001) ──────────────────────────
    // Its OWN top-level group (`workspace`, see `tabGroups` above), sited
    // immediately after Participation — see the long comment on `tabGroups`
    // for the full correction history. Built by `buildResearchWorkspaceTab`
    // so this cartridge and IRL OS share one definition, never two.
    // NOT admin-gated (access-boundary correction, 2026-08-26 — corrected
    // after tests/research-workspace-spec.test.ts and
    // tests/research-lab-workspace.test.ts caught the regression): unlike
    // every OTHER tab in this cartridge, irl-workspace is SHARED
    // infrastructure — the canonical Workspace entrance for every
    // research-lab role across every research programme (Autonomi
    // reviewers, capstone faculty leads/students, institutional observers,
    // principal investigators, OCSGA), gated per-role by its own
    // participationDomain/participationRoles (SPEC-IRL-WORKSPACE-001),
    // NOT by adminOnly. It predates and extends beyond OCSGA; gating it
    // admin-only here would have silently locked out every one of those
    // pre-existing, tested external-participant flows, which is the
    // opposite of the invariant this pass exists to enforce. IRL OS's own
    // irl-os-workspace (same builder, same participationDomain gate) is the
    // parallel EXTERNAL entrance point for the same audience — this one
    // stays reachable too, exactly as it always was.
    buildResearchWorkspaceTab('irl-workspace'),
  ],
};

/**
 * IRL OS — the open, public-facing edition of the IRL cartridge, exactly as
 * AgentiQ OS is the open public-facing version of AgentiQ (operator direction
 * 2026-07-16, CFS-033 UI-surface decision). Content-only v1: the published
 * research corpus + the Constitutional Evaluation front door for external
 * researchers, consuming the SAME `irl` pack as the internal cartridge (the
 * pack is already in packRegistry's skip list — no auto-duplicate risk).
 * Its own slug gives it its own embeddable URL (/triad/embed/codex/irl-os).
 * Deliberately EXCLUDED: InvariantExperimentLab (admin-only, runs spend
 * provider credits — never public) and the four interactive-but-public
 * instruments (Dashboard, Research Copilot, Invariant Field Explorer,
 * Invariant Registry) — those are a named follow-on gated on an
 * anonymous-read API audit of each.
 */
export const IRL_OS_CARTRIDGE: CodexConfig = {
  id: 'irl-os-cartridge',
  name: 'IRL OS',
  slug: 'irl-os',
  enabled: true,
  version: '1.0.0',
  owner: 'system',
  copilot: {
    accentColor: 'violet',
    // aigent-researcher — the IRL Research Copilot persona (participant-facing
    // structured-discovery voice), NOT aigent-z (engineering intelligence).
    agent: { id: 'aigent-researcher', name: 'IRL Guide' },
    promptPlaceholder: 'Ask about IRL OS research...',
    initialMessage: "I'm your guide to the Invariant Research Lab. Ask me about the research programme, the invariant canon, how to claim your Polity Passport, delegate your agent (optional), or run your assigned experiments.",
    quickPrompts: ['How do I claim my passport?', 'How do I get research access?', 'What experiments can I run?', 'Explain the invariant canon', 'How do I delegate my agent?'],
  },
  metadata: {
    description:
      'IRL OS — the open edition of the Invariant Research Laboratory: the published constitutional research corpus (CFS specs, experiment records, glossary, canon) and the Constitutional Evaluation front door for external researchers (CFS-033)',
    icon: 'FlaskConical',
    color: 'violet',
    category: 'cartridge',
    tags: ['irl-os', 'research', 'open', 'constitutional-evaluation', 'experiments', 'invariants', 'publications'],
  },
  // Five-space IA (operator + Aletheon, 2026-07-18 — CFS-044 v3): the nav reads
  // as the lifecycle of scientific engagement — Institution (who we are) →
  // Research (what we know) → Laboratory (how we discover) → Publications
  // (what we've shared) → Participation (how you join). Constitutional
  // Evaluation, Consequence Engineering, and the Registry/Field are laboratory
  // CAPABILITIES, not destinations; the Passport is one capability inside
  // Participation. Deep links are group-independent (slug-only selection), so
  // regrouping preserves every published ?tab= link. The wallet "Welcome" chip
  // is the cross-cartridge platform shell — never overloaded by this nav.
  tabGroups: [
    { id: 'institution', label: 'Institution', icon: 'Landmark', order: 0 },
    { id: 'research', label: 'Research', icon: 'Layers', order: 1 },
    { id: 'laboratory', label: 'Laboratory', icon: 'FlaskConical', order: 2 },
    { id: 'publications', label: 'Publications', icon: 'BookOpen', order: 3 },
    // Participation — the constitutional collaboration space (CFS-042/043/044):
    // overview + passport + bounded delegation for external partners and their
    // agents, without the full metaMe thin client. SmartWallet deep-dives
    // remain available via the floating copilot.
    { id: 'participation', label: 'Participation', icon: 'ShieldCheck', order: 4 },
    // Workspace (added 2026-07-29, operator correction): "workspace should
    // also be added to the IRL OS cartridge — that's really the main place
    // it's going to live, but it can be in both IRL OS and the IRL
    // cartridges." Same group shape, same `LayoutGrid` icon, and the SAME
    // `buildResearchWorkspaceTab` builder as the internal IRL cartridge (see
    // that cartridge's `tabGroups` comment for the full rationale) — this is
    // a registry-level addition, not a second implementation of the surface.
    { id: 'workspace', label: 'Workspace', icon: 'LayoutGrid', order: 5 },
    // Validation Programme — promoted to its own first-class top-level item
    // (operator instruction 2026-08-01, point 7: "beside Institution,
    // Research, Laboratory, Publications, Participation, and Workspace"),
    // out from under 'laboratory' where it previously nested. Still the same
    // single tab (irl-os-validation-programme) and the same
    // ValidationProgrammeJourneyTab — this only changes which nav group it
    // reads under.
    { id: 'validation-programme', label: 'Validation Programme', icon: 'ClipboardList', order: 6 },
  ],
  tabs: [
    {
      // The IRL home / welcome screen — observer-aware landing (2026-07-19):
      // invitational onboarding ladder for newcomers; "welcome back" pointing
      // deeper once the persona holds a research-lab grant. First tab, so the
      // cartridge lands here.
      id: 'irl-os-welcome',
      label: 'Welcome',
      slug: 'irl-os-welcome',
      enabled: true,
      group: 'institution',
      order: -1,
      type: 'static',
      config: { component: 'IRLWelcomeTab' },
      metadata: { icon: 'Sparkles', description: 'Welcome to the Invariant Research Lab — how to join, and where to go once you have' },
    },
    {
      // Public read-only Dashboard — mission, published results, derived
      // lifecycle overview (anonymous-safe via /api/public/irl/* projections,
      // audit 2026-07-17). The admin/credit-touching Chrysalis Test source is
      // omitted in publicMode.
      id: 'irl-os-dashboard',
      label: 'Dashboard',
      slug: 'irl-os-dashboard',
      enabled: true,
      group: 'institution',
      order: 0,
      type: 'static',
      config: { component: 'IRLDashboardTab', props: { publicMode: true } },
      metadata: { icon: 'Landmark', description: 'Mission, published Foundational Validation Series results, and the live research-object lifecycle (read-only, public)', color: 'violet' },
    },
    // CONTAINED 2026-08-27 (docs/security/2026-08-27_irl-os-containment-breach-audit.md):
    // disabled, not removed. This tab's content is served via
    // /api/codex/packs/irl/file, which (before this same containment pass)
    // had NO access control for the `irl` pack — the full internal Charter
    // document tree was readable by any caller. The route is now
    // default-deny for the `irl` pack; this tab stays hidden until an
    // operator authors a deliberate, explicitly-public Genesis/overview
    // excerpt for Phase 2 ("Do not infer that a document is public because
    // it lives under ... Charter ... Public visibility must be explicit").
    {
      id: 'irl-os-charter',
      label: 'Charter',
      slug: 'irl-os-charter',
      enabled: false,
      group: 'institution',
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_foundation', defaultPath: 'foundation/CFS-019_irl-charter.md' },
      },
      metadata: { icon: 'Scale', description: 'CFS-019 — the IRL constitution: layers, object model, lifecycles, migration, phases' },
    },
    // CONTAINED 2026-08-27 — same rationale as irl-os-charter above: served
    // via the now-default-deny /api/codex/packs/irl/file route, and not
    // explicitly classified public. Disabled pending Phase 2 classification.
    {
      id: 'irl-os-layer-i',
      label: 'Layer I — Invariant Intelligence',
      slug: 'irl-os-layer-i',
      enabled: false,
      group: 'research',
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_foundation', defaultPath: 'foundation/appendix-a_canonical-invariants.md' },
      },
      metadata: { icon: 'BookMarked', description: 'Constitutional knowledge — the canon, the CFS corpus, the Foundational Validation Series' },
    },
    {
      id: 'irl-os-layer-ii',
      label: 'Layer II — Constitutional Computing',
      slug: 'irl-os-layer-ii',
      enabled: false,
      group: 'research',
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_foundation', defaultPath: 'foundation/CFS-015_operation-chrysalis-2-prd.md' },
      },
      metadata: { icon: 'Cpu', description: 'Constitutional execution — Operation Chrysalis 2.0, the Capability Pipeline, deployment authority' },
    },
    {
      id: 'irl-os-layer-iii',
      label: 'Layer III — Constitutional Cybernetics',
      slug: 'irl-os-layer-iii',
      enabled: false,
      group: 'research',
      order: 2,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_foundation', defaultPath: 'foundation/CFS-019_irl-charter.md' },
      },
      metadata: { icon: 'RefreshCw', description: 'Constitutional evolution — feedback, adaptation, multi-agent governance (the frontier)' },
    },
    {
      // The single guided entrance for an external reviewer (operator spec,
      // 2026-08-01) — the Validation Programme journey. NOT adminOnly: it
      // composes existing surfaces (IndependentReviewPanel, LockerTab, the
      // Research Workspace) that are each already reviewer-reachable in their
      // own right; this tab is presentation, not a new gate. Promoted to its
      // own first-class top-level nav group (point 7 of the same operator
      // instruction) — no longer nested under 'laboratory'. See
      // services/journey/validationProgrammeJourney.ts's own header for the
      // full composition and services/passport/participationAccess.ts's
      // `callerMayReadExperimentReview` for the scoped read check.
      // CONTAINED 2026-08-27 (docs/security/2026-08-27_irl-os-containment-breach-audit.md):
      // ValidationProgrammeJourneyTab mounts PartnerProgrammesTab (the
      // confirmed irl-cartridge deep-link vector, see irl-os-workspace's
      // comment above) plus IndependentReviewPanel/LockerTab. Disabled
      // pending Phase 2 verified reviewer-invitation scoping.
      id: 'irl-os-validation-programme',
      label: 'Validation Programme',
      slug: 'irl-os-validation-programme',
      enabled: false,
      group: 'validation-programme',
      order: 0,
      type: 'static',
      config: { component: 'ValidationProgrammeJourneyTab', props: {} },
      metadata: {
        icon: 'ClipboardList',
        description:
          'The guided path for an invited external reviewer: Overview, Crystal Review, Submit Review, and Experiment Progress for EXP-P1.',
        color: 'violet',
      },
    },
    {
      // The runnable Experiments surface for reviewers/researchers (2026-07-19).
      // NOT adminOnly — access is enforced server-side at the run routes
      // (admin OR research-entitled OR an active research-lab access grant).
      // This is where an onboarded reviewer independently reproduces the
      // Foundational Series: EXP-001–005 + Results/Report outputs.
      // CONTAINED 2026-08-27 (docs/security/2026-08-27_irl-os-containment-breach-audit.md):
      // this tab's own access route (/api/experiments/access) IS
      // server-resolved correctly (verified — canonical persona/grants, not
      // client params), but the operator's access policy requires
      // invitation/cohort scoping beyond paid/admin, which is unverified for
      // this surface. Disabled pending Phase 2 scope verification.
      id: 'irl-os-experiment-lab',
      label: 'Experiments',
      slug: 'irl-os-experiment-lab',
      enabled: false,
      group: 'laboratory',
      order: 0,
      type: 'static',
      config: { component: 'InvariantExperimentLab', props: { density: 'narrow' } },
      metadata: { icon: 'FlaskConical', description: 'Run the Foundational Series live and independently — EXP-001–005, Results, and Report. Requires research access (Sovereign/Steward) or a reviewer grant.' },
    },
    // ── EXP-P1 Readiness — PRD-EPI-001 §10 dashboard (steward-gated) ──
    // Canonical/primary home moved to metaMe IRL (irl-cartridge's
    // 'irl-exp-p1-readiness', added 2026-07-23) — this entry is kept
    // deliberately, not removed: a stub for a future cohort/token/payment-
    // gated access point if invariant aggregation opens beyond admin.
    // adminOnly: true today either way; not built out beyond that flag.
    {
      id: 'irl-os-exp-p1-readiness',
      label: 'EXP-P1 Readiness',
      slug: 'irl-os-exp-p1-readiness',
      enabled: true,
      adminOnly: true,
      group: 'laboratory',
      order: 4,
      type: 'static',
      config: { component: 'ExpP1ReadinessTab', props: {} },
      metadata: { icon: 'Gauge', description: 'PRD-EPI-001 §10 — seven per-gate readiness sections for EXP-P1 (protocol-ratified derivation, live). Execution/Publication are expected red pre-run.', color: 'violet' },
    },
    // ── Corpus Scout — PRD-ICA-001 human review workspace (steward-gated) ──
    // Canonical/primary home moved to metaMe IRL (irl-cartridge's
    // 'irl-corpus-scout', added 2026-07-23) — this entry is kept
    // deliberately, not removed: a stub for a future cohort/token/payment-
    // gated access point if invariant aggregation opens beyond admin.
    // adminOnly: true today either way; not built out beyond that flag.
    {
      id: 'irl-os-corpus-scout',
      label: 'Corpus Scout',
      slug: 'irl-os-corpus-scout',
      enabled: true,
      adminOnly: true,
      group: 'laboratory',
      order: 5,
      type: 'static',
      config: { component: 'CorpusScoutTab', props: {} },
      metadata: { icon: 'FileSearch', description: 'PRD-ICA-001 §9 — verify, review, and hand approved sources to the Discovery Engine. Retrieval → byte verification → human approval → add-evidence.', color: 'violet' },
    },
    // ── Constitutional Evaluation — the external-researcher front door ──
    {
      // CONTAINED 2026-08-27 (docs/security/2026-08-27_irl-os-containment-breach-audit.md):
      // served via the now-default-deny /api/codex/packs/irl/file route and
      // not explicitly classified public. Disabled pending Phase 2.
      id: 'irl-os-evaluation',
      label: 'Constitutional Evaluation',
      slug: 'irl-os-evaluation',
      enabled: false,
      group: 'laboratory',
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_foundation', defaultPath: 'foundation/CFS-033_constitutional-evaluation.md' },
      },
      metadata: {
        icon: 'Scale',
        description:
          'CFS-033 — evaluation as a pluggable, receipted, versioned component of every experiment: hash-committed grounding slices, external judge configurations, the Research Package vision. The front door for external researchers.',
        color: 'violet',
      },
    },
    {
      // CONTAINED 2026-08-27 (docs/security/2026-08-27_irl-os-containment-breach-audit.md):
      // col_experiments (experiment designs/protocols/methods/PRDs) served
      // via the now-default-deny /api/codex/packs/irl/file route. Directive
      // requires this stay hidden "unless canonical scope enforcement
      // already exists and is verified" — it did not; disabled.
      id: 'irl-os-protocols',
      label: 'Protocols & Articles',
      slug: 'irl-os-protocols',
      enabled: false,
      group: 'laboratory',
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_experiments' },
      },
      metadata: { icon: 'Target', description: 'Experiment designs, protocols, canonical articles, evaluation frameworks — EXP-001…010 incl. the Representation Gauntlet' },
    },
    {
      // Public read-only Invariant Field Explorer — the live enables/
      // constrains/contradicts field + forecast + counterfactual (what-if)
      // projection, anonymous-safe via /api/public/irl/invariant-field (both
      // the gated and public routes call one shared module — 2026-07-17).
      // Registry + Field = two views over the Substrate (laboratory).
      id: 'irl-os-invariant-field',
      label: 'Invariant Field',
      slug: 'irl-os-invariant-field',
      enabled: true,
      group: 'laboratory',
      order: 3,
      type: 'static',
      config: { component: 'InvariantFieldExplorerTab', props: { publicMode: true } },
      metadata: { icon: 'Network', description: 'Computational Epistemology made visible — the live enables/constrains/contradicts field + counterfactual projection (read-only, public)', color: 'violet' },
    },
    {
      // Public read-only Invariant Registry (Browse) — the live substrate,
      // anonymous-safe via /api/public/irl/invariants (audit 2026-07-17). The
      // FIRST live interactive instrument in the public cartridge.
      id: 'irl-os-invariant-registry',
      label: 'Invariant Registry',
      slug: 'irl-os-invariant-registry',
      enabled: true,
      group: 'laboratory',
      order: 2,
      type: 'static',
      config: { component: 'InvariantRegistryTab', props: { publicMode: true } },
      metadata: { icon: 'BookMarked', description: 'Browse the live constitutional substrate — namespaces, status, Standing, Reach (read-only, public)', color: 'violet' },
    },
    // CONTAINED 2026-08-27 (docs/security/2026-08-27_irl-os-containment-breach-audit.md):
    // served via the now-default-deny /api/codex/packs/irl/file route and
    // not explicitly classified public. Disabled pending Phase 2.
    {
      id: 'irl-os-glossary',
      label: 'Glossary & Ontology',
      slug: 'irl-os-glossary',
      enabled: false,
      group: 'research',
      order: 3,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_foundation', defaultPath: 'foundation/constitutional-glossary.md' },
      },
      metadata: { icon: 'BookOpen', description: 'The runtime-resolved constitutional vocabulary — one canon for every agent' },
    },
    // ── Publications ──────────────────────────────────────────────
    // Records & Findings is INTERNAL-ONLY (operator direction 2026-07-20):
    // it is the working record of every development decision — laboratory
    // material, not public-domain publication. The internal metaMe IRL
    // edition keeps its irl-records tab; the public IRL OS edition
    // publishes only Reports + Canonical Plates (+ ratified protocols).
    // Internal IRL = the laboratory; IRL OS = the publishing layer.
    {
      id: 'irl-os-records',
      label: 'Records & Findings',
      slug: 'irl-os-records',
      enabled: false,
      group: 'publications',
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'agentiq', collectionId: 'col_updates' },
      },
      metadata: { icon: 'BookOpen', description: 'INTERNAL — the constitutional record lives in the metaMe IRL edition only' },
    },
    {
      // Stage 3 of the report lifecycle — canonical reports an admin published.
      id: 'irl-os-reports',
      label: 'Reports',
      slug: 'irl-os-reports',
      enabled: true,
      group: 'publications',
      order: 1,
      type: 'static',
      config: { component: 'PublishedReportsTab', props: {} },
      metadata: { icon: 'BookOpen', description: 'Published research reports — canonical, DVN-receipted findings reports made public' },
    },
    {
      // Research Programmes live under Institution — the programme is part of
      // "who we are" (five-space IA, 2026-07-18).
      // CONTAINED 2026-08-27 (docs/security/2026-08-27_irl-os-containment-breach-audit.md):
      // "if no public projection exists now, hide this tab temporarily"
      // (directive). Served via the now-default-deny /api/codex/packs/irl/file
      // route; disabled pending a Phase 2 deliberately-authored public summary.
      id: 'irl-os-programmes',
      label: 'Research Programmes',
      slug: 'irl-os-programmes',
      enabled: false,
      group: 'institution',
      order: 2,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_foundation', defaultPath: 'foundation/CRP-001_constitutional-research-program-charter.md' },
      },
      metadata: { icon: 'Target', description: 'CRP-001 — the research programmes; roadmap and backlog live in the charter (CFS-019 §8)' },
    },
    // ── Participation ─────────────────────────────────────────────
    // The constitutional collaboration space (five-space IA, 2026-07-18):
    // Overview lands first (never drop a visitor into the Passport form —
    // Aletheon), then the passport capabilities (mirror of AGENTIQ_OS's
    // passport group). Apply + Delegation + Registry + Locker public; Steward
    // adminOnly. Components already in TabRenderer.componentRegistry —
    // config-only. Deep-linkable via /triad/embed/codex/irl-os?tab=<slug>.
    {
      id: 'irl-os-participation-overview',
      label: 'Overview',
      slug: 'irl-os-participation-overview',
      enabled: true,
      group: 'participation',
      order: 0,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: { packId: 'irl', collectionId: 'col_foundation', defaultPath: 'foundation/PARTICIPATION_overview.md' },
      },
      metadata: { icon: 'ShieldCheck', description: 'How to join the Invariant Research Lab — roles, the passport → delegation → agreement path, and the public API for delegated agents', color: 'violet' },
    },
    {
      id: 'irl-os-passport-apply',
      label: 'Apply',
      slug: 'irl-os-passport-apply',
      enabled: true,
      group: 'participation',
      order: 1,
      type: 'static',
      config: { component: 'PassportBureauApplyTab' },
      metadata: { icon: 'FileCheck2', description: 'Apply for a Polity Passport — anonymous citizen personhood (World ID upgrades to verified citizen)', color: 'violet' },
    },
    {
      id: 'irl-os-passport-delegation',
      label: 'Delegation',
      slug: 'irl-os-passport-delegation',
      enabled: true,
      group: 'participation',
      order: 2,
      type: 'static',
      config: { component: 'BoundedDelegationTab' },
      metadata: { icon: 'Link2', description: 'Grant bounded delegations to sponsored agents — the sponsor authorizes; agents never self-delegate (CFS-043)', color: 'violet' },
    },
    // REMOVED 2026-07-28 (operator ruling) — see the identical note on the IRL
    // cartridge above. Same removal, same reason, same repointed deep link.
    {
      id: 'irl-os-passport-locker',
      label: 'Locker',
      slug: 'irl-os-passport-locker',
      enabled: true,
      group: 'participation',
      order: 3,
      type: 'static',
      config: { component: 'LockerTab' },
      metadata: { icon: 'Lock', description: 'Encrypted vault for passport-related items — agent-gated access', color: 'violet' },
    },
    {
      // Participation v1 (2026-07-18): the participant's constitutional
      // standing — lanes, reach, receipted contribution history.
      id: 'irl-os-participation-standing',
      label: 'Standing',
      slug: 'irl-os-participation-standing',
      enabled: true,
      group: 'participation',
      order: 5,
      type: 'static',
      config: { component: 'ParticipationStandingTab' },
      metadata: { icon: 'Award', description: 'Your standing with the Institute — lanes, reach, and receipted contribution history', color: 'violet' },
    },
    {
      id: 'irl-os-passport-steward',
      label: 'Steward',
      slug: 'irl-os-passport-steward',
      enabled: true,
      adminOnly: true,
      group: 'participation',
      order: 6,
      type: 'static',
      config: { component: 'PassportBureauStewardTab' },
      metadata: { icon: 'Gavel', description: 'Steward review queue — admin only', color: 'violet' },
      get subTabs() {
        return polityPassportTabsByGroup('steward', 'irl-os-passport-steward');
      },
    },
    // ── Workspace (SPEC-IRL-WORKSPACE-001) — added 2026-07-29 ───────
    // CONTAINED 2026-08-27, RESTORED 2026-08-27 (scoped restoration — see
    // docs/security/2026-08-27_irl-os-containment-breach-audit.md and its
    // Residual Risk 1). Original defect: `RESEARCH_WORKSPACES` (services/
    // research/researchWorkspace.ts) hardcodes `codexSlug: 'irl-cartridge'`
    // on the Protocols & Articles / EXP-P1 Readiness / Experiments / Reports
    // / Records & Findings / Independent Review / Observer Review links
    // every research-programme workspace carries, and `PartnerProgrammesTab`'s
    // `DeepLinkCard` builds those into live hrefs straight into the PRIVATE
    // `irl-cartridge`. Because this Workspace tab shares the SAME
    // `buildResearchWorkspaceTab` builder (and therefore the same
    // `PartnerProgrammesTab` mount) as the internal IRL cartridge's own
    // Workspace tab, any IRL OS visitor who reached a workspace with ANY
    // research-lab access grant saw these `irl-cartridge` deep links
    // rendered directly in the public cartridge.
    //
    // Fix (render-boundary guard, not a data rewrite): `buildResearchWorkspaceTab`
    // now passes `forbiddenCodexSlugs: ['irl-cartridge']` into every
    // `PartnerProgrammesTab` mount whose `idPrefix` starts `irl-os-`.
    // `AreaLinks` (PartnerProgrammesTab.tsx) drops any DeepLinkCard whose
    // `codexSlug` is on that list — for THIS mount only, the same
    // established "this mount only" contract `hiddenLinkIds` already used.
    // The internal `irl-cartridge` Workspace tab (`idPrefix: 'irl-workspace'`)
    // is untouched and keeps its legitimate self-links.
    //
    // Access model unchanged and already correct (verified, not modified):
    // `grantedScopes`/`scopesGrantedIn` (participation access) still cohort-
    // isolates WHICH workspace(s) a caller may even see (MS-9 — a control
    // that cannot act must not render) — a public/ungranted visitor lands on
    // the honest, generic `unscopedHint`/`emptyRegistry` empty state (no
    // workspace names, no programme content), never a workspace list or its
    // links. A canonical admin sees the full workspace picker as before,
    // minus any `irl-cartridge` link (they have direct access to metaMe IRL
    // itself for that). An invitation/cohort-scoped non-admin participant
    // (Autonomi reviewer, Lehigh capstone, OCSGA, VP1) still opens exactly
    // their own granted workspace, with every non-`irl-cartridge` link intact
    // and every `irl-cartridge` link silently omitted rather than rendered
    // broken or redirecting into the private cartridge.
    buildResearchWorkspaceTab('irl-os-workspace'),
  ],
  permissions: {
    view: ['*'],
    edit: ['admin'],
    admin: ['admin'],
  },
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
  // MONEYPENNY_CARTRIDGE is hand-curated (SPEC-VLM-001 Phase 2, 2026-07-24)
  // to replace the pack-driven single-tab auto-registration -- same
  // dedup-by-id precedent as MARKETA_CARTRIDGE above (both share their pack
  // id's auto-generated codex id, so `CODEX_DEFINITIONS` here takes
  // priority per the registry route's own merge rule).
  MONEYPENNY_CARTRIDGE,
  IQUBE_REGISTRY_CARTRIDGE,
  POLITY_PASSPORT_BUREAU_CARTRIDGE,
  HUMAN_MOBILITY_SERVICES_CARTRIDGE,
  STANDING_CARTRIDGE,
  POLITY_CORE_CARTRIDGE,
  IRL_CARTRIDGE,
  // IRL OS — the open public-facing edition of the IRL cartridge (2026-07-16,
  // the AgentiQ → AgentiQ OS pattern). Same `irl` pack (already in the
  // packRegistry skip list); its own slug ('irl-os') gives it its own
  // embeddable URL. Content-only v1 — see the const's header comment.
  IRL_OS_CARTRIDGE,
];

/**
 * Legacy slug/id aliases — renamed cartridges keep their old deep links alive.
 * 2026-07-13: the lab's ccrl-* machine slugs migrated to irl-* (operator
 * direction); old bookmarks, embed URLs, and stored links resolve through
 * these aliases. Tab-level aliases cover `?tab=` params the same way.
 */
export const LEGACY_CODEX_SLUGS: Record<string, string> = {
  'ccrl-cartridge': 'irl-cartridge',
};

export const LEGACY_TAB_SLUGS: Record<string, string> = {
  'ccrl-dashboard': 'irl-dashboard',
  'ccrl-research-copilot': 'irl-research-copilot',
  'ccrl-experiment-lab': 'irl-experiment-lab',
  'ccrl-charter': 'irl-charter',
  'ccrl-protocols': 'irl-protocols',
  'ccrl-invariant-field': 'irl-invariant-field',
  'ccrl-invariant-registry': 'irl-invariant-registry',
};

export function resolveLegacyTabSlug(tab: string): string {
  return LEGACY_TAB_SLUGS[tab] ?? tab;
}

export function getCodexById(id: string): CodexConfig | undefined {
  const resolved = LEGACY_CODEX_SLUGS[id] ?? id;
  return CODEX_DEFINITIONS.find(codex => codex.id === resolved);
}

export function getCodexBySlug(slug: string): CodexConfig | undefined {
  const resolved = LEGACY_CODEX_SLUGS[slug] ?? slug;
  return CODEX_DEFINITIONS.find(codex => codex.slug === resolved);
}

export function getEnabledCodexes(): CodexConfig[] {
  return CODEX_DEFINITIONS.filter(codex => codex.enabled);
}
