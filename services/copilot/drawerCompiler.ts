/**
 * DrawerCompiler
 * 
 * Compiles natural language prompts into DrawerSet configurations.
 * Used by Copilot to dynamically generate and modify drawer layouts.
 */

import type {
  DrawerSet,
  Drawer,
  DrawerTab,
  DrawerSlot,
  SlotDataSource,
  Device,
  Modality,
} from '@/types/smartDrawer';
import type { ContentModality } from '@/types/smartContent';
import type { ModalUseCase, CardVariantId } from '@/types/cardVariant';
import { cardVariantRegistry, findBestVariant } from '@/services/drawer/cardVariantRegistry';
import { createDrawerSet, createDrawer, createDrawerTab, createDrawerSlot } from '@/types/smartDrawer';

// =============================================================================
// TYPES
// =============================================================================

/** Compilation request */
export interface CompileRequest {
  /** Natural language prompt */
  prompt: string;
  
  /** App context */
  appId: string;
  tenantId: string;
  personaId: string;
  
  /** Device context */
  device: Device;
  
  /** Existing drawer set to modify (optional) */
  existingDrawerSet?: DrawerSet;
  
  /** Modality focus (optional) */
  modalityFocus?: Modality;
  
  /** Max slots per tab */
  maxSlotsPerTab?: number;
}

/** Compilation result */
export interface CompileResult {
  /** Generated or modified drawer set */
  drawerSet: DrawerSet;
  
  /** What was changed */
  changes: DrawerChange[];
  
  /** Reasoning trace */
  reasoning: string[];
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Warnings */
  warnings: string[];
}

/** Individual change */
export interface DrawerChange {
  type: 'add_drawer' | 'remove_drawer' | 'add_tab' | 'remove_tab' | 'add_slot' | 'remove_slot' | 'update_slot' | 'reorder';
  target: string;
  description: string;
}

/** Intent extracted from prompt */
interface ExtractedIntent {
  action: 'create' | 'modify' | 'add' | 'remove' | 'show' | 'hide' | 'focus';
  targets: string[];
  modality?: Modality;
  useCase?: ModalUseCase;
  dataSource?: string;
  constraints?: Record<string, any>;
}

// =============================================================================
// INTENT PATTERNS
// =============================================================================

const INTENT_PATTERNS: Array<{
  pattern: RegExp;
  action: ExtractedIntent['action'];
  targetExtractor: (match: RegExpMatchArray) => string[];
}> = [
  // Create patterns
  { pattern: /create\s+(?:a\s+)?(?:new\s+)?(\w+)\s+(?:drawer|tab|slot)/i, action: 'create', targetExtractor: (m) => [m[1]] },
  { pattern: /add\s+(?:a\s+)?(?:new\s+)?(\w+)\s+(?:section|area|panel)/i, action: 'add', targetExtractor: (m) => [m[1]] },
  
  // Show patterns
  { pattern: /show\s+(?:me\s+)?(?:my\s+)?(\w+)/i, action: 'show', targetExtractor: (m) => [m[1]] },
  { pattern: /display\s+(?:the\s+)?(\w+)/i, action: 'show', targetExtractor: (m) => [m[1]] },
  { pattern: /i\s+want\s+to\s+see\s+(?:my\s+)?(\w+)/i, action: 'show', targetExtractor: (m) => [m[1]] },
  
  // Hide patterns
  { pattern: /hide\s+(?:the\s+)?(\w+)/i, action: 'hide', targetExtractor: (m) => [m[1]] },
  { pattern: /remove\s+(?:the\s+)?(\w+)\s+(?:section|area|panel)/i, action: 'remove', targetExtractor: (m) => [m[1]] },
  
  // Focus patterns
  { pattern: /focus\s+on\s+(\w+)/i, action: 'focus', targetExtractor: (m) => [m[1]] },
  { pattern: /prioritize\s+(\w+)/i, action: 'focus', targetExtractor: (m) => [m[1]] },
  
  // Modify patterns
  { pattern: /change\s+(?:the\s+)?(\w+)\s+to\s+(\w+)/i, action: 'modify', targetExtractor: (m) => [m[1], m[2]] },
  { pattern: /update\s+(?:the\s+)?(\w+)/i, action: 'modify', targetExtractor: (m) => [m[1]] },
];

