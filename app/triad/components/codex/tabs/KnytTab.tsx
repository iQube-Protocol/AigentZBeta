/**
 * SmartTriad-Aware KnytTab Component
 * 
 * Complete port of Qriptopian CodexLiquidUITab functionality integrated with SmartTriad system.
 * Maintains all Liquid UI templates, content viewers, and Co-Pilot integration while
 * leveraging SmartTriadProvider for coordinated state management.
 */

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
// SmartContent imports
import { SmartContentActionProvider } from "@/app/contexts/SmartContentActionContext";
import { useSmartContentHandler } from "@/app/hooks/useSmartContentAction";
import { SmartContentActions, hasPlayableContent, hasReadableContent, getPrimaryAction } from "@/app/components/content/SmartContentActions";
import type { SmartContentItem, ContentModalities, ActionType } from "@/packages/smarttriad/src/types";
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
import { VideoPlayer, type VideoSegment } from "@/app/triad/components/content/VideoPlayer";
import { VideoErrorBoundary } from "@/app/triad/components/content/VideoErrorBoundary";
import { LoreTextReader } from "@/app/triad/components/content/LoreTextReader";
import { ContentPurchaseModal, type ContentType } from "@/app/triad/components/content/ContentPurchaseModal";
import { KnytCardsGrid } from "@/app/triad/components/content/KnytCardsGrid";
import { CoverImage } from "@/app/triad/components/content/CoverImage";
import SmartWalletDrawer from "@/app/components/content/SmartWalletDrawer";
import { CodexCopilotLayer, type CopilotMessage } from "@/app/components/codex/CodexCopilotLayer";
import { getImageLoaderStats } from "@/app/utils/image-loader";
import type { SmartContentQube } from "@/types/smartContent";

// API and data
import { API_BASE_URL } from "@/app/config/api";
import issuePackage from "@/app/data/templates/qriptopian_episode1_issue_package_v1.4.json";

interface KnytTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  personaId?: string;
  issueSlug?: string;
  tabSlug?: string;
  forcedDevice?: DeviceType;
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
  motionMasterId?: string;
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

type KnytTabSlug = 'codex' | 'scrolls' | 'characters' | 'lore' | 'digiterra' | 'terra' | 'order' | 'living-canon';

const KNYT_TAB_SLUGS = new Set<KnytTabSlug>([
  'codex',
  'scrolls',
  'characters',
  'lore',
  'digiterra',
  'terra',
  'order',
  'living-canon',
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

const PREORDER_CONTENT_VARIANTS = [
  { id: 'legendary', subtitle: 'Episode #-4', title: 'Episode -1 Preorder Drop (Legendary)', priceKnyt: 1500 },
  { id: 'epic', subtitle: 'Episode #-3', title: 'Episode -1 Preorder Drop (Epic)', priceKnyt: 133 },
  { id: 'rare', subtitle: 'Episode #-2', title: 'Episode -1 Preorder Drop (Rare)', priceKnyt: 61 },
  { id: 'common', subtitle: 'Episode #-1', title: 'Episode -1 Preorder Drop (Common)', priceKnyt: 49 },
] as const;

type PreorderVariantId = (typeof PREORDER_CONTENT_VARIANTS)[number]['id'];

const PREORDER_VARIANT_EPISODE_NUMBER: Record<PreorderVariantId, number> = {
  legendary: -4,
  epic: -3,
  rare: -2,
  common: -1,
};

const KNYT_CONTENT_CACHE_KEY = "codex:knyt:content:v3";
const KNYT_EPISODES_CACHE_KEY = "codex:knyt:episodes";
const KNYT_SESSION_CACHE_KEY = "codex:knyt:session:v2";
const KNYT_SESSION_CACHE_TTL_MS = 30 * 60 * 1000;

type KnytSessionSnapshot = {
  version: 1;
  cachedAt: number;
  contentItems: KnytContentItem[];
  episodesCatalog: EpisodeFromAPI[];
};

function readKnytSessionSnapshot(): KnytSessionSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KNYT_SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<KnytSessionSnapshot>;
    if (parsed.version !== 1 || !Array.isArray(parsed.contentItems) || !Array.isArray(parsed.episodesCatalog)) {
      return null;
    }
    const cachedAt = typeof parsed.cachedAt === 'number' ? parsed.cachedAt : 0;
    if (!cachedAt || Date.now() - cachedAt > KNYT_SESSION_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(KNYT_SESSION_CACHE_KEY);
      return null;
    }
    return {
      version: 1,
      cachedAt,
      contentItems: parsed.contentItems as KnytContentItem[],
      episodesCatalog: parsed.episodesCatalog as EpisodeFromAPI[],
    };
  } catch {
    return null;
  }
}

