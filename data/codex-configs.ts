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
  name: 'KNYT Codex',
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
  tabs: [
    {
      id: 'codex',
      label: 'Codex',
      slug: 'codex',
      enabled: true,
      order: 0,
      type: 'liquid-ui',
      config: {
        liquidTemplate: 'knyt:drawer_grid_v1',
        dataSource: '/api/codex/knyt/home'
      },
      metadata: {
        icon: 'Home',
        description: 'KNYT Codex home and overview',
        color: 'purple'
      }
    },
    {
      id: 'scrolls',
      label: 'Scrolls',
      slug: 'scrolls',
      enabled: true,
      order: 1,
      type: 'liquid-ui',
      config: {
        liquidTemplate: 'knyt:motion_stage_v1',
        dataSource: '/api/admin/codex/status?series=metaKnyts',
        // Uses existing API: /api/admin/codex/status?series=metaKnyts
        // Backward compatible with Qriptopian useCodexEpisodes hook
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
      order: 2,
      type: 'liquid-ui',
      config: {
        liquidTemplate: 'knyt:dual_poster_stage_v1',
        dataSource: '/api/codex/knyt-cards',
        // Uses existing API: /api/codex/knyt-cards
        // Backward compatible with Qriptopian useCodexCharacters hook
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
      order: 3,
      type: 'liquid-ui',
      config: {
        liquidTemplate: 'knyt:drawer_grid_v1',
        dataSource: '/api/content/assets?kinds=background_lore_doc,twenty_one_sats_concept',
        // Uses existing API: /api/content/assets?kinds=background_lore_doc,twenty_one_sats_concept
        // Backward compatible with Qriptopian useCodexLore hook
      },
      metadata: {
        icon: 'FileText',
        description: 'World lore and background',
        color: 'purple'
      }
    },
    {
      id: 'digiterra',
      label: 'DigiTerra',
      slug: 'digiterra',
      enabled: true,
      order: 4,
      type: 'liquid-ui',
      config: {
        liquidTemplate: 'knyt:motion_stage_v1',
        dataSource: '/api/codex/knyt/digiterra',
        // Digital realm content and interactions
      },
      metadata: {
        icon: 'Cpu',
        description: 'Digital realm interface',
        color: 'cyan'
      }
    },
    {
      id: 'terra',
      label: 'Terra',
      slug: 'terra',
      enabled: true,
      order: 5,
      type: 'liquid-ui',
      config: {
        liquidTemplate: 'knyt:realm_bridge_map_v1',
        dataSource: '/api/codex/knyt/terra',
        // Physical realm content and interactions
      },
      metadata: {
        icon: 'Globe',
        description: 'Physical realm interface',
        color: 'green'
      }
    },
    {
      id: 'order',
      label: 'Order',
      slug: 'order',
      enabled: true,
      order: 6,
      type: 'liquid-ui',
      config: {
        liquidTemplate: 'knyt:quest_hud_hub_v1',
        dataSource: '/api/codex/knyt/order',
        // Order of Metaiye: live progression, ascension, and reputation
      },
      metadata: {
        icon: 'Shield',
        description: 'Order of Metaiye — progression, ascension, and reputation',
        color: 'purple'
      }
    },
    {
      id: 'living-canon',
      label: '21 Sats',
      slug: 'living-canon',
      enabled: true,
      order: 7,
      type: 'liquid-ui',
      config: {
        liquidTemplate: 'knyt:living_canon_v1',
        dataSource: '/api/codex/knyt/living-canon',
        // Living Canon — Canon / Community / Correspondent branch navigation
        // One active canonical community world (21 Sats) at launch
      },
      metadata: {
        icon: 'Layers',
        description: 'Living Canon — Canon, Community, and Correspondent branches',
        color: 'amber',
        badge: 'Active'
      }
    },
    {
      id: 'runtime',
      label: 'Runtime',
      slug: 'runtime',
      enabled: true,
      order: 8,
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
      id: 'experience-dashboard',
      label: 'Experience',
      slug: 'experience-dashboard',
      enabled: true,
      adminOnly: true,   // Sensitive admin data — hidden from all non-admin users
      order: 9,
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
      id: 'experience-pack',
      label: 'Experience Pack',
      slug: 'experience-pack',
      enabled: true,
      adminOnly: true,   // Internal stakeholder doc — hidden from end users
      order: 10,
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
      adminOnly: true,   // Live operator bundle — admin-gated working access
      order: 11,
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
        description: 'KNYT Wheel — the KNYT Activation Campaign genesis bundle: operator brief, activation blueprint, copy packs, operations, deployment handoff, marketa plans, 30-day calendar, CRM schema, dashboard spec, partner/investor addenda, and launch runbook (13 core docs + AutoDrive canonicalization companion)',
        color: 'rose'
      }
    }
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
  name: 'Qriptopian Codex',
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
  name: 'AgentiQ Codex',
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
    // ─── agentiq pack — build-layer docs ─────────────────────────────────
    {
      id: 'agentiq-os',
      label: 'AgentiQ OS',
      slug: 'agentiq-os',
      enabled: true,
      order: 8,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'agentiq',
          collectionId: 'col_agentiq_os',
          defaultPath: 'items/OS_README.md'
        }
      },
      metadata: {
        icon: 'Code',
        description: 'AgentiQ OS — builder onboarding, contribution categories, packaging, submission',
        color: 'green'
      }
    },
    {
      id: 'alpha-program',
      label: 'Alpha Program',
      slug: 'alpha-program',
      enabled: true,
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
      id: 'updates',
      label: 'Updates',
      slug: 'updates',
      enabled: true,
      order: 10,
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
      order: 11,
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
      order: 10,
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
      order: 11,
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
      order: 12,
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

export const METAME_CODEX: CodexConfig = {
  id: 'metame-codex',
  name: 'metaMe Codex',
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

export const CODEX_DEFINITIONS: CodexConfig[] = [
  KNYT_CODEX,
  QRIPTO_CODEX,
  AGENTIQ_CARTRIDGE,
  METAME_CODEX
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