const MODALITY_KEYWORDS: Record<string, Modality> = {
  watch: 'watch',
  video: 'watch',
  videos: 'watch',
  movie: 'watch',
  movies: 'watch',
  read: 'read',
  article: 'read',
  articles: 'read',
  text: 'read',
  listen: 'listen',
  audio: 'listen',
  podcast: 'listen',
  music: 'listen',
  interact: 'interact',
  chat: 'interact',
  talk: 'interact',
  play: 'interact',
  game: 'interact',
  games: 'interact',
};

const DATA_SOURCE_KEYWORDS: Record<string, SlotDataSource['type']> = {
  balance: 'walletBalances',
  balances: 'walletBalances',
  wallet: 'walletBalances',
  money: 'walletBalances',
  entitlement: 'walletEntitlements',
  entitlements: 'walletEntitlements',
  library: 'walletEntitlements',
  owned: 'walletEntitlements',
  task: 'walletTasks',
  tasks: 'walletTasks',
  todo: 'walletTasks',
  quest: 'walletQuests',
  quests: 'walletQuests',
  mission: 'walletQuests',
  content: 'currentContent',
  related: 'relatedContent',
  similar: 'relatedContent',
  curated: 'recommended',
  featured: 'recommended',
  recommended: 'recommended',
};

const USE_CASE_KEYWORDS: Record<string, ModalUseCase> = {
  hero: 'hero',
  featured: 'hero',
  highlight: 'hero',
  grid: 'grid',
  browse: 'grid',
  gallery: 'grid',
  thumbnail: 'thumbnails',
  thumbnails: 'thumbnails',
  small: 'thumbnails',
  task: 'tasks',
  tasks: 'tasks',
  wallet: 'wallet',
  balance: 'wallet',
  agent: 'agent',
  copilot: 'agent',
  chat: 'agent',
  codex: 'codex',
  explore: 'codex',
  lore: 'codex',
};

// =============================================================================
// DRAWER COMPILER CLASS
// =============================================================================

class DrawerCompiler {
  // ---------------------------------------------------------------------------
  // MAIN COMPILE METHOD
  // ---------------------------------------------------------------------------

  /**
   * Compile a natural language prompt into drawer configuration
   */
  async compile(request: CompileRequest): Promise<CompileResult> {
    const reasoning: string[] = [];
    const changes: DrawerChange[] = [];
    const warnings: string[] = [];

    reasoning.push(`Processing prompt: "${request.prompt}"`);

    // Step 1: Extract intent
    const intent = this.extractIntent(request.prompt);
    reasoning.push(`Extracted intent: ${intent.action} -> ${intent.targets.join(', ')}`);

    if (intent.modality) {
      reasoning.push(`Detected modality: ${intent.modality}`);
    }
    if (intent.useCase) {
      reasoning.push(`Detected use case: ${intent.useCase}`);
    }
    if (intent.dataSource) {
      reasoning.push(`Detected data source: ${intent.dataSource}`);
    }

    // Step 2: Generate or modify drawer set
    let drawerSet: DrawerSet;
    
    if (request.existingDrawerSet) {
      drawerSet = this.modifyDrawerSet(request.existingDrawerSet, intent, request, changes, reasoning);
    } else {
      drawerSet = this.generateDrawerSet(intent, request, changes, reasoning);
    }

    // Step 3: Validate and warn
    if (drawerSet.drawers.length === 0) {
      warnings.push('Generated drawer set has no drawers');
    }

    for (const drawer of drawerSet.drawers) {
      if (drawer.tabs.length === 0) {
        warnings.push(`Drawer "${drawer.label}" has no tabs`);
      }
      for (const tab of drawer.tabs) {
        if (tab.slots.length === 0) {
          warnings.push(`Tab "${tab.label}" in drawer "${drawer.label}" has no slots`);
        }
      }
    }

    // Calculate confidence
    const confidence = this.calculateConfidence(intent, changes, warnings);
    reasoning.push(`Confidence: ${(confidence * 100).toFixed(0)}%`);

    return {
      drawerSet,
      changes,
      reasoning,
      confidence,
      warnings,
    };
  }