function writeKnytSessionSnapshot(contentItems: KnytContentItem[], episodesCatalog: EpisodeFromAPI[]) {
  if (typeof window === 'undefined') return;
  try {
    const snapshot: KnytSessionSnapshot = {
      version: 1,
      cachedAt: Date.now(),
      contentItems,
      episodesCatalog,
    };
    window.sessionStorage.setItem(KNYT_SESSION_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota/serialization failures.
  }
}

const KNYT_TAB_CONTEXT_LABELS: Record<KnytTabSlug, string> = {
  codex: 'Codex',
  scrolls: 'Scrolls',
  characters: 'Characters',
  lore: 'Lore',
  digiterra: 'DigiTerra',
  terra: 'Terra',
  order: 'Order',
  'living-canon': '21 Sats',
};

function createCodexCopilotWelcomeMessage(
  activeTab: KnytTabSlug = 'codex',
  selectedItem?: Pick<KnytContentItem, 'title'> | null
): CopilotMessage {
  const contextLabel = KNYT_TAB_CONTEXT_LABELS[activeTab] ?? 'Codex';
  const focusLine = selectedItem?.title
    ? `Context: ${contextLabel} • ${selectedItem.title}.`
    : `Context: ${contextLabel}.`;

  return {
    id: `knyt-copilot-welcome-${activeTab}`,
    role: 'assistant',
    content: `${focusLine} I can summarize, compare, and route actions (read, watch, wallet checkout) from what is currently open.`,
    timestamp: new Date(0),
  };
}

function buildCodexExplorePrompts(
  activeTab: KnytTabSlug,
  selectedItem?: Pick<KnytContentItem, 'title'> | null
): Array<{ label: string; prompt: string }> {
  const selectedTitle = selectedItem?.title?.trim();
  const titleRef = selectedTitle ? `"${selectedTitle}"` : "the currently visible item";

  switch (activeTab) {
    case 'scrolls':
      return [
        { label: 'Summarize Scroll', prompt: `Summarize ${titleRef} with 5 key points.` },
        { label: 'Extract Insights', prompt: `Extract practical insights from ${titleRef}.` },
        { label: 'Open Reading', prompt: `Open ${titleRef} in reading mode.` },
      ];
    case 'characters':
      return [
        { label: 'Character Brief', prompt: `Give a concise character brief for ${titleRef}.` },
        { label: 'Compare Roles', prompt: `Compare ${titleRef} with another key character in this viewport.` },
        { label: 'Story Arc', prompt: `Show the story arc relevance of ${titleRef}.` },
      ];
    case 'lore':
      return [
        { label: 'Lore Summary', prompt: `Summarize the lore context around ${titleRef}.` },
        { label: 'Canon Check', prompt: `Identify canon anchors and references for ${titleRef}.` },
        { label: 'Open Source Capsule', prompt: `Open source capsule for ${titleRef}.` },
      ];
    case 'digiterra':
    case 'terra':
      return [
        { label: 'Realm Overview', prompt: `Give a realm overview for ${titleRef}.` },
        { label: 'Key Entities', prompt: `List key entities and relationships in ${titleRef}.` },
        { label: 'Suggested Path', prompt: `Suggest the next best exploration path from ${titleRef}.` },
      ];
    case 'order':
      return [
        { label: 'Order Guidance', prompt: `Show order pathway guidance for ${titleRef}.` },
        { label: 'Requirements', prompt: `List requirements and gating for ${titleRef}.` },
        { label: 'Start Task', prompt: `Start the highest-priority task related to ${titleRef}.` },
      ];
    case 'codex':
    default:
      return [
        { label: 'Summarize Selection', prompt: `Summarize ${titleRef} and key takeaways.` },
        { label: 'Compare Editions', prompt: `Compare still vs motion options for ${titleRef}.` },
        { label: 'Open Wallet Checkout', prompt: `Open wallet checkout for ${titleRef}.` },
      ];
  }
}

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

export function KnytTab({ theme = 'dark', density = 'wide', personaId, tabSlug, forcedDevice }: KnytTabProps) {
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
      case 'living-canon':
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
  const showLegacyFallbackUI = false;
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseContent, setPurchaseContent] = useState<{
    type: ContentType;
    id: string;
    title: string;
    image?: string;
    baseKnyt?: number;
    priceUsd?: number;
  } | null>(null);
  
  // Debug purchase modal state
  useEffect(() => {
    console.log('Purchase modal state changed:', purchaseModalOpen);
    console.log('Purchase content:', purchaseContent);
  }, [purchaseModalOpen, purchaseContent]);

  useEffect(() => {
    setActiveTab(resolvedInitialTab);
  }, [resolvedInitialTab]);

  // Listen for wallet drawer CTA navigation events
  useEffect(() => {
    const handler = (e: Event) => {
      const slug = (e as CustomEvent<{ tab: string }>).detail?.tab;
      if (slug && isKnytTabSlug(slug)) setActiveTab(slug);
    };
    window.addEventListener('knyt:navigate-tab', handler);
    return () => window.removeEventListener('knyt:navigate-tab', handler);
  }, []);

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
  const [device, setDevice] = useState<DeviceType>(() => forcedDevice || KnytLiquidUIService.getDeviceType());
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
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [currentVideoTitle, setCurrentVideoTitle] = useState('');
  const [currentVideoSegments, setCurrentVideoSegments] = useState<VideoSegment[]>([]);
  const [currentVideoSegmentIndex, setCurrentVideoSegmentIndex] = useState(0);
  const [currentVideoUseDirectStream, setCurrentVideoUseDirectStream] = useState(false);
  const episodeSegmentsCacheRef = useRef<Map<string, VideoSegment[]>>(new Map());
  const [textReaderOpen, setTextReaderOpen] = useState(false);
  const [currentText, setCurrentText] = useState<{ title: string; content: string } | null>(null);
  // Wallet drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const handleOpenWallet = useCallback((_mode: 'signin' | 'signup') => {
    setDrawerOpen(true);
  }, []);
  const [codexCopilotOpen, setCodexCopilotOpen] = useState(false);
  const [codexCopilotMessages, setCodexCopilotMessages] = useState<CopilotMessage[]>(() => [
    createCodexCopilotWelcomeMessage(resolvedInitialTab),
  ]);
  const lastCopilotContextRef = useRef<string | null>(null);
  
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
  const effectivePersonaId = useMemo(() => {
    const candidates = [personaId, activePersonaId, personas[0]?.id];
    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue;
      const trimmed = candidate.trim();
      if (!trimmed || trimmed === 'default' || trimmed === 'guest') continue;
      return trimmed;
    }
    return undefined;
  }, [personaId, activePersonaId, personas]);
  
  // KNYT balance and cards data
  const { balance, spendableBalance, refreshBalance } = useKnytBalance(effectivePersonaId);
  const { groups, loading: cardsLoading, error: cardsError, refreshCards } = useKnytCards({
    enabled: activeTab === 'characters' || showLegacyFallbackUI,
  });
  const { ownedCharacters, refreshPurchases } = useKnytPurchases(effectivePersonaId);
  const isSignedIn = !!effectivePersonaId;
  const showLayoutPreviewControls = useMemo(() => {
    const allowlist = parseAdminAllowlist(process.env.NEXT_PUBLIC_KNYT_LAYOUT_PREVIEW_ADMINS);
    const forceFromEnv = process.env.NEXT_PUBLIC_KNYT_LAYOUT_PREVIEW_ENABLED === 'true';
    if (forceFromEnv) return true;

    const candidates: string[] = [
      effectivePersonaId || '',
      personaId || '',
      activePersonaId || '',
      ...personas.map((persona) => persona.id || ''),
      ...personas.map((persona) => persona.fioHandle || ''),
      ...personas.map((persona) => persona.displayName || ''),
    ];
    return candidates.some((candidate) => allowlist.has(candidate.toLowerCase()));
  }, [effectivePersonaId, personaId, activePersonaId, personas]);
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

  const normalizeVideoSource = useCallback((raw?: string | null): { cid?: string; url?: string } => {
    if (!raw) return {};
    const value = raw.trim();
    if (!value) return {};

    const routeMatch = value.match(/\/api\/content\/video\/([^/?#]+)/i);
    if (routeMatch?.[1]) {
      return { cid: decodeURIComponent(routeMatch[1]), url: value };
    }

    const cidParam = value.match(/[?&]cid=([^&#]+)/i);
    if (cidParam?.[1]) {
      return { cid: decodeURIComponent(cidParam[1]), url: value };
    }

    if (value.startsWith('/') || /^https?:\/\//i.test(value)) {
      return { url: value };
    }

    return { cid: value };
  }, []);

  const getVideoPlaybackUrl = useCallback((source?: string | null) => {
    if (!source) return null;
    if (source.startsWith('/') || /^https?:\/\//i.test(source)) {
      return source;
    }
    return `/api/content/video/${encodeURIComponent(source)}`;
  }, []);

  type GatingMetadata = {
    requiredMembership?: string | null;
    requiredRole?: string | null;
    requiredEntitlement?: string | null;
    requiredAssetId?: string | null;
    requiredTokenId?: string | null;
    accessRestriction?: string | null;
    requiresOwnership?: boolean | null;
  };

  const resolveAccessPrice = useCallback((value: unknown): number | null => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return numeric;
  }, []);

  // Future-gate stub: membership/asset restrictions can be wired here without routing to payment.
  const hasAccessRestriction = useCallback((value?: GatingMetadata | null): boolean => {
    if (!value) return false;
    return Boolean(
      value.requiredMembership ||
      value.requiredRole ||
      value.requiredEntitlement ||
      value.requiredAssetId ||
      value.requiredTokenId ||
      value.accessRestriction ||
      value.requiresOwnership
    );
  }, []);

  // Helper function to convert KnytContentItem to SmartContentItem
  const knytToSmartContentItem = useCallback((knytItem: KnytContentItem): SmartContentItem => {
    const media = (knytItem.media ?? {}) as {
      text?: string;
      pdf_cid?: string;
      pdf_lite_url?: string;
      video_cid?: string;
      video_url?: string;
      audio_url?: string;
      external_url?: string;
    };
    const metadata = (knytItem.metadata ?? {}) as {
      realm?: string;
      duration?: string;
      created_at?: string;
      updated_at?: string;
    };

    const videoSource = normalizeVideoSource(
      media.video_url ||
      media.video_cid ||
      knytItem.modalities?.watch?.url ||
      knytItem.modalities?.watch?.cid ||
      null
    );

    return {
      id: knytItem.id,
      title: knytItem.title,
      description: knytItem.description,
      excerpt: knytItem.description,
      image: knytItem.thumbnail,
      section: metadata.realm || 'knyt',
      modalities: {
        read: {
          text: media.text,
          available: !!media.text,
          cid: media.pdf_cid,
          duration: metadata.duration,
        },
        watch: {
          video_url: videoSource.url || undefined,
          available: !!(videoSource.cid || videoSource.url),
          cid: videoSource.cid || undefined,
          duration: metadata.duration,
          thumbnail: knytItem.thumbnail,
          type: 'video',
        },
        listen: {
          audio_url: media.audio_url || '',
          duration: metadata.duration,
          cover_image: knytItem.thumbnail,
        },
        link: {
          url: media.external_url || '',
          allow_embed: false,
        },
        view: {
          image_url: knytItem.thumbnail,
        },
      } as ContentModalities,
      pdf_cid: media.pdf_cid,
      pdf_lite_url: media.pdf_lite_url,
      type: knytItem.type,
      created_at: metadata.created_at,
      updated_at: metadata.updated_at,
    };
  }, [normalizeVideoSource]);

  const transformEpisodesToContentItems = useCallback((episodes: EpisodeFromAPI[]): KnytContentItem[] => {
    const items: KnytContentItem[] = [];
    const preorderThumbCandidates: string[] = [];
    
    for (const ep of episodes) {
      const episodeNumber = Number(ep.episodeNumber);
      // Skip episode 0 (placeholder)
      if (!Number.isFinite(episodeNumber) || episodeNumber === 0) continue;
      
      const printCid = ep.printRareCid || ep.printEpicCid || ep.printLegendaryCid;
      const printLiteUrl = ep.printRareLiteUrl || ep.printEpicLiteUrl || ep.printLegendaryLiteUrl;
      const hasReadable = !!printCid;
      const hasCover = !!(ep.coverThumbUrl || ep.coverImageCid);
      const coverThumb =
        ep.coverThumbUrl ||
        (ep.coverImageCid ? `${API_BASE_URL}/api/content/cover/${ep.coverImageCid}?variant=thumb` : undefined);
      if (hasCover && coverThumb) preorderThumbCandidates.push(coverThumb);
      const motionSource = normalizeVideoSource(
        ep.motionMasterCid ||
        (ep as EpisodeFromAPI & { motionMasterUrl?: string; motionMasterPath?: string }).motionMasterUrl ||
        (ep as EpisodeFromAPI & { motionMasterUrl?: string; motionMasterPath?: string }).motionMasterPath ||
        null
      );
      const hasWatchable = ep.hasMotionMaster && Boolean(motionSource.cid || motionSource.url);
      const resolvedPriceKnyt = resolveAccessPrice(ep.priceKnyt);
      const episodeBaseId = ep.purchaseId || `mk_ep${String(episodeNumber).padStart(2, '0')}`;
      
      // Add as comic page (portrait) if has print
      if (hasReadable) {
        items.push({
          id: episodeBaseId,
          type: 'comic_page_portrait',
          title: ep.title || `Episode ${ep.displayNumber}`,
          subtitle: `Episode ${ep.displayNumber}`,
          thumbnail: coverThumb,
          media: { 
            pdf_cid: printCid,
            pdf_lite_url: printLiteUrl,
            video_cid: motionSource.cid,
            video_url: motionSource.url,
          },
          metadata: { 
            episodeNumber, 
            owned: false, // TODO: Check entitlements
            price: resolvedPriceKnyt ?? undefined,
            realm: 'digiterra' 
          },
          modalities: { 
            read: { available: true, cid: printCid },
            watch: hasWatchable ? { available: true, cid: motionSource.cid, url: motionSource.url } : undefined,
          },
        });
      }
      
      // Add motion comic as separate item if available
      if (hasWatchable) {
        items.push({
          id: `${episodeBaseId}_motion`,
          type: 'motion_comic_landscape',
          title: `${ep.title || `Episode ${ep.displayNumber}`} - Motion Comic`,
          subtitle: 'Motion Comic',
          thumbnail: coverThumb,
          media: { video_cid: motionSource.cid, video_url: motionSource.url },
          metadata: { 
            episodeNumber, 
            owned: false, 
            price: resolvedPriceKnyt ?? undefined,
            realm: 'digiterra' 
          },
          modalities: { 
            watch: { available: true, cid: motionSource.cid, url: motionSource.url, duration: '~10 min' } 
          },
        });
      }

      // Ensure preorder/cover-only episodes still render as cards.
      if (!hasReadable && !hasWatchable && hasCover) {
        items.push({
          id: episodeBaseId,
          type: 'comic_cover_portrait',
          title: ep.title || `Episode ${ep.displayNumber}`,
          subtitle: `Episode ${ep.displayNumber}`,
          thumbnail: coverThumb,
          media: {
            image_cid: ep.coverImageCid || undefined,
          },
          metadata: {
            episodeNumber,
            owned: false,
            price: resolvedPriceKnyt ?? undefined,
            realm: 'digiterra',
          },
          modalities: {},
        });
      }
    }

    // Backfill pre-order variants when API data is missing some (or all) tiers.
    const existingVariants = new Set<string>();
    for (const item of items) {
      const title = item.title.toLowerCase();
      if (title.includes('legendary')) existingVariants.add('legendary');
      if (title.includes('epic')) existingVariants.add('epic');
      if (title.includes('rare')) existingVariants.add('rare');
      if (title.includes('common')) existingVariants.add('common');
    }

    const fallbackThumb = preorderThumbCandidates[0];
    for (const variant of PREORDER_CONTENT_VARIANTS) {
      if (existingVariants.has(variant.id)) continue;
      items.push({
        id: `metaKnyts_preorder_${variant.id}`,
        type: 'comic_cover_portrait',
        title: variant.title,
        subtitle: variant.subtitle,
        thumbnail: fallbackThumb,
        media: {
          image_cid: undefined,
        },
        metadata: {
          episodeNumber: PREORDER_VARIANT_EPISODE_NUMBER[variant.id],
          owned: false,
          price: variant.priceKnyt,
          realm: 'digiterra',
        },
        modalities: {},
      });
    }
    
    return items;
  }, [normalizeVideoSource, resolveAccessPrice]);

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
        realm: 'digiterra' as Realm,
      },
      modalities: {
        read: { available: !!char.front_cid, cid: char.front_cid },
      },
    }));
  }, []);

  const transformLoreAssetsToContentItems = useCallback((
    assets: LoreAssetFromAPI[],
    episodeThumbs: Map<number, string>,
    fallbackThumb?: string
  ): KnytContentItem[] => {
    const synopsis = assets.find((asset) => /synopsis/i.test(asset.title));
    const sagaIntroIndex = assets.findIndex((asset) => /saga intro/i.test(asset.title));
    const curated = synopsis && sagaIntroIndex !== -1
      ? assets.filter((_, index) => index !== sagaIntroIndex)
      : assets;

    return curated.map((asset) => {
      const episodeMatch = asset.title.match(/(?:episode|e)\s*#?\s*(-?\d+)/i);
      const episodeNumber = episodeMatch ? Number(episodeMatch[1]) : null;
      const loreThumb =
        (episodeNumber !== null ? episodeThumbs.get(episodeNumber) : undefined) ||
        fallbackThumb;

      return {
        id: `lore_${asset.id}`,
        type: 'lore_snippet',
        title: asset.title,
        subtitle: asset.asset_kind.replace(/_/g, ' '),
        thumbnail: loreThumb,
        media: {
          pdf_cid: asset.auto_drive_cid,
          text: asset.extracted_text || undefined,
        },
        metadata: {
          realm: 'digiterra',
          modalities: asset.extracted_text ? { read: { text: asset.extracted_text } } : undefined,
          episodeNumber: episodeNumber ?? undefined,
        },
        modalities: {
          read: { available: true, cid: asset.auto_drive_cid },
        },
      };
    });
  }, []);

  type SectionContentItem = {
    id?: string;
    content_id?: string;
    title?: string;
    excerpt?: string;
    image?: string;
    tags?: string[];
    modalities?: {
      read?: { available?: boolean; text?: string };
      watch?: { available?: boolean; video_url?: string; duration?: string };
    };
  };

  const transformSectionContentItems = useCallback((
    items: SectionContentItem[],
    options?: {
      realm?: Realm;
      subtitle?: string;
      idPrefix?: string;
    }
  ): KnytContentItem[] => {
    const realm = options?.realm ?? 'terra';
    const subtitle = options?.subtitle ?? 'metaKnyts';
    const idPrefix = options?.idPrefix ?? 'terra';

    return items.map((item, index) => {
      const videoSource = normalizeVideoSource(item.modalities?.watch?.video_url);
      const videoDuration = item.modalities?.watch?.duration;

      return {
        id: `${idPrefix}_${item.content_id || item.id || index}`,
        type: (videoSource.cid || videoSource.url) ? 'motion_comic_landscape' : 'terra_update',
        title: item.title || 'metaKnyts update',
        subtitle,
        description: item.excerpt || undefined,
        thumbnail: item.image || undefined,
        media: {
          text: item.modalities?.read?.text || item.excerpt || undefined,
          video_cid: videoSource.cid,
          video_url: videoSource.url,
        },
        metadata: {
          realm,
          tags: item.tags || [],
        },
        modalities: {
          read: { available: true },
          watch: (videoSource.cid || videoSource.url)
            ? {
                available: true,
                cid: videoSource.cid,
                url: videoSource.url,
                duration: videoDuration,
              }
            : undefined,
        },
      };
    });
  }, [normalizeVideoSource]);

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
      KNYT_CONTENT_CACHE_KEY,
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
                const episodeThumbs = new Map<number, string>();
                for (const item of episodeItems) {
                  const episodeNumber = item.metadata?.episodeNumber;
                  if (typeof episodeNumber === 'number' && item.thumbnail && !episodeThumbs.has(episodeNumber)) {
                    episodeThumbs.set(episodeNumber, item.thumbnail);
                  }
                }
                const preorderFallback =
                  episodeThumbs.get(-4) ||
                  episodeItems.find((item) => item.id === 'metaKnyts_preorder_legendary')?.thumbnail ||
                  episodeItems.find((item) => item.thumbnail)?.thumbnail;
                loreItems = transformLoreAssetsToContentItems(
                  data.assets as LoreAssetFromAPI[],
                  episodeThumbs,
                  preorderFallback
                );
                console.log('[KnytTab] Loaded', loreItems.length, 'lore items');
              }
            }
          } catch (err) {
            console.error('[KnytTab] Failed to load lore assets:', err);
          }

          let terraFeedItems: KnytContentItem[] = [];
          try {
            const sources: Array<{
              tab: string;
              subtitle: string;
              realm: Realm;
              idPrefix: string;
            }> = [
              { tab: 'metaknyts', subtitle: 'metaKnyts', realm: 'terra', idPrefix: 'terra' },
              { tab: 'metaterra', subtitle: 'metaTerra', realm: 'metaterra_or', idPrefix: 'metaterra' },
            ];

            const merged: KnytContentItem[] = [];
            for (const source of sources) {
              const terraRes = await fetch(`${apiBase}/api/content/section/scrolls?tab=${source.tab}&scope=codex`);
              if (!terraRes.ok) continue;
              const payload = await terraRes.json();
              const sectionItems = Array.isArray(payload?.content) ? (payload.content as SectionContentItem[]) : [];
              merged.push(
                ...transformSectionContentItems(sectionItems, {
                  realm: source.realm,
                  subtitle: source.subtitle,
                  idPrefix: source.idPrefix,
                })
              );
            }

            const seen = new Set<string>();
            terraFeedItems = merged.filter((item) => {
              if (seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            });
            console.log('[KnytTab] Loaded', terraFeedItems.length, 'Terra/metaKnyts feed items');
          } catch (err) {
            console.error('[KnytTab] Failed to load Terra/metaKnyts feed:', err);
          }

          const terraItems = transformIssuePackageMetaKnytsToContentItems();
          if (terraItems.length > 0) {
            console.log('[KnytTab] Loaded', terraItems.length, 'Terra/metaKnyts items from issue package');
          }
          
          return [...episodeItems, ...characterItems, ...loreItems, ...terraFeedItems, ...terraItems];
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
  }, [
    transformEpisodesToContentItems,
    transformCharactersToContentItems,
    transformLoreAssetsToContentItems,
    transformSectionContentItems,
    transformIssuePackageMetaKnytsToContentItems,
  ]);

  // Fetch owned episodes
  const fetchOwnedEpisodes = useCallback(async () => {
    if (!effectivePersonaId) {
      setOwnedEpisodeNumbers(new Set());
      setOwnedIssues([]);
      return;
    }
    try {
      const apiBase = API_BASE_URL;
      const cacheKey = `codex:knyt:owned:${effectivePersonaId}`;
      const cached = getCachedValue<number[]>(cacheKey);
      if (cached) {
        setOwnedEpisodeNumbers(new Set(cached));
        return;
      }
      const ownedRes = await fetch(`${apiBase}/api/codex/owned?personaId=${effectivePersonaId}`);
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
  }, [effectivePersonaId]);

  const fetchEpisodesCatalog = useCallback(async () => {
    return getCachedOrFetch<EpisodeFromAPI[]>(
      KNYT_EPISODES_CACHE_KEY,
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

  useEffect(() => {
    if (!forcedDevice) return;
    setDevice(forcedDevice);
  }, [forcedDevice]);

  // Handle window resize for device detection
  useEffect(() => {
    if (forcedDevice) return;
    const handleResize = () => {
      setDevice(KnytLiquidUIService.getDeviceType());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [service, forcedDevice]);

  // Load content from real API
  useEffect(() => {
    const memoryCached = getCachedValue<KnytContentItem[]>(KNYT_CONTENT_CACHE_KEY);
    if (memoryCached && memoryCached.length > 0) {
      setContentItems(memoryCached);
      setLoading(false);
      return;
    }

    const sessionSnapshot = readKnytSessionSnapshot();
    if (sessionSnapshot && sessionSnapshot.contentItems.length > 0) {
      setContentItems(sessionSnapshot.contentItems);
      if (sessionSnapshot.episodesCatalog.length > 0) {
        setEpisodesCatalog(sessionSnapshot.episodesCatalog);
      }
      setLoading(false);
      return;
    }

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
      const memoryCached = getCachedValue<EpisodeFromAPI[]>(KNYT_EPISODES_CACHE_KEY);
      if (memoryCached && memoryCached.length > 0) {
        setEpisodesCatalog(memoryCached);
        return;
      }
      const sessionSnapshot = readKnytSessionSnapshot();
      if (sessionSnapshot && sessionSnapshot.episodesCatalog.length > 0) {
        setEpisodesCatalog(sessionSnapshot.episodesCatalog);
        return;
      }
      const episodes = await fetchEpisodesCatalog();
      setEpisodesCatalog(episodes);
    }
    loadEpisodes();
  }, [fetchEpisodesCatalog]);

  const fetchEpisodeSegments = useCallback(async (episodeId?: string | null): Promise<VideoSegment[]> => {
    if (!episodeId) return [];
    const cached = episodeSegmentsCacheRef.current.get(episodeId);
    if (cached) return cached;
    try {
      const apiBase = API_BASE_URL;
      const response = await fetch(`${apiBase}/api/content/video/segments?episodeId=${encodeURIComponent(episodeId)}`);
      if (!response.ok) return [];
      const segments = (await response.json()) as VideoSegment[];
      const normalized = Array.isArray(segments) ? segments.filter((segment) => !!segment?.auto_drive_cid) : [];
      episodeSegmentsCacheRef.current.set(episodeId, normalized);
      return normalized;
    } catch (error) {
      console.warn('[KnytTab] Failed to fetch episode segments:', error);
      return [];
    }
  }, []);

  const openEpisodeVideo = useCallback(async (episode: EpisodeFromAPI, fallbackVideoCid?: string | null, fallbackVideoUrl?: string | null) => {
    const motionSource = normalizeVideoSource(
      fallbackVideoUrl ||
      fallbackVideoCid ||
      (episode as EpisodeFromAPI & { motionMasterUrl?: string; motionMasterPath?: string }).motionMasterUrl ||
      (episode as EpisodeFromAPI & { motionMasterUrl?: string; motionMasterPath?: string }).motionMasterPath ||
      episode.motionMasterCid ||
      null
    );

    const segments = await fetchEpisodeSegments(episode.motionMasterId || null);
    if (segments.length > 0) {
      const first = segments[0];
      setCurrentVideoSegments(segments);
      setCurrentVideoSegmentIndex(0);
      setCurrentVideoCid(first.auto_drive_cid);
      setCurrentVideoUrl(`/api/content/video/${encodeURIComponent(first.auto_drive_cid)}`);
      setCurrentVideoTitle(episode.title || `Episode ${episode.displayNumber} - Motion Comic`);
      setCurrentVideoUseDirectStream(true);
      setVideoPlayerOpen(true);
      return;
    }

    if (motionSource.cid || motionSource.url) {
      setCurrentVideoSegments([]);
      setCurrentVideoSegmentIndex(0);
      setCurrentVideoCid(motionSource.cid || null);
      setCurrentVideoUrl(motionSource.url || getVideoPlaybackUrl(motionSource.cid) || null);
      setCurrentVideoTitle(episode.title || `Episode ${episode.displayNumber} - Motion Comic`);
      setCurrentVideoUseDirectStream(true);
      setVideoPlayerOpen(true);
    }
  }, [fetchEpisodeSegments, getVideoPlaybackUrl, normalizeVideoSource]);

  useEffect(() => {
    if (!contentItems.length && !episodesCatalog.length) return;
    writeKnytSessionSnapshot(contentItems, episodesCatalog);
  }, [contentItems, episodesCatalog]);

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

  const derivedCharacterGroups = useMemo<EpisodeGroup[]>(() => {
    const characterItems = contentWithOwnership.filter((item) => item.type === 'character_portrait');
    if (!characterItems.length) return [];

    const parseCoverCid = (thumbnail?: string, imageCid?: string): string => {
      if (imageCid) return imageCid;
      if (!thumbnail) return '';
      const coverRouteMatch = thumbnail.match(/\/api\/content\/cover\/([^/?#]+)/i);
      if (coverRouteMatch?.[1]) return decodeURIComponent(coverRouteMatch[1]);
      return '';
    };

    const grouped = new Map<number, { posters: KnytCardAsset[]; sheets: KnytCardAsset[] }>();
    for (const item of characterItems) {
      const episodeNumber =
        typeof item.metadata?.episodeNumber === 'number' ? item.metadata.episodeNumber : 0;
      if (!grouped.has(episodeNumber)) {
        grouped.set(episodeNumber, { posters: [], sheets: [] });
      }
      grouped.get(episodeNumber)!.posters.push({
        id: item.id,
        title: item.title,
        episodeNumber,
        assetKind: 'character_poster',
        autoDriveCid: parseCoverCid(item.thumbnail, item.media?.image_cid),
        mimeType: 'image/*',
        characterName: (item.metadata?.characterName as string | undefined) || undefined,
        digiterraName: item.title,
      });
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([episodeNumber, assets]) => ({
        episodeNumber,
        displayNumber: `#${episodeNumber - 1}`,
        posters: assets.posters,
        sheets: assets.sheets,
      }));
  }, [contentWithOwnership]);

  const effectiveCharacterGroups = useMemo(
    () => (groups.length > 0 ? groups : derivedCharacterGroups),
    [groups, derivedCharacterGroups]
  );

  const contentForActiveTab = useMemo(() => {
    switch (activeTab) {
      case 'scrolls':
        return contentWithOwnership.filter(
          (item) =>
            (item.id.startsWith('mk_ep') || item.id.startsWith('metaKnyts_preorder_')) &&
            (
              item.type === 'comic_page_portrait' ||
              item.type === 'comic_cover_portrait'
            )
        );
      case 'characters':
        return contentWithOwnership.filter((item) => item.type === 'character_portrait');
      case 'lore':
        return contentWithOwnership.filter((item) => item.type === 'lore_snippet');
      case 'digiterra':
        return contentWithOwnership.filter(
          (item) => item.metadata?.realm === 'digiterra' && item.type !== 'motion_comic_landscape'
        );
      case 'terra':
      {
        const realmScoped = contentWithOwnership.filter(
          (item) =>
            item.metadata?.realm === 'terra' ||
            item.metadata?.realm === 'metaterra_or' ||
            item.type === 'terra_update'
        );
        if (realmScoped.length > 0) return realmScoped;

        // Fail-safe: preserve rendering if realm tags are missing in upstream payloads.
        const inferred = contentWithOwnership.filter(
          (item) =>
            item.id.startsWith('terra_') ||
            item.id.startsWith('metaterra_') ||
            item.type === 'motion_comic_landscape'
        );
        return inferred.length > 0 ? inferred : contentWithOwnership;
      }
      case 'order':
        return contentWithOwnership;
      case 'codex':
      default:
        return contentWithOwnership;
    }
  }, [contentWithOwnership, activeTab]);

  useEffect(() => {
    if (activeTab === 'terra') {
      setActiveRealm((prev) => (prev === 'terra' || prev === 'metaterra_or' ? prev : 'terra'));
      return;
    }
    if (activeTab === 'digiterra') {
      setActiveRealm('digiterra');
      return;
    }
    setActiveRealm('digiterra');
  }, [activeTab]);

  useEffect(() => {
    // Prevent Terra realm intent from leaking into Codex tab template selection.
    if (activeTab === 'codex' && userIntent === 'realm_navigation') {
      setUserIntent('browse');
    }
  }, [activeTab, userIntent]);

  // Select template based on context
  useEffect(() => {
    if (loading) return;

    const contentMix = service.inferContentMix(contentForActiveTab);
    const hasActiveTasks = !!taskData.activeTask;
    const scopedRealm = activeTab === 'terra' || activeTab === 'digiterra' ? activeRealm : undefined;
    const effectiveUserIntent =
      activeTab === 'codex' && userIntent === 'realm_navigation'
        ? 'browse'
        : userIntent;

    const context: TemplateSelectionContext = {
      userIntent: effectiveUserIntent,
      device,
      contentMix,
      realm: scopedRealm,
      taskState: hasActiveTasks ? 'active' : 'idle',
      isFirstVisit: false,
      personaId: effectivePersonaId,
    };

    const result = service.selectTemplate(context);
    const forcedTemplateByTab: Partial<Record<string, KnytTemplateId>> = {
      scrolls: 'knyt:drawer_grid_v1',
      characters: 'knyt:dual_poster_stage_v1',
      lore: 'knyt:drawer_grid_v1',
      digiterra: 'knyt:drawer_grid_v1',
      terra: 'knyt:realm_bridge_map_v1',
      order: 'knyt:quest_hud_hub_v1',
      'living-canon': 'knyt:living_canon_v1',
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
        if (activeTab === 'lore' || activeTab === 'codex') {
          setLayoutVariant('1C');
        } else if (composed.meta?.drawerGridLayoutVariant) {
          setLayoutVariant(composed.meta.drawerGridLayoutVariant);
        } else {
          setLayoutVariant('auto');
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
        setLayoutVariant(activeTab === 'lore' || activeTab === 'codex' ? '1C' : 'auto');
      }
    } else {
      setCuratedContent(null);
      setLayoutVariant(activeTab === 'lore' || activeTab === 'codex' ? '1C' : 'auto');
    }

    // Update copilot mode
    if (finalResult.copilotMode !== copilotMode) {
      setCopilotMode(finalResult.copilotMode);
    }
  }, [loading, contentForActiveTab, userIntent, device, activeRealm, effectivePersonaId, taskData, service, selectedItemId, activeTab, copilotMode]);

  const handleBackFromCharacterDetail = () => {
    setShowCharacterDetail(false);
    setSelectedCharacterId(null);
  };

  const resolveEpisodeNumber = useCallback((item: KnytContentItem): number | null => {
    const rawEpisode = item.metadata?.episodeNumber;
    if (typeof rawEpisode === 'number' && Number.isFinite(rawEpisode)) {
      return rawEpisode;
    }
    if (typeof rawEpisode === 'string') {
      const parsed = Number(rawEpisode);
      if (Number.isFinite(parsed)) return parsed;
    }

    const preorderMatch = item.id.match(/^metaKnyts_preorder_(legendary|epic|rare|common)$/);
    if (preorderMatch) {
      return PREORDER_VARIANT_EPISODE_NUMBER[preorderMatch[1] as PreorderVariantId];
    }

    const episodeMatch = item.id.match(/^mk_ep(-?\d+)/);
    if (episodeMatch) {
      const parsed = Number(episodeMatch[1]);
      if (Number.isFinite(parsed)) return parsed;
    }

    return null;
  }, []);

  const resolvePreorderVariantId = useCallback((
    item: KnytContentItem,
    episodeNumber: number | null,
  ): PreorderVariantId | null => {
    const preorderMatch = item.id.match(/^metaKnyts_preorder_(legendary|epic|rare|common)$/);
    if (preorderMatch) {
      return preorderMatch[1] as PreorderVariantId;
    }

    if (episodeNumber === null) return null;
    const matched = (Object.entries(PREORDER_VARIANT_EPISODE_NUMBER) as Array<[PreorderVariantId, number]>)
      .find(([, value]) => value === episodeNumber);
    return matched ? matched[0] : null;
  }, []);

  // Event handlers for Liquid UI content
  const isEpisodeLocked = useCallback((item: KnytContentItem) => {
    const episodeNumber = resolveEpisodeNumber(item);
    if (episodeNumber === null) return false;
    const hasPaidGate = resolveAccessPrice(item.metadata?.price) !== null;
    const hasRestrictionGate = hasAccessRestriction(item.metadata as GatingMetadata | undefined);
    if (!hasPaidGate && !hasRestrictionGate) {
      return false;
    }
    if (hasPaidGate) {
      return !item.metadata?.owned;
    }
    return true;
  }, [resolveEpisodeNumber, resolveAccessPrice, hasAccessRestriction]);

  const openPurchaseForItem = useCallback((item: KnytContentItem, action: 'read' | 'watch' | 'default' = 'default') => {
    const episodeNumber = resolveEpisodeNumber(item);
    console.log('openPurchaseForItem called:', { item: item.id, action, episodeNumber });
    
    const preorderVariantId = resolvePreorderVariantId(item, episodeNumber);
    const itemPrice = resolveAccessPrice(item.metadata?.price);
    if (!preorderVariantId && itemPrice === null) {
      console.log('No purchasable metadata, returning');
      return;
    }
    
    const contentType: ContentType =
      action === 'watch' || item.type === 'motion_comic_landscape'
        ? 'scroll_motion'
        : 'scroll_still';
    
    // Handle preorder variants with specific pricing
    let baseKnyt = itemPrice ?? 0;
    let priceUsd = Number((baseKnyt * 1.4).toFixed(2));
    
    // Check if this is a preorder variant and apply specific pricing
    if (preorderVariantId) {
      const variant = PREORDER_CONTENT_VARIANTS.find(v => v.id === preorderVariantId);
      if (variant) {
        console.log('Found preorder variant:', preorderVariantId, 'price:', variant.priceKnyt);
        baseKnyt = variant.priceKnyt;
        priceUsd = Number((variant.priceKnyt * 1.4).toFixed(2));
      } else {
        console.log('Preorder variant not found:', preorderVariantId);
      }
    }
    
    const purchaseData = {
      type: contentType,
      id: preorderVariantId ? `metaKnyts_preorder_${preorderVariantId}` : item.id.replace(/_motion$/, ''),
      title: item.title,
      image: item.thumbnail,
      baseKnyt,
      priceUsd,
    };
    
    console.log('Setting purchase content:', purchaseData);
    setPurchaseContent(purchaseData);
    console.log('Setting purchase modal open');
    setPurchaseModalOpen(true);
  }, [resolveEpisodeNumber, resolvePreorderVariantId, resolveAccessPrice]);

  const getOwnedIssuesForEpisode = useCallback((episodeNumber: number) => {
    return ownedIssues.filter((issue) => issue.episodeNumber === episodeNumber);
  }, [ownedIssues]);

  const openPurchaseForEpisode = useCallback((episode: EpisodeFromAPI, action: 'read' | 'watch' | 'default' = 'default') => {
    const explicitPriceKnyt = resolveAccessPrice(episode.priceKnyt);
    if (explicitPriceKnyt === null) {
      return;
    }
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
      baseKnyt: explicitPriceKnyt,
      priceUsd: episode.priceUsd ?? (explicitPriceKnyt * 1.4),
    });
    setPurchaseModalOpen(true);
  }, [resolveAccessPrice]);

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

  const openCopilotWithContext = useCallback((item: KnytContentItem) => {
    const actionHints: string[] = [];
    if (item.modalities?.read?.available || item.media?.text) actionHints.push('read');
    if (item.modalities?.watch?.available || item.media?.video_cid || item.media?.video_url) actionHints.push('watch');
    if (resolveAccessPrice(item.metadata?.price) !== null) {
      actionHints.push('buy');
    }

    setCodexCopilotMessages((prev) => {
      const base = prev.length > 0 ? prev : [createCodexCopilotWelcomeMessage(activeTab, item)];
      return [
        ...base,
        {
          id: `knyt-copilot-context-${item.id}-${Date.now()}`,
          role: 'assistant',
          content: `Context loaded: ${item.title} (${activeTab}). Available actions: ${actionHints.join(', ')}.`,
          timestamp: new Date(),
        },
      ];
    });
    setCodexCopilotOpen(true);
  }, [activeTab, resolveAccessPrice]);

  const openShareForItem = useCallback((item: KnytContentItem) => {
    triadActions.openShare({
      id: item.id,
      title: item.title,
      description: item.subtitle || item.description || item.media?.text?.slice(0, 180),
      section: activeTab.toUpperCase(),
      type: item.modalities?.watch?.available || item.media?.video_cid || item.media?.video_url ? "video" : "text",
      url: item.metadata?.modalities?.link?.url,
    });
  }, [activeTab, triadActions]);

  const handleSmartAction = useCallback((item: KnytContentItem, action: string) => {
    console.log('handleSmartAction called:', { item: item.id, action, itemType: item.type });
    
    // Convert to SmartContentItem for SmartContent system integration
    const smartContentItem = knytToSmartContentItem(item);
    
    // Handle SmartContent actions (read, watch, listen, share, etc.)
    if (['read', 'watch', 'listen', 'share', 'link', 'view', 'expand'].includes(action)) {
      // For SmartContent actions, we'll let the context handle them
      // The actual handling will be done by the SmartContentActionProvider
      console.log('[KnytTab] Delegating SmartContent action:', action, 'for item:', item.title);
      
      // Store the action and item for the context to handle
      window.dispatchEvent(new CustomEvent('smartContentAction', {
        detail: { item: smartContentItem, action: action as ActionType }
      }));
      return;
    }
    
    // Handle legacy KNYT-specific actions
    if (action === 'buy') {
      const resolvedItemPrice = resolveAccessPrice(item.metadata?.price);
      if (item.type === 'character_portrait') {
        if (resolvedItemPrice === null) {
          return;
        }
        console.log('Processing character portrait purchase');
        setPurchaseContent({
          type: 'character_card',
          id: item.id,
          title: item.title,
          image: item.thumbnail,
          baseKnyt: resolvedItemPrice,
          priceUsd: Number((resolvedItemPrice * 1.4).toFixed(2)),
        });
        setPurchaseModalOpen(true);
        return;
      }

      const episodeNumber = resolveEpisodeNumber(item);
      const isPreorderVariant = resolvePreorderVariantId(item, episodeNumber) !== null;
      if (resolvedItemPrice !== null || isPreorderVariant) {
        openPurchaseForItem(item, item.type === 'motion_comic_landscape' ? 'watch' : 'read');
        return;
      }
    }

    if ((action === 'read' || action === 'watch') && isEpisodeLocked(item)) {
      openPurchaseForItem(item, action === 'watch' ? 'watch' : 'read');
      return;
    }
    
    // Fallback to legacy handling for any remaining cases
    if (action === 'read' && item.media?.text) {
      setCurrentText({ title: item.title, content: item.media.text });
      setTextReaderOpen(true);
    } else if (action === 'watch') {
      const episodeNumber = typeof item.metadata?.episodeNumber === 'number' ? item.metadata.episodeNumber : null;
      if (episodeNumber !== null) {
        const matchedEpisode = episodesCatalog.find((episode) => episode.episodeNumber === episodeNumber);
        if (matchedEpisode) {
          const videoSource = normalizeVideoSource(
            item.media?.video_url ||
            item.media?.video_cid ||
            item.modalities?.watch?.url ||
            item.modalities?.watch?.cid ||
            null
          );
          void openEpisodeVideo(matchedEpisode, videoSource.cid || null, videoSource.url || null);
          return;
        }
      }
      const videoSource = normalizeVideoSource(
        item.media?.video_url ||
        item.media?.video_cid ||
        item.modalities?.watch?.url ||
        item.modalities?.watch?.cid ||
        null
      );
      if (!(videoSource.cid || videoSource.url)) return;
      setCurrentVideoSegments([]);
      setCurrentVideoSegmentIndex(0);
      setCurrentVideoUseDirectStream(false);
      setCurrentVideoCid(videoSource.cid || null);
      setCurrentVideoUrl(videoSource.url || getVideoPlaybackUrl(videoSource.cid) || null);
      setCurrentVideoTitle(item.title);
      setVideoPlayerOpen(true);
    } else if (action === 'share') {
      openShareForItem(item);
    } else if (action === 'copilot') {
      if (templateResult?.drawerMode === 'wide') {
        setDrawerOpen(true);
        setSelectedItemId(item.id);
      } else {
        openCopilotWithContext(item);
      }
      toast({
        title: 'Copilot ready',
        description:
          templateResult?.drawerMode === 'wide'
            ? `Wallet Copilot opened for ${item.title}.`
            : `KNYT Copilot opened with ${item.title} context.`,
      });
    }
  }, [episodesCatalog, getVideoPlaybackUrl, isEpisodeLocked, normalizeVideoSource, openEpisodeVideo, openPurchaseForItem, openCopilotWithContext, toast, templateResult, knytToSmartContentItem, resolveAccessPrice, resolveEpisodeNumber, resolvePreorderVariantId]);

  // SmartContent action handler for custom events
  useEffect(() => {
    const handleSmartContentEvent = (event: CustomEvent) => {
      const { item, action } = event.detail;
      console.log('[KnytTab] Received SmartContent action:', action, 'for item:', item.title);
      
      // Use the SmartContentActionContext to handle the action
      // This will be available because we're wrapped in the provider
      import('@/app/hooks/useSmartContentAction').then(({ useSmartContentAction }) => {
        // We need to call this within the component context
        // For now, let's handle basic actions directly
        if (action === 'share') {
          console.log('[KnytTab] Handling share action for:', item.title);
          // Share action will be handled by the global context
        } else if (action === 'read' && item.modalities?.read?.text) {
          console.log('[KnytTab] Handling read action for:', item.title);
          // Read action will be handled by the global context
        } else if (action === 'watch' && item.modalities?.watch?.video_url) {
          console.log('[KnytTab] Handling watch action for:', item.title);
          // Watch action will be handled by the global context
        }
      });
    };

    window.addEventListener('smartContentAction', handleSmartContentEvent as EventListener);
    return () => {
      window.removeEventListener('smartContentAction', handleSmartContentEvent as EventListener);
    };
  }, []);

  const selectedContentItem = useMemo(() => {
    if (!selectedItemId) return undefined;
    return contentForActiveTab.find((item) => item.id === selectedItemId);
  }, [contentForActiveTab, selectedItemId]);

  const selectedSmartContent = useMemo<SmartContentQube | undefined>(() => {
    const source = selectedContentItem || contentForActiveTab[0];
    if (!source) return undefined;
    const basePrice = resolveAccessPrice(source.metadata?.price) ?? 0;
    return {
      id: source.id,
      app: 'metaKnyts',
      title: source.title,
      creatorRootDid: process.env.NEXT_PUBLIC_KNYT_CREATOR_DID || '',
      pricingModel: {
        kind: 'payPerIssue',
        tiers: [
          {
            amount: Number.isFinite(basePrice) ? basePrice : 0,
            currency: 'QCT',
            kind: 'fixed',
          },
        ],
      },
    } as unknown as SmartContentQube;
  }, [selectedContentItem, contentForActiveTab, resolveAccessPrice]);

  const codexExploreQuickPrompts = useMemo(
    () => buildCodexExplorePrompts(activeTab, selectedContentItem),
    [activeTab, selectedContentItem?.id, selectedContentItem?.title]
  );

  const codexWalletAgent = useMemo(() => {
    return {
      id: 'knyt-codex',
      name: 'KNYT Copilot',
      fioHandle: 'knyt@aigentz',
      evmArb: process.env.NEXT_PUBLIC_KNYT_CREATOR_EVM as `0x${string}` | undefined,
    };
  }, []);

  useEffect(() => {
    if (!codexCopilotOpen) return;
    setCodexCopilotMessages((prev) => {
      const hasUserMessage = prev.some((message) => message.role === 'user');
      if (hasUserMessage) return prev;

      const welcome = createCodexCopilotWelcomeMessage(activeTab, selectedContentItem);
      const existingWelcome = prev.find((message) => message.id.startsWith('knyt-copilot-welcome'));
      if (existingWelcome?.id === welcome.id && existingWelcome.content === welcome.content) {
        return prev;
      }

      const withoutWelcome = prev.filter((message) => !message.id.startsWith('knyt-copilot-welcome'));
      return [welcome, ...withoutWelcome];
    });
  }, [codexCopilotOpen, activeTab, selectedContentItem?.id, selectedContentItem?.title]);

  useEffect(() => {
    if (!codexCopilotOpen || !selectedContentItem) return;
    if (lastCopilotContextRef.current === selectedContentItem.id) return;
    lastCopilotContextRef.current = selectedContentItem.id;
    setCodexCopilotMessages((prev) => {
      const base = prev.length > 0 ? prev : [createCodexCopilotWelcomeMessage(activeTab, selectedContentItem)];
      return [
        ...base,
        {
          id: `knyt-copilot-selection-${selectedContentItem.id}-${Date.now()}`,
          role: 'assistant',
          content: `Selected content updated: ${selectedContentItem.title}.`,
          timestamp: new Date(),
        },
      ];
    });
  }, [codexCopilotOpen, selectedContentItem, activeTab]);

  const handleViewerOpen = useCallback((item: KnytContentItem, type: 'pdf' | 'video' | 'poster') => {
    if (isEpisodeLocked(item)) {
      openPurchaseForItem(item, type === 'video' ? 'watch' : 'read');
      return;
    }
    if (type === 'pdf' && item.media?.text && !item.media?.pdf_lite_url && !item.media?.pdf_cid) {
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
    } else if (type === 'video') {
      const episodeNumber = typeof item.metadata?.episodeNumber === 'number' ? item.metadata.episodeNumber : null;
      if (episodeNumber !== null) {
        const matchedEpisode = episodesCatalog.find((episode) => episode.episodeNumber === episodeNumber);
        if (matchedEpisode) {
          const videoSource = normalizeVideoSource(
            item.media?.video_url ||
            item.media?.video_cid ||
            item.modalities?.watch?.url ||
            item.modalities?.watch?.cid ||
            null
          );
          void openEpisodeVideo(matchedEpisode, videoSource.cid || null, videoSource.url || null);
          return;
        }
      }
      const videoSource = normalizeVideoSource(
        item.media?.video_url ||
        item.media?.video_cid ||
        item.modalities?.watch?.url ||
        item.modalities?.watch?.cid ||
        null
      );
      if (!(videoSource.cid || videoSource.url)) return;
      setCurrentVideoSegments([]);
      setCurrentVideoSegmentIndex(0);
      setCurrentVideoUseDirectStream(false);
      setCurrentVideoCid(videoSource.cid || null);
      setCurrentVideoUrl(videoSource.url || getVideoPlaybackUrl(videoSource.cid) || null);
      setCurrentVideoTitle(item.title);
      setVideoPlayerOpen(true);
    }
  }, [episodesCatalog, getVideoPlaybackUrl, isEpisodeLocked, normalizeVideoSource, openEpisodeVideo, openPurchaseForItem]);

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
  if (showLegacyFallbackUI && isLegacyFallbackTab && cardsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-400" />
          <p className="text-white/60">Loading KNYT Cards...</p>
        </div>
      </div>
    );
  }

  if (showLegacyFallbackUI && isLegacyFallbackTab && cardsError) {
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
    <SmartContentActionProvider>
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
              contentItems={
                activeTab !== 'codex' && activeTab !== 'lore'
                  ? contentForActiveTab
                  : curatedContent && curatedContent.length > 0
                    ? curatedContent
                    : contentForActiveTab
              }
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
              fullCatalogGrid={activeTab === 'scrolls' || activeTab === 'digiterra'}
              characterGridMode={activeTab === 'characters'}
              characterGroups={effectiveCharacterGroups}
              ownedCharacters={ownedCharacters}
              personaId={effectivePersonaId}
              knytBalance={balance?.dvnKnyt || 0}
              spendableKnyt={spendableBalance || 0}
              onBalanceRefresh={refreshBalance}
              onPurchaseComplete={refreshPurchases}
              showLayoutPreviewControls={showLayoutPreviewControls}
              walletDrawerContent={
                templateResult.drawerMode === 'wide' ? (
                  <SmartWalletDrawer
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    variant="overlay"
                    codexMode={true}
                    agent={codexWalletAgent}
                    personaId={effectivePersonaId}
                    currentContent={selectedSmartContent}
                    onPurchaseComplete={() => {
                      refreshPurchases();
                      fetchOwnedEpisodes();
                    }}
                    onOpenCopilot={() => setCodexCopilotOpen(true)}
                  />
                ) : (
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
                )
              }
            />
          </div>

          {/* Legacy fallback tabs for compatibility */}
          {showLegacyFallbackUI && !isExternallyScopedTab && activeTab !== 'codex' && (
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
                  <Button className="bg-amber-500 hover:bg-amber-600" onClick={() => handleOpenWallet('signin')}>
                    Open Wallet
                  </Button>
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
                      const episodeVideo = normalizeVideoSource(
                        episode.motionMasterCid ||
                        (episode as EpisodeFromAPI & { motionMasterUrl?: string; motionMasterPath?: string }).motionMasterUrl ||
                        (episode as EpisodeFromAPI & { motionMasterUrl?: string; motionMasterPath?: string }).motionMasterPath ||
                        null
                      );
                      const hasMaster =
                        episode.hasStillMaster ||
                        episode.hasMotionMaster ||
                        episode.hasPrintRare ||
                        episode.hasPrintEpic ||
                        episode.hasPrintLegendary;
                      const isAvailable = hasMaster;
                      const priceKnyt = resolveAccessPrice(episode.priceKnyt);
                      const priceUsd = episode.priceUsd ?? ((priceKnyt ?? 0) * 1.4);
                      const isPaymentGated = priceKnyt !== null;

                      return (
                        <div
                          key={episode.episodeNumber}
                          className={`group relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 ${
                            isOwned ? 'ring-2 ring-cyan-400/50' : 'hover:ring-2 hover:ring-white/30'
                          }`}
                          onClick={() => {
                            const printCid = episode.printRareCid || episode.printEpicCid || episode.printLegendaryCid;
                            if (!isOwned && isAvailable && isPaymentGated) {
                              openPurchaseForEpisode(episode);
                              return;
                            }
                            if (printCid) {
                              setCurrentPdfLiteUrl(
                                episode.printRareLiteUrl || episode.printEpicLiteUrl || episode.printLegendaryLiteUrl || null
                              );
                              setCurrentPdfCid(printCid);
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
                            {isAvailable && !isOwned && isPaymentGated && (
                              <span className="px-2 py-1 bg-amber-500/90 text-white text-xs font-bold rounded flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Coins className="w-3 h-3" />
                                {priceKnyt} KNYT
                              </span>
                            )}
                          </div>

                          <div className="absolute bottom-12 right-2 flex gap-1 z-10">
                            {isAvailable && !isOwned && isPaymentGated && (
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
                                    baseKnyt: priceKnyt ?? 0,
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
                                  if (!isOwned && isAvailable && isPaymentGated) {
                                    openPurchaseForEpisode(episode, 'read');
                                    return;
                                  }
                                  if (printCid) {
                                    setCurrentPdfLiteUrl(
                                      episode.printRareLiteUrl || episode.printEpicLiteUrl || episode.printLegendaryLiteUrl || null
                                    );
                                    setCurrentPdfCid(printCid);
                                    setCurrentPdfTitle(episode.title || `Episode ${episode.displayNumber}`);
                                    setPdfViewerOpen(true);
                                  }
                                }}
                              >
                                <BookOpen className="w-3 h-3" />
                              </button>
                            )}
                            {episode.hasMotionMaster && (episodeVideo.cid || episodeVideo.url) && (
                              <button
                                className="w-6 h-6 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-cyan-500/40 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all"
                                title="Watch"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!isOwned && isAvailable && isPaymentGated) {
                                    openPurchaseForEpisode(episode, 'watch');
                                    return;
                                  }
                                  void openEpisodeVideo(episode, episodeVideo.cid || null, episodeVideo.url || null);
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
                            ) : isAvailable && isPaymentGated ? (
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
                    groups={effectiveCharacterGroups}
                    ownedCharacters={ownedCharacters}
                    personaId={effectivePersonaId}
                    knytBalance={balance?.dvnKnyt || 0}
                    spendableKnyt={spendableBalance || 0}
                    onBalanceRefresh={refreshBalance}
                    onPurchaseComplete={refreshPurchases}
                    onOpenWallet={handleOpenWallet}
                    loading={cardsLoading}
                    error={cardsError}
                    onRetry={refreshCards}
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

          {/* PDF Lite modal (preferred when URL is available) */}
          {pdfViewerOpen && currentPdfLiteUrl && (
            <PDFLiteReaderModal
              open={pdfViewerOpen}
              pdfUrl={currentPdfLiteUrl}
              title={currentPdfTitle}
              onClose={() => {
                setPdfViewerOpen(false);
                setCurrentPdfLiteUrl(null);
                setCurrentPdfCid(null);
                setCurrentPdfTitle('');
              }}
            />
          )}

          {/* Custody-safe PDF viewer (page-image fallback) */}
          {pdfViewerOpen && !currentPdfLiteUrl && currentPdfCid && (
            <>
              {console.log('[KnytTab] Rendering PDFPageViewer with CID:', currentPdfCid)}
              <PDFPageViewer
                cid={currentPdfCid}
                title={currentPdfTitle}
                onClose={() => {
                  setPdfViewerOpen(false);
                  setCurrentPdfLiteUrl(null);
                  setCurrentPdfCid(null);
                  setCurrentPdfTitle('');
                }}
              />
            </>
          )}

          {/* Video Player Modal */}
          {videoPlayerOpen && (currentVideoUrl || currentVideoCid) && (
            <VideoErrorBoundary
              onClose={() => {
                setVideoPlayerOpen(false);
                setCurrentVideoCid(null);
                setCurrentVideoUrl(null);
                setCurrentVideoTitle('');
                setCurrentVideoSegments([]);
                setCurrentVideoSegmentIndex(0);
                setCurrentVideoUseDirectStream(false);
              }}
            >
              <VideoPlayer
                videoUrl={currentVideoUrl || getVideoPlaybackUrl(currentVideoCid) || ''}
                title={currentVideoTitle}
                segments={currentVideoSegments}
                currentSegmentIndex={currentVideoSegmentIndex}
                streamMode={currentVideoUseDirectStream ? 'direct' : 'blob'}
                onSegmentChange={(index) => {
                  const segment = currentVideoSegments[index];
                  if (!segment?.auto_drive_cid) return;
                  setCurrentVideoSegmentIndex(index);
                  setCurrentVideoCid(segment.auto_drive_cid);
                  setCurrentVideoUrl(`/api/content/video/${encodeURIComponent(segment.auto_drive_cid)}`);
                }}
                onClose={() => {
                  setVideoPlayerOpen(false);
                  setCurrentVideoCid(null);
                  setCurrentVideoUrl(null);
                  setCurrentVideoTitle('');
                  setCurrentVideoSegments([]);
                  setCurrentVideoSegmentIndex(0);
                  setCurrentVideoUseDirectStream(false);
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
              personaId={effectivePersonaId}
              onRequestPersona={handleOpenWallet}
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

      {/* Legacy CodexCopilotLayer */}
      <CodexCopilotLayer
        isOpen={codexCopilotOpen}
        onClose={() => setCodexCopilotOpen(false)}
        onOpen={() => setCodexCopilotOpen(true)}
        variant="floating"
        enableInferenceRendering
        personaId={effectivePersonaId}
        contextId={`knyt-${activeTab}`}
        messages={codexCopilotMessages}
        onMessagesChange={setCodexCopilotMessages}
        promptPlaceholder="Ask KNYT Copilot about this content..."
        quickPrompts={codexExploreQuickPrompts}
        onPrompt={(prompt) => {
          const normalized = prompt.toLowerCase();
          if (normalized.includes('wallet')) {
            setDrawerOpen(true);
            return;
          }
          if ((normalized.includes('checkout') || normalized.includes('purchase') || normalized.includes('buy')) && selectedContentItem) {
            handleSmartAction(selectedContentItem, 'buy');
            return;
          }
          if ((normalized.includes('watch') || normalized.includes('play') || normalized.includes('video')) && selectedContentItem) {
            handleSmartAction(selectedContentItem, 'watch');
            return;
          }
          if ((normalized.includes('read') || normalized.includes('open') || normalized.includes('pdf')) && selectedContentItem) {
            handleSmartAction(selectedContentItem, 'read');
          }
        }}
      />

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

      </div>
    </SmartContentActionProvider>
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
