/**
 * Complete Template UI Actions for CopilotKit v1.50
 * 
 * All 14 main stage templates + 9 SmartWallet templates
 * Integrates with SmartTriad state management via AG-UI
 */

import { getTemplateRegistry } from '@/services/agui/TemplateRegistry';
import { getStateManager } from '@/services/agui/SmartTriadStateManager';

// ============================================================================
// DRAWER GRID VARIANTS (10 actions: base + 9 variants)
// ============================================================================

/**
 * Base drawer grid with automatic variant selection
 */
export const renderDrawerGridAction = {
  name: 'ui_render_drawer_grid',
  description: 'Render browse/discover grid with automatic layout variant selection. Use when user wants to browse library or discover content.',
  parameters: [
    { name: 'contentObjects', type: 'array' as const, required: true, description: 'Content items to display' },
    { name: 'device', type: 'string' as const, required: false, default: 'desktop' },
    { name: 'layoutVariant', type: 'string' as const, required: false, description: 'Optional: 1A, 1B, 1C, 2A, 2B, 2C, 3A, 3B' },
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ contentObjects, device = 'desktop', layoutVariant, sessionId }: any) => {
    return handleTemplateRender('knyt:drawer_grid_v1', { contentObjects, device, layoutVariant }, sessionId);
  },
};

/**
 * Drawer Grid 1A: 2 posters left + 4 wide right + 4 wide row 3 (full)
 */
export const renderDrawerGrid1AAction = {
  name: 'ui_render_drawer_grid_1a',
  description: 'Render grid with 2 portrait posters on left, 4 wide cards on right, full row 3. Best for portrait-heavy content.',
  parameters: [
    { name: 'contentObjects', type: 'array' as const, required: true },
    { name: 'device', type: 'string' as const, required: false, default: 'desktop' },
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ contentObjects, device = 'desktop', sessionId }: any) => {
    return handleTemplateRender('knyt:drawer_grid_1a', { contentObjects, device, layoutVariant: '1A' }, sessionId);
  },
};

/**
 * Drawer Grid 1B: 2 posters left + 4 wide right + 2 wide row 3 (sparse)
 */
export const renderDrawerGrid1BAction = {
  name: 'ui_render_drawer_grid_1b',
  description: 'Render grid with 2 portrait posters on left, 4 wide cards on right, sparse row 3. Less dense layout.',
  parameters: [
    { name: 'contentObjects', type: 'array' as const, required: true },
    { name: 'device', type: 'string' as const, required: false, default: 'desktop' },
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ contentObjects, device = 'desktop', sessionId }: any) => {
    return handleTemplateRender('knyt:drawer_grid_1b', { contentObjects, device, layoutVariant: '1B' }, sessionId);
  },
};

/**
 * Drawer Grid 1C: Featured 2x2 stage
 */
export const renderDrawerGrid1CAction = {
  name: 'ui_render_drawer_grid_1c',
  description: 'Render grid with large featured 2x2 stage. Best for hero content or new releases.',
  parameters: [
    { name: 'contentObjects', type: 'array' as const, required: true },
    { name: 'device', type: 'string' as const, required: false, default: 'desktop' },
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ contentObjects, device = 'desktop', sessionId }: any) => {
    return handleTemplateRender('knyt:drawer_grid_1c', { contentObjects, device, layoutVariant: '1C' }, sessionId);
  },
};

/**
 * Drawer Grid 2A: Featured 2x2 LEFT
 */
export const renderDrawerGrid2AAction = {
  name: 'ui_render_drawer_grid_2a',
  description: 'Render grid with featured stage on left, supporting cards on right.',
  parameters: [
    { name: 'contentObjects', type: 'array' as const, required: true },
    { name: 'device', type: 'string' as const, required: false, default: 'desktop' },
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ contentObjects, device = 'desktop', sessionId }: any) => {
    return handleTemplateRender('knyt:drawer_grid_2a', { contentObjects, device, layoutVariant: '2A' }, sessionId);
  },
};

