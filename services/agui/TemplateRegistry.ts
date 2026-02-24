/**
 * Template Registry for Liquid UI (Stage 1)
 * 
 * Maps Liquid UI base templates to renderer components for CopilotKit and composer flows.
 * Implements template selection logic and dynamic component loading.
 */

import templatePackData from '@/apps/theqriptopian-web/src/data/knyt_liquid_ui_template_pack.json';

const TEMPLATE_ALIASES: Record<string, string> = {
  'knyt:drawer_grid_v1': 'liquidui:drawer_grid_v1',
  'knyt:drawer_grid_1a': 'liquidui:drawer_grid_1a',
  'knyt:drawer_grid_1b': 'liquidui:drawer_grid_1b',
  'knyt:drawer_grid_1c': 'liquidui:drawer_grid_1c',
  'knyt:drawer_grid_2a': 'liquidui:drawer_grid_2a',
  'knyt:drawer_grid_2b': 'liquidui:drawer_grid_2b',
  'knyt:drawer_grid_2c': 'liquidui:drawer_grid_2c',
  'knyt:drawer_grid_3a': 'liquidui:drawer_grid_3a',
  'knyt:drawer_grid_3b': 'liquidui:drawer_grid_3b',
  'knyt:dual_poster_stage_v1': 'liquidui:drawer_grid_2c',
  'knyt:motion_stage_v1': 'liquidui:drawer_grid_2a',
  'knyt:quest_hud_hub_v1': 'liquidui:drawer_grid_2a',
  'knyt:realm_bridge_map_v1': 'liquidui:drawer_grid_2a',
};

export interface TemplateDefinition {
  template_id: string;
  name: string;
  component_name: string;
  component_path: string;
  description: string;
  archetype: string;
  core?: boolean;
  status?: 'active' | 'placeholder';
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
    const drawerPath = '@/app/triad/components/codex/liquidTemplates/KnytDrawerGridFallbackTemplate';
    const placeholderPath = '@/app/triad/components/codex/liquidTemplates/LiquidUIPlaceholderTemplate';

