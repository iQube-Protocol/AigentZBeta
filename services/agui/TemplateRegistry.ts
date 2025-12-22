/**
 * Template Registry for Static GenUI (Stage 1)
 * 
 * Maps KNYT Liquid UI templates to React components for CopilotKit rendering.
 * Implements template selection logic and dynamic component loading.
 */

import templatePackData from '@/apps/theqriptopian-web/src/data/knyt_liquid_ui_template_pack.json';

export interface TemplateDefinition {
  template_id: string;
  name: string;
  component_name: string;
  component_path: string;
  description: string;
  best_for: string[];
  required_bindings: Record<string, any>;
  optional_bindings?: Record<string, any>;
  copilot_tool_spec: {
    name: string;
    description: string;
    parameters: Array<{
      name: string;
      type: string;
      required: boolean;
      default?: any;
      description?: string;
    }>;
  };
}

export interface SelectionContext {
  userIntent?: string;
  device: 'mobile' | 'tablet' | 'desktop';
  contentMix?: string;
  realm?: string;
  taskState?: string;
  businessGoal?: string;
  attentionBudget?: string;
}

export class TemplateRegistry {
  private templates: Map<string, TemplateDefinition> = new Map();
  private templatePack: any;

  constructor() {
    this.templatePack = templatePackData;
    this.loadTemplates();
  }

