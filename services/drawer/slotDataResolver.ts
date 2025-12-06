/**
 * SlotDataResolver
 * 
 * Resolves SlotDataSource configurations to actual data.
 * Handles both content data sources and wallet data sources.
 */

import type {
  DrawerSlot,
  SlotDataSource,
  DrawerContext,
  Device,
  Modality,
} from '@/types/smartDrawer';
import type { SmartWalletQube, WalletTask, WalletQuest, WalletEntitlement, WalletBalance } from '@/types/smartWalletQube';

// =============================================================================
// TYPES
// =============================================================================

/** Resolved slot data */
export interface ResolvedSlotData {
  /** Slot ID */
  slotId: string;
  
  /** Data source type */
  sourceType: SlotDataSource['type'];
  
  /** Resolved items */
  items: ResolvedItem[];
  
  /** Total count (for pagination) */
  totalCount: number;
  
  /** Is loading */
  isLoading: boolean;
  
  /** Error message if any */
  error?: string;
}

/** A resolved item (content or wallet data) */
export interface ResolvedItem {
  /** Item ID */
  id: string;
  
  /** Item type */
  type: 'content' | 'balance' | 'entitlement' | 'task' | 'quest' | 'reward';
  
  /** Display data */
  display: {
    title: string;
    subtitle?: string;
    description?: string;
    imageUrl?: string;
    videoUrl?: string;
    badge?: string;
    progress?: number;
    status?: string;
  };
  
  /** Action data */
  action?: {
    type: 'navigate' | 'play' | 'claim' | 'purchase' | 'expand';
    target?: string;
    payload?: Record<string, any>;
  };
  
  /** Raw data reference */
  raw: any;
}

/** Resolution context */
export interface ResolutionContext {
  /** Current content ID */
  currentContentId?: string;
  
  /** Current content data */
  currentContent?: any;
  
  /** Wallet data */
  wallet?: SmartWalletQube;
  
  /** Device */
  device: Device;
  
  /** App ID */
  appId: string;
  
  /** Persona ID */
  personaId: string;
  
  /** Tenant ID */
  tenantId: string;
}

// =============================================================================
// SLOT DATA RESOLVER CLASS
// =============================================================================

class SlotDataResolver {
  // ---------------------------------------------------------------------------
  // MAIN RESOLUTION
  // ---------------------------------------------------------------------------