  // ---------------------------------------------------------------------------
  // INTENT EXTRACTION
  // ---------------------------------------------------------------------------

  private extractIntent(prompt: string): ExtractedIntent {
    const lowerPrompt = prompt.toLowerCase();
    
    // Default intent
    let intent: ExtractedIntent = {
      action: 'show',
      targets: [],
    };

    // Match action patterns
    for (const { pattern, action, targetExtractor } of INTENT_PATTERNS) {
      const match = prompt.match(pattern);
      if (match) {
        intent.action = action;
        intent.targets = targetExtractor(match);
        break;
      }
    }

    // Extract modality
    for (const [keyword, modality] of Object.entries(MODALITY_KEYWORDS)) {
      if (lowerPrompt.includes(keyword)) {
        intent.modality = modality;
        if (!intent.targets.includes(keyword)) {
          intent.targets.push(keyword);
        }
        break;
      }
    }

    // Extract data source
    for (const [keyword, dataSource] of Object.entries(DATA_SOURCE_KEYWORDS)) {
      if (lowerPrompt.includes(keyword)) {
        intent.dataSource = dataSource;
        if (!intent.targets.includes(keyword)) {
          intent.targets.push(keyword);
        }
        break;
      }
    }

    // Extract use case
    for (const [keyword, useCase] of Object.entries(USE_CASE_KEYWORDS)) {
      if (lowerPrompt.includes(keyword)) {
        intent.useCase = useCase;
        break;
      }
    }

    // If no targets found, try to extract nouns
    if (intent.targets.length === 0) {
      const words = prompt.split(/\s+/);
      const nouns = words.filter((w) => 
        w.length > 3 && 
        !['show', 'hide', 'create', 'add', 'remove', 'the', 'and', 'for', 'with'].includes(w.toLowerCase())
      );
      intent.targets = nouns.slice(0, 3);
    }

    return intent;
  }

  // ---------------------------------------------------------------------------
  // DRAWER SET GENERATION
  // ---------------------------------------------------------------------------

  private generateDrawerSet(
    intent: ExtractedIntent,
    request: CompileRequest,
    changes: DrawerChange[],
    reasoning: string[]
  ): DrawerSet {
    reasoning.push('Generating new drawer set');

    const drawerSet = createDrawerSet({
      id: `generated-${Date.now()}`,
      appId: request.appId,
      tenantId: request.tenantId,
      personaId: request.personaId,
      dynamicMode: 'allow-dynamic',
      drawers: [],
    });

    // Create main drawer
    const mainDrawer = this.createDrawerFromIntent(intent, request, 'main');
    drawerSet.drawers.push(mainDrawer);

    changes.push({
      type: 'add_drawer',
      target: mainDrawer.id,
      description: `Created drawer "${mainDrawer.label}"`,
    });

    return drawerSet;
  }

  private createDrawerFromIntent(
    intent: ExtractedIntent,
    request: CompileRequest,
    drawerId: string
  ): Drawer {
    const label = this.inferDrawerLabel(intent);
    
    const drawer = createDrawer({
      id: drawerId,
      label,
      side: 'right',
      tabs: [],
    });

    // Create tab based on intent
    const tab = this.createTabFromIntent(intent, request, `${drawerId}-tab`);
    drawer.tabs.push(tab);

    return drawer;
  }

  private createTabFromIntent(
    intent: ExtractedIntent,
    request: CompileRequest,
    tabId: string
  ): DrawerTab {
    const label = this.inferTabLabel(intent);
    
    const tab = createDrawerTab({
      id: tabId,
      label,
      modalityFocus: intent.modality ? [intent.modality] : ['interact'],
      slots: [],
    });

    // Create slots based on data source
    const slots = this.createSlotsFromIntent(intent, request, tabId);
    tab.slots.push(...slots);

    // Add agent panel if intent suggests interaction
    if (intent.action === 'focus' || intent.useCase === 'agent') {
      tab.agentPanel = {
        mode: 'copilot',
        primaryAgentId: 'Copilot',
        openByDefault: true,
      };
    }

    return tab;
  }

