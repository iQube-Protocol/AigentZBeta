"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";

const ExternalWalletConnect = dynamic(
  () => import("../wallet/ExternalWalletConnect").then((m) => ({ default: m.ExternalWalletConnect })),
  { ssr: false, loading: () => <div className="py-4 text-center text-xs text-white/30">Loading wallet…</div> }
);
import { useBalances } from "@/app/hooks/useBalances";
import { useDVNEvents } from "@/app/hooks/useDVNEvents";
import { useKnytBalance } from "@/app/hooks/useKnytBalance";
import { useBaseQcBalance } from "@/app/hooks/useBaseQcBalance";
import { useEthPrice } from "@/app/hooks/useEthPrice";
import { useSupabaseSessionPersonas } from "@/app/hooks/useSupabaseSessionPersonas";
import { getSupabaseBrowserClient } from "@/utils/supabaseBrowser";
import { useMetaAvatar } from "@/app/contexts/MetaAvatarContext";
import AliasConsentToggle from "../identity/AliasConsentToggle";
import SettlementRetryButton from "../x402/SettlementRetryButton";
import LibraryShelf from "./LibraryShelf";
import PurchaseFlow, { type PurchaseStep, type PaymentMethod } from "./PurchaseFlow";
import type { SmartWalletNode, WalletTask, QuestProgress, RecentReward, PersonaState } from "@/types/smartWallet";
import type { SmartContentQube } from "@/types/smartContent";
import {
  BuyKnytModal,
  PaymentRequestsPanel,
  PersonaEditModal,
  PersonaQuickAddModal,
  PersonaSetupWizard,
  TransactionModal,
  UnlockModal,
} from "../wallet";
import type { TransactionTab, ChainId, TransactionResult, PaymentRequest } from "../wallet/TransactionModal";
import { useSmartTriad } from "./SmartTriadProvider";
import { usePersonaSafe } from "@/app/contexts/PersonaContext";
import {
  addSmartWalletEventListener,
  SMART_WALLET_EVENTS,
} from "@/app/wallet/events";
import type {
  SmartWalletOpenDrawerEventDetail,
  SmartWalletPaymentEventDetail,
} from "@/app/wallet/contracts";
import {
  Sparkles,
  Library,
  Gift,
  CheckSquare,
  Check,
  Star,
  CreditCard,
  RefreshCw,
  Target,
  Wallet,
  Send,
  ArrowLeft,
  CircleDollarSign,
  Coins,
  TrendingUp,
  Award,
  Zap,
  BookOpen,
  Settings,
  ChevronDown,
  ChevronRight,
  Bot,
  User,
  X,
  FileText,
  Video,
  Headphones,
  MessageSquare,
  Clock,
  Link,
  Cloud,
  Share2,
  Heart,
  ThumbsUp,
  Users,
  Trophy,
  Medal,
  BadgeCheck,
  IdCard,
  Flame,
  Crown,
  Copy,
  Book,
  Film,
  Maximize2,
  Minimize2,
  LogOut,
  LogIn,
  Mail,
  Layers,
  EyeOff,
  RotateCcw,
  Trash2,
  Loader2,
} from "lucide-react";


// Tooltip component for icon hints
const Tooltip = ({ children, text }: { children: React.ReactNode; text: string }) => (
  <div className="relative group">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-slate-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-white/10">
      {text}
    </div>
  </div>
);

// Rarity knight icon paths: bronze = rare, silver = epic, gold = legendary
const RARITY_ICONS: Record<string, string> = {
  RARE: "/icons/knight-bronze.png",
  EPIC: "/icons/knight-silver.png",
  LEGENDARY: "/icons/knight-gold.png",
};

const getRarityIcon = (coverType: string | undefined): string | null => {
  if (!coverType) return null;
  const upper = coverType.toUpperCase();
  if (upper === "RARE" || upper === "PRINT_RARE") return RARITY_ICONS.RARE;
  if (upper === "EPIC" || upper === "PRINT_EPIC") return RARITY_ICONS.EPIC;
  if (upper === "LEGENDARY" || upper === "PRINT_LEGENDARY") return RARITY_ICONS.LEGENDARY;
  return null;
};

const getRarityTooltip = (coverType: string | undefined): string => {
  if (!coverType) return "";
  const upper = coverType.toUpperCase();
  if (upper === "RARE" || upper === "PRINT_RARE") return "Rare Edition";
  if (upper === "EPIC" || upper === "PRINT_EPIC") return "Epic Edition";
  if (upper === "LEGENDARY" || upper === "PRINT_LEGENDARY") return "Legendary Edition";
  return "";
};

const isMotionContent = (ent: any): boolean => {
  const assetId = ent?.contentId || ent?.assetId || "";
  const coverType = ent?.coverType || "";
  return assetId.toLowerCase().includes("motion") || String(coverType).toUpperCase() === "MOTION";
};

type DrawerTab = "wallet" | "library" | "tasks" | "reputation" | "rewards" | "payments" | "connections" | "iqube";

interface SmartWalletDrawerProps {
  open: boolean;
  onClose: () => void;
  agent: {
    id: string;
    name: string;
    evmSepolia?: `0x${string}`;
    evmArb?: `0x${string}`;
    btcAddress?: string;
    fioHandle?: string;
    walletAddress?: string;
  };
  personaId?: string;
  walletNode?: SmartWalletNode;
  currentContent?: SmartContentQube;
  onContentSelect?: (content: SmartContentQube) => void;
  onTaskAction?: (task: WalletTask, action: string) => void;
  onPurchaseComplete?: (content?: SmartContentQube) => void;
  recipientAddress?: string;
  initialTab?: DrawerTab;
  onPersonaChange?: (personaId: string) => void;
  onCreatePersona?: () => void;
  onSubmitReputationClaim?: (claimData: any) => void;
  onOpenCopilot?: () => void;
  showCopilot?: boolean;
  onCopilotPrompt?: (prompt: string) => void;
  variant?: 'overlay' | 'embedded';
  embeddedWidth?: 'fill' | 'fixed';
  embeddedAnchor?: 'left' | 'right';
  allowWideLayout?: boolean;
  codexMode?: boolean;
  onTabChange?: (tab: DrawerTab) => void;
  onCopilotStateChange?: (open: boolean) => void;
  /** When provided, the persona menu shows a "Set as default for this cartridge" option. */
  cartridgeSlug?: string;
}

const TAB_CONFIG: Array<{ key: DrawerTab; label: string; icon: React.ReactNode }> = [
  { key: "wallet", label: "Wallet", icon: <Wallet className="w-4 h-4" /> },
  { key: "library", label: "Library", icon: <BookOpen className="w-4 h-4" /> },
  { key: "tasks", label: "Tasks", icon: <CheckSquare className="w-4 h-4" /> },
  { key: "reputation", label: "Reputation", icon: <Trophy className="w-4 h-4" /> },
  { key: "rewards", label: "Rewards", icon: <Gift className="w-4 h-4" /> },
  { key: "payments", label: "Payments", icon: <CreditCard className="w-4 h-4" /> },
  { key: "connections", label: "Connections", icon: <Link className="w-4 h-4" /> },
  { key: "iqube",       label: "iQube",       icon: <Layers className="w-4 h-4" /> },
];

const TOKEN_LOGOS: Record<string, string> = {
  ethereum: "https://cryptologos.cc/logos/ethereum-eth-logo.png?v=040",
  arbitrum: "https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=040",
  base: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
  optimism: "https://cryptologos.cc/logos/optimism-ethereum-op-logo.png?v=040",
  polygon: "https://cryptologos.cc/logos/polygon-matic-logo.png?v=040",
  solana: "https://cryptologos.cc/logos/solana-sol-logo.png?v=040",
  bitcoin: "https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=040",
  usdc: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=040",
};