/**
 * Drawer Grid 2B: Featured 2x2 RIGHT
 */
export const renderDrawerGrid2BAction = {
  name: 'ui_render_drawer_grid_2b',
  description: 'Render grid with featured stage on right, supporting cards on left.',
  parameters: [
    { name: 'contentObjects', type: 'array' as const, required: true },
    { name: 'device', type: 'string' as const, required: false, default: 'desktop' },
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ contentObjects, device = 'desktop', sessionId }: any) => {
    return handleTemplateRender('knyt:drawer_grid_2b', { contentObjects, device, layoutVariant: '2B' }, sessionId);
  },
};

/**
 * Drawer Grid 2C: Featured 2x2 CENTER
 */
export const renderDrawerGrid2CAction = {
  name: 'ui_render_drawer_grid_2c',
  description: 'Render grid with featured stage centered, flanked by cards.',
  parameters: [
    { name: 'contentObjects', type: 'array' as const, required: true },
    { name: 'device', type: 'string' as const, required: false, default: 'desktop' },
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ contentObjects, device = 'desktop', sessionId }: any) => {
    return handleTemplateRender('knyt:drawer_grid_2c', { contentObjects, device, layoutVariant: '2C' }, sessionId);
  },
};

/**
 * Drawer Grid 3A: 4 posters layout
 */
export const renderDrawerGrid3AAction = {
  name: 'ui_render_drawer_grid_3a',
  description: 'Render grid with 4 portrait posters and supporting wide cards. Best for character showcases.',
  parameters: [
    { name: 'contentObjects', type: 'array' as const, required: true },
    { name: 'device', type: 'string' as const, required: false, default: 'desktop' },
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ contentObjects, device = 'desktop', sessionId }: any) => {
    return handleTemplateRender('knyt:drawer_grid_3a', { contentObjects, device, layoutVariant: '3A' }, sessionId);
  },
};

/**
 * Drawer Grid 3B: 4 posters mirrored layout
 */
export const renderDrawerGrid3BAction = {
  name: 'ui_render_drawer_grid_3b',
  description: 'Render grid with 4 portrait posters (mirrored layout) and supporting wide cards.',
  parameters: [
    { name: 'contentObjects', type: 'array' as const, required: true },
    { name: 'device', type: 'string' as const, required: false, default: 'desktop' },
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ contentObjects, device = 'desktop', sessionId }: any) => {
    return handleTemplateRender('knyt:drawer_grid_3b', { contentObjects, device, layoutVariant: '3B' }, sessionId);
  },
};

// ============================================================================
// BASE TEMPLATES (4 additional templates)
// ============================================================================

/**
 * Dual Poster Stage
 */
export const renderDualPosterAction = {
  name: 'ui_render_dual_poster',
  description: 'Render large portrait poster stage. Use for character profiles, cover art, or collectible display.',
  parameters: [
    { name: 'primaryContent', type: 'object' as const, required: true },
    { name: 'secondaryContent', type: 'object' as const, required: false },
    { name: 'device', type: 'string' as const, required: false, default: 'desktop' },
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ primaryContent, secondaryContent, device = 'desktop', sessionId }: any) => {
    return handleTemplateRender('knyt:dual_poster_stage_v1', { primaryContent, secondaryContent, device }, sessionId);
  },
};

/**
 * Motion Stage
 */
export const renderMotionStageAction = {
  name: 'ui_render_motion_stage',
  description: 'Render immersive video/motion stage. Use for motion comics, trailers, or video content.',
  parameters: [
    { name: 'videoContent', type: 'object' as const, required: true },
    { name: 'clipStrip', type: 'array' as const, required: false },
    { name: 'device', type: 'string' as const, required: false, default: 'desktop' },
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ videoContent, clipStrip, device = 'desktop', sessionId }: any) => {
    return handleTemplateRender('knyt:motion_stage_v1', { videoContent, clipStrip, device }, sessionId);
  },
};

