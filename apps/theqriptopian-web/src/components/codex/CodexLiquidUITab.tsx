/**
 * CodexLiquidUITab - Main KNYT Codex Liquid UI Component
 * 
 * This component replaces the current Codex tab content with the Liquid UI system.
 * It uses the KnytLiquidUIService to select templates based on user context and
 * renders content using the KnytTemplateRenderer.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { KnytTemplateRenderer } from './templates/KnytTemplateRenderer';
import { CopilotWalletDrawer } from './wallet/CopilotWalletDrawer';
import { 
  getKnytLiquidUIService, 
  KnytLiquidUIService 
} from '@/services/knytLiquidUIService';
import type {
  KnytTemplateId,
  TemplateSelectionContext,
  TemplateSelectionResult,
  DeviceType,
  DrawerMode,
  WalletUIComponent,
  CopilotOverlayMode,
  KnytContentItem,
  KnytContentType,
  Realm,
  UserIntent,
  DrawerGridLayoutVariant,
} from '@/types/knytLiquidUI';
import { PDFPageViewer } from '../content/PDFPageViewer';
import { PDFLiteReaderModal } from '../content/PDFLiteReaderModal';
import { VideoPlayer } from '@/components/content/VideoPlayer';
import { VideoErrorBoundary } from '@/components/content/VideoErrorBoundary';
import { LoreTextReader } from '@/components/content/LoreTextReader';
import type { ContentModalities } from '@/components/content/SmartContentActions';
import { ContentPurchaseModal, type ContentType } from '@/components/content/ContentPurchaseModal';
import { API_BASE_URL } from '@/config/api';

import issuePackage from '@/data/templates/qriptopian_episode1_issue_package_v1.4.json';

// ============================================================================
// Props Interface
// ============================================================================

interface CodexLiquidUITabProps {
  personaId?: string;
  knytBalance?: number;
  spendableKnyt?: number;
  onBalanceRefresh?: () => void;
  isFirstVisit?: boolean;
  // Copilot integration
  copilotContent?: React.ReactNode;
  onCopilotModeChange?: (mode: CopilotOverlayMode) => void;
  // External navigation
  onNavigateToTab?: (tab: string) => void;
}

interface LoreAssetFromAPI {
  id: string;
  title: string;
  asset_kind: string;
  auto_drive_cid: string;
  episode_number: number | null;
  display_mode: 'pdf' | 'image' | 'video' | 'text_extract' | null;
  extracted_text: string | null;
  created_at: string;
}

// ============================================================================
// Content Data Fetching
// ============================================================================

interface EpisodeFromAPI {
  episodeNumber: number;
  displayNumber: string;
  title?: string;
  priceKnyt?: number;
  coverImageCid?: string;
  coverThumbUrl?: string;
  hasStillMaster: boolean;
  hasMotionMaster: boolean;
  hasPrintRare: boolean;
  hasPrintEpic: boolean;
  hasPrintLegendary: boolean;
  printRareCid?: string;
  printEpicCid?: string;
  printLegendaryCid?: string;
  printRareLiteUrl?: string;
  printEpicLiteUrl?: string;
  printLegendaryLiteUrl?: string;
  motionMasterCid?: string;
  coverCount: number;
  characterCount: number;
}

interface CharacterFromAPI {
  id: string;
  name: string;
  episode_number: number;
  front_cid?: string;
  back_cid?: string;
  rarity?: string;
}

/**
 * Transform API episode data to KnytContentItem format
 */
