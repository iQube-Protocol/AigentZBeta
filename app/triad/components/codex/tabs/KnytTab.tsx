/**
 * SmartTriad-Aware KnytTab Component
 * 
 * Complete port of Qriptopian CodexLiquidUITab functionality integrated with SmartTriad system.
 * Maintains all Liquid UI templates, content viewers, and Co-Pilot integration while
 * leveraging SmartTriadProvider for coordinated state management.
 */

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Loader2, BookOpen, Play, Lock, Check, Sparkles, Coins, ShoppingCart, AlertTriangle, RefreshCw, LogIn, FileText, Cpu, Globe, Shield, Scroll, ArrowLeft, User, Zap } from "lucide-react";
import { useCardAccess } from "@/app/hooks/useCardAccess";
import { OwnedBadge, AccessibleBadge, RestrictedBadge, CartButton } from "@/app/components/content/CardAccessBadges";
// Phase 1.4 UI #3 — spine shadow cross-check. Used to log divergence
// between legacy ownedIssues (/api/codex/owned) and the spine's per-asset
// decision via /api/access/evaluate. Does not change any rendering.
import { checkSpineDecision } from "@/services/access/spineGateClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useKnytBalance } from "@/app/hooks/useKnytBalance";
import { useKnytCards } from "@/app/hooks/useKnytCards";
import { useKnytPurchases } from "@/app/hooks/useKnytPurchases";
import { useContentQubeSeriesRights } from "@/app/triad/components/codex/tabs/useContentQubeSeriesRights";
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
  getPersonasByAuthProfile,
} from "@/services/wallet/personaService";
import { usePersonaSafe } from "@/app/contexts/PersonaContext";
import { useSupabaseSessionPersonas } from "@/app/hooks/useSupabaseSessionPersonas";
import type { KnytCardAsset, EpisodeGroup } from "@/app/hooks/useKnytCards";
import type { PersonaQube } from "@/types/persona";
import { EPISODE_PRICING, KNYT_COYN_DISCOUNT, usdToKnyt } from "@/types/knyt-store";
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
import { useKnytCart } from "@/app/triad/components/codex/tabs/useKnytCart";
// Dynamic — keeps KnytCartDrawer (+ KnytCartCheckoutModal, cart APIs) out of the
// static shared chunk that has historically triggered webpack TDZ
// (cf. commit eb527f9 — same pattern applied to SmartWalletDrawer / CodexCopilotLayer).
const KnytCartDrawer = dynamic(
  () => import("@/app/triad/components/codex/tabs/KnytCartDrawer").then(m => ({ default: m.KnytCartDrawer })),
  { ssr: false, loading: () => null },
);
import type { CartItem } from "@/services/cart";
import { CoverImage } from "@/app/triad/components/content/CoverImage";
const SmartWalletDrawer = dynamic(() => import("@/app/components/content/SmartWalletDrawer"), { ssr: false });
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
  hasPrintCommon?: boolean;
  printRareCid?: string;
  printEpicCid?: string;
  printLegendaryCid?: string;
  printCommonCid?: string;
  printRareLiteUrl?: string;
  printEpicLiteUrl?: string;
  printLegendaryLiteUrl?: string;
  printCommonLiteUrl?: string;
  motionMasterCid?: string;
  motionMasterId?: string;
  stillMasterId?: string;
  stillMasterCid?: string;
  stillMasterLiteUrl?: string;
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
  /** Per-variant breakdown from /api/codex/owned: which formats the persona
   *  has rights to for this episode ('episode_still' | 'episode_motion' |
   *  'episode_print'). Phase A: variant-specific gates MUST filter on this. */
  contentTypes?: string[];
  /** True when the persona has rights but no content row exists yet. */
  comingSoon?: boolean;
  owned?: boolean;
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

// Single Graphic Novel card (replacing prior preorder rarity drops). The codex
// shows ONE AGN entry — same image and copy as the store's "Agentic Graphic
// Novel Qripto" bundle, priced from the EPISODE_PRICING SoT (qriptoPrice 78
// USD → 62.4 KNYT after the 20% KNYT_COYN_DISCOUNT applied at checkout).
// Future rarity tiers (legendary/epic/rare/common) per episode will be added
// later; today the codex shows ONE card per episode for parity.
// Default cover image for the AGN — same "1 Cover 1a" CID used by the store's
// gn-investor-qripto bundle hero (see useBundleImages.DEFAULT_QRIPTO_URL).
// Both surfaces resolve to the same image; replacing here will be a one-line
// swap when the operator-editable bundle_image_asset_id pipeline ships.
const AGN_QRIPTO_IMAGE_URL = '/api/content/cover/bafkr6ifnltnq2xidhizv7lkvrevsipvl4l7qx6weca42q5iacffmybuxzm?variant=thumb';

const PREORDER_CONTENT_VARIANTS = [
  {
    id: 'common',
    subtitle: 'Graphic Novel',
    title: 'Agentic Graphic Novel Qripto',
    description: 'The KNYT graphic novel — Qripto edition. Includes the QAGN (Qripto AgentiQ Graphic Novel) collectible.',
    // Derived: EPISODE_PRICING[-1].qriptoPrice (78) × (1 - KNYT_COYN_DISCOUNT 0.20) = 62.4
    priceKnyt: 62.4,
    priceUsd: 78,
    imageUrl: AGN_QRIPTO_IMAGE_URL,
  },
] as const;

type PreorderVariantId = (typeof PREORDER_CONTENT_VARIANTS)[number]['id'];

const PREORDER_VARIANT_EPISODE_NUMBER: Record<PreorderVariantId, number> = {
  common: -1,
};

