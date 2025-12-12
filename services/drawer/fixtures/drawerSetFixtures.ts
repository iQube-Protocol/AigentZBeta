/**
 * DrawerSet Fixtures
 * 
 * Example drawer configurations for metaKnyts and Qriptopian apps.
 * These define the Smart Menu layouts for each application.
 */

import type { DrawerSet, Drawer, DrawerTab, DrawerSlot } from '@/types/smartDrawer';

// =============================================================================
// METAKNYTS DRAWER SET
// =============================================================================

/**
 * metaKnyts DrawerSet
 * 
 * Drawers:
 * - Story: Main content viewing (Summary, Watch, Read, Listen tabs)
 * - Codex: Dynamic lore exploration (Kn0w1 agent, dynamic reconfiguration)
 * - Wallet: User wallet (Overview, Tasks, Entitlements, Rewards)
 * - Agents: Agent interactions (Copilot, Kn0w1, MoneyPenny)
 */
export const metaKnytsDrawerSet: DrawerSet = {
  id: 'ds:metaknyts:tenant-main:persona-metaknyts',
  appId: 'metaKnyts',
  tenantId: 'tenant-main',
  personaId: 'metaKnyts',
  dynamicMode: 'allow-dynamic',
  
  drawers: [
    // -------------------------------------------------------------------------
    // STORY DRAWER
    // -------------------------------------------------------------------------
    {
      id: 'story',
      label: 'Story',
      icon: 'BookOpen',
      side: 'left',
      tabs: [
        {
          id: 'summary',
          label: 'Summary',
          modalityFocus: ['read'],
          slots: [
            {
              id: 'hero-slot',
              cardVariant: 'heroShort',
              dataSource: { type: 'currentContent', modalities: ['read', 'watch'] },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['desktop', 'tv'],
              },
            },
            {
              id: 'mobile-hero-slot',
              cardVariant: 'mobileHero',
              dataSource: { type: 'currentContent', modalities: ['read', 'watch'] },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['mobile'],
              },
            },
            {
              id: 'related-episodes',
              cardVariant: 'carousel3',
              dataSource: { type: 'relatedContent', relationType: 'series', limit: 6 },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'Kn0w1',
            metavatarId: 'metaknyts:kn0w1',
            openByDefault: false,
          },
        },
        {
          id: 'watch',
          label: 'Watch',
          modalityFocus: ['watch'],
          slots: [
            {
              id: 'video-player',
              cardVariant: 'iframe',
              dataSource: { type: 'currentContent', modalities: ['watch'] },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
            {
              id: 'episode-list',
              cardVariant: 'thumbRect',
              dataSource: { type: 'relatedContent', relationType: 'series', limit: 10 },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['desktop', 'tv'],
              },
            },
          ],
        },
        {
          id: 'read',
          label: 'Read',
          modalityFocus: ['read'],
          slots: [
            {
              id: 'reader-content',
              cardVariant: 'contentWide',
              dataSource: { type: 'currentContent', modalities: ['read'] },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
        },
        {
          id: 'listen',
          label: 'Listen',
          modalityFocus: ['listen'],
          slots: [
            {
              id: 'audio-player',
              cardVariant: 'compact',
              dataSource: { type: 'currentContent', modalities: ['listen'] },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['desktop', 'mobile'],
              },
            },
          ],
        },
      ],
      visibilityRules: {
        allowedPersonas: ['metaKnyts', 'Qripto', 'Creator'],
      },
    },

    // -------------------------------------------------------------------------
    // CODEX DRAWER (Dynamic)
    // -------------------------------------------------------------------------
    {
      id: 'codex',
      label: 'Codex',
      icon: 'Compass',
      side: 'left',
      tabs: [
        {
          id: 'explore',
          label: 'Explore',
          modalityFocus: ['interact', 'read'],
          slots: [
            {
              id: 'codex-hero',
              cardVariant: 'compound2',
              dataSource: { type: 'currentContent', modalities: ['read', 'interact'] },
              behaviour: {
                refreshOnContentChange: true,
                refreshOnPromptChange: true,
                dynamicReconfigureAllowed: true,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
            {
              id: 'lore-grid',
              cardVariant: 'poster3',
              dataSource: { type: 'relatedContent', relationType: 'topic', limit: 9 },
              behaviour: {
                refreshOnContentChange: true,
                refreshOnPromptChange: true,
                dynamicReconfigureAllowed: true,
                visibleOnDevices: ['desktop'],
              },
            },
            {
              id: 'lore-mobile',
              cardVariant: 'mobileCards',
              dataSource: { type: 'relatedContent', relationType: 'topic', limit: 6 },
              behaviour: {
                refreshOnContentChange: true,
                refreshOnPromptChange: true,
                dynamicReconfigureAllowed: true,
                visibleOnDevices: ['mobile'],
              },
            },
          ],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'Kn0w1',
            secondaryAgents: ['Copilot'],
            metavatarId: 'metaknyts:codex-spirit',
            openByDefault: true,
          },
        },
        {
          id: 'quest-path',
          label: 'Quest Path',
          modalityFocus: ['interact'],
          slots: [
            {
              id: 'quest-progress',
              cardVariant: 'walletTasksList',
              dataSource: { type: 'walletQuests', statusFilter: ['ongoing'] },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
          agentPanel: {
            mode: 'hybrid',
            primaryAgentId: 'Kn0w1',
            secondaryAgents: ['MoneyPenny'],
            openByDefault: false,
          },
        },
      ],
      visibilityRules: {
        allowedPersonas: ['metaKnyts', 'Qripto'],
        minReputationScore: 10,
      },
    },

    // -------------------------------------------------------------------------
    // WALLET DRAWER
    // -------------------------------------------------------------------------
    {
      id: 'wallet',
      label: 'Wallet',
      icon: 'Wallet',
      side: 'right',
      tabs: [
        {
          id: 'overview',
          label: 'Overview',
          modalityFocus: ['interact'],
          slots: [
            {
              id: 'balance-summary',
              cardVariant: 'walletOverview',
              dataSource: { type: 'walletBalances' },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
            {
              id: 'quick-actions',
              cardVariant: 'compact',
              dataSource: { type: 'walletTasks', statusFilter: ['todo', 'in-progress'] },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile'],
              },
            },
          ],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'MoneyPenny',
            metavatarId: 'metaknyts:moneypenny',
            openByDefault: false,
          },
        },
        {
          id: 'tasks',
          label: 'Tasks',
          modalityFocus: ['interact'],
          slots: [
            {
              id: 'task-list',
              cardVariant: 'walletTasksList',
              dataSource: { type: 'walletTasks' },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
        },
        {
          id: 'entitlements',
          label: 'Library',
          modalityFocus: ['read'],
          slots: [
            {
              id: 'entitlement-grid',
              cardVariant: 'thumbnailRect',
              dataSource: { type: 'walletEntitlements', statusFilter: ['active'] },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop'],
              },
            },
            {
              id: 'entitlement-list',
              cardVariant: 'mobileCards',
              dataSource: { type: 'walletEntitlements', statusFilter: ['active'] },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['mobile'],
              },
            },
          ],
        },
        {
          id: 'rewards',
          label: 'Rewards',
          modalityFocus: ['interact'],
          slots: [
            {
              id: 'reward-progress',
              cardVariant: 'walletTimeline',
              dataSource: { type: 'walletQuests' },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
        },
      ],
    },

    // -------------------------------------------------------------------------
    // AGENTS DRAWER
    // -------------------------------------------------------------------------
    {
      id: 'agents',
      label: 'Agents',
      icon: 'Bot',
      side: 'right',
      tabs: [
        {
          id: 'copilot',
          label: 'Copilot',
          modalityFocus: ['interact'],
          slots: [
            {
              id: 'copilot-chat',
              cardVariant: 'iframe',
              dataSource: { type: 'customQuery', queryId: 'copilot-panel' },
              behaviour: {
                refreshOnContentChange: true,
                refreshOnPromptChange: true,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
          agentPanel: {
            mode: 'copilot',
            primaryAgentId: 'Copilot',
            metavatarId: 'metaknyts:copilot',
            openByDefault: true,
          },
        },
        {
          id: 'kn0w1',
          label: 'Kn0w1',
          modalityFocus: ['interact'],
          slots: [],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'Kn0w1',
            metavatarId: 'metaknyts:kn0w1',
            openByDefault: true,
          },
        },
        {
          id: 'moneypenny',
          label: 'MoneyPenny',
          modalityFocus: ['interact'],
          slots: [],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'MoneyPenny',
            metavatarId: 'metaknyts:moneypenny',
            openByDefault: true,
          },
        },
      ],
    },
  ],

  createdAt: '2025-12-04T00:00:00Z',
  updatedAt: '2025-12-04T00:00:00Z',
};

// =============================================================================
// QRIPTOPIAN DRAWER SET
// =============================================================================

/**
 * Qriptopian DrawerSet
 * 
 * Drawers:
 * - Article: Main content viewing (Summary, Read, Watch tabs)
 * - Wallet: User wallet (Overview, Tasks, Library, Rewards)
 * - Agents: Agent interactions (Copilot, MoneyPenny, Nakamoto)
 */
export const qriptopianDrawerSet: DrawerSet = {
  id: 'ds:qriptopian:tenant-main:persona-investor',
  appId: 'Qriptopian',
  tenantId: 'tenant-main',
  personaId: 'Investor',
  dynamicMode: 'static-only',

  drawers: [
    // -------------------------------------------------------------------------
    // ARTICLE DRAWER
    // -------------------------------------------------------------------------
    {
      id: 'article',
      label: 'Article',
      icon: 'FileText',
      side: 'left',
      tabs: [
        {
          id: 'summary',
          label: 'Summary',
          modalityFocus: ['read'],
          slots: [
            {
              id: 'article-hero',
              cardVariant: 'featured',
              dataSource: { type: 'currentContent', modalities: ['read'] },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['desktop', 'tv'],
              },
            },
            {
              id: 'article-hero-mobile',
              cardVariant: 'mobileFeatured',
              dataSource: { type: 'currentContent', modalities: ['read'] },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['mobile'],
              },
            },
            {
              id: 'related-articles',
              cardVariant: 'carousel3',
              dataSource: { type: 'relatedContent', relationType: 'topic', limit: 6 },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
          agentPanel: {
            mode: 'copilot',
            primaryAgentId: 'Copilot',
            metavatarId: 'qriptopian:copilot',
            openByDefault: false,
          },
        },
        {
          id: 'read',
          label: 'Read',
          modalityFocus: ['read'],
          slots: [
            {
              id: 'article-content',
              cardVariant: 'contentWide',
              dataSource: { type: 'currentContent', modalities: ['read'] },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
        },
        {
          id: 'watch',
          label: 'Watch',
          modalityFocus: ['watch'],
          slots: [
            {
              id: 'video-content',
              cardVariant: 'iframe',
              dataSource: { type: 'currentContent', modalities: ['watch'] },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
        },
      ],
      visibilityRules: {
        allowedPersonas: ['Investor', 'Qripto', 'Creator'],
      },
    },

    // -------------------------------------------------------------------------
    // WALLET DRAWER
    // -------------------------------------------------------------------------
    {
      id: 'wallet',
      label: 'Wallet',
      icon: 'Wallet',
      side: 'right',
      tabs: [
        {
          id: 'overview',
          label: 'Overview',
          modalityFocus: ['interact'],
          slots: [
            {
              id: 'balance-summary',
              cardVariant: 'walletOverview',
              dataSource: { type: 'walletBalances' },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'MoneyPenny',
            metavatarId: 'qriptopian:moneypenny',
            openByDefault: false,
          },
        },
        {
          id: 'tasks',
          label: 'Tasks',
          modalityFocus: ['interact'],
          slots: [
            {
              id: 'task-list',
              cardVariant: 'walletTasksList',
              dataSource: { type: 'walletTasks' },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
        },
        {
          id: 'library',
          label: 'Library',
          modalityFocus: ['read'],
          slots: [
            {
              id: 'entitlement-grid',
              cardVariant: 'poster3',
              dataSource: { type: 'walletEntitlements', statusFilter: ['active'] },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop'],
              },
            },
            {
              id: 'entitlement-list',
              cardVariant: 'mobileCards',
              dataSource: { type: 'walletEntitlements', statusFilter: ['active'] },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['mobile'],
              },
            },
          ],
        },
        {
          id: 'rewards',
          label: 'Rewards',
          modalityFocus: ['interact'],
          slots: [
            {
              id: 'reward-progress',
              cardVariant: 'walletTimeline',
              dataSource: { type: 'walletQuests' },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
        },
      ],
    },

    // -------------------------------------------------------------------------
    // AGENTS DRAWER
    // -------------------------------------------------------------------------
    {
      id: 'agents',
      label: 'Agents',
      icon: 'Bot',
      side: 'right',
      tabs: [
        {
          id: 'copilot',
          label: 'Copilot',
          modalityFocus: ['interact'],
          slots: [],
          agentPanel: {
            mode: 'copilot',
            primaryAgentId: 'Copilot',
            metavatarId: 'qriptopian:copilot',
            openByDefault: true,
          },
        },
        {
          id: 'moneypenny',
          label: 'MoneyPenny',
          modalityFocus: ['interact'],
          slots: [],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'MoneyPenny',
            metavatarId: 'qriptopian:moneypenny',
            openByDefault: true,
          },
        },
        {
          id: 'nakamoto',
          label: 'Nakamoto',
          modalityFocus: ['interact'],
          slots: [],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'Nakamoto',
            metavatarId: 'qriptopian:nakamoto',
            openByDefault: true,
          },
        },
      ],
    },
  ],

  createdAt: '2025-12-04T00:00:00Z',
  updatedAt: '2025-12-04T00:00:00Z',
};

// =============================================================================
// MONEYPENNY DRAWER SET (HFT/DeFi)
// =============================================================================

/**
 * MoneyPenny DrawerSet
 * 
 * Drawers:
 * - Portfolio: DeFi portfolio overview (Overview, Positions tabs)
 * - Strategies: Strategy management (Live, Explore tabs)
 * - Wallet & Tasks: Standard wallet + DeFi tasks
 * - Research: Qriptopian + metaKnyts educational content
 */
export const moneyPennyDrawerSet: DrawerSet = {
  id: 'ds:staybull:tenant-main:persona-defitrader',
  appId: 'StayBull',
  tenantId: 'tenant-main',
  personaId: 'DeFiTrader',
  dynamicMode: 'allow-dynamic',

  drawers: [
    // -------------------------------------------------------------------------
    // PORTFOLIO DRAWER
    // -------------------------------------------------------------------------
    {
      id: 'portfolio',
      label: 'Portfolio',
      icon: 'PieChart',
      side: 'left',
      tabs: [
        {
          id: 'overview',
          label: 'Overview',
          modalityFocus: ['interact'],
          slots: [
            {
              id: 'balance-summary',
              cardVariant: 'walletOverview',
              dataSource: { type: 'walletBalances' },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
            {
              id: 'risk-summary',
              cardVariant: 'contentWide',
              dataSource: { type: 'walletDefiRiskSummary' },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'tv'],
              },
            },
            {
              id: 'risk-summary-mobile',
              cardVariant: 'compact',
              dataSource: { type: 'walletDefiRiskSummary' },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['mobile'],
              },
            },
          ],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'MoneyPenny',
            secondaryAgents: ['Nakamoto'],
            metavatarId: 'moneypenny:main',
            openByDefault: false,
          },
        },
        {
          id: 'positions',
          label: 'Positions',
          modalityFocus: ['interact'],
          slots: [
            {
              id: 'open-positions',
              cardVariant: 'contentWide',
              dataSource: { type: 'walletDefiPositions', statusFilter: ['open'] },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'tv'],
              },
            },
            {
              id: 'open-positions-mobile',
              cardVariant: 'mobileCards',
              dataSource: { type: 'walletDefiPositions', statusFilter: ['open'] },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['mobile'],
              },
            },
            {
              id: 'closed-positions',
              cardVariant: 'compact',
              dataSource: { type: 'walletDefiPositions', statusFilter: ['closed'] },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'MoneyPenny',
            metavatarId: 'moneypenny:analyst',
            openByDefault: false,
          },
        },
      ],
      visibilityRules: {
        allowedPersonas: ['DeFiTrader', 'Investor', 'Qripto'],
      },
    },

    // -------------------------------------------------------------------------
    // STRATEGIES DRAWER
    // -------------------------------------------------------------------------
    {
      id: 'strategies',
      label: 'Strategies',
      icon: 'TrendingUp',
      side: 'left',
      tabs: [
        {
          id: 'live',
          label: 'Live Strategies',
          modalityFocus: ['interact'],
          slots: [
            {
              id: 'running-strategies',
              cardVariant: 'standard',
              dataSource: { type: 'walletDefiStrategies', statusFilter: ['running'] },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
            {
              id: 'idle-strategies',
              cardVariant: 'compact',
              dataSource: { type: 'walletDefiStrategies', statusFilter: ['idle'] },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'MoneyPenny',
            metavatarId: 'moneypenny:strategist',
            openByDefault: false,
          },
        },
        {
          id: 'explore',
          label: 'Explore',
          modalityFocus: ['read', 'interact'],
          slots: [
            {
              id: 'strategy-content',
              cardVariant: 'poster3',
              dataSource: { type: 'relatedContent', relationType: 'strategy', limit: 6 },
              behaviour: {
                refreshOnContentChange: true,
                refreshOnPromptChange: true,
                dynamicReconfigureAllowed: true,
                visibleOnDevices: ['desktop'],
              },
            },
            {
              id: 'strategy-content-mobile',
              cardVariant: 'mobileCards',
              dataSource: { type: 'relatedContent', relationType: 'strategy', limit: 4 },
              behaviour: {
                refreshOnContentChange: true,
                refreshOnPromptChange: true,
                dynamicReconfigureAllowed: true,
                visibleOnDevices: ['mobile'],
              },
            },
          ],
          agentPanel: {
            mode: 'hybrid',
            primaryAgentId: 'MoneyPenny',
            secondaryAgents: ['Kn0w1'],
            metavatarId: 'moneypenny:educator',
            openByDefault: true,
          },
        },
        {
          id: 'yield',
          label: 'Yield',
          modalityFocus: ['interact'],
          slots: [
            {
              id: 'yield-strategies',
              cardVariant: 'standard',
              dataSource: { type: 'walletDefiStrategies', categoryFilter: ['yield'] },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
        },
        {
          id: 'market-neutral',
          label: 'Market Neutral',
          modalityFocus: ['interact'],
          slots: [
            {
              id: 'neutral-strategies',
              cardVariant: 'standard',
              dataSource: { type: 'walletDefiStrategies', categoryFilter: ['marketNeutral'] },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
        },
      ],
      visibilityRules: {
        allowedPersonas: ['DeFiTrader', 'Investor'],
        minReputationScore: 20,
      },
    },

    // -------------------------------------------------------------------------
    // WALLET & TASKS DRAWER
    // -------------------------------------------------------------------------
    {
      id: 'walletTasks',
      label: 'Wallet & Tasks',
      icon: 'Wallet',
      side: 'right',
      tabs: [
        {
          id: 'wallet',
          label: 'Wallet',
          modalityFocus: ['interact'],
          slots: [
            {
              id: 'wallet-summary',
              cardVariant: 'walletOverview',
              dataSource: { type: 'walletBalances' },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
            {
              id: 'entitlements',
              cardVariant: 'thumbnailRect',
              dataSource: { type: 'walletEntitlements', statusFilter: ['active'] },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'MoneyPenny',
            secondaryAgents: ['Copilot'],
            metavatarId: 'moneypenny:wallet',
            openByDefault: false,
          },
        },
        {
          id: 'tasks',
          label: 'Tasks & Quests',
          modalityFocus: ['interact'],
          slots: [
            {
              id: 'defi-tasks',
              cardVariant: 'walletTasksList',
              dataSource: { type: 'walletTasks', contextFilter: 'MoneyPenny' },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
            {
              id: 'defi-quests',
              cardVariant: 'standard',
              dataSource: { type: 'walletQuests', contextFilter: 'DeFi' },
              behaviour: {
                refreshOnContentChange: false,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
          agentPanel: {
            mode: 'hybrid',
            primaryAgentId: 'MoneyPenny',
            secondaryAgents: ['Copilot'],
            openByDefault: false,
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // RESEARCH DRAWER
    // -------------------------------------------------------------------------
    {
      id: 'research',
      label: 'Research',
      icon: 'BookOpen',
      side: 'right',
      tabs: [
        {
          id: 'education',
          label: 'Education',
          modalityFocus: ['read'],
          slots: [
            {
              id: 'qriptopian-articles',
              cardVariant: 'poster3',
              dataSource: { type: 'relatedContent', relationType: 'education', limit: 6 },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['desktop'],
              },
            },
            {
              id: 'qriptopian-articles-mobile',
              cardVariant: 'mobileCards',
              dataSource: { type: 'relatedContent', relationType: 'education', limit: 4 },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['mobile'],
              },
            },
            {
              id: 'metaknyts-episodes',
              cardVariant: 'thumbnailRect',
              dataSource: { type: 'relatedContent', relationType: 'mythos', limit: 4 },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'Kn0w1',
            secondaryAgents: ['MoneyPenny'],
            metavatarId: 'moneypenny:kn0w1',
            openByDefault: false,
          },
        },
        {
          id: 'market',
          label: 'Market',
          modalityFocus: ['read', 'interact'],
          slots: [
            {
              id: 'market-signals',
              cardVariant: 'contentWide',
              dataSource: { type: 'customQuery', queryId: 'market-signals' },
              behaviour: {
                refreshOnContentChange: true,
                visibleOnDevices: ['desktop', 'mobile', 'tv'],
              },
            },
          ],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'Nakamoto',
            secondaryAgents: ['MoneyPenny'],
            metavatarId: 'moneypenny:nakamoto',
            openByDefault: false,
          },
        },
      ],
    },

    // -------------------------------------------------------------------------
    // AGENTS DRAWER
    // -------------------------------------------------------------------------
    {
      id: 'agents',
      label: 'Agents',
      icon: 'Bot',
      side: 'right',
      tabs: [
        {
          id: 'moneypenny',
          label: 'MoneyPenny',
          modalityFocus: ['interact'],
          slots: [],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'MoneyPenny',
            metavatarId: 'moneypenny:main',
            openByDefault: true,
          },
        },
        {
          id: 'kn0w1',
          label: 'Kn0w1',
          modalityFocus: ['interact'],
          slots: [],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'Kn0w1',
            metavatarId: 'moneypenny:kn0w1',
            openByDefault: true,
          },
        },
        {
          id: 'nakamoto',
          label: 'Nakamoto',
          modalityFocus: ['interact'],
          slots: [],
          agentPanel: {
            mode: 'franchise',
            primaryAgentId: 'Nakamoto',
            metavatarId: 'moneypenny:nakamoto',
            openByDefault: true,
          },
        },
        {
          id: 'copilot',
          label: 'Copilot',
          modalityFocus: ['interact'],
          slots: [],
          agentPanel: {
            mode: 'copilot',
            primaryAgentId: 'Copilot',
            metavatarId: 'moneypenny:copilot',
            openByDefault: true,
          },
        },
      ],
    },
  ],

  createdAt: '2025-12-04T00:00:00Z',
  updatedAt: '2025-12-04T00:00:00Z',
};

// =============================================================================
// ALL FIXTURES
// =============================================================================

export const drawerSetFixtures = {
  metaKnyts: metaKnytsDrawerSet,
  qriptopian: qriptopianDrawerSet,
  moneyPenny: moneyPennyDrawerSet,
};

export default drawerSetFixtures;
