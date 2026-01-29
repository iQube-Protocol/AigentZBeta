/**
 * KNYT Liquid UI Service
 *
 * Handles template selection, drawer mode determination, and wallet UI mounting
 * based on user context, intent, and device. This service is used by the Codex
 * Copilot to determine which template to render for the user.
 */

import type {
  KnytTemplateId,
  KnytTemplate,
  TemplateSelectionContext,
  TemplateSelectionResult,
  DrawerMode,
  WalletUIComponent,
  CopilotOverlayMode,
  DeviceType,
  GeometryVariant,
  KnytLiquidUITemplatePack,
  UserIntent,
  KnytContentItem,
  KnytContentType,
  KnytComposedScreen,
  DrawerGridLayoutVariant,
} from '../../types/knytLiquidUI';

import templatePackData from '../../data/knyt_liquid_ui_template_pack.json';

// Type assertion for the imported JSON
const templatePack = templatePackData as KnytLiquidUITemplatePack;

// ============================================================================
// Template Selection Service
// ============================================================================

export class KnytLiquidUIService {
  private templates: Map<KnytTemplateId, KnytTemplate>;
  private pack: KnytLiquidUITemplatePack;

  constructor() {
    this.pack = templatePack;
    this.templates = new Map();

    // Index templates by ID
    for (const template of this.pack.templates) {
      this.templates.set(template.template_id as KnytTemplateId, template);
    }
  }

  selectTemplate(context: TemplateSelectionContext): TemplateSelectionResult {
    const {
      userIntent,
      device,
      contentMix,
      realm,
      taskState,
      isFirstVisit,
      personaId,
    } = context;

    // Default template selection
    let templateId: KnytTemplateId = 'knyt:drawer_grid_v1';
    let drawerMode: DrawerMode = device === 'mobile' ? 'narrow' : 'wide';
    let walletUI: WalletUIComponent[] = ['wallet_card.balance'];
    let copilotMode: CopilotOverlayMode = 'overlay';
    let reason = 'default';

    // Intent-based template switching
    switch (userIntent) {
      case 'watch':
      case 'motion_comics':
      case 'immersive_review':
      case 'trailers':
      case 'scene_review':
        templateId = 'knyt:motion_stage_v1';
        drawerMode = device === 'mobile' ? 'narrow' : 'wide';
        walletUI = ['wallet_card.balance'];
        copilotMode = device === 'mobile' ? 'overlay' : 'docked';
        reason = 'motion';
        break;

      case 'character_deep_dive':
      case 'cover_art':
      case 'page_review':
      case 'collectible_display':
        templateId = 'knyt:dual_poster_stage_v1';
        drawerMode = device === 'mobile' ? 'narrow' : 'wide';
        walletUI = ['wallet_card.balance', 'wallet_card.unlock_offer'];
        copilotMode = device === 'mobile' ? 'overlay' : 'docked';
        reason = 'poster_stage';
        break;

      case 'questing':
      case 'ascension':
      case 'earn_rewards':
      case 'member_get_member':
      case 'sales_partnerships':
      case 'guided_paths':
        templateId = 'knyt:quest_hud_hub_v1';
        drawerMode = device === 'mobile' ? 'narrow' : 'wide';
        walletUI = ['wallet_card.reward_claim', 'wallet_card.task_step'];
        copilotMode = device === 'mobile' ? 'overlay' : 'docked';
        reason = 'quest';
        break;

      case 'bridge_real_to_lore':
      case 'realm_navigation':
        templateId = 'knyt:realm_bridge_map_v1';
        drawerMode = device === 'mobile' ? 'narrow' : 'wide';
        walletUI = ['wallet_card.balance', 'wallet_card.referral_invite'];
        copilotMode = device === 'mobile' ? 'overlay' : 'docked';
        reason = 'realm';
        break;

      default:
        templateId = 'knyt:drawer_grid_v1';
        drawerMode = device === 'mobile' ? 'narrow' : 'wide';
        walletUI = ['wallet_card.balance', 'wallet_card.reward_claim'];
        copilotMode = device === 'mobile' ? 'overlay' : 'docked';
        reason = 'grid';
        break;
    }

    // Override for first visit
    if (isFirstVisit) {
      copilotMode = 'overlay';
    }

    // Override for task state
    if (taskState === 'active') {
      walletUI = Array.from(new Set([...walletUI, 'wallet_card.task_step']));
    }

    return {
      templateId,
      drawerMode,
      walletUI,
      copilotMode,
      reason,
    };
  }

