/**
 * KNYT Liquid UI Service
 * 
 * Ported from Qriptopian Web App with SmartTriad integration
 * Maintains Liquid UI template selection and device detection
 */

import type {
  TemplateSelectionContext,
  TemplateSelectionResult,
  KnytTemplateId,
  DeviceType,
  DrawerMode,
  WalletUIComponent,
  CopilotOverlayMode,
  UserIntent,
  Realm,
  ContentMix,
  KnytContentItem,
  TemplateComposition,
  DrawerGridLayoutVariant,
} from '@/app/types/knytLiquidUI';

export class KnytLiquidUIService {
  selectTemplate(context: TemplateSelectionContext): TemplateSelectionResult {
    const { userIntent, device, contentMix, realm, taskState, isFirstVisit, personaId } = context;
    
    let templateId: KnytTemplateId = 'knyt:drawer_grid_v1';
    let drawerMode: DrawerMode = 'narrow';
    let walletUI: WalletUIComponent[] = ['wallet_card.balance'];
    let copilotMode: CopilotOverlayMode = 'overlay';

    // Template selection logic based on user intent and content
    switch (userIntent) {
      case 'browse':
      case 'collectible_display':
        templateId = 'knyt:drawer_grid_v1';
        drawerMode = device === 'mobile' ? 'full' : 'wide';
        walletUI = ['wallet_card.balance', 'wallet_card.reward_claim', 'wallet_card.quick_actions'];
        break;
      
      case 'watch':
      case 'motion_comics':
      case 'immersive_review':
        templateId = 'knyt:episode_reader_v1';
        drawerMode = 'narrow';
        walletUI = ['wallet_card.balance'];
        copilotMode = 'sidebar';
        break;
      
      case 'character_deep_dive':
        templateId = 'knyt:character_detail_v1';
        drawerMode = 'narrow';
        walletUI = ['wallet_card.balance'];
        break;
      
      case 'read':
      case 'page_review':
      case 'cover_art':
        templateId = 'knyt:lore_browser_v1';
        drawerMode = 'wide';
        walletUI = ['wallet_card.balance', 'wallet_card.reward_claim'];
        break;
      
      case 'realm_navigation':
        templateId = 'knyt:realm_portal_v1';
        drawerMode = 'wide';
        walletUI = ['wallet_card.balance', 'wallet_card.quick_actions'];
        break;
      
      default:
        templateId = 'knyt:drawer_grid_v1';
        drawerMode = 'narrow';
        walletUI = ['wallet_card.balance'];
    }

    // Adjust for device
    if (device === 'mobile') {
      drawerMode = drawerMode === 'full' ? 'full' : 'narrow';
      copilotMode = 'minimal';
    } else if (device === 'tablet') {
      copilotMode = 'sidebar';
    }

    // Adjust for active tasks
    if (taskState === 'active') {
      walletUI.push('wallet_card.reward_claim');
    }

    return {
      templateId,
      drawerMode,
      walletUI,
      copilotMode,
    };
  }

  getDrawerDimensions(mode: DrawerMode, device: DeviceType): { width: number; height: number } {
    switch (mode) {
      case 'narrow':
        return device === 'mobile' 
          ? { width: 1, height: 0.28 }
          : { width: 0.22, height: 0.8 };
      
      case 'wide':
        return device === 'mobile'
          ? { width: 1, height: 0.4 }
          : { width: 0.32, height: 0.8 };
      
      case 'full':
        return { width: 1, height: 1 };
      
      default:
        return { width: 0, height: 0 };
    }
  }

