/**
 * Menu Fixtures - Predefined menu configurations for each app
 */

import type { SmartMenuConfig } from '@/types/smartMenu';

export const metaKnytsMenuConfig: SmartMenuConfig = {
  id: 'menu:metaknyts:default',
  appId: 'metaKnyts',
  tenantId: 'tenant-main',
  primaryNav: [
    {
      id: 'content',
      label: 'Content',
      items: [
        { id: 'story', label: 'Story', icon: 'BookOpen', action: 'openDrawer', targetId: 'story' },
        { id: 'codex', label: 'Codex', icon: 'Compass', action: 'openDrawer', targetId: 'codex' },
      ],
    },
    {
      id: 'account',
      label: 'Account',
      items: [
        { id: 'wallet', label: 'Wallet', icon: 'Wallet', action: 'openDrawer', targetId: 'wallet' },
        { id: 'agents', label: 'Agents', icon: 'Bot', action: 'openDrawer', targetId: 'agents' },
      ],
    },
  ],
  agentShortcuts: [
    { agentId: 'Kn0w1', label: 'Kn0w1', icon: 'Sparkles', hotkey: 'k' },
    { agentId: 'Copilot', label: 'Copilot', icon: 'MessageCircle', hotkey: 'c', defaultOpen: true },
  ],
  drawerOrder: ['story', 'codex', 'wallet', 'agents'],
};

export const qriptopianMenuConfig: SmartMenuConfig = {
  id: 'menu:qriptopian:default',
  appId: 'Qriptopian',
  tenantId: 'tenant-main',
  primaryNav: [
    {
      id: 'content',
      label: 'Content',
      items: [
        { id: 'article', label: 'Articles', icon: 'FileText', action: 'openDrawer', targetId: 'article' },
      ],
    },
    {
      id: 'account',
      label: 'Account',
      items: [
        { id: 'wallet', label: 'Wallet', icon: 'Wallet', action: 'openDrawer', targetId: 'wallet' },
        { id: 'agents', label: 'Agents', icon: 'Bot', action: 'openDrawer', targetId: 'agents' },
      ],
    },
  ],
  agentShortcuts: [
    { agentId: 'Copilot', label: 'Copilot', icon: 'MessageCircle', hotkey: 'c', defaultOpen: true },
    { agentId: 'Nakamoto', label: 'Nakamoto', icon: 'Shield', hotkey: 'n' },
  ],
  drawerOrder: ['article', 'wallet', 'agents'],
};

export const moneyPennyMenuConfig: SmartMenuConfig = {
  id: 'menu:moneypenny:default',
  appId: 'MoneyPenny',
  tenantId: 'tenant-main',
  primaryNav: [
    {
      id: 'defi',
      label: 'DeFi',
      items: [
        { id: 'portfolio', label: 'Portfolio', icon: 'PieChart', action: 'openDrawer', targetId: 'portfolio' },
        { id: 'strategies', label: 'Strategies', icon: 'TrendingUp', action: 'openDrawer', targetId: 'strategies' },
      ],
    },
    {
      id: 'account',
      label: 'Account',
      items: [
        { id: 'walletTasks', label: 'Wallet & Tasks', icon: 'Wallet', action: 'openDrawer', targetId: 'walletTasks' },
        { id: 'research', label: 'Research', icon: 'BookOpen', action: 'openDrawer', targetId: 'research' },
      ],
    },
    {
      id: 'agents',
      label: 'Agents',
      items: [
        { id: 'agents', label: 'Agents', icon: 'Bot', action: 'openDrawer', targetId: 'agents' },
      ],
    },
  ],
  agentShortcuts: [
    { agentId: 'MoneyPenny', label: 'MoneyPenny', icon: 'DollarSign', hotkey: 'm', defaultOpen: true },
    { agentId: 'Nakamoto', label: 'Nakamoto', icon: 'Shield', hotkey: 'n' },
    { agentId: 'Kn0w1', label: 'Kn0w1', icon: 'Sparkles', hotkey: 'k' },
  ],
  drawerOrder: ['portfolio', 'strategies', 'walletTasks', 'research', 'agents'],
};

export const menuConfigs = {
  metaKnyts: metaKnytsMenuConfig,
  Qriptopian: qriptopianMenuConfig,
  MoneyPenny: moneyPennyMenuConfig,
};

export default menuConfigs;