  composeScreen(params: {
    templateId: KnytTemplateId;
    context: TemplateSelectionContext;
    contentItems: KnytContentItem[];
    selectedItemId?: string;
  }): KnytComposedScreen | null {
    const template = this.templates.get(params.templateId);
    if (!template) return null;

    const geometry = this.getGeometryForDevice(params.templateId, params.context.device);
    if (!geometry) return null;

    const regionIds = new Set(template.regions.map((r) => r.region_id));
    const regions: Record<string, { regionId: string; card?: string; items: KnytContentItem[] }> = {};
    for (const regionId of regionIds) {
      regions[regionId] = { regionId, items: [] };
    }

    const strategy = this.getCurationStrategy(params.templateId, params.context);

    const byType = {
      motion: params.contentItems.filter((i) => i.type === 'motion_comic_landscape'),
      print: params.contentItems.filter(
        (i) => i.type === 'comic_page_portrait' || i.type === 'comic_cover_portrait'
      ),
      characters: params.contentItems.filter((i) => i.type === 'character_portrait'),
      lore: params.contentItems.filter((i) => i.type === 'lore_snippet'),
      terra: params.contentItems.filter((i) => i.type === 'terra_update'),
    };

    const activeRealm = params.context.realm;
    const realmSort = (a: KnytContentItem, b: KnytContentItem) => {
      const aMatch = activeRealm && a.metadata?.realm === activeRealm ? 1 : 0;
      const bMatch = activeRealm && b.metadata?.realm === activeRealm ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return 0;
    };

    for (const key of Object.keys(byType) as Array<keyof typeof byType>) {
      byType[key] = [...byType[key]].sort(realmSort);
    }

    if (params.templateId === 'knyt:drawer_grid_v1') {
      const region = template.regions.find((r) => r.region_id === 'drawer_grid');
      const card = region?.cards?.[0];

      const shouldGroupEpisodes = !(
        params.context.userIntent === 'browse' ||
        params.context.userIntent === 'discover' ||
        params.context.userIntent === 'quick_switch' ||
        params.context.userIntent === 'library'
      );

      const grouped = shouldGroupEpisodes
        ? this.groupEpisodeVariants({ print: byType.print, motion: byType.motion })
        : { print: byType.print, motion: byType.motion };

      const maxVisibleItems = 999;
      const motionCap = strategy.motionCap;
      const selected = this.selectDrawerGridItems({
        maxVisibleItems,
        motionCap,
        byType: {
          ...byType,
          print: grouped.print,
          motion: grouped.motion,
        },
        selectedItemId: params.selectedItemId,
        strategy: strategy.name,
      });

      const columns = params.context.device === 'mobile' ? 2 : params.context.device === 'tablet' ? 3 : 4;
      const arranged = this.arrangeDrawerGridLayout({
        items: selected,
        columns,
        maxItems: 999,
        userIntent: params.context.userIntent,
      });

      regions.drawer_grid = { regionId: 'drawer_grid', card, items: arranged.items };
      return {
        templateId: params.templateId,
        device: params.context.device,
        geometry,
        regions,
        meta: {
          maxVisibleItems,
          motionCap,
          strategy: strategy.name,
          drawerGridLayoutVariant: arranged.variant,
        },
      };
    }

    if (params.templateId === 'knyt:motion_stage_v1') {
      const stageRegion = template.regions.find((r) => r.region_id === 'motion_stage');
      const clipRegion = template.regions.find((r) => r.region_id === 'clip_strip');
      const stage = this.pickPrimaryItem({
        preferredIds: params.selectedItemId ? [params.selectedItemId] : [],
        pools: [byType.motion, byType.print, byType.characters, byType.lore, byType.terra],
      });
      const clipItems = this.uniqueById([
        ...byType.motion,
        ...byType.print,
        ...byType.characters,
        ...byType.lore,
        ...byType.terra,
      ])
        .filter((i) => i.id !== stage?.id)
        .slice(0, 8);

      if (stage) {
        regions.motion_stage = {
          regionId: 'motion_stage',
          card: stageRegion?.modals?.[0],
          items: [stage],
        };
      }
      regions.clip_strip = { regionId: 'clip_strip', card: clipRegion?.cards?.[0], items: clipItems };
      return {
        templateId: params.templateId,
        device: params.context.device,
        geometry,
        regions,
        meta: {
          maxVisibleItems: 9,
          motionCap: undefined,
          strategy: strategy.name,
        },
      };
    }

    if (params.templateId === 'knyt:dual_poster_stage_v1') {
      const primaryRegion = template.regions.find((r) => r.region_id === 'poster_stage_primary');
      const secondaryRegion = template.regions.find((r) => r.region_id === 'poster_stage_secondary');

      const pools = [byType.characters, byType.print, byType.lore, byType.terra, byType.motion];
      const primary = this.pickPrimaryItem({
        preferredIds: params.selectedItemId ? [params.selectedItemId] : [],
        pools,
      });

      const secondary = this.uniqueById(pools.flat())
        .filter((i) => i.id !== primary?.id)
        .slice(0, params.context.device === 'mobile' ? 4 : 8);

      if (primary) {
        regions.poster_stage_primary = {
          regionId: 'poster_stage_primary',
          card: primaryRegion?.modals?.[0],
          items: [primary],
        };
      }
      regions.poster_stage_secondary = {
        regionId: 'poster_stage_secondary',
        card: secondaryRegion?.modals?.[0] || secondaryRegion?.cards?.[0],
        items: secondary,
      };
      return {
        templateId: params.templateId,
        device: params.context.device,
        geometry,
        regions,
        meta: {
          maxVisibleItems: params.context.device === 'mobile' ? 5 : 9,
          motionCap: undefined,
          strategy: strategy.name,
        },
      };
    }

    if (params.templateId === 'knyt:quest_hud_hub_v1') {
      const stageRegion = template.regions.find((r) => r.region_id === 'content_stage');
      const pools = [byType.print, byType.characters, byType.lore, byType.terra, byType.motion];
      const stage = this.pickPrimaryItem({
        preferredIds: params.selectedItemId ? [params.selectedItemId] : [],
        pools,
      });
      if (stage) {
        regions.content_stage = { regionId: 'content_stage', card: stageRegion?.cards?.[0], items: [stage] };
      }
      return {
        templateId: params.templateId,
        device: params.context.device,
        geometry,
        regions,
        meta: {
          maxVisibleItems: 1,
          motionCap: undefined,
          strategy: strategy.name,
        },
      };
    }

    const fallbackRegion =
      template.regions.find((r) => r.role === 'primary_catalog')?.region_id || 'drawer_grid';
    const fallbackCards = template.regions.find((r) => r.region_id === fallbackRegion)?.cards;
    const selected = this.uniqueById([
      ...byType.print,
      ...byType.characters,
      ...byType.lore,
      ...byType.terra,
      ...byType.motion,
    ]).slice(0, 8);

    if (!regions[fallbackRegion]) {
      regions[fallbackRegion] = { regionId: fallbackRegion, items: [] };
    }
    regions[fallbackRegion] = { regionId: fallbackRegion, card: fallbackCards?.[0], items: selected };

    return {
      templateId: params.templateId,
      device: params.context.device,
      geometry,
      regions,
      meta: {
        maxVisibleItems: 8,
        motionCap: strategy.motionCap,
        strategy: strategy.name,
      },
    };
  }

