/**
 * SmartTriad-Aware KnytTab Component
 * 
 * Complete port of Qriptopian CodexLiquidUITab functionality integrated with SmartTriad system.
 * Maintains all Liquid UI templates, content viewers, and Co-Pilot integration while
 * leveraging SmartTriadProvider for coordinated state management.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, BookOpen, Play, Lock, Check, Sparkles, Coins, ShoppingCart, AlertTriangle, RefreshCw, LogIn, FileText, Cpu, Globe, Shield, Scroll, ArrowLeft, User, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useKnytBalance } from "@/app/hooks/useKnytBalance";
import { useKnytCards } from "@/app/hooks/useKnytCards";
import { useKnytPurchases } from "@/app/hooks/useKnytPurchases";
import { useSmartTriad } from "@/app/components/content/SmartTriadProvider";
import { useEthPrice } from "@/app/hooks/useEthPrice";
import { useDVNEvents } from "@/app/hooks/useDVNEvents";
import { tokenPricingService } from "@/app/services/token/pricingService";
import { 
  getActivePersonaId, 
  getPersonasByAuthProfile,
} from "@/services/wallet/personaService";
import type { KnytCardAsset, EpisodeGroup } from "@/app/hooks/useKnytCards";
import type { PersonaQube } from "@/types/persona";
// Inline Character Detail Page Component to avoid import issues
const InlineCharacterDetailPage = ({ characterId, onBack }: { characterId: string; onBack?: () => void }) => {
  const [character, setCharacter] = useState<KnytCardAsset | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock character data for now
    const mockCharacter: KnytCardAsset = {
      id: characterId,
      title: getCharacterName(characterId),
      episodeNumber: getCharacterEpisode(characterId),
      assetKind: 'character_poster',
      autoDriveCid: getCharacterCid(characterId),
      mimeType: 'image/jpeg',
      characterName: getCharacterName(characterId),
      digiterraName: getCharacterDigiterraName(characterId),
      affiliation: getCharacterAffiliation(characterId),
      powers: getCharacterPowers(characterId),
      primaryWeapon: getCharacterWeapon(characterId),
    };
    setCharacter(mockCharacter);
    setLoading(false);
  }, [characterId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 animate-spin mx-auto text-purple-400">⟳</div>
          <p className="text-white/60">Loading character details...</p>
        </div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <p className="text-red-400">Character not found</p>
          <Button onClick={onBack} variant="outline" className="bg-white/5 border-white/10">
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-900 overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button onClick={onBack} variant="outline" className="bg-white/5 border-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-white">{character.characterName}</h1>
        </div>

        {/* Character Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Character Image */}
          <div className="lg:col-span-1">
            <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
              <CardContent className="p-6">
                <div className="aspect-square relative bg-slate-800/50 rounded-lg mb-4">
                  <img
                    src={`https://autonomys-ipfs.com/ipfs/${character.autoDriveCid}`}
                    alt={character.characterName}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
                <div className="text-center">
                  <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30 mb-2">
                    {getCharacterRarity(characterId)}
                  </Badge>
                  <h3 className="text-xl font-semibold text-white mb-2">{character.characterName}</h3>
                  <p className="text-white/60">{character.affiliation}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Character Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Stats */}
            <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-400" />
                  Character Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-white/60">Affiliation</p>
                    <p className="text-white font-medium">{character.affiliation}</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/60">DigiTerra</p>
                    <p className="text-white font-medium">{character.digiterraName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/60">Primary Weapon</p>
                    <p className="text-white font-medium">{character.primaryWeapon}</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/60">Episode</p>
                    <p className="text-white font-medium">Episode {character.episodeNumber}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Powers & Abilities */}
            <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-400" />
                  Powers & Abilities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(character.powers ?? '').split(', ').filter(Boolean).map((power, index) => (
                    <Badge key={index} className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                      {power}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Backstory */}
            <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-400" />
                  Backstory
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-white/80 leading-relaxed">
                  {getCharacterDescription(characterId)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// Liquid UI imports from Qriptopian
import KnytTemplateRenderer from "@/app/triad/components/codex/templates/KnytTemplateRenderer";
import { CopilotWalletDrawer } from "@/app/triad/components/codex/wallet/CopilotWalletDrawer";
import { getKnytLiquidUIService, KnytLiquidUIService } from "@/app/services/knyt/knytLiquidUIService";
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
import { KnytCardsGrid } from "@/app/triad/components/content/KnytCardsGrid";
import { CoverImage } from "@/app/triad/components/content/CoverImage";
import { getImageLoaderStats } from "@/app/utils/image-loader";

// API and data
import { API_BASE_URL } from "@/app/config/api";
import issuePackage from "@/app/data/templates/qriptopian_episode1_issue_package_v1.4.json";

interface KnytTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  personaId?: string;
  issueSlug?: string;
  tabSlug?: string;
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
  description?: string;
  purchaseId?: string;
  priceUsd?: number;
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
  availableCovers?: number;
  coverCount: number;
  characterCount: number;
}

interface OwnedIssueFromAPI {
  issueId: string;
  episodeNumber: number;
  coverTitle?: string;
  coverVariant?: string;
  rarityTier?: string;
  editionSerial?: number;
  editionMax?: number;
  custodyMode?: 'custodial' | 'canonical';
  mintedAt?: string;
}

interface CharacterFromAPI {
  id: string;
  name: string;
  episode_number: number;
  front_cid?: string;
  back_cid?: string;
  rarity?: string;
}

interface KnytCardsApiCharacter {
  id: string;
  title?: string;
  episodeNumber?: number | null;
  assetKind?: 'character_poster' | 'powers_sheet';
  autoDriveCid?: string;
  characterId?: string;
  characterName?: string;
  digiterraName?: string;
}

type KnytTabSlug = 'codex' | 'scrolls' | 'characters' | 'lore' | 'digiterra' | 'terra' | 'order';

const KNYT_TAB_SLUGS = new Set<KnytTabSlug>([
  'codex',
  'scrolls',
  'characters',
  'lore',
  'digiterra',
  'terra',
  'order',
]);

function isKnytTabSlug(value: string): value is KnytTabSlug {
  return KNYT_TAB_SLUGS.has(value as KnytTabSlug);
}

const PREORDER_VARIANTS = [
  { id: 'legendary', label: 'Legendary (#-4)', priceUsd: 2100, tone: 'text-amber-400' },
  { id: 'epic', label: 'Epic (#-3)', priceUsd: 186, tone: 'text-blue-400' },
  { id: 'rare', label: 'Rare (#-2)', priceUsd: 86, tone: 'text-green-400' },
  { id: 'common', label: 'Common (#-1)', priceUsd: 68, tone: 'text-gray-400' },
];

function getAuthProfileIdFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    window.localStorage.getItem('authProfileId') ||
    window.localStorage.getItem('agentiq_auth_profile_id') ||
    window.sessionStorage.getItem('authProfileId') ||
    window.sessionStorage.getItem('agentiq_auth_profile_id') ||
    null
  );
}

