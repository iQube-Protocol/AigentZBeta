/**
 * Template UI Actions for CopilotKit v1.50
 * 
 * Static GenUI (Stage 1): Copilot can select and render KNYT Liquid UI templates
 * with data bindings. Integrates with SmartTriad state management.
 */

import { getTemplateRegistry } from '@/services/agui/TemplateRegistry';
import { getStateManager } from '@/services/agui/SmartTriadStateManager';

/**
 * Select and render a template based on context
 */
export const selectTemplateAction = {
  name: 'ui_select_template',
  description: `Select the best Liquid UI template based on user intent and context.
  
Available templates:
- knyt:drawer_grid_v1: Browse/discover grid (best for: browse, discover, library)
- knyt:dual_poster_stage_v1: Portrait poster stage (best for: character profiles, cover art)
- knyt:motion_stage_v1: Video/motion stage (best for: watch, motion comics, trailers)
- knyt:quest_hud_hub_v1: Quest/task HUD (best for: ascension, rewards, guided paths)
- knyt:realm_bridge_map_v1: Realm navigation (best for: realm transitions, lore bridging)

Use when user says: "show me", "browse", "watch", "navigate realms", etc.`,
  parameters: [
    {
      name: 'userIntent',
      type: 'string' as const,
      description: 'User intent: browse, discover, watch, character_deep_dive, questing, realm_navigation, etc.',
      required: false,
    },
    {
      name: 'device',
      type: 'string' as const,
      description: 'Device type: mobile, tablet, or desktop',
      required: false,
    },
    {
      name: 'contentMix',
      type: 'string' as const,
      description: 'Content mix: mixed, portrait_focus, landscape_focus, motion_focus',
      required: false,
    },
    {
      name: 'realm',
      type: 'string' as const,
      description: 'KNYT realm: terra, digiterra, metaterra_or',
      required: false,
    },
    {
      name: 'sessionId',
      type: 'string' as const,
      description: 'Session ID for state updates',
      required: false,
    },
  ],
  handler: async ({
    userIntent,
    device = 'desktop',
    contentMix,
    realm,
    sessionId,
  }: {
    userIntent?: string;
    device?: string;
    contentMix?: string;
    realm?: string;
    sessionId?: string;
  }) => {
    try {
      const registry = getTemplateRegistry();
      
      // Select template based on context
      const templateId = registry.selectTemplate({
        userIntent,
        device: device as any,
        contentMix,
        realm,
      });

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
        stateManager.updateField(sessionId, 'liquidUI/selectedTemplateId', templateId);
        if (userIntent) {
          stateManager.updateField(sessionId, 'liquidUI/userIntent', userIntent);
        }
        if (realm) {
          stateManager.updateField(sessionId, 'liquidUI/realmContext', realm);
        }
      }

      return {
        success: true,
        templateId,
        templateName: template.name,
        description: template.description,
        bestFor: template.best_for,
        requiredBindings: Object.keys(template.required_bindings),
        message: `Selected ${template.name} template for ${userIntent || 'general use'}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to select template',
      };
    }
  },
};

/**
 * Render drawer grid template
 */
export const renderDrawerGridAction = {
  name: 'ui_render_drawer_grid',
  description: 'Render browse/discover grid with content cards. Use when user wants to browse library or discover content.',
  parameters: [
    {
      name: 'contentObjects',
      type: 'object' as const,
      description: 'Array of content objects to display',
      required: true,
    },
    {
      name: 'device',
      type: 'string' as const,
      description: 'Device type: mobile, tablet, or desktop',
      required: false,
    },
    {
      name: 'sessionId',
      type: 'string' as const,
      description: 'Session ID for state updates',
      required: false,
    },
  ],
  handler: async ({
    contentObjects,
    device = 'desktop',
    sessionId,
  }: {
    contentObjects: any;
    device?: string;
    sessionId?: string;
  }) => {
    try {
      const registry = getTemplateRegistry();
      const templateId = 'knyt:drawer_grid_v1';
      
      // Validate bindings
      const validation = registry.validateBindings(templateId, { contentObjects, device });
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      // Update state with template and bindings
      if (sessionId) {
        const stateManager = getStateManager();
        const currentState = stateManager.getState(sessionId);
        
        if (currentState) {
          stateManager.updateState(sessionId, {
            liquidUI: {
              ...currentState.liquidUI,
              selectedTemplateId: templateId,
              templateBindings: {
                contentObjects: Array.isArray(contentObjects) ? contentObjects : [contentObjects],
                layoutDecisions: [],
              },
            },
          });
        }
      }

      return {
        success: true,
        templateId,
        bindings: { contentObjects, device },
        message: `Rendering drawer grid with ${Array.isArray(contentObjects) ? contentObjects.length : 1} items`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to render drawer grid',
      };
    }
  },
};

/**
 * Render dual poster stage template
 */
export const renderDualPosterAction = {
  name: 'ui_render_dual_poster',
  description: 'Render large portrait poster stage. Use for character profiles, cover art, or collectible display.',
  parameters: [
    {
      name: 'primaryContent',
      type: 'object' as const,
      description: 'Primary poster content object',
      required: true,
    },
    {
      name: 'secondaryContent',
      type: 'object' as const,
      description: 'Optional secondary poster content',
      required: false,
    },
    {
      name: 'device',
      type: 'string' as const,
      description: 'Device type',
      required: false,
    },
    {
      name: 'sessionId',
      type: 'string' as const,
      description: 'Session ID',
      required: false,
    },
  ],
  handler: async ({
    primaryContent,
    secondaryContent,
    device = 'desktop',
    sessionId,
  }: {
    primaryContent: any;
    secondaryContent?: any;
    device?: string;
    sessionId?: string;
  }) => {
    try {
      const templateId = 'knyt:dual_poster_stage_v1';
      
      if (sessionId) {
        const stateManager = getStateManager();
        const currentState = stateManager.getState(sessionId);
        
        if (currentState) {
          stateManager.updateState(sessionId, {
            liquidUI: {
              ...currentState.liquidUI,
              selectedTemplateId: templateId,
              templateBindings: {
                contentObjects: [primaryContent, secondaryContent].filter(Boolean),
                layoutDecisions: [],
              },
            },
          });
        }
      }

      return {
        success: true,
        templateId,
        bindings: { primaryContent, secondaryContent, device },
        message: `Rendering dual poster stage`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to render dual poster',
      };
    }
  },
};

/**
 * Render motion stage template
 */
export const renderMotionStageAction = {
  name: 'ui_render_motion_stage',
  description: 'Render immersive video/motion stage. Use for motion comics, trailers, or video content.',
  parameters: [
    {
      name: 'videoContent',
      type: 'object' as const,
      description: 'Video/motion content object',
      required: true,
    },
    {
      name: 'clipStrip',
      type: 'object' as const,
      description: 'Optional array of related clips',
      required: false,
    },
    {
      name: 'device',
      type: 'string' as const,
      description: 'Device type',
      required: false,
    },
    {
      name: 'sessionId',
      type: 'string' as const,
      description: 'Session ID',
      required: false,
    },
  ],
  handler: async ({
    videoContent,
    clipStrip,
    device = 'desktop',
    sessionId,
  }: {
    videoContent: any;
    clipStrip?: any;
    device?: string;
    sessionId?: string;
  }) => {
    try {
      const templateId = 'knyt:motion_stage_v1';
      
      if (sessionId) {
        const stateManager = getStateManager();
        const currentState = stateManager.getState(sessionId);
        
        if (currentState) {
          stateManager.updateState(sessionId, {
            liquidUI: {
              ...currentState.liquidUI,
              selectedTemplateId: templateId,
              templateBindings: {
                contentObjects: [videoContent],
                layoutDecisions: [],
              },
            },
          });
        }
      }

      return {
        success: true,
        templateId,
        bindings: { videoContent, clipStrip, device },
        message: `Rendering motion stage`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to render motion stage',
      };
    }
  },
};

/**
 * Render quest HUD template
 */
export const renderQuestHudAction = {
  name: 'ui_render_quest_hud',
  description: 'Render quest/task HUD with rewards. Use for guided paths, ascension, or reward-focused experiences.',
  parameters: [
    {
      name: 'hudData',
      type: 'object' as const,
      description: 'HUD state (tasks, rewards, ascension)',
      required: true,
    },
    {
      name: 'contentStage',
      type: 'object' as const,
      description: 'Optional contextual content',
      required: false,
    },
    {
      name: 'device',
      type: 'string' as const,
      description: 'Device type',
      required: false,
    },
    {
      name: 'sessionId',
      type: 'string' as const,
      description: 'Session ID',
      required: false,
    },
  ],
  handler: async ({
    hudData,
    contentStage,
    device = 'desktop',
    sessionId,
  }: {
    hudData: any;
    contentStage?: any;
    device?: string;
    sessionId?: string;
  }) => {
    try {
      const templateId = 'knyt:quest_hud_hub_v1';
      
      if (sessionId) {
        const stateManager = getStateManager();
        const currentState = stateManager.getState(sessionId);
        
        if (currentState) {
          stateManager.updateState(sessionId, {
            liquidUI: {
              ...currentState.liquidUI,
              selectedTemplateId: templateId,
              templateBindings: {
                contentObjects: contentStage ? [contentStage] : [],
                layoutDecisions: [],
              },
            },
          });
        }
      }

      return {
        success: true,
        templateId,
        bindings: { hudData, contentStage, device },
        message: `Rendering quest HUD`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to render quest HUD',
      };
    }
  },
};

/**
 * Render realm bridge template
 */
export const renderRealmBridgeAction = {
  name: 'ui_render_realm_bridge',
  description: 'Render realm navigation map. Use for transitioning between Terra (real-world), DigiTerra (lore), and metaTerra/or (convergence).',
  parameters: [
    {
      name: 'currentRealm',
      type: 'string' as const,
      description: 'Current realm: terra, digiterra, or metaterra_or',
      required: true,
    },
    {
      name: 'realmContent',
      type: 'object' as const,
      description: 'Content organized by realm',
      required: true,
    },
    {
      name: 'device',
      type: 'string' as const,
      description: 'Device type',
      required: false,
    },
    {
      name: 'sessionId',
      type: 'string' as const,
      description: 'Session ID',
      required: false,
    },
  ],
  handler: async ({
    currentRealm,
    realmContent,
    device = 'desktop',
    sessionId,
  }: {
    currentRealm: string;
    realmContent: any;
    device?: string;
    sessionId?: string;
  }) => {
    try {
      const templateId = 'knyt:realm_bridge_map_v1';
      
      if (sessionId) {
        const stateManager = getStateManager();
        const currentState = stateManager.getState(sessionId);
        
        if (currentState) {
          stateManager.updateState(sessionId, {
            liquidUI: {
              ...currentState.liquidUI,
              selectedTemplateId: templateId,
              realmContext: currentRealm as any,
              templateBindings: {
                contentObjects: [],
                layoutDecisions: [],
              },
            },
          });
        }
      }

      return {
        success: true,
        templateId,
        bindings: { currentRealm, realmContent, device },
        message: `Rendering realm bridge for ${currentRealm}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to render realm bridge',
      };
    }
  },
};

// Export all template actions
export const templateUIActions = [
  selectTemplateAction,
  renderDrawerGridAction,
  renderDualPosterAction,
  renderMotionStageAction,
  renderQuestHudAction,
  renderRealmBridgeAction,
];
