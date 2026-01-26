/**
 * SmartTriad-Aware KnytTab Component
 * 
 * Complete port of Qriptopian CodexLiquidUITab functionality integrated with SmartTriad system.
 * Maintains all Liquid UI templates, content viewers, and Co-Pilot integration while
 * leveraging SmartTriadProvider for coordinated state management.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, BookOpen, Play, Lock, Check, Sparkles, Coins, ShoppingCart, AlertTriangle, RefreshCw, LogIn, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useKnytBalance } from "@/app/hooks/useKnytBalance";
import { useKnytCards } from "@/app/hooks/useKnytCards";
import { useKnytPurchases } from "@/app/hooks/useKnytPurchases";
import { useSmartTriad } from "@/app/components/content/SmartTriadProvider";
import type { KnytCardAsset, EpisodeGroup } from "@/app/hooks/useKnytCards";

// Liquid UI imports from Qriptopian
import KnytTemplateRenderer from "@/app/triad/components/codex/templates/KnytTemplateRenderer";
import { CopilotWalletDrawer } from "@/app/triad/components/codex/wallet/CopilotWalletDrawer";
import { getKnytLiquidUIService } from "@/app/services/knyt/knytLiquidUIService";
import { getCachedOrFetch, setCachedValue, getCachedValue } from "../cache";
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
} from "@/app/types/knytLiquidUI";

// Content viewers
import { PDFPageViewer } from "@/app/triad/components/content/PDFPageViewer";
import { PDFLiteReaderModal } from "@/app/triad/components/content/PDFLiteReaderModal";
import { VideoPlayer } from "@/app/triad/components/content/VideoPlayer";
import { VideoErrorBoundary } from "@/app/triad/components/content/VideoErrorBoundary";
import { LoreTextReader } from "@/app/triad/components/content/LoreTextReader";
import { ContentPurchaseModal, type ContentType } from "@/app/triad/components/content/ContentPurchaseModal";

// API and data
import { API_BASE_URL } from "@/app/config/api";
import issuePackage from "@/app/data/templates/qriptopian_episode1_issue_package_v1.4.json";

interface KnytTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  personaId?: string;
  issueSlug?: string;
}

// Types for content transformation (ported from Qriptopian)
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

interface EpisodeFromAPI {
  episodeNumber: number;
  displayNumber: string;
  title?: string;
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

export function KnytTab({ theme = 'dark', density = 'wide', personaId }: KnytTabProps) {
  // SmartTriad integration
  const { state: triadState, actions: triadActions } = useSmartTriad();
  
  // Legacy state for cards/purchases (maintained for compatibility)
  const [activeTab, setActiveTab] = useState("codex");
  const [selectedCard, setSelectedCard] = useState<{ poster: KnytCardAsset; sheet?: KnytCardAsset } | null>(null);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [loadingPurchase, setLoadingPurchase] = useState(false);
  
  // Liquid UI state (ported from CodexLiquidUITab)
  const service = useMemo(() => getKnytLiquidUIService(), []);
  const [device, setDevice] = useState<DeviceType>(() => service.detectDevice());
  const [templateResult, setTemplateResult] = useState<TemplateSelectionResult | null>(null);
  const [userIntent, setUserIntent] = useState<UserIntent>('browse');
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
  const [purchaseContent, setPurchaseContent] = useState<{
    type: ContentType;
    id: string;
    title: string;
    image?: string;
  } | null>(null);
  
  // Wallet drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Quest/Task state
  const [taskData, setTaskData] = useState({
    activeTask: null as { id: string; title: string; progress: number; nextStep: string } | null,
    rewards: [] as Array<{ id: string; amount: number; source: string }>,
    ascensionRank: {
      current: 'Initiate',
      next: 'Acolyte',
      progress: 0,
    },
  });
  
  // Realm state
  const [activeRealm, setActiveRealm] = useState<Realm>('digiterra');
  
  // Copilot mode
  const [copilotMode, setCopilotMode] = useState<CopilotOverlayMode>('overlay');
  
  const { toast } = useToast();
  
  // KNYT balance and cards data
  const { balance, spendableBalance, refreshBalance } = useKnytBalance(personaId);
  const { groups, loading: cardsLoading, error: cardsError, refreshCards } = useKnytCards();
  const { ownedCharacters, refreshPurchases } = useKnytPurchases(personaId);

  // Content transformation functions (ported from CodexLiquidUITab)
  const transformEpisodesToContentItems = useCallback((episodes: EpisodeFromAPI[]): KnytContentItem[] => {
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
            price: hasWatchable ? 5 : 3, 
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
            price: 5, 
            realm: 'digiterra' 
          },
          modalities: { 
            watch: { available: true, cid: ep.motionMasterCid, duration: '~10 min' } 
          },
        });
      }
    }
    
    return items;
  }, []);

  const transformCharactersToContentItems = useCallback((characters: CharacterFromAPI[]): KnytContentItem[] => {
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
        price: 2, 
        realm: 'digiterra' as Realm,
      },
      modalities: {
        read: { available: !!char.front_cid, cid: char.front_cid },
      },
    }));
  }, []);

  const transformLoreAssetsToContentItems = useCallback((assets: LoreAssetFromAPI[]): KnytContentItem[] => {
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
  }, []);

  const transformIssuePackageMetaKnytsToContentItems = useCallback((): KnytContentItem[] => {
    try {
      const pkg = issuePackage as any;
      const items = pkg.collections?.content_items || [];
      const placements = pkg.collections?.placements || [];
      const assets = pkg.collections?.assets || [];

      const contentById = new Map<string, any>();
      for (const it of items) {
        if (it?.content_id) contentById.set(it.content_id, it);
      }
      const assetById = new Map<string, any>();
      for (const a of assets) {
        if (a?.asset_id) assetById.set(a.asset_id, a);
      }

      const metaknytsPlacements = placements
        .filter((p: any) => p?.section_id === 'scrolls' && p?.tab_id === 'metaknyts')
        .sort((a: any, b: any) => (a.position ?? 999) - (b.position ?? 999));

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
          },
          modalities: {
            read: { available: !!text },
          },
        });
      }
      console.log('[KnytTab] Transformed', out.length, 'metaKnyts items');
      return out;
    } catch (error) {
      console.error('[KnytTab] Error transforming metaKnyts:', error);
      return [];
    }
  }, []);

  // Content fetching function (ported from CodexLiquidUITab)
  const fetchCodexContent = useCallback(async (): Promise<KnytContentItem[]> => {
    return getCachedOrFetch<KnytContentItem[]>(
      "codex:knyt:content",
      async () => {
        const apiBase = API_BASE_URL;
        try {
          // Fetch episodes
          const episodesRes = await fetch(`${apiBase}/api/admin/codex/status?series=metaKnyts`);
          let episodeItems: KnytContentItem[] = [];
          
          if (episodesRes.ok) {
            const data = await episodesRes.json();
            if (data.episodes) {
              episodeItems = transformEpisodesToContentItems(data.episodes);
              console.log('[KnytTab] Loaded', episodeItems.length, 'episode items');
            }
          }
          
          // Fetch characters
          const charactersRes = await fetch(`${apiBase}/api/codex/knyt-cards`);
          let characterItems: KnytContentItem[] = [];
          
          if (charactersRes.ok) {
            const data = await charactersRes.json();
            if (data.characters) {
              characterItems = transformCharactersToContentItems(data.characters);
              console.log('[KnytTab] Loaded', characterItems.length, 'character items');
            }
          }

          let loreItems: KnytContentItem[] = [];
          try {
            const loreRes = await fetch(`${apiBase}/api/content/assets?kinds=background_lore_doc,twenty_one_sats_concept`);
            if (loreRes.ok) {
              const data = await loreRes.json();
              if (data.assets) {
                loreItems = transformLoreAssetsToContentItems(data.assets as LoreAssetFromAPI[]);
                console.log('[KnytTab] Loaded', loreItems.length, 'lore items');
              }
            }
          } catch (err) {
            console.error('[KnytTab] Failed to load lore assets:', err);
          }

          const terraItems = transformIssuePackageMetaKnytsToContentItems();
          if (terraItems.length > 0) {
            console.log('[KnytTab] Loaded', terraItems.length, 'Terra/metaKnyts items from issue package');
          }
          
          return [...episodeItems, ...characterItems, ...loreItems, ...terraItems];
        } catch (error) {
          console.error('[KnytTab] Failed to fetch content:', error);
          return [];
        }
      },
      20 * 60 * 1000
    );
  }, [transformEpisodesToContentItems, transformCharactersToContentItems, transformLoreAssetsToContentItems, transformIssuePackageMetaKnytsToContentItems]);

  // Fetch owned episodes
  const fetchOwnedEpisodes = useCallback(async () => {
    if (!personaId) {
      setOwnedEpisodeNumbers(new Set());
      return;
    }
    try {
      const apiBase = API_BASE_URL;
      const cacheKey = `codex:knyt:owned:${personaId}`;
      const cached = getCachedValue<number[]>(cacheKey);
      if (cached) {
        setOwnedEpisodeNumbers(new Set(cached));
        return;
      }
      const ownedRes = await fetch(`${apiBase}/api/codex/owned?personaId=${personaId}`);
      if (!ownedRes.ok) return;
      const ownedData = await ownedRes.json();
      const ownedEpisodesArray = (ownedData.issues || [])
        .map((issue: { episodeNumber?: number }) => issue.episodeNumber)
        .filter((episodeNumber: number | undefined) => typeof episodeNumber === 'number');
      setCachedValue(cacheKey, ownedEpisodesArray, 5 * 60 * 1000);
      setOwnedEpisodeNumbers(new Set(ownedEpisodesArray));
    } catch (error) {
      console.warn('[KnytTab] Failed to load owned episodes:', error);
    }
  }, [personaId]);

  // Handle window resize for device detection
  useEffect(() => {
    const handleResize = () => {
      setDevice(service.detectDevice());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [service]);

  // Load content from real API
  useEffect(() => {
    async function loadContent() {
      setLoading(true);
      try {
        const items = await fetchCodexContent();
        setContentItems(items);
        console.log('[KnytTab] Total content items loaded:', items.length);
      } catch (error) {
        console.error('[KnytTab] Failed to load content:', error);
      } finally {
        setLoading(false);
      }
    }
    loadContent();
  }, [fetchCodexContent]);

  useEffect(() => {
    fetchOwnedEpisodes();
  }, [fetchOwnedEpisodes]);

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
      isFirstVisit: false,
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
    }
  }, [loading, contentWithOwnership, userIntent, device, activeRealm, personaId, taskData, service, selectedItemId]);

  // Computed values for legacy cards
  const isOwned = useCallback((characterName: string) => {
    return ownedCharacters.has(characterName);
  }, [ownedCharacters]);

  const getCardPrice = useCallback((assetKind: 'character_poster' | 'powers_sheet') => {
    // Phase 1 Pricing Constants
    const CARD_PRICE_STILL = 2;  // 2 KNYT for character card (still)
    const CARD_PRICE_MOTION = 4; // 4 KNYT for character card (motion)
    
    return assetKind === 'character_poster' ? CARD_PRICE_STILL : CARD_PRICE_MOTION;
  }, []);

  const canAfford = useCallback((assetKind: 'character_poster' | 'powers_sheet') => {
    const price = getCardPrice(assetKind);
    return (spendableBalance || 0) >= price;
  }, [spendableBalance, getCardPrice]);

  // Event handlers for Liquid UI content
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
  }, [isEpisodeLocked, openPurchaseForItem]);

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
      console.log('[KnytTab] Opening PDF viewer:', {
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

  const handleCopilotModeChange = useCallback((mode: CopilotOverlayMode) => {
    setCopilotMode(mode);
  }, []);

  const handleDrawerToggle = useCallback((open: boolean) => {
    setDrawerOpen(open);
  }, []);

  const handleRealmChange = useCallback((realm: Realm) => {
    setActiveRealm(realm);
    setUserIntent('realm_navigation');
  }, []);

  const handleClaimReward = useCallback((rewardId: string) => {
    console.log('[KnytTab] Claiming reward:', rewardId);
    // TODO: Implement reward claim
    setTaskData(prev => ({
      ...prev,
      rewards: prev.rewards.filter(r => r.id !== rewardId),
    }));
  }, []);

  // Purchase handlers
  const handlePurchaseWithKnyt = async (asset: KnytCardAsset) => {
    if (!personaId) {
      toast({
        title: "Authentication Required",
        description: "Please connect your wallet to purchase KNYT cards",
        variant: "destructive",
      });
      return;
    }

    setLoadingPurchase(true);
    try {
      const response = await fetch('/api/codex/knyt-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personaId,
          assetId: asset.id,
          assetKind: asset.assetKind,
          characterName: asset.characterName,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Purchase Successful!",
          description: `You've purchased ${asset.title} for ${getCardPrice(asset.assetKind)} KNYT`,
        });
        
        // Refresh all data
        await Promise.all([
          refreshBalance(),
          refreshPurchases(),
          refreshCards(),
        ]);
      } else {
        toast({
          title: "Purchase Failed",
          description: result.error || "Failed to complete purchase",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Purchase Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoadingPurchase(false);
      setPurchaseModalOpen(false);
    }
  };

  const handlePurchaseWithPaypal = async (asset: KnytCardAsset) => {
    if (!personaId) {
      toast({
        title: "Authentication Required",
        description: "Please connect your wallet to purchase KNYT cards",
        variant: "destructive",
      });
      return;
    }

    setLoadingPurchase(true);
    try {
      const response = await fetch('/api/wallet/knyt/purchase/paypal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personaId,
          assetId: asset.id,
          assetKind: asset.assetKind,
          paymentMethod: 'paypal',
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "PayPal Purchase Initiated",
          description: "Redirecting to PayPal for payment...",
        });
        
        // Redirect to PayPal if URL provided
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
        }
      } else {
        toast({
          title: "PayPal Purchase Failed",
          description: result.error || "Failed to initiate PayPal purchase",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "PayPal Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoadingPurchase(false);
      setPurchaseModalOpen(false);
    }
  };

  // Loading state for Liquid UI
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

  // Legacy cards loading/error states
  if (cardsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-400" />
          <p className="text-white/60">Loading KNYT Cards...</p>
        </div>
      </div>
    );
  }

  if (cardsError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-8 h-8 mx-auto text-red-400" />
          <p className="text-red-400">Failed to load KNYT Cards</p>
          <Button onClick={refreshCards} variant="outline" className="bg-white/5 border-white/10">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full w-full ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
      {/* Main Liquid UI Template Renderer */}
      <div className="h-full w-full overflow-hidden">
        <KnytTemplateRenderer
          templateId={templateResult.templateId}
          device={device}
          contentItems={curatedContent || contentWithOwnership}
          userIntent={userIntent}
          copilotMode={copilotMode}
          onCopilotModeChange={handleCopilotModeChange}
          copilotContent={null}
          drawerMode={templateResult.drawerMode}
          drawerOpen={drawerOpen}
          walletUI={templateResult.walletUI}
          onDrawerToggle={handleDrawerToggle}
          onContentSelect={handleContentSelect}
          onViewerOpen={handleViewerOpen}
          onSmartAction={handleSmartAction}
          selectedItemId={selectedItemId}
          activeTask={taskData.activeTask || undefined}
          rewards={taskData.rewards}
          ascensionRank={taskData.ascensionRank}
          activeRealm={activeRealm}
          onRealmChange={handleRealmChange}
          knytBalance={balance?.dvnKnyt || 0}
          layoutVariant={layoutVariant}
          walletDrawerContent={
            <CopilotWalletDrawer
              isOpen={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              mode={templateResult.drawerMode}
              walletUI={templateResult.walletUI}
              device={device}
              balance={balance?.dvnKnyt || 0}
              spendableBalance={spendableBalance || 0}
              pendingRewards={taskData.rewards}
              activeTask={taskData.activeTask || undefined}
              onClaimReward={handleClaimReward}
            />
          }
        />
      </div>

      {/* Legacy fallback tabs for compatibility */}
      {activeTab !== 'codex' && (
        <div className="p-6 space-y-6">
          {/* Header with balance */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">KNYT Codex</h2>
              <p className="text-white/60">Collect character cards and unlock exclusive content</p>
            </div>
            <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-purple-400" />
                  <div>
                    <div className="text-lg font-bold text-white">{balance?.dvnKnyt || 0}</div>
                    <div className="text-xs text-white/60">KNYT Balance</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white/5 border-white/10">
              <TabsTrigger value="codex" className="text-white/80 data-[state=active]:text-white">
                <BookOpen className="w-4 h-4 mr-2" />
                Codex
              </TabsTrigger>
              <TabsTrigger value="cards" className="text-white/80 data-[state=active]:text-white">
                <Sparkles className="w-4 h-4 mr-2" />
                Cards
              </TabsTrigger>
              <TabsTrigger value="purchases" className="text-white/80 data-[state=active]:text-white">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Purchases
              </TabsTrigger>
            </TabsList>

            {/* Cards Tab - Legacy fallback */}
            <TabsContent value="cards" className="space-y-4">
              {groups.map((group) => (
                <Card key={group.episodeNumber} className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
                  <CardHeader>
                    <CardTitle className="text-white">
                      Episode {group.displayNumber}
                    </CardTitle>
                    <CardDescription className="text-white/60">
                      Character cards and powers sheets
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Character Posters */}
                      {group.posters.map((poster) => (
                        <Card key={poster.id} className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0 overflow-hidden">
                          <div className="aspect-square relative bg-slate-800/50">
                            <img
                              src={`https://autonomys-ipfs.com/ipfs/${poster.autoDriveCid}`}
                              alt={poster.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = '/api/placeholder/300/300';
                              }}
                            />
                            {isOwned(poster.characterName || '') && (
                              <div className="absolute top-2 right-2">
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                  <Check className="w-3 h-3 mr-1" />
                                  Owned
                                </Badge>
                              </div>
                            )}
                          </div>
                          <CardContent className="p-4">
                            <h3 className="font-semibold text-white mb-1">{poster.characterName}</h3>
                            <p className="text-sm text-white/60 mb-3">{poster.affiliation}</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <Coins className="w-4 h-4 text-purple-400" />
                                <span className="text-sm font-medium text-white">
                                  {getCardPrice('character_poster')} KNYT
                                </span>
                              </div>
                              {isOwned(poster.characterName || '') ? (
                                <Button size="sm" disabled className="bg-emerald-500/20 text-emerald-400">
                                  <Check className="w-4 h-4 mr-1" />
                                  Owned
                                </Button>
                              ) : canAfford('character_poster') ? (
                                <Button 
                                  size="sm" 
                                  onClick={() => handlePurchaseWithKnyt(poster)}
                                  disabled={loadingPurchase}
                                  className="bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30"
                                >
                                  <Coins className="w-4 h-4 mr-1" />
                                  Buy
                                </Button>
                              ) : (
                                <Button 
                                  size="sm" 
                                  onClick={() => handlePurchaseWithPaypal(poster)}
                                  disabled={loadingPurchase}
                                  className="bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30"
                                >
                                  <ShoppingCart className="w-4 h-4 mr-1" />
                                  PayPal
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Purchases Tab - Legacy fallback */}
            <TabsContent value="purchases" className="space-y-4">
              <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-purple-400" />
                    Your Purchases
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    KNYT cards and content you've purchased
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ownedCharacters.size > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array.from(ownedCharacters).map((characterName) => (
                        <Card key={characterName} className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <UserPlus className="w-6 h-6 text-purple-400" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-white">{characterName}</h3>
                                <p className="text-sm text-white/60">Character Card</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 space-y-4">
                      <ShoppingCart className="w-12 h-12 mx-auto text-white/40" />
                      <h3 className="text-lg font-semibold text-white">No Purchases Yet</h3>
                      <p className="text-white/60">Start collecting KNYT cards to build your collection!</p>
                      <Button onClick={() => setActiveTab('cards')} className="bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30">
                        Browse Cards
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* PDF Viewer Modal - prefer pdf_lite_url, fallback to CID-based page viewer */}
      {pdfViewerOpen && currentPdfLiteUrl && (
        <>
          {console.log('[KnytTab] Rendering PDFLiteReaderModal with URL:', currentPdfLiteUrl)}
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
          {console.log('[KnytTab] Rendering PDFPageViewer with CID:', currentPdfCid, 'pdfLiteUrl:', currentPdfLiteUrl)}
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

      {/* Text Reader Modal */}
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
          knytBalance={balance?.dvnKnyt || 0}
          spendableKnyt={spendableBalance || 0}
          onPurchaseComplete={() => {
            setPurchaseModalOpen(false);
            setPurchaseContent(null);
            fetchOwnedEpisodes();
          }}
          onBalanceRefresh={refreshBalance}
        />
      )}

      {/* Template Debug Info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/80 rounded text-xs text-white/60 z-50">
          Template: {templateResult.templateId} | Intent: {userIntent} | Drawer: {templateResult.drawerMode}
        </div>
      )}
    </div>
  );
}