  detectDevice(): DeviceType {
    if (typeof window === 'undefined') return 'desktop';
    
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  analyzeContentMix(contentItems: any[]): ContentMix {
    const hasEpisodes = contentItems.some(item => 
      item.type === 'comic_page_portrait' || item.type === 'motion_comic_landscape'
    );
    const hasCharacters = contentItems.some(item => 
      item.type === 'character_portrait'
    );
    const hasLore = contentItems.some(item => 
      item.type === 'lore_snippet' || item.type === 'terra_update'
    );
    const hasMetaKnyts = contentItems.some(item => 
      item.type === 'comic_cover_portrait'
    );

    const ownedCount = contentItems.filter(item => item.metadata?.owned).length;

    return {
      hasEpisodes,
      hasCharacters,
      hasLore,
      hasMetaKnyts,
      totalItems: contentItems.length,
      ownedCount,
    };
  }

  getDeviceType(): DeviceType {
    return this.detectDevice();
  }

  inferContentMix(contentItems: KnytContentItem[]): ContentMix {
    return this.analyzeContentMix(contentItems);
  }

  composeScreen({
    templateId,
    context,
    contentItems,
  }: {
    templateId: KnytTemplateId;
    context: TemplateSelectionContext;
    contentItems: KnytContentItem[];
    selectedItemId?: string;
  }): TemplateComposition {
    const layoutVariant: DrawerGridLayoutVariant = 'auto';

    return {
      templateId,
      context,
      regions: {
        drawer_grid: {
          id: 'drawer_grid',
          type: 'drawer_grid',
          items: contentItems,
          layout: {
            gridCols: context.device === 'mobile' ? 1 : 3,
            aspectRatio: '16/9',
          },
        },
      },
      meta: {
        drawerGridLayoutVariant: layoutVariant,
      },
    };
  }

  static getDeviceType(): DeviceType {
    return getKnytLiquidUIService().getDeviceType();
  }

  static inferContentMix(contentItems: KnytContentItem[]): ContentMix {
    return getKnytLiquidUIService().inferContentMix(contentItems);
  }

  static composeScreen(args: {
    templateId: KnytTemplateId;
    context: TemplateSelectionContext;
    contentItems: KnytContentItem[];
    selectedItemId?: string;
  }): TemplateComposition {
    return getKnytLiquidUIService().composeScreen(args);
  }

  // Legacy compatibility
  getLovableIntegrationData() {
    return {
      apiEndpoints: [
        '/api/codex/knyt-cards',
        '/api/wallet/knyt/balance',
        '/api/wallet/knyt/purchase',
      ],
      webhookUrls: [
        '/api/webhooks/lovable/knyt-purchase',
      ],
      intentMappings: {
        'browse': 'knyt:drawer_grid_v1',
        'watch': 'knyt:episode_reader_v1',
        'read': 'knyt:lore_browser_v1',
      },
    };
  }

  getAllTemplates() {
    return [
      {
        template_id: 'knyt:drawer_grid_v1',
        name: 'KNYT Drawer Grid',
        description: 'Grid-based content browser with wallet integration',
        category: 'knyt',
        geometry: 'drawer',
        device_support: ['desktop', 'tablet', 'mobile'],
        intent_triggers: ['browse', 'collectible_display'],
        ui_components: ['wallet_card.balance', 'wallet_card.reward_claim'],
        liquid_template: 'knyt-drawer-grid-template',
        fallback_react: 'KnytTab',
      },
      {
        template_id: 'knyt:character_detail_v1',
        name: 'KNYT Character Detail',
        description: 'Detailed character card viewer',
        category: 'knyt',
        geometry: 'modal',
        device_support: ['desktop', 'tablet', 'mobile'],
        intent_triggers: ['character_deep_dive'],
        ui_components: ['wallet_card.balance'],
        liquid_template: 'knyt-character-template',
        fallback_react: 'KnytTab',
      },
    ];
  }
}

// Singleton instance
let instance: KnytLiquidUIService | null = null;

export function getKnytLiquidUIService(): KnytLiquidUIService {
  if (!instance) {
    instance = new KnytLiquidUIService();
  }
  return instance;
}

// Legacy export for compatibility
export const knytLiquidUIService = getKnytLiquidUIService();