  private getCurationStrategy(templateId: KnytTemplateId, context: TemplateSelectionContext): { name: string; motionCap?: number } {
    const intent = context.userIntent;
    if (templateId === 'knyt:drawer_grid_v1') {
      if (intent === 'browse' || intent === 'discover' || intent === 'quick_switch' || intent === 'library') {
        return { name: 'drawer_grid_curated_cap_motion', motionCap: 1 };
      }
      if (intent === 'watch' || intent === 'motion_comics' || intent === 'immersive_review') {
        return { name: 'motion_priority', motionCap: 4 };
      }
    }
    return { name: 'default' };
  }

  private selectDrawerGridItems(params: {
    maxVisibleItems: number;
    motionCap?: number;
    byType: {
      motion: KnytContentItem[];
      print: KnytContentItem[];
      characters: KnytContentItem[];
      lore: KnytContentItem[];
      terra: KnytContentItem[];
    };
    selectedItemId?: string;
    strategy: string;
  }): KnytContentItem[] {
    const { byType, motionCap } = params;
    let motion = byType.motion;
    if (motionCap !== undefined) {
      motion = motion.slice(0, motionCap);
    }
    return this.uniqueById([
      ...byType.print,
      ...byType.characters,
      ...byType.lore,
      ...byType.terra,
      ...motion,
    ]).slice(0, params.maxVisibleItems);
  }

  private arrangeDrawerGridLayout(params: {
    items: KnytContentItem[];
    columns: number;
    maxItems: number;
    userIntent: UserIntent;
  }): { items: KnytContentItem[]; variant: DrawerGridLayoutVariant } {
    const items = params.items.slice(0, params.maxItems);
    return { items, variant: 'auto' };
  }

  private pickPrimaryItem(params: { preferredIds: string[]; pools: KnytContentItem[][] }): KnytContentItem | null {
    const { preferredIds, pools } = params;
    for (const id of preferredIds) {
      const found = pools.flat().find((item) => item.id === id);
      if (found) return found;
    }
    return pools.flat()[0] || null;
  }