  /**
   * Resolve a slot's data source to actual data
   */
  async resolveSlot(
    slot: DrawerSlot,
    ctx: ResolutionContext
  ): Promise<ResolvedSlotData> {
    const { dataSource } = slot;

    if (!dataSource) {
      return this.emptyResult(slot.id, 'none');
    }

    try {
      switch (dataSource.type) {
        // Content data sources
        case 'currentContent':
          return this.resolveCurrentContent(slot, dataSource, ctx);
        case 'relatedContent':
          return this.resolveRelatedContent(slot, dataSource, ctx);
        case 'recommended':
          return this.resolveRecommended(slot, dataSource, ctx);
        case 'library':
          return this.resolveLibrary(slot, dataSource, ctx);
        case 'customQuery':
          return this.resolveCustomQuery(slot, dataSource, ctx);

        // Wallet data sources
        case 'walletBalances':
          return this.resolveWalletBalances(slot, dataSource, ctx);
        case 'walletEntitlements':
          return this.resolveWalletEntitlements(slot, dataSource, ctx);
        case 'walletTasks':
          return this.resolveWalletTasks(slot, dataSource, ctx);
        case 'walletQuests':
          return this.resolveWalletQuests(slot, dataSource, ctx);
        
        // DeFi data sources
        case 'walletDefiPositions':
          return this.resolveDefiPositions(slot, dataSource, ctx);
        case 'walletDefiStrategies':
          return this.resolveDefiStrategies(slot, dataSource, ctx);
        case 'walletDefiRiskSummary':
          return this.resolveDefiRiskSummary(slot, dataSource, ctx);
        
        // Agent panel
        case 'agentPanel':
          return this.resolveAgentPanel(slot, dataSource, ctx);
      }
    } catch (error) {
      return this.emptyResult(
        slot.id,
        dataSource.type,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Resolve multiple slots in parallel
   */
  async resolveSlots(
    slots: DrawerSlot[],
    ctx: ResolutionContext
  ): Promise<Map<string, ResolvedSlotData>> {
    const results = await Promise.all(
      slots.map((slot) => this.resolveSlot(slot, ctx))
    );

    const map = new Map<string, ResolvedSlotData>();
    for (const result of results) {
      map.set(result.slotId, result);
    }
    return map;
  }

  // ---------------------------------------------------------------------------
  // CONTENT RESOLVERS
  // ---------------------------------------------------------------------------

  private async resolveCurrentContent(
    slot: DrawerSlot,
    dataSource: SlotDataSource,
    ctx: ResolutionContext
  ): Promise<ResolvedSlotData> {
    if (!ctx.currentContent) {
      return this.emptyResult(slot.id, 'currentContent');
    }

    // Filter by modality if specified (only for currentContent type)
    if (dataSource.type === 'currentContent' && dataSource.modalities && dataSource.modalities.length > 0) {
      const contentModality = ctx.currentContent.modality || 'read';
      if (!dataSource.modalities.includes(contentModality)) {
        return this.emptyResult(slot.id, 'currentContent');
      }
    }

    const item = this.contentToResolvedItem(ctx.currentContent);
    return {
      slotId: slot.id,
      sourceType: 'currentContent',
      items: [item],
      totalCount: 1,
      isLoading: false,
    };
  }

  private async resolveRelatedContent(
    slot: DrawerSlot,
    dataSource: SlotDataSource,
    ctx: ResolutionContext
  ): Promise<ResolvedSlotData> {
    // TODO: Fetch related content from API
    // For now, return mock data

    const limit = ('limit' in dataSource && dataSource.limit) ? dataSource.limit : 6;
    const mockItems: ResolvedItem[] = [];

    for (let i = 0; i < limit; i++) {
      mockItems.push({
        id: `related-${i}`,
        type: 'content',
        display: {
          title: `Related Content ${i + 1}`,
          subtitle: `${'relationType' in dataSource ? dataSource.relationType : 'related'} content`,
          imageUrl: `/api/placeholder/300/200?text=Related${i + 1}`,
        },
        action: {
          type: 'navigate',
          target: `/content/related-${i}`,
        },
        raw: { id: `related-${i}`, type: 'mock' },
      });
    }

    return {
      slotId: slot.id,
      sourceType: 'relatedContent',
      items: mockItems,
      totalCount: mockItems.length,
      isLoading: false,
    };
  }

  private async resolveCuratedList(
    slot: DrawerSlot,
    dataSource: SlotDataSource,
    ctx: ResolutionContext
  ): Promise<ResolvedSlotData> {
    // TODO: Fetch curated list from API
    const listId = ('listId' in dataSource && dataSource.listId) ? dataSource.listId : 'default';
    const limit = ('limit' in dataSource && dataSource.limit) ? dataSource.limit : 10;

    const mockItems: ResolvedItem[] = [];
    for (let i = 0; i < limit; i++) {
      mockItems.push({
        id: `curated-${listId}-${i}`,
        type: 'content',
        display: {
          title: `Curated Item ${i + 1}`,
          subtitle: `From list: ${listId}`,
          imageUrl: `/api/placeholder/300/200?text=Curated${i + 1}`,
        },
        action: {
          type: 'navigate',
          target: `/content/curated-${listId}-${i}`,
        },
        raw: { id: `curated-${listId}-${i}`, type: 'mock' },
      });
    }

    return {
      slotId: slot.id,
      sourceType: 'library',
      items: mockItems,
      totalCount: mockItems.length,
      isLoading: false,
    };
  }

  private async resolveCustomQuery(
    slot: DrawerSlot,
    dataSource: SlotDataSource,
    ctx: ResolutionContext
  ): Promise<ResolvedSlotData> {
    // Custom queries are handled by specific query handlers
    const queryId = ('queryId' in dataSource && dataSource.queryId) ? dataSource.queryId : 'unknown';

    // For agent panels, return empty (handled separately)
    if (queryId === 'copilot-panel' || queryId.includes('agent')) {
      return this.emptyResult(slot.id, 'customQuery');
    }

    // TODO: Implement custom query handlers
    return this.emptyResult(slot.id, 'customQuery');
  }

  // ---------------------------------------------------------------------------
  // WALLET RESOLVERS
  // ---------------------------------------------------------------------------

  private async resolveWalletBalances(
    slot: DrawerSlot,
    dataSource: SlotDataSource,
    ctx: ResolutionContext
  ): Promise<ResolvedSlotData> {
    if (!ctx.wallet) {
      return this.emptyResult(slot.id, 'walletBalances', 'No wallet data');
    }

    const items = ctx.wallet.balances.map((balance) =>
      this.balanceToResolvedItem(balance)
    );

    return {
      slotId: slot.id,
      sourceType: 'walletBalances',
      items,
      totalCount: items.length,
      isLoading: false,
    };
  }

  private async resolveWalletEntitlements(
    slot: DrawerSlot,
    dataSource: SlotDataSource,
    ctx: ResolutionContext
  ): Promise<ResolvedSlotData> {
    if (!ctx.wallet) {
      return this.emptyResult(slot.id, 'walletEntitlements', 'No wallet data');
    }

    let entitlements = ctx.wallet.entitlements;

    // Apply status filter
    if ('statusFilter' in dataSource && dataSource.statusFilter && dataSource.statusFilter.length > 0) {
      const statusFilter = dataSource.statusFilter as string[];
      entitlements = entitlements.filter((e) =>
        statusFilter.includes(e.status)
      );
    }

    const items = entitlements.map((e) => this.entitlementToResolvedItem(e));

    return {
      slotId: slot.id,
      sourceType: 'walletEntitlements',
      items,
      totalCount: items.length,
      isLoading: false,
    };
  }

  private async resolveWalletTasks(
    slot: DrawerSlot,
    dataSource: SlotDataSource,
    ctx: ResolutionContext
  ): Promise<ResolvedSlotData> {
    if (!ctx.wallet) {
      return this.emptyResult(slot.id, 'walletTasks', 'No wallet data');
    }

    let tasks = ctx.wallet.tasks;

    // Apply status filter
    if ('statusFilter' in dataSource && dataSource.statusFilter && dataSource.statusFilter.length > 0) {
      const statusFilter = dataSource.statusFilter as string[];
      tasks = tasks.filter((t) => statusFilter.includes(t.status));
    }

    const items = tasks.map((t) => this.taskToResolvedItem(t));

    return {
      slotId: slot.id,
      sourceType: 'walletTasks',
      items,
      totalCount: items.length,
      isLoading: false,
    };
  }

  private async resolveWalletQuests(
    slot: DrawerSlot,
    dataSource: SlotDataSource,
    ctx: ResolutionContext
  ): Promise<ResolvedSlotData> {
    if (!ctx.wallet) {
      return this.emptyResult(slot.id, 'walletQuests', 'No wallet data');
    }

    let quests = ctx.wallet.quests ?? [];

    // Apply status filter
    if ('statusFilter' in dataSource && dataSource.statusFilter && dataSource.statusFilter.length > 0) {
      const statusFilter = dataSource.statusFilter as string[];
      quests = quests.filter((q) => statusFilter.includes(q.status));
    }

    const items = quests.map((q) => this.questToResolvedItem(q));

    return {
      slotId: slot.id,
      sourceType: 'walletQuests',
      items,
      totalCount: items.length,
      isLoading: false,
    };
  }

  // ---------------------------------------------------------------------------
  // ITEM CONVERTERS
  // ---------------------------------------------------------------------------

  private contentToResolvedItem(content: any): ResolvedItem {
    return {
      id: content.id ?? content.contentId ?? 'unknown',
      type: 'content',
      display: {
        title: content.title ?? content.label ?? 'Untitled',
        subtitle: content.subtitle ?? content.category,
        description: content.description ?? content.summary,
        imageUrl: content.imageUrl ?? content.thumbnail ?? content.posterUrl,
        videoUrl: content.videoUrl ?? content.streamUrl,
        badge: content.badge,
      },
      action: {
        type: content.modality === 'watch' ? 'play' : 'navigate',
        target: `/content/${content.id ?? content.contentId}`,
        payload: { contentId: content.id ?? content.contentId },
      },
      raw: content,
    };
  }

  private balanceToResolvedItem(balance: WalletBalance): ResolvedItem {
    return {
      id: `balance-${balance.asset}`,
      type: 'balance',
      display: {
        title: balance.label ?? balance.asset,
        subtitle: `${balance.amount} ${balance.symbol ?? balance.asset}`,
        badge: balance.chain,
      },
      raw: balance,
    };
  }

  private entitlementToResolvedItem(entitlement: WalletEntitlement): ResolvedItem {
    return {
      id: entitlement.entitlementId,
      type: 'entitlement',
      display: {
        title: entitlement.entitlementId.split(':').pop() ?? entitlement.entitlementId,
        subtitle: entitlement.category,
        status: entitlement.status,
        badge: entitlement.acquiredVia,
      },
      action: {
        type: 'navigate',
        target: `/content/${entitlement.entitlementId}`,
        payload: { entitlementId: entitlement.entitlementId },
      },
      raw: entitlement,
    };
  }

  private taskToResolvedItem(task: WalletTask): ResolvedItem {
    const statusProgress: Record<string, number> = {
      'todo': 0,
      'in-progress': 0.5,
      'done': 1,
      'expired': 0,
    };

    return {
      id: task.taskId,
      type: 'task',
      display: {
        title: task.label,
        subtitle: task.rewardPreview
          ? `Reward: ${task.rewardPreview.amount} ${task.rewardPreview.asset}`
          : undefined,
        status: task.status,
        progress: statusProgress[task.status] ?? 0,
      },
      action: task.relatedContentId
        ? {
            type: 'navigate',
            target: `/content/${task.relatedContentId}`,
            payload: { taskId: task.taskId, contentId: task.relatedContentId },
          }
        : undefined,
      raw: task,
    };
  }

  private questToResolvedItem(quest: WalletQuest): ResolvedItem {
    const completedSteps = quest.steps.filter((s) => s.status === 'done').length;
    const progress = quest.steps.length > 0 ? completedSteps / quest.steps.length : 0;

    return {
      id: quest.questId,
      type: 'quest',
      display: {
        title: quest.label,
        subtitle: `${completedSteps}/${quest.steps.length} steps`,
        status: quest.status,
        progress,
      },
      action: {
        type: 'expand',
        payload: { questId: quest.questId },
      },
      raw: quest,
    };
  }

  // ---------------------------------------------------------------------------
  // ADDITIONAL RESOLVERS
  // ---------------------------------------------------------------------------

  private async resolveRecommended(
    slot: DrawerSlot,
    dataSource: SlotDataSource,
    ctx: ResolutionContext
  ): Promise<ResolvedSlotData> {
    // Placeholder - would fetch recommended content
    return this.emptyResult(slot.id, 'recommended');
  }

  private async resolveLibrary(
    slot: DrawerSlot,
    dataSource: SlotDataSource,
    ctx: ResolutionContext
  ): Promise<ResolvedSlotData> {
    // Placeholder - would fetch library content
    return this.emptyResult(slot.id, 'library');
  }

  private async resolveDefiPositions(
    slot: DrawerSlot,
    dataSource: SlotDataSource,
    ctx: ResolutionContext
  ): Promise<ResolvedSlotData> {
    if (!ctx.wallet?.defiPortfolio?.positions) {
      return this.emptyResult(slot.id, 'walletDefiPositions', 'No DeFi positions');
    }
    const items = ctx.wallet.defiPortfolio.positions.map((p) => ({
      id: p.positionId,
      type: 'content' as const,
      display: {
        title: p.protocol,
        subtitle: `${p.assetIn} on ${p.chain}`,
        status: p.status,
      },
      raw: p,
    }));
    return { slotId: slot.id, sourceType: 'walletDefiPositions', items, totalCount: items.length, isLoading: false };
  }

  private async resolveDefiStrategies(
    slot: DrawerSlot,
    dataSource: SlotDataSource,
    ctx: ResolutionContext
  ): Promise<ResolvedSlotData> {
    if (!ctx.wallet?.defiPortfolio?.strategies) {
      return this.emptyResult(slot.id, 'walletDefiStrategies', 'No DeFi strategies');
    }
    const items = ctx.wallet.defiPortfolio.strategies.map((s) => ({
      id: s.strategyId,
      type: 'content' as const,
      display: {
        title: s.label,
        subtitle: s.category,
        status: s.status,
      },
      raw: s,
    }));
    return { slotId: slot.id, sourceType: 'walletDefiStrategies', items, totalCount: items.length, isLoading: false };
  }

  private async resolveDefiRiskSummary(
    slot: DrawerSlot,
    dataSource: SlotDataSource,
    ctx: ResolutionContext
  ): Promise<ResolvedSlotData> {
    if (!ctx.wallet?.defiPortfolio?.riskSummary) {
      return this.emptyResult(slot.id, 'walletDefiRiskSummary', 'No risk summary');
    }
    const rs = ctx.wallet.defiPortfolio.riskSummary;
    const items = [{
      id: 'risk-summary',
      type: 'content' as const,
      display: {
        title: `Risk: ${rs.dominantRiskBand ?? 'Unknown'}`,
        subtitle: `Score: ${rs.riskScore ?? 0}`,
      },
      raw: rs,
    }];
    return { slotId: slot.id, sourceType: 'walletDefiRiskSummary', items, totalCount: 1, isLoading: false };
  }

  private async resolveAgentPanel(
    slot: DrawerSlot,
    dataSource: SlotDataSource,
    ctx: ResolutionContext
  ): Promise<ResolvedSlotData> {
    // Agent panel is handled separately by the UI
    return this.emptyResult(slot.id, 'agentPanel');
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private emptyResult(
    slotId: string,
    sourceType: SlotDataSource['type'] | 'none',
    error?: string
  ): ResolvedSlotData {
    return {
      slotId,
      sourceType: sourceType as SlotDataSource['type'],
      items: [],
      totalCount: 0,
      isLoading: false,
      error,
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const slotDataResolver = new SlotDataResolver();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export async function resolveSlot(
  slot: DrawerSlot,
  ctx: ResolutionContext
): Promise<ResolvedSlotData> {
  return slotDataResolver.resolveSlot(slot, ctx);
}

export async function resolveSlots(
  slots: DrawerSlot[],
  ctx: ResolutionContext
): Promise<Map<string, ResolvedSlotData>> {
  return slotDataResolver.resolveSlots(slots, ctx);
}
