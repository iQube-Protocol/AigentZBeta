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
 */

import { CodexConfig } from '@/types/codex';

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
        liquidTemplate: 'knyt-codex-home',
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
      type: 'static',
      config: {
        component: 'ScrollsTab',
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
      type: 'static',
      config: {
        component: 'CharactersTab',
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
      type: 'static',
      config: {
        component: 'LoreTab',
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
      type: 'static',
      config: {
        component: 'DigiTerraTab',
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
      type: 'static',
      config: {
        component: 'TerraTab',
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
      type: 'static',
      config: {
        component: 'OrderTab',
        // Order system and governance
      },
      metadata: {
        icon: 'Shield',
        description: 'Order system and governance',
        color: 'purple'
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
    templateId: 'knyt-codex-home',
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
  id: 'aigentiq-codex',
  name: 'AgentiQ Codex',
  slug: 'aigentiq',
  enabled: true,
  version: '1.0.0',
  owner: 'aigent-z',
  metadata: {
    description: 'AgentiQ engineering truth: docs, decisions, PR briefs, and system maps',
    icon: 'Brain',
    color: 'blue',
    category: 'cartridge',
    tags: ['agentiq', 'cartridge', 'platform', 'decisions', 'pr-briefs']
  },
  tabs: [
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
          packId: 'agentiq',
          collectionId: 'col_start_here',
          defaultPath: 'items/AGENTIQ_CARTRIDGE.md'
        }
      },
      metadata: {
        icon: 'Home',
        description: 'Cartridge overview and navigation',
        color: 'blue'
      }
    },
    {
      id: 'system-map',
      label: 'System Map',
      slug: 'system-map',
      enabled: true,
      order: 1,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'agentiq',
          collectionId: 'col_start_here',
          defaultPath: 'items/SYSTEM_MAP.md'
        }
      },
      metadata: {
        icon: 'BookOpen',
        description: 'Architecture and core flows'
      }
    },
    {
      id: 'decisions',
      label: 'Decisions',
      slug: 'decisions',
      enabled: true,
      order: 2,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'agentiq',
          collectionId: 'col_decisions'
        }
      },
      metadata: {
        icon: 'Code',
        description: 'Decision briefs and rationale'
      }
    },
    {
      id: 'work-allocation',
      label: 'Work Allocation',
      slug: 'work-allocation',
      enabled: true,
      order: 3,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'agentiq',
          collectionId: 'col_work_allocation'
        }
      },
      metadata: {
        icon: 'Shield',
        description: 'Ownership boundaries'
      }
    },
    {
      id: 'pr-briefs',
      label: 'PR Briefs',
      slug: 'pr-briefs',
      enabled: true,
      order: 4,
      type: 'static',
      config: {
        component: 'AgentiqCartridgeTab',
        props: {
          packId: 'agentiq',
          collectionId: 'col_pr_briefs'
        }
      },
      metadata: {
        icon: 'FileText',
        description: 'PR summaries and impact'
      }
    },
    {
      id: 'updates',
      label: 'Updates',
      slug: 'updates',
      enabled: true,
      order: 5,
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
      order: 6,
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

export const CODEX_DEFINITIONS: CodexConfig[] = [
  KNYT_CODEX,
  QRIPTO_CODEX,
  AGENTIQ_CARTRIDGE
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