function transformEpisodesToContentItems(episodes: EpisodeFromAPI[]): KnytContentItem[] {
  const items: KnytContentItem[] = [];
  
  for (const ep of episodes) {
    // Skip episode 0 (placeholder)
    if (ep.episodeNumber === 0) continue;
    
    const printCid = ep.printRareCid || ep.printEpicCid || ep.printLegendaryCid;
    const printLiteUrl = ep.printRareLiteUrl || ep.printEpicLiteUrl || ep.printLegendaryLiteUrl;
    const hasReadable = !!printCid;
    // Hide watch for episodes without compressed video (Episode #0 = ep1, Episode #2 = ep3)
    const hideWatchEpisodes = [1, 3];
    const hasWatchable = ep.hasMotionMaster && !!ep.motionMasterCid && !hideWatchEpisodes.includes(ep.episodeNumber);
    
    // Add as comic page (portrait) if has print
    if (hasReadable) {
      items.push({
        id: `mk_ep${String(ep.episodeNumber).padStart(2, '0')}`,
        type: 'comic_page_portrait',
        title: ep.title || `Episode ${ep.displayNumber}`,
        subtitle: `Episode ${ep.displayNumber}`,
        thumbnail: ep.coverThumbUrl || (ep.coverImageCid ? `${API_BASE_URL}/api/content/cover/${ep.coverImageCid}?variant=thumb` : undefined),
        media: { 
          pdf_cid: printCid,
          pdf_lite_url: printLiteUrl,
        },
        metadata: { 
          episodeNumber: ep.episodeNumber, 
          owned: false, // TODO: Check entitlements
          price: typeof ep.priceKnyt === 'number' && ep.priceKnyt > 0 ? ep.priceKnyt : undefined,
          realm: 'digiterra' 
        },
        modalities: { 
          read: { available: true, cid: printCid },
          watch: hasWatchable ? { available: true, cid: ep.motionMasterCid } : undefined,
        },
      });
    }
    
    // Add motion comic as separate item if available
    if (hasWatchable) {
      items.push({
        id: `mk_ep${String(ep.episodeNumber).padStart(2, '0')}_motion`,
        type: 'motion_comic_landscape',
        title: `${ep.title || `Episode ${ep.displayNumber}`} - Motion Comic`,
        subtitle: 'Motion Comic',
        thumbnail: ep.coverImageCid ? `${API_BASE_URL}/api/content/cover/${ep.coverImageCid}?variant=thumb` : undefined,
        media: { video_cid: ep.motionMasterCid },
        metadata: { 
          episodeNumber: ep.episodeNumber, 
          owned: false, 
          price: typeof ep.priceKnyt === 'number' && ep.priceKnyt > 0 ? ep.priceKnyt : undefined,
          realm: 'digiterra' 
        },
        modalities: { 
          watch: { available: true, cid: ep.motionMasterCid, duration: '~10 min' } 
        },
      });
    }
  }
  
  return items;
}

/**
 * Transform API character data to KnytContentItem format
 */
function transformCharactersToContentItems(characters: CharacterFromAPI[]): KnytContentItem[] {
  return characters.map(char => ({
    id: `char_${char.id}`,
    type: 'character_portrait' as KnytContentType,
    title: char.name,
    subtitle: 'Character Card',
    thumbnail: char.front_cid ? `${API_BASE_URL}/api/content/cover/${char.front_cid}?variant=thumb` : undefined,
    media: { image_cid: char.front_cid },
    metadata: { 
      characterName: char.name, 
      rarity: char.rarity || 'common', 
      owned: false, 
      realm: 'digiterra' as Realm
    },
  }));
}

function transformLoreAssetsToContentItems(assets: LoreAssetFromAPI[]): KnytContentItem[] {
  const synopsis = assets.find((asset) => /synopsis/i.test(asset.title));
  const sagaIntroIndex = assets.findIndex((asset) => /saga intro/i.test(asset.title));
  const curated = synopsis && sagaIntroIndex !== -1
    ? assets.filter((_, index) => index !== sagaIntroIndex)
    : assets;

  return curated.map((asset) => ({
    id: `lore_${asset.id}`,
    type: 'lore_snippet',
    title: asset.title,
    subtitle: asset.asset_kind.replace(/_/g, ' '),
    media: {
      pdf_cid: asset.auto_drive_cid,
      text: asset.extracted_text || undefined,
    },
    metadata: {
      realm: 'terra',
      modalities: asset.extracted_text ? { read: { text: asset.extracted_text } } : undefined,
    },
    modalities: {
      read: { available: true, cid: asset.auto_drive_cid },
    },
  }));
}

