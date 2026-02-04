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
} from '@/types/knytLiquidUI';

import templatePackData from '@/data/knyt_liquid_ui_template_pack.json';

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

    const regionIds = new Set(template.regions.map(r => r.region_id));
    const regions: Record<string, { regionId: string; card?: string; items: KnytContentItem[] }> = {};
    for (const regionId of regionIds) {
      regions[regionId] = { regionId, items: [] };
    }

    const strategy = this.getCurationStrategy(params.templateId, params.context);

    const byType = {
      motion: params.contentItems.filter(i => i.type === 'motion_comic_landscape'),
      print: params.contentItems.filter(i => i.type === 'comic_page_portrait' || i.type === 'comic_cover_portrait'),
      characters: params.contentItems.filter(i => i.type === 'character_portrait'),
      lore: params.contentItems.filter(i => i.type === 'lore_snippet'),
      terra: params.contentItems.filter(i => i.type === 'terra_update'),
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
      const region = template.regions.find(r => r.region_id === 'drawer_grid');
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

      const maxVisibleItems = 999; // Show all items
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
        maxItems: 999, // Show all items
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
      const stageRegion = template.regions.find(r => r.region_id === 'motion_stage');
      const clipRegion = template.regions.find(r => r.region_id === 'clip_strip');
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
      ]).filter(i => i.id !== stage?.id).slice(0, 8);

      if (stage) {
        regions.motion_stage = { regionId: 'motion_stage', card: stageRegion?.modals?.[0], items: [stage] };
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
      const primaryRegion = template.regions.find(r => r.region_id === 'poster_stage_primary');
      const secondaryRegion = template.regions.find(r => r.region_id === 'poster_stage_secondary');

      const pools = [byType.characters, byType.print, byType.lore, byType.terra, byType.motion];
      const primary = this.pickPrimaryItem({
        preferredIds: params.selectedItemId ? [params.selectedItemId] : [],
        pools,
      });

      const secondary = this.uniqueById(pools.flat())
        .filter(i => i.id !== primary?.id)
        .slice(0, params.context.device === 'mobile' ? 4 : 8);

      if (primary) {
        regions.poster_stage_primary = { regionId: 'poster_stage_primary', card: primaryRegion?.modals?.[0], items: [primary] };
      }
      regions.poster_stage_secondary = { regionId: 'poster_stage_secondary', card: secondaryRegion?.modals?.[0] || secondaryRegion?.cards?.[0], items: secondary };
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
      const stageRegion = template.regions.find(r => r.region_id === 'content_stage');
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

    const fallbackRegion = template.regions.find(r => r.role === 'primary_catalog')?.region_id || 'drawer_grid';
    const fallbackCards = template.regions.find(r => r.region_id === fallbackRegion)?.cards;
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
      return { name: 'drawer_grid_curated', motionCap: 3 };
    }

    if (templateId === 'knyt:motion_stage_v1') {
      return { name: 'motion_stage_focus', motionCap: undefined };
    }

    if (templateId === 'knyt:dual_poster_stage_v1') {
      return { name: 'poster_stage_focus', motionCap: undefined };
    }

    if (templateId === 'knyt:quest_hud_hub_v1') {
      return { name: 'quest_hud_focus', motionCap: undefined };
    }

    return { name: 'default_curated', motionCap: 1 };
  }

  private groupEpisodeVariants(params: { print: KnytContentItem[]; motion: KnytContentItem[] }): { print: KnytContentItem[]; motion: KnytContentItem[] } {
    const byEpisode = new Map<number, { print?: KnytContentItem; motion?: KnytContentItem }>();

    for (const p of params.print) {
      const ep = p.metadata?.episodeNumber;
      if (typeof ep !== 'number') continue;
      const existing = byEpisode.get(ep) || {};
      if (!existing.print) existing.print = p;
      byEpisode.set(ep, existing);
    }

    for (const m of params.motion) {
      const ep = m.metadata?.episodeNumber;
      if (typeof ep !== 'number') continue;
      const existing = byEpisode.get(ep) || {};
      if (!existing.motion) existing.motion = m;
      byEpisode.set(ep, existing);
    }

    const pairedPrintIds = new Set<string>();
    const pairedMotionIds = new Set<string>();
    const groupedTiles: KnytContentItem[] = [];

    for (const [ep, pair] of byEpisode.entries()) {
      if (!pair.print || !pair.motion) continue;

      pairedPrintIds.add(pair.print.id);
      pairedMotionIds.add(pair.motion.id);

      groupedTiles.push({
        ...pair.print,
        id: `${pair.print.id}_group`,
        group: {
          groupId: `episode_${ep}`,
          label: `Episode ${ep}`,
          variantIds: [pair.print.id, pair.motion.id],
        },
        media: {
          ...pair.print.media,
          ...pair.motion.media,
        },
        modalities: {
          ...pair.print.modalities,
          ...pair.motion.modalities,
        },
      });
    }

    const printOut = [...groupedTiles, ...params.print.filter(p => !pairedPrintIds.has(p.id))];
    const motionOut = params.motion.filter(m => !pairedMotionIds.has(m.id));
    return { print: this.uniqueById(printOut), motion: this.uniqueById(motionOut) };
  }

  private arrangeDrawerGridLayout(params: {
    items: KnytContentItem[];
    columns: number;
    maxItems: number;
    userIntent: UserIntent;
  }): KnytContentItem[] {
    const isTall = (i: KnytContentItem) => i.type.includes('portrait');
    const tall: KnytContentItem[] = [];
    const wide: KnytContentItem[] = [];

    for (const i of params.items) {
      (isTall(i) ? tall : wide).push(i);
    }

    const isDesktop = params.columns === 4 && params.maxItems >= 8;
    const useOption3 =
      params.userIntent === 'browse' ||
      params.userIntent === 'discover' ||
      params.userIntent === 'quick_switch' ||
      params.userIntent === 'library';

    const terraLore = params.items.filter(i => i.type === 'terra_update' || i.type === 'lore_snippet');
    const motion = params.items.filter(i => i.type === 'motion_comic_landscape');
    const motionFocus = motion.length > 0 && (params.userIntent === 'watch' || params.userIntent === 'motion_comics' || params.userIntent === 'immersive_review' || params.userIntent === 'trailers' || params.userIntent === 'scene_review');

    // Select layout variant based on content mix and user intent
    const layoutResult = this.selectDrawerGridLayoutVariant({
      tall,
      wide,
      terraLore,
      motion,
      userIntent: params.userIntent,
      isDesktop,
    });

    // Mark featured item if applicable
    if (layoutResult.featuredItem && layoutResult.featuredSide) {
      const featuredWithMeta: KnytContentItem = {
        ...layoutResult.featuredItem,
        metadata: {
          ...(layoutResult.featuredItem.metadata || {}),
          featured: true,
          drawerGridLayout: layoutResult.featuredSide as 'featured_left' | 'featured_right',
        },
      };
      return { items: [featuredWithMeta, ...layoutResult.items.filter(i => i.id !== layoutResult.featuredItem?.id)], variant: layoutResult.variant };
    }

    return { items: layoutResult.items, variant: layoutResult.variant };
  }

  /**
   * Select the appropriate drawer grid layout variant based on content mix and user intent.
   * Returns the variant name and arranged items.
   */
  private selectDrawerGridLayoutVariant(params: {
    tall: KnytContentItem[];
    wide: KnytContentItem[];
    terraLore: KnytContentItem[];
    motion: KnytContentItem[];
    userIntent: UserIntent;
    isDesktop: boolean;
  }): { variant: DrawerGridLayoutVariant; items: KnytContentItem[]; featuredItem?: KnytContentItem; featuredSide?: 'featured_left' | 'featured_right' } {
    const { tall, wide, terraLore, motion, userIntent, isDesktop } = params;

    if (!isDesktop) {
      // Mobile/tablet: simple grid, no fancy layouts
      return { variant: 'auto', items: [...tall, ...wide] };
    }

    const motionFocus = motion.length > 0 && (
      userIntent === 'watch' ||
      userIntent === 'motion_comics' ||
      userIntent === 'immersive_review' ||
      userIntent === 'trailers' ||
      userIntent === 'scene_review'
    );

    const browseIntent = userIntent === 'browse' || userIntent === 'discover' || userIntent === 'quick_switch' || userIntent === 'library';

    // Option 2: Featured 2x2 stage (when we have terra/lore or motion focus)
    if (terraLore.length > 0 || motionFocus) {
      const featuredCandidate = motionFocus ? motion[0] : terraLore[0];
      if (featuredCandidate) {
        const remaining = [...tall, ...wide].filter(i => i.id !== featuredCandidate.id);
        const remainingTall = remaining.filter(i => i.type.includes('portrait'));
        const remainingWide = remaining.filter(i => !i.type.includes('portrait'));

        // 1C: Featured + 2 posters (when we have enough portraits)
        if (remainingTall.length >= 2) {
          const fillers = remaining.filter(i => !remainingTall.slice(0, 2).some(t => t.id === i.id));
          return {
            variant: '1C',
            items: [featuredCandidate, ...remainingTall.slice(0, 2), ...fillers],
            featuredItem: featuredCandidate,
            featuredSide: motionFocus ? 'featured_left' : 'featured_right',
          };
        }

        // 2A/2B: Featured + all wide cards
        if (remainingWide.length >= 4) {
          const variant: DrawerGridLayoutVariant = motionFocus ? '2A' : '2B';
          return {
            variant,
            items: [featuredCandidate, ...remainingWide],
            featuredItem: featuredCandidate,
            featuredSide: motionFocus ? 'featured_left' : 'featured_right',
          };
        }

        // 2C: Featured center (fallback)
        return {
          variant: '2C',
          items: [featuredCandidate, ...remaining],
          featuredItem: featuredCandidate,
          featuredSide: 'featured_right',
        };
      }
    }

    // Option 3: 4 tall posters (when we have enough portraits and browse intent)
    if (tall.length >= 4 && wide.length >= 4) {
      if (browseIntent) {
        // 3A: 2 posters left (rows 1-2) + 2 wide top-right + 2 posters right (rows 2-3) + 2 wide bottom-left
        return {
          variant: '3A',
          items: [tall[0], tall[1], wide[0], wide[1], tall[2], tall[3], wide[2], wide[3]],
        };
      }
      // 3B: Mirror of 3A
      return {
        variant: '3B',
        items: [wide[0], wide[1], tall[0], tall[1], tall[2], tall[3], wide[2], wide[3]],
      };
    }

    // Option 1: 2 posters + wide cards
    if (tall.length >= 2 && wide.length >= 6) {
      // 1A: Full row 3
      return {
        variant: '1A',
        items: [tall[0], tall[1], wide[0], wide[1], wide[2], wide[3], wide[4], wide[5], wide[6], wide[7]].filter(Boolean),
      };
    }

    if (tall.length >= 2 && wide.length >= 4) {
      // 1B: Sparse row 3
      return {
        variant: '1B',
        items: [tall[0], tall[1], wide[0], wide[1], wide[2], wide[3], wide[4], wide[5]].filter(Boolean),
      };
    }

    // Fallback: auto
    return { variant: 'auto', items: [...tall, ...wide] };
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
    const out: KnytContentItem[] = [];
    const add = (item?: KnytContentItem) => {
      if (!item) return;
      if (out.some(o => o.id === item.id)) return;
      if (out.length >= params.maxVisibleItems) return;
      out.push(item);
    };

    const selected = params.selectedItemId
      ? this.uniqueById([
          ...params.byType.print,
          ...params.byType.motion,
          ...params.byType.characters,
          ...params.byType.lore,
          ...params.byType.terra,
        ]).find(i => i.id === params.selectedItemId)
      : undefined;
    add(selected);

    if (out.length < params.maxVisibleItems) {
      add(params.byType.print[0]);
    }

    if (out.length < params.maxVisibleItems) {
      add(params.byType.characters[0]);
    }

    if (out.length < params.maxVisibleItems) {
      add(params.byType.lore[0] || params.byType.terra[0]);
    }

    const motionLimit = params.motionCap ?? params.maxVisibleItems;
    let motionCount = 0;
    for (const item of params.byType.motion) {
      if (out.length >= params.maxVisibleItems) break;
      if (motionCount >= motionLimit) break;
      if (!out.some(o => o.id === item.id)) {
        out.push(item);
        motionCount += 1;
      }
    }

    const fillOrder = [
      params.byType.print,
      params.byType.characters,
      params.byType.terra,
      params.byType.lore,
      params.byType.print,
    ];
    let idx = 0;
    while (out.length < params.maxVisibleItems && idx < 50) {
      idx += 1;
      for (const pool of fillOrder) {
        if (out.length >= params.maxVisibleItems) break;
        const next = pool.find(i => !out.some(o => o.id === i.id));
        add(next);
      }
      if (fillOrder.every(pool => pool.every(i => out.some(o => o.id === i.id)))) {
        break;
      }
    }

    return out.slice(0, params.maxVisibleItems);
  }

  private pickPrimaryItem(params: { preferredIds: string[]; pools: KnytContentItem[][] }): KnytContentItem | undefined {
    for (const id of params.preferredIds) {
      for (const pool of params.pools) {
        const found = pool.find(i => i.id === id);
        if (found) return found;
      }
    }
    for (const pool of params.pools) {
      if (pool.length > 0) return pool[0];
    }
    return undefined;
  }

  private uniqueById(items: KnytContentItem[]): KnytContentItem[] {
    const seen = new Set<string>();
    const out: KnytContentItem[] = [];
    for (const i of items) {
      if (seen.has(i.id)) continue;
      seen.add(i.id);
      out.push(i);
    }
    return out;
  }

  /**
   * Select the best template based on user context
   */
  selectTemplate(context: TemplateSelectionContext): TemplateSelectionResult {
    const { userIntent, device, contentMix, realm, taskState, isFirstVisit } = context;

    // Default result
    let templateId: KnytTemplateId = 'knyt:drawer_grid_v1';
    let reason = 'Default browsing template';

    // First visit - show welcome/quest hub
    if (isFirstVisit) {
      templateId = 'knyt:quest_hud_hub_v1';
      reason = 'First visit - showing quest hub for onboarding';
    }
    // Check template selection rules
    else {
      for (const rule of this.pack.template_selection_policy.rules) {
        let matches = true;

        // Check user_intent
        if (rule.when.user_intent && !rule.when.user_intent.includes(userIntent)) {
          matches = false;
        }

        // Check content_mix
        if (rule.when.content_mix && !rule.when.content_mix.includes(contentMix)) {
          matches = false;
        }

        // Check realm
        if (rule.when.realm && realm && !rule.when.realm.includes(realm)) {
          matches = false;
        }

        // Check task_state
        if (rule.when.task_state && taskState && !rule.when.task_state.includes(taskState)) {
          matches = false;
        }

        if (matches) {
          templateId = rule.choose_template as KnytTemplateId;
          reason = rule.why;
          break;
        }
      }
    }

    // Determine drawer mode and wallet UI
    const { drawerMode, walletUI } = this.selectDrawerMode(userIntent, taskState);

    // Determine copilot overlay mode based on template
    const copilotMode = this.getCopilotModeForTemplate(templateId, device);

    return {
      templateId,
      drawerMode,
      walletUI,
      copilotMode,
      reason,
    };
  }

  /**
   * Select drawer mode based on user intent
   */
  private selectDrawerMode(
    userIntent: UserIntent,
    taskState?: string
  ): { drawerMode: DrawerMode; walletUI: WalletUIComponent[] } {
    // Check drawer rules
    for (const rule of this.pack.template_selection_policy.drawer_rules) {
      let matches = true;

      if (rule.when.user_intent && !rule.when.user_intent.includes(userIntent)) {
        matches = false;
      }

      if (rule.when.task_state && taskState && !rule.when.task_state.includes(taskState)) {
        matches = false;
      }

      if (matches) {
        return {
          drawerMode: rule.choose_drawer_mode as DrawerMode,
          walletUI: rule.mount_wallet_ui as WalletUIComponent[],
        };
      }
    }

    // Default: no drawer
    return { drawerMode: 'none', walletUI: [] };
  }

  /**
   * Get copilot overlay mode for a template
   */
  private getCopilotModeForTemplate(
    templateId: KnytTemplateId,
    device: DeviceType
  ): CopilotOverlayMode {
    const template = this.templates.get(templateId);
    if (!template) return 'overlay';

    const copilotRegion = template.regions.find(r => r.region_id === 'copilot_overlay');
    if (copilotRegion?.default) {
      return copilotRegion.default as CopilotOverlayMode;
    }

    // Mobile defaults to overlay, desktop can dock
    return device === 'mobile' ? 'overlay' : 'docked';
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: KnytTemplateId): KnytTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get all templates
   */
  getAllTemplates(): KnytTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get geometry variant for device
   */
  getGeometryForDevice(templateId: KnytTemplateId, device: DeviceType): GeometryVariant | undefined {
    const template = this.templates.get(templateId);
    if (!template) return undefined;

    return template.geometry_variants.find(v => v.when.device.includes(device));
  }

  /**
   * Get viewer binding for content type
   */
  getViewerForContentType(contentType: KnytContentType): string | undefined {
    const defaults = this.pack.content_type_to_modal_defaults[contentType];
    return defaults?.primary_viewer || defaults?.viewer;
  }

  /**
   * Get card types for content type
   */
  getCardsForContentType(contentType: KnytContentType): string[] {
    const defaults = this.pack.content_type_to_modal_defaults[contentType];
    return defaults?.primary_cards || defaults?.fallback_cards || [];
  }

  /**
   * Get wallet UI catalog
   */
  getWalletUICatalog() {
    return this.pack.wallet_surface.wallet_ui_catalog;
  }

  /**
   * Get drawer dimensions for mode and device
   */
  getDrawerDimensions(mode: DrawerMode, device: DeviceType): { width?: number; height?: number } {
    if (mode === 'none') return {};

    const modeConfig = this.pack.wallet_surface.drawer_modes[mode];
    if (!modeConfig) return {};

    if (device === 'mobile') {
      return { height: modeConfig.mobile_height_norm };
    }
    return { width: modeConfig.desktop_width_norm };
  }

  /**
   * Check if wallet action requires user confirmation
   */
  requiresUserConfirm(action: 'view_content' | 'propose_wallet_action' | 'execute_wallet_action'): boolean {
    return this.pack.wallet_surface.capability_gates[action]?.requires_user_confirm ?? false;
  }

  /**
   * Get modal catalog
   */
  getModalCatalog() {
    return this.pack.modal_catalog;
  }

  /**
   * Get copilot action hooks
   */
  getCopilotActionHooks() {
    return this.pack.copilot_action_hooks;
  }

  /**
   * Infer user intent from content items and interaction
   */
  inferUserIntent(
    contentItems: KnytContentItem[],
    interaction?: string,
    hasActiveTasks?: boolean
  ): UserIntent {
    // Check for explicit interaction
    if (interaction) {
      const intentMap: Record<string, UserIntent> = {
        'watch': 'watch',
        'read': 'page_review',
        'browse': 'browse',
        'discover': 'discover',
        'claim': 'claim',
        'purchase': 'purchase',
        'unlock': 'unlock',
        'invite': 'invite',
        'quest': 'questing',
        'ascend': 'ascension',
      };
      if (intentMap[interaction]) {
        return intentMap[interaction];
      }
    }

    // Check for active tasks
    if (hasActiveTasks) {
      return 'questing';
    }

    // Infer from content mix
    if (contentItems.length === 0) {
      return 'discover';
    }

    const types = contentItems.map(c => c.type);
    const hasMotion = types.includes('motion_comic_landscape');
    const hasPortrait = types.some(t => 
      t === 'comic_page_portrait' || 
      t === 'comic_cover_portrait' || 
      t === 'character_portrait'
    );

    if (hasMotion && !hasPortrait) {
      return 'watch';
    }

    if (hasPortrait && contentItems.length <= 2) {
      return 'character_deep_dive';
    }

    return 'browse';
  }

  /**
   * Infer content mix from content items
   */
  inferContentMix(contentItems: KnytContentItem[]): 'mixed' | 'mostly_portrait' | 'portrait_focus' | 'motion_focus' | 'landscape_focus' {
    if (contentItems.length === 0) return 'mixed';

    const types = contentItems.map(c => c.type);
    const portraitCount = types.filter(t => 
      t === 'comic_page_portrait' || 
      t === 'comic_cover_portrait' || 
      t === 'character_portrait'
    ).length;
    const motionCount = types.filter(t => t === 'motion_comic_landscape').length;

    const total = contentItems.length;
    const portraitRatio = portraitCount / total;
    const motionRatio = motionCount / total;

    if (motionRatio > 0.7) return 'motion_focus';
    if (motionRatio > 0.5) return 'landscape_focus';
    if (portraitRatio > 0.9) return 'portrait_focus';
    if (portraitRatio > 0.6) return 'mostly_portrait';
    return 'mixed';
  }

  /**
   * Get device type from window dimensions
   */
  static getDeviceType(): DeviceType {
    if (typeof window === 'undefined') return 'desktop';
    
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }
}

// Singleton instance
let serviceInstance: KnytLiquidUIService | null = null;

export function getKnytLiquidUIService(): KnytLiquidUIService {
  if (!serviceInstance) {
    serviceInstance = new KnytLiquidUIService();
  }
  return serviceInstance;
}

// ============================================================================
// React Hook for Template Selection
// ============================================================================

export function useKnytTemplateSelection(context: TemplateSelectionContext): TemplateSelectionResult {
  const service = getKnytLiquidUIService();
  return service.selectTemplate(context);
}
