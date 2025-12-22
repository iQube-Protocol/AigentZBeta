/**
 * Codex Service
 * 
 * Manages Liquid UI Issue Packages for Qriptopian and KNYT Codexes.
 * Enables:
 * 1. Archiving issues (Episode 0, Episode 1, etc.) as reusable templates
 * 2. Generating new issues from templates or JSON uploads
 * 3. Dynamic composition via Copilot integration
 * 
 * Integrates with SmartTriad system for content, wallet, and menu coordination.
 */

import type {
  IssuePackage,
  LiquidUIContentObject,
  LiquidUIProfile,
  Section,
  Placement,
  Asset,
  Collections,
  IssueMeta,
  RenderContract,
  CompositionRules,
  LayoutContext,
  LayoutDecision,
  CompositionDecision,
  GeometryVariant,
  DeviceBreakpoint,
  ContextMode,
  createDefaultRenderContract,
  createDefaultCompositionRules,
} from '@/types/liquidUI';

// Template data will be loaded dynamically to avoid import path issues
// Templates are stored in: apps/theqriptopian-web/src/data/templates/

// =============================================================================
// CODEX SERVICE CLASS
// =============================================================================

export class CodexService {
  private static instance: CodexService;
  private issueCache: Map<string, IssuePackage> = new Map();
  private templateCache: Map<string, any> = new Map();

  private constructor() {
    // Templates are loaded on-demand via loadTemplatesFromPath() or loadIssueFromJSON()
    // Default templates can be pre-loaded by calling initializeDefaultTemplates()
  }

  /**
   * Initialize with default templates (call after service instantiation if needed)
   */
  async initializeDefaultTemplates(templateData?: { issueTemplate?: any; examplesPackage?: any }): Promise<void> {
    if (templateData?.issueTemplate) {
      this.templateCache.set('issue_template_v1.4', templateData.issueTemplate);
    }
    if (templateData?.examplesPackage) {
      this.templateCache.set('examples_v1.4', templateData.examplesPackage);
      // Also cache as an issue for easy access
      const examples = templateData.examplesPackage as IssuePackage;
      if (examples.issue?.issue_id) {
        this.issueCache.set(examples.issue.issue_id, examples);
      }
    }
  }

  static getInstance(): CodexService {
    if (!CodexService.instance) {
      CodexService.instance = new CodexService();
    }
    return CodexService.instance;
  }

  // ===========================================================================
  // ISSUE MANAGEMENT
  // ===========================================================================

  /**
   * Load an issue package from JSON
   */
  async loadIssueFromJSON(json: string | object): Promise<IssuePackage> {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const issuePackage = this.validateIssuePackage(data);
    this.issueCache.set(issuePackage.issue.issue_id, issuePackage);
    return issuePackage;
  }

  /**
   * Get a cached issue by ID
   */
  getIssue(issueId: string): IssuePackage | undefined {
    return this.issueCache.get(issueId);
  }

  /**
   * List all cached issues
   */
  listIssues(): IssueMeta[] {
    return Array.from(this.issueCache.values()).map(pkg => pkg.issue);
  }

  /**
   * Archive an issue (save to storage)
   */
  async archiveIssue(issuePackage: IssuePackage): Promise<{ success: boolean; archiveId: string }> {
    const archiveId = `archive:${issuePackage.issue.issue_id}:${Date.now()}`;
    
    // In production, this would save to Supabase/storage
    // For now, cache it
    this.issueCache.set(issuePackage.issue.issue_id, issuePackage);
    
    return { success: true, archiveId };
  }

  /**
   * Create a new issue from template
   */
  createIssueFromTemplate(
    templateId: string,
    overrides: Partial<IssueMeta>
  ): IssuePackage {
    const template = this.templateCache.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const now = new Date().toISOString().split('T')[0];
    const issueId = overrides.issue_id || `issue:${Date.now()}`;

    const newIssue: IssuePackage = {
      ...template,
      issue: {
        ...template.issue,
        issue_id: issueId,
        generated_at: now,
        status: 'draft',
        ...overrides,
      },
      collections: {
        ...template.collections,
        content_items: [],
        placements: [],
        assets: [],
        indexes: {
          by_section_tab: {},
          by_taxonomy: {},
          by_slug: {},
          by_content_id: {},
        },
      },
    };

    this.issueCache.set(issueId, newIssue);
    return newIssue;
  }