// Types for issue package JSON parsing
interface IssuePackageContentItem {
  content_id?: string;
  title?: string;
  slug?: string;
  thumbnail_asset_id?: string;
  content_blocks?: Array<{ type: string; level?: number; text: string }>;
  taxonomy?: { realm?: string };
  render?: { payloads?: { thumbnail?: Array<{ url?: string }> } };
}

interface IssuePackagePlacement {
  content_id?: string;
  section_id?: string;
  tab_id?: string;
  position?: number;
}

interface IssuePackageAsset {
  asset_id?: string;
  url?: string;
}

interface IssuePackage {
  collections?: {
    content_items?: IssuePackageContentItem[];
    placements?: IssuePackagePlacement[];
    assets?: IssuePackageAsset[];
  };
}

function transformIssuePackageMetaKnytsToContentItems(): KnytContentItem[] {
  try {
    const pkg = issuePackage as IssuePackage;
    const items = pkg.collections?.content_items || [];
    const placements = pkg.collections?.placements || [];
    const assets = pkg.collections?.assets || [];

    const contentById = new Map<string, IssuePackageContentItem>();
    for (const it of items) {
      if (it?.content_id) contentById.set(it.content_id, it);
    }
    const assetById = new Map<string, IssuePackageAsset>();
    for (const a of assets) {
      if (a?.asset_id) assetById.set(a.asset_id, a);
    }

    const metaknytsPlacements = placements
      .filter((p) => p?.section_id === 'scrolls' && p?.tab_id === 'metaknyts')
      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));

    const out: KnytContentItem[] = [];
    for (const p of metaknytsPlacements) {
      const c = contentById.get(p.content_id);
      if (!c) continue;

      const thumbUrl =
        c?.render?.payloads?.thumbnail?.[0]?.url || assetById.get(c.thumbnail_asset_id)?.url || undefined;

      const blocks = (c.content_blocks || []) as Array<{ type: string; level?: number; text: string }>;
      const text = blocks
        .filter((b) => b?.text)
        .map((b) => {
          if (b.type === 'heading') return `${'#'.repeat(b.level || 1)} ${b.text}`;
          if (b.type === 'list_item') return `- ${b.text}`;
          return b.text;
        })
        .join('\n\n');

      const realm = (c?.taxonomy?.realm || 'terra') as Realm;

      // Build modalities for SmartContentActions
      const modalities: ContentModalities = {};
      if (text) {
        modalities.read = { text };
      }

      out.push({
        id: `terra_${String(c.content_id || '').replace('content:', '')}`,
        type: 'terra_update',
        title: c.title || c.slug || 'Terra Update',
        subtitle: 'Terra',
        description: c.excerpt || undefined,
        thumbnail: thumbUrl,
        media: {
          text: text || undefined,
        },
        metadata: {
          realm,
          modalities, // Add modalities for SmartTriad
        },
        modalities: {
          read: { available: !!text },
        },
      });
    }
    console.log('[CodexLiquidUI] Transformed', out.length, 'metaKnyts items');
    return out;
  } catch (error) {
    console.error('[CodexLiquidUI] Error transforming metaKnyts:', error);
    return [];
  }
}

/**
 * Fetch content from API
 */
async function fetchCodexContent(): Promise<KnytContentItem[]> {
  const apiBase = API_BASE_URL;
  try {
    // Fetch episodes
    const episodesRes = await fetch(`${apiBase}/api/admin/codex/status?series=metaKnyts`);
    let episodeItems: KnytContentItem[] = [];
    
    if (episodesRes.ok) {
      const data = await episodesRes.json();
      if (data.episodes) {
        episodeItems = transformEpisodesToContentItems(data.episodes);
        console.log('[CodexLiquidUI] Loaded', episodeItems.length, 'episode items');
      }
    }
    
    // Fetch characters
    const charactersRes = await fetch(`${apiBase}/api/codex/knyt-cards`);
    let characterItems: KnytContentItem[] = [];
    
    if (charactersRes.ok) {
      const data = await charactersRes.json();
      if (data.characters) {
        characterItems = transformCharactersToContentItems(data.characters);
        console.log('[CodexLiquidUI] Loaded', characterItems.length, 'character items');
      }
    }

    let loreItems: KnytContentItem[] = [];
    try {
      const loreRes = await fetch(`${apiBase}/api/content/assets?kinds=background_lore_doc,twenty_one_sats_concept`);
      if (loreRes.ok) {
        const data = await loreRes.json();
        if (data.assets) {
          loreItems = transformLoreAssetsToContentItems(data.assets as LoreAssetFromAPI[]);
          console.log('[CodexLiquidUI] Loaded', loreItems.length, 'lore items');
        }
      }
    } catch (err) {
      console.error('[CodexLiquidUI] Failed to load lore assets:', err);
    }

    const terraItems = transformIssuePackageMetaKnytsToContentItems();
    if (terraItems.length > 0) {
      console.log('[CodexLiquidUI] Loaded', terraItems.length, 'Terra/metaKnyts items from issue package');
    }
    
    return [...episodeItems, ...characterItems, ...loreItems, ...terraItems];
  } catch (error) {
    console.error('[CodexLiquidUI] Failed to fetch content:', error);
    return [];
  }
}