/**
 * Quest HUD Hub
 */
export const renderQuestHudAction = {
  name: 'ui_render_quest_hud',
  description: 'Render quest/task HUD with rewards. Use for guided paths, ascension, or reward-focused experiences.',
  parameters: [
    { name: 'hudData', type: 'object' as const, required: true },
    { name: 'contentStage', type: 'object' as const, required: false },
    { name: 'device', type: 'string' as const, required: false, default: 'desktop' },
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ hudData, contentStage, device = 'desktop', sessionId }: any) => {
    return handleTemplateRender('knyt:quest_hud_hub_v1', { hudData, contentStage, device }, sessionId);
  },
};

/**
 * Realm Bridge Map
 */
export const renderRealmBridgeAction = {
  name: 'ui_render_realm_bridge',
  description: 'Render realm navigation map. Use for transitioning between Terra (real-world), DigiTerra (lore), and metaTerra/or (convergence).',
  parameters: [
    { name: 'currentRealm', type: 'string' as const, required: true },
    { name: 'realmContent', type: 'object' as const, required: true },
    { name: 'device', type: 'string' as const, required: false, default: 'desktop' },
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ currentRealm, realmContent, device = 'desktop', sessionId }: any) => {
    return handleTemplateRender('knyt:realm_bridge_map_v1', { currentRealm, realmContent, device }, sessionId);
  },
};

// ============================================================================
// SMARTWALLET ACTIONS (9 wallet templates)
// ============================================================================

/**
 * Open Wallet (Narrow Mode)
 */
export const openWalletNarrowAction = {
  name: 'wallet_open_narrow',
  description: 'Open wallet in narrow mode for glance + quick actions (balance, rewards, tasks).',
  parameters: [
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ sessionId }: any) => {
    return handleWalletAction('OPEN_WALLET', { mode: 'narrow' }, sessionId);
  },
};

/**
 * Open Wallet (Wide Mode)
 */
export const openWalletWideAction = {
  name: 'wallet_open_wide',
  description: 'Open wallet in wide mode for multi-step flows (checkout, send/request, permissions).',
  parameters: [
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ sessionId }: any) => {
    return handleWalletAction('OPEN_WALLET', { mode: 'wide' }, sessionId);
  },
};

/**
 * Show Balance Card
 */
export const showBalanceCardAction = {
  name: 'wallet_show_balance',
  description: 'Show KNYT balance card in wallet drawer.',
  parameters: [
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ sessionId }: any) => {
    return handleWalletAction('OPEN_WALLET', { mode: 'narrow', component: 'wallet_card.balance' }, sessionId);
  },
};

/**
 * Show Reward Claim Card
 */
export const showRewardClaimAction = {
  name: 'wallet_show_rewards',
  description: 'Show pending rewards claim card in wallet drawer.',
  parameters: [
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ sessionId }: any) => {
    return handleWalletAction('OPEN_WALLET', { mode: 'narrow', component: 'wallet_card.reward_claim' }, sessionId);
  },
};

/**
 * Show Unlock Offer Card
 */
export const showUnlockOfferAction = {
  name: 'wallet_show_unlock_offer',
  description: 'Show content unlock offer card in wallet drawer.',
  parameters: [
    { name: 'contentId', type: 'string' as const, required: false },
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ contentId, sessionId }: any) => {
    return handleWalletAction('OPEN_WALLET', { mode: 'narrow', component: 'wallet_card.unlock_offer', contentId }, sessionId);
  },
};

/**
 * Show Referral Invite Card
 */
export const showReferralInviteAction = {
  name: 'wallet_show_referral',
  description: 'Show referral/invite card for growth actions.',
  parameters: [
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ sessionId }: any) => {
    return handleWalletAction('OPEN_WALLET', { mode: 'narrow', component: 'wallet_card.referral_invite' }, sessionId);
  },
};