  private createSlotsFromIntent(
    intent: ExtractedIntent,
    request: CompileRequest,
    tabId: string
  ): DrawerSlot[] {
    const slots: DrawerSlot[] = [];
    const maxSlots = request.maxSlotsPerTab ?? 4;

    // Determine data source type
    const dataSourceType = intent.dataSource ?? this.inferDataSource(intent);

    // Find best card variant
    const modality = intent.modality ?? request.modalityFocus?.[0] ?? 'interact';
    const variantResult = findBestVariant({
      modality: modality as ContentModality,
      device: request.device,
      useCase: intent.useCase,
    });

    const cardVariant = variantResult?.variant.id ?? 'standard';

    // Create primary slot
    const primarySlot = createDrawerSlot({
      id: `${tabId}-slot-primary`,
      cardVariant: cardVariant as CardVariantId,
      dataSource: {
        type: dataSourceType as any,
        limit: 10,
      },
      behaviour: {
        visibleOnDevices: [request.device],
      },
    });
    slots.push(primarySlot);

    // Add secondary slot if multiple targets
    if (intent.targets.length > 1 && slots.length < maxSlots) {
      const secondaryDataSource = this.inferSecondaryDataSource(intent);
      if (secondaryDataSource && secondaryDataSource !== dataSourceType) {
        const secondarySlot = createDrawerSlot({
          id: `${tabId}-slot-secondary`,
          cardVariant: 'compact',
          dataSource: {
            type: secondaryDataSource as any,
            limit: 5,
          },
        });
        slots.push(secondarySlot);
      }
    }

    return slots;
  }

  // ---------------------------------------------------------------------------
  // DRAWER SET MODIFICATION
  // ---------------------------------------------------------------------------

  private modifyDrawerSet(
    existing: DrawerSet,
    intent: ExtractedIntent,
    request: CompileRequest,
    changes: DrawerChange[],
    reasoning: string[]
  ): DrawerSet {
    reasoning.push('Modifying existing drawer set');

    const modified = structuredClone(existing);
    modified.updatedAt = new Date().toISOString();

    switch (intent.action) {
      case 'add':
      case 'create':
        this.handleAddAction(modified, intent, request, changes, reasoning);
        break;
      case 'remove':
      case 'hide':
        this.handleRemoveAction(modified, intent, changes, reasoning);
        break;
      case 'show':
        this.handleShowAction(modified, intent, request, changes, reasoning);
        break;
      case 'focus':
        this.handleFocusAction(modified, intent, changes, reasoning);
        break;
      case 'modify':
        this.handleModifyAction(modified, intent, request, changes, reasoning);
        break;
    }

    return modified;
  }

  private handleAddAction(
    drawerSet: DrawerSet,
    intent: ExtractedIntent,
    request: CompileRequest,
    changes: DrawerChange[],
    reasoning: string[]
  ): void {
    reasoning.push(`Adding new elements for: ${intent.targets.join(', ')}`);

    // Find or create target drawer
    let targetDrawer = drawerSet.drawers[0];
    if (!targetDrawer) {
      targetDrawer = this.createDrawerFromIntent(intent, request, 'main');
      drawerSet.drawers.push(targetDrawer);
      changes.push({
        type: 'add_drawer',
        target: targetDrawer.id,
        description: `Created drawer "${targetDrawer.label}"`,
      });
      return;
    }

    // Add new tab
    const newTab = this.createTabFromIntent(intent, request, `tab-${Date.now()}`);
    targetDrawer.tabs.push(newTab);
    changes.push({
      type: 'add_tab',
      target: newTab.id,
      description: `Added tab "${newTab.label}"`,
    });
  }