/**
 * Get initial task/reward data (placeholder - will be replaced with real API)
 */
function getInitialTaskData() {
  return {
    activeTask: null as { id: string; title: string; progress: number; nextStep: string } | null,
    rewards: [] as Array<{ id: string; amount: number; source: string }>,
    ascensionRank: {
      current: 'Initiate',
      next: 'Acolyte',
      progress: 0,
    },
  };
}

// ============================================================================
// Main Component
// ============================================================================

export default function CodexLiquidUITab({
  personaId,
  knytBalance = 0,
  spendableKnyt,
  onBalanceRefresh,
  isFirstVisit = false,
  copilotContent,
  onCopilotModeChange,
  onNavigateToTab,
}: CodexLiquidUITabProps) {
  const service = useMemo(() => getKnytLiquidUIService(), []);

  // Device detection
  const [device, setDevice] = useState<DeviceType>(() => KnytLiquidUIService.getDeviceType());

  // Template selection state
  const [templateResult, setTemplateResult] = useState<TemplateSelectionResult | null>(null);
  const [userIntent, setUserIntent] = useState<UserIntent>('browse');

  // Content state
  const [contentItems, setContentItems] = useState<KnytContentItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [curatedContent, setCuratedContent] = useState<KnytContentItem[] | null>(null);
  const [layoutVariant, setLayoutVariant] = useState<DrawerGridLayoutVariant>('auto');
  const [ownedEpisodeNumbers, setOwnedEpisodeNumbers] = useState<Set<number>>(new Set());

  // Viewer state
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfLiteViewerOpen, setPdfLiteViewerOpen] = useState(false);
  const [videoViewerOpen, setVideoViewerOpen] = useState(false);
  const [currentPdfCid, setCurrentPdfCid] = useState<string | null>(null);
  const [currentPdfLiteUrl, setCurrentPdfLiteUrl] = useState<string | null>(null);
  const [currentPdfTitle, setCurrentPdfTitle] = useState('');
  const [currentVideoCid, setCurrentVideoCid] = useState<string | null>(null);
  const [currentVideoTitle, setCurrentVideoTitle] = useState('');
  const [textReaderOpen, setTextReaderOpen] = useState(false);
  const [currentText, setCurrentText] = useState<{ title: string; content: string } | null>(null);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseContent, setPurchaseContent] = useState<{
    type: ContentType;
    id: string;
    title: string;
    image?: string;
  } | null>(null);

  // Wallet drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Quest/Task state
  const [taskData, setTaskData] = useState(getInitialTaskData());

  // Realm state
  const [activeRealm, setActiveRealm] = useState<Realm>('digiterra');

  // Copilot mode
  const [copilotMode, setCopilotMode] = useState<CopilotOverlayMode>('overlay');

  // Handle window resize for device detection
  useEffect(() => {
    const handleResize = () => {
      setDevice(KnytLiquidUIService.getDeviceType());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchOwnedEpisodes = useCallback(async () => {
    if (!personaId) {
      setOwnedEpisodeNumbers(new Set());
      return;
    }
    try {
      const apiBase = API_BASE_URL;
      const ownedRes = await fetch(`${apiBase}/api/codex/owned?personaId=${personaId}`);
      if (!ownedRes.ok) return;
      const ownedData = await ownedRes.json();
      const ownedEpisodes = new Set<number>(
        (ownedData.issues || [])
          .map((issue: { episodeNumber?: number }) => issue.episodeNumber)
          .filter((episodeNumber: number | undefined) => typeof episodeNumber === 'number')
      );
      setOwnedEpisodeNumbers(ownedEpisodes);
    } catch (error) {
      console.warn('[CodexLiquidUI] Failed to load owned episodes:', error);
    }
  }, [personaId]);

  useEffect(() => {
    fetchOwnedEpisodes();
  }, [fetchOwnedEpisodes]);

  // Load content from real API
  useEffect(() => {
    async function loadContent() {
      setLoading(true);
      try {
        const items = await fetchCodexContent();
        setContentItems(items);
        console.log('[CodexLiquidUI] Total content items loaded:', items.length);
      } catch (error) {
        console.error('[CodexLiquidUI] Failed to load content:', error);
      } finally {
        setLoading(false);
      }
    }
    loadContent();
  }, []);

  const contentWithOwnership = useMemo(() => {
    return contentItems.map((item) => {
      const episodeNumber = item.metadata?.episodeNumber;
      if (typeof episodeNumber !== 'number') return item;
      return {
        ...item,
        metadata: {
          ...item.metadata,
          owned: ownedEpisodeNumbers.has(episodeNumber),
        },
      };
    });
  }, [contentItems, ownedEpisodeNumbers]);

  // Select template based on context
  useEffect(() => {
    if (loading) return;

    const contentMix = service.inferContentMix(contentWithOwnership);
    const hasActiveTasks = !!taskData.activeTask;

    const context: TemplateSelectionContext = {
      userIntent,
      device,
      contentMix,
      realm: activeRealm,
      taskState: hasActiveTasks ? 'active' : 'idle',
      isFirstVisit,
      personaId,
    };

    const result = service.selectTemplate(context);
    setTemplateResult(result);

    const composed = service.composeScreen({
      templateId: result.templateId,
      context,
      contentItems: contentWithOwnership,
      selectedItemId,
    });

    if (composed) {
      const drawerRegion = composed.regions?.drawer_grid;
    if (result.templateId === 'knyt:drawer_grid_v1' && drawerRegion?.items?.length) {
        setCuratedContent(drawerRegion.items);
        // Set layout variant from composition
        if (composed.meta?.drawerGridLayoutVariant) {
          setLayoutVariant(composed.meta.drawerGridLayoutVariant);
        }
      } else {
        const regionIds = Object.keys(composed.regions);
        const combined: KnytContentItem[] = [];
        for (const regionId of regionIds) {
          const r = composed.regions[regionId];
          if (!r?.items?.length) continue;
          for (const it of r.items) {
            if (!combined.some((x) => x.id === it.id)) combined.push(it);
          }
        }
        setCuratedContent(combined);
      }
    } else {
      setCuratedContent(null);
    }

    // Update copilot mode
    if (result.copilotMode !== copilotMode) {
      setCopilotMode(result.copilotMode);
      onCopilotModeChange?.(result.copilotMode);
    }
  }, [loading, contentWithOwnership, userIntent, device, activeRealm, isFirstVisit, personaId, taskData, service, selectedItemId]);

  const isEpisodeLocked = useCallback((item: KnytContentItem) => {
    const episodeNumber = item.metadata?.episodeNumber;
    if (typeof episodeNumber !== 'number') return false;
    return !item.metadata?.owned;
  }, []);

  const openPurchaseForItem = useCallback((item: KnytContentItem, action: 'read' | 'watch' | 'default' = 'default') => {
    const episodeNumber = item.metadata?.episodeNumber;
    if (typeof episodeNumber !== 'number') return;
    const contentType: ContentType =
      action === 'watch' || item.type === 'motion_comic_landscape'
        ? 'scroll_motion'
        : 'scroll_still';
    setPurchaseContent({
      type: contentType,
      id: item.id.replace(/_motion$/, ''),
      title: item.title,
      image: item.thumbnail,
    });
    setPurchaseModalOpen(true);
  }, []);

  // Handle content selection
  const handleContentSelect = useCallback((item: KnytContentItem) => {
    setSelectedItemId(item.id);

    if (item.media?.text && !item.media?.pdf_cid && !item.media?.video_cid) {
      setCurrentText({ title: item.title, content: item.media.text });
      setTextReaderOpen(true);
    }

    // Update user intent based on content type
    if (item.type === 'motion_comic_landscape') {
      setUserIntent('watch');
    } else if (item.type === 'character_portrait') {
      setUserIntent('character_deep_dive');
    } else if (item.type === 'comic_cover_portrait' || item.type === 'comic_page_portrait') {
      setUserIntent('page_review');
    }
  }, []);

  // Handle smart content actions
  const handleSmartAction = useCallback((item: KnytContentItem, action: string) => {
    if ((action === 'read' || action === 'watch') && isEpisodeLocked(item)) {
      openPurchaseForItem(item, action === 'watch' ? 'watch' : 'read');
      return;
    }
    if (action === 'read' && item.media?.text) {
      setCurrentText({ title: item.title, content: item.media.text });
      setTextReaderOpen(true);
    } else if (action === 'watch' && item.media?.video_cid) {
      setCurrentVideoCid(item.media.video_cid);
      setCurrentVideoTitle(item.title);
      setVideoViewerOpen(true);
    }
  }, []);

  // Handle viewer open
  const handleViewerOpen = useCallback((item: KnytContentItem, type: 'pdf' | 'video' | 'poster') => {
    if (isEpisodeLocked(item)) {
      openPurchaseForItem(item, type === 'video' ? 'watch' : 'read');
      return;
    }
    if (type === 'pdf' && item.type === 'lore_snippet' && item.media?.text) {
      setCurrentText({ title: item.title, content: item.media.text });
      setTextReaderOpen(true);
      return;
    }
    if (type === 'pdf' && (item.media?.pdf_lite_url || item.media?.pdf_cid)) {
      console.log('[CodexLiquidUITab] Opening PDF viewer:', {
        pdf_lite_url: item.media.pdf_lite_url,
        pdf_cid: item.media.pdf_cid,
        title: item.title
      });
      setCurrentPdfLiteUrl(item.media.pdf_lite_url || null);
      setCurrentPdfCid(item.media.pdf_cid || null);
      setCurrentPdfTitle(item.title);
      setPdfViewerOpen(true);
    } else if (type === 'video' && item.media?.video_cid) {
      setCurrentVideoCid(item.media.video_cid);
      setCurrentVideoTitle(item.title);
      setVideoViewerOpen(true);
    }
  }, [isEpisodeLocked, openPurchaseForItem]);

  // Handle copilot mode change
  const handleCopilotModeChange = useCallback((mode: CopilotOverlayMode) => {
    setCopilotMode(mode);
    onCopilotModeChange?.(mode);
  }, [onCopilotModeChange]);

  // Handle drawer toggle
  const handleDrawerToggle = useCallback((open: boolean) => {
    setDrawerOpen(open);
  }, []);

  // Handle realm change
  const handleRealmChange = useCallback((realm: Realm) => {
    setActiveRealm(realm);
    setUserIntent('realm_navigation');
  }, []);

  // Handle reward claim
  const handleClaimReward = useCallback((rewardId: string) => {
    console.log('[CodexLiquidUI] Claiming reward:', rewardId);
    // TODO: Implement reward claim
    setTaskData(prev => ({
      ...prev,
      rewards: prev.rewards.filter(r => r.id !== rewardId),
    }));
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <span className="ml-3 text-white/70">Loading Codex...</span>
      </div>
    );
  }

  // No template selected
  if (!templateResult) {
    return (
      <div className="h-full flex items-center justify-center text-white/60">
        <p>Initializing template system...</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      {/* Main Template Renderer */}
        <KnytTemplateRenderer
          templateId={templateResult.templateId}
          device={device}
          contentItems={curatedContent || contentWithOwnership}
          userIntent={userIntent}
        copilotMode={copilotMode}
        onCopilotModeChange={handleCopilotModeChange}
        copilotContent={copilotContent}
        drawerMode={templateResult.drawerMode}
        drawerOpen={drawerOpen}
        walletUI={templateResult.walletUI}
          onDrawerToggle={handleDrawerToggle}
          onContentSelect={handleContentSelect}
          onViewerOpen={handleViewerOpen}
          onSmartAction={handleSmartAction}
          selectedItemId={selectedItemId}
        activeTask={taskData.activeTask}
        rewards={taskData.rewards}
        ascensionRank={taskData.ascensionRank}
        activeRealm={activeRealm}
        onRealmChange={handleRealmChange}
        knytBalance={knytBalance}
        layoutVariant={layoutVariant}
        walletDrawerContent={
          <CopilotWalletDrawer
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            mode={templateResult.drawerMode}
            walletUI={templateResult.walletUI}
            device={device}
            balance={knytBalance}
            spendableBalance={spendableKnyt}
            pendingRewards={taskData.rewards}
            activeTask={taskData.activeTask}
            onClaimReward={handleClaimReward}
          />
        }
      />

      {/* PDF Viewer Modal - prefer pdf_lite_url, fallback to CID-based page viewer */}
      {pdfViewerOpen && currentPdfLiteUrl && (
        <>
          {console.log('[CodexLiquidUITab] Rendering PDFLiteReaderModal with URL:', currentPdfLiteUrl)}
          <PDFLiteReaderModal
            open={pdfViewerOpen}
            pdfUrl={currentPdfLiteUrl}
            title={currentPdfTitle}
            onClose={() => {
              setPdfViewerOpen(false);
              setCurrentPdfLiteUrl(null);
              setCurrentPdfCid(null);
            }}
          />
        </>
      )}
      {pdfViewerOpen && !currentPdfLiteUrl && currentPdfCid && (
        <>
          {console.log('[CodexLiquidUITab] Rendering PDFPageViewer with CID:', currentPdfCid, 'pdfLiteUrl:', currentPdfLiteUrl)}
          <PDFPageViewer
            cid={currentPdfCid}
            title={currentPdfTitle}
            pdfLiteUrl={currentPdfLiteUrl}
            onClose={() => {
              setPdfViewerOpen(false);
              setCurrentPdfCid(null);
            }}
          />
        </>
      )}

      {/* Video Player Modal */}
      {videoViewerOpen && currentVideoCid && (
        <VideoErrorBoundary onClose={() => {
          setVideoViewerOpen(false);
          setCurrentVideoCid(null);
        }}>
          <VideoPlayer
            videoUrl={`/api/content/video/${currentVideoCid}`}
            title={currentVideoTitle}
            onClose={() => {
              setVideoViewerOpen(false);
              setCurrentVideoCid(null);
            }}
          />
        </VideoErrorBoundary>
      )}

      {textReaderOpen && currentText && (
        <LoreTextReader
          title={currentText.title}
          content={currentText.content}
          onClose={() => {
            setTextReaderOpen(false);
            setCurrentText(null);
          }}
        />
      )}

      {/* Content Purchase Modal */}
      {purchaseContent && (
        <ContentPurchaseModal
          open={purchaseModalOpen}
          onClose={() => {
            setPurchaseModalOpen(false);
            setPurchaseContent(null);
          }}
          personaId={personaId}
          contentType={purchaseContent.type}
          contentId={purchaseContent.id}
          contentTitle={purchaseContent.title}
          contentImage={purchaseContent.image}
          knytBalance={knytBalance}
          spendableKnyt={spendableKnyt}
          onPurchaseComplete={() => {
            setPurchaseModalOpen(false);
            setPurchaseContent(null);
            fetchOwnedEpisodes();
          }}
          onBalanceRefresh={onBalanceRefresh}
        />
      )}

      {/* Template Debug Info (development only) */}
      {import.meta.env.DEV && (
        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/80 rounded text-xs text-white/60 z-50">
          Template: {templateResult.templateId} | Intent: {userIntent} | Drawer: {templateResult.drawerMode}
        </div>
      )}
    </div>
  );
}

// Also export as named export for compatibility with cached imports
export { CodexLiquidUITab };