/**
 * Show Task Step Card
 */
export const showTaskStepAction = {
  name: 'wallet_show_task',
  description: 'Show next task step card in wallet drawer.',
  parameters: [
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ sessionId }: any) => {
    return handleWalletAction('OPEN_WALLET', { mode: 'narrow', component: 'wallet_card.task_step' }, sessionId);
  },
};

/**
 * Show Checkout Modal
 */
export const showCheckoutModalAction = {
  name: 'wallet_show_checkout',
  description: 'Show checkout modal for purchase/unlock flow.',
  parameters: [
    { name: 'contentId', type: 'string' as const, required: true },
    { name: 'price', type: 'number' as const, required: true },
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ contentId, price, sessionId }: any) => {
    return handleWalletAction('OPEN_WALLET', { mode: 'wide', component: 'wallet_modal.checkout', contentId, price }, sessionId);
  },
};

/**
 * Show Send/Request Modal
 */
export const showSendRequestModalAction = {
  name: 'wallet_show_send_request',
  description: 'Show send/request modal for Q¢ transfers via x402.',
  parameters: [
    { name: 'sessionId', type: 'string' as const, required: false },
  ],
  handler: async ({ sessionId }: any) => {
    return handleWalletAction('OPEN_WALLET', { mode: 'wide', component: 'wallet_modal.send_request' }, sessionId);
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function handleTemplateRender(templateId: string, bindings: any, sessionId?: string) {
  try {
    const registry = getTemplateRegistry();
    const template = registry.getTemplate(templateId);
    
    if (!template) {
      return {
        success: false,
        error: `Template not found: ${templateId}`,
      };
    }

    // Update SmartTriad state if session provided
    if (sessionId) {
      const stateManager = getStateManager();
      const currentState = stateManager.getState(sessionId);
      
      if (currentState) {
        stateManager.updateState(sessionId, {
          liquidUI: {
            ...currentState.liquidUI,
            selectedTemplateId: templateId,
            templateBindings: {
              contentObjects: bindings.contentObjects || [],
              layoutDecisions: [],
            },
          },
        });
      }
    }

    return {
      success: true,
      templateId,
      templateName: template.name,
      bindings,
      message: `Rendering ${template.name}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to render template',
    };
  }
}

async function handleWalletAction(actionType: string, payload: any, sessionId?: string) {
  try {
    if (sessionId) {
      const stateManager = getStateManager();
      const currentState = stateManager.getState(sessionId);
      
      if (currentState) {
        stateManager.updateState(sessionId, {
          smartTriad: {
            ...currentState.smartTriad,
            wallet: {
              ...currentState.smartTriad.wallet,
              walletOpen: true,
              walletMode: payload.mode || 'narrow',
            },
          },
        });
      }
    }

    return {
      success: true,
      action: actionType,
      payload,
      message: `Wallet action: ${actionType}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to execute wallet action',
    };
  }
}

// Export all template actions (14 main stage + 9 wallet = 23 total)
export const completeTemplateUIActions = [
  // Drawer Grid (10 actions)
  renderDrawerGridAction,
  renderDrawerGrid1AAction,
  renderDrawerGrid1BAction,
  renderDrawerGrid1CAction,
  renderDrawerGrid2AAction,
  renderDrawerGrid2BAction,
  renderDrawerGrid2CAction,
  renderDrawerGrid3AAction,
  renderDrawerGrid3BAction,
  // Base Templates (4 actions)
  renderDualPosterAction,
  renderMotionStageAction,
  renderQuestHudAction,
  renderRealmBridgeAction,
  // SmartWallet (9 actions)
  openWalletNarrowAction,
  openWalletWideAction,
  showBalanceCardAction,
  showRewardClaimAction,
  showUnlockOfferAction,
  showReferralInviteAction,
  showTaskStepAction,
  showCheckoutModalAction,
  showSendRequestModalAction,
];