    const templates: TemplateDefinition[] = [
      {
        template_id: 'liquidui:drawer_grid_v1',
        name: 'LiquidUI Drawer Grid (Catalog)',
        component_name: 'LiquidUIDrawerGrid',
        component_path: drawerPath,
        description: 'Catalog or gallery grid with drawer framing.',
        archetype: 'catalog_gallery',
        core: true,
        status: 'active',
        best_for: ['browse', 'catalog', 'gallery'],
        required_bindings: { contentObjects: 'array', device: 'string' },
        optional_bindings: { layoutVariant: 'string', onContentSelect: 'function', walletMode: 'string' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_drawer_grid',
          description: 'Render catalog grid with auto layout selection.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
            { name: 'layoutVariant', type: 'string', required: false, description: 'Optional: 1A, 1B, 1C, 2A, 2B, 2C, 3A, 3B' },
          ],
        },
      },
      {
        template_id: 'liquidui:drawer_grid_1a',
        name: 'LiquidUI Drawer Grid 1A (Feed Stream)',
        component_name: 'LiquidUIDrawerGrid',
        component_path: drawerPath,
        description: 'Feed-focused grid layout with a strong hero emphasis.',
        archetype: 'feed_stream',
        core: true,
        status: 'active',
        best_for: ['feed', 'discover', 'stream'],
        required_bindings: { contentObjects: 'array', device: 'string' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_drawer_grid_1a',
          description: 'Render feed layout with a hero-first grid.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      {
        template_id: 'liquidui:drawer_grid_1b',
        name: 'LiquidUI Drawer Grid 1B (Search Results)',
        component_name: 'LiquidUIDrawerGrid',
        component_path: drawerPath,
        description: 'Search results grid with tighter density.',
        archetype: 'search_filter',
        core: true,
        status: 'active',
        best_for: ['search', 'filter', 'query'],
        required_bindings: { contentObjects: 'array', device: 'string' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_drawer_grid_1b',
          description: 'Render search results grid.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      {
        template_id: 'liquidui:drawer_grid_1c',
        name: 'LiquidUI Drawer Grid 1C (Compare)',
        component_name: 'LiquidUIDrawerGrid',
        component_path: drawerPath,
        description: 'Featured comparison grid with a decision focus.',
        archetype: 'compare_decision',
        core: false,
        status: 'active',
        best_for: ['compare', 'decide', 'evaluate'],
        required_bindings: { contentObjects: 'array', device: 'string' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_drawer_grid_1c',
          description: 'Render comparison grid with a featured stage.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      {
        template_id: 'liquidui:drawer_grid_2a',
        name: 'LiquidUI Drawer Grid 2A (Dashboard)',
        component_name: 'LiquidUIDrawerGrid',
        component_path: drawerPath,
        description: 'Dashboard grid with KPIs and featured highlights.',
        archetype: 'dashboard_kpi',
        core: true,
        status: 'active',
        best_for: ['dashboard', 'monitor', 'kpi'],
        required_bindings: { contentObjects: 'array', device: 'string' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_drawer_grid_2a',
          description: 'Render dashboard grid with a featured stage.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      {
        template_id: 'liquidui:drawer_grid_2b',
        name: 'LiquidUI Drawer Grid 2B (Workspace)',
        component_name: 'LiquidUIDrawerGrid',
        component_path: drawerPath,
        description: 'Workspace grid with list-detail emphasis.',
        archetype: 'workspace_table',
        core: true,
        status: 'active',
        best_for: ['workspace', 'manage', 'organize'],
        required_bindings: { contentObjects: 'array', device: 'string' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_drawer_grid_2b',
          description: 'Render workspace grid with detail emphasis.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      {
        template_id: 'liquidui:drawer_grid_2c',
        name: 'LiquidUI Drawer Grid 2C (Entity Detail)',
        component_name: 'LiquidUIDrawerGrid',
        component_path: drawerPath,
        description: 'Entity detail grid with primary focus area.',
        archetype: 'entity_detail',
        core: true,
        status: 'active',
        best_for: ['detail', 'profile', 'entity'],
        required_bindings: { contentObjects: 'array', device: 'string' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_drawer_grid_2c',
          description: 'Render entity detail grid with primary focus.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      {
        template_id: 'liquidui:drawer_grid_3a',
        name: 'LiquidUI Drawer Grid 3A (Inbox)',
        component_name: 'LiquidUIDrawerGrid',
        component_path: drawerPath,
        description: 'Inbox and thread list grid.',
        archetype: 'inbox_threads',
        core: true,
        status: 'active',
        best_for: ['inbox', 'threads', 'messages'],
        required_bindings: { contentObjects: 'array', device: 'string' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_drawer_grid_3a',
          description: 'Render inbox thread grid.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      {
        template_id: 'liquidui:drawer_grid_3b',
        name: 'LiquidUI Drawer Grid 3B (Community)',
        component_name: 'LiquidUIDrawerGrid',
        component_path: drawerPath,
        description: 'Community and forum grid.',
        archetype: 'community_forum',
        core: false,
        status: 'active',
        best_for: ['community', 'forum', 'topics'],
        required_bindings: { contentObjects: 'array', device: 'string' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_drawer_grid_3b',
          description: 'Render community grid.',
          parameters: [
            { name: 'contentObjects', type: 'array', required: true },
            { name: 'device', type: 'string', required: false, default: 'desktop' },
          ],
        },
      },
      {
        template_id: 'liquidui:reader_viewer_v1',
        name: 'LiquidUI Reader',
        component_name: 'LiquidUIPlaceholderTemplate',
        component_path: placeholderPath,
        description: 'Long-form reader and media viewer.',
        archetype: 'reader_viewer',
        core: true,
        status: 'placeholder',
        best_for: ['read', 'watch', 'consume'],
        required_bindings: { contentObject: 'object' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_reader',
          description: 'Render a long-form reader or media viewer.',
          parameters: [
            { name: 'contentObject', type: 'object', required: true },
          ],
        },
      },
      {
        template_id: 'liquidui:chat_conversation_v1',
        name: 'LiquidUI Chat',
        component_name: 'LiquidUIPlaceholderTemplate',
        component_path: placeholderPath,
        description: 'Conversational chat and agent threads.',
        archetype: 'chat_conversation',
        core: true,
        status: 'placeholder',
        best_for: ['chat', 'conversation', 'assist'],
        required_bindings: { messages: 'array' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_chat',
          description: 'Render a chat conversation.',
          parameters: [
            { name: 'messages', type: 'array', required: true },
          ],
        },
      },
      {
        template_id: 'liquidui:editor_compose_v1',
        name: 'LiquidUI Editor',
        component_name: 'LiquidUIPlaceholderTemplate',
        component_path: placeholderPath,
        description: 'Structured editor for creating and publishing.',
        archetype: 'editor_compose',
        core: true,
        status: 'placeholder',
        best_for: ['create', 'edit', 'compose'],
        required_bindings: { document: 'object' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_editor',
          description: 'Render a document editor.',
          parameters: [
            { name: 'document', type: 'object', required: true },
          ],
        },
      },
      {
        template_id: 'liquidui:canvas_workspace_v1',
        name: 'LiquidUI Canvas',
        component_name: 'LiquidUIPlaceholderTemplate',
        component_path: placeholderPath,
        description: 'Spatial canvas for freeform work.',
        archetype: 'canvas_workspace',
        core: true,
        status: 'placeholder',
        best_for: ['canvas', 'whiteboard', 'design'],
        required_bindings: { nodes: 'array' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_canvas',
          description: 'Render a freeform canvas workspace.',
          parameters: [
            { name: 'nodes', type: 'array', required: true },
          ],
        },
      },
      {
        template_id: 'liquidui:settings_admin_v1',
        name: 'LiquidUI Settings',
        component_name: 'LiquidUIPlaceholderTemplate',
        component_path: placeholderPath,
        description: 'Settings and admin console.',
        archetype: 'settings_admin',
        core: true,
        status: 'placeholder',
        best_for: ['settings', 'admin', 'configure'],
        required_bindings: { settings: 'object' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_settings',
          description: 'Render settings or admin console.',
          parameters: [
            { name: 'settings', type: 'object', required: true },
          ],
        },
      },
      {
        template_id: 'liquidui:timeline_activity_v1',
        name: 'LiquidUI Timeline',
        component_name: 'LiquidUIPlaceholderTemplate',
        component_path: placeholderPath,
        description: 'Activity timeline and changelog.',
        archetype: 'timeline_activity',
        core: false,
        status: 'placeholder',
        best_for: ['timeline', 'activity', 'history'],
        required_bindings: { events: 'array' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_timeline',
          description: 'Render an activity timeline.',
          parameters: [
            { name: 'events', type: 'array', required: true },
          ],
        },
      },
      {
        template_id: 'liquidui:meeting_live_room_v1',
        name: 'LiquidUI Live Room',
        component_name: 'LiquidUIPlaceholderTemplate',
        component_path: placeholderPath,
        description: 'Live meeting room for audio/video sessions.',
        archetype: 'meeting_live_room',
        core: false,
        status: 'placeholder',
        best_for: ['meeting', 'live', 'collaborate'],
        required_bindings: { session: 'object' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_live_room',
          description: 'Render a live meeting room.',
          parameters: [
            { name: 'session', type: 'object', required: true },
          ],
        },
      },
      {
        template_id: 'liquidui:builder_ide_v1',
        name: 'LiquidUI Builder',
        component_name: 'LiquidUIPlaceholderTemplate',
        component_path: placeholderPath,
        description: 'Builder or IDE workspace.',
        archetype: 'builder_ide',
        core: false,
        status: 'placeholder',
        best_for: ['build', 'code', 'workflow'],
        required_bindings: { project: 'object' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_builder',
          description: 'Render a builder or IDE workspace.',
          parameters: [
            { name: 'project', type: 'object', required: true },
          ],
        },
      },
      {
        template_id: 'liquidui:notebook_lab_v1',
        name: 'LiquidUI Notebook',
        component_name: 'LiquidUIPlaceholderTemplate',
        component_path: placeholderPath,
        description: 'Notebook and experiment lab.',
        archetype: 'notebook_lab',
        core: false,
        status: 'placeholder',
        best_for: ['notebook', 'lab', 'experiment'],
        required_bindings: { cells: 'array' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_notebook',
          description: 'Render a notebook lab.',
          parameters: [
            { name: 'cells', type: 'array', required: true },
          ],
        },
      },
      {
        template_id: 'liquidui:checkout_payment_v1',
        name: 'LiquidUI Checkout',
        component_name: 'LiquidUIPlaceholderTemplate',
        component_path: placeholderPath,
        description: 'Checkout and payment flow.',
        archetype: 'checkout_payment',
        core: false,
        status: 'placeholder',
        best_for: ['checkout', 'payment', 'purchase'],
        required_bindings: { lineItems: 'array' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_checkout',
          description: 'Render a checkout flow.',
          parameters: [
            { name: 'lineItems', type: 'array', required: true },
          ],
        },
      },
      {
        template_id: 'liquidui:marketplace_exchange_v1',
        name: 'LiquidUI Marketplace',
        component_name: 'LiquidUIPlaceholderTemplate',
        component_path: placeholderPath,
        description: 'Marketplace and exchange layout.',
        archetype: 'marketplace_exchange',
        core: false,
        status: 'placeholder',
        best_for: ['marketplace', 'exchange', 'listings'],
        required_bindings: { listings: 'array' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_marketplace',
          description: 'Render a marketplace view.',
          parameters: [
            { name: 'listings', type: 'array', required: true },
          ],
        },
      },
      {
        template_id: 'liquidui:board_kanban_v1',
        name: 'LiquidUI Board',
        component_name: 'LiquidUIPlaceholderTemplate',
        component_path: placeholderPath,
        description: 'Kanban or stage board.',
        archetype: 'board_kanban',
        core: false,
        status: 'placeholder',
        best_for: ['board', 'kanban', 'pipeline'],
        required_bindings: { columns: 'array' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_board',
          description: 'Render a kanban board.',
          parameters: [
            { name: 'columns', type: 'array', required: true },
          ],
        },
      },
      {
        template_id: 'liquidui:map_geo_v1',
        name: 'LiquidUI Map',
        component_name: 'LiquidUIPlaceholderTemplate',
        component_path: placeholderPath,
        description: 'Map and geo layout.',
        archetype: 'map_geo',
        core: false,
        status: 'placeholder',
        best_for: ['map', 'geo', 'location'],
        required_bindings: { points: 'array' },
        copilot_tool_spec: {
          name: 'ui_render_liquidui_map',
          description: 'Render a map view.',
          parameters: [
            { name: 'points', type: 'array', required: true },
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
    const resolved = TEMPLATE_ALIASES[templateId] || templateId;
    return this.templates.get(resolved) || null;
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
    const { userIntent, contentMix, realm, taskState } = context;
    const normalized = (userIntent || '').toLowerCase();

    // Priority order: user intent, then context hints, then fallback.
    // Only return active templates (the initial 9 drawer grid variants).
    if (['search', 'filter', 'query'].includes(normalized)) {
      return 'liquidui:drawer_grid_1b';
    }

    if (['feed', 'discover', 'stream'].includes(normalized)) {
      return 'liquidui:drawer_grid_1a';
    }

    if (['browse', 'catalog', 'gallery'].includes(normalized)) {
      return 'liquidui:drawer_grid_v1';
    }

    if (['compare', 'decide', 'evaluate'].includes(normalized)) {
      return 'liquidui:drawer_grid_1c';
    }

    if (['dashboard', 'monitor', 'kpi'].includes(normalized)) {
      return 'liquidui:drawer_grid_2a';
    }

    if (['workspace', 'manage', 'organize', 'create', 'edit', 'compose'].includes(normalized)) {
      return 'liquidui:drawer_grid_2b';
    }

    if (['detail', 'profile', 'entity', 'read', 'consume', 'watch'].includes(normalized)) {
      return 'liquidui:drawer_grid_2c';
    }

    if (['inbox', 'threads', 'messages', 'chat', 'conversation', 'assist'].includes(normalized)) {
      return 'liquidui:drawer_grid_3a';
    }

    if (['community', 'forum', 'topics'].includes(normalized)) {
      return 'liquidui:drawer_grid_3b';
    }

    // Default fallback: drawer grid 2A per request.
    return 'liquidui:drawer_grid_2a';
  }

  /**
   * Generate CopilotKit action specs for all templates
   */
  getCopilotActionSpecs(): any[] {
    return this.getAllTemplates()
      .filter(template => template.status !== 'placeholder')
      .map(template => ({
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
