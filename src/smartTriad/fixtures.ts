import type { SmartTriadSet } from './model';
import type { SmartMenuItem } from './ui/types';

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

// =============================================================================
// LIVING CANON — 21 Sats Smart Menu items
//
// These items close the parity gap between the Lovable thin client smart menu
// (the authoritative reference) and the platform-side SmartMenuRail.
// The Lovable thin client exposes these actions; the platform must match them.
//
// Items are carried through MENU_ACTION bridge messages (ShellOutboundType).
// The Runtime receives the action + ladderingContext in the payload and routes
// to the appropriate surface: KnytSubmissionShell, vote UI, Order tab, etc.
// =============================================================================

// Placeholder icon nodes — replaced by the consuming component with real icons
const _placeholder = null;

export const livingCanonMenuItems: SmartMenuItem[] = [
  {
    id: 'lc-vote',
    icon: _placeholder,
    label: 'Vote',
    tooltip: 'Vote on active community elections',
    action: 'vote',
    ladderingContext: { worldId: '21sats' },
  },
  {
    id: 'lc-contribute',
    icon: _placeholder,
    label: 'Contribute',
    tooltip: 'Submit a dispatch, theory, or observation',
    action: 'submitContribution',
    ladderingContext: { branchTarget: 'community', worldId: '21sats' },
  },
  {
    id: 'lc-correspond',
    icon: _placeholder,
    label: 'Correspond',
    tooltip: 'File a correspondent report',
    action: 'correspond',
    ladderingContext: { branchTarget: 'correspondent', worldId: '21sats' },
  },
  {
    id: 'lc-progress',
    icon: _placeholder,
    label: 'Order',
    tooltip: 'View Order of Metaiye progression',
    action: 'viewProgress',
    ladderingContext: { worldId: '21sats' },
  },
];

export const livingCanonTriadSet: SmartTriadSet = {
  id: 'ds:living-canon:21sats:persona-knyt',
  appId: 'metaKnyts',
  personaId: 'knyt',
  dynamicMode: 'copilot-suggest',
  drawers: [
    {
      id: 'living-canon',
      label: '21 Sats',
      side: 'right',
      defaultSize: 'immersive-3q',
      defaultMenuBehavior: { mode: 'collapsed-pill', side: 'left' },
      tabs: [
        { id: 'canon',        label: 'Canon',        slots: [] },
        { id: 'community',    label: 'Community',    slots: [] },
        { id: 'correspondent',label: 'Correspondent',slots: [] },
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
        { id: 'tasks',    label: 'Tasks',    slots: [] },
        { id: 'rewards',  label: 'Rewards',  slots: [] },
      ],
    },
  ],
  wallet: {
    defaultDrawerId: 'wallet',
    defaultTabId: 'overview',
    personaAware: true,
    showTasks: true,   // vote tasks + contribution tasks surface here
    showRewards: true,
    showLibrary: false,
    sections: {
      tasksSlotId: 'wallet-tasks',
    },
  },
  content: {
    allowedVariants: [
      { id: 'card-immersive', type: 'full' },
      { id: 'card-panel-3q',  type: 'card' },
    ],
  },
};
