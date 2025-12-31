/**
 * Liquid UI Copilot Actions
 * 
 * Actions for the Copilot to dynamically compose and render Liquid UI.
 * Integrates with CodexService for issue management and layout composition.
 */

import { getCodexService } from '@/services/content/codexService';
import type {
  IssuePackage,
  LiquidUIContentObject,
  LayoutContext,
  CompositionDecision,
  DeviceBreakpoint,
  ContextMode,
} from '@/types/liquidUI';

// =============================================================================
// LOAD ISSUE PACKAGE
// =============================================================================

export const liquidUILoadIssueAction = {
  name: 'liquid_ui_load_issue',
  description: `Load a Liquid UI Issue Package from JSON. This enables the Copilot to:
- Access all content objects in the issue
- Compose dynamic layouts based on sections and taxonomy
- Generate text reader configurations
- Archive and manage issue versions

Use when user uploads a JSON file or says: "load this issue", "import codex content", etc.`,
  parameters: [
    {
      name: 'jsonContent',
      type: 'string' as const,
      description: 'The JSON content of the issue package (stringified).',
      required: true,
    },
  ],
  handler: async ({ jsonContent }: { jsonContent: string }) => {
    try {
      const service = getCodexService();
      const issuePackage = await service.loadIssueFromJSON(jsonContent);

      return {
        success: true,
        issue: {
          id: issuePackage.issue.issue_id,
          title: issuePackage.issue.title,
          episode: issuePackage.issue.episode,
          status: issuePackage.issue.status,
        },
        stats: {
          contentCount: issuePackage.collections.content_items.length,
          sectionCount: issuePackage.collections.sections.length,
          placementCount: issuePackage.collections.placements.length,
          assetCount: issuePackage.collections.assets.length,
        },
        sections: issuePackage.collections.sections.map(s => ({
          id: s.section_id,
          type: s.type,
          tabs: s.tabs.map(t => t.tab_id),
        })),
        message: `Loaded issue "${issuePackage.issue.title}" with ${issuePackage.collections.content_items.length} content objects`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to load issue package',
      };
    }
  },
};

// =============================================================================
// COMPOSE SCREEN
// =============================================================================

export const liquidUIComposeScreenAction = {
  name: 'liquid_ui_compose_screen',
  description: `Compose a dynamic screen layout from content objects. The Copilot uses this to:
- Select appropriate content based on user intent
- Apply geometry variants for the current device/context
- Respect composition rules (pairing, sequence, attention budget)
- Generate CSS-ready layout decisions

Use when user says: "show me the hero content", "compose a reading view", "layout the news section", etc.`,
  parameters: [
    {
      name: 'issueId',
      type: 'string' as const,
      description: 'The issue ID to compose from.',
      required: true,
    },
    {
      name: 'prompt',
      type: 'string' as const,
      description: 'Natural language prompt describing what to show (e.g., "hero content", "KNYT terra news", "developer docs").',
      required: true,
    },
    {
      name: 'device',
      type: 'string' as const,
      description: 'Target device: "mobile", "tablet", or "desktop". Default: "desktop".',
      required: false,
    },
    {
      name: 'mode',
      type: 'string' as const,
      description: 'Context mode: "browse", "read", "watch", "play", "work", "lean_back", "social". Default: "browse".',
      required: false,
    },
  ],
  handler: async ({
    issueId,
    prompt,
    device = 'desktop',
    mode = 'browse',
  }: {
    issueId: string;
    prompt: string;
    device?: string;
    mode?: string;
  }) => {
    try {
      const service = getCodexService();
      
      const context: LayoutContext = {
        device: device as DeviceBreakpoint,
        mode: mode as ContextMode,
        user_intent: prompt,
        viewport: {
          width: device === 'mobile' ? 390 : device === 'tablet' ? 768 : 1920,
          height: device === 'mobile' ? 844 : device === 'tablet' ? 1024 : 1080,
        },
      };

      const composition = await service.generateLiquidUIRoute(prompt, issueId, context);

      return {
        success: true,
        composition: {
          objectCount: composition.objects.length,
          totalAttentionSeconds: composition.totalAttentionSeconds,
          notes: composition.notes,
        },
        objects: composition.objects.map((obj, idx) => ({
          id: obj.content_id,
          title: obj.title,
          type: obj.content_type,
          layout: {
            variant: composition.layouts[idx].variant.name,
            slotType: composition.layouts[idx].slotType,
            useModal: composition.layouts[idx].useModal,
            styles: composition.layouts[idx].styles,
          },
          attentionSeconds: obj.composition.attention_budget.estimated_seconds,
        })),
        message: `Composed ${composition.objects.length} objects for "${prompt}" (${composition.totalAttentionSeconds}s total attention)`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to compose screen',
      };
    }
  },
};