export default function SmartWalletDrawer({
  open,
  onClose,
  agent,
  personaId,
  walletNode,
  currentContent,
  onContentSelect,
  onTaskAction,
  onPurchaseComplete,
  recipientAddress,
  initialTab = "wallet",
  onPersonaChange,
  onCreatePersona,
  onSubmitReputationClaim,
  onOpenCopilot,
  showCopilot = false,
  onTabChange,
  variant = 'overlay',
  embeddedWidth = 'fill',
  embeddedAnchor = 'right',
  allowWideLayout = true,
  codexMode = false,
  onCopilotStateChange,
  cartridgeSlug,
}: SmartWalletDrawerProps) {
  const isValidEvmAddress = (value?: string): value is `0x${string}` =>
    typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

  // Persona EVM address override — starts with walletNode prop address if present,
  // then upgrades to the session-resolved persona's registered address via useEffect below.
  const walletNodePersonaEvmAddress = walletNode?.personaContext?.activePersona?.evmAddress as `0x${string}` | undefined;
  const [personaEvmOverride, setPersonaEvmOverride] = useState<`0x${string}` | undefined>(walletNodePersonaEvmAddress);
  // External wallet address connected via ExternalWalletConnect (MetaMask etc.)
  const [externalEvmAddress, setExternalEvmAddress] = useState<string | undefined>(undefined);
  const sanitizedEvmSepolia = personaEvmOverride || (isValidEvmAddress(agent.evmSepolia) ? agent.evmSepolia : undefined);
  const sanitizedEvmArb = personaEvmOverride || (isValidEvmAddress(agent.evmArb) ? agent.evmArb : undefined);

  const [activeTab, setActiveTab] = useState<DrawerTab>(initialTab);
  const [dismissed, setDismissed] = useState(false);
  const [localPersonaId, setLocalPersonaId] = useState<string | null>(null);
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0);
  const bals = useBalances(
    {
      sepolia: sanitizedEvmSepolia,
      arb: sanitizedEvmArb,
      base: sanitizedEvmSepolia || sanitizedEvmArb,
      btc: agent.btcAddress,
    },
    { refreshKey: balanceRefreshKey }
  );
  const { sessionEmail, sessionPersonas, signOut: signOutSession, signIn: signInWithEmail, refreshPersonas } = useSupabaseSessionPersonas();
  const { getCartridgeDefault, setCartridgeDefault } = usePersonaSafe();

  // Merge session-derived personas with any walletNode personas (session takes precedence, deduped by id)
  const allAvailablePersonas = useMemo((): PersonaState[] => {
    const fromWallet = walletNode?.personaContext?.availablePersonas ?? [];
    const merged = [...sessionPersonas, ...fromWallet];
    const seen = new Set<string>();
    return merged.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  }, [sessionPersonas, walletNode?.personaContext?.availablePersonas]);

  const activePersona =
    allAvailablePersonas.find(
      (persona) => persona.id === (walletNode?.personaContext?.activePersonaId ?? localPersonaId)
    ) || walletNode?.personaContext?.activePersona || allAvailablePersonas[0] || null;
  const hasAnyPersona = allAvailablePersonas.length > 0 || !!walletNode?.personaContext?.activePersonaId;
  const effectivePersonaId =
    personaId || localPersonaId || walletNode?.personaContext?.activePersonaId || activePersona?.id;
  const { balance: knytBalance, loading: knytLoading, refreshBalance: refreshKnyt } =
    useKnytBalance(effectivePersonaId, externalEvmAddress);
  const { balance: baseQcBalance } = useBaseQcBalance(effectivePersonaId);
  const { knytPriceUsd } = useEthPrice();
  const evs = useDVNEvents(agent.id);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionTab, setTransactionTab] = useState<TransactionTab>('send');
  const [prefillRecipient, setPrefillRecipient] = useState<string | undefined>();
  const [prefillAmount, setPrefillAmount] = useState<number | undefined>();
  const [prefillTxHash, setPrefillTxHash] = useState<string | undefined>();
  const [prefillChainId, setPrefillChainId] = useState<ChainId | undefined>();
  const [buyKnytModalOpen, setBuyKnytModalOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [personaSetupOpen, setPersonaSetupOpen] = useState(false);
  const [personaEditModalOpen, setPersonaEditModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<PersonaState | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [copilotMessages, setCopilotMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: "Hi! I can help you manage your wallet, find content, or answer questions. What would you like to do?" }
  ]);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotMode, setCopilotMode] = useState<'chat' | 'avatar'>('chat');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarOffset, setSidebarOffset] = useState(64);
  const [copilotQuickPromptsVisible, setCopilotQuickPromptsVisible] = useState(true);
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [confirmDeletePersonaId, setConfirmDeletePersonaId] = useState<string | null>(null);
  const [personaActionPending, setPersonaActionPending] = useState<string | null>(null);
  const [signInEmailInput, setSignInEmailInput] = useState("");
  const [signInPasswordInput, setSignInPasswordInput] = useState("");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signInPending, setSignInPending] = useState(false);
  const [showQcBreakdown, setShowQcBreakdown] = useState(false);
  const [logoLoadErrors, setLogoLoadErrors] = useState<Record<string, boolean>>({});
  const askCopilotCardRef = useRef<HTMLElement | null>(null);
  const copilotAnchorRef = useRef<HTMLDivElement | null>(null);
  const avatarAnchorRef = useRef<HTMLElement | null>(null);
  const copilotChatScrollRef = useRef<HTMLDivElement | null>(null);
  const copilotQuickPromptsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<any>(null);
  const [dvnExpanded, setDvnExpanded] = useState(true);
  const [tenantId, setTenantId] = useState<string>(
    process.env.NEXT_PUBLIC_TENANT_ID ||
      process.env.NEXT_PUBLIC_LVB_BRIDGE_TENANT_ID ||
      "default"
  );

  // Auto-select the first session persona when no active persona has been chosen yet
  useEffect(() => {
    if (!localPersonaId && !walletNode?.personaContext?.activePersonaId && sessionPersonas.length > 0) {
      setLocalPersonaId(sessionPersonas[0].id);
    }
  }, [sessionPersonas, localPersonaId, walletNode?.personaContext?.activePersonaId]);

  // When the session-resolved active persona has a registered EVM address, upgrade the
  // balance query address so on-chain Q¢ resolves to the persona's FIO-canonical wallet.
  useEffect(() => {
    const personaEvm = activePersona?.evmAddress;
    if (personaEvm && personaEvm !== personaEvmOverride) {
      setPersonaEvmOverride(personaEvm);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePersona?.evmAddress]);

  useEffect(() => {
    onCopilotStateChange?.(copilotOpen);
  }, [copilotOpen, onCopilotStateChange]);

  const scrollCopilotToBottom = useCallback(() => {
    if (!copilotChatScrollRef.current) return;
    requestAnimationFrame(() => {
      if (!copilotChatScrollRef.current) return;
      copilotChatScrollRef.current.scrollTop = copilotChatScrollRef.current.scrollHeight;
    });
  }, []);

  const showCopilotQuickPrompts = useCallback((timeoutMs = 3000) => {
    if (copilotQuickPromptsTimeoutRef.current) {
      clearTimeout(copilotQuickPromptsTimeoutRef.current);
    }
    setCopilotQuickPromptsVisible(true);
    copilotQuickPromptsTimeoutRef.current = setTimeout(() => {
      setCopilotQuickPromptsVisible(false);
    }, timeoutMs);
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (open) {
      setDismissed(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) setIsFullscreen(false);
  }, [open]);

  useEffect(() => {
    if (open && copilotOpen && copilotMode === "chat") {
      showCopilotQuickPrompts();
    }
  }, [open, copilotOpen, copilotMode, showCopilotQuickPrompts]);

  useEffect(() => {
    scrollCopilotToBottom();
  }, [copilotMessages, copilotLoading, scrollCopilotToBottom]);

  useEffect(() => {
    return () => {
      if (copilotQuickPromptsTimeoutRef.current) {
        clearTimeout(copilotQuickPromptsTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    onTabChange?.(activeTab);
  }, [activeTab, onTabChange]);

  useEffect(() => {
    if (activeTab !== "library" && selectedLibraryItem) {
      setSelectedLibraryItem(null);
    }
  }, [activeTab, selectedLibraryItem]);

  // MetaAvatar context for persistent iframe
  const { requestAvatar, releaseAvatar, refreshAvatar } = useMetaAvatar();
  
  // Handle sending a prompt to the copilot
  const handleSendPrompt = async (prompt?: string) => {
    const messageToSend = prompt || copilotPrompt.trim();
    if (!messageToSend) return;
    showCopilotQuickPrompts();
    
    // Add user message
    setCopilotMessages(prev => [...prev, { role: 'user', content: messageToSend }]);
    scrollCopilotToBottom();
    setCopilotPrompt("");
    setCopilotLoading(true);

    const localIntent = detectIntentAndSwitchTab(messageToSend);
    const baseMessages = [...copilotMessages, { role: 'user', content: messageToSend }];
    const localReply = localIntent.handled
      ? { role: 'assistant' as const, content: localIntent.response }
      : null;

    if (localIntent.handled) {
      if (localIntent.tab) setActiveTab(localIntent.tab);
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: localIntent.response }]);
    }
    
    try {
      // Call the wallet copilot API
      const response = await fetch('/api/wallet-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: localReply ? [...baseMessages, localReply] : baseMessages,
          context: {
            walletBalance: bals.qctArb ? Number(bals.qctArb) / Math.pow(10, bals.qctArbDecimals || 18) : 0,
            personaId: effectivePersonaId,
            agentName: agent.name,
          }
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const message = data.message || "I'm here to help! What would you like to know?";
        const content = localIntent.handled ? `More detail: ${message}` : message;
        setCopilotMessages(prev => [...prev, { role: 'assistant', content }]);
      } else {
        setCopilotMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't process that request. Please try again." }]);
      }
    } catch (error) {
      console.error('Copilot error:', error);
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting. Please try again later." }]);
    } finally {
      setCopilotLoading(false);
      scrollCopilotToBottom();
    }
  };
  
  // Try to use SmartTriad context if available
  let triadContext: ReturnType<typeof useSmartTriad> | null = null;
  try {
    triadContext = useSmartTriad();
  } catch {
    // Not wrapped in SmartTriadProvider - that's ok
  }

  const [aliasConsent, setAliasConsent] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("x402_alias_consent") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("x402_alias_consent", aliasConsent ? "true" : "false");
    } catch {}
  }, [aliasConsent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored =
        window.localStorage.getItem("currentTenantId") ||
        window.sessionStorage.getItem("currentTenantId");
      if (stored) setTenantId(stored);
    } catch {}
  }, []);

  const refreshWalletBalances = useCallback(() => {
    setBalanceRefreshKey((key) => key + 1);
    refreshKnyt();
  }, [refreshKnyt]);

  useEffect(() => {
    const generateDid = async () => {
      const fioHandle = agent?.fioHandle || activePersona?.fioHandle;
      if (!fioHandle) {
        setFioDid(null);
        return;
      }
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(fioHandle.toLowerCase());
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = new Uint8Array(hashBuffer);
        const hashHex = Array.from(hashArray)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        setFioDid(`did:iq:${hashHex.slice(0, 32)}`);
      } catch (err) {
        console.warn("[SmartWallet] Failed to generate FIO DID:", err);
        setFioDid(null);
      }
    };
    generateDid();
  }, [agent?.fioHandle, activePersona?.fioHandle]);

  // Request/release avatar based on copilot state and mode
  useEffect(() => {
    if (open && copilotOpen && copilotMode === 'avatar') {
      requestAvatar('copilot', 'aigent-moneypenny');
    } else {
      releaseAvatar('copilot');
    }
    
    // Cleanup on unmount
    return () => releaseAvatar('copilot');
  }, [open, copilotOpen, copilotMode, requestAvatar, releaseAvatar, agent?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const updateAnchor = () => {
      const anchor = askCopilotCardRef.current ?? avatarAnchorRef.current ?? copilotAnchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      root.style.setProperty("--metaavatar-copilot-x", `${Math.round(rect.left)}px`);
      root.style.setProperty("--metaavatar-copilot-y", `${Math.round(rect.top)}px`);
      root.style.setProperty("--metaavatar-copilot-w", `${Math.round(rect.width)}px`);
      root.style.setProperty("--metaavatar-copilot-h", `${Math.round(rect.height)}px`);
    };

    updateAnchor();
    let raf = 0;
    const tick = () => {
      updateAnchor();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, copilotOpen, copilotMode, activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readSidebarWidth = () => {
      const sidebar = document.querySelector("aside");
      if (!sidebar) {
        setSidebarOffset(0);
        return;
      }
      const width = Math.max(0, Math.round(sidebar.getBoundingClientRect().width));
      setSidebarOffset(width);
    };

    readSidebarWidth();
    const sidebar = document.querySelector("aside");
    const observer =
      sidebar && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => readSidebarWidth())
        : null;
    if (sidebar && observer) observer.observe(sidebar);
    window.addEventListener("resize", readSidebarWidth);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("resize", readSidebarWidth);
    };
  }, []);

  const [retrySettlementId, setRetrySettlementId] = useState("");
  const [retryMessageId, setRetryMessageId] = useState("");
  const [custodyCount, setCustodyCount] = useState(0);
  const [claimCount, setClaimCount] = useState(0);
  const [fioDid, setFioDid] = useState<string | null>(null);

  // Root DID identity profile sub-section
  interface IdentityProfile {
    canonicalId: string;
    email: string | null;
    personaCount: number;
    personaClusters: Array<{ clusterId: string; personaCount: number; isCanonical: boolean }>;
    storedEvmAddress: string | null;
    rootDid: string | null;
    rootId: string | null;
    kycStatus: string;
    emailAliases: Array<{ email: string; is_primary: boolean; is_verified: boolean; status: string }>;
    linkedProfiles: Array<{ linked_auth_profile_id: string; relationship_mode: string }>;
    didPersonas: Array<{ id: string; personaType: string; fioHandle: string | null }>;
  }
  const [identityProfile, setIdentityProfile] = useState<IdentityProfile | null>(null);
  const [rootDidExpanded, setRootDidExpanded] = useState(false);

  // Purchase flow state
  const [purchaseStep, setPurchaseStep] = useState<PurchaseStep>("idle");
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("arb");

  const [convertUsdcAmount, setConvertUsdcAmount] = useState<string>("");
  const [convertStep, setConvertStep] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertResult, setConvertResult] = useState<any>(null);

  const openTransactionModal = (
    tab: TransactionTab,
    opts?: { recipient?: string; amount?: number; txHash?: string; chainId?: ChainId }
  ) => {
    setPrefillRecipient(opts?.recipient);
    setPrefillAmount(opts?.amount);
    setPrefillTxHash(opts?.txHash);
    setPrefillChainId(opts?.chainId);
    setTransactionTab(tab);
    setTransactionModalOpen(true);
  };

  const handleTransactionComplete = (result: TransactionResult) => {
    if (!result.success) return;
    const content = result.txHash
      ? `✅ Transaction sent! Hash: ${result.txHash.slice(0, 10)}...${result.txHash.slice(-8)}. Amount: ${result.amount} Q¢`
      : `✅ ${result.deliveryMode === 'claim' ? 'Claim created' : 'Transaction completed'}! Amount: ${result.amount} Q¢`;
    setCopilotMessages(prev => [...prev, { role: 'assistant', content }]);
  };

  const handleRequestCreated = (request: PaymentRequest) => {
    setCopilotMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: `💰 Payment request created for ${request.amount} Q¢. Share the link or QR code with the payer.`,
      },
    ]);
  };

  const handlePaymentExecuted = (txHash: string, requestId: string) => {
    setCopilotMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: `✅ Payment executed for request ${requestId}. Tx hash: ${txHash.slice(0, 10)}...${txHash.slice(-8)}.`,
      },
    ]);
  };

  const handleArchivePersona = useCallback(async (personaId: string, archive: boolean) => {
    setPersonaActionPending(personaId);
    try {
      const { data: sessionData } = await getSupabaseBrowserClient().auth.getSession();
      const token = sessionData.session?.access_token;
      await fetch(`/api/wallet/persona/${personaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status: archive ? 'inactive' : 'active' }),
      });
      await refreshPersonas();
    } catch { /* non-fatal */ }
    finally { setPersonaActionPending(null); }
  }, [refreshPersonas]);

  const handleDeletePersona = useCallback(async (personaId: string) => {
    setPersonaActionPending(personaId);
    try {
      const { data: sessionData } = await getSupabaseBrowserClient().auth.getSession();
      const token = sessionData.session?.access_token;
      await fetch(`/api/wallet/persona/${personaId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setConfirmDeletePersonaId(null);
      await refreshPersonas();
    } catch { /* non-fatal */ }
    finally { setPersonaActionPending(null); }
  }, [refreshPersonas]);

  const handleOpenPersonaEdit = () => {
    if (!activePersona) return;
    setEditingPersona(activePersona);
    setPersonaEditModalOpen(true);
  };

  const handlePersonaCreated = (newPersonaId: string) => {
    setLocalPersonaId(newPersonaId);
    onPersonaChange?.(newPersonaId);
    setPersonaSetupOpen(false);
    // Re-fetch session personas so the newly created persona appears in the dropdown
    refreshPersonas();
  };
  
  // Persona state
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [isWalletUnlocked, setIsWalletUnlocked] = useState(false);
  const [personaToUnlock, setPersonaToUnlock] = useState<string | null>(null);

  // iQube persona minting state
  const [mintStatus, setMintStatus] = useState<"idle" | "staging" | "staged" | "error">("idle");
  const [mintStubId, setMintStubId] = useState<string | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);

  const handleStageMint = useCallback(async () => {
    setMintStatus("staging");
    setMintError(null);
    try {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const res = await fetch("/api/iqube/persona/qripto/mint", { method: "POST", headers });
      const data: { stub_id?: string; status?: string; error?: string } = await res.json();
      if (!res.ok) {
        setMintError(data.error ?? "Staging failed — check that you have an active Qripto persona.");
        setMintStatus("error");
        return;
      }
      setMintStubId(data.stub_id ?? null);
      setMintStatus("staged");
    } catch {
      setMintError("Network error — please try again.");
      setMintStatus("error");
    }
  }, []);

  const hasPaidTier = useCallback((content?: SmartContentQube | null): boolean => {
    if (!content) return false;
    const tiers = content.pricingModel?.tiers ?? [];
    return tiers.some((tier) => {
      const amount = Number(tier?.amount ?? 0);
      return Number.isFinite(amount) && amount > 0;
    });
  }, []);

  // Auto-start purchase flow when content changes and has a price
  useEffect(() => {
    if (currentContent && open) {
      if (hasPaidTier(currentContent)) {
        setPurchaseStep("confirm");
      } else {
        setPurchaseStep("idle");
      }
    }
  }, [currentContent, hasPaidTier, open]);

  // Reset purchase state when drawer closes
  useEffect(() => {
    if (!open) {
      setPurchaseStep("idle");
      setPurchaseError(null);
    }
  }, [open]);

  // Listen for SmartContent payment events
  useEffect(() => {
    const applyPaymentRequest = (item?: unknown) => {
      if (!item || typeof item !== "object") return;
      const paymentItem = item as SmartContentQube;
      const hasPaymentGate = hasPaidTier(paymentItem);

      if (onContentSelect) onContentSelect(paymentItem);

      if (open && hasPaymentGate) {
        setPurchaseStep("confirm");
        setPurchaseError(null);
      } else if (open && !hasPaymentGate) {
        // Defensive guard: never route free/unpriced content into wallet payment flow.
        setPurchaseStep("idle");
      }
    };

    const handleOverlayPayment = (detail: SmartWalletPaymentEventDetail) => {
      const { item } = detail || {};
      applyPaymentRequest(item);
    };

    const handleEmbeddedPayment = (detail: SmartWalletPaymentEventDetail) => {
      if (variant !== "embedded") return;
      const { item } = detail || {};
      applyPaymentRequest(item);
    };

    const handleLiquidPayment = (detail: SmartWalletPaymentEventDetail) => {
      const { item } = detail || {};
      applyPaymentRequest(item);
    };

    const handleOpenSmartWalletDrawer = (detail: SmartWalletOpenDrawerEventDetail) => {
      const { currentContent, open: shouldOpen } = detail || {};
      if (shouldOpen && onContentSelect && currentContent) {
        const selectedContent = currentContent as unknown as SmartContentQube;
        const hasPaymentGate = hasPaidTier(selectedContent);
        if (hasPaymentGate) {
          onContentSelect(selectedContent);
        } else if (open) {
          setPurchaseStep("idle");
        }
      }
    };

    const cleanups = [
      addSmartWalletEventListener(SMART_WALLET_EVENTS.overlayPayment, handleOverlayPayment),
      addSmartWalletEventListener(SMART_WALLET_EVENTS.embeddedPayment, handleEmbeddedPayment),
      addSmartWalletEventListener(SMART_WALLET_EVENTS.liquidPayment, handleLiquidPayment),
      addSmartWalletEventListener(SMART_WALLET_EVENTS.openDrawer, handleOpenSmartWalletDrawer),
    ];

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [open, onContentSelect, variant, hasPaidTier]);

  useEffect(() => {
    const did = agent?.id ? `did:iq:${agent.id}#auth` : undefined;
    if (!did) return;
    (async () => {
      try {
        const c = await fetch(`/api/x402/custody?did=${encodeURIComponent(did)}`, { cache: "no-store" });
        const cj = await c.json().catch(() => ({}));
        if (cj?.ok && Array.isArray(cj.data)) setCustodyCount(cj.data.length);
      } catch {}
      try {
        const r = await fetch(`/api/x402/claims?did=${encodeURIComponent(did)}&status=open`, { cache: "no-store" });
        const rj = await r.json().catch(() => ({}));
        if (rj?.ok && Array.isArray(rj.data)) setClaimCount(rj.data.length);
      } catch {}
    })();
  }, [agent?.id]);

  // Fetch identity profile when wallet tab is active and user is signed in
  useEffect(() => {
    if (activeTab !== 'wallet' || !sessionEmail) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
        if (!session?.access_token || cancelled) return;
        const res = await fetch('/api/wallet/identity/profile', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setIdentityProfile(data);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [activeTab, sessionEmail]);

  const formatToken = (raw?: string, decimals?: number, fractionDigits: number = 0) => {
    try {
      const d = typeof decimals === "number" ? decimals : 0;
      const bi = BigInt(raw || "0");
      if (d <= 0) return Number(bi).toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
      const factor = 10 ** Math.min(d, 18);
      const whole = Number(bi) / factor;
      return whole.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
    } catch {
      return "0";
    }
  };

  const formatUSDC = (raw?: string, decimals?: number) => formatToken(raw, decimals, 2);
  const formatQcent = (raw?: string, decimals?: number) => formatToken(raw, decimals, 0);
  const formatFixed = (value?: number | null, digits: number = 2) =>
    Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

  const balanceRows: Array<{
    key: string;
    label: string;
    value: string;
    unit: string;
    logo?: string;
    fallbackIcon: React.ReactNode;
    dvn?: boolean;
  }> = [
    {
      key: "eth-qc",
      label: "Ethereum Q¢",
      value: formatQcent(bals.qctSep, bals.qctSepDecimals),
      unit: "Q¢",
      logo: TOKEN_LOGOS.ethereum,
      fallbackIcon: <Coins className="w-4 h-4 text-indigo-300" />,
    },
    {
      key: "arb-qc",
      label: "Arbitrum Q¢",
      value: formatQcent(bals.qctArb, bals.qctArbDecimals),
      unit: "Q¢",
      logo: TOKEN_LOGOS.arbitrum,
      fallbackIcon: <Zap className="w-4 h-4 text-cyan-300" />,
    },
    {
      key: "base-qc",
      label: "Base Q¢",
      value: formatQcent(bals.qctBase, bals.qctBaseDecimals),
      unit: "Q¢",
      logo: TOKEN_LOGOS.base,
      fallbackIcon: <TrendingUp className="w-4 h-4 text-blue-300" />,
    },
    {
      key: "dvn-qc",
      label: "Q¢ (DVN)",
      value: (baseQcBalance?.dvnQc ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      unit: "Q¢",
      fallbackIcon: <Coins className="w-4 h-4 text-cyan-300" />,
      dvn: true,
    },
    {
      key: "opt-qc",
      label: "Optimism Q¢",
      value: "0",
      unit: "Q¢",
      logo: TOKEN_LOGOS.optimism,
      fallbackIcon: <TrendingUp className="w-4 h-4 text-rose-300" />,
    },
    {
      key: "polygon-qc",
      label: "Polygon Q¢",
      value: "0",
      unit: "Q¢",
      logo: TOKEN_LOGOS.polygon,
      fallbackIcon: <TrendingUp className="w-4 h-4 text-purple-300" />,
    },
    {
      key: "sol-qc",
      label: "Solana Q¢",
      value: "0",
      unit: "Q¢",
      logo: TOKEN_LOGOS.solana,
      fallbackIcon: <TrendingUp className="w-4 h-4 text-emerald-300" />,
    },
    {
      key: "btc-qc",
      label: "Bitcoin Q¢",
      value: formatQcent(bals.btcQcent, 0),
      unit: "Q¢",
      logo: TOKEN_LOGOS.bitcoin,
      fallbackIcon: <TrendingUp className="w-4 h-4 text-amber-300" />,
    },
    {
      key: "knyt-dvn",
      label: "KNYT (DVN)",
      value: formatFixed(knytBalance?.dvnKnyt ?? 0),
      unit: "KNYT",
      fallbackIcon: <Award className="w-4 h-4 text-amber-300" />,
    },
    {
      key: "knyt-evm",
      label: "KNYT (EVM)",
      value: formatFixed(knytBalance?.evmKnyt ?? 0),
      unit: "KNYT",
      fallbackIcon: <Award className="w-4 h-4 text-amber-200" />,
    },
    {
      key: "usdc",
      label: "USDC",
      value: formatUSDC(bals.usdcSep, bals.usdcSepDecimals),
      unit: "USDC",
      logo: TOKEN_LOGOS.usdc,
      fallbackIcon: <CircleDollarSign className="w-4 h-4 text-green-300" />,
    },
  ];
  const qcentBalanceRows = balanceRows.filter((row) => row.unit === "Q¢");
  const nonQcentBalanceRows = balanceRows.filter((row) => row.unit !== "Q¢");

  const detectIntentAndSwitchTab = (
    message: string
  ): { tab: DrawerTab | null; response: string; handled: boolean } => {
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('reward') || lowerMsg.includes('earn') || lowerMsg.includes('earning')) {
      return {
        tab: 'rewards',
        response: `Here's your rewards overview! You've earned ${rewards?.totalEarned?.amount || 0} Q¢ total. ${
          rewards?.recentRewards?.length
            ? `Your most recent reward was for "${rewards.recentRewards[0].reason}".`
            : 'Complete tasks to start earning rewards!'
        }`,
        handled: true,
      };
    }

    if (
      lowerMsg.includes('task') ||
      lowerMsg.includes('todo') ||
      lowerMsg.includes('what can i do') ||
      lowerMsg.includes('how can i earn')
    ) {
      const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
      return {
        tab: 'tasks',
        response: `You have ${pendingTasks.length} active task${pendingTasks.length !== 1 ? 's' : ''}! ${
          pendingTasks.length > 0
            ? `Try "${pendingTasks[0].label}" to earn +${pendingTasks[0].rewardPreview?.amount || 0} Q¢.`
            : 'Check back soon for new tasks.'
        }`,
        handled: true,
      };
    }

    if (
      lowerMsg.includes('balance') ||
      lowerMsg.includes('afford') ||
      lowerMsg.includes('how much') ||
      lowerMsg.includes('wallet') ||
      lowerMsg.includes('money')
    ) {
      return {
        tab: 'wallet',
        response: `Your current balance is ${walletNode?.balances?.totalQc?.toLocaleString() || 0} Q¢.${
          walletNode?.balances?.pendingRewards
            ? ` You also have ${walletNode.balances.pendingRewards} Q¢ in pending rewards!`
            : ''
        }`,
        handled: true,
      };
    }

    if (
      lowerMsg.includes('pay') ||
      lowerMsg.includes('payment') ||
      lowerMsg.includes('purchase') ||
      lowerMsg.includes('checkout') ||
      lowerMsg.includes('buy')
    ) {
      return {
        tab: 'payments',
        response: `Opening payments. If you have content selected, you can complete the purchase flow here.`,
        handled: true,
      };
    }

    if (
      lowerMsg.includes('library') ||
      lowerMsg.includes('content') ||
      lowerMsg.includes('own') ||
      lowerMsg.includes('purchased') ||
      lowerMsg.includes('read')
    ) {
      const entitlements = walletNode?.contentEntitlements || [];
      return {
        tab: 'library',
        response: `You have ${entitlements.length} item${entitlements.length !== 1 ? 's' : ''} in your library. ${
          entitlements.length > 0 ? 'Tap any item to continue reading!' : 'Purchase or earn content to build your library.'
        }`,
        handled: true,
      };
    }

    if (
      lowerMsg.includes('reputation') ||
      lowerMsg.includes('score') ||
      lowerMsg.includes('badge') ||
      lowerMsg.includes('level') ||
      lowerMsg.includes('rank')
    ) {
      const repScore = activePersona?.reputationScore || 0;
      const badges = activePersona?.badges || [];
      return {
        tab: 'reputation',
        response: `Your reputation score is ${repScore}. ${
          badges.length > 0
            ? `You've earned ${badges.length} badge${badges.length !== 1 ? 's' : ''}: ${badges.join(', ')}.`
            : 'Complete tasks and engage with content to earn badges!'
        }`,
        handled: true,
      };
    }

    if (lowerMsg.includes('send') || lowerMsg.includes('transfer') || lowerMsg.includes('pay ')) {
      const amountMatch = lowerMsg.match(/(\d+(?:\.\d+)?)\s*(?:q¢|qc|qct|tokens?)?/i);
      const extractedAmount = amountMatch ? parseFloat(amountMatch[1]) : undefined;
      const fioMatch = lowerMsg.match(/(?:to\s+)?([a-z0-9]+@[a-z0-9]+)/i);
      const addressMatch = lowerMsg.match(/(?:to\s+)?(0x[a-fA-F0-9]{40})/i);
      const extractedRecipient = fioMatch?.[1] || addressMatch?.[1];
      openTransactionModal('send', { amount: extractedAmount, recipient: extractedRecipient });
      return {
        tab: 'wallet',
        response: extractedRecipient
          ? `Opening send dialog${extractedAmount ? ` for ${extractedAmount} Q¢` : ''} to ${extractedRecipient}. Please confirm the transaction details.`
          : `Opening send dialog${extractedAmount ? ` for ${extractedAmount} Q¢` : ''}. Enter the recipient address or Persona handle to continue.`,
        handled: true,
      };
    }

    if (lowerMsg.includes('receive') || lowerMsg.includes('request') || lowerMsg.includes('get paid') || lowerMsg.includes('invoice')) {
      const amountMatch = lowerMsg.match(/(\d+(?:\.\d+)?)\s*(?:q¢|qc|qct|tokens?)?/i);
      const extractedAmount = amountMatch ? parseFloat(amountMatch[1]) : undefined;
      openTransactionModal('receive', { amount: extractedAmount });
      return {
        tab: 'wallet',
        response: `Opening payment request dialog${extractedAmount ? ` for ${extractedAmount} Q¢` : ''}. You can generate a QR code or shareable link.`,
        handled: true,
      };
    }

    if (
      lowerMsg.includes('verify') ||
      lowerMsg.includes('check tx') ||
      lowerMsg.includes('check transaction') ||
      lowerMsg.includes('tx status') ||
      lowerMsg.includes('transaction status')
    ) {
      const txMatch = lowerMsg.match(/(0x[a-fA-F0-9]{64})/i);
      const extractedTxHash = txMatch?.[1];
      openTransactionModal('verify', { txHash: extractedTxHash });
      return {
        tab: 'wallet',
        response: extractedTxHash
          ? `Verifying transaction ${extractedTxHash.slice(0, 10)}...${extractedTxHash.slice(-8)}. Please wait.`
          : 'Opening transaction verification. Enter a transaction hash to check its status.',
        handled: true,
      };
    }

    if (lowerMsg.includes('convert') || lowerMsg.includes('swap') || lowerMsg.includes('usdc')) {
      const amountMatch = lowerMsg.match(/(\d+(?:\.\d+)?)\s*usdc/i);
      const extractedAmount = amountMatch ? amountMatch[1] : undefined;
      if (extractedAmount) setConvertUsdcAmount(extractedAmount);
      return {
        tab: 'wallet',
        response: `Opening USDC → Q¢ conversion${extractedAmount ? ` with ${extractedAmount} USDC prefilled` : ''}.`,
        handled: true,
      };
    }

    if (lowerMsg.includes('knyt')) {
      const priceUsd = Number.isFinite(knytPriceUsd) ? knytPriceUsd : 0;
      if (lowerMsg.includes('buy') || lowerMsg.includes('purchase') || lowerMsg.includes('get')) {
        setBuyKnytModalOpen(true);
        return {
          tab: 'wallet',
          response: `Opening KNYT purchase dialog. Current price: $${priceUsd.toFixed(2)} per KNYT (0.0005 ETH). You currently have ${knytBalance?.dvnKnyt?.toFixed(2) || '0'} KNYT.`,
          handled: true,
        };
      }
      if (lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('worth')) {
        return {
          tab: 'wallet',
          response: `KNYT is priced at $${priceUsd.toFixed(2)} per token (0.0005 ETH). KNYT is used for DVN attestation fees, cross-chain messaging, and premium features.`,
          handled: true,
        };
      }
      if (lowerMsg.includes('balance') || lowerMsg.includes('how much') || lowerMsg.includes('have')) {
        const balance = knytBalance?.dvnKnyt || 0;
        return {
          tab: 'wallet',
          response: `You have ${balance.toFixed(2)} KNYT (worth ~$${(balance * priceUsd).toFixed(2)}). Use KNYT for DVN fees and cross-chain operations.`,
          handled: true,
        };
      }
      return {
        tab: 'wallet',
        response: `KNYT is the utility token for DVN attestation and cross-chain operations. Price: $${priceUsd.toFixed(2)}/KNYT. Your balance: ${knytBalance?.dvnKnyt?.toFixed(2) || '0'} KNYT. Say "buy KNYT" to purchase more.`,
        handled: true,
      };
    }

    if (lowerMsg.includes('dvn') || lowerMsg.includes('event') || lowerMsg.includes('attestation')) {
      const events = evs || [];
      return {
        tab: 'wallet',
        response: `DVN (Decentralized Verification Network) handles cross-chain attestations. ${
          events.length > 0 ? `Recent events: ${events.slice(0, 2).map((e) => e.event).join(', ')}.` : 'No recent DVN events.'
        } KNYT is used to pay DVN fees.`,
        handled: true,
      };
    }

    if (
      lowerMsg.includes('x402') ||
      lowerMsg.includes('settlement') ||
      lowerMsg.includes('custody') ||
      lowerMsg.includes('settlement id') ||
      lowerMsg.includes('message id')
    ) {
      const settlementMatch =
        lowerMsg.match(/settlement(?: id|_id)?[:\s]+([a-z0-9\-_]+)/i) ||
        lowerMsg.match(/settle(?:ment)?[:\s]+([a-z0-9\-_]+)/i) ||
        lowerMsg.match(/x402[:\s]+([a-z0-9\-_]+)/i);
      const messageMatch =
        lowerMsg.match(/message(?: id|_id)?[:\s]+([a-z0-9\-_]+)/i) ||
        lowerMsg.match(/msg(?: id|_id)?[:\s]+([a-z0-9\-_]+)/i);
      const uuidMatches = message.match(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
      );
      const hashMatches = message.match(/\b[0-9a-f]{64}\b/gi);

      if (settlementMatch?.[1]) setRetrySettlementId(settlementMatch[1]);
      if (messageMatch?.[1]) setRetryMessageId(messageMatch[1]);
      if (!settlementMatch?.[1] && !messageMatch?.[1]) {
        if (uuidMatches?.length === 1) {
          if (lowerMsg.includes('message') || lowerMsg.includes('msg')) {
            setRetryMessageId(uuidMatches[0]);
          } else {
            setRetrySettlementId(uuidMatches[0]);
          }
        } else if (hashMatches?.length === 1) {
          setRetryMessageId(hashMatches[0]);
        }
      }
      return {
        tab: 'wallet',
        response: `x402 is the payment protocol for content monetization. You have ${custodyCount} custody sessions and ${claimCount} pending claims. ${
          settlementMatch?.[1] || messageMatch?.[1] || uuidMatches?.length || hashMatches?.length
            ? 'I prefilled the settlement fields for you. Review them and retry.'
            : 'To retry a specific settlement, enter the Settlement ID and/or Message ID in the x402 Settlement section.'
        }`,
        handled: true,
      };
    }

    if (
      lowerMsg.includes('persona') ||
      lowerMsg.includes('identity') ||
      lowerMsg.includes('wallet address') ||
      lowerMsg.includes('fio')
    ) {
      return {
        tab: 'wallet',
        response: `Your x402 Wallet ID (DID): ${fioDid ? fioDid.slice(0, 16) + '...' : 'Not set'}. Persona Handle: ${
          agent.fioHandle || 'Not set'
        }. Your DID maps to all your chain addresses (EVM, BTC, SOL) via FIO.`,
        handled: true,
      };
    }

    if (lowerMsg.includes('what can i buy') || lowerMsg.includes('buy')) {
      return {
        tab: 'library',
        response: 'Browse available content in your library tab. You can purchase or unlock items with Q¢.',
        handled: true,
      };
    }

    return {
      tab: null,
      response:
        "I'm here to help! Ask me about your balance, KNYT, rewards, tasks, library, or reputation. I can also help you send/receive payments, buy KNYT, or check DVN events.",
      handled: false,
    };
  };

  const qctEvmTotal = (() => {
    try {
      const ethQ = Number(BigInt(bals.qctSep || "0")) / 10 ** (bals.qctSepDecimals ?? 0);
      const arbQ = Number(BigInt(bals.qctArb || "0")) / 10 ** (bals.qctArbDecimals ?? 0);
      const baseQ = Number(BigInt(bals.qctBase || "0")) / 10 ** (bals.qctBaseDecimals ?? 0);
      const btcQ = Number(BigInt(bals.btcQcent || "0"));
      return ethQ + arbQ + baseQ + btcQ;
    } catch {
      return 0;
    }
  })();
  const qctDvnTotal = baseQcBalance?.dvnQc ?? 0;
  const qctCombinedTotal = qctEvmTotal + qctDvnTotal;
  const qctTotalStr = qctCombinedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const knytTotal = knytBalance?.totalKnyt ?? 0;
  const knytUsd = knytPriceUsd ? (knytTotal * knytPriceUsd).toFixed(2) : "0.00";
  const walletAddress = walletNode?.walletAddresses?.evm || sanitizedEvmArb || sanitizedEvmSepolia;

  // Get tasks from wallet node or use empty array
  const tasks = walletNode?.tasks || [];
  const quests = walletNode?.activeQuests || [];
  const rewards = walletNode?.rewardsContext;

  // Get pricing info for current content
  const contentPrice = currentContent?.pricingModel?.tiers?.[0];
  const isFreeContent = !contentPrice || contentPrice.kind === "free" || contentPrice.amount === 0;

  // Handle purchase flow
  const handleStartPurchase = () => {
    setPurchaseStep("confirm");
    setPurchaseError(null);
  };

  const handleConfirmPurchase = async () => {
    if (!currentContent || !effectivePersonaId) return;
    
    setPurchaseStep("processing");
    setPurchaseError(null);
    
    // Check if content ID is a valid UUID (real database content)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isRealContent = uuidRegex.test(currentContent.id);
    
    // Get chain config based on payment method
    // Phase 1: USDC is Base-only.
    const QCT_TOKEN_ADDRESS = "0x4C4f1aD931589449962bB675bcb8e95672349d09";
    const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const CHAIN_CONFIG: Record<Exclude<PaymentMethod, "dvn-qc">, { chainId: number; asset: string; name: string; tokenAddress?: string; decimals: number }> = {
      arb: { chainId: 421614, asset: "QCT", name: "Arbitrum Sepolia", tokenAddress: QCT_TOKEN_ADDRESS, decimals: 18 },
      base: { chainId: 84532, asset: "QCT", name: "Base Sepolia", tokenAddress: QCT_TOKEN_ADDRESS, decimals: 18 },
      polygon: { chainId: 80002, asset: "QCT", name: "Polygon Amoy", tokenAddress: QCT_TOKEN_ADDRESS, decimals: 18 },
      optimism: { chainId: 11155420, asset: "QCT", name: "Optimism Sepolia", tokenAddress: QCT_TOKEN_ADDRESS, decimals: 18 },
      usdc: { chainId: 84532, asset: "USDC", name: "Base Sepolia (USDC)", tokenAddress: USDC_BASE_SEPOLIA, decimals: 6 },
      knyt: { chainId: 1, asset: "KNYT", name: "Ethereum Mainnet", decimals: 18 },
    };

    try {
      const paymentAmount = contentPrice?.amount || 0;
      const payTo = recipientAddress || currentContent.creatorRootDid;

      // Guard: don't let the UI send USDC for non-USDC priced tiers.
      const tierCurrency = (contentPrice?.currency || "").toUpperCase();
      if (selectedPaymentMethod === "usdc" && tierCurrency !== "USDC") {
        throw new Error(`This content is priced in ${contentPrice?.currency || "unknown"}. Select a Q¢ or KNYT rail, or choose a USDC-priced tier.`);
      }

      // DVN Q¢ path: debit off-chain qc_balances (no on-chain tx needed)
      if (selectedPaymentMethod === "dvn-qc") {
        if (!effectivePersonaId) throw new Error("No active persona for DVN Q¢ payment.");
        if (paymentAmount > 0) {
          const debitRes = await fetch("/api/wallet/base-qc/debit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personaId: effectivePersonaId,
              amount: paymentAmount,
              contentId: currentContent.id,
              reason: "content_purchase",
            }),
          });
          if (!debitRes.ok) {
            const err = await debitRes.json().catch(() => ({}));
            throw new Error((err as any).error || "DVN Q¢ debit failed");
          }
        }
        // Grant entitlement after DVN debit
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(currentContent.id)) {
          await fetch(`/api/content/pricing/${currentContent.id}/entitlement`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personaId: effectivePersonaId,
              scope: "full",
              acquiredVia: "purchase",
              txHash: null,
              chainId: null,
            }),
          }).catch(() => {});
        }
        setPurchaseStep("success");
        onPurchaseComplete?.(currentContent);
        refreshWalletBalances?.();
        setTimeout(() => { setPurchaseStep("idle"); }, 2000);
        return;
      }

      const chainConfig = CHAIN_CONFIG[selectedPaymentMethod as Exclude<PaymentMethod, "dvn-qc">];

      if (paymentAmount > 0 && payTo) {
        // Use the a2a signer to transfer tokens
        const transferRes = await fetch("/api/a2a/signer/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chainId: chainConfig.chainId,
            amount: (BigInt(paymentAmount) * 10n ** BigInt(chainConfig.decimals)).toString(),
            asset: chainConfig.asset,
            agentId: agent.id, // Payer agent (AigentZ)
            to: payTo, // Recipient (Kn0w1)
            tokenAddress: chainConfig.tokenAddress,
          }),
        });
        
        if (!transferRes.ok) {
          const text = await transferRes.text();
          let errorMsg = "Payment failed";
          try {
            const err = JSON.parse(text);
            errorMsg = err.error || errorMsg;
          } catch {
            errorMsg = text || errorMsg;
          }
          throw new Error(errorMsg);
        }
        
        const transferData = await transferRes.json();
        const txHash = transferData.txHash;
        
        // Step 2: Grant entitlement after successful payment (only for real content)
        if (isRealContent && txHash) {
          const entitlementRes = await fetch(`/api/content/pricing/${currentContent.id}/entitlement`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personaId: effectivePersonaId,
              scope: "full",
              acquiredVia: "purchase",
              txHash,
              chainId: chainConfig.chainId,
            }),
          });
          
          if (!entitlementRes.ok) {
            console.warn("Entitlement grant failed but payment succeeded:", await entitlementRes.text());
          }
        }
      } else if (!isRealContent) {
        // Demo content with no payment - simulate success
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setPurchaseStep("success");
      onPurchaseComplete?.(currentContent);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setPurchaseStep("idle");
      }, 2000);
    } catch (err: any) {
      setPurchaseError(err.message);
      setPurchaseStep("error");
    }
  };

  const handleCancelPurchase = () => {
    setPurchaseStep("idle");
    setPurchaseError(null);
  };

  const handleConvertUsdcToQc = async () => {
    if (!effectivePersonaId) return;
    setConvertStep("processing");
    setConvertError(null);
    setConvertResult(null);

    const n = Number(convertUsdcAmount);
    if (!Number.isFinite(n) || n <= 0) {
      setConvertError("Enter a valid USDC amount");
      setConvertStep("error");
      return;
    }

    try {
      const r = await fetch("/api/wallet/qct/convert/usdc-to-qc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId: effectivePersonaId, usdcAmount: n }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Conversion failed");
      }

      setConvertResult(j);
      setConvertStep("success");
      setConvertUsdcAmount("");
    } catch (e: any) {
      setConvertError(e?.message || "Conversion failed");
      setConvertStep("error");
    }
  };

  if (!open || dismissed) return null;

  // Variant-based styling
  const getDrawerClasses = () => {
    if (variant === "embedded") {
      const edgeBorderClass =
        embeddedAnchor === "left" ? "border-r border-white/10" : "border-l border-white/10";
      const baseClasses = `h-full bg-black/30 backdrop-blur-xl ring-1 ring-white/10 ${edgeBorderClass}`;
      const drawerWidth =
        embeddedWidth === "fill"
          ? "w-full"
          : copilotOpen && allowWideLayout
            ? "w-[32.25rem]"
            : "w-[23.25rem]";
      const anchorClass =
        embeddedWidth === "fill" ? "" : embeddedAnchor === "left" ? "mr-auto" : "ml-auto";
      return `${baseClasses} ${drawerWidth} ${anchorClass}`;
    }
    // Overlay mode
    // In codex mode, prevent expansion when copilot is open
    if (isFullscreen) {
      return `fixed inset-y-0 right-0 shadow-2xl bg-black/30 backdrop-blur-xl ring-1 ring-white/10 border-l border-white/10`;
    }
    const drawerWidth = copilotOpen && !codexMode ? "w-[28rem]" : "w-[22.5rem]";
    const baseClasses = `fixed inset-y-0 right-0 ${drawerWidth} shadow-2xl bg-black/30 backdrop-blur-xl ring-1 ring-white/10 border-l border-white/10`;
    return codexMode ? `${baseClasses} ring-indigo-500/30 border-l-indigo-500/30` : baseClasses;
  };

  return (
    <div className={variant === "overlay" ? "fixed inset-0 z-50" : "h-full min-h-0"}>
      {variant === 'overlay' && (
        <div className="absolute inset-0 drawer-backdrop bg-black/60 backdrop-blur-sm" onClick={onClose} />
      )}
      <div
        className={`${getDrawerClasses()} overflow-hidden min-h-0 flex flex-col transition-all duration-300 pt-4`}
        style={variant === "overlay" && isFullscreen ? { left: `${sidebarOffset}px` } : undefined}
      >
        {/* Header with persona switch + controls (Qriptopian parity) */}
        <header className="flex items-center justify-between gap-2 px-3 py-2 mx-3 rounded-xl bg-white/5 ring-1 ring-white/10 flex-shrink-0">
          <div className="relative z-[100]">
            <button
              onClick={() => setPersonaMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 hover:bg-white/5 rounded-lg p-1.5 transition-colors"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${activePersona?.isAgent ? "bg-amber-500/20" : "bg-cyan-500/20"}`}>
                {activePersona?.isAgent ? (
                  <Bot className="w-4 h-4 text-amber-400" />
                ) : (
                  <User className="w-4 h-4 text-cyan-400" />
                )}
              </div>
              {(activePersona?.fioHandle || agent.fioHandle) && (
                <span className={`text-xs font-medium truncate max-w-[110px] ${activePersona?.isAgent ? "text-amber-300" : "text-cyan-300"}`}>
                  {activePersona?.fioHandle || agent.fioHandle}
                </span>
              )}
              <ChevronDown className={`w-3 h-3 text-white/50 transition-transform ${personaMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {personaMenuOpen && (
              <div className="absolute top-full left-0 mt-1 min-w-[240px] bg-slate-950 rounded-lg border border-white/20 shadow-2xl z-[200] overflow-hidden">

                {/* Signed-in account header */}
                {sessionEmail && (
                  <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                    <p className="text-xs text-white/60 truncate">{sessionEmail}</p>
                  </div>
                )}

                {/* Inline sign-in form — shown when not signed in */}
                {!sessionEmail && signingIn && (
                  <div className="px-3 py-3 border-b border-white/10">
                    <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Sign In</p>
                    <input
                      type="email"
                      placeholder="Email"
                      value={signInEmailInput}
                      onChange={(e) => setSignInEmailInput(e.target.value)}
                      className="w-full mb-2 px-2 py-1.5 text-sm bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
                      autoComplete="email"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={signInPasswordInput}
                      onChange={(e) => setSignInPasswordInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key !== "Enter") return;
                        setSignInPending(true);
                        setSignInError(null);
                        const { error } = await signInWithEmail(signInEmailInput, signInPasswordInput);
                        setSignInPending(false);
                        if (error) {
                          setSignInError(error);
                        } else {
                          setSigningIn(false);
                          setSignInEmailInput("");
                          setSignInPasswordInput("");
                          setPersonaMenuOpen(false);
                        }
                      }}
                      className="w-full mb-2 px-2 py-1.5 text-sm bg-white/5 border border-white/10 rounded text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
                      autoComplete="current-password"
                    />
                    {signInError && (
                      <p className="text-xs text-red-400 mb-2">{signInError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          setSignInPending(true);
                          setSignInError(null);
                          const { error } = await signInWithEmail(signInEmailInput, signInPasswordInput);
                          setSignInPending(false);
                          if (error) {
                            setSignInError(error);
                          } else {
                            setSigningIn(false);
                            setSignInEmailInput("");
                            setSignInPasswordInput("");
                            setPersonaMenuOpen(false);
                          }
                        }}
                        disabled={signInPending}
                        className="flex-1 py-1.5 text-xs bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 rounded transition-colors disabled:opacity-50"
                      >
                        {signInPending ? "Signing in…" : "Sign In"}
                      </button>
                      <button
                        onClick={() => { setSigningIn(false); setSignInError(null); }}
                        className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Persona list */}
                {allAvailablePersonas.length > 0 && (
                  <div className="max-h-48 overflow-y-auto">
                    <div className="px-3 py-2 border-b border-white/10">
                      <p className="text-xs text-white/50 uppercase tracking-wider">Switch Persona</p>
                    </div>
                    {allAvailablePersonas.map((persona) => {
                      const isConfirming = confirmDeletePersonaId === persona.id;
                      const isPending = personaActionPending === persona.id;
                      return (
                        <div
                          key={persona.id}
                          className={`group flex items-center gap-2 px-3 py-2 transition-colors ${
                            effectivePersonaId === persona.id ? "bg-white/5" : "hover:bg-white/5"
                          }`}
                        >
                          <button
                            onClick={() => {
                              setLocalPersonaId(persona.id);
                              onPersonaChange?.(persona.id);
                              setPersonaMenuOpen(false);
                              window.localStorage.setItem("currentPersonaId", persona.id);
                              window.dispatchEvent(new CustomEvent("persona-switched", { detail: { personaId: persona.id } }));
                            }}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                          >
                            {persona.isAgent ? (
                              <Bot className="w-4 h-4 text-amber-400 shrink-0" />
                            ) : (
                              <User className="w-4 h-4 text-cyan-400 shrink-0" />
                            )}
                            <div className="text-left min-w-0 flex-1">
                              <p className="text-sm text-white/90 truncate">{persona.displayName || "Persona"}</p>
                              <p className="text-xs text-white/50 truncate">{persona.fioHandle || "No handle"}</p>
                            </div>
                            {effectivePersonaId === persona.id && !isConfirming && (
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            )}
                          </button>

                          {/* Manage actions — revealed on hover */}
                          {!isConfirming && !isPending && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              {cartridgeSlug && (() => {
                                const isDefault = getCartridgeDefault(cartridgeSlug) === persona.id;
                                return (
                                  <button
                                    title={isDefault ? "Default for this cartridge" : "Set as default for this cartridge"}
                                    onClick={() => !isDefault && setCartridgeDefault(cartridgeSlug, persona.id)}
                                    className={`p-1 rounded transition-colors ${isDefault ? "text-indigo-400 cursor-default" : "hover:bg-white/10 text-white/30 hover:text-indigo-400"}`}
                                  >
                                    <Star className="w-3.5 h-3.5" />
                                  </button>
                                );
                              })()}
                              <button
                                title="Archive persona"
                                onClick={() => handleArchivePersona(persona.id, true)}
                                className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-amber-400 transition-colors"
                              >
                                <EyeOff className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Delete persona"
                                onClick={() => setConfirmDeletePersonaId(persona.id)}
                                className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          {isPending && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-white/30 shrink-0" />
                          )}
                          {isConfirming && (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] text-red-400">Delete?</span>
                              <button
                                onClick={() => handleDeletePersona(persona.id)}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 hover:bg-red-500/40 transition-colors"
                              >Yes</button>
                              <button
                                onClick={() => setConfirmDeletePersonaId(null)}
                                className="px-1.5 py-0.5 rounded text-[10px] text-white/40 hover:text-white/70 transition-colors"
                              >No</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Signed in but no personas yet — prompt to create */}
                {sessionEmail && allAvailablePersonas.length === 0 && (
                  <div className="px-3 py-3 border-b border-white/10">
                    <p className="text-xs text-white/40 mb-2">No personas yet. Create one to get started.</p>
                    <button
                      onClick={() => {
                        setPersonaMenuOpen(false);
                        onCreatePersona?.();
                        setPersonaSetupOpen(true);
                      }}
                      className="w-full py-1.5 text-xs bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 rounded transition-colors"
                    >
                      Create your first persona
                    </button>
                  </div>
                )}

                {activePersona && (
                  <div className="border-t border-white/10">
                    <button
                      onClick={() => {
                        setPersonaMenuOpen(false);
                        handleOpenPersonaEdit();
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="text-sm">Edit Persona</span>
                    </button>
                  </div>
                )}

                <div className="border-t border-white/10">
                  <button
                    onClick={() => {
                      setPersonaMenuOpen(false);
                      setQuickAddOpen(true);
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm">Quick Add Persona</span>
                  </button>
                </div>
                <div className="border-t border-white/10">
                  <button
                    onClick={() => {
                      setPersonaMenuOpen(false);
                      onCreatePersona?.();
                      setPersonaSetupOpen(true);
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2 text-purple-400 hover:bg-purple-500/10 transition-colors"
                  >
                    <Crown className="w-4 h-4" />
                    <span className="text-sm">Create with Wizard</span>
                  </button>
                </div>

                {/* Account actions — sign in or sign out */}
                <div className="border-t border-white/10">
                  {sessionEmail ? (
                    <button
                      onClick={() => {
                        setPersonaMenuOpen(false);
                        signOutSession();
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 text-red-400/80 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">Sign Out</span>
                    </button>
                  ) : (
                    !signingIn && (
                      <button
                        onClick={() => {
                          setSigningIn(true);
                          setSignInError(null);
                        }}
                        className="w-full px-3 py-2 flex items-center gap-2 text-white/50 hover:bg-white/5 hover:text-white/70 transition-colors"
                      >
                        <LogIn className="w-4 h-4" />
                        <span className="text-sm">Sign In</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Tooltip text="Copilot">
              <button
                onClick={() => {
                  setCopilotOpen(!copilotOpen);
                  onOpenCopilot?.();
                }}
                className={`wallet-icon-btn p-1.5 ${copilotOpen ? 'active' : ''}`}
                data-active={copilotOpen}
              >
                <Bot className="w-4 h-4" />
              </button>
            </Tooltip>
            {variant === "overlay" ? (
              <Tooltip text={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                <button
                  type="button"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  className="wallet-icon-btn p-1.5"
                  aria-label={isFullscreen ? "Exit fullscreen wallet drawer" : "Fullscreen wallet drawer"}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </Tooltip>
            ) : null}

            <Tooltip text="Close Wallet">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setPersonaMenuOpen(false);
                  setCopilotOpen(false);
                  setIsFullscreen(false);
                  setDismissed(true);
                  onClose();
                }}
                className="wallet-icon-btn p-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="wallet-tab-nav px-3 py-2 bg-black/20">
          <div className="flex w-full items-center justify-between gap-0">
            {TAB_CONFIG.map((tab) => (
              <div key={tab.key} className="flex flex-1 justify-center">
                <Tooltip text={tab.label}>
                  <button
                    onClick={() => setActiveTab(tab.key)}
                    className={`wallet-icon-btn py-2 ${activeTab === tab.key ? 'active' : ''}`}
                    data-active={activeTab === tab.key}
                  >
                    {tab.icon}
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>
        </div>

        {/* Copilot Panel (Qriptopian parity) */}
        {copilotOpen && (
          <div className="mx-3 mt-2 mb-0 flex flex-col animate-fade-in flex-shrink-0 h-[380px] overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10 rounded-t-xl flex-shrink-0">
              <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                  <button
                    onClick={() => setCopilotMode('chat')}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all ${
                      copilotMode === 'chat'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    Copilot
                  </button>
                  <button
                    onClick={() => setCopilotMode('avatar')}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all ${
                      copilotMode === 'avatar'
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    <User className="w-3 h-3" />
                    MoneyPenny
                  </button>
                </div>
              </div>
              <Tooltip text="Back">
                <button
                  onClick={() => setCopilotOpen(false)}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>

            {copilotMode === "chat" ? (
              <div ref={copilotAnchorRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {/* Ask Copilot - Chat Interface */}
              <section
                ref={askCopilotCardRef}
                className="relative rounded-xl backdrop-blur-xl bg-white/5 border border-white/10 p-3 h-[290px] flex flex-col"
                onMouseEnter={() => showCopilotQuickPrompts()}
                onMouseLeave={() => showCopilotQuickPrompts()}
              >
                <div className="text-xs uppercase tracking-wider text-white/60 mb-3">Ask Copilot</div>
                
                {/* Chat Messages Area */}
                <div ref={copilotChatScrollRef} className="mb-2 flex-1 min-h-0 overflow-y-auto space-y-3 pb-16">
                  {copilotMessages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'assistant' && (
                        <Bot className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                      )}
                      <p className={`text-sm leading-relaxed max-w-[85%] ${
                        msg.role === 'user' 
                          ? 'bg-white/10 text-white/90 px-3 py-2 rounded-lg rounded-br-sm' 
                          : 'text-white/80'
                      }`}>
                        {msg.content}
                      </p>
                      {msg.role === 'user' && (
                        <User className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                  ))}
                  {copilotLoading && (
                    <div className="flex gap-3">
                      <Bot className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div className="copilot-thinking-dots emerald">
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Prompts - floating row above prompt */}
                <div
                  className={`absolute left-3 right-3 bottom-14 overflow-x-auto no-scrollbar transition-all duration-250 ${
                    copilotQuickPromptsVisible
                      ? "opacity-100 translate-y-0 pointer-events-auto"
                      : "opacity-0 translate-y-2 pointer-events-none"
                  }`}
                  onMouseEnter={() => showCopilotQuickPrompts()}
                >
                  <div className="flex w-max min-w-full gap-2">
                    {[
                      "My balance",
                      "Show tasks",
                      "My rewards",
                      "My library",
                      "My reputation",
                      "How to earn Q¢",
                      "What can I buy?",
                      "Convert USDC",
                      "Retry settlement",
                    ].map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendPrompt(prompt)}
                        disabled={copilotLoading}
                        className="shrink-0 px-3 py-1.5 rounded-full bg-slate-900/80 border border-white/15 hover:bg-slate-900 hover:border-white/30 transition-all text-xs text-white/75 hover:text-white/95 disabled:opacity-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prompt Input fixed at bottom of card */}
                <div className="mt-auto flex gap-2 pt-1">
                  <input
                    type="text"
                    value={copilotPrompt}
                    onChange={(e) => setCopilotPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendPrompt();
                      }
                    }}
                    onFocus={() => showCopilotQuickPrompts()}
                    placeholder="Ask anything..."
                    disabled={copilotLoading}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/90 placeholder:text-white/40 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all disabled:opacity-50"
                  />
                  <Tooltip text="Send message">
                    <button 
                      onClick={() => handleSendPrompt()}
                      disabled={copilotLoading || !copilotPrompt.trim()}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 hover:border-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              </section>

              {/* Wide/copilot contextual tab content */}
              {activeTab === "wallet" && (
                <>
                  <section className="rounded-xl backdrop-blur-xl bg-slate-900/40 border border-white/10 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/60 mb-2">Quick Actions</div>
                    <div className="quick-actions-carousel">
                      <Tooltip text="Browse your content library">
                        <button
                          onClick={() => {
                            triadContext?.actions.refreshLibrary?.();
                            setActiveTab("library");
                          }}
                          className="quick-action-item"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Library</span>
                        </button>
                      </Tooltip>
                      <Tooltip text="Claim pending rewards">
                        <button onClick={() => setActiveTab("rewards")} className="quick-action-item">
                          <Gift className="w-3.5 h-3.5" />
                          <span>Rewards</span>
                        </button>
                      </Tooltip>
                      <Tooltip text="View available tasks">
                        <button onClick={() => setActiveTab("tasks")} className="quick-action-item">
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>Tasks</span>
                        </button>
                      </Tooltip>
                      <Tooltip text="Build your reputation">
                        <button onClick={() => setActiveTab("reputation")} className="quick-action-item">
                          <Trophy className="w-3.5 h-3.5" />
                          <span>Reputation</span>
                        </button>
                      </Tooltip>
                    </div>
                  </section>

                  <section className="rounded-xl backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/5 border border-purple-500/20 p-4">
                    <div className="text-xs uppercase tracking-wider text-white/70 mb-3">Your Q¢ Balance</div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-bold text-white/95">
                          {bals.qctArb ? (Number(bals.qctArb) / Math.pow(10, bals.qctArbDecimals || 18)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0"}
                        </div>
                        <div className="text-sm text-white/60 mt-1">Q¢ on Arbitrum</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white/60">Ready for payments</div>
                        <div className="text-xs text-emerald-400 flex items-center justify-end gap-1 mt-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          Live
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 border border-purple-500/20 p-4">
                    <div className="text-xs uppercase tracking-wider text-white/70 mb-3">Smart Triad</div>
                    <div className="space-y-2">
                      <Tooltip text="Purchase selected content with Q¢">
                        <button
                          className="w-full p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-500/30 transition-all text-left flex items-center gap-3 disabled:opacity-50"
                          onClick={async () => {
                            if (currentContent && triadContext) {
                              await triadContext.actions.purchaseContent(currentContent.id, "arb");
                            }
                          }}
                          disabled={!currentContent}
                        >
                          <CreditCard className="w-5 h-5 text-purple-400" />
                          <div>
                            <div className="text-sm text-white/90">Purchase Content</div>
                            <div className="text-xs text-white/60">Pay with Q¢ on Arbitrum</div>
                          </div>
                        </button>
                      </Tooltip>
                      <Tooltip text="Refresh library from QubeBase">
                        <button
                          className="w-full p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-500/30 transition-all text-left flex items-center gap-3"
                          onClick={() => {
                            triadContext?.actions.refreshLibrary?.();
                            setActiveTab("library");
                          }}
                        >
                          <RefreshCw className="w-5 h-5 text-purple-400" />
                          <div>
                            <div className="text-sm text-white/90">Sync Library</div>
                            <div className="text-xs text-white/60">Refresh from QubeBase</div>
                          </div>
                        </button>
                      </Tooltip>
                    </div>
                  </section>
                </>
              )}

              {activeTab === "library" && (
                <section className="rounded-xl backdrop-blur-xl bg-slate-900/40 border border-white/10 p-4">
                  <div className="text-xs uppercase tracking-wider text-white/70 mb-2">Library Context</div>
                  <div className="text-sm text-white/80">
                    {walletNode?.contentEntitlements?.length || 0} item(s) available. Use the Library tab below to browse covers and open entitlements.
                  </div>
                </section>
              )}

              {activeTab === "tasks" && (
                <section className="rounded-xl backdrop-blur-xl bg-slate-900/40 border border-white/10 p-4">
                  <div className="text-xs uppercase tracking-wider text-white/70 mb-2">Task Context</div>
                  <div className="text-sm text-white/80">
                    {tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length} active tasks and {quests.length} active quest(s).
                  </div>
                </section>
              )}

              {activeTab === "reputation" && (
                <section className="rounded-xl backdrop-blur-xl bg-slate-900/40 border border-white/10 p-4">
                  <div className="text-xs uppercase tracking-wider text-white/70 mb-2">Reputation Context</div>
                  <div className="text-sm text-white/80">
                    Score {activePersona?.reputationScore || 0} with {(activePersona?.badges || []).length} badge(s) earned.
                  </div>
                </section>
              )}

              {activeTab === "rewards" && (
                <section className="rounded-xl backdrop-blur-xl bg-slate-900/40 border border-white/10 p-4">
                  <div className="text-xs uppercase tracking-wider text-white/70 mb-2">Rewards Context</div>
                  <div className="text-sm text-white/80">
                    Lifetime rewards are surfaced in the Rewards tab. Use this copilot to claim pending rewards and review history.
                  </div>
                </section>
              )}

              {activeTab === "payments" && (
                <section className="rounded-xl backdrop-blur-xl bg-slate-900/40 border border-white/10 p-4">
                  <div className="text-xs uppercase tracking-wider text-white/70 mb-2">Payments Context</div>
                  <div className="text-sm text-white/80">
                    Payment flow is active. Use this copilot for conversion, settlement retries, and purchase assistance.
                  </div>
                </section>
              )}

              {activeTab === "iqube" && (
                <section className="rounded-xl backdrop-blur-xl bg-slate-900/40 border border-white/10 p-4">
                  <div className="text-xs uppercase tracking-wider text-white/70 mb-2">PersonaQube</div>
                  <div className="text-sm text-white/80">
                    Stage your persona as a content-addressed PersonaQube on Autonomys — enables cryptographic binding to SkillQubes and cross-platform portability.
                  </div>
                </section>
              )}
            </div>
            ) : (
              <section
                ref={avatarAnchorRef}
                className="mx-3 mt-3 mb-3 rounded-xl bg-white/5 border border-white/10 p-4 h-[290px] flex-1 min-h-0 flex flex-col items-center justify-center"
              >
                <div className="text-xs uppercase tracking-wider text-white/60 mb-3">Ask MoneyPenny</div>
                <p className="text-sm text-white/40 text-center mb-4">
                  MoneyPenny is ready to help with your wallet, rewards, and Q¢ questions.
                </p>
                <button
                  onClick={refreshAvatar}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh Avatar
                </button>
              </section>
            )}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {/* Wallet Tab */}
          {activeTab === "wallet" && (
            <div className="space-y-4">
              {!hasAnyPersona && (
                <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="text-sm text-white/80 mb-2">Create your first persona to unlock wallet features.</div>
                  <button
                    onClick={() => setPersonaSetupOpen(true)}
                    className="w-full px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30 text-white text-sm"
                  >
                    Create Persona
                  </button>
                </section>
              )}
              {effectivePersonaId && (
                <section className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 ring-1 ring-amber-500/30 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-amber-300">
                        {knytLoading
                          ? "Loading..."
                          : `${knytTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} `}
                        <span className="text-amber-400 text-lg">KNYT</span>
                      </div>
                      <div className="text-xs text-white/50 mt-0.5">≈ ${knytUsd} USD</div>
                    </div>
                    <button
                      onClick={() => setBuyKnytModalOpen(true)}
                      className="px-2 py-1 text-[10px] bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/30"
                    >
                      Buy
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10">
                    <button
                      onClick={() => openTransactionModal("send")}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </button>
                    <button
                      onClick={() => openTransactionModal("receive")}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium transition-colors"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      Receive
                    </button>
                    <button
                      onClick={() => openTransactionModal("verify")}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/10 ring-1 ring-purple-500/20 hover:bg-purple-500/20 text-purple-300 text-xs font-medium transition-colors"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      Verify
                    </button>
                  </div>
                </section>
              )}

              <PaymentRequestsPanel
                agentId={agent.id}
                fioHandle={agent.fioHandle}
                walletAddress={walletAddress}
                onPaymentExecuted={(txHash, requestId) => {
                  handlePaymentExecuted(txHash, requestId);
                  refreshWalletBalances();
                }}
              />

              {effectivePersonaId && (
                <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] uppercase tracking-wider text-white/60">
                      KNYT + USDC
                    </div>
                    {knytLoading ? (
                      <div className="text-[10px] text-amber-400 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Loading
                      </div>
                    ) : (
                      <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Live
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5 text-sm text-white/90">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <span className="flex items-center gap-2 text-xs">
                        <Award className="w-4 h-4 text-amber-400" />
                        <span className="text-amber-300">KNYT (DVN)</span>
                        <span className="text-[9px] text-emerald-400 bg-emerald-500/20 px-1 rounded">Spendable</span>
                      </span>
                      <span className="font-mono text-xs text-amber-300">
                        {knytBalance?.dvnKnyt?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <span className="flex items-center gap-2 text-xs">
                        <Award className="w-4 h-4 text-amber-400/60" />
                        <span className="text-amber-300/60">KNYT (EVM)</span>
                        <span className="text-[9px] text-white/40 bg-white/10 px-1 rounded">On-chain</span>
                      </span>
                      <span className="font-mono text-xs text-amber-300/60">
                        {knytBalance?.evmKnyt?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                      <span className="flex items-center gap-2 text-xs">
                        <CircleDollarSign className="w-4 h-4 text-green-400" />
                        <span className="text-green-300">USDC</span>
                      </span>
                      <span className="font-mono text-xs text-green-300">
                        {formatUSDC(bals.usdcSep, bals.usdcSepDecimals)}
                      </span>
                    </div>
                  </div>
                </section>
              )}
              {/* Balances - reference chains and token balances */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60">
                    <Coins className="w-3.5 h-3.5 text-purple-400" />
                    Balances
                  </div>
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live
                  </div>
                </div>
                
                <ul className="space-y-1.5 text-sm text-white/90">
                  {showQcBreakdown &&
                    qcentBalanceRows.map((row) =>
                      row.dvn ? (
                        <li key={row.key} className="flex items-center justify-between p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                          <span className="flex items-center gap-2 text-xs">
                            {row.fallbackIcon}
                            <span className="text-cyan-300">{row.label}</span>
                            <span className="text-[9px] text-cyan-400 bg-cyan-500/20 px-1 rounded">Deferred</span>
                          </span>
                          <span className="font-mono text-xs text-cyan-300">
                            {row.value}
                          </span>
                        </li>
                      ) : (
                        <li key={row.key} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                          <span className="flex items-center gap-2">
                            {row.logo && !logoLoadErrors[row.key] ? (
                              <img
                                src={row.logo}
                                alt={`${row.label} logo`}
                                className="w-4 h-4 rounded-full object-cover"
                                onError={() => {
                                  setLogoLoadErrors((prev) => ({ ...prev, [row.key]: true }));
                                }}
                              />
                            ) : (
                              row.fallbackIcon
                            )}
                            <span>{row.label}</span>
                          </span>
                          <span className="font-mono text-white">
                            {row.value} {row.unit}
                          </span>
                        </li>
                      )
                    )}

                  {/* Total Q¢ (always visible, controls collapse/expand) */}
                  <li className="pt-2 mt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setShowQcBreakdown((prev) => !prev)}
                      className="w-full flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                      aria-label={showQcBreakdown ? "Hide Q¢ chain balances" : "Show Q¢ chain balances"}
                      aria-expanded={showQcBreakdown}
                    >
                      <span className="flex items-center gap-2 text-white/80 font-medium">
                        <Wallet className="w-4 h-4 text-purple-400" />
                        Total Q¢
                      </span>
                      <span className="flex items-center gap-2 font-mono text-white font-bold">
                        {qctTotalStr}
                        {showQcBreakdown ? (
                          <ChevronDown className="w-4 h-4 text-white/70" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-white/70" />
                        )}
                      </span>
                    </button>
                    {/* EVM vs DVN breakdown (always shown under total) */}
                    <div className="mt-1 grid grid-cols-2 gap-1.5 px-1">
                      <div className="flex items-center justify-between p-1.5 rounded bg-white/5 border border-white/5">
                        <span className="text-[10px] text-white/50 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                          EVM
                        </span>
                        <span className="text-[10px] font-mono text-white/70">
                          {qctEvmTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                        <span className="text-[10px] text-cyan-300 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                          DVN
                        </span>
                        <span className="text-[10px] font-mono text-cyan-300">
                          {qctDvnTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </li>

                  {nonQcentBalanceRows.length > 0 && (
                    <li className="pt-2 pb-0.5">
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-amber-400/80 mb-1">
                        <span className="h-px flex-1 bg-amber-500/20" />
                        $KNYT · Cartridge Economy
                        <span className="h-px flex-1 bg-amber-500/20" />
                      </div>
                      <div className="text-[9px] text-amber-300/50 text-center">
                        KNYT cartridge-local · distinct from Q¢
                      </div>
                    </li>
                  )}
                  {nonQcentBalanceRows.map((row) => (
                    <li key={row.key} className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <span className="flex items-center gap-2">
                        {row.logo && !logoLoadErrors[row.key] ? (
                          <img
                            src={row.logo}
                            alt={`${row.label} logo`}
                            className="w-4 h-4 rounded-full object-cover"
                            onError={() => {
                              setLogoLoadErrors((prev) => ({ ...prev, [row.key]: true }));
                            }}
                          />
                        ) : (
                          row.fallbackIcon
                        )}
                        <span className="text-amber-200/80">{row.label}</span>
                      </span>
                      <span className="font-mono text-amber-300">
                        {row.value} {row.unit}
                      </span>
                    </li>
                  ))}
                </ul>
                
                {/* Wallet Address */}
                <div className="mt-3 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">Wallet</span>
                    <span className="font-mono text-white/50 truncate max-w-[180px]">
                      {agent.evmArb || agent.evmSepolia || 'Not connected'}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60 mb-2">
                  <CircleDollarSign className="w-3.5 h-3.5 text-green-400" />
                  Convert USDC → Q¢
                </div>
                <div className="text-[10px] text-white/50 mb-2">1 USDC = 99 Q¢ (1% fee)</div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={convertUsdcAmount}
                    onChange={(e) => setConvertUsdcAmount(e.target.value)}
                    placeholder="USDC"
                    className="col-span-2 px-3 py-2 rounded-lg bg-black/30 ring-1 ring-white/10 text-white text-sm placeholder:text-white/30"
                    inputMode="decimal"
                  />
                  <button
                    onClick={handleConvertUsdcToQc}
                    disabled={convertStep === "processing"}
                    className="px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs font-medium disabled:opacity-60"
                  >
                    {convertStep === "processing" ? "Converting" : "Convert"}
                  </button>
                </div>
                {convertStep === "success" && convertResult?.quote && (
                  <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30 text-xs text-emerald-200">
                    Credited {convertResult.quote.qctNet} Q¢ (fee {convertResult.quote.feeQct} Q¢)
                  </div>
                )}
                {convertStep === "error" && convertError && (
                  <div className="mt-2 p-2 rounded-lg bg-red-500/10 ring-1 ring-red-500/30 text-xs text-red-200">
                    {convertError}
                  </div>
                )}
              </section>

              {walletNode?.balances?.pendingRewards != null && walletNode.balances.pendingRewards > 0 && (
                <section className="rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-300 flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5" />
                      Pending Rewards
                    </span>
                    <span className="font-mono text-sm text-amber-300">
                      +{walletNode.balances.pendingRewards} Q¢
                    </span>
                  </div>
                </section>
              )}
              
              {/* Demo/Persona Balances (if available) */}
              {walletNode?.balances && (walletNode.balances as any).QCT && (
                <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60 mb-2">
                    <User className="w-3.5 h-3.5 text-purple-400" />
                    Persona Wallet
                  </div>
                  <ul className="space-y-1 text-sm text-white/90">
                    <li className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-purple-400" />
                        QCT
                      </span>
                      <span className="font-mono text-white">
                        {(walletNode.balances as any).QCT?.available?.toLocaleString() || '0'}
                      </span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <CircleDollarSign className="w-4 h-4 text-green-400" />
                        USDC
                      </span>
                      <span className="font-mono text-white">
                        {(walletNode.balances as any).USDC?.available?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                      </span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-cyan-400" />
                        KNYT
                      </span>
                      <span className="font-mono text-white">
                        {(walletNode.balances as any).KNYT?.available?.toLocaleString() || '0'}
                      </span>
                    </li>
                  </ul>
                </section>
              )}
              

              {/* DVN Events */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-white/60 mb-2">
                  <span className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    Recent DVN Events
                  </span>
                  <button
                    onClick={() => setDvnExpanded((prev) => !prev)}
                    className="text-[10px] text-white/50 hover:text-white/70"
                  >
                    {dvnExpanded ? "Compact" : "Expanded"}
                  </button>
                </div>
                {dvnExpanded ? (
                  <div className="space-y-2">
                    {evs.slice(0, 3).map((e, i) => {
                      const statusColor = e.event === "PaymentConfirmed" ? "text-emerald-300" : e.event === "PaymentFailed" ? "text-red-300" : "text-amber-300";
                      const StatusIcon = e.event === "PaymentConfirmed" ? Check : e.event === "PaymentFailed" ? X : Clock;
                      return (
                        <div key={i} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-white/90">
                              <StatusIcon className={`w-3.5 h-3.5 ${statusColor}`} />
                              <span className={statusColor}>{e.event}</span>
                            </span>
                            <span className="text-white/50">{e.chain}</span>
                          </div>
                          <div className="text-[11px] text-white/40">{e.amount}</div>
                        </div>
                      );
                    })}
                    {evs.length === 0 && <div className="text-xs text-white/50">No events yet.</div>}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {evs.slice(0, 2).map((e, i) => (
                      <div key={i} className="flex justify-between text-[11px] p-1 bg-white/5 rounded">
                        <span className={e.event === "PaymentConfirmed" ? "text-emerald-300" : "text-amber-300"}>{e.event}</span>
                        <span className="text-white/40">{e.chain}</span>
                      </div>
                    ))}
                    {evs.length === 0 && <div className="text-[11px] text-white/40">No events</div>}
                  </div>
                )}
              </section>

              {/* Identity */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60 mb-2">
                  <BadgeCheck className="w-3.5 h-3.5 text-purple-400" />
                  Identity
                </div>
                <div className="flex items-center gap-2 mb-2 text-[11px]">
                  <Tooltip text="Assets in custody">
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-white/80 ring-1 ring-purple-500/20">
                      <Wallet className="w-3 h-3" />
                      Custody: {custodyCount}
                    </span>
                  </Tooltip>
                  <Tooltip text="Verified claims">
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20">
                      <Award className="w-3 h-3" />
                      Claims: {claimCount}
                    </span>
                  </Tooltip>
                  <Tooltip text="Active FIO handle">
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-500/20">
                      <IdCard className="w-3 h-3" />
                      <span className="max-w-[120px] truncate">{activePersona?.fioHandle || agent.fioHandle || "No handle"}</span>
                    </span>
                  </Tooltip>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-white/60">
                  <span className="uppercase tracking-wider">x402 Wallet ID</span>
                  <div className="flex items-center gap-1">
                    <span
                      className="font-mono text-[10px] text-white/60 truncate max-w-[140px]"
                      title={fioDid || undefined}
                    >
                      {fioDid ? `${fioDid.slice(0, 12)}...${fioDid.slice(-8)}` : "—"}
                    </span>
                    <button
                      onClick={() => fioDid && navigator.clipboard.writeText(fioDid)}
                      className="p-1 hover:bg-white/10 rounded"
                      disabled={!fioDid}
                      aria-label="Copy x402 Wallet ID"
                    >
                      <Copy className="w-3 h-3 text-white/50 hover:text-white" />
                    </button>
                  </div>
                </div>
                {activePersona && (
                  <button
                    onClick={handleOpenPersonaEdit}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10"
                  >
                    <Settings className="h-3 w-3 text-purple-300" />
                    Edit persona
                  </button>
                )}
                <div className="mt-3">
                  <AliasConsentToggle consented={aliasConsent} onChange={setAliasConsent} />
                </div>

                {/* Root DID sub-record */}
                {sessionEmail && (
                  <div className="mt-3 rounded-xl bg-white/[0.03] ring-1 ring-white/10">
                    <button
                      onClick={() => setRootDidExpanded((v) => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-white/60 hover:text-white/80"
                    >
                      <span className="flex items-center gap-1.5">
                        <BadgeCheck className="w-3.5 h-3.5 text-fuchsia-400" />
                        <span className="uppercase tracking-wider">Root DID</span>
                        {identityProfile?.rootDid && (
                          <span className="px-1 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">bound</span>
                        )}
                        {identityProfile && !identityProfile.rootDid && (
                          <span className="px-1 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">unbound</span>
                        )}
                      </span>
                      {rootDidExpanded
                        ? <ChevronDown className="w-3.5 h-3.5" />
                        : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    {rootDidExpanded && (
                      <div className="px-3 pb-3 space-y-2.5 text-[11px]">

                        {/* Root DID URI */}
                        <div>
                          <div className="text-white/40 mb-0.5">Root DID</div>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-fuchsia-300/80 truncate">
                              {identityProfile?.rootDid
                                ? identityProfile.rootDid.length > 28
                                  ? `${identityProfile.rootDid.slice(0, 20)}…${identityProfile.rootDid.slice(-8)}`
                                  : identityProfile.rootDid
                                : '—'}
                            </span>
                            {identityProfile?.rootDid && (
                              <button
                                onClick={() => navigator.clipboard.writeText(identityProfile.rootDid!)}
                                className="p-1 hover:bg-white/10 rounded shrink-0"
                                aria-label="Copy Root DID"
                              >
                                <Copy className="w-3 h-3 text-white/40 hover:text-white" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* KYC status */}
                        {identityProfile?.rootDid && (
                          <div className="flex items-center gap-2">
                            <span className="text-white/40">KYC</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ring-1 ${
                              identityProfile.kycStatus === 'verified'
                                ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
                                : 'bg-white/5 text-white/50 ring-white/10'
                            }`}>
                              {identityProfile.kycStatus}
                            </span>
                          </div>
                        )}

                        {/* EVM wallet address — live connected or stored on persona */}
                        {(externalEvmAddress || identityProfile?.storedEvmAddress) && (
                          <div>
                            <div className="text-white/40 mb-0.5 flex items-center gap-1">
                              EVM Wallet
                              {externalEvmAddress
                                ? <span className="text-[10px] text-emerald-400">● live</span>
                                : <span className="text-[10px] text-white/30">stored</span>}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-indigo-300/80 truncate text-[10px]">
                                {(externalEvmAddress || identityProfile?.storedEvmAddress!).slice(0, 10)}…
                                {(externalEvmAddress || identityProfile?.storedEvmAddress!).slice(-8)}
                              </span>
                              <button
                                onClick={() => navigator.clipboard.writeText(externalEvmAddress || identityProfile?.storedEvmAddress!)}
                                className="p-0.5 hover:bg-white/10 rounded shrink-0"
                                aria-label="Copy EVM address"
                              >
                                <Copy className="w-3 h-3 text-white/40 hover:text-white" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Persona clusters — canonical + any legacy linked clusters still holding personas */}
                        {identityProfile && (
                          <div>
                            <div className="text-white/40 mb-1">
                              Persona Cluster{identityProfile.personaClusters.length > 1 ? 's' : ''}
                              {' '}({identityProfile.personaCount} persona{identityProfile.personaCount !== 1 ? 's' : ''})
                            </div>
                            <div className="space-y-1">
                              {identityProfile.personaClusters.map((c, i) => (
                                <div key={i} className="flex items-center gap-1.5 rounded bg-white/[0.03] px-2 py-1">
                                  <Users className="w-3 h-3 text-white/30 shrink-0" />
                                  <span className="font-mono text-white/70 truncate flex-1">
                                    {c.clusterId.slice(0, 8)}…{c.clusterId.slice(-6)}
                                  </span>
                                  <span className="text-white/40 shrink-0">{c.personaCount}p</span>
                                  {c.isCanonical && (
                                    <span className="text-[10px] text-cyan-400 shrink-0">canonical</span>
                                  )}
                                  <button
                                    onClick={() => navigator.clipboard.writeText(c.clusterId)}
                                    className="p-0.5 hover:bg-white/10 rounded shrink-0"
                                    aria-label="Copy cluster ID"
                                  >
                                    <Copy className="w-3 h-3 text-white/40 hover:text-white" />
                                  </button>
                                </div>
                              ))}
                              {identityProfile.personaClusters.length === 0 && (
                                <div className="flex items-center gap-1.5 rounded bg-white/[0.03] px-2 py-1">
                                  <Users className="w-3 h-3 text-white/30 shrink-0" />
                                  <span className="font-mono text-white/70 truncate flex-1">
                                    {identityProfile.canonicalId.slice(0, 8)}…{identityProfile.canonicalId.slice(-6)}
                                  </span>
                                  <span className="text-white/40 shrink-0">{identityProfile.personaCount}p</span>
                                  <span className="text-[10px] text-cyan-400 shrink-0">canonical</span>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(identityProfile.canonicalId)}
                                    className="p-0.5 hover:bg-white/10 rounded shrink-0"
                                    aria-label="Copy cluster ID"
                                  >
                                    <Copy className="w-3 h-3 text-white/40 hover:text-white" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Email aliases */}
                        {identityProfile && identityProfile.emailAliases.length > 0 && (
                          <div>
                            <div className="text-white/40 mb-1">Email Aliases</div>
                            <div className="space-y-0.5">
                              {identityProfile.emailAliases.map((a, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <Mail className="w-3 h-3 text-white/30 shrink-0" />
                                  <span className="text-white/70 truncate">{a.email}</span>
                                  {a.is_primary && (
                                    <span className="text-[10px] text-cyan-400 shrink-0">primary</span>
                                  )}
                                  {a.is_verified && (
                                    <BadgeCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* All linked profiles with relationship mode */}
                        {identityProfile && identityProfile.linkedProfiles.length > 0 && (
                          <div>
                            <div className="text-white/40 mb-1">
                              Linked Profiles ({identityProfile.linkedProfiles.length})
                            </div>
                            <div className="space-y-0.5">
                              {identityProfile.linkedProfiles.map((l, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <Link className="w-3 h-3 text-white/30 shrink-0" />
                                  <span className="font-mono text-white/50 truncate flex-1">
                                    {l.linked_auth_profile_id.slice(0, 8)}…{l.linked_auth_profile_id.slice(-6)}
                                  </span>
                                  <span className={`text-[10px] shrink-0 ${
                                    l.relationship_mode === 'merged' ? 'text-emerald-400' :
                                    l.relationship_mode === 'device_session' ? 'text-amber-400' :
                                    'text-white/40'
                                  }`}>{l.relationship_mode}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bound DID personas */}
                        {identityProfile && identityProfile.didPersonas.length > 0 && (
                          <div>
                            <div className="text-white/40 mb-1">
                              DID-Bound Personas ({identityProfile.didPersonas.length})
                            </div>
                            <div className="space-y-0.5">
                              {identityProfile.didPersonas.map((p, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <IdCard className="w-3 h-3 text-white/30 shrink-0" />
                                  <span className="text-white/60 capitalize">{p.personaType}</span>
                                  {p.fioHandle && (
                                    <span className="text-cyan-300/70 truncate">{p.fioHandle}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {!identityProfile && (
                          <div className="text-white/30 italic">Loading…</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* x402 Settlement */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60 mb-2">
                  <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                  x402 Settlement
                </div>
                <div className="space-y-2">
                  <input
                    value={retrySettlementId}
                    onChange={(e) => setRetrySettlementId(e.target.value)}
                    placeholder="Settlement ID (optional)"
                    className="w-full px-2 py-1.5 text-sm rounded bg-black/40 ring-1 ring-white/10 text-white/90 placeholder:text-white/40"
                  />
                  <input
                    value={retryMessageId}
                    onChange={(e) => setRetryMessageId(e.target.value)}
                    placeholder="Message ID (optional)"
                    className="w-full px-2 py-1.5 text-sm rounded bg-black/40 ring-1 ring-white/10 text-white/90 placeholder:text-white/40"
                  />
                  <SettlementRetryButton settlementId={retrySettlementId || undefined} messageId={retryMessageId || undefined} />
                </div>
              </section>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === "payments" && (
            <div className="space-y-4">
              {currentContent ? (
                <PurchaseFlow
                  content={currentContent}
                  purchaseStep={purchaseStep}
                  contentPrice={contentPrice}
                  isFreeContent={isFreeContent}
                  selectedPaymentMethod={selectedPaymentMethod}
                  purchaseError={purchaseError}
                  onStartPurchase={handleStartPurchase}
                  onConfirmPurchase={handleConfirmPurchase}
                  onCancelPurchase={handleCancelPurchase}
                  onSelectPaymentMethod={setSelectedPaymentMethod}
                />
              ) : (
                <div className="text-center py-6 text-white/50 text-sm">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                  No content selected for payment.
                </div>
              )}

              <PaymentRequestsPanel
                agentId={agent.id}
                fioHandle={agent.fioHandle}
                walletAddress={walletAddress}
                onPaymentExecuted={(txHash, requestId) => {
                  handlePaymentExecuted(txHash, requestId);
                  refreshWalletBalances();
                }}
              />
            </div>
          )}

          {/* Library Tab */}
          {activeTab === "library" && (
            <div className="space-y-4">
              {selectedLibraryItem ? (
                <section className="rounded-xl bg-purple-500/10 ring-1 ring-purple-500/20 p-3">
                  <button onClick={() => setSelectedLibraryItem(null)} className="text-xs text-white/50 mb-3">← Back</button>
                  <div className="aspect-[3/4] w-32 mx-auto rounded-lg overflow-hidden bg-black/40 mb-2 relative">
                    {selectedLibraryItem.coverCid ? (
                      <img
                        src={`/api/content/cover/${selectedLibraryItem.coverCid}?variant=thumb`}
                        alt={selectedLibraryItem.contentTitle}
                        className="w-full h-full object-cover absolute inset-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full items-center justify-center ${selectedLibraryItem.coverCid ? "hidden" : "flex"}`}>
                      {isMotionContent(selectedLibraryItem) ? (
                        <Film className="w-12 h-12 text-purple-400/50" />
                      ) : (
                        <Book className="w-12 h-12 text-purple-400/50" />
                      )}
                    </div>
                    {getRarityIcon((selectedLibraryItem as any).coverType) && (
                      <Tooltip text={getRarityTooltip((selectedLibraryItem as any).coverType)}>
                        <img
                          src={getRarityIcon((selectedLibraryItem as any).coverType)!}
                          alt="rarity"
                          className="absolute bottom-1 left-1 w-6 h-6 object-contain drop-shadow-lg cursor-help"
                        />
                      </Tooltip>
                    )}
                    <Tooltip text={isMotionContent(selectedLibraryItem) ? "Motion Comic" : "Digital Still"}>
                      <div className="absolute top-1 right-1 p-1 rounded bg-black/50 cursor-help">
                        {isMotionContent(selectedLibraryItem) ? (
                          <Film className="w-3 h-3 text-cyan-400" />
                        ) : (
                          <Book className="w-3 h-3 text-amber-400" />
                        )}
                      </div>
                    </Tooltip>
                  </div>
                  <div className="text-center text-sm text-white">{selectedLibraryItem.contentTitle}</div>
                  {(selectedLibraryItem as any).coverType && (
                    <div className="text-center text-[10px] text-amber-400 mt-1">{(selectedLibraryItem as any).coverType} Edition</div>
                  )}
                </section>
              ) : walletNode?.contentEntitlements && walletNode.contentEntitlements.length > 0 ? (
                <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-white/60 mb-2">
                    Your Library ({walletNode.contentEntitlements.length})
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {walletNode.contentEntitlements.map((ent: any) => (
                      <div key={ent.id} onClick={() => setSelectedLibraryItem(ent)} className="cursor-pointer group">
                        <div className="aspect-[3/4] rounded-lg overflow-hidden bg-purple-500/10 ring-1 ring-white/10 group-hover:ring-purple-500/50 relative">
                          {ent.coverCid ? (
                            <img
                              src={`/api/content/cover/${ent.coverCid}?variant=thumb`}
                              alt={ent.contentTitle || "Library item"}
                              className="w-full h-full object-cover absolute inset-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full items-center justify-center ${ent.coverCid ? "hidden" : "flex"}`}>
                            {isMotionContent(ent) ? (
                              <Film className="w-8 h-8 text-purple-400/50" />
                            ) : (
                              <Book className="w-8 h-8 text-purple-400/50" />
                            )}
                          </div>
                          {getRarityIcon((ent as any).coverType) && (
                            <Tooltip text={getRarityTooltip((ent as any).coverType)}>
                              <img
                                src={getRarityIcon((ent as any).coverType)!}
                                alt="rarity"
                                className="absolute bottom-0.5 left-0.5 w-5 h-5 object-contain drop-shadow-lg cursor-help"
                              />
                            </Tooltip>
                          )}
                          <Tooltip text={isMotionContent(ent) ? "Motion Comic" : "Digital Still"}>
                            <div className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/50 cursor-help">
                              {isMotionContent(ent) ? (
                                <Film className="w-2.5 h-2.5 text-cyan-400" />
                              ) : (
                                <Book className="w-2.5 h-2.5 text-amber-400" />
                              )}
                            </div>
                          </Tooltip>
                        </div>
                        <div className="text-[10px] text-white/70 truncate mt-1">{ent.contentTitle || ent.id}</div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : effectivePersonaId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectivePersonaId) ? (
                // Only use LibraryShelf for valid UUID personaIds
                <LibraryShelf personaId={effectivePersonaId} onContentSelect={onContentSelect} variant="drawer" />
              ) : (
                <div className="text-center py-6 text-white/50 text-sm">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 text-purple-400/50" />
                  No content yet.
                </div>
              )}
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === "tasks" && (
            <div className="space-y-4">
              {/* Hero Tasks */}
              <section className="rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 ring-1 ring-cyan-500/20 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-medium text-cyan-300">Bring a Knight</span>
                  <span className="ml-auto text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">+2 KNYT</span>
                </div>
                <p className="text-[10px] text-white/50 mb-2">Invite friends to join. Earn 2 KNYT when they make their first purchase.</p>
                <button className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-cyan-500/20 text-cyan-300 text-xs hover:bg-cyan-500/30">
                  <Share2 className="w-3 h-3" />
                  Share Invite Link
                </button>
              </section>

              <section className="rounded-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 ring-1 ring-purple-500/20 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-medium text-purple-300">Knight of Attention</span>
                  <span className="ml-auto text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">+0.5 KNYT</span>
                </div>
                <p className="text-[10px] text-white/50 mb-2">Complete episodes to earn rewards. Build streaks for bonus KNYT.</p>
                <div className="flex items-center gap-2 text-[10px] text-white/40">
                  <span>Episodes: 0/2 this week</span>
                  <span className="text-white/20">|</span>
                  <span>Streak: 0 weeks</span>
                </div>
              </section>

              <section className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 ring-1 ring-amber-500/20 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-amber-300">Herald of the Order</span>
                  <span className="ml-auto text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">+0.25 KNYT</span>
                </div>
                <p className="text-[10px] text-white/50 mb-2">Share content and earn when others click, sign up, or purchase.</p>
                <div className="flex items-center gap-2 text-[10px] text-white/40">
                  <span>Clicks: 0/10</span>
                  <span className="text-white/20">|</span>
                  <span>Signups: 0/3</span>
                </div>
              </section>

              {/* Living Canon — 21 Sats Participation */}
              <section className="rounded-xl bg-gradient-to-br from-violet-500/10 to-amber-500/10 ring-1 ring-violet-500/20 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-amber-200">Living Canon — 21 Sats</span>
                </div>
                <p className="text-[10px] text-white/50 mb-2.5">
                  Participate in the canon. Vote on elections, submit contributions, or file dispatches as a Correspondent.
                </p>
                <div className="space-y-1.5">
                  {[
                    { label: "Vote on open elections", badge: "+21 KNYT", badgeClass: "text-amber-300 bg-amber-500/10" },
                    { label: "Submit community contribution", badge: "PoKW", badgeClass: "text-cyan-300 bg-cyan-500/10" },
                    { label: "File Correspondent dispatch", badge: "Featured", badgeClass: "text-violet-300 bg-violet-500/10" },
                  ].map(({ label, badge, badgeClass }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('knyt:navigate-tab', { detail: { tab: 'living-canon' } }));
                      }}
                      className="w-full flex items-center justify-between rounded-lg bg-white/5 hover:bg-white/10 transition px-2 py-1.5 text-left"
                    >
                      <span className="text-[11px] text-white/70">{label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${badgeClass}`}>{badge}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-white/30 mt-2">Opens the 21 Sats tab in the KNYT Codex.</p>
              </section>

              {/* Active Tasks */}
              <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-white/60 mb-2">Active Tasks</div>
                <div className="space-y-2">
                  {tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length === 0 && (
                    <div className="text-xs text-white/50">No active tasks</div>
                  )}
                  {tasks
                    .filter((t) => t.status === "pending" || t.status === "in_progress")
                    .map((task: any) => (
                      <div key={task.id} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm text-white/90">{task.title || task.label}</div>
                            <div className="text-xs text-white/50 mt-0.5">{task.description}</div>
                          </div>
                          <Tooltip text={`Task type: ${task.type}`}>
                            <span
                              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                                task.type === "reward"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : task.type === "quest"
                                  ? "bg-purple-500/20 text-purple-300"
                                  : task.type === "social"
                                  ? "bg-blue-500/20 text-blue-300"
                                  : "bg-slate-500/20 text-white/70"
                              }`}
                            >
                              {task.type === "reward" && <Gift className="w-3 h-3" />}
                              {task.type === "quest" && <Target className="w-3 h-3" />}
                              {task.type === "social" && <Users className="w-3 h-3" />}
                              {!["reward", "quest", "social"].includes(task.type) && <CheckSquare className="w-3 h-3" />}
                              {task.type}
                            </span>
                          </Tooltip>
                        </div>
                        {(task.rewardPreview || task.reward) && (
                          <div className="mt-2 text-xs text-amber-300 flex items-center gap-1">
                            <Coins className="w-3 h-3" />
                            +{task.rewardPreview?.amount || task.reward?.amount} {task.rewardPreview?.asset || task.reward?.currency}
                          </div>
                        )}
                        <div className="mt-2 flex gap-1">
                          <Tooltip text="Mark task as complete">
                            <button
                              onClick={() => onTaskAction?.(task, "complete")}
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-xs hover:bg-emerald-500/30"
                            >
                              <Check className="w-3 h-3" />
                              Complete
                            </button>
                          </Tooltip>
                          <Tooltip text="Dismiss this task">
                            <button
                              onClick={() => onTaskAction?.(task, "dismiss")}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-white/50 text-xs hover:bg-white/10"
                            >
                              <X className="w-3 h-3" />
                              Dismiss
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                </div>
              </section>

              {/* Quest Progress */}
              {quests.length > 0 && (
                <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-white/60 mb-2">Quest Progress</div>
                  <div className="space-y-2">
                    {quests.map((quest) => (
                      <div key={quest.questId} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2">
                        <div className="flex items-center gap-2 text-sm text-white/90">
                          <Flame className="w-4 h-4 text-orange-400" />
                          {quest.questTitle || quest.questId}
                        </div>
                        <div className="mt-2 h-1.5 bg-black/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500"
                            style={{ width: `${(quest.currentStep / quest.totalSteps) * 100}%` }}
                          />
                        </div>
                        <div className="mt-1 text-xs text-white/50">
                          Step {quest.currentStep} of {quest.totalSteps}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Reputation Tab */}
          {activeTab === "reputation" && (
            <div className="space-y-4">
              {/* Reputation Score */}
              <section className="rounded-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 ring-1 ring-purple-500/20 p-4">
                <div className="text-center">
                  <div className="flex justify-center gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={`w-5 h-5 ${
                          i < (walletNode?.personaContext?.activePersona?.reputationBucket || 0)
                            ? "text-amber-400 fill-amber-400"
                            : "text-slate-600"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {walletNode?.personaContext?.activePersona?.reputationScore || 0}
                  </div>
                  <div className="text-xs text-white/50">Reputation Score</div>
                </div>
              </section>

              {/* Reputation Breakdown */}
              {/* Badges */}
              <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Badges</div>
                {walletNode?.personaContext?.activePersona?.badges?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {walletNode.personaContext.activePersona.badges.map((badge: string, idx: number) => (
                      <span key={idx} className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-white/90 text-xs ring-1 ring-purple-500/30">
                        <Award className="w-3 h-3" />
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-white/40">No badges earned yet</div>
                )}
              </section>

              {/* Reputation Breakdown */}
              <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Score Breakdown</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-white/80">
                      <FileText className="w-4 h-4 text-purple-400" />
                      Content Created
                    </span>
                    <span className="text-white font-medium">+0</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-white/80">
                      <CheckSquare className="w-4 h-4 text-purple-400" />
                      Tasks Completed
                    </span>
                    <span className="text-white font-medium">+0</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-white/80">
                      <ThumbsUp className="w-4 h-4 text-purple-400" />
                      Community Votes
                    </span>
                    <span className="text-white font-medium">+0</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-white/80">
                      <BadgeCheck className="w-4 h-4 text-purple-400" />
                      Verified Claims
                    </span>
                    <span className="text-white font-medium">+0</span>
                  </div>
                </div>
              </section>

              {/* Submit Claim */}
              <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Submit Reputation Claim</div>
                <p className="text-xs text-white/50 mb-3">
                  Submit evidence of your contributions to earn reputation points.
                </p>
                <Tooltip text="Submit a new reputation claim">
                  <button 
                    onClick={onSubmitReputationClaim}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-white/90 text-sm font-medium ring-1 ring-purple-500/30 hover:bg-purple-500/30 transition-colors"
                  >
                    <Award className="w-4 h-4" />
                    Submit Claim
                  </button>
                </Tooltip>
              </section>
            </div>
          )}

          {/* Rewards Tab */}
          {activeTab === "rewards" && (
            <div className="space-y-4">
              <section className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 ring-1 ring-amber-500/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-amber-300/70 mb-2">KNYT Balance</div>
                <div className="text-2xl font-bold text-amber-300">
                  {knytBalance?.totalKnyt?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}{" "}
                  <span className="text-amber-400 text-lg">KNYT</span>
                </div>
                <div className="text-xs text-white/50 mt-1">≈ ${((knytBalance?.totalKnyt || 0) * knytPriceUsd).toFixed(2)} USD</div>
                <button
                  onClick={() => setBuyKnytModalOpen(true)}
                  className="mt-2 w-full px-3 py-1.5 text-xs bg-amber-500/20 text-amber-300 rounded-lg hover:bg-amber-500/30 transition-colors"
                >
                  Buy KNYT
                </button>
              </section>

              <section className="rounded-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 ring-1 ring-purple-500/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-purple-300/70">Order Tier</div>
                  <div className="flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-medium text-amber-300">
                      {walletNode?.personaContext?.activePersona?.orderTier || "Knight"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/50">Reward Multiplier</span>
                  <span className="text-sm font-bold text-emerald-300">
                    ×{rewards?.reputationMultiplier?.toFixed(2) || "1.00"}
                  </span>
                </div>
                <p className="text-[10px] text-white/40 mt-2">Higher tiers earn more KNYT per task.</p>
              </section>

              {/* Pending Rewards */}
              {(rewards as any)?.pendingRewards && (rewards as any).pendingRewards.length > 0 && (
                <section className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 ring-1 ring-amber-500/20 p-3">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-amber-300 mb-2">
                    <Clock className="w-3.5 h-3.5" />
                    Pending Rewards
                  </div>
                  <div className="space-y-2">
                    {(rewards as any).pendingRewards.map((reward: any, idx: number) => (
                      <div key={idx} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white/90">{reward.reason}</span>
                          <span className="flex items-center gap-1 text-sm font-medium text-amber-300">
                            <Coins className="w-3.5 h-3.5" />
                            +{reward.amount} {reward.tokenType || reward.asset}
                          </span>
                        </div>
                        <div className="text-xs text-white/50 mt-1">Status: {reward.status}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Recent KNYT Rewards */}
              <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60 mb-2">
                  <Star className="w-3.5 h-3.5 text-amber-400" />
                  Recent KNYT Rewards
                </div>
                {rewards && rewards.recentRewards.length > 0 ? (
                  <div className="space-y-2">
                    {rewards.recentRewards.map((reward: any, idx: number) => (
                      <div key={idx} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white/90">{reward.reason}</span>
                          <span className="flex items-center gap-1 text-sm font-medium text-emerald-300">
                            <Coins className="w-3.5 h-3.5" />
                            +{reward.amount} {reward.tokenType || reward.asset}
                          </span>
                        </div>
                        <div className="text-xs text-white/50 mt-1">
                          {reward.distributedAt ? new Date(reward.distributedAt).toLocaleDateString() : "Pending"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-white/5 ring-1 ring-white/10 p-3 text-xs text-white/50">
                    No rewards yet.
                  </div>
                )}
              </section>

              {/* Lifetime Stats */}
              {(rewards as any)?.lifetimeEarnings && (
                <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60 mb-2">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    Lifetime Rewards
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries((rewards as any).lifetimeEarnings).map(([asset, amount]) => (
                      <Tooltip key={asset} text={`Total ${asset} earned`}>
                        <div className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2 text-center">
                          <div className="text-lg font-semibold text-white">{String(amount)}</div>
                          <div className="text-[10px] text-white/50">{asset}</div>
                        </div>
                      </Tooltip>
                    ))}
                  </div>
                </section>
              )}

              {(!rewards || ((rewards.recentRewards?.length || 0) === 0 && !(rewards as any)?.pendingRewards?.length)) && (
                <div className="text-center py-8 text-white/50 text-sm">
                  <Gift className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                  No rewards yet. Complete tasks to earn rewards!
                </div>
              )}
            </div>
          )}

          {/* ── iQube tab ── */}
          {activeTab === "iqube" && (
            <div className="space-y-4">
              <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
                <div className="text-[10px] uppercase tracking-wider text-white/60 mb-3 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-violet-400" />
                  PersonaQube — On-Chain Identity
                </div>
                {/* Active persona identity summary */}
                {walletNode?.personaContext?.activePersona && (
                  <div className="space-y-1.5 mb-4">
                    {[
                      {
                        label: "FIO Handle",
                        value: walletNode.personaContext.activePersona.fioHandle || "—",
                        color: "text-cyan-300",
                      },
                      {
                        label: "Root DiD",
                        value: walletNode.personaContext.activePersona.fioHandle
                          ? `did:fio:${walletNode.personaContext.activePersona.fioHandle}`
                          : "—",
                        color: "text-violet-300",
                      },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                        <span className="text-xs text-white/50">{label}</span>
                        <span className={`text-xs font-mono truncate max-w-[180px] ${color}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Mint action */}
                {mintStatus === "staged" ? (
                  <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-violet-400" />
                      <span className="text-sm font-medium text-violet-300">PersonaQube staged</span>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Your persona data is encrypted and queued for the Autonomys write pipeline. The chain write completes asynchronously.
                    </p>
                    {mintStubId && (
                      <code className="text-[10px] text-white/30 font-mono block">stub: {mintStubId}</code>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-white/50 leading-relaxed">
                      Mint your persona as a <strong className="text-white/70">PersonaQube</strong> — content-addressed on Autonomys with your FIO key.
                      Enables cryptographic binding to SkillQubes and AigentQubes, and cross-platform portability without trusting this database.
                    </p>
                    <p className="text-[10px] text-white/30 leading-relaxed">
                      Your DVN receipts are already anchored to your Root DiD through the ordinal inscription pipeline — minting adds content-addressable persona data on Autonomys.
                    </p>
                    {mintStatus === "error" && (
                      <p className="text-xs text-red-400">{mintError}</p>
                    )}
                    <button
                      type="button"
                      onClick={handleStageMint}
                      disabled={mintStatus === "staging"}
                      className="w-full rounded-lg border border-violet-500/40 bg-violet-600/20 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-600/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {mintStatus === "staging" ? "Staging…" : "Stage PersonaQube"}
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ── Connections tab ── always mounted so wallet state survives tab switches */}
          <div className={activeTab === "connections" ? undefined : "hidden"}>
            <div className="space-y-4">
              <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
                <div className="text-[10px] uppercase tracking-wider text-white/60 mb-3 flex items-center gap-2">
                  <Link className="w-3.5 h-3.5 text-cyan-400" />
                  Identity Connections
                </div>
                <div className="space-y-2">
                  {[
                    { label: "DID / FIO Handle", value: walletNode?.personaContext?.activePersona?.fioHandle || "—", color: "text-cyan-300" },
                    {
                      label: "EVM Address",
                      value: (() => {
                        const addr = externalEvmAddress || walletNode?.personaContext?.activePersona?.evmAddress;
                        if (!addr) return "—";
                        const s = String(addr);
                        return `${s.slice(0, 6)}…${s.slice(-4)}`;
                      })(),
                      color: externalEvmAddress ? "text-emerald-300" : "text-indigo-300",
                    },
                    { label: "BTC Address", value: walletNode?.personaContext?.activePersona?.btcAddress ? `${String(walletNode.personaContext.activePersona.btcAddress).slice(0, 8)}…` : "—", color: "text-amber-300" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                      <span className="text-xs text-white/50">{label}</span>
                      <span className={`text-xs font-mono ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
                <div className="text-[10px] uppercase tracking-wider text-white/60 mb-3 flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 text-violet-400" />
                  External Wallet
                </div>
                <ExternalWalletConnect
                  personaId={effectivePersonaId}
                  onConnected={(addr) => setExternalEvmAddress(addr)}
                  onTxComplete={(txHash, amountKnyt) => {
                    console.info('[SmartWallet] EVM KNYT tx sent', { txHash, amountKnyt });
                  }}
                />
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Unlock Modal */}
      {showUnlockModal && personaToUnlock && (
        <UnlockModal
          isOpen={showUnlockModal}
          onClose={() => {
            setShowUnlockModal(false);
            setPersonaToUnlock(null);
          }}
          personaId={personaToUnlock}
          personaName={walletNode?.personaContext?.activePersona?.displayName || "Wallet"}
          onUnlockSuccess={() => {
            setIsWalletUnlocked(true);
            setShowUnlockModal(false);
            setPersonaToUnlock(null);
          }}
        />
      )}

      {transactionModalOpen && (
        <TransactionModal
          isOpen={transactionModalOpen}
          onClose={() => setTransactionModalOpen(false)}
          initialTab={transactionTab}
          walletAddress={walletAddress}
          personaId={effectivePersonaId}
          agentId={agent.id}
          fioHandle={agent.fioHandle}
          prefillRecipient={prefillRecipient}
          prefillAmount={prefillAmount}
          prefillTxHash={prefillTxHash}
          prefillChainId={prefillChainId}
          enableVerify={true}
          enableCustody={true}
          onTransactionComplete={(result) => {
            handleTransactionComplete(result);
            refreshWalletBalances();
          }}
          onRequestCreated={handleRequestCreated}
        />
      )}

      {personaEditModalOpen && editingPersona && (
        <PersonaEditModal
          isOpen={personaEditModalOpen}
          onClose={() => setPersonaEditModalOpen(false)}
          persona={{
            id: editingPersona.id,
            fioHandle: editingPersona.fioHandle,
            displayName: editingPersona.displayName,
            reputationScore: editingPersona.reputationScore,
          }}
          onSave={(updated) => {
            setEditingPersona({
              ...editingPersona,
              displayName: updated.displayName,
              fioHandle: updated.fioHandle,
            });
            setPersonaEditModalOpen(false);
          }}
        />
      )}

      {personaSetupOpen && (
        <PersonaSetupWizard
          tenantId={tenantId}
          onComplete={handlePersonaCreated}
          onCancel={() => setPersonaSetupOpen(false)}
        />
      )}

      {quickAddOpen && (
        <PersonaQuickAddModal
          isOpen={quickAddOpen}
          tenantId={tenantId}
          onClose={() => setQuickAddOpen(false)}
          onCreated={(newPersonaId) => {
            setLocalPersonaId(newPersonaId);
            onPersonaChange?.(newPersonaId);
            setQuickAddOpen(false);
            window.localStorage.setItem("currentPersonaId", newPersonaId);
            window.dispatchEvent(new CustomEvent("persona-switched", { detail: { personaId: newPersonaId } }));
            refreshPersonas();
          }}
          onAdvanced={() => {
            setQuickAddOpen(false);
            setPersonaSetupOpen(true);
          }}
        />
      )}

      {effectivePersonaId && (
        <BuyKnytModal
          open={buyKnytModalOpen}
          onClose={() => setBuyKnytModalOpen(false)}
          personaId={effectivePersonaId}
          onPurchaseComplete={() => refreshWalletBalances()}
        />
      )}
    </div>
  );
}