  private handleRemoveAction(
    drawerSet: DrawerSet,
    intent: ExtractedIntent,
    changes: DrawerChange[],
    reasoning: string[]
  ): void {
    reasoning.push(`Removing elements matching: ${intent.targets.join(', ')}`);

    for (const target of intent.targets) {
      const lowerTarget = target.toLowerCase();

      // Try to find and remove matching tab
      for (const drawer of drawerSet.drawers) {
        const tabIndex = drawer.tabs.findIndex((t) =>
          t.id.toLowerCase().includes(lowerTarget) ||
          t.label?.toLowerCase().includes(lowerTarget)
        );

        if (tabIndex !== -1) {
          const removed = drawer.tabs.splice(tabIndex, 1)[0];
          changes.push({
            type: 'remove_tab',
            target: removed.id,
            description: `Removed tab "${removed.label}"`,
          });
          return;
        }

        // Try to find and remove matching slot
        for (const tab of drawer.tabs) {
          const slotIndex = tab.slots.findIndex((s) =>
            s.id.toLowerCase().includes(lowerTarget)
          );

          if (slotIndex !== -1) {
            const removed = tab.slots.splice(slotIndex, 1)[0];
            changes.push({
              type: 'remove_slot',
              target: removed.id,
              description: `Removed slot "${removed.id}"`,
            });
            return;
          }
        }
      }
    }
  }

  private handleShowAction(
    drawerSet: DrawerSet,
    intent: ExtractedIntent,
    request: CompileRequest,
    changes: DrawerChange[],
    reasoning: string[]
  ): void {
    reasoning.push(`Showing elements for: ${intent.targets.join(', ')}`);

    // Check if target already exists
    const targetDrawer = drawerSet.drawers[0];
    if (!targetDrawer) {
      this.handleAddAction(drawerSet, intent, request, changes, reasoning);
      return;
    }

    // Check if matching tab exists
    for (const target of intent.targets) {
      const lowerTarget = target.toLowerCase();
      const existingTab = targetDrawer.tabs.find((t) =>
        t.id.toLowerCase().includes(lowerTarget) ||
        t.label?.toLowerCase().includes(lowerTarget)
      );

      if (!existingTab) {
        // Add new tab for this target
        const newTab = this.createTabFromIntent(
          { ...intent, targets: [target] },
          request,
          `tab-${target}-${Date.now()}`
        );
        targetDrawer.tabs.push(newTab);
        changes.push({
          type: 'add_tab',
          target: newTab.id,
          description: `Added tab "${newTab.label}" to show ${target}`,
        });
      }
    }
  }

  private handleFocusAction(
    drawerSet: DrawerSet,
    intent: ExtractedIntent,
    changes: DrawerChange[],
    reasoning: string[]
  ): void {
    reasoning.push(`Focusing on: ${intent.targets.join(', ')}`);

    // Reorder tabs to put focused one first
    for (const drawer of drawerSet.drawers) {
      for (const target of intent.targets) {
        const lowerTarget = target.toLowerCase();
        const tabIndex = drawer.tabs.findIndex((t) =>
          t.id.toLowerCase().includes(lowerTarget) ||
          t.label?.toLowerCase().includes(lowerTarget)
        );

        if (tabIndex > 0) {
          const [tab] = drawer.tabs.splice(tabIndex, 1);
          drawer.tabs.unshift(tab);
          changes.push({
            type: 'reorder',
            target: tab.id,
            description: `Moved tab "${tab.label}" to first position`,
          });
        }
      }
    }
  }

