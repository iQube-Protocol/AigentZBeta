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

import { CodexConfig } from '@/types/codex';

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
      metadata: { icon: 'Film', description: 'Episode drops and collectibles', color: 'cyan' }
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
      label: 'Bundles & GN',
      slug: 'store-bundles',
      enabled: true,
      group: 'store',
      order: 2,
      type: 'static',
      config: { component: 'KnytStoreBundlesTab' },
      metadata: { icon: 'Package', description: 'Episode bundles and Graphic Novel editions', color: 'cyan' }
    },

    // ── Terra (standalone) ─────────────────────────────────────
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
        component: 'KnytRuntimeSurface',
        props: {}
      },
      metadata: {
        icon: 'Zap',
        description: 'KNYT Live Runtime Surface — patronage axis, PCS axis, signals, next-best-step',
        color: 'amber'
      }
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
      id: 'experience-dashboard',
      label: 'Experience',
      slug: 'experience-dashboard',
      enabled: true,
      group: 'admin',
      adminOnly: true,
      order: 1,
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
      order: 2,
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
      order: 3,
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

    // ── Docs group (admin-gated) ───────────────────────────────
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

export const METAME_CODEX: CodexConfig = {
  id: 'metame-codex',
  name: 'metaMe Cartridge',
  slug: 'metame',
  enabled: true,
  version: '1.0.0',
  owner: 'metame-guardian',
  metadata: {
    description: 'metaMe sovereignty layer: experience framework, progression model, PCS ladder, and next-best-pathway logic',
    icon: 'User',
    color: 'violet',
    category: 'sovereignty',
    tags: ['metame', 'experience', 'pcs', 'sovereignty', 'progression', 'nbe']
  },
  tabs: [
    {
      id: 'experience-framework',
      label: 'Experience Framework',
      slug: 'experience-framework',
      enabled: true,
      adminOnly: true,
      order: 0,
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
      id: 'experience-dashboard',
      label: 'Journey Dashboard',
      slug: 'experience-dashboard',
      enabled: true,
      adminOnly: true,
      order: 1,
      type: 'static',
      config: {
        component: 'ExperienceDashboardTab',
        props: { tenantId: 'metame' }
      },
      metadata: {
        icon: 'BarChart',
        description: 'User journey states, progression, NBE opportunities',
        color: 'violet'
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
      metadata: { icon: 'CheckSquare', description: 'Review and approve partner-proposed packs' },
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
      metadata: { icon: 'PenTool', description: 'Build a campaign pack with Marketa AI' },
    },
    {
      id: 'my-packs',
      label: 'My Packs',
      slug: 'my-packs',
      enabled: true,
      partnerOnly: true,
      group: 'partner',
      order: 2,
      type: 'static',
      config: { component: 'MarketaMyPacksTab', props: {} },
      metadata: { icon: 'Package', description: 'Your assigned packs, status, and publish actions' },
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