  /**
   * Load template definitions from template pack
   */
  private loadTemplates(): void {
    // Load all 14 KNYT templates: 5 base templates + 9 drawer grid variants
    // All implemented in KnytTemplateRenderer.tsx and CopilotWalletDrawer.tsx
    const templates: TemplateDefinition[] = [
      // ========================================
      // BASE TEMPLATE 1: Drawer Grid (with 9 variants)
      // ========================================
      {
        template_id: 'knyt:drawer_grid_v1',
        name: 'Scrolls Drawer Grid (Auto)',
        component_name: 'DrawerGridTemplate',
        component_path: '@/components/codex/templates/KnytTemplateRenderer',
        description: 'Browse/discover grid layout with automatic variant selection',
        best_for: ['browse', 'discover', 'quick_switch', 'library'],
        required_bindings: {
          contentObjects: 'array',
          device: 'string',
        },
        optional_bindings: {
          layoutVariant: 'string',
          onContentSelect: 'function',
          walletMode: 'string',
        },
        copilot_tool_spec: {
          name: 'ui_render_drawer_grid',
          description: 'Render browse/discover grid with content cards. Automatically selects best layout variant.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
            { name: 'layoutVariant', type: 'string', required: false, description: 'Optional: 1A, 1B, 1C, 2A, 2B, 2C, 3A, 3B' },
          ],
        },
      },
      // Drawer Grid Variant 1A: 2 posters left + 4 wide right + 4 wide row 3 (full)
      {
        template_id: 'knyt:drawer_grid_1a',
        name: 'Drawer Grid 1A (Posters Left, Full Row 3)',
        component_name: 'DrawerGridTemplate',
        component_path: '@/components/codex/templates/KnytTemplateRenderer',
        description: '2 tall posters left + 4 wide cards right + 4 wide cards row 3 (full row)',
        best_for: ['browse', 'portrait_heavy', 'character_gallery'],
        required_bindings: {
          contentObjects: 'array',
          device: 'string',
        },
        copilot_tool_spec: {
          name: 'ui_render_drawer_grid_1a',
          description: 'Render grid with 2 portrait posters on left, 4 wide cards on right, full row 3.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      // Drawer Grid Variant 1B: 2 posters left + 4 wide right + 2 wide row 3 (sparse)
      {
        template_id: 'knyt:drawer_grid_1b',
        name: 'Drawer Grid 1B (Posters Left, Sparse Row 3)',
        component_name: 'DrawerGridTemplate',
        component_path: '@/components/codex/templates/KnytTemplateRenderer',
        description: '2 tall posters left + 4 wide cards right + 2 wide cards row 3 (sparse)',
        best_for: ['browse', 'portrait_focus', 'less_dense'],
        required_bindings: {
          contentObjects: 'array',
          device: 'string',
        },
        copilot_tool_spec: {
          name: 'ui_render_drawer_grid_1b',
          description: 'Render grid with 2 portrait posters on left, 4 wide cards on right, sparse row 3.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      // Drawer Grid Variant 1C: Featured 2x2 stage
      {
        template_id: 'knyt:drawer_grid_1c',
        name: 'Drawer Grid 1C (Featured Stage)',
        component_name: 'DrawerGridTemplate',
        component_path: '@/components/codex/templates/KnytTemplateRenderer',
        description: 'Featured 2x2 stage with supporting content',
        best_for: ['featured_content', 'hero_focus', 'new_release'],
        required_bindings: {
          contentObjects: 'array',
          device: 'string',
        },
        copilot_tool_spec: {
          name: 'ui_render_drawer_grid_1c',
          description: 'Render grid with large featured 2x2 stage.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      // Drawer Grid Variant 2A: Featured 2x2 LEFT + 4 wide right + 4 wide row 3
      {
        template_id: 'knyt:drawer_grid_2a',
        name: 'Drawer Grid 2A (Featured Left)',
        component_name: 'DrawerGridTemplate',
        component_path: '@/components/codex/templates/KnytTemplateRenderer',
        description: 'Featured 2x2 stage on left + 4 wide cards right + 4 wide row 3',
        best_for: ['featured_left', 'hero_with_context'],
        required_bindings: {
          contentObjects: 'array',
          device: 'string',
        },
        copilot_tool_spec: {
          name: 'ui_render_drawer_grid_2a',
          description: 'Render grid with featured stage on left, supporting cards on right.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      // Drawer Grid Variant 2B: Featured 2x2 RIGHT + 4 wide left + 4 wide row 3
      {
        template_id: 'knyt:drawer_grid_2b',
        name: 'Drawer Grid 2B (Featured Right)',
        component_name: 'DrawerGridTemplate',
        component_path: '@/components/codex/templates/KnytTemplateRenderer',
        description: 'Featured 2x2 stage on right + 4 wide cards left + 4 wide row 3',
        best_for: ['featured_right', 'hero_with_context'],
        required_bindings: {
          contentObjects: 'array',
          device: 'string',
        },
        copilot_tool_spec: {
          name: 'ui_render_drawer_grid_2b',
          description: 'Render grid with featured stage on right, supporting cards on left.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      // Drawer Grid Variant 2C: Featured 2x2 CENTER + 2 wide sides + 4 wide row 3
      {
        template_id: 'knyt:drawer_grid_2c',
        name: 'Drawer Grid 2C (Featured Center)',
        component_name: 'DrawerGridTemplate',
        component_path: '@/components/codex/templates/KnytTemplateRenderer',
        description: 'Featured 2x2 stage centered + 2 wide cards on sides + 4 wide row 3',
        best_for: ['featured_center', 'hero_spotlight'],
        required_bindings: {
          contentObjects: 'array',
          device: 'string',
        },
        copilot_tool_spec: {
          name: 'ui_render_drawer_grid_2c',
          description: 'Render grid with featured stage centered, flanked by cards.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      // Drawer Grid Variant 3A: 4 posters (2 left + 2 right) with wide cards
      {
        template_id: 'knyt:drawer_grid_3a',
        name: 'Drawer Grid 3A (4 Posters)',
        component_name: 'DrawerGridTemplate',
        component_path: '@/components/codex/templates/KnytTemplateRenderer',
        description: '2 posters left + 2 wide top-right + 2 posters right + 2 wide bottom-left',
        best_for: ['character_showcase', 'portrait_heavy', 'gallery'],
        required_bindings: {
          contentObjects: 'array',
          device: 'string',
        },
        copilot_tool_spec: {
          name: 'ui_render_drawer_grid_3a',
          description: 'Render grid with 4 portrait posters and supporting wide cards.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      // Drawer Grid Variant 3B: Mirror of 3A
      {
        template_id: 'knyt:drawer_grid_3b',
        name: 'Drawer Grid 3B (4 Posters Mirrored)',
        component_name: 'DrawerGridTemplate',
        component_path: '@/components/codex/templates/KnytTemplateRenderer',
        description: '2 posters right + 2 wide top-left + 2 posters left + 2 wide bottom-right',
        best_for: ['character_showcase', 'portrait_heavy', 'gallery_alt'],
        required_bindings: {
          contentObjects: 'array',
          device: 'string',
        },
        copilot_tool_spec: {
          name: 'ui_render_drawer_grid_3b',
          description: 'Render grid with 4 portrait posters (mirrored layout) and supporting wide cards.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      // ========================================
      // BASE TEMPLATE 2: Dual Poster Stage
      // ========================================
      {
        template_id: 'knyt:dual_poster_stage_v1',
        name: 'Dual Poster Stage',
        component_name: 'DualPosterStageTemplate',
        component_path: '@/components/codex/templates/DualPosterStageTemplate',
        description: '90% height portrait posters with quest rail',
        best_for: ['character_deep_dive', 'cover_art', 'page_review', 'collectible_display'],
        required_bindings: {
          primaryContent: 'object',
          device: 'string',
        },
        optional_bindings: {
          secondaryContent: 'object',
          questRailData: 'object',
        },
        copilot_tool_spec: {
          name: 'ui_render_dual_poster',
          description: 'Render large portrait poster stage. Use for character profiles, cover art, or collectible display.',
          parameters: [
            { name: 'primaryContent', type: 'object', required: true },
            { name: 'secondaryContent', type: 'object', required: false },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      {
        template_id: 'knyt:motion_stage_v1',
        name: 'Immersive Motion Stage',
        component_name: 'MotionStageTemplate',
        component_path: '@/components/codex/templates/MotionStageTemplate',
        description: 'Immersive landscape motion stage with clip strip',
        best_for: ['watch', 'motion_comics', 'trailers', 'scene_review'],
        required_bindings: {
          videoContent: 'object',
          device: 'string',
        },
        optional_bindings: {
          clipStrip: 'array',
        },
        copilot_tool_spec: {
          name: 'ui_render_motion_stage',
          description: 'Render immersive video/motion stage. Use for motion comics, trailers, or video content.',
          parameters: [
            { name: 'videoContent', type: 'object', required: true },
            { name: 'clipStrip', type: 'array', required: false },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      // ========================================
      // BASE TEMPLATE 4: Quest HUD Hub
      // ========================================
      {
        template_id: 'knyt:quest_hud_hub_v1',
        name: 'Quest HUD Hub',
        component_name: 'QuestHudHubTemplate',
        component_path: '@/components/codex/templates/QuestHudHubTemplate',
        description: 'Task/reward/ascension-first HUD with content stage',
        best_for: ['ascension', 'earn_rewards', 'member_get_member', 'guided_paths'],
        required_bindings: {
          hudData: 'object',
          device: 'string',
        },
        optional_bindings: {
          contentStage: 'object',
        },
        copilot_tool_spec: {
          name: 'ui_render_quest_hud',
          description: 'Render quest/task HUD with rewards. Use for guided paths, ascension, or reward-focused experiences.',
          parameters: [
            { name: 'hudData', type: 'object', required: true },
            { name: 'contentStage', type: 'object', required: false },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      // ========================================
      // BASE TEMPLATE 5: Realm Bridge Map
      // ========================================
      {
        template_id: 'knyt:realm_bridge_map_v1',
        name: 'Realm Bridge Map',
        component_name: 'RealmBridgeMapTemplate',
        component_path: '@/components/codex/templates/RealmBridgeMapTemplate',
        description: 'DigiTerra ↔ Terra ↔ metaTerra/or realm navigation',
        best_for: ['bridge_real_to_lore', 'realm_navigation'],
        required_bindings: {
          currentRealm: 'string',
          realmContent: 'object',
          device: 'string',
        },
        optional_bindings: {
          bridgeActions: 'array',
        },
        copilot_tool_spec: {
          name: 'ui_render_realm_bridge',
          description: 'Render realm navigation map. Use for transitioning between Terra (real-world), DigiTerra (lore), and metaTerra/or (convergence).',
          parameters: [
            { name: 'currentRealm', type: 'string', required: true },
            { name: 'realmContent', type: 'object', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
    ];

    templates.forEach(t => this.templates.set(t.template_id, t));
  }

  /**
   * Get template definition by ID
   */
  getTemplate(templateId: string): TemplateDefinition | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * Get all templates
   */
  getAllTemplates(): TemplateDefinition[] {
    return Array.from(this.templates.values());
  }

  /**
   * Select best template based on context
   * Implements template selection policy from knyt_liquid_ui_template_pack.json
   */
  selectTemplate(context: SelectionContext): string {
    const { userIntent, device, contentMix, realm, taskState, businessGoal } = context;

    // Priority order: user_intent > content_mix > realm > device > task_state > business_goal

    // Rule 1: Browse/discover with mixed/portrait content → drawer_grid
    if (
      userIntent &&
      ['browse', 'discover'].includes(userIntent) &&
      (!contentMix || ['mixed', 'mostly_portrait'].includes(contentMix))
    ) {
      return 'knyt:drawer_grid_v1';
    }

    // Rule 2: Character/cover/page focus with portrait → dual_poster_stage
    if (
      userIntent &&
      ['character_deep_dive', 'cover_art', 'page_review'].includes(userIntent) &&
      contentMix === 'portrait_focus'
    ) {
      return 'knyt:dual_poster_stage_v1';
    }

    // Rule 3: Watch/immersive with motion/landscape → motion_stage
    if (
      userIntent &&
      ['watch', 'immersive_review'].includes(userIntent) &&
      contentMix &&
      ['motion_focus', 'landscape_focus'].includes(contentMix)
    ) {
      return 'knyt:motion_stage_v1';
    }

    // Rule 4: Questing/ascension/rewards with active tasks → quest_hud_hub
    if (
      userIntent &&
      ['questing', 'ascension', 'earn_rewards'].includes(userIntent) &&
      taskState &&
      ['active', 'needs_guidance'].includes(taskState)
    ) {
      return 'knyt:quest_hud_hub_v1';
    }

    // Rule 5: Realm navigation/bridging → realm_bridge_map
    if (
      userIntent &&
      ['bridge_real_to_lore', 'realm_navigation'].includes(userIntent) &&
      realm &&
      ['terra', 'metaterra_or'].includes(realm)
    ) {
      return 'knyt:realm_bridge_map_v1';
    }

    // Default fallback: drawer_grid for general browsing
    return 'knyt:drawer_grid_v1';
  }

  /**
   * Generate CopilotKit action specs for all templates
   */
  getCopilotActionSpecs(): any[] {
    return this.getAllTemplates().map(template => ({
      name: template.copilot_tool_spec.name,
      description: template.copilot_tool_spec.description,
      parameters: template.copilot_tool_spec.parameters.map(p => ({
        name: p.name,
        type: p.type as any,
        description: p.description || `${p.name} parameter`,
        required: p.required,
      })),
      handler: async (params: any) => {
        // Return template selection result
        return {
          success: true,
          templateId: template.template_id,
          templateName: template.name,
          bindings: params,
          message: `Selected template: ${template.name}`,
        };
      },
    }));
  }

  /**
   * Validate bindings against template requirements
   */
  validateBindings(templateId: string, bindings: any): { valid: boolean; errors: string[] } {
    const template = this.getTemplate(templateId);
    if (!template) {
      return { valid: false, errors: [`Template not found: ${templateId}`] };
    }

    const errors: string[] = [];
    const requiredKeys = Object.keys(template.required_bindings);

    for (const key of requiredKeys) {
      if (!(key in bindings)) {
        errors.push(`Missing required binding: ${key}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
let registry: TemplateRegistry | null = null;

export function getTemplateRegistry(): TemplateRegistry {
  if (!registry) {
    registry = new TemplateRegistry();
  }
  return registry;
}
