import type { SmartTriadSet } from './model';

export const qriptopianTriadSet: SmartTriadSet = {
  id: 'ds:qriptopian:tenant-main:persona-investor',
  appId: 'Qriptopian',
  personaId: 'investor',
  dynamicMode: 'copilot-adaptive',
  drawers: [
    {
      id: 'article',
      label: 'Article',
      side: 'right',
      defaultSize: 'panel-3q',
      defaultMenuBehavior: { mode: 'fixed-rail', side: 'right' },
      tabs: [
        {
          id: 'read',
          label: 'Read',
          slots: [
            { id: 'article-hero', label: 'Hero', modality: 'content-card', variantId: 'card-hero-wide' },
          ],
        },
      ],
    },
    {
      id: 'wallet',
      label: 'Wallet',
      side: 'right',
      defaultSize: 'wallet-narrow',
      defaultMenuBehavior: { mode: 'fixed-rail', side: 'right' },
      tabs: [
        {
          id: 'overview',
          label: 'Overview',
          slots: [
            { id: 'wallet-overview', label: 'Overview', modality: 'wallet-section' },
          ],
        },
      ],
    },
  ],
  wallet: {
    defaultDrawerId: 'wallet',
    defaultTabId: 'overview',
    personaAware: true,
    showTasks: true,
    showRewards: true,
    showLibrary: true,
    sections: {
      overviewSlotId: 'wallet-overview',
      tasksSlotId: 'wallet-tasks',
    },
  },
  content: {
    allowedVariants: [
      { id: 'card-hero-wide', type: 'card' },
      { id: 'card-panel-3q', type: 'card' },
    ],
    slotBindings: {
      'article-hero': 'card-hero-wide',
    },
  },
};

export const metaKnytsTriadSet: SmartTriadSet = {
  id: 'ds:metaknyts:tenant-main:persona-gamer',
  appId: 'metaKnyts',
  personaId: 'gamer',
  dynamicMode: 'copilot-suggest',
  drawers: [
    {
      id: 'codex',
      label: 'Codex',
      side: 'right',
      defaultSize: 'immersive-3q',
      defaultMenuBehavior: { mode: 'collapsed-pill', side: 'left' },
      tabs: [
        { id: 'episodes', label: 'Episodes', slots: [] },
      ],
    },
    {
      id: 'wallet',
      label: 'Wallet',
      side: 'right',
      defaultSize: 'wallet-narrow',
      defaultMenuBehavior: { mode: 'fixed-rail', side: 'right' },
      tabs: [
        { id: 'overview', label: 'Overview', slots: [] },
      ],
    },
  ],
  wallet: {
    defaultDrawerId: 'wallet',
    defaultTabId: 'overview',
    personaAware: false,
    showTasks: false,
    showRewards: true,
    showLibrary: true,
    sections: {},
  },
  content: {
    allowedVariants: [{ id: 'card-immersive', type: 'full' }],
  },
};

export const moneyPennyTriadSet: SmartTriadSet = {
  id: 'ds:moneypenny:tenant-main:persona-defitrader',
  appId: 'MoneyPenny',
  personaId: 'defitrader',
  dynamicMode: 'copilot-adaptive',
  drawers: [
    {
      id: 'portfolio',
      label: 'Portfolio',
      side: 'center',
      defaultSize: 'modal-centered',
      defaultMenuBehavior: { mode: 'fixed-rail', side: 'right' },
      tabs: [
        { id: 'positions', label: 'Positions', slots: [] },
      ],
    },
    {
      id: 'wallet',
      label: 'Wallet',
      side: 'right',
      defaultSize: 'wallet-narrow',
      defaultMenuBehavior: { mode: 'fixed-rail', side: 'right' },
      tabs: [
        { id: 'overview', label: 'Overview', slots: [] },
      ],
    },
  ],
  wallet: {
    defaultDrawerId: 'wallet',
    defaultTabId: 'overview',
    personaAware: true,
    showTasks: true,
    showRewards: true,
    showLibrary: false,
    sections: {},
  },
  content: {
    allowedVariants: [{ id: 'card-analytics', type: 'card' }],
  },
};