// =============================================================================
// GET CONTENT BY SECTION
// =============================================================================

export const liquidUIGetSectionContentAction = {
  name: 'liquid_ui_get_section_content',
  description: `Get content objects for a specific section and optional tab. Returns content with full render contracts.

Use when user says: "show hero section", "get news items", "list scrolls metaknyts tab", etc.`,
  parameters: [
    {
      name: 'issueId',
      type: 'string' as const,
      description: 'The issue ID.',
      required: true,
    },
    {
      name: 'sectionId',
      type: 'string' as const,
      description: 'Section ID: "home-hero", "latest-news", "second-hero", "scrolls", "pennydrops", "21knowdz".',
      required: true,
    },
    {
      name: 'tabId',
      type: 'string' as const,
      description: 'Optional tab ID for drawer_tabs sections (e.g., "metaknyts", "aigents", "developer").',
      required: false,
    },
  ],
  handler: async ({
    issueId,
    sectionId,
    tabId,
  }: {
    issueId: string;
    sectionId: string;
    tabId?: string;
  }) => {
    try {
      const service = getCodexService();
      const contents = service.getContentBySection(issueId, sectionId, tabId);

      return {
        success: true,
        section: sectionId,
        tab: tabId || null,
        count: contents.length,
        items: contents.map(c => ({
          id: c.content_id,
          slug: c.slug,
          title: c.title,
          type: c.content_type,
          codex: c.taxonomy.codex,
          realm: c.taxonomy.realm,
          modalities: {
            read: c.modalities.read.available,
            watch: c.modalities.watch.available,
            listen: c.modalities.listen.available,
          },
          attentionSeconds: c.composition.attention_budget.estimated_seconds,
          hasTextReader: c.render.text_reader?.enabled || false,
        })),
        message: `Found ${contents.length} items in ${sectionId}${tabId ? `.${tabId}` : ''}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get section content',
      };
    }
  },
};

// =============================================================================
// GET TEXT READER CONFIG
// =============================================================================

export const liquidUIGetTextReaderAction = {
  name: 'liquid_ui_get_text_reader',
  description: `Get text reader configuration for a content object. Returns typography, controls, geometry, and content blocks.

Use when user says: "open reader for this article", "show text view", "read this content", etc.`,
  parameters: [
    {
      name: 'issueId',
      type: 'string' as const,
      description: 'The issue ID.',
      required: true,
    },
    {
      name: 'contentId',
      type: 'string' as const,
      description: 'The content ID to get reader config for.',
      required: true,
    },
    {
      name: 'device',
      type: 'string' as const,
      description: 'Target device: "mobile", "tablet", or "desktop". Default: "desktop".',
      required: false,
    },
  ],
  handler: async ({
    issueId,
    contentId,
    device = 'desktop',
  }: {
    issueId: string;
    contentId: string;
    device?: string;
  }) => {
    try {
      const service = getCodexService();
      const issue = service.getIssue(issueId);
      
      if (!issue) {
        return { success: false, error: `Issue not found: ${issueId}` };
      }

      const content = issue.collections.content_items.find(c => c.content_id === contentId);
      if (!content) {
        return { success: false, error: `Content not found: ${contentId}` };
      }

      const context: LayoutContext = {
        device: device as DeviceBreakpoint,
        mode: 'read',
        viewport: {
          width: device === 'mobile' ? 390 : device === 'tablet' ? 768 : 1920,
          height: device === 'mobile' ? 844 : device === 'tablet' ? 1024 : 1080,
        },
      };

      const readerConfig = service.getTextReaderConfig(content, context);

      if (!readerConfig) {
        return {
          success: false,
          error: 'Text reader not enabled for this content',
        };
      }

      return {
        success: true,
        content: {
          id: content.content_id,
          title: content.title,
          wordCount: content.modalities.read.word_count_approx,
          duration: content.modalities.read.duration,
        },
        reader: {
          mode: readerConfig.mode,
          typography: readerConfig.typography,
          scrollBehavior: readerConfig.scrollBehavior,
          controls: readerConfig.controls,
          displayOverrides: readerConfig.displayOverrides,
          geometry: readerConfig.geometry ? {
            name: readerConfig.geometry.name,
            spatial: readerConfig.geometry.spatial,
          } : null,
        },
        contentBlocks: readerConfig.contentBlocks,
        message: `Text reader ready for "${content.title}"`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get text reader config',
      };
    }
  },
};

// =============================================================================
// CREATE CONTENT FROM TEMPLATE
// =============================================================================

export const liquidUICreateContentAction = {
  name: 'liquid_ui_create_content',
  description: `Create a new content object from a template. Templates include:
- hero_feature: Hero articles with 21:9 aspect ratio
- latest_news_item: News cards for carousels
- scroll_item: Drawer items for scrolls section
- pennydrop_story: Short fiction pieces
- kn0wdz_doc: Reference documentation

Use when user says: "create a new hero article", "add a pennydrop story", "make a kn0wdz doc", etc.`,
  parameters: [
    {
      name: 'templateType',
      type: 'string' as const,
      description: 'Template type: "hero_feature", "latest_news_item", "scroll_item", "pennydrop_story", "kn0wdz_doc".',
      required: true,
    },
    {
      name: 'title',
      type: 'string' as const,
      description: 'Content title.',
      required: true,
    },
    {
      name: 'excerpt',
      type: 'string' as const,
      description: 'Content excerpt/summary.',
      required: false,
    },
    {
      name: 'codex',
      type: 'string' as const,
      description: 'Codex: "qriptopian" or "knyt". Default based on template.',
      required: false,
    },
    {
      name: 'realm',
      type: 'string' as const,
      description: 'Realm: "terra", "metaterra_or", "digiterra", "macro". Default based on template.',
      required: false,
    },
  ],
  handler: async ({
    templateType,
    title,
    excerpt,
    codex,
    realm,
  }: {
    templateType: string;
    title: string;
    excerpt?: string;
    codex?: string;
    realm?: string;
  }) => {
    try {
      const service = getCodexService();
      
      const overrides: Partial<LiquidUIContentObject> = {
        title,
        excerpt: excerpt || '',
      };

      if (codex || realm) {
        overrides.taxonomy = {
          codex: (codex as any) || 'qriptopian',
          realm: (realm as any) || 'terra',
          series: null,
          dimension: null,
          granularity: { unit: 'article', equivalents: {} },
        };
      }

      const content = service.createContentFromTemplate(templateType, overrides);

      return {
        success: true,
        content: {
          id: content.content_id,
          slug: content.slug,
          title: content.title,
          type: content.content_type,
          codex: content.taxonomy.codex,
          realm: content.taxonomy.realm,
        },
        render: {
          preferredSlots: content.render.preferred_slots.map(s => s.slot_type),
          hasTextReader: content.render.text_reader?.enabled || false,
        },
        message: `Created "${title}" from ${templateType} template`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create content',
      };
    }
  },
};

// =============================================================================
// LIST ISSUES
// =============================================================================

export const liquidUIListIssuesAction = {
  name: 'liquid_ui_list_issues',
  description: `List all loaded issue packages. Shows issue metadata and content counts.

Use when user says: "what issues are loaded", "list codex issues", "show available episodes", etc.`,
  parameters: [],
  handler: async () => {
    try {
      const service = getCodexService();
      const issues = service.listIssues();

      return {
        success: true,
        count: issues.length,
        issues: issues.map(i => ({
          id: i.issue_id,
          episode: i.episode,
          title: i.title,
          status: i.status,
          generatedAt: i.generated_at,
        })),
        message: `${issues.length} issue(s) loaded`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to list issues',
      };
    }
  },
};

// =============================================================================
// GET EXAMPLES
// =============================================================================

export const liquidUIGetExamplesAction = {
  name: 'liquid_ui_get_examples',
  description: `Get the 5 example content objects (Hero, News, Scroll, PennyDrop, Kn0wdZ) with full Liquid UI contracts.

Use when user says: "show example objects", "get template examples", "demo liquid ui", etc.`,
  parameters: [],
  handler: async () => {
    try {
      const service = getCodexService();
      const examples = service.getExampleObjects();

      return {
        success: true,
        count: examples.length,
        examples: examples.map(e => ({
          id: e.content_id,
          slug: e.slug,
          title: e.title,
          type: e.content_type,
          codex: e.taxonomy.codex,
          realm: e.taxonomy.realm,
          modalities: {
            read: e.modalities.read.available,
            watch: e.modalities.watch.available,
            listen: e.modalities.listen.available,
          },
          geometryVariants: e.render.geometry_variants.map(v => v.name),
          hasTextReader: e.render.text_reader?.enabled || false,
          attentionSeconds: e.composition.attention_budget.estimated_seconds,
        })),
        message: `${examples.length} example objects available`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get examples',
      };
    }
  },
};

// =============================================================================
// EXPORT ALL ACTIONS
// =============================================================================

export const liquidUIActions = [
  liquidUILoadIssueAction,
  liquidUIComposeScreenAction,
  liquidUIGetSectionContentAction,
  liquidUIGetTextReaderAction,
  liquidUICreateContentAction,
  liquidUIListIssuesAction,
  liquidUIGetExamplesAction,
];