  private handleModifyAction(
    drawerSet: DrawerSet,
    intent: ExtractedIntent,
    request: CompileRequest,
    changes: DrawerChange[],
    reasoning: string[]
  ): void {
    reasoning.push(`Modifying: ${intent.targets.join(', ')}`);

    // Find and update matching elements
    for (const drawer of drawerSet.drawers) {
      for (const tab of drawer.tabs) {
        for (const slot of tab.slots) {
          const lowerSlotId = slot.id.toLowerCase();

          for (const target of intent.targets) {
            if (lowerSlotId.includes(target.toLowerCase())) {
              // Update card variant based on intent
              if (intent.useCase) {
                const variantResult = findBestVariant({
                  modality: intent.modality ?? 'interact',
                  device: request.device,
                  useCase: intent.useCase,
                });
                if (variantResult) {
                  slot.cardVariant = variantResult.variant.id as CardVariantId;
                  changes.push({
                    type: 'update_slot',
                    target: slot.id,
                    description: `Updated slot "${slot.id}" variant to ${variantResult.variant.id}`,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // INFERENCE HELPERS
  // ---------------------------------------------------------------------------

  private inferDrawerLabel(intent: ExtractedIntent): string {
    if (intent.targets.length > 0) {
      return this.capitalize(intent.targets[0]);
    }
    if (intent.modality) {
      return this.capitalize(intent.modality);
    }
    return 'Main';
  }

  private inferTabLabel(intent: ExtractedIntent): string {
    if (intent.useCase) {
      return this.capitalize(intent.useCase);
    }
    if (intent.targets.length > 0) {
      return this.capitalize(intent.targets[0]);
    }
    if (intent.modality) {
      return this.capitalize(intent.modality);
    }
    return 'Content';
  }

  private inferSlotLabel(intent: ExtractedIntent, position: 'primary' | 'secondary'): string {
    if (position === 'primary' && intent.targets.length > 0) {
      return this.capitalize(intent.targets[0]);
    }
    if (position === 'secondary' && intent.targets.length > 1) {
      return this.capitalize(intent.targets[1]);
    }
    if (intent.dataSource) {
      const labels: Record<string, string> = {
        walletBalances: 'Balances',
        walletEntitlements: 'Library',
        walletTasks: 'Tasks',
        walletQuests: 'Quests',
        currentContent: 'Current',
        relatedContent: 'Related',
        curatedList: 'Featured',
      };
      return labels[intent.dataSource] ?? 'Items';
    }
    return position === 'primary' ? 'Main' : 'More';
  }

  private inferDataSource(intent: ExtractedIntent): SlotDataSource['type'] {
    // Infer from targets
    for (const target of intent.targets) {
      const lowerTarget = target.toLowerCase();
      for (const [keyword, dataSource] of Object.entries(DATA_SOURCE_KEYWORDS)) {
        if (lowerTarget.includes(keyword)) {
          return dataSource;
        }
      }
    }

    // Infer from use case
    if (intent.useCase) {
      const useCaseToDataSource: Partial<Record<ModalUseCase, SlotDataSource['type']>> = {
        hero: 'currentContent',
        grid: 'relatedContent',
        thumbnails: 'recommended',
        tasks: 'walletTasks',
        wallet: 'walletBalances',
        agent: 'currentContent',
        codex: 'recommended',
        custom: 'customQuery',
        story: 'currentContent',
      };
      return useCaseToDataSource[intent.useCase] ?? 'currentContent';
    }

    return 'currentContent';
  }

  private inferSecondaryDataSource(intent: ExtractedIntent): SlotDataSource['type'] | null {
    if (intent.targets.length > 1) {
      const secondTarget = intent.targets[1].toLowerCase();
      for (const [keyword, dataSource] of Object.entries(DATA_SOURCE_KEYWORDS)) {
        if (secondTarget.includes(keyword)) {
          return dataSource;
        }
      }
    }
    return null;
  }

  private generateQuickPrompts(intent: ExtractedIntent): string[] {
    const prompts: string[] = [];

    if (intent.targets.includes('balance') || intent.targets.includes('wallet')) {
      prompts.push('What can I afford?');
      prompts.push('Show my transactions');
    }

    if (intent.targets.includes('task') || intent.targets.includes('tasks')) {
      prompts.push('Complete a task');
      prompts.push('Show rewards');
    }

    if (intent.targets.includes('content') || intent.targets.includes('library')) {
      prompts.push('Find similar content');
      prompts.push('What should I watch?');
    }

    if (prompts.length === 0) {
      prompts.push('Help me explore');
      prompts.push('What can I do?');
      prompts.push('Show recommendations');
    }

    return prompts.slice(0, 3);
  }

  private calculateConfidence(
    intent: ExtractedIntent,
    changes: DrawerChange[],
    warnings: string[]
  ): number {
    let confidence = 0.5;

    // Boost for clear intent
    if (intent.action !== 'show') confidence += 0.1;
    if (intent.targets.length > 0) confidence += 0.1;
    if (intent.modality) confidence += 0.1;
    if (intent.useCase) confidence += 0.1;
    if (intent.dataSource) confidence += 0.1;

    // Reduce for warnings
    confidence -= warnings.length * 0.1;

    // Boost for changes made
    if (changes.length > 0) confidence += 0.1;

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const drawerCompiler = new DrawerCompiler();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export async function compileDrawerPrompt(request: CompileRequest): Promise<CompileResult> {
  return drawerCompiler.compile(request);
}