  // ===========================================================================
  // CONTENT OBJECT MANAGEMENT
  // ===========================================================================

  /**
   * Add a content object to an issue
   */
  addContentToIssue(
    issueId: string,
    content: LiquidUIContentObject,
    placement: Omit<Placement, 'placement_id' | 'issue_id' | 'content_id'>
  ): { content: LiquidUIContentObject; placement: Placement } {
    const issue = this.issueCache.get(issueId);
    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`);
    }

    // Add content
    issue.collections.content_items.push(content);

    // Create placement
    const placementObj: Placement = {
      placement_id: `place:${this.generateId()}`,
      issue_id: issueId,
      content_id: content.content_id,
      ...placement,
    };
    issue.collections.placements.push(placementObj);

    // Update indexes
    this.updateIndexes(issue);

    return { content, placement: placementObj };
  }

  /**
   * Get content objects by section
   */
  getContentBySection(issueId: string, sectionId: string, tabId?: string): LiquidUIContentObject[] {
    const issue = this.issueCache.get(issueId);
    if (!issue) return [];

    const key = tabId ? `${sectionId}.${tabId}` : sectionId;
    const contentIds = issue.collections.indexes.by_section_tab[key] || [];
    
    return contentIds
      .map(id => issue.collections.content_items.find(c => c.content_id === id))
      .filter((c): c is LiquidUIContentObject => c !== undefined);
  }

  /**
   * Get content by taxonomy
   */
  getContentByTaxonomy(
    issueId: string,
    codex: string,
    options?: { realm?: string; series?: string }
  ): LiquidUIContentObject[] {
    const issue = this.issueCache.get(issueId);
    if (!issue) return [];

    return issue.collections.content_items.filter(c => {
      if (c.taxonomy.codex !== codex) return false;
      if (options?.realm && c.taxonomy.realm !== options.realm) return false;
      if (options?.series && c.taxonomy.series !== options.series) return false;
      return true;
    });
  }

  // ===========================================================================
  // LAYOUT ENGINE
  // ===========================================================================

  /**
   * Select the best geometry variant for a content object given context
   */
  selectGeometryVariant(
    content: LiquidUIContentObject,
    context: LayoutContext
  ): GeometryVariant | null {
    const variants = content.render.geometry_variants;
    
    // Find matching variant
    for (const variant of variants) {
      const deviceMatch = variant.when.device.includes(context.device);
      const contextMatch = variant.when.context.includes(context.mode);
      
      if (deviceMatch && contextMatch) {
        return variant;
      }
    }

    // Fallback: find any variant matching device
    for (const variant of variants) {
      if (variant.when.device.includes(context.device)) {
        return variant;
      }
    }

    return variants[0] || null;
  }

  /**
   * Compute layout decision for a content object
   */
  computeLayout(
    content: LiquidUIContentObject,
    context: LayoutContext
  ): LayoutDecision {
    const variant = this.selectGeometryVariant(content, context);
    const spatial = variant?.spatial || content.render.spatial;

    // Compute CSS styles from normalized coordinates
    const styles = {
      position: 'absolute' as const,
      top: `${spatial.y * 100}%`,
      left: `${spatial.x * 100}%`,
      width: `${spatial.w * 100}%`,
      height: spatial.h > 1 ? 'auto' : `${spatial.h * 100}%`,
      zIndex: spatial.z,
    };

    // Determine slot type
    const breakpointConfig = content.render.breakpoints[context.device];
    const slotType = breakpointConfig.preferred_slot_types[0] || 'grid_card';

    // Determine if modal should be used
    const useModal = context.mode === 'read' || context.mode === 'watch';

    return {
      variant: variant || {
        name: 'default',
        when: { device: [context.device], context: [context.mode] },
        spatial,
      },
      styles,
      slotType,
      useModal,
      modalConfig: useModal ? content.render.modal_preferences : undefined,
    };
  }

  /**
   * Compose multiple content objects for a screen
   */
  composeScreen(
    contents: LiquidUIContentObject[],
    context: LayoutContext,
    profile: LiquidUIProfile
  ): CompositionDecision {
    const layouts: LayoutDecision[] = [];
    const notes: string[] = [];
    let totalAttention = 0;

    // Sort by composition rules
    const sorted = [...contents].sort((a, b) => {
      // Intros first
      if (a.composition.sequence_rules.good_as_intro && !b.composition.sequence_rules.good_as_intro) {
        return -1;
      }
      if (!a.composition.sequence_rules.good_as_intro && b.composition.sequence_rules.good_as_intro) {
        return 1;
      }
      // Then by attention budget (higher intensity first for browse mode)
      if (context.mode === 'browse') {
        const intensityOrder = { high: 0, medium: 1, low: 2 };
        return intensityOrder[a.composition.attention_budget.intensity] - 
               intensityOrder[b.composition.attention_budget.intensity];
      }
      return 0;
    });

    // Compute layouts
    for (const content of sorted) {
      const layout = this.computeLayout(content, context);
      layouts.push(layout);
      totalAttention += content.composition.attention_budget.estimated_seconds;

      // Check pairing rules
      const prevContent = sorted[sorted.indexOf(content) - 1];
      if (prevContent) {
        const avoids = content.composition.pairing_rules.avoids_with;
        if (avoids.some(rule => this.matchesPairingRule(prevContent, rule))) {
          notes.push(`Warning: ${content.title} may not pair well with ${prevContent.title}`);
        }
      }
    }

    return {
      objects: sorted,
      layouts,
      totalAttentionSeconds: totalAttention,
      notes,
    };
  }

  // ===========================================================================
  // TEXT READER
  // ===========================================================================

  /**
   * Get text reader configuration for a content object
   */
  getTextReaderConfig(content: LiquidUIContentObject, context: LayoutContext) {
    if (!content.render.text_reader?.enabled) {
      return null;
    }

    const reader = content.render.text_reader;
    const variant = reader.geometry_variants.find(v => 
      v.when.device.includes(context.device) && v.when.context.includes(context.mode)
    ) || reader.geometry_variants[0];

    return {
      mode: reader.default_mode,
      typography: reader.typography_preset,
      scrollBehavior: reader.scroll_behavior,
      controls: reader.controls,
      displayOverrides: reader.content_display_overrides,
      geometry: variant,
      contentBlocks: content.content_blocks || [],
    };
  }

  // ===========================================================================
  // TEMPLATE MANAGEMENT
  // ===========================================================================

  /**
   * Get a content template by type
   */
  getContentTemplate(templateType: string): Partial<LiquidUIContentObject> | null {
    const template = this.templateCache.get('issue_template_v1.4');
    if (!template?.templates) return null;

    const templateData = template.templates[templateType];
    if (!templateData) return null;

    // Handle $extends
    if (templateData.$extends) {
      const base = template.templates[templateData.$extends];
      return this.mergeTemplates(base, templateData);
    }

    return templateData;
  }

  /**
   * Create a content object from template
   */
  createContentFromTemplate(
    templateType: string,
    overrides: Partial<LiquidUIContentObject>
  ): LiquidUIContentObject {
    const template = this.getContentTemplate(templateType);
    if (!template) {
      throw new Error(`Template not found: ${templateType}`);
    }

    const contentId = overrides.content_id || `content:${this.generateId()}`;
    const slug = overrides.slug || this.slugify(overrides.title || 'untitled');

    return {
      ...template,
      ...overrides,
      content_id: contentId,
      slug,
      status: 'draft',
    } as LiquidUIContentObject;
  }

  /**
   * Get the 5 example objects
   */
  getExampleObjects(): LiquidUIContentObject[] {
    const examples = this.templateCache.get('examples_v1.4');
    return examples?.collections?.content_items || [];
  }

  // ===========================================================================
  // COPILOT INTEGRATION
  // ===========================================================================

  /**
   * Generate a Liquid UI route from prompt
   * Used by Copilot to dynamically compose UI
   */
  async generateLiquidUIRoute(
    prompt: string,
    issueId: string,
    context: LayoutContext
  ): Promise<CompositionDecision> {
    const issue = this.issueCache.get(issueId);
    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`);
    }

    // Parse prompt for intent
    const intent = this.parsePromptIntent(prompt);

    // Select content based on intent
    let contents: LiquidUIContentObject[] = [];

    if (intent.section) {
      contents = this.getContentBySection(issueId, intent.section, intent.tab);
    } else if (intent.codex) {
      contents = this.getContentByTaxonomy(issueId, intent.codex, {
        realm: intent.realm,
        series: intent.series,
      });
    } else if (intent.contentType) {
      contents = issue.collections.content_items.filter(
        c => c.content_type === intent.contentType
      );
    } else {
      // Default: get featured/intro content
      contents = issue.collections.content_items.filter(
        c => c.composition.sequence_rules.good_as_intro
      );
    }

    // Limit by attention budget if specified
    if (intent.maxAttentionSeconds) {
      contents = this.filterByAttentionBudget(contents, intent.maxAttentionSeconds);
    }

    // Compose the screen
    return this.composeScreen(contents, context, issue.liquid_ui_profile);
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private validateIssuePackage(data: any): IssuePackage {
    // Basic validation
    if (!data.schema_version) {
      throw new Error('Missing schema_version');
    }
    if (!data.publication) {
      throw new Error('Missing publication');
    }
    if (!data.issue) {
      throw new Error('Missing issue');
    }
    if (!data.collections) {
      throw new Error('Missing collections');
    }
    return data as IssuePackage;
  }

  private updateIndexes(issue: IssuePackage): void {
    const indexes = issue.collections.indexes;
    
    // Reset indexes
    indexes.by_section_tab = {};
    indexes.by_slug = {};
    indexes.by_content_id = {};
    indexes.by_taxonomy = {};

    // Build indexes from placements
    for (const placement of issue.collections.placements) {
      const key = placement.tab_id 
        ? `${placement.section_id}.${placement.tab_id}`
        : placement.section_id;
      
      if (!indexes.by_section_tab[key]) {
        indexes.by_section_tab[key] = [];
      }
      indexes.by_section_tab[key].push(placement.content_id);
    }

    // Build content indexes
    for (const content of issue.collections.content_items) {
      indexes.by_slug[content.slug] = content.content_id;
      indexes.by_content_id[content.content_id] = {
        title: content.title,
        content_type: content.content_type,
        codex: content.taxonomy.codex,
        realm: content.taxonomy.realm,
      };

      // Taxonomy index
      const codex = content.taxonomy.codex;
      if (!indexes.by_taxonomy[codex]) {
        indexes.by_taxonomy[codex] = { all: [], series: {} };
      }
      indexes.by_taxonomy[codex].all.push(content.content_id);
      
      if (content.taxonomy.series) {
        if (!indexes.by_taxonomy[codex].series[content.taxonomy.series]) {
          indexes.by_taxonomy[codex].series[content.taxonomy.series] = [];
        }
        indexes.by_taxonomy[codex].series[content.taxonomy.series].push(content.content_id);
      }
    }
  }

  private mergeTemplates(base: any, extension: any): any {
    const result = { ...base };
    
    for (const key of Object.keys(extension)) {
      if (key === '$extends') continue;
      
      if (typeof extension[key] === 'object' && !Array.isArray(extension[key])) {
        result[key] = this.mergeTemplates(base[key] || {}, extension[key]);
      } else {
        result[key] = extension[key];
      }
    }
    
    return result;
  }

  private matchesPairingRule(content: LiquidUIContentObject, rule: string): boolean {
    // Parse rules like "content_type:news_card" or "taxonomy.codex:knyt"
    const [path, value] = rule.split(':');
    const parts = path.split('.');
    
    let current: any = content;
    for (const part of parts) {
      current = current?.[part];
    }
    
    return current === value;
  }

  private parsePromptIntent(prompt: string): {
    section?: string;
    tab?: string;
    codex?: string;
    realm?: string;
    series?: string;
    contentType?: string;
    maxAttentionSeconds?: number;
  } {
    const intent: any = {};
    const lower = prompt.toLowerCase();

    // Section detection
    if (lower.includes('hero')) intent.section = 'home-hero';
    if (lower.includes('news')) intent.section = 'latest-news';
    if (lower.includes('scroll')) intent.section = 'scrolls';
    if (lower.includes('pennydrop')) intent.section = 'pennydrops';
    if (lower.includes('knowdz') || lower.includes('kn0wdz')) intent.section = '21knowdz';

    // Tab detection
    if (lower.includes('metaknyts')) intent.tab = 'metaknyts';
    if (lower.includes('aigent')) intent.tab = 'aigents';
    if (lower.includes('meme')) intent.tab = 'memes';
    if (lower.includes('developer')) intent.tab = 'developer';
    if (lower.includes('executive')) intent.tab = 'executive';

    // Codex detection
    if (lower.includes('knyt')) intent.codex = 'knyt';
    if (lower.includes('qriptopian')) intent.codex = 'qriptopian';

    // Realm detection
    if (lower.includes('terra')) intent.realm = 'terra';
    if (lower.includes('digiterra')) intent.realm = 'digiterra';
    if (lower.includes('metaterra')) intent.realm = 'metaterra_or';

    // Content type detection
    if (lower.includes('article')) intent.contentType = 'long_form_article';
    if (lower.includes('fiction') || lower.includes('story')) intent.contentType = 'short_fiction';
    if (lower.includes('reference') || lower.includes('doc')) intent.contentType = 'reference_doc';

    // Attention budget
    const timeMatch = lower.match(/(\d+)\s*(min|minute|sec|second)/);
    if (timeMatch) {
      const value = parseInt(timeMatch[1]);
      intent.maxAttentionSeconds = timeMatch[2].startsWith('min') ? value * 60 : value;
    }

    return intent;
  }

  private filterByAttentionBudget(
    contents: LiquidUIContentObject[],
    maxSeconds: number
  ): LiquidUIContentObject[] {
    const result: LiquidUIContentObject[] = [];
    let total = 0;

    for (const content of contents) {
      if (total + content.composition.attention_budget.estimated_seconds <= maxSeconds) {
        result.push(content);
        total += content.composition.attention_budget.estimated_seconds;
      }
    }

    return result;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let codexServiceInstance: CodexService | null = null;

export function getCodexService(): CodexService {
  if (!codexServiceInstance) {
    codexServiceInstance = CodexService.getInstance();
  }
  return codexServiceInstance;
}

// =============================================================================
// COPILOT ACTION EXPORTS
// =============================================================================

/**
 * Copilot action: Load issue from JSON
 */
export async function loadIssueAction(json: string | object) {
  const service = getCodexService();
  return service.loadIssueFromJSON(json);
}

/**
 * Copilot action: Generate Liquid UI route
 */
export async function generateRouteAction(
  prompt: string,
  issueId: string,
  device: DeviceBreakpoint = 'desktop',
  mode: ContextMode = 'browse'
) {
  const service = getCodexService();
  const context: LayoutContext = {
    device,
    mode,
    viewport: { width: 1920, height: 1080 }, // Default desktop
  };
  return service.generateLiquidUIRoute(prompt, issueId, context);
}

/**
 * Copilot action: Create content from template
 */
export function createContentAction(
  templateType: string,
  overrides: Partial<LiquidUIContentObject>
) {
  const service = getCodexService();
  return service.createContentFromTemplate(templateType, overrides);
}

/**
 * Copilot action: Get example objects
 */
export function getExamplesAction() {
  const service = getCodexService();
  return service.getExampleObjects();
}
