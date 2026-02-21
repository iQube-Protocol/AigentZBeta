"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useBalances } from "@/app/hooks/useBalances";
import { useDVNEvents } from "@/app/hooks/useDVNEvents";
import { useKnytBalance } from "@/app/hooks/useKnytBalance";
import { useEthPrice } from "@/app/hooks/useEthPrice";
import { useMetaAvatar } from "@/app/contexts/MetaAvatarContext";
import AliasConsentToggle from "../identity/AliasConsentToggle";
import SettlementRetryButton from "../x402/SettlementRetryButton";
import LibraryShelf from "./LibraryShelf";
import SmartContentCard from "./SmartContentCard";
import PurchaseFlow, { type PurchaseStep, type PaymentMethod } from "./PurchaseFlow";
import type { SmartWalletNode, WalletTask, QuestProgress, RecentReward, PersonaState } from "@/types/smartWallet";
import type { SmartContentQube } from "@/types/smartContent";
import {
  BuyKnytModal,
  PaymentRequestsPanel,
  PersonaEditModal,
  PersonaSelector,
  PersonaQuickAddModal,
  PersonaSetupWizard,
  TransactionModal,
  UnlockModal,
} from "../wallet";
import type { TransactionTab, ChainId, TransactionResult, PaymentRequest } from "../wallet/TransactionModal";
import { useSmartTriad } from "./SmartTriadProvider";
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
  Flame,
  Crown,
  Copy,
} from "lucide-react";
const CodexCopilotLayer = dynamic(
  () => import("@/app/components/codex/CodexCopilotLayer").then((m) => m.CodexCopilotLayer),
  { ssr: false }
);
import type { CopilotMessage } from "@/app/components/codex/CodexCopilotLayer";


// Tooltip component for icon hints
const Tooltip = ({ children, text }: { children: React.ReactNode; text: string }) => (
  <div className="relative group">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-slate-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-white/10">
      {text}
    </div>
  </div>
);

type DrawerTab = "wallet" | "library" | "tasks" | "reputation" | "rewards";

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
  codexMode?: boolean;
  onTabChange?: (tab: DrawerTab) => void;
}