const KNYT_CONTENT_CACHE_KEY = "codex:knyt:content:v8";
const KNYT_EPISODES_CACHE_KEY = "codex:knyt:episodes:v6";
const KNYT_SESSION_CACHE_KEY = "codex:knyt:session:v6";
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
  
  // DID Qube persona integration — read from context so sign-in via SmartWalletDrawer
  // propagates immediately (context writes 'currentPersonaId'; the old getActivePersonaId()
  // read 'active_persona_id' — a different key that never updated reactively).
  const { activePersonaId } = usePersonaSafe();
  // Supabase session fallback — resolves persona on mobile where localStorage may be empty
  const { sessionPersonas: supabaseSessionPersonas } = useSupabaseSessionPersonas();
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

  // Legacy state for cards/purchases (maintained for compatibility).
  // NOTE: this `activeTab` is internal KnytTab sub-state, NOT the
  // user-visible top-level codex tab. Cartridge-level presence (tab
  // switching from the wallet, cross-cartridge nav, etc.) is wired at
  // the codex shell — see CodexPanelDynamic's useCartridgePresence call.
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
    stillPriceKnyt?: number;
    motionPriceKnyt?: number;
    hideVersionSelector?: boolean;
  } | null>(null);

  const cart = useKnytCart();
  const [cartOpen, setCartOpen] = useState(false);

  const cartContentTypeFromContentType = (type: ContentType): CartItem['contentType'] => {
    switch (type) {
      case 'scroll_still':
      case 'scroll_motion':
      case 'character_card':
      case 'character_card_motion':
        return type;
      default:
        return 'scroll_still';
    }
  };

  const addPurchaseContentToCart = useCallback(() => {
    if (!purchaseContent) return;
    const priceUsd =
      purchaseContent.priceUsd ??
      (typeof purchaseContent.baseKnyt === 'number'
        ? Number((purchaseContent.baseKnyt * 1.4).toFixed(2))
        : 0);
    const modality: CartItem['modality'] =
      purchaseContent.type === 'scroll_motion' || purchaseContent.type === 'character_card_motion'
        ? 'motion'
        : 'still';
    const item: CartItem = {
      id: purchaseContent.id,
      label: purchaseContent.title,
      modality,
      layer: 'digital',
      priceUsd,
      thumbUrl: purchaseContent.image,
      contentType: cartContentTypeFromContentType(purchaseContent.type),
    };
    cart.addToCart(item);
    setPurchaseModalOpen(false);
    setPurchaseContent(null);
    setCartOpen(true);
  }, [cart, purchaseContent]);
  
  // Debug purchase modal state
  useEffect(() => {
    console.log('Purchase modal state changed:', purchaseModalOpen);
    console.log('Purchase content:', purchaseContent);
  }, [purchaseModalOpen, purchaseContent]);

  useEffect(() => {
    setActiveTab(resolvedInitialTab);
  }, [resolvedInitialTab]);

  // Listen for wallet drawer CTA navigation events.
  // v2 ops adds taskSlug + fallbackTab support (Living Canon deep-links):
  //   detail.tab           — preferred destination (e.g. '21-sats')
  //   detail.taskSlug      — optional; receiving tab can pre-select the
  //                           submission/vote/dispatch surface for this slug
  //   detail.fallbackTab   — used when `tab` isn't a recognised KnytTabSlug
  //                           (e.g. legacy 'living-canon' destinations)
  // The taskSlug is parked on a window-scoped key so the receiving tab
  // (21 Sats) can read it on mount without prop-drilling.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: string; taskSlug?: string; fallbackTab?: string }>).detail || {};
      const candidate = detail.tab && isKnytTabSlug(detail.tab) ? detail.tab : null;
      const fallback = detail.fallbackTab && isKnytTabSlug(detail.fallbackTab) ? detail.fallbackTab : null;
      const target = candidate || fallback;
      if (!target) return;
      if (detail.taskSlug) {
        // Park for the receiving tab to consume on mount.
        try {
          (window as unknown as { __knytPendingTaskSlug?: string }).__knytPendingTaskSlug = detail.taskSlug;
        } catch { /* non-fatal */ }
      }
      setActiveTab(target);
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
    
    // Load the personas list (activePersonaId now comes from PersonaContext, not localStorage)
    const loadPersonas = async () => {
      try {
        setLoadingPersonas(true);
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
  // Phase 3.x viewer-side episode-complete fire — KnytTab passes this to
  // PDFPageViewer and VideoPlayer as `onComplete`. The viewers don't
  // know the episodeId format; they just signal "user finished viewing".
  // We POST to /api/engagement/episode-progress with the anchor cid as
  // the canonical episode_id (consistent with how engagement_events
  // already records progress events). engagementService dedupes via
  // (personaId, episodeId) so re-firing on a re-open is safe.
  const fireEpisodeComplete = useCallback((episodeId: string | null) => {
    if (!episodeId) return;
    void fetch('/api/engagement/episode-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        episodeId,
        eventType: 'completed',
        progressPercent: 100,
        metadata: { source: 'knyt-tab-viewer' },
      }),
    }).catch(() => {
      // non-fatal — engagement is best-effort; the gate decisions
      // and content delivery are unaffected by failure here
    });
  }, []);
  const [textReaderOpen, setTextReaderOpen] = useState(false);
  const [currentText, setCurrentText] = useState<{ title: string; content: string } | null>(null);
  // Wallet drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-reopen the wallet drawer on return from a wallet-launched
  // cartridge close. The wallet's navigateToKnytTab appends
  // ?reopenWallet=1 to its returnTo URL when it navigates away; the
  // codex-closed route honours that on return, landing the user back
  // here with reopenWallet=1 in the URL. We consume + strip the param
  // on mount so the drawer pops open without keeping a sticky URL
  // state across refreshes. Closes the "wallet drawer not preserved
  // across round-trip" UX gap.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('reopenWallet') === '1') {
      setDrawerOpen(true);
      params.delete('reopenWallet');
      const search = params.toString();
      const newUrl =
        window.location.pathname +
        (search ? `?${search}` : '') +
        window.location.hash;
      try { window.history.replaceState(null, '', newUrl); } catch { /* non-fatal */ }
    }
  }, []);
  // Copilot state declared FIRST so handleOpenWallet's setters resolve at
  // call time without TDZ noise.
  const [codexCopilotOpen, setCodexCopilotOpen] = useState(false);
  // Sign-in surface: route through the embedded copilot wallet panel rather
  // than the parallel SmartWalletDrawer. The drawer has z-index conflicts in
  // the metaMe embed; the copilot's wallet tab is already integrated with the
  // unified persona helper and renders correctly above codex layers.
  const [copilotWalletSignal, setCopilotWalletSignal] = useState(0);
  const handleOpenWallet = useCallback((_mode: 'signin' | 'signup') => {
    setCodexCopilotOpen(true);
    setCopilotWalletSignal((n) => n + 1);
  }, []);
  const [codexCopilotMessages, setCodexCopilotMessages] = useState<CopilotMessage[]>(() => [
    createCodexCopilotWelcomeMessage(resolvedInitialTab),
  ]);
  const lastCopilotContextRef = useRef<string | null>(null);
  
  // Quest/Task state — extended with the summary + reputation sub-objects
  // returned by /api/wallet/tasks so the Order tab right-HUD can render
  // task counts, status differentiation, lifetime KNYT earned, and the
  // five-axis reputation vector. (Alpha-readiness HUD detail expansion.)
  const [taskData, setTaskData] = useState({
    activeTask: null as { id: string; title: string; progress: number; nextStep: string } | null,
    rewards: [] as Array<{ id: string; amount: number; source: string; status?: string; tokenType?: string }>,
    ascensionRank: {
      current: 'Initiate',
      next: 'Acolyte',
      progress: 0,
    },
    summary: undefined as undefined | {
      activeCount?: number;
      availableCount?: number;
      completedCount?: number;
      claimableKnyt?: number;
      lifetimeKnytEarned?: number;
    },
    reputation: null as null | {
      overall?: number;
      technical?: number;
      creative?: number;
      entrepreneurial?: number;
      dataArch?: number;
      community?: number;
      lifetimeCvs?: number;
      totalTasksCompleted?: number;
    },
  });
  
  // Realm state
  const [activeRealm, setActiveRealm] = useState<Realm>('digiterra');
  
  // Copilot mode
  const [copilotMode, setCopilotMode] = useState<CopilotOverlayMode>('overlay');
  
  const { toast } = useToast();
  const effectivePersonaId = useMemo(() => {
    const candidates = [personaId, activePersonaId, personas[0]?.id, supabaseSessionPersonas[0]?.id];
    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue;
      const trimmed = candidate.trim();
      if (!trimmed || trimmed === 'default' || trimmed === 'guest') continue;
      return trimmed;
    }
    return undefined;
  }, [personaId, activePersonaId, personas, supabaseSessionPersonas]);
  
  // KNYT balance and cards data
  const { balance, spendableBalance, refreshBalance } = useKnytBalance(effectivePersonaId);
  const { groups, loading: cardsLoading, error: cardsError, refreshCards } = useKnytCards({
    enabled: activeTab === 'characters' || showLegacyFallbackUI,
  });
  const { ownedCharacters, refreshPurchases } = useKnytPurchases(effectivePersonaId);

  // Phase B canonicalization: ContentQube registry as primary ownership SOT.
  // Returns the union of real content_qubes rows (persona_owns resolved via
  // evaluateAccess) and SKU-rights placeholders. We index this into a
  // Map<episode-variant-key, persona_owns> and use it as the canonical
  // ownership check in isEpisodeLocked / openEpisodeVideo, falling back to
  // the legacy ownedIssues (variant-aware after Phase A) only when the
  // registry has no entry for the requested (episode, variant) pair.
  const { qubes: registryQubes } = useContentQubeSeriesRights('metaKnyts', {
    personaId: effectivePersonaId,
    skip: !effectivePersonaId,
  });

  /**
   * Map of `${episodeNumber}:${variant}` → persona_owns, where variant is
   * 'episode_still' | 'episode_motion' | 'episode_print'. Episode_still and
   * episode_print are both folded under the 'still' variant lookup because
   * the KnytTab UI treats them as a single "codex/print" tile.
   */
  const registryOwnership = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const q of registryQubes) {
      const ep = q.manifest.display_number;
      if (ep == null) continue;
      const ct = q.manifest.content_type;
      const owns = q.manifest.persona_owns === true;
      // Variant key for the lookup. Motion stays motion. Print + still both
      // map to the legacy "still" tile (the print PDF is the canonical
      // read-surface; episode_still is the cover-only fallback). Either
      // ownership signal unlocks the codex/print tile.
      let variantKey: string | null = null;
      if (ct === 'episode_motion')       variantKey = `${ep}:episode_motion`;
      else if (ct === 'episode_print' || ct === 'episode_still') {
        variantKey = `${ep}:episode_print`;
      }
      if (!variantKey) continue;
      // Merge: if any underlying qube reports owned, the tile is owned.
      const prev = map.get(variantKey) ?? false;
      map.set(variantKey, prev || owns);
    }
    return map;
  }, [registryQubes]);
  const isSignedIn = !!effectivePersonaId;

  // ── Pending purchase intent (anon → sign-in → purchase preservation) ─────
  // When an unauth user clicks the cart on a payment-gated card, we open the
  // wallet drawer for sign-in and stash the intent. Once a persona becomes
  // available (effect on effectivePersonaId), we automatically open the
  // purchase modal with the same intent — option (A) one-click intent flow.
  const [pendingPurchaseIntent, setPendingPurchaseIntent] = useState<{
    contentId: string;
    contentTitle?: string;
    contentImage?: string;
    priceUsd?: number;
  } | null>(null);

  useEffect(() => {
    if (effectivePersonaId && pendingPurchaseIntent) {
      const intent = pendingPurchaseIntent;
      setPendingPurchaseIntent(null);
      // Best-effort: re-open the purchase modal for the same content.
      const ep = episodesCatalog.find((e) =>
        (e.purchaseId || `mk_ep${String(e.episodeNumber).padStart(2, '0')}`) === intent.contentId,
      );
      if (ep) {
        openPurchaseForEpisode(ep);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePersonaId]);

  const cardAccess = useCardAccess({
    personaId: effectivePersonaId,
    series: 'metaKnyts',
    onOpenPurchase: (intent) => {
      const ep = episodesCatalog.find((e) =>
        (e.purchaseId || `mk_ep${String(e.episodeNumber).padStart(2, '0')}`) === intent.contentId,
      );
      if (ep) openPurchaseForEpisode(ep);
    },
    onOpenSignIn: (intent) => {
      setPendingPurchaseIntent(intent);
      handleOpenWallet('signin');
    },
  });

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
      price?: number;
      owned?: boolean;
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
          available: !!(media.text || media.pdf_cid || media.pdf_lite_url),
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
      // Carry pricing through so SmartContentActions / consumers see a price.
      price: typeof metadata.price === 'number' && metadata.price > 0
        ? { amount: metadata.price, currency: 'Q¢' as const, paymentType: 'one-time' as const }
        : undefined,
    };
  }, [normalizeVideoSource]);

  const transformEpisodesToContentItems = useCallback((episodes: EpisodeFromAPI[]): KnytContentItem[] => {
    const items: KnytContentItem[] = [];
    const preorderThumbCandidates: string[] = [];
    // GN sits at DB ep -1 (content_type='gn_still'). Capture it so the AGN
    // card can wire the GN's CID/lite URL into media.pdf_cid + modalities.read.
    let gnEp: EpisodeFromAPI | null = null;

    for (const ep of episodes) {
      const episodeNumber = Number(ep.episodeNumber);
      if (!Number.isFinite(episodeNumber)) continue;
      // Capture GN (DB ep -1) data, but don't create a standalone episode card
      // for it — the AGN card is injected below.
      if (episodeNumber === -1) { gnEp = ep; continue; }
      // Skip the legacy preorder rarity drops (DB ep -2..-4) — replaced by
      // the single AGN card injected below.
      if (episodeNumber < 0) continue;
      
      // Print URLs win when present. When the episode has only a "still"
      // master (legacy fixtures store the readable PDF under
      // content_type='episode_still' rather than 'episode_print'), fall
      // back to the stillMasterCid / stillMasterLiteUrl so the reader
      // still opens. Without this, every episode with only a still master
      // (i.e. every regular metaKnyts episode in the current dev DB) would
      // render as a cover-only card with no readable surface.
      const printCid = ep.printRareCid || ep.printEpicCid || ep.printLegendaryCid || ep.printCommonCid || ep.stillMasterCid;
      const printLiteUrl = ep.printRareLiteUrl || ep.printEpicLiteUrl || ep.printLegendaryLiteUrl || ep.printCommonLiteUrl || ep.stillMasterLiteUrl;
      // pdf_lite_url = direct Supabase URL (fast, iframe-rendered via PDFLiteReaderModal)
      // pdf_cid      = Autonomys CID only (page-by-page via PDFPageViewer)
      // Never put a proxy URL in pdf_lite_url — that buffers the whole PDF through
      // Lambda and returns 413 for any file over ~6 MB.
      const hasReadable = !!(printCid || printLiteUrl);
      const hasCover = !!(ep.coverThumbUrl || ep.coverImageCid);
      const coverThumb =
        ep.coverThumbUrl ||
        (ep.coverImageCid ? `${API_BASE_URL}/api/content/cover/${encodeURIComponent(ep.coverImageCid)}?variant=thumb` : undefined);
      if (hasCover && coverThumb) preorderThumbCandidates.push(coverThumb);
      const motionSource = normalizeVideoSource(
        ep.motionMasterCid ||
        (ep as EpisodeFromAPI & { motionMasterUrl?: string; motionMasterPath?: string }).motionMasterUrl ||
        (ep as EpisodeFromAPI & { motionMasterUrl?: string; motionMasterPath?: string }).motionMasterPath ||
        null
      );
      const hasWatchable = ep.hasMotionMaster && Boolean(motionSource.cid || motionSource.url);
      // Episode pricing — single source of truth: EPISODE_PRICING (admin
      // pricing table). DB→pricing convention: DB ep 1 = pricing #0, … DB ep
      // 13 = pricing #12. We derive BOTH the KNYT-paid USD-equivalent
      // (qriptoPrice × 0.8 — matches "$KNYT 62.4 ($78)" pattern the user
      // wants for the AGN) and the retail USD price for display alongside.
      const apiPriceKnyt = resolveAccessPrice(ep.priceKnyt);
      const pricingEpNum = episodeNumber - 1;
      const sot = EPISODE_PRICING.find((p) => p.episodeNumber === pricingEpNum);
      let resolvedPriceKnyt = apiPriceKnyt;
      let resolvedPriceUsd: number | null = null;
      if (sot?.qriptoPrice && sot.qriptoPrice > 0) {
        resolvedPriceUsd = sot.qriptoPrice;
        if (resolvedPriceKnyt === null) {
          // 20% KNYT discount applied at checkout — show the KNYT-paid $ amount
          resolvedPriceKnyt = Math.round(sot.qriptoPrice * (1 - KNYT_COYN_DISCOUNT) * 100) / 100;
        }
      }
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
            priceUsd: resolvedPriceUsd ?? undefined,
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
            priceUsd: resolvedPriceUsd ?? undefined,
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
            priceUsd: resolvedPriceUsd ?? undefined,
            realm: 'digiterra',
          },
          modalities: {},
        });
      }
    }

    // Add the single Graphic Novel card (replaces 4 prior preorder rarity
    // drops). Image and copy mirror the store's "Agentic Graphic Novel
    // Qripto" bundle so the codex and store stay aligned. Inserted at the
    // FRONT so the AGN card renders before episode #0..#12 in the grid.
    // Wire the GN's print CID/lite URL onto every AGN variant card so owned
    // users can open the PDF reader. Read button is gated by
    // modalities.read.available (not by card type), so we keep the type as
    // comic_cover_portrait — same Liquid UI stage routing as before.
    const gnPrintCid = gnEp
      ? (gnEp.printRareCid || gnEp.printEpicCid || gnEp.printLegendaryCid || gnEp.printCommonCid)
      : undefined;
    const gnPrintLiteUrl = gnEp
      ? (gnEp.printRareLiteUrl || gnEp.printEpicLiteUrl || gnEp.printLegendaryLiteUrl || gnEp.printCommonLiteUrl)
      : undefined;
    const gnHasReadable = !!(gnPrintCid || gnPrintLiteUrl);

    const agnCards: KnytContentItem[] = PREORDER_CONTENT_VARIANTS.map((variant) => ({
      id: `metaKnyts_preorder_${variant.id}`,
      type: 'comic_cover_portrait',
      title: variant.title,
      subtitle: variant.subtitle,
      description: variant.description,
      thumbnail: variant.imageUrl,
      media: {
        image_cid: undefined,
        pdf_cid: gnPrintCid,
        pdf_lite_url: gnPrintLiteUrl,
      },
      metadata: {
        episodeNumber: PREORDER_VARIANT_EPISODE_NUMBER[variant.id],
        owned: false,
        price: variant.priceKnyt,
        priceUsd: variant.priceUsd,
        realm: 'digiterra',
      },
      modalities: gnHasReadable
        ? { read: { available: true, cid: gnPrintCid } }
        : {},
    }));

    return [...agnCards, ...items];
  }, [normalizeVideoSource, resolveAccessPrice]);

  const transformCharactersToContentItems = useCallback((characters: CharacterFromAPI[]): KnytContentItem[] => {
    return characters.map(char => ({
      id: `char_${char.id}`,
      type: 'character_portrait' as KnytContentType,
      title: char.name,
      subtitle: 'Character Card',
      thumbnail: char.front_cid ? `${API_BASE_URL}/api/content/cover/${encodeURIComponent(char.front_cid)}?variant=thumb` : undefined,
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

      // Build a viewable URL: Supabase-hosted assets use the URL directly;
      // Autonomys CIDs go through the existing thin proxy at /api/content/pdf/[cid].
      const rawCid = asset.auto_drive_cid;
      const pdfLiteUrl = rawCid
        ? rawCid.startsWith('http')
          ? rawCid
          : `${API_BASE_URL}/api/content/pdf/${encodeURIComponent(rawCid)}`
        : undefined;

      return {
        id: `lore_${asset.id}`,
        type: 'lore_snippet',
        title: asset.title,
        subtitle: asset.asset_kind.replace(/_/g, ' '),
        thumbnail: loreThumb,
        media: {
          pdf_cid: rawCid,
          pdf_lite_url: pdfLiteUrl,
          text: asset.extracted_text || undefined,
        },
        metadata: {
          realm: 'digiterra',
          modalities: asset.extracted_text ? { read: { text: asset.extracted_text } } : undefined,
          episodeNumber: episodeNumber ?? undefined,
        },
        modalities: {
          read: { available: true, cid: rawCid },
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
  // Persist owned-issues to localStorage so they survive page reloads and
  // pre-populate state before the async fetch completes (eliminates the
  // blank window where all episodes appear locked on every fresh load).
  const OWNED_LS_PREFIX = 'codex:knyt:owned:v2:';

  // On personaId change: pre-populate from localStorage immediately so
  // isEpisodeLocked has data even before fetchOwnedEpisodes completes.
  useEffect(() => {
    if (!effectivePersonaId) return;
    try {
      const stored = localStorage.getItem(OWNED_LS_PREFIX + effectivePersonaId);
      if (!stored) return;
      const lsIssues = JSON.parse(stored) as OwnedIssueFromAPI[];
      if (!Array.isArray(lsIssues) || lsIssues.length === 0 || typeof lsIssues[0] !== 'object') return;
      setOwnedIssues(lsIssues);
      const nums = lsIssues
        .map((i: OwnedIssueFromAPI) => i.episodeNumber)
        .filter((n: number | undefined): n is number => typeof n === 'number');
      setOwnedEpisodeNumbers(new Set(nums));
    } catch { /* localStorage unavailable */ }
  // OWNED_LS_PREFIX is a stable constant — only effectivePersonaId matters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePersonaId]);

  // Expose a window-level inspector so the operator can dump current
  // ownership state from the browser console without needing to click an
  // episode. Usage: __knytDebug() in the console. Strip after root cause.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as unknown as { __knytDebug?: () => void }).__knytDebug = () => {
      const snapshot = {
        effectivePersonaId,
        ownedIssuesCount: ownedIssues.length,
        ownedIssues: ownedIssues.slice(0, 5),
        ownedEpisodeNumbers: Array.from(ownedEpisodeNumbers).sort((a, b) => a - b),
        registryMapSize: registryOwnership.size,
        registryKeys: Array.from(registryOwnership.entries()).slice(0, 10),
        registryAnyOwned: Array.from(registryOwnership.values()).some(Boolean),
        episodesCatalogCount: episodesCatalog.length,
        contentItemsCount: contentItems.length,
        sampleItemIds: contentItems.slice(0, 5).map((c) => ({ id: c.id, ep: c.metadata?.episodeNumber, type: c.type })),
        localStorageKey: `${OWNED_LS_PREFIX}${effectivePersonaId ?? '<none>'}`,
        localStorageBytes: effectivePersonaId
          ? (localStorage.getItem(OWNED_LS_PREFIX + effectivePersonaId)?.length ?? 0)
          : 0,
      };
      console.log('[__knytDebug]', JSON.stringify(snapshot, null, 2));
      return snapshot;
    };
  // Stable refs are fine; we want the closure to capture latest values.
  });

  const fetchOwnedEpisodes = useCallback(async (options?: { force?: boolean }) => {
    if (!effectivePersonaId) {
      setOwnedEpisodeNumbers(new Set());
      setOwnedIssues([]);
      return;
    }
    try {
      const apiBase = API_BASE_URL;
      const cacheKey = `codex:knyt:owned:v2:${effectivePersonaId}`;
      if (!options?.force) {
        // In-memory cache: fastest, same-session navigation
        const cached = getCachedValue<OwnedIssueFromAPI[]>(cacheKey);
        if (cached && Array.isArray(cached) && cached.length > 0 && typeof cached[0] === 'object') {
          setOwnedIssues(cached);
          const nums = cached
            .map((i: OwnedIssueFromAPI) => i.episodeNumber)
            .filter((n: number | undefined): n is number => typeof n === 'number');
          setOwnedEpisodeNumbers(new Set(nums));
          // Fall through — always fetch fresh data to stay in sync.
        }
      }
      const ownedRes = await fetch(`${apiBase}/api/codex/owned?personaId=${effectivePersonaId}`);
      if (!ownedRes.ok) {
        console.warn(`[KnytTab] /api/codex/owned returned ${ownedRes.status} for personaId=${effectivePersonaId}`);
        return;
      }
      const ownedData = await ownedRes.json();
      const freshIssues: OwnedIssueFromAPI[] = ownedData.issues || [];
      console.log(`[KnytTab] /api/codex/owned → personaId=${effectivePersonaId} issueCount=${freshIssues.length} epNums=${freshIssues.map(i => i.episodeNumber).join(',')}`);
      setOwnedIssues(freshIssues);
      const ownedEpisodesArray = freshIssues
        .map((issue: OwnedIssueFromAPI) => issue.episodeNumber)
        .filter((n: number | undefined): n is number => typeof n === 'number');
      setCachedValue(cacheKey, freshIssues, 5 * 60 * 1000);
      // Persist to localStorage so the next page load has data immediately.
      try {
        localStorage.setItem(OWNED_LS_PREFIX + effectivePersonaId, JSON.stringify(freshIssues));
      } catch { /* localStorage full or unavailable */ }
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

  // ─────────────────────────────────────────────────────────────────────
  // Phase 1.4 UI #3 — spine shadow cross-check (no rendering impact).
  //
  // Whenever the legacy ownedIssues list updates, sample one of the
  // 'owned' assets and ask the spine /api/access/evaluate what it
  // thinks. Log divergence with [SPINE] prefix.
  //
  // Why sample (not enumerate): this runs on every effectivePersonaId
  // change and ownedIssues update; enumerating every asset would
  // generate N requests for users with large libraries. One sample
  // per refresh is enough to catch class-level divergence; we ramp up
  // to per-asset checks in Phase 2 when SmartTriadProvider hoists
  // ownership and the cross-check becomes the canonical answer.
  //
  // The legacy badge logic continues to drive what the user sees.
  // This is observability only.
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!effectivePersonaId) return;
    if (ownedIssues.length === 0) {
      console.log(
        `[SPINE] knyt-tab: cross-check personaId=${effectivePersonaId} ` +
        `ownedCount=0 (no items to sample)`,
      );
      return;
    }
    let cancelled = false;
    const sample = ownedIssues[0] as { episodeNumber?: number; assetId?: string };
    const probe =
      (typeof sample.assetId === 'string' && sample.assetId) ||
      (typeof sample.episodeNumber === 'number'
        ? `mk_ep${String(sample.episodeNumber).padStart(2, '0')}_print_common`
        : null);
    if (!probe) return;
    void checkSpineDecision(probe, 'read').then((decision) => {
      if (cancelled) return;
      if (!decision) {
        console.warn(
          `[SPINE] knyt-tab: cross-check personaId=${effectivePersonaId} ` +
          `probe=${probe} result=NULL (spine unreachable or descriptor not found)`,
        );
        return;
      }
      const expectedAllow = true; // legacy says it's owned
      if (decision.allow === expectedAllow) {
        console.log(
          `[SPINE] knyt-tab: cross-check personaId=${effectivePersonaId} ` +
          `probe=${probe} legacy=OWNED spine=${decision.allow ? 'ALLOW' : 'DENY'}/` +
          `${decision.reason} ✓ AGREE`,
        );
      } else {
        console.warn(
          `[SPINE] knyt-tab: cross-check DIVERGENCE personaId=${effectivePersonaId} ` +
          `probe=${probe} legacy=OWNED spine=${decision.allow ? 'ALLOW' : 'DENY'}/` +
          `${decision.reason} ✗ — investigate before Phase 2 hoist`,
        );
      }
    });
    return () => { cancelled = true; };
  }, [effectivePersonaId, ownedIssues]);

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
    // Defence-in-depth gate: episodes are inherently locked. Even if a caller
    // forgot to check, refuse to open the player for an unowned episode.
    //
    // Source of truth (Phase B canonicalization, 2026-05-14, corrected
    // 2026-05-14b): registry can only CONFIRM ownership; it cannot deny it.
    // If registry says persona_owns=true → allow. Otherwise consult the
    // legacy variant-aware ownedIssues check (it's already SKU-aware and
    // contentTypes-aware after Phase A).
    const epNum = episode.episodeNumber;
    if (typeof epNum === 'number' && epNum !== null) {
      // Registry fast-path, then episode-number-only legacy fallback.
      const registryOwns = registryOwnership.get(`${epNum}:episode_motion`) === true;
      if (!registryOwns) {
        const matchingIssues = ownedIssues.filter((issue: OwnedIssueFromAPI) => issue.episodeNumber === epNum);
        // ownedEpisodeNumbers pre-populates from localStorage — always check it.
        const epNumsOwns = ownedEpisodeNumbers.has(epNum);
        if (matchingIssues.length === 0 && !epNumsOwns) {
          openPurchaseForEpisode(episode, 'watch');
          return;
        }
      }
    }
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
  // openPurchaseForEpisode is declared later in this file and captured via
  // closure; TS would flag a forward-reference if we add it to deps, and
  // the original implementation omitted it too. Closure semantics give us
  // the latest reference at call time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchEpisodeSegments, getVideoPlaybackUrl, normalizeVideoSource, ownedIssues, registryOwnership]);
  // openPurchaseForEpisode intentionally not in deps — it's declared after this
  // useCallback in the file (TDZ would crash render). Closure resolves it at
  // call time, which is always after both declarations have run.

  useEffect(() => {
    if (!contentItems.length && !episodesCatalog.length) return;
    writeKnytSessionSnapshot(contentItems, episodesCatalog);
  }, [contentItems, episodesCatalog]);

  const contentWithOwnership = useMemo(() => {
    return contentItems.map((item) => {
      const episodeNumber = item.metadata?.episodeNumber;
      if (typeof episodeNumber !== 'number') return item;
      // Merge ownership signals: registry (ContentQube) OR legacy
      // /api/codex/owned. Either path being owned unlocks the card. This
      // prevents ContentCard.canPurchase from showing a Buy button when
      // the registry confirms ownership but the legacy endpoint is still
      // loading / FIO-handle resolution missed / etc.
      const registryOwns =
        registryOwnership.get(`${episodeNumber}:episode_print`) === true ||
        registryOwnership.get(`${episodeNumber}:episode_motion`) === true;
      const legacyOwns = ownedEpisodeNumbers.has(episodeNumber);
      return {
        ...item,
        metadata: {
          ...item.metadata,
          owned: registryOwns || legacyOwns,
        },
      };
    });
  }, [contentItems, ownedEpisodeNumbers, registryOwnership]);

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

  // Map a KnytContentItem to its canonical variant string as used by
  // /api/codex/owned#contentTypes. Returns null when the item isn't a
  // gated episode variant (e.g. a character card).
  const resolveVariant = useCallback((item: KnytContentItem): 'episode_still' | 'episode_motion' | 'episode_print' | null => {
    switch (item.type) {
      case 'motion_comic_landscape':
      case 'video':
        return 'episode_motion';
      case 'comic_page_portrait':
        return 'episode_still'; // PDFs stored as episode_still in master_content_qubes; SKU grants still not print
      case 'comic_cover_portrait':
      case 'scroll_still':
        return 'episode_still';
      default:
        return null;
    }
  }, []);

  // Event handlers for Liquid UI content
  const isEpisodeLocked = useCallback((item: KnytContentItem) => {
    const episodeNumber = resolveEpisodeNumber(item);
    if (episodeNumber === null) return false;

    // GN (DB ep 0, represented as AGN preorder with ep -1) is free to read.
    // pdf_lite_url being present indicates the free Supabase-hosted print.
    if (typeof episodeNumber === 'number' && episodeNumber <= 0 && item.media?.pdf_lite_url) {
      return false;
    }

    // Registry fast-path: if the registry says owned, unlock immediately.
    // Only unlocks — never locks. Registry may be empty while loading.
    const variant = resolveVariant(item);
    if (variant !== null) {
      const registryVariant = variant === 'episode_still' ? 'episode_print' : variant;
      const registryKey = `${episodeNumber}:${registryVariant}`;
      if (registryOwnership.get(registryKey) === true) {
        return false;
      }
    }

    // Legacy fallback: episode-number match against /api/codex/owned.
    // This was the working logic on May 11th. Any owned issue for this
    // episode number = unlocked. Simple, correct.
    const ownedForEp = ownedIssues.filter((issue: OwnedIssueFromAPI) => issue.episodeNumber === episodeNumber);
    if (ownedForEp.length > 0) return false;

    // ownedEpisodeNumbers mirrors ownedIssues but also pre-populates from
    // localStorage before the async fetch completes. Always check it as a
    // fallback — if the episode is in the set, the persona owns it regardless
    // of whether ownedIssues has finished loading.
    if (ownedEpisodeNumbers.has(episodeNumber)) return false;

    // Self-diagnostic log: emit ONLY when we're about to lock, so the operator
    // can see in the console exactly why this click triggered the paywall.
    // Strip after the root cause is fixed.
    if (typeof window !== 'undefined') {
      console.warn(
        `[KnytTab:LOCKED] itemId=${item.id} ep=${episodeNumber} variant=${variant} ` +
        `effectivePersonaId=${effectivePersonaId ?? '<none>'} ` +
        `registryMapSize=${registryOwnership.size} ` +
        `registryKeyLooked=${variant ? `${episodeNumber}:${variant === 'episode_still' ? 'episode_print' : variant}` : '<n/a>'} ` +
        `ownedIssuesCount=${ownedIssues.length} ` +
        `ownedEpisodeNumbersSize=${ownedEpisodeNumbers.size} ` +
        `ownedEpsList=[${Array.from(ownedEpisodeNumbers).sort((a, b) => a - b).join(',')}] ` +
        `hasAccessRestriction=${hasAccessRestriction(item.metadata as GatingMetadata | undefined)}`,
      );
    }

    if (hasAccessRestriction(item.metadata as GatingMetadata | undefined)) return true;
    return true;
  }, [resolveEpisodeNumber, ownedIssues, ownedEpisodeNumbers, hasAccessRestriction, resolveVariant, registryOwnership, effectivePersonaId]);

  const openPurchaseForItem = useCallback((item: KnytContentItem, action: 'read' | 'watch' | 'default' = 'default') => {
    const episodeNumber = resolveEpisodeNumber(item);
    const preorderVariantId = resolvePreorderVariantId(item, episodeNumber);
    const itemPrice = resolveAccessPrice(item.metadata?.price);
    if (typeof window !== 'undefined') {
      console.warn(
        `[KnytTab:OPEN_PURCHASE_ITEM] itemId=${item.id} ep=${episodeNumber} action=${action} ` +
        `type=${item.type} preorderVariant=${preorderVariantId} priceKnyt=${itemPrice} ` +
        `effectivePersonaId=${effectivePersonaId ?? '<none>'} ` +
        `stack=${new Error().stack?.split('\n').slice(1, 5).join(' | ')}`,
      );
    }
    if (!preorderVariantId && itemPrice === null) {
      return;
    }

    const contentType: ContentType =
      action === 'watch' || item.type === 'motion_comic_landscape'
        ? 'scroll_motion'
        : 'scroll_still';

    // Resolve SoT pricing — use EPISODE_PRICING (admin pricing table) so the
    // modal shows the same base/discount as the store. AGN preorder uses the
    // gn-investor-qripto SKU id so the cart's processPurchase grants the
    // real GN SKU (which the SKU expander unpacks to episode -1 ownership).
    let priceUsd = Number((itemPrice ?? 0) * 1.4);
    let baseKnyt = itemPrice ?? 0;
    let hideVersionSelector = false;
    let purchaseId = item.id.replace(/_motion$/, '');

    if (preorderVariantId) {
      // AGN — single Qripto bundle, no Motion modality
      priceUsd = 78;
      baseKnyt = usdToKnyt(priceUsd);
      hideVersionSelector = true;
      purchaseId = 'gn-investor-qripto';
    } else if (typeof episodeNumber === 'number') {
      const pricingEpNum = episodeNumber - 1;
      const sot = EPISODE_PRICING.find((p) => p.episodeNumber === pricingEpNum);
      if (sot?.qriptoPrice && sot.qriptoPrice > 0) {
        priceUsd = sot.qriptoPrice;
        baseKnyt = usdToKnyt(priceUsd);
      }
      // Hide Motion when this episode has no motion master available.
      const ep = episodesCatalog.find((e) => Number(e.episodeNumber) === episodeNumber);
      if (ep && !ep.hasMotionMaster) {
        hideVersionSelector = true;
      }
    }

    setPurchaseContent({
      type: contentType,
      id: purchaseId,
      title: item.title,
      image: item.thumbnail,
      baseKnyt,
      priceUsd: Number(priceUsd.toFixed(2)),
      stillPriceKnyt: baseKnyt,
      motionPriceKnyt: baseKnyt,
      hideVersionSelector,
    });
    setPurchaseModalOpen(true);
  }, [resolveEpisodeNumber, resolvePreorderVariantId, resolveAccessPrice, episodesCatalog, effectivePersonaId]);

  const getOwnedIssuesForEpisode = useCallback((episodeNumber: number) => {
    if (ownedIssues.length > 0) {
      return ownedIssues.filter((issue) => issue.episodeNumber === episodeNumber);
    }
    // Fallback: ownedEpisodeNumbers may be populated from cache before
    // the full issues array loads. Synthesize a minimal entry so the UI
    // shows "Owned" immediately rather than a false "locked" state.
    if (ownedEpisodeNumbers.has(episodeNumber)) {
      return [{ issueId: `cached:${episodeNumber}`, episodeNumber, owned: true }];
    }
    return [];
  }, [ownedIssues, ownedEpisodeNumbers]);

  const openPurchaseForEpisode = useCallback((episode: EpisodeFromAPI, action: 'read' | 'watch' | 'default' = 'default') => {
    if (typeof window !== 'undefined') {
      console.warn(
        `[KnytTab:OPEN_PURCHASE_EP] ep=${episode.episodeNumber} action=${action} ` +
        `effectivePersonaId=${effectivePersonaId ?? '<none>'} ` +
        `stack=${new Error().stack?.split('\n').slice(1, 5).join(' | ')}`,
      );
    }
    const epNum = Number(episode.episodeNumber);
    // Source of truth: EPISODE_PRICING (admin pricing table). Fall back to
    // the API price field if the SoT lookup misses. DB ep N → pricing ep N-1.
    const pricingEpNum = epNum - 1;
    const sot = EPISODE_PRICING.find((p) => p.episodeNumber === pricingEpNum);
    const apiPriceKnyt = resolveAccessPrice(episode.priceKnyt);
    let priceUsd: number | null = null;
    let baseKnyt: number | null = null;
    if (sot?.qriptoPrice && sot.qriptoPrice > 0) {
      priceUsd = sot.qriptoPrice;
      baseKnyt = usdToKnyt(priceUsd);
    } else if (apiPriceKnyt !== null) {
      baseKnyt = apiPriceKnyt;
      priceUsd = Number(episode.priceUsd ?? apiPriceKnyt * 1.4);
    }
    if (baseKnyt === null || priceUsd === null) {
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
      id: episode.purchaseId || `mk_ep${String(epNum).padStart(2, '0')}`,
      title: episode.title || `Episode ${episode.displayNumber}`,
      image: episode.coverThumbUrl || (episode.coverImageCid ? `/api/content/cover/${encodeURIComponent(episode.coverImageCid)}?variant=thumb` : undefined),
      baseKnyt,
      priceUsd: Number(priceUsd.toFixed(2)),
      stillPriceKnyt: baseKnyt,
      motionPriceKnyt: baseKnyt,
      hideVersionSelector: !episode.hasMotionMaster,
    });
    setPurchaseModalOpen(true);
  }, [resolveAccessPrice, effectivePersonaId]);

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
      // Defence-in-depth gate: text content for episode items is also gated.
      // Only opens the text reader if the episode is owned.
      if (isEpisodeLocked(item)) {
        openPurchaseForItem(item, 'read');
        return;
      }
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
  }, [isEpisodeLocked, openPurchaseForItem]);

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
      // Defensive ownership check — never open the purchase modal for an
      // episode the persona already owns. isEpisodeLocked merges registry
      // ownership + /api/codex/owned + cached ownedEpisodeNumbers, so it
      // catches the cases where item.metadata.owned hasn't been refreshed.
      if (!isEpisodeLocked(item)) {
        console.log('[KnytTab] buy action suppressed — item already owned:', item.id);
        // Fall through to open the reader/viewer instead.
        const episodeNumber = resolveEpisodeNumber(item);
        const matched = episodeNumber !== null
          ? episodesCatalog.find((e) => e.episodeNumber === episodeNumber)
          : undefined;
        const printLiteUrl = matched?.printRareLiteUrl || matched?.printEpicLiteUrl || matched?.printLegendaryLiteUrl || matched?.printCommonLiteUrl || matched?.stillMasterLiteUrl;
        const printCid = matched?.printRareCid || matched?.printEpicCid || matched?.printLegendaryCid || matched?.printCommonCid || matched?.stillMasterCid;
        // Motion fallback — if there's no print available but the persona
        // owns motion, open the motion viewer.
        const motionCid = matched?.motionMasterCid;
        console.log('[KnytTab] owned-buy fallback:', {
          itemId: item.id,
          itemType: item.type,
          episodeNumber,
          matched: !!matched,
          catalogSize: episodesCatalog.length,
          printLiteUrl: !!printLiteUrl,
          printCid: !!printCid,
          motionCid: !!motionCid,
          itemMediaPdfLite: !!item.media?.pdf_lite_url,
          itemMediaPdfCid: !!item.media?.pdf_cid,
        });
        if (printLiteUrl || printCid) {
          setCurrentPdfLiteUrl(printLiteUrl || null);
          setCurrentPdfCid(printCid || null);
          setCurrentPdfTitle(matched?.title || `Episode ${matched?.displayNumber ?? episodeNumber}`);
          setPdfViewerOpen(true);
          return;
        }
        // Fallback to item's own media if catalog lookup didn't yield a URL
        if (item.media?.pdf_lite_url || item.media?.pdf_cid) {
          setCurrentPdfLiteUrl(item.media.pdf_lite_url || null);
          setCurrentPdfCid(item.media.pdf_cid || null);
          setCurrentPdfTitle(item.title);
          setPdfViewerOpen(true);
          return;
        }
        // Motion fallback for episodes where only motion is uploaded
        if (motionCid && matched) {
          void openEpisodeVideo(matched, motionCid, null);
          return;
        }
        toast({
          title: 'Content not yet available',
          description: `You own ${matched?.title || `Episode ${episodeNumber}`}, but the content hasn't been published yet.`,
        });
        return;
      }
      const resolvedItemPrice = resolveAccessPrice(item.metadata?.price);
      if (item.type === 'character_portrait') {
        if (resolvedItemPrice === null) {
          return;
        }
        // Character cards have a single still rendition (no motion variant)
        // — hide the version selector and let still/motion mirror the same
        // KNYT base so the modal stops showing the placeholder 2 / 4 KNYT.
        setPurchaseContent({
          type: 'character_card',
          id: item.id,
          title: item.title,
          image: item.thumbnail,
          baseKnyt: resolvedItemPrice,
          priceUsd: Number((resolvedItemPrice * 1.4).toFixed(2)),
          stillPriceKnyt: resolvedItemPrice,
          motionPriceKnyt: resolvedItemPrice,
          hideVersionSelector: true,
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

  // Phase E — Order tab right-HUD QuestRail data. Fetches /api/wallet/tasks
  // (spine-conformant; resolves the active persona server-side via session
  // cookie, no T0 in URL or response). The HUD is universal — every
  // signed-in user sees the General task families (Bring-a-Knight /
  // Knight-of-Attention / Herald) regardless of progress, so the fetch
  // does NOT gate on a client-side effectivePersonaId. Server returns 401
  // for unauthenticated callers; we silently leave the static fallback
  // in place. Refreshes on persona change + after a successful redemption.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/wallet/tasks', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (cancelled || !payload) return;
        setTaskData({
          activeTask: payload.questRail?.activeTask ?? null,
          rewards: Array.isArray(payload.questRail?.rewards) ? payload.questRail.rewards : [],
          ascensionRank: payload.questRail?.ascensionRank ?? {
            current: 'Initiate',
            next: 'Acolyte',
            progress: 0,
          },
          summary: payload.summary ?? undefined,
          reputation: payload.reputation ?? null,
        });
      })
      .catch(() => { /* non-fatal — leaves the static defaults in place */ });
    return () => { cancelled = true; };
  }, [effectivePersonaId]);

  const handleClaimReward = useCallback(async (rewardId: string) => {
    console.log('[KnytTab] Claiming reward via spine:', rewardId);
    try {
      const res = await fetch('/api/wallet/knyt/rewards/redeem', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        console.warn('[KnytTab] Reward redeem failed:', json?.reason || json?.error);
        return;
      }
      // Optimistic UI: drop the claimed row from the QuestRail. Next
      // /api/wallet/tasks fetch will reconcile.
      setTaskData(prev => ({
        ...prev,
        rewards: prev.rewards.filter(r => r.id !== rewardId),
      }));
      // Refresh DVN balance so the new credit shows in the wallet drawer
      // immediately. Tasks payload re-fetch is below.
      refreshBalance?.();
      try {
        const r = await fetch('/api/wallet/tasks', { credentials: 'include' });
        if (r.ok) {
          const payload = await r.json();
          setTaskData({
            activeTask: payload.questRail?.activeTask ?? null,
            rewards: Array.isArray(payload.questRail?.rewards) ? payload.questRail.rewards : [],
            ascensionRank: payload.questRail?.ascensionRank ?? {
              current: 'Initiate',
              next: 'Acolyte',
              progress: 0,
            },
          });
        }
      } catch { /* non-fatal */ }
    } catch (err) {
      console.error('[KnytTab] Redeem error:', err);
    }
  }, [refreshBalance]);

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
              summary={taskData.summary}
              reputation={taskData.reputation}
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
                      fetchOwnedEpisodes({ force: true });
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
                      // Phase B canonicalization: registry-first ownership. The
                      // legacy /api/codex/owned path can be empty in the iframe
                      // context even when the persona owns the content (the
                      // shelf + store work via the registry hook, which the
                      // scrolls tab now also consults). Registry unlocks; legacy
                      // is the fallback so unmigrated paths keep working.
                      const registryOwnsEp =
                        registryOwnership.get(`${episode.episodeNumber}:episode_print`) === true ||
                        registryOwnership.get(`${episode.episodeNumber}:episode_motion`) === true;
                      const isOwned = registryOwnsEp || owned.length > 0;
                      // Episode 0 = GN is free content — gating: free bypasses the payment gate
                      // without incorrectly stamping an "Owned" badge on free content.
                      const isGnFree = episode.episodeNumber === 0 &&
                        !!(episode.printCommonLiteUrl || episode.printCommonCid);
                      const cardId = episode.purchaseId || `mk_ep${String(episode.episodeNumber).padStart(2, '0')}`;
                      const cardAct = cardAccess.evaluate(
                        {
                          id: cardId,
                          source: 'codex',
                          episodeNumber: episode.episodeNumber,
                          gating: isGnFree ? { kind: 'free' as const } : undefined,
                        },
                        { manualOwned: isOwned },
                      );
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
                        episode.hasPrintLegendary ||
                        episode.hasPrintCommon;
                      // Defence-in-depth: even if the master-status flags are
                      // stale or undefined (API hadn't returned them yet),
                      // any episode object we've decided to render is gated.
                      // Without this guard, an unflagged episode card with
                      // only a Supabase-hosted common-tier PDF (where
                      // hasPrintCommon may be missing in older fixtures)
                      // would slip through with isAvailable=false → no gate.
                      const isAvailable = true;
                      const priceKnyt = resolveAccessPrice(episode.priceKnyt);
                      const priceUsd = episode.priceUsd ?? ((priceKnyt ?? 0) * 1.4);
                      // Episodes are inherently payment-gated content. The
                      // price field is for display; absence of a price MUST
                      // NOT imply free access (default-free invariant applies
                      // only at the loader level for non-codex content).
                      const isPaymentGated = isAvailable;

                      return (
                        <div
                          key={episode.episodeNumber}
                          className={`group relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 ${
                            isOwned ? 'ring-2 ring-cyan-400/50' : 'hover:ring-2 hover:ring-white/30'
                          }`}
                          onClick={() => {
                            // Self-diagnostic: log the gate decision so we can
                            // see in the console which input made the cart fire.
                            if (typeof window !== 'undefined') {
                              console.warn(
                                `[KnytTab:CARDCLICK] ep=${episode.episodeNumber} ` +
                                `cardId=${cardId} ` +
                                `isOwned=${isOwned} ` +
                                `registryOwnsEp=${registryOwnsEp} ` +
                                `ownedLen=${owned.length} ` +
                                `cardAct.showShoppingCart=${cardAct.showShoppingCart} ` +
                                `cardAct.showSmartActions=${cardAct.showSmartActions} ` +
                                `cardAct.reason=${cardAct.reason} ` +
                                `cardAct.cartCtaTarget=${cardAct.cartCtaTarget} ` +
                                `registryMapSize=${registryOwnership.size} ` +
                                `ownedEpsCount=${ownedEpisodeNumbers.size} ` +
                                `effectivePersonaId=${effectivePersonaId ?? '<none>'}`,
                              );
                            }
                            // Defensive override: if our local `isOwned` says
                            // the persona owns this episode (via registry OR
                            // /api/codex/owned OR cached ownedEpisodeNumbers),
                            // open the reader immediately. This bypasses any
                            // staleness in cardAct (which depends on a separate
                            // useOwnedAssets resolver that may not yet have
                            // populated). The cart only fires when we have NO
                            // ownership evidence from any source.
                            if (!isOwned && cardAct.showShoppingCart) {
                              cardAccess.handleCartClick(
                                { id: cardId, source: 'codex', episodeNumber: episode.episodeNumber },
                                cardAct,
                                {
                                  contentTitle: episode.title || `Episode ${episode.displayNumber}`,
                                  contentImage: episode.coverThumbUrl || (episode.coverImageCid ? `/api/content/cover/${encodeURIComponent(episode.coverImageCid)}?variant=thumb` : undefined),
                                  priceUsd,
                                },
                              );
                              return;
                            }
                            // Owned (or smart-action allowed) — open the reader.
                            if (!isOwned && !cardAct.showSmartActions) {
                              return; // Restricted (credential gate, no credential) — silent no-op
                            }
                            const printLiteUrl = episode.printRareLiteUrl || episode.printEpicLiteUrl || episode.printLegendaryLiteUrl || episode.printCommonLiteUrl;
                            const printCid = episode.printRareCid || episode.printEpicCid || episode.printLegendaryCid || episode.printCommonCid;
                            if (printLiteUrl || printCid) {
                              setCurrentPdfLiteUrl(printLiteUrl || null);
                              setCurrentPdfCid(printCid || null);
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

                          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                            {cardAct.showOwnedBadge       && <OwnedBadge />}
                            {cardAct.showAccessibleBadge  && <AccessibleBadge />}
                            {cardAct.showRestrictedBadge  && cardAct.restrictedReason && <RestrictedBadge reason={cardAct.restrictedReason} />}
                            {!isAvailable && cardAct.reason !== 'owned' && cardAct.reason !== 'credential-met' && (
                              <span className="px-2 py-1 bg-gray-500/80 text-white text-xs font-bold rounded flex items-center gap-1">
                                <Lock className="w-3 h-3" /> SOON
                              </span>
                            )}
                            {cardAct.showShoppingCart && priceKnyt && (
                              <span className="px-2 py-1 bg-amber-500/90 text-white text-xs font-bold rounded flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Coins className="w-3 h-3" />
                                {priceKnyt} KNYT
                              </span>
                            )}
                          </div>

                          <div className="absolute bottom-12 right-2 flex gap-1 z-10">
                            {/* Cart — render ONLY when payment-gated and not owned. Anonymous routes through sign-in. */}
                            {cardAct.showShoppingCart && (
                              <button
                                className="w-6 h-6 rounded-md bg-amber-500/80 backdrop-blur-sm flex items-center justify-center ring-1 ring-amber-400/40 text-white hover:bg-amber-400 transition-all"
                                title={cardAct.cartCtaTarget === 'sign-in' ? 'Sign in to buy' : (priceKnyt ? `Buy for ${priceKnyt} KNYT` : 'Buy')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cardAccess.handleCartClick(
                                    { id: cardId, source: 'codex', episodeNumber: episode.episodeNumber },
                                    cardAct,
                                    {
                                      contentTitle: episode.title || `Episode ${episode.displayNumber}`,
                                      contentImage: episode.coverThumbUrl || (episode.coverImageCid ? `/api/content/cover/${encodeURIComponent(episode.coverImageCid)}?variant=thumb` : undefined),
                                      priceUsd,
                                    },
                                  );
                                }}
                              >
                                <ShoppingCart className="w-3 h-3" />
                              </button>
                            )}
                            {/* Read — render ONLY when smart actions are allowed (owned or credentialed). */}
                            {cardAct.showSmartActions && (episode.hasPrintRare || episode.hasPrintEpic || episode.hasPrintLegendary || episode.hasPrintCommon) && (
                              <button
                                className="w-6 h-6 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-cyan-500/40 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all"
                                title="Read"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const printLiteUrl = episode.printRareLiteUrl || episode.printEpicLiteUrl || episode.printLegendaryLiteUrl || episode.printCommonLiteUrl;
                                  const printCid = episode.printRareCid || episode.printEpicCid || episode.printLegendaryCid || episode.printCommonCid;
                                  if (printLiteUrl || printCid) {
                                    setCurrentPdfLiteUrl(printLiteUrl || null);
                                    setCurrentPdfCid(printCid || null);
                                    setCurrentPdfTitle(episode.title || `Episode ${episode.displayNumber}`);
                                    setPdfViewerOpen(true);
                                  }
                                }}
                              >
                                <BookOpen className="w-3 h-3" />
                              </button>
                            )}
                            {/* Watch — same gate. */}
                            {cardAct.showSmartActions && episode.hasMotionMaster && (episodeVideo.cid || episodeVideo.url) && (
                              <button
                                className="w-6 h-6 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-cyan-500/40 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all"
                                title="Watch"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
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

          {/* PDF viewer split:
              - pdf_lite_url present (direct/Supabase URL): use PDFLiteReaderModal
                (fast browser-native iframe — 302 redirect bypasses Lambda).
              - Only pdf_cid (Autonomys): use PDFPageViewer (page-by-page render
                via /api/content/pdf-page; full-PDF proxy hits Lambda's 6MB limit
                and returns 413 for large files like episode PDFs). */}
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

          {pdfViewerOpen && !currentPdfLiteUrl && currentPdfCid && (
            <PDFPageViewer
              cid={currentPdfCid}
              title={currentPdfTitle}
              onClose={() => {
                setPdfViewerOpen(false);
                setCurrentPdfLiteUrl(null);
                setCurrentPdfCid(null);
                setCurrentPdfTitle('');
              }}
              onComplete={() => fireEpisodeComplete(currentPdfCid)}
            />
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
                onComplete={() => {
                  // The episode anchor is the FIRST segment's cid (or the
                  // current cid for single-segment content). This stays
                  // stable across segment switches so engagement_events
                  // dedupe correctly per episode.
                  const anchorCid = currentVideoSegments[0]?.auto_drive_cid || currentVideoCid;
                  fireEpisodeComplete(anchorCid);
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
              stillPriceKnytOverride={purchaseContent.stillPriceKnyt}
              motionPriceKnytOverride={purchaseContent.motionPriceKnyt}
              hideVersionSelector={purchaseContent.hideVersionSelector}
              knytBalance={balance?.dvnKnyt || 0}
              spendableKnyt={spendableBalance || 0}
              evmKnyt={balance?.evmKnyt || 0}
              onPurchaseComplete={() => {
                setPurchaseModalOpen(false);
                setPurchaseContent(null);
                fetchOwnedEpisodes({ force: true });
              }}
              onAddToCart={addPurchaseContentToCart}
              onBalanceRefresh={refreshBalance}
            />
          )}

          <KnytCartDrawer
            open={cartOpen}
            onClose={() => setCartOpen(false)}
            items={cart.items}
            onRemove={cart.removeFromCart}
            onSetQty={cart.setQty}
            onClearCart={cart.clearCart}
            personaId={effectivePersonaId}
            total={cart.total}
            totalWithKnyt={cart.totalWithKnyt}
            onSignInRequest={() => handleOpenWallet('signin')}
            onPurchaseComplete={() => {
              refreshPurchases();
              fetchOwnedEpisodes({ force: true });
            }}
          />

          {cart.count > 0 && !cartOpen && (
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-cyan-400/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25 backdrop-blur-md shadow-lg shadow-cyan-500/20 transition-all text-sm font-semibold"
              title="View cart"
            >
              <ShoppingCart className="w-4 h-4" />
              Cart · {cart.count}
            </button>
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
        walletTabSignal={copilotWalletSignal}
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