function parseAdminAllowlist(raw: string | undefined): Set<string> {
  const defaults = ['admin', 'aigent-kn0w1', 'aigentz', 'aigentz@aigent:u_demo'];
  const values = raw
    ? raw
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    : defaults;
  return new Set(values);
}

export function KnytTab({ theme = 'dark', density = 'wide', personaId, tabSlug }: KnytTabProps) {
  // Real-time ETH pricing (exact from Netlify app)
  const { ethPriceUsd, knytPriceUsd, knytEthRate } = useEthPrice();
  
  // DID Qube persona integration
  const [activePersonaId, setActivePersonaIdState] = useState<string | null>(null);
  const [personas, setPersonas] = useState<PersonaQube[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  
  // DVN integration for cross-chain messaging
  const dvnEvents = useDVNEvents(activePersonaId || undefined);
  const [dvnFilter, setDvnFilter] = useState<'all' | 'knyt'>('knyt');
  const [dvnPersonaFilter, setDvnPersonaFilter] = useState<'all' | 'active'>('active');
  const [dvnStatusFilter, setDvnStatusFilter] = useState<'all' | 'confirmed'>('confirmed');
  const [dvnDrawerOpen, setDvnDrawerOpen] = useState(false);
  
  // SmartTriad integration
  const { state: triadState, actions: triadActions } = useSmartTriad();
  
  const resolvedInitialTab = useMemo<KnytTabSlug>(() => {
    const normalized = (tabSlug || 'codex').toLowerCase();
    switch (normalized) {
      case 'scrolls':
      case 'characters':
      case 'lore':
      case 'digiterra':
      case 'terra':
      case 'order':
      case 'codex':
        return normalized;
      default:
        return 'codex';
    }
  }, [tabSlug]);

  // Legacy state for cards/purchases (maintained for compatibility)
  const [activeTab, setActiveTab] = useState<KnytTabSlug>(resolvedInitialTab);
  const isExternallyScopedTab = Boolean(tabSlug);
  const isLegacyFallbackTab = activeTab !== 'codex';
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);

  useEffect(() => {
    setActiveTab(resolvedInitialTab);
  }, [resolvedInitialTab]);

  const handleLegacyTabChange = useCallback((value: string) => {
    if (isKnytTabSlug(value)) {
      setActiveTab(value);
    }
  }, []);
  
  // Character detail page state
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [showCharacterDetail, setShowCharacterDetail] = useState(false);
  
  // Initialize pricing service and load personas
  useEffect(() => {
    tokenPricingService.initialize();
    
    // Load active persona and personas list
    const loadPersonas = async () => {
      try {
        setLoadingPersonas(true);
        const activeId = getActivePersonaId();
        if (activeId) {
          setActivePersonaIdState(activeId);
        }
        
        const authProfileId = getAuthProfileIdFromStorage();
        if (authProfileId) {
          const personasList = await getPersonasByAuthProfile(authProfileId);
          setPersonas(personasList);
        }
      } catch (error) {
        console.error('[KnytTab] Failed to load personas:', error);
      } finally {
        setLoadingPersonas(false);
      }
    };
    
    loadPersonas();
  }, []);
  
  // Liquid UI state (ported from CodexLiquidUITab)
  const service = useMemo(() => getKnytLiquidUIService(), []);
  const [device, setDevice] = useState<DeviceType>(() => KnytLiquidUIService.getDeviceType());
  const [templateResult, setTemplateResult] = useState<TemplateSelectionResult | null>(null);
  const [userIntent, setUserIntent] = useState<UserIntent>('browse');
  const [contentItems, setContentItems] = useState<KnytContentItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [curatedContent, setCuratedContent] = useState<KnytContentItem[] | null>(null);
  const [layoutVariant, setLayoutVariant] = useState<DrawerGridLayoutVariant>('auto');
  const [ownedEpisodeNumbers, setOwnedEpisodeNumbers] = useState<Set<number>>(new Set());
  const [ownedIssues, setOwnedIssues] = useState<OwnedIssueFromAPI[]>([]);
  const [episodesCatalog, setEpisodesCatalog] = useState<EpisodeFromAPI[]>([]);
  const [loadedImages, setLoadedImages] = useState<Map<string, string>>(new Map());
  
  // Viewer state
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
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
    baseKnyt?: number;
    priceUsd?: number;
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
  const { groups, loading: cardsLoading, error: cardsError, refreshCards } = useKnytCards({ enabled: isLegacyFallbackTab });
  const { ownedCharacters, refreshPurchases } = useKnytPurchases(personaId);
  const isSignedIn = !!personaId && personaId !== 'default' && personaId !== 'guest';
  const showLayoutPreviewControls = useMemo(() => {
    const allowlist = parseAdminAllowlist(process.env.NEXT_PUBLIC_KNYT_LAYOUT_PREVIEW_ADMINS);
    const forceFromEnv = process.env.NEXT_PUBLIC_KNYT_LAYOUT_PREVIEW_ENABLED === 'true';
    if (forceFromEnv) return true;

    const candidates: string[] = [
      personaId || '',
      activePersonaId || '',
      ...personas.map((persona) => persona.id || ''),
      ...personas.map((persona) => persona.fioHandle || ''),
      ...personas.map((persona) => persona.displayName || ''),
    ];
    return candidates.some((candidate) => allowlist.has(candidate.toLowerCase()));
  }, [personaId, activePersonaId, personas]);
  const filteredDVNEvents = useMemo(() => {
    return dvnEvents.filter((event) => {
      if (dvnStatusFilter === 'confirmed' && event.event !== 'PaymentConfirmed') {
        return false;
      }
      if (dvnFilter === 'knyt') {
        const asset = event.asset?.toLowerCase() || '';
        const metaProduct = String(event.meta?.productType || '').toLowerCase();
        const metaCurrency = String(event.meta?.currency || '').toLowerCase();
        const isKnyt = asset.includes('knyt') || metaProduct.includes('knyt') || metaCurrency.includes('knyt');
        if (!isKnyt) return false;
      }
      if (dvnPersonaFilter === 'active' && activePersonaId) {
        const eventPersona = event.meta?.personaId || event.meta?.persona_id;
        if (eventPersona && eventPersona !== activePersonaId) return false;
      }
      return true;
    });
  }, [dvnEvents, dvnFilter, dvnPersonaFilter, dvnStatusFilter, activePersonaId]);

  const formatDVNTime = useCallback((timestamp?: number) => {
    if (!timestamp) return '—';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return '—';
    }
  }, []);

  // Content transformation functions (ported from CodexLiquidUITab)
  const transformEpisodesToContentItems = useCallback((episodes: EpisodeFromAPI[]): KnytContentItem[] => {
    const items: KnytContentItem[] = [];
    
    for (const ep of episodes) {
      // Skip episode 0 (placeholder)
      if (ep.episodeNumber === 0) continue;
      
      const printCid = ep.printRareCid || ep.printEpicCid || ep.printLegendaryCid;
      const printLiteUrl = ep.printRareLiteUrl || ep.printEpicLiteUrl || ep.printLegendaryLiteUrl;
      const hasReadable = !!printCid;
      const hasCover = !!(ep.coverThumbUrl || ep.coverImageCid);
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
      "codex:knyt:content:v2",
      async () => {
        const apiBase = API_BASE_URL;
        try {
          // Fetch episodes
          const episodesRes = await fetch(`${apiBase}/api/admin/codex/status?series=metaKnyts`);
          let episodeItems: KnytContentItem[] = [];
          
          if (episodesRes.ok) {
            const data = await episodesRes.json();
            if (data.episodes) {
              setEpisodesCatalog(data.episodes);
              episodeItems = transformEpisodesToContentItems(data.episodes);
              console.log('[KnytTab] Loaded', episodeItems.length, 'episode items');
            }
          }
          
          // Fetch characters
          const charactersRes = await fetch(`${apiBase}/api/codex/knyt-cards`);
          let characterItems: KnytContentItem[] = [];
          
          if (charactersRes.ok) {
            const data = await charactersRes.json();
            const normalizedCharacters: CharacterFromAPI[] = Array.isArray(data.characters)
              ? data.characters
              : Array.isArray(data.cards)
                ? (data.cards as KnytCardsApiCharacter[])
                    .filter((card) => card.assetKind !== 'powers_sheet')
                    .map((card) => ({
                      id: card.characterId || card.id,
                      name: card.characterName || card.digiterraName || card.title || 'Unknown Character',
                      episode_number: card.episodeNumber ?? 0,
                      front_cid: card.autoDriveCid,
                      rarity: 'common',
                    }))
                : [];

            if (normalizedCharacters.length > 0) {
              characterItems = transformCharactersToContentItems(normalizedCharacters);
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
      20 * 60 * 1000,
      {
        shouldCache: (items) => Array.isArray(items) && items.length > 0,
      }
    );
  }, [transformEpisodesToContentItems, transformCharactersToContentItems, transformLoreAssetsToContentItems, transformIssuePackageMetaKnytsToContentItems]);

  // Fetch owned episodes
  const fetchOwnedEpisodes = useCallback(async () => {
    if (!personaId) {
      setOwnedEpisodeNumbers(new Set());
      setOwnedIssues([]);
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
      setOwnedIssues(ownedData.issues || []);
      const ownedEpisodesArray = (ownedData.issues || [])
        .map((issue: { episodeNumber?: number }) => issue.episodeNumber)
        .filter((episodeNumber: number | undefined) => typeof episodeNumber === 'number');
      setCachedValue(cacheKey, ownedEpisodesArray, 5 * 60 * 1000);
      setOwnedEpisodeNumbers(new Set(ownedEpisodesArray));
    } catch (error) {
      console.warn('[KnytTab] Failed to load owned episodes:', error);
    }
  }, [personaId]);

  const fetchEpisodesCatalog = useCallback(async () => {
    return getCachedOrFetch<EpisodeFromAPI[]>(
      "codex:knyt:episodes",
      async () => {
        const apiBase = API_BASE_URL;
        try {
          const episodesRes = await fetch(`${apiBase}/api/admin/codex/status?series=metaKnyts`);
          if (!episodesRes.ok) return [];
          const data = await episodesRes.json();
          return data.episodes || [];
        } catch (error) {
          console.error('[KnytTab] Failed to fetch episodes catalog:', error);
          return [];
        }
      },
      10 * 60 * 1000
    );
  }, []);

  // Handle window resize for device detection
  useEffect(() => {
    const handleResize = () => {
      setDevice(KnytLiquidUIService.getDeviceType());
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

  useEffect(() => {
    async function loadEpisodes() {
      const episodes = await fetchEpisodesCatalog();
      setEpisodesCatalog(episodes);
    }
    loadEpisodes();
  }, [fetchEpisodesCatalog]);

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

  const contentForActiveTab = useMemo(() => {
    switch (activeTab) {
      case 'scrolls':
        return contentWithOwnership.filter(
          (item) =>
            item.type === 'comic_page_portrait' ||
            item.type === 'comic_cover_portrait' ||
            item.type === 'motion_comic_landscape'
        );
      case 'characters':
        return contentWithOwnership.filter((item) => item.type === 'character_portrait');
      case 'lore':
        return contentWithOwnership.filter((item) => item.type === 'lore_snippet');
      case 'digiterra':
        return contentWithOwnership.filter((item) => item.metadata?.realm === 'digiterra');
      case 'terra':
        return contentWithOwnership.filter(
          (item) => item.metadata?.realm === 'terra' || item.type === 'terra_update'
        );
      case 'order':
        return contentWithOwnership;
      case 'codex':
      default:
        return contentWithOwnership;
    }
  }, [contentWithOwnership, activeTab]);

  // Select template based on context
  useEffect(() => {
    if (loading) return;

    const contentMix = service.inferContentMix(contentForActiveTab);
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
    const forcedTemplateByTab: Partial<Record<string, KnytTemplateId>> = {
      scrolls: 'knyt:motion_stage_v1',
      characters: 'knyt:dual_poster_stage_v1',
      lore: 'knyt:drawer_grid_v1',
      digiterra: 'knyt:motion_stage_v1',
      terra: 'knyt:realm_bridge_map_v1',
      order: 'knyt:quest_hud_hub_v1',
    };
    const scopedTemplate = forcedTemplateByTab[activeTab];
    const finalResult =
      activeTab !== 'codex' && scopedTemplate
        ? { ...result, templateId: scopedTemplate }
        : result;
    setTemplateResult(finalResult);

    const composed = service.composeScreen({
      templateId: finalResult.templateId,
      context,
      contentItems: contentForActiveTab,
      selectedItemId,
    });

    if (composed) {
      const drawerRegion = composed.regions?.drawer_grid;
      if (finalResult.templateId === 'knyt:drawer_grid_v1' && drawerRegion?.items?.length) {
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
    if (finalResult.copilotMode !== copilotMode) {
      setCopilotMode(finalResult.copilotMode);
    }
  }, [loading, contentForActiveTab, userIntent, device, activeRealm, personaId, taskData, service, selectedItemId, activeTab, copilotMode]);

  const handleBackFromCharacterDetail = () => {
    setShowCharacterDetail(false);
    setSelectedCharacterId(null);
  };

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

  const getOwnedIssuesForEpisode = useCallback((episodeNumber: number) => {
    return ownedIssues.filter((issue) => issue.episodeNumber === episodeNumber);
  }, [ownedIssues]);

  const openPurchaseForEpisode = useCallback((episode: EpisodeFromAPI, action: 'read' | 'watch' | 'default' = 'default') => {
    const contentType: ContentType =
      action === 'watch'
        ? 'scroll_motion'
        : action === 'read'
          ? 'scroll_still'
          : episode.hasMotionMaster
            ? 'scroll_motion'
            : 'scroll_still';
    setPurchaseContent({
      type: contentType,
      id: episode.purchaseId || `mk_ep${String(episode.episodeNumber).padStart(2, '0')}`,
      title: episode.title || `Episode ${episode.displayNumber}`,
      image: episode.coverThumbUrl || (episode.coverImageCid ? `/api/content/cover/${episode.coverImageCid}?variant=thumb` : undefined),
      baseKnyt: episode.priceKnyt ?? (episode.hasMotionMaster ? 5 : 3),
      priceUsd: episode.priceUsd ?? ((episode.priceKnyt ?? (episode.hasMotionMaster ? 5 : 3)) * 1.4),
    });
    setPurchaseModalOpen(true);
  }, []);

  const openPreorder = useCallback((variantId: string, priceUsd: number) => {
    setPurchaseContent({
      type: 'scroll_still',
      id: `metaKnyts_preorder_${variantId}`,
      title: `Episode -1 Pre-order (${variantId})`,
      baseKnyt: Number((priceUsd / 1.4).toFixed(2)),
      priceUsd,
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
      setVideoPlayerOpen(true);
    } else if (action === 'copilot') {
      setDrawerOpen(true);
      toast({
        title: 'Copilot ready',
        description: 'Wallet + Copilot drawer opened for this content item.',
      });
    }
  }, [isEpisodeLocked, openPurchaseForItem, toast]);

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
      setVideoPlayerOpen(true);
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
  if (isLegacyFallbackTab && cardsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-400" />
          <p className="text-white/60">Loading KNYT Cards...</p>
        </div>
      </div>
    );
  }

  if (isLegacyFallbackTab && cardsError) {
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
    <div className="h-full w-full bg-slate-900">
      {/* Show Character Detail Page if selected */}
      {showCharacterDetail && selectedCharacterId ? (
        <InlineCharacterDetailPage 
          characterId={selectedCharacterId}
          onBack={handleBackFromCharacterDetail}
        />
      ) : (
        <>
          {/* Main Liquid UI Template Renderer */}
          <div className="h-full w-full overflow-hidden">
            <KnytTemplateRenderer
              templateId={templateResult.templateId}
              userIntent={userIntent}
              contentItems={curatedContent && curatedContent.length > 0 ? curatedContent : contentForActiveTab}
              selectedItemId={selectedItemId}
              device={device}
              layoutVariant={layoutVariant}
              onContentSelect={handleContentSelect}
              onViewerOpen={handleViewerOpen}
              onSmartAction={handleSmartAction}
              copilotMode={copilotMode}
              copilotContent={null}
              drawerMode={templateResult.drawerMode}
              drawerOpen={drawerOpen}
              walletUI={templateResult.walletUI}
              onDrawerToggle={handleDrawerToggle}
              activeTask={taskData.activeTask || undefined}
              rewards={taskData.rewards}
              ascensionRank={taskData.ascensionRank}
              activeRealm={activeRealm}
              onRealmChange={handleRealmChange}
              onCopilotModeChange={handleCopilotModeChange}
              knytBalance={balance?.dvnKnyt || 0}
              showLayoutPreviewControls={showLayoutPreviewControls}
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
          {!isExternallyScopedTab && activeTab !== 'codex' && (
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

              {dvnEvents.length > 0 && (
                <div className="flex items-center gap-3 flex-wrap text-xs text-white/60">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
                    DVN
                    <span className="text-cyan-300">{filteredDVNEvents.length} events</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      className={`rounded-full px-2 py-1 ${dvnFilter === 'knyt' ? 'bg-cyan-500/20 text-cyan-200' : 'bg-white/5 text-white/50'}`}
                      onClick={() => setDvnFilter('knyt')}
                    >
                      KNYT
                    </button>
                    <button
                      className={`rounded-full px-2 py-1 ${dvnFilter === 'all' ? 'bg-cyan-500/20 text-cyan-200' : 'bg-white/5 text-white/50'}`}
                      onClick={() => setDvnFilter('all')}
                    >
                      All
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className={`rounded-full px-2 py-1 ${dvnStatusFilter === 'confirmed' ? 'bg-purple-500/20 text-purple-200' : 'bg-white/5 text-white/50'}`}
                      onClick={() => setDvnStatusFilter('confirmed')}
                    >
                      Confirmed
                    </button>
                    <button
                      className={`rounded-full px-2 py-1 ${dvnStatusFilter === 'all' ? 'bg-purple-500/20 text-purple-200' : 'bg-white/5 text-white/50'}`}
                      onClick={() => setDvnStatusFilter('all')}
                    >
                      All Status
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className={`rounded-full px-2 py-1 ${dvnPersonaFilter === 'active' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-white/50'}`}
                      onClick={() => setDvnPersonaFilter('active')}
                    >
                      Active Persona
                    </button>
                    <button
                      className={`rounded-full px-2 py-1 ${dvnPersonaFilter === 'all' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-white/50'}`}
                      onClick={() => setDvnPersonaFilter('all')}
                    >
                      All Personas
                    </button>
                  </div>
                  <span className="truncate">
                    Latest: {(filteredDVNEvents[0] || dvnEvents[0]).event}
                    {(filteredDVNEvents[0] || dvnEvents[0]).asset ? ` • ${(filteredDVNEvents[0] || dvnEvents[0]).asset}` : ''}
                  </span>
                </div>
              )}
              {filteredDVNEvents.length > 0 && (
                <div className="mt-2 grid gap-1 text-[11px] text-white/60">
                  {filteredDVNEvents.slice(0, 5).map((event, idx) => (
                    <div key={`${event.txHash || event.event}-${idx}`} className="flex items-center justify-between gap-3 rounded-md bg-white/5 px-2 py-1">
                      <span className="truncate">
                        {event.event} {event.asset ? `• ${event.asset}` : ''}
                      </span>
                      <span className="text-white/40">{formatDVNTime(event.timestamp)}</span>
                    </div>
                  ))}
                  <button
                    className="text-left text-cyan-300 hover:text-cyan-200 transition-colors"
                    onClick={() => setDvnDrawerOpen(true)}
                  >
                    View all DVN events →
                  </button>
                </div>
              )}

              {!isSignedIn && (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <LogIn className="h-5 w-5 text-amber-300" />
                    <div>
                      <p className="text-sm font-semibold text-white">Persona Required</p>
                      <p className="text-xs text-white/60">
                        Connect or create a persona in Smart Wallet to purchase and unlock content.
                      </p>
                    </div>
                  </div>
                  <Button className="bg-amber-500 hover:bg-amber-600">Open Wallet</Button>
                </div>
              )}

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={handleLegacyTabChange} className="w-full">
                {!isExternallyScopedTab && (
                  <TabsList className="grid w-full grid-cols-7 bg-white/5 border-white/10">
                    <TabsTrigger value="codex" className="text-white/80 data-[state=active]:text-white">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Codex
                    </TabsTrigger>
                    <TabsTrigger value="scrolls" className="text-white/80 data-[state=active]:text-white">
                      <Scroll className="w-4 h-4 mr-2" />
                      Scrolls
                    </TabsTrigger>
                    <TabsTrigger value="characters" className="text-white/80 data-[state=active]:text-white">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Characters
                    </TabsTrigger>
                    <TabsTrigger value="lore" className="text-white/80 data-[state=active]:text-white">
                      <FileText className="w-4 h-4 mr-2" />
                      Lore
                    </TabsTrigger>
                    <TabsTrigger value="digiterra" className="text-white/80 data-[state=active]:text-white">
                      <Cpu className="w-4 h-4 mr-2" />
                      DigiTerra
                    </TabsTrigger>
                    <TabsTrigger value="terra" className="text-white/80 data-[state=active]:text-white">
                      <Globe className="w-4 h-4 mr-2" />
                      Terra
                    </TabsTrigger>
                    <TabsTrigger value="order" className="text-white/80 data-[state=active]:text-white">
                      <Shield className="w-4 h-4 mr-2" />
                      Order
                    </TabsTrigger>
                  </TabsList>
                )}

                {/* Scrolls Tab - Episodes */}
                <TabsContent value="scrolls" className="space-y-4">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-white">Digital Scrolls</h3>
                    <p className="text-sm text-white/60">Episodes and motion comics from the metaKnyts saga</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {episodesCatalog.map((episode) => {
                      const owned = getOwnedIssuesForEpisode(episode.episodeNumber);
                      const isOwned = owned.length > 0;
                      const hasMaster =
                        episode.hasStillMaster ||
                        episode.hasMotionMaster ||
                        episode.hasPrintRare ||
                        episode.hasPrintEpic ||
                        episode.hasPrintLegendary;
                      const isAvailable = hasMaster;
                      const priceKnyt = episode.priceKnyt ?? (episode.hasMotionMaster ? 5 : 3);
                      const priceUsd = episode.priceUsd ?? priceKnyt * 1.4;

                      return (
                        <div
                          key={episode.episodeNumber}
                          className={`group relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 ${
                            isOwned ? 'ring-2 ring-cyan-400/50' : 'hover:ring-2 hover:ring-white/30'
                          }`}
                          onClick={() => {
                            const printCid = episode.printRareCid || episode.printEpicCid || episode.printLegendaryCid;
                            if (!isOwned && isAvailable) {
                              openPurchaseForEpisode(episode);
                              return;
                            }
                            if (printCid) {
                              setCurrentPdfCid(printCid);
                              setCurrentPdfLiteUrl(
                                episode.printRareLiteUrl || episode.printEpicLiteUrl || episode.printLegendaryLiteUrl || null
                              );
                              setCurrentPdfTitle(episode.title || `Episode ${episode.displayNumber}`);
                              setPdfViewerOpen(true);
                            }
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-black">
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-6xl font-bold text-white/10">{episode.episodeNumber}</span>
                            </div>
                          </div>
                          {(episode.coverThumbUrl || episode.coverImageCid) && (
                            <CoverImage
                              cid={episode.coverThumbUrl || episode.coverImageCid!}
                              alt={episode.title || `Episode ${episode.displayNumber}`}
                              loadedImages={loadedImages}
                              setLoadedImages={setLoadedImages}
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />

                          <div className="absolute top-2 right-2 flex flex-col gap-1">
                            {isOwned && (
                              <span className="px-2 py-1 bg-cyan-500/80 text-white text-xs font-bold rounded flex items-center gap-1">
                                <Check className="w-3 h-3" /> OWNED
                              </span>
                            )}
                            {!isAvailable && !isOwned && (
                              <span className="px-2 py-1 bg-gray-500/80 text-white text-xs font-bold rounded flex items-center gap-1">
                                <Lock className="w-3 h-3" /> SOON
                              </span>
                            )}
                            {isAvailable && !isOwned && (
                              <span className="px-2 py-1 bg-amber-500/90 text-white text-xs font-bold rounded flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Coins className="w-3 h-3" />
                                {priceKnyt} KNYT
                              </span>
                            )}
                          </div>

                          <div className="absolute bottom-12 right-2 flex gap-1 z-10">
                            {isAvailable && !isOwned && (
                              <button
                                className="w-6 h-6 rounded-md bg-amber-500/80 backdrop-blur-sm flex items-center justify-center ring-1 ring-amber-400/40 text-white hover:bg-amber-400 transition-all"
                                title={`Buy for ${priceKnyt} KNYT`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPurchaseContent({
                                    type: episode.hasMotionMaster ? 'scroll_motion' : 'scroll_still',
                                    id: episode.purchaseId || `mk_ep${String(episode.episodeNumber).padStart(2, '0')}`,
                                    title: episode.title || `Episode ${episode.displayNumber}`,
                                    image: episode.coverThumbUrl || (episode.coverImageCid ? `/api/content/cover/${episode.coverImageCid}?variant=thumb` : undefined),
                                    baseKnyt: priceKnyt,
                                    priceUsd,
                                  });
                                  setPurchaseModalOpen(true);
                                }}
                              >
                                <ShoppingCart className="w-3 h-3" />
                              </button>
                            )}
                            {(episode.hasPrintRare || episode.hasPrintEpic || episode.hasPrintLegendary) && (
                              <button
                                className="w-6 h-6 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-cyan-500/40 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all"
                                title="Read"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const printCid = episode.printRareCid || episode.printEpicCid || episode.printLegendaryCid;
                                  if (!isOwned && isAvailable) {
                                    openPurchaseForEpisode(episode, 'read');
                                    return;
                                  }
                                  if (printCid) {
                                    setCurrentPdfCid(printCid);
                                    setCurrentPdfLiteUrl(
                                      episode.printRareLiteUrl || episode.printEpicLiteUrl || episode.printLegendaryLiteUrl || null
                                    );
                                    setCurrentPdfTitle(episode.title || `Episode ${episode.displayNumber}`);
                                    setPdfViewerOpen(true);
                                  }
                                }}
                              >
                                <BookOpen className="w-3 h-3" />
                              </button>
                            )}
                            {episode.hasMotionMaster && episode.motionMasterCid && ![1, 3].includes(episode.episodeNumber) && (
                              <button
                                className="w-6 h-6 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-cyan-500/40 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all"
                                title="Watch"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!isOwned && isAvailable) {
                                    openPurchaseForEpisode(episode, 'watch');
                                    return;
                                  }
                                  setCurrentVideoTitle(`${episode.title} - Motion Comic`);
                                  setCurrentVideoCid(episode.motionMasterCid!);
                                  setVideoPlayerOpen(true);
                                }}
                              >
                                <Play className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-xs text-cyan-400 font-medium">Episode {episode.displayNumber}</p>
                            <p className="text-sm font-bold text-white line-clamp-2">{episode.title}</p>
                            {isOwned ? (
                              <p className="text-xs text-cyan-400 mt-1">{owned.length} issue{owned.length > 1 ? 's' : ''} owned</p>
                            ) : isAvailable ? (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-medium text-amber-300">{priceKnyt} KNYT</span>
                                <span className="text-[10px] text-white/40">(${priceUsd.toFixed(2)})</span>
                              </div>
                            ) : null}
                          </div>
                          <div className="absolute inset-0 bg-cyan-500/0 group-hover:bg-cyan-500/10 transition-colors" />
                        </div>
                      );
                    })}
                  </div>

                  {episodesCatalog.length === 0 && (
                    <div className="text-center py-12 text-white/60">
                      <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No episodes available yet</p>
                      <p className="text-sm mt-1">Check back soon for new Digital Scrolls</p>
                    </div>
                  )}

                  <div className="mt-6 rounded-2xl border border-amber-400/30 bg-white/5 p-5 shadow-[0_0_40px_rgba(245,158,11,0.15)]">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                          Pre-order
                        </Badge>
                        <div>
                          <h4 className="text-lg font-semibold text-white">Episode -1 Collector Print</h4>
                          <p className="text-sm text-white/60">Limited edition physical graphic novel</p>
                        </div>
                      </div>
                      <Button
                        className="bg-amber-500 hover:bg-amber-600"
                        onClick={() => openPreorder(PREORDER_VARIANTS[0].id, PREORDER_VARIANTS[0].priceUsd)}
                      >
                        Reserve a Copy
                      </Button>
                    </div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {PREORDER_VARIANTS.map((variant) => (
                        <button
                          key={variant.id}
                          onClick={() => openPreorder(variant.id, variant.priceUsd)}
                          className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2 text-left ring-1 ring-white/10 hover:ring-amber-400/60 transition-all"
                        >
                          <span className={`text-xs font-semibold ${variant.tone}`}>{variant.label}</span>
                          <span className="text-sm font-bold text-white">${variant.priceUsd}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-white/50 mt-3">
                      Shipping included for pre-order tiers. Limited run while supplies last.
                    </p>
                  </div>

                  {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-white/40 mt-2">
                      Image queue: {getImageLoaderStats().queueSize} queued / {getImageLoaderStats().activeLoads} active
                    </div>
                  )}
                </TabsContent>

                {/* Codex Tab - Main Content */}
                <TabsContent value="codex" className="space-y-4">
                  <div className="text-center py-8">
                    <BookOpen className="w-16 h-16 mx-auto text-purple-400 mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">KNYT Codex</h3>
                    <p className="text-white/60 max-w-md mx-auto">
                      The complete collection of KNYT universe knowledge and artifacts.
                    </p>
                    <Button className="mt-4 bg-purple-500 hover:bg-purple-600">Explore Codex</Button>
                  </div>
                </TabsContent>

                {/* Characters Tab */}
                <TabsContent value="characters" className="space-y-4">
                  <KnytCardsGrid
                    groups={groups}
                    ownedCharacters={ownedCharacters}
                    personaId={personaId}
                    knytBalance={balance?.dvnKnyt || 0}
                    spendableKnyt={spendableBalance || 0}
                    onBalanceRefresh={refreshBalance}
                    onPurchaseComplete={refreshPurchases}
                  />
                </TabsContent>

                {/* Lore Tab */}
                <TabsContent value="lore" className="space-y-4">
                  <div className="text-center py-8">
                    <FileText className="w-16 h-16 mx-auto text-purple-400 mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">Lore Library</h3>
                    <p className="text-white/60 max-w-md mx-auto">
                      Deep dive into the rich history and mythology of the KNYT universe.
                    </p>
                    <Button className="mt-4 bg-purple-500 hover:bg-purple-600">Explore Lore</Button>
                  </div>
                </TabsContent>

                {/* DigiTerra Tab */}
                <TabsContent value="digiterra" className="space-y-4">
                  <div className="text-center py-8">
                    <Cpu className="w-16 h-16 mx-auto text-purple-400 mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">DigiTerra</h3>
                    <p className="text-white/60 max-w-md mx-auto">
                      Explore the digital realm where code and consciousness merge.
                    </p>
                    <Button className="mt-4 bg-purple-500 hover:bg-purple-600">Enter DigiTerra</Button>
                  </div>
                </TabsContent>

                {/* Terra Tab */}
                <TabsContent value="terra" className="space-y-4">
                  <div className="text-center py-8">
                    <Globe className="w-16 h-16 mx-auto text-purple-400 mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">Terra</h3>
                    <p className="text-white/60 max-w-md mx-auto">
                      The physical realm where ancient mysteries await discovery.
                    </p>
                    <Button className="mt-4 bg-green-500 hover:bg-green-600">Explore Terra</Button>
                  </div>
                </TabsContent>

                {/* Order Tab */}
                <TabsContent value="order" className="space-y-4">
                  <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Shield className="w-5 h-5 text-purple-400" />
                        Order System
                      </CardTitle>
                      <CardDescription className="text-white/60">The governing order of the KNYT universe</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8">
                        <Shield className="w-16 h-16 mx-auto text-purple-400 mb-4" />
                        <h3 className="text-xl font-semibold text-white mb-2">The Order</h3>
                        <p className="text-white/60 max-w-md mx-auto">
                          Join the governing order that maintains balance across all realms of the KNYT universe.
                        </p>
                        <Button className="mt-4 bg-purple-500 hover:bg-purple-600">Join Order</Button>
                      </div>
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
                  setCurrentPdfTitle('');
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
                onClose={() => {
                  setPdfViewerOpen(false);
                  setCurrentPdfCid(null);
                  setCurrentPdfTitle('');
                }}
              />
            </>
          )}

          {/* Video Player Modal */}
          {videoPlayerOpen && currentVideoCid && (
            <VideoErrorBoundary
              onClose={() => {
                setVideoPlayerOpen(false);
                setCurrentVideoCid(null);
                setCurrentVideoTitle('');
              }}
            >
              <VideoPlayer
                videoUrl={`/api/content/video/${currentVideoCid}`}
                title={currentVideoTitle}
                onClose={() => {
                  setVideoPlayerOpen(false);
                  setCurrentVideoCid(null);
                  setCurrentVideoTitle('');
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
              baseKnytOverride={purchaseContent.baseKnyt}
              priceUsdOverride={purchaseContent.priceUsd}
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
        </>
      )}

      <Dialog open={dvnDrawerOpen} onOpenChange={setDvnDrawerOpen}>
        <DialogContent className="max-w-2xl bg-slate-950 text-white border-white/10">
          <DialogHeader>
            <DialogTitle>DVN Event Stream</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                className={`rounded-full px-3 py-1 ${dvnFilter === 'knyt' ? 'bg-cyan-500/20 text-cyan-200' : 'bg-white/5 text-white/50'}`}
                onClick={() => setDvnFilter('knyt')}
              >
                KNYT
              </button>
              <button
                className={`rounded-full px-3 py-1 ${dvnFilter === 'all' ? 'bg-cyan-500/20 text-cyan-200' : 'bg-white/5 text-white/50'}`}
                onClick={() => setDvnFilter('all')}
              >
                All
              </button>
              <button
                className={`rounded-full px-3 py-1 ${dvnStatusFilter === 'confirmed' ? 'bg-purple-500/20 text-purple-200' : 'bg-white/5 text-white/50'}`}
                onClick={() => setDvnStatusFilter('confirmed')}
              >
                Confirmed
              </button>
              <button
                className={`rounded-full px-3 py-1 ${dvnStatusFilter === 'all' ? 'bg-purple-500/20 text-purple-200' : 'bg-white/5 text-white/50'}`}
                onClick={() => setDvnStatusFilter('all')}
              >
                All Status
              </button>
              <button
                className={`rounded-full px-3 py-1 ${dvnPersonaFilter === 'active' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-white/50'}`}
                onClick={() => setDvnPersonaFilter('active')}
              >
                Active Persona
              </button>
              <button
                className={`rounded-full px-3 py-1 ${dvnPersonaFilter === 'all' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-white/50'}`}
                onClick={() => setDvnPersonaFilter('all')}
              >
                All Personas
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
              {filteredDVNEvents.slice(0, 50).map((event, idx) => (
                <div key={`${event.txHash || event.event}-${idx}`} className="rounded-lg border border-white/5 bg-white/5 p-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-white">{event.event}</span>
                    <span className="text-white/40">{formatDVNTime(event.timestamp)}</span>
                  </div>
                  <div className="mt-1 text-white/60">
                    {event.asset ? `Asset: ${event.asset}` : 'Asset: —'} • Chain: {event.chain}
                  </div>
                  {event.txHash && (
                    <div className="mt-1 text-white/40 truncate">Tx: {event.txHash}</div>
                  )}
                  {event.meta?.personaId && (
                    <div className="mt-1 text-white/40 truncate">Persona: {event.meta.personaId}</div>
                  )}
                </div>
              ))}
              {filteredDVNEvents.length === 0 && (
                <div className="text-sm text-white/50">No DVN events match the filters yet.</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Debug Info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/80 rounded text-xs text-white/60 z-50">
          Template: {templateResult.templateId} | Intent: {userIntent} | Drawer: {templateResult.drawerMode}
        </div>
      )}

      {/* DID Qube & DVN Status Indicators */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 rounded text-xs text-white/60 z-50 space-y-1">
          <div>DID Qube: {loadingPersonas ? 'Loading...' : `${personas.length} personas`}</div>
          <div>DVN Events: {dvnEvents.length} recent</div>
          <div>Active Persona: {activePersonaId || 'None'}</div>
          {dvnEvents.length > 0 && (
            <div className="text-xs text-green-400">
              Latest: {dvnEvents[0].event} - {dvnEvents[0].asset}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper functions for character data
function getCharacterName(id: string): string {
  const names: Record<string, string> = {
    'char1': 'Void Walker',
    'char2': 'Star Weaver',
    'char3': 'Iron Guardian',
    'char4': 'Moon Shadow',
    'char5': 'Storm Caller',
  };
  return names[id] || 'Unknown Character';
}

function getCharacterEpisode(id: string): number {
  const episodes: Record<string, number> = {
    'char1': 1,
    'char2': 1,
    'char3': 2,
    'char4': 2,
    'char5': 3,
  };
  return episodes[id] || 1;
}

function getCharacterCid(id: string): string {
  const cids: Record<string, string> = {
    'char1': 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    'char2': 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    'char3': 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    'char4': 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    'char5': 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
  };
  return cids[id] || 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
}

function getCharacterDigiterraName(id: string): string {
  const digiterras: Record<string, string> = {
    'char1': 'Digital Void',
    'char2': 'Celestial Realm',
    'char3': 'Iron Fortress',
    'char4': 'Lunar Sanctuary',
    'char5': 'Storm Peak',
  };
  return digiterras[id] || 'Unknown DigiTerra';
}

function getCharacterAffiliation(id: string): string {
  const affiliations: Record<string, string> = {
    'char1': 'Shadow Order',
    'char2': 'Light Council',
    'char3': 'Iron Legion',
    'char4': 'Moon Clan',
    'char5': 'Storm Tribe',
  };
  return affiliations[id] || 'Unknown Affiliation';
}

function getCharacterRarity(id: string): string {
  const rarities: Record<string, string> = {
    'char1': 'Legendary',
    'char2': 'Epic',
    'char3': 'Rare',
    'char4': 'Uncommon',
    'char5': 'Common',
  };
  return rarities[id] || 'Common';
}

function getCharacterPowers(id: string): string {
  const powers: Record<string, string> = {
    'char1': 'Void Walk, Data Weave, Quantum Shield',
    'char2': 'Star Weave, Celestial Light, Astral Projection',
    'char3': 'Iron Will, Earth Shield, Forge Master',
    'char4': 'Moon Whisper, Lunar Shield, Night Vision',
    'char5': 'Storm Call, Lightning Strike, Wind Walk',
  };
  return powers[id] || 'Unknown Powers';
}

function getCharacterWeapon(id: string): string {
  const weapons: Record<string, string> = {
    'char1': 'Void Blade',
    'char2': 'Star Staff',
    'char3': 'Iron Hammer',
    'char4': 'Moon Dagger',
    'char5': 'Storm Sword',
  };
  return weapons[id] || 'Unknown Weapon';
}

function getCharacterDescription(id: string): string {
  return `A mysterious figure from the KNYT universe, wielding powers that defy conventional understanding. This character plays a crucial role in the ongoing conflict between the digital and physical realms.`;
}