const TAB_CONFIG: Array<{ key: DrawerTab; label: string; icon: React.ReactNode }> = [
  { key: "wallet", label: "Wallet", icon: <Wallet className="w-4 h-4" /> },
  { key: "library", label: "Library", icon: <BookOpen className="w-4 h-4" /> },
  { key: "tasks", label: "Tasks", icon: <CheckSquare className="w-4 h-4" /> },
  { key: "reputation", label: "Reputation", icon: <Trophy className="w-4 h-4" /> },
  { key: "rewards", label: "Rewards", icon: <Gift className="w-4 h-4" /> },
];

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
  codexMode = false,
}: SmartWalletDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>(initialTab);
  const [localPersonaId, setLocalPersonaId] = useState<string | null>(null);
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0);
  const bals = useBalances(
    {
      sepolia: agent.evmSepolia,
      arb: agent.evmArb,
      base: agent.evmSepolia || agent.evmArb,
      btc: agent.btcAddress,
    },
    { refreshKey: balanceRefreshKey }
  );
  const activePersona =
    walletNode?.personaContext?.availablePersonas?.find(
      (persona) => persona.id === walletNode?.personaContext?.activePersonaId
    ) || walletNode?.personaContext?.activePersona || null;
  const effectivePersonaId =
    personaId || localPersonaId || walletNode?.personaContext?.activePersonaId || activePersona?.id;
  const { balance: knytBalance, loading: knytLoading, refreshBalance: refreshKnyt } =
    useKnytBalance(effectivePersonaId);
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
  const [codexCopilotMessages, setCodexCopilotMessages] = useState<CopilotMessage[]>([]);
  const [tenantId, setTenantId] = useState<string>(
    process.env.NEXT_PUBLIC_TENANT_ID ||
      process.env.NEXT_PUBLIC_LVB_BRIDGE_TENANT_ID ||
      "default"
  );

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    onTabChange?.(activeTab);
  }, [activeTab, onTabChange]);

  useEffect(() => {
    if (!codexMode) return;
    if (!currentContent) return;
    setCodexCopilotMessages((prev) => {
      if (prev.length > 0) return prev;
      return [
        {
          id: "codex-wallet-welcome",
          role: "assistant",
          content: `Wallet Copilot ready for ${currentContent.title}. Ask me to compare editions, open checkout, or verify access.`,
          timestamp: new Date(),
        },
      ];
    });
  }, [codexMode, currentContent]);

  useEffect(() => {
    if (!codexMode || !copilotOpen || !currentContent) return;
    setCodexCopilotMessages((prev) => [
      ...prev,
      {
        id: `codex-wallet-context-${currentContent.id}-${Date.now()}`,
        role: "assistant",
        content: `Selected content: ${currentContent.title}. Pricing rail: ${currentContent.pricingModel?.tiers?.[0]?.currency || "QCT"}.`,
        timestamp: new Date(),
      },
    ]);
  }, [codexMode, copilotOpen, currentContent?.id, currentContent?.title, currentContent?.pricingModel?.tiers]);
  
  // MetaAvatar context for persistent iframe
  const { requestAvatar, releaseAvatar, refreshAvatar } = useMetaAvatar();
  
  // Handle sending a prompt to the copilot
  const handleSendPrompt = async (prompt?: string) => {
    const messageToSend = prompt || copilotPrompt.trim();
    if (!messageToSend) return;
    
    // Add user message
    setCopilotMessages(prev => [...prev, { role: 'user', content: messageToSend }]);
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
      requestAvatar('copilot', agent?.id || 'aigent-z');
    } else {
      releaseAvatar('copilot');
    }
    
    // Cleanup on unmount
    return () => releaseAvatar('copilot');
  }, [open, copilotOpen, copilotMode, requestAvatar, releaseAvatar, agent?.id]);

  const [retrySettlementId, setRetrySettlementId] = useState("");
  const [retryMessageId, setRetryMessageId] = useState("");
  const [custodyCount, setCustodyCount] = useState(0);
  const [claimCount, setClaimCount] = useState(0);
  const [fioDid, setFioDid] = useState<string | null>(null);
  
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

  const handleOpenPersonaEdit = () => {
    if (!activePersona) return;
    setEditingPersona(activePersona);
    setPersonaEditModalOpen(true);
  };

  const handlePersonaCreated = (newPersonaId: string) => {
    setLocalPersonaId(newPersonaId);
    onPersonaChange?.(newPersonaId);
    setPersonaSetupOpen(false);
  };
  
  // Persona state
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [isWalletUnlocked, setIsWalletUnlocked] = useState(false);
  const [personaToUnlock, setPersonaToUnlock] = useState<string | null>(null);

  // Auto-start purchase flow when content changes and has a price
  useEffect(() => {
    if (currentContent && open) {
      const price = currentContent.pricingModel?.tiers?.[0];
      const isFree = !price || price.kind === "free" || price.amount === 0;
      if (!isFree) {
        setPurchaseStep("confirm");
      } else {
        setPurchaseStep("idle");
      }
    }
  }, [currentContent, open]);

  // Reset purchase state when drawer closes
  useEffect(() => {
    if (!open) {
      setPurchaseStep("idle");
      setPurchaseError(null);
    }
  }, [open]);

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

  const handleCodexCopilotPrompt = useCallback(
    (prompt: string) => {
      const localIntent = detectIntentAndSwitchTab(prompt);
      if (localIntent.tab) {
        setActiveTab(localIntent.tab);
      }

      const normalized = prompt.toLowerCase();
      if (
        currentContent &&
        (normalized.includes("checkout") || normalized.includes("purchase") || normalized.includes("buy"))
      ) {
        setActiveTab("wallet");
        setPurchaseStep("confirm");
        setPurchaseError(null);
      }

      if (localIntent.handled) {
        setCodexCopilotMessages((prev) => [
          ...prev,
          {
            id: `codex-wallet-intent-${Date.now()}`,
            role: "assistant",
            content: localIntent.response,
            timestamp: new Date(),
          },
        ]);
      }
    },
    [currentContent]
  );

  const qctTotalStr = (() => {
    try {
      const ethQ = Number(BigInt(bals.qctSep || "0")) / 10 ** (bals.qctSepDecimals ?? 0);
      const arbQ = Number(BigInt(bals.qctArb || "0")) / 10 ** (bals.qctArbDecimals ?? 0);
      const baseQ = Number(BigInt(bals.qctBase || "0")) / 10 ** (bals.qctBaseDecimals ?? 0);
      const btcQ = Number(BigInt(bals.btcQcent || "0"));
      const total = ethQ + arbQ + baseQ + btcQ;
      return total.toLocaleString(undefined, { maximumFractionDigits: 0 });
    } catch {
      return "0";
    }
  })();

  const knytTotal = knytBalance?.totalKnyt ?? 0;
  const knytUsd = knytPriceUsd ? (knytTotal * knytPriceUsd).toFixed(2) : "0.00";
  const walletAddress = walletNode?.walletAddresses?.evm || agent.evmArb || agent.evmSepolia;

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
    const CHAIN_CONFIG: Record<PaymentMethod, { chainId: number; asset: string; name: string; tokenAddress?: string; decimals: number }> = {
      arb: { chainId: 421614, asset: "QCT", name: "Arbitrum Sepolia", tokenAddress: QCT_TOKEN_ADDRESS, decimals: 18 },
      base: { chainId: 84532, asset: "QCT", name: "Base Sepolia", tokenAddress: QCT_TOKEN_ADDRESS, decimals: 18 },
      polygon: { chainId: 80002, asset: "QCT", name: "Polygon Amoy", tokenAddress: QCT_TOKEN_ADDRESS, decimals: 18 },
      optimism: { chainId: 11155420, asset: "QCT", name: "Optimism Sepolia", tokenAddress: QCT_TOKEN_ADDRESS, decimals: 18 },
      usdc: { chainId: 84532, asset: "USDC", name: "Base Sepolia (USDC)", tokenAddress: USDC_BASE_SEPOLIA, decimals: 6 },
      knyt: { chainId: 1, asset: "KNYT", name: "Ethereum Mainnet", decimals: 18 },
    };
    const chainConfig = CHAIN_CONFIG[selectedPaymentMethod];
    
    try {
      // Step 1: Execute payment via x402 rails using agent's wallet
      const paymentAmount = contentPrice?.amount || 0;
      const payTo = recipientAddress || currentContent.creatorRootDid; // Pay to content creator

      // Guard: don't let the UI send USDC for non-USDC priced tiers.
      const tierCurrency = (contentPrice?.currency || "").toUpperCase();
      if (selectedPaymentMethod === "usdc" && tierCurrency !== "USDC") {
        throw new Error(`This content is priced in ${contentPrice?.currency || "unknown"}. Select a Q¢ or KNYT rail, or choose a USDC-priced tier.`);
      }
      
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

  if (!open) return null;

  // Variant-based styling
  const getDrawerClasses = () => {
    if (variant === "embedded") {
      // For embedded mode, always use contained width
      const baseClasses = `h-full bg-slate-900 text-white border-l border-slate-800`;

      // Codex mode: expand to 28rem when wallet copilot opens, right-justified, contained
      if (codexMode) {
        const drawerWidth = copilotOpen ? "w-[28rem]" : "w-96";
        return `${baseClasses} ${drawerWidth} border-indigo-500/30 ml-auto`;
      }

      // Regular embedded mode
      if (embeddedWidth === "fill") {
        return `${baseClasses} w-full`;
      }
      return `${baseClasses} w-96 ml-auto`;
    }
    // Overlay mode
    // In codex mode, prevent expansion when copilot is open
    const drawerWidth = copilotOpen && !codexMode ? "w-[28rem]" : "w-[21.6rem]";
    const baseClasses = `fixed inset-y-0 right-0 ${drawerWidth} shadow-2xl bg-black/30 backdrop-blur-xl ring-1 ring-white/10 border-l border-white/10`;
    return codexMode ? `${baseClasses} ring-indigo-500/30 border-l-indigo-500/30` : baseClasses;
  };

  return (
    <div className={variant === "overlay" ? "fixed inset-0 z-50" : ""}>
      {variant === 'overlay' && (
        <div className="absolute inset-0 drawer-backdrop bg-black/60 backdrop-blur-sm" onClick={onClose} />
      )}
      <div className={`${getDrawerClasses()} overflow-hidden flex flex-col transition-all duration-300`}>
        {/* Header with Persona Selector, Copilot, and Close */}
        <header className="flex items-center gap-2 px-3 py-2 bg-white/5 ring-1 ring-white/10 flex-shrink-0">
          {/* Compact Persona Selector */}
          <div className="flex-1 min-w-0">
            <PersonaSelector
              personas={walletNode?.personaContext?.availablePersonas || []}
              activePersonaId={walletNode?.personaContext?.activePersonaId}
              onSelect={(id) => {
                setLocalPersonaId(id);
                onPersonaChange?.(id);
              }}
              onQuickAdd={() => setQuickAddOpen(true)}
              onEditActive={handleOpenPersonaEdit}
              onCreateNew={() => {
                onCreatePersona?.();
                setPersonaSetupOpen(true);
              }}
              isLoading={false}
              compact={true}
            />
          </div>
          
          {/* Copilot Button - color change for active, no background box */}
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
          
          {/* Close Button (X) - color change on hover - only show in overlay mode */}
          {variant === 'overlay' && (
            <Tooltip text="Close Wallet">
              <button
                onClick={onClose}
                className="wallet-icon-btn p-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
        </header>

        {/* Tab Navigation - Equidistant spacing */}
        <div className="wallet-tab-nav px-3 py-2 bg-black/20">
          {TAB_CONFIG.map((tab) => (
            <Tooltip key={tab.key} text={tab.label}>
              <button
                onClick={() => setActiveTab(tab.key)}
                className={`wallet-icon-btn py-2 ${activeTab === tab.key ? 'active' : ''}`}
                data-active={activeTab === tab.key}
              >
                {tab.icon}
              </button>
            </Tooltip>
          ))}
        </div>

        {/* Copilot Panel (slides over content when active) - Subtle styling */}
        {copilotOpen && codexMode ? (
          <div className="absolute inset-x-0 top-[88px] bottom-0 z-10 overflow-hidden">
            <style jsx global>{`
              .copilotkit-launcher,
              .copilotkit-button,
              .copilotkit-floating-button {
                display: none !important;
              }
            `}</style>
            <CodexCopilotLayer
              isOpen
              onClose={() => setCopilotOpen(false)}
              variant="embedded"
              panelClassName="w-full"
              showNavMenu={false}
              showWalletMenu={false}
              disableActivationButton
              className="h-full"
              personaId={effectivePersonaId}
              contextId={`wallet-${activeTab}`}
              messages={codexCopilotMessages}
              onMessagesChange={setCodexCopilotMessages}
              promptPlaceholder={
                currentContent
                  ? `Ask about ${currentContent.title}...`
                  : "Ask wallet copilot..."
              }
              quickPrompts={[
                { label: "Open checkout", prompt: "Open wallet checkout for selected content." },
                { label: "Show balances", prompt: "Show my wallet balances and available rails." },
                { label: "Rewards + tasks", prompt: "Show rewards and top earning tasks." },
              ]}
              onPrompt={handleCodexCopilotPrompt}
            />
          </div>
        ) : (
          <div className="absolute inset-x-0 top-[88px] bottom-0 bg-slate-950/90 backdrop-blur-2xl z-10 flex flex-col animate-fade-in">
            {/* Header - minimal purple accent */}
            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-400" />
                <span className="text-xs uppercase tracking-wider text-white/70">Copilot</span>
              </div>
              <button
                onClick={() => setCopilotOpen(false)}
                className="flex items-center gap-1 text-xs text-white/60 hover:text-white px-2 py-1 rounded-md hover:bg-white/5 transition-all"
              >
                <ArrowLeft className="w-3 h-3" />
                Back
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Ask Copilot - Chat Interface */}
              <section className="rounded-xl backdrop-blur-xl bg-white/5 border border-white/10 p-4">
                <div className="text-xs uppercase tracking-wider text-white/60 mb-3">Ask Copilot</div>
                
                {/* Chat Messages Area */}
                <div className="mb-3 max-h-40 overflow-y-auto space-y-3">
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
                
                {/* Prompt Input */}
                <div className="flex gap-2">
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
                    placeholder="Ask anything..."
                    disabled={copilotLoading}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/90 placeholder:text-white/40 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all disabled:opacity-50"
                  />
                  <Tooltip text="Send message">
                    <button 
                      onClick={() => handleSendPrompt()}
                      disabled={copilotLoading || !copilotPrompt.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white/90 text-sm font-medium hover:bg-white/15 hover:border-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      Send
                    </button>
                  </Tooltip>
                </div>
                
                {/* Quick Prompts - Click to inject and send */}
                <div className="mt-3 flex flex-wrap gap-2">
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
                      className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all text-xs text-white/60 hover:text-white/90 disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </section>

              {/* Quick Actions - Swipeable carousel showing 3.25 items */}
              <section className="rounded-xl backdrop-blur-xl bg-slate-900/40 border border-white/10 p-3">
                <div className="text-[10px] uppercase tracking-wider text-white/60 mb-2">Quick Actions</div>
                <div className="quick-actions-carousel">
                  <Tooltip text="Browse your content library">
                    <button 
                      onClick={() => {
                        triadContext?.actions.refreshLibrary?.();
                        setActiveTab("library");
                        setCopilotOpen(false);
                      }}
                      className="quick-action-item"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Library</span>
                    </button>
                  </Tooltip>
                  <Tooltip text="Claim pending rewards">
                    <button 
                      onClick={() => {
                        setActiveTab("rewards");
                        setCopilotOpen(false);
                      }}
                      className="quick-action-item"
                    >
                      <Gift className="w-3.5 h-3.5" />
                      <span>Rewards</span>
                    </button>
                  </Tooltip>
                  <Tooltip text="View available tasks">
                    <button 
                      onClick={() => {
                        setActiveTab("tasks");
                        setCopilotOpen(false);
                      }}
                      className="quick-action-item"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Tasks</span>
                    </button>
                  </Tooltip>
                  <Tooltip text="Build your reputation">
                    <button 
                      onClick={() => {
                        setActiveTab("reputation");
                        setCopilotOpen(false);
                      }}
                      className="quick-action-item"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      <span>Reputation</span>
                    </button>
                  </Tooltip>
                </div>
              </section>
              
              {/* Q¢ Balance - Between Quick Actions and Smart Triad */}
              <section className="rounded-xl backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/5 border border-purple-500/20 p-4">
                <div className="text-xs uppercase tracking-wider text-white/70 mb-3">Your Q¢ Balance</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-white/95">
                      {bals.qctArb ? (Number(bals.qctArb) / Math.pow(10, bals.qctArbDecimals || 18)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
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
              
              {/* Smart Triad Actions */}
              <section className="rounded-xl backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 border border-purple-500/20 p-4">
                <div className="text-xs uppercase tracking-wider text-white/70 mb-3">Smart Triad</div>
                <div className="space-y-2">
                  <Tooltip text="Purchase selected content with Q¢">
                    <button 
                      className="w-full p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-500/30 transition-all text-left flex items-center gap-3 disabled:opacity-50"
                      onClick={async () => {
                        if (currentContent && triadContext) {
                          await triadContext.actions.purchaseContent(currentContent.id, "arb");
                          setCopilotOpen(false);
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
                        setCopilotOpen(false);
                      }}
                    >
                      <RefreshCw className="w-5 h-5 text-purple-400" />
                      <div>
                        <div className="text-sm text-white/90">Sync Library</div>
                        <div className="text-xs text-white/60">Refresh from QubeBase</div>
                      </div>
                    </button>
                  </Tooltip>
                  <Tooltip text="Get AI-powered content recommendations">
                    <button 
                      className="w-full p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-500/30 transition-all text-left flex items-center gap-3"
                    >
                      <Target className="w-5 h-5 text-purple-400" />
                      <div>
                        <div className="text-sm text-white/90">Get Recommendations</div>
                        <div className="text-xs text-white/60">AI-powered suggestions</div>
                      </div>
                    </button>
                  </Tooltip>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Wallet Tab */}
          {activeTab === "wallet" && (
            <div className="space-y-4">
              {!effectivePersonaId && (
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
                  <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
                    <button
                      onClick={() => openTransactionModal("send")}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </button>
                    <button
                      onClick={() => openTransactionModal("receive")}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium transition-colors"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      Receive
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
              {/* Balances - Show real blockchain Q¢ balances */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60">
                    <Coins className="w-3.5 h-3.5 text-purple-400" />
                    Q¢ Balances
                  </div>
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live
                  </div>
                </div>
                
                {/* Real blockchain balances */}
                <ul className="space-y-1.5 text-sm text-white/90">
                  {/* Arbitrum Q¢ - Primary */}
                  <Tooltip text="Q¢ on Arbitrum network">
                    <li className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-cyan-500/10 to-transparent">
                      <span className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        <span>Arbitrum</span>
                      </span>
                      <span className="font-mono text-white font-medium">
                        {formatQcent(bals.qctArb, bals.qctArbDecimals)} Q¢
                      </span>
                    </li>
                  </Tooltip>
                  
                  {/* Sepolia Q¢ */}
                  <Tooltip text="Q¢ on Sepolia testnet">
                    <li className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        <span>Sepolia</span>
                      </span>
                      <span className="font-mono text-white">
                        {formatQcent(bals.qctSep, bals.qctSepDecimals)} Q¢
                      </span>
                    </li>
                  </Tooltip>

                  {/* Base Q¢ */}
                  <Tooltip text="Q¢ on Base Sepolia">
                    <li className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                      <span className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-cyan-400" />
                        <span>Base</span>
                      </span>
                      <span className="font-mono text-white">
                        {formatQcent(bals.qctBase, bals.qctBaseDecimals)} Q¢
                      </span>
                    </li>
                  </Tooltip>
                  
                  {/* USDC */}
                  <Tooltip text="USDC stablecoin balance">
                    <li className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                      <span className="flex items-center gap-2">
                        <CircleDollarSign className="w-4 h-4 text-green-400" />
                        <span>USDC</span>
                      </span>
                      <span className="font-mono text-white">
                        {formatUSDC(bals.usdcSep, bals.usdcSepDecimals)}
                      </span>
                    </li>
                  </Tooltip>
                  
                  {/* Total */}
                  <li className="flex items-center justify-between pt-2 mt-1 border-t border-white/10">
                    <span className="flex items-center gap-2 text-white/80 font-medium">
                      <Wallet className="w-4 h-4 text-purple-400" />
                      Total Q¢
                    </span>
                    <span className="font-mono text-white font-bold">{qctTotalStr}</span>
                  </li>
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
              

              {/* Current Content & Purchase Flow */}
              {currentContent && (
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
              )}

              {/* DVN Events */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60 mb-2">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  Recent DVN Events
                </div>
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
                </div>
                <div className="text-xs text-white/70">FIO: {agent.fioHandle || "—"}</div>
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

          {/* Library Tab */}
          {activeTab === "library" && (
            <div className="space-y-4">
              {/* Show entitlements from walletNode if available */}
              {walletNode?.contentEntitlements && walletNode.contentEntitlements.length > 0 ? (
                <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-white/60 mb-2">
                    Your Library ({walletNode.contentEntitlements.length})
                  </div>
                  <div className="space-y-1">
                    {walletNode.contentEntitlements.map((ent: any) => (
                      ent.content ? (
                        // Use SmartContentCard compact variant for full content objects
                        <SmartContentCard
                          key={ent.id}
                          content={ent.content}
                          variant="compact"
                          onSelect={onContentSelect}
                          isOwned={true}
                          isInLibrary={true}
                        />
                      ) : (
                        // Fallback for entitlements without full content (legacy/reference only)
                        <div
                          key={ent.id}
                          className="flex items-center gap-3 p-2 rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                          onClick={() => {
                            // Fetch content from QubeBase reference if available
                            if (ent.qubeBaseRef) {
                              console.log('Fetching from QubeBase:', ent.qubeBaseRef);
                              // TODO: Implement QubeBase content fetch
                            }
                          }}
                        >
                          <div className="w-10 h-10 rounded bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white/90 truncate">{ent.contentTitle}</div>
                            <div className="text-xs text-white/50 flex items-center gap-2">
                              <Tooltip text={ent.scope === 'full' ? 'Full access' : 'Partial access'}>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  ent.scope === 'full' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                                }`}>
                                  {ent.scope}
                                </span>
                              </Tooltip>
                              <Tooltip text={ent.acquiredVia === 'purchase' ? 'Purchased' : ent.acquiredVia === 'free' ? 'Free content' : 'Subscription'}>
                                <span className="flex items-center">
                                  {ent.acquiredVia === 'purchase' && <CreditCard className="w-3 h-3 text-amber-400" />}
                                  {ent.acquiredVia === 'free' && <Gift className="w-3 h-3 text-emerald-400" />}
                                  {ent.acquiredVia !== 'purchase' && ent.acquiredVia !== 'free' && <Award className="w-3 h-3 text-purple-400" />}
                                </span>
                              </Tooltip>
                              {ent.qubeBaseRef && (
                                <Tooltip text={ent.qubeBaseRef.type === 'ipfs' ? 'Stored on IPFS' : 'Stored on QubeBase'}>
                                  <span className="flex items-center gap-1 text-[10px] text-white/40">
                                    {ent.qubeBaseRef.type === 'ipfs' ? <Link className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                                    {ent.qubeBaseRef.type === 'ipfs' ? 'IPFS' : 'QubeBase'}
                                  </span>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </section>
              ) : effectivePersonaId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectivePersonaId) ? (
                // Only use LibraryShelf for valid UUID personaIds
                <LibraryShelf personaId={effectivePersonaId} onContentSelect={onContentSelect} variant="drawer" />
              ) : (
                <div className="text-center py-8 text-white/50 text-sm">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                  No content in your library yet.
                  <br />
                  <span className="text-xs text-white/40">Purchase or add free content to get started!</span>
                </div>
              )}
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === "tasks" && (
            <div className="space-y-4">
              {/* Active Tasks */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
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
                <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
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
              <section className="rounded-2xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 ring-1 ring-purple-500/20 p-4">
                <div className="text-center">
                  <div className="flex justify-center gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={`w-6 h-6 ${
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
                  <div className="text-sm text-white/60">Reputation Score</div>
                </div>
              </section>

              {/* Reputation Breakdown */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-white/60 mb-3">Score Breakdown</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-white/80">
                      <FileText className="w-4 h-4 text-purple-400" />
                      Content Created
                    </span>
                    <span className="text-white font-medium">+0</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-white/80">
                      <CheckSquare className="w-4 h-4 text-purple-400" />
                      Tasks Completed
                    </span>
                    <span className="text-white font-medium">+0</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-white/80">
                      <ThumbsUp className="w-4 h-4 text-purple-400" />
                      Community Votes
                    </span>
                    <span className="text-white font-medium">+0</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-white/80">
                      <BadgeCheck className="w-4 h-4 text-purple-400" />
                      Verified Claims
                    </span>
                    <span className="text-white font-medium">+0</span>
                  </div>
                </div>
              </section>

              {/* Badges */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-white/60 mb-3">Badges</div>
                {walletNode?.personaContext?.activePersona?.badges?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {walletNode.personaContext.activePersona.badges.map((badge: string, idx: number) => (
                      <Tooltip key={idx} text={badge}>
                        <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-500/20 text-white/90 text-xs ring-1 ring-purple-500/30">
                          <Award className="w-3 h-3" />
                          {badge}
                        </span>
                      </Tooltip>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-white/60">No badges earned yet</div>
                )}
              </section>

              {/* Submit Claim */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-white/60 mb-2">Submit Reputation Claim</div>
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
              {/* Pending Rewards */}
              {(rewards as any)?.pendingRewards && (rewards as any).pendingRewards.length > 0 && (
                <section className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 ring-1 ring-amber-500/20 p-3">
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

              {/* Recent Rewards */}
              {rewards && rewards.recentRewards.length > 0 && (
                <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60 mb-2">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    Recent Rewards
                  </div>
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
                          {reward.distributedAt ? new Date(reward.distributedAt).toLocaleDateString() : 'Pending'}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Lifetime Stats */}
              {(rewards as any)?.lifetimeEarnings && (
                <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
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

              {(!rewards || rewards.recentRewards.length === 0) && (
                <div className="text-center py-8 text-white/50 text-sm">
                  <Gift className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                  No rewards yet. Complete tasks to earn rewards!
                </div>
              )}
            </div>
          )}
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