  private uniqueById(items: KnytContentItem[]): KnytContentItem[] {
    const seen = new Set<string>();
    const out: KnytContentItem[] = [];
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  }

  private groupEpisodeVariants(params: { print: KnytContentItem[]; motion: KnytContentItem[] }) {
    return params;
  }

  getTemplate(templateId: KnytTemplateId): KnytTemplate | undefined {
    return this.templates.get(templateId);
  }

  getAllTemplates(): KnytTemplate[] {
    return Array.from(this.templates.values());
  }

  getGeometryForDevice(templateId: KnytTemplateId, device: DeviceType): GeometryVariant | undefined {
    const template = this.templates.get(templateId);
    if (!template) return undefined;
    return template.geometry_variants.find((v) => v.when.device.includes(device));
  }

  getViewerForContentType(contentType: KnytContentType): string | undefined {
    const defaults = this.pack.content_type_to_modal_defaults[contentType];
    return defaults?.primary_viewer || defaults?.viewer;
  }

  getCardsForContentType(contentType: KnytContentType): string[] {
    const defaults = this.pack.content_type_to_modal_defaults[contentType];
    return defaults?.primary_cards || defaults?.fallback_cards || [];
  }

  getWalletUICatalog() {
    return this.pack.wallet_surface.wallet_ui_catalog;
  }

  getDrawerDimensions(mode: DrawerMode, device: DeviceType): { width?: number; height?: number } {
    if (mode === 'none') return {};
    const modeConfig = this.pack.wallet_surface.drawer_modes[mode];
    if (!modeConfig) return {};
    if (device === 'mobile') {
      return { height: modeConfig.mobile_height_norm };
    }
    return { width: modeConfig.desktop_width_norm };
  }

  requiresUserConfirm(action: 'view_content' | 'propose_wallet_action' | 'execute_wallet_action'): boolean {
    return this.pack.wallet_surface.capability_gates[action]?.requires_user_confirm ?? false;
  }

  getModalCatalog() {
    return this.pack.modal_catalog;
  }

  getCopilotActionHooks() {
    return this.pack.copilot_action_hooks;
  }

  inferUserIntent(contentItems: KnytContentItem[], interaction?: string, hasActiveTasks?: boolean): UserIntent {
    if (interaction) {
      const intentMap: Record<string, UserIntent> = {
        watch: 'watch',
        read: 'page_review',
        browse: 'browse',
        discover: 'discover',
        claim: 'claim',
        purchase: 'purchase',
        unlock: 'unlock',
        invite: 'invite',
        quest: 'questing',
        ascend: 'ascension',
      };
      if (intentMap[interaction]) {
        return intentMap[interaction];
      }
    }

    if (hasActiveTasks) {
      return 'questing';
    }

    if (contentItems.length === 0) {
      return 'discover';
    }

    const types = contentItems.map((c) => c.type);
    const hasMotion = types.includes('motion_comic_landscape');
    const hasPortrait = types.some(
      (t) => t === 'comic_page_portrait' || t === 'comic_cover_portrait' || t === 'character_portrait'
    );

    if (hasMotion && !hasPortrait) {
      return 'watch';
    }

    if (hasPortrait && contentItems.length <= 2) {
      return 'character_deep_dive';
    }

    return 'browse';
  }

  inferContentMix(contentItems: KnytContentItem[]): 'mixed' | 'mostly_portrait' | 'portrait_focus' | 'motion_focus' | 'landscape_focus' {
    if (contentItems.length === 0) return 'mixed';

    const types = contentItems.map((c) => c.type);
    const portraitCount = types.filter(
      (t) => t === 'comic_page_portrait' || t === 'comic_cover_portrait' || t === 'character_portrait'
    ).length;
    const motionCount = types.filter((t) => t === 'motion_comic_landscape').length;

    const total = contentItems.length;
    const portraitRatio = portraitCount / total;
    const motionRatio = motionCount / total;

    if (motionRatio > 0.7) return 'motion_focus';
    if (motionRatio > 0.5) return 'landscape_focus';
    if (portraitRatio > 0.9) return 'portrait_focus';
    if (portraitRatio > 0.6) return 'mostly_portrait';
    return 'mixed';
  }

  static getDeviceType(): DeviceType {
    if (typeof window === 'undefined') return 'desktop';

    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }
}

let serviceInstance: KnytLiquidUIService | null = null;

export function getKnytLiquidUIService(): KnytLiquidUIService {
  if (!serviceInstance) {
    serviceInstance = new KnytLiquidUIService();
  }
  return serviceInstance;
}

export function useKnytTemplateSelection(context: TemplateSelectionContext): TemplateSelectionResult {
  const service = getKnytLiquidUIService();
  return service.selectTemplate(context);
}

