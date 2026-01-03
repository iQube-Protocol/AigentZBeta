/**
 * SmartWalletDrawer - Copied from /app/components/content/SmartWalletDrawer.tsx
 * 
 * This is the x402 SmartWallet with:
 * - DIDQube identity management
 * - RQH (Reputation Qube Hub) integration
 * - Rewards system
 * - Persona management
 * - x402 payment rails
 * 
 * Adapted for use in The Qriptopian Vite app.
 */

import React, { useState, useEffect } from "react";
import type { SmartWalletNode, WalletTask, QuestProgress, RecentReward, PersonaState } from "@/types/smartWallet";
import { useMetaAvatar } from "@/contexts/MetaAvatarContext";
import { supabase } from "@/integrations/supabase/client";
import { AddPersonaModal } from "./AddPersonaModal";
import { TransactionModal, type TransactionTab, type TransactionResult, type PaymentRequest } from "./TransactionModal";
import { PaymentRequestsPanel } from "./PaymentRequestsPanel";
import { BuyKnytModal } from "./BuyKnytModal";
import { PersonaSetupWizard } from "./PersonaSetupWizard";
import { PersonaEditModal } from "./PersonaEditModal";
import { PersonaSelector } from "./PersonaSelector";
import { UnlockModal } from "./UnlockModal";
import { PurchaseFlow, type PurchaseStep, type PaymentMethod } from "./PurchaseFlow";
import { AliasConsentToggle } from "./AliasConsentToggle";
import { SettlementRetryButton } from "./SettlementRetryButton";
import { useKnytBalance } from "@/hooks/useKnytBalance";
import { useBalances } from "@/hooks/useBalances";
import { useDVNEvents } from "@/hooks/useDVNEvents";
import { useEthPrice } from "@/hooks/useEthPrice";
import { useSmartContentAction } from "@/contexts/SmartContentActionContext";
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
  ChevronDown,
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
  LogOut,
  LogIn,
  Plus,
  Copy,
  Loader2,
  Book,
  Film,
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
  RARE: '/icons/knight-bronze.png',
  EPIC: '/icons/knight-silver.png',
  LEGENDARY: '/icons/knight-gold.png',
};

// Get rarity icon for an entitlement
const getRarityIcon = (coverType: string | undefined): string | null => {
  if (!coverType) return null;
  const upper = coverType.toUpperCase();
  if (upper === 'RARE' || upper === 'PRINT_RARE') return RARITY_ICONS.RARE;
  if (upper === 'EPIC' || upper === 'PRINT_EPIC') return RARITY_ICONS.EPIC;
  if (upper === 'LEGENDARY' || upper === 'PRINT_LEGENDARY') return RARITY_ICONS.LEGENDARY;
  return null;
};

// Get rarity tooltip text
const getRarityTooltip = (coverType: string | undefined): string => {
  if (!coverType) return '';
  const upper = coverType.toUpperCase();
  if (upper === 'RARE' || upper === 'PRINT_RARE') return 'Rare Edition';
  if (upper === 'EPIC' || upper === 'PRINT_EPIC') return 'Epic Edition';
  if (upper === 'LEGENDARY' || upper === 'PRINT_LEGENDARY') return 'Legendary Edition';
  return '';
};

// Check if content is motion (video) or still (book)
const isMotionContent = (ent: any): boolean => {
  const assetId = ent.contentId || ent.assetId || '';
  const coverType = ent.coverType || '';
  return assetId.toLowerCase().includes('motion') || coverType.toUpperCase() === 'MOTION';
};

type DrawerTab = "wallet" | "library" | "tasks" | "reputation" | "rewards";

interface SmartWalletDrawerProps {
  open: boolean;
  onClose: () => void;
  variant?: 'overlay' | 'embedded';
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
  onTaskAction?: (task: WalletTask, action: "complete" | "dismiss") => void;
  onPurchaseComplete?: (contentId: string) => void;
  recipientAddress?: string;
  initialTab?: DrawerTab;
  onPersonaChange?: (personaId: string) => void;
  onCreatePersona?: () => void;
  onSubmitReputationClaim?: () => void;
  onOpenCopilot?: () => void;
  showCopilot?: boolean;
  availablePersonas?: Array<{
    id: string;
    name: string;
    fioHandle?: string;
    isAgent: boolean;
  }>;
  isLoadingBalances?: boolean;
  isLoadingWalletData?: boolean;
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
  variant = 'overlay',
  agent,
  personaId,
  walletNode,
  onTaskAction,
  onPurchaseComplete,
  recipientAddress,
  initialTab = "wallet",
  onPersonaChange,
  onCreatePersona,
  onSubmitReputationClaim,
  onOpenCopilot,
  showCopilot = false,
  availablePersonas = [],
  isLoadingBalances = false,
  isLoadingWalletData = false,
}: SmartWalletDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>(initialTab);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMode, setCopilotMode] = useState<'text' | 'avatar'>('text');
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [copilotMessages, setCopilotMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: "Hi! I can help you manage your wallet, find content, or answer questions. What would you like to do?" }
  ]);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
  const [addPersonaModalOpen, setAddPersonaModalOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
  }, [open, initialTab]);
  
  // Transaction modal state
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionTab, setTransactionTab] = useState<TransactionTab>('send');
  const [prefillRecipient, setPrefillRecipient] = useState<string | undefined>();
  const [prefillAmount, setPrefillAmount] = useState<number | undefined>();
  const [prefillTxHash, setPrefillTxHash] = useState<string | undefined>();
  
  // KNYT state
  const [buyKnytModalOpen, setBuyKnytModalOpen] = useState(false);
  const { balance: knytBalance, isLoading: knytLoading, refetch: refetchKnyt } = useKnytBalance(personaId);
  
  // New ported feature states
  const [personaSetupWizardOpen, setPersonaSetupWizardOpen] = useState(false);
  const [personaEditModalOpen, setPersonaEditModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<any>(null);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [isWalletUnlocked, setIsWalletUnlocked] = useState(false);
  
  // Purchase flow state
  const [purchaseStep, setPurchaseStep] = useState<PurchaseStep>('idle');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('arb');
  const [currentContent, setCurrentContent] = useState<any>(null);
  
  // Identity/x402 state
  const [aliasConsent, setAliasConsent] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('x402_alias_consent') === 'true'; } catch { return false; }
  });
  const [retrySettlementId, setRetrySettlementId] = useState('');
  const [retryMessageId, setRetryMessageId] = useState('');
  
  // Token selection for send/receive (KNYT default)
  const [selectedToken, setSelectedToken] = useState<'KNYT' | 'QCT' | 'USDC'>('KNYT');
  
  // Q¢ by chain collapse state
  const [qcChainCollapsed, setQcChainCollapsed] = useState(true);
  const [custodyCount, setCustodyCount] = useState(0);
  
  // Library item viewer state
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<any>(null);
  const [claimCount, setClaimCount] = useState(0);
  
  // FIO DID - Universal x402 Wallet ID derived from FIO handle
  const [fioDid, setFioDid] = useState<string | null>(null);
  
  // USDC→Q¢ conversion state
  const [convertUsdcAmount, setConvertUsdcAmount] = useState('');
  const [convertStep, setConvertStep] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertResult, setConvertResult] = useState<any>(null);
  
  // Real blockchain balances
  const balances = useBalances({ 
    sepolia: agent.evmSepolia, 
    arb: agent.evmArb, 
    btc: agent.btcAddress 
  });
  
  // DVN events
  const dvnEvents = useDVNEvents(agent.id);
  
  // ETH price for KNYT conversion
  const { ethPriceUsd, knytPriceUsd } = useEthPrice();
  
  // MetaAvatar context for persistent iframe
  const { requestAvatar, releaseAvatar, refreshAvatar } = useMetaAvatar();

  // Persist alias consent
  useEffect(() => {
    try { localStorage.setItem('x402_alias_consent', aliasConsent ? 'true' : 'false'); } catch {}
  }, [aliasConsent]);

  // Generate FIO DID from FIO handle - Universal x402 Wallet ID
  // Format: did:iq:{sha256(fioHandle)[0:32]}
  useEffect(() => {
    const generateDid = async () => {
      const fioHandle = agent?.fioHandle || walletNode?.personaContext?.activePersona?.fioHandle;
      if (!fioHandle) {
        setFioDid(null);
        return;
      }
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(fioHandle.toLowerCase());
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = new Uint8Array(hashBuffer);
        const hashHex = Array.from(hashArray)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        setFioDid(`did:iq:${hashHex.slice(0, 32)}`);
      } catch (err) {
        console.warn('[SmartWallet] Failed to generate FIO DID:', err);
        setFioDid(null);
      }
    };
    generateDid();
  }, [agent?.fioHandle, walletNode?.personaContext?.activePersona?.fioHandle]);

  // Fetch custody and claim counts
  useEffect(() => {
    const did = agent?.id ? `did:iq:${agent.id}#auth` : undefined;
    if (!did) return;
    (async () => {
      try {
        const apiBase = import.meta.env.VITE_AIGENT_API_URL || '';
        const c = await fetch(`${apiBase}/api/x402/custody?did=${encodeURIComponent(did)}`, { cache: 'no-store' });
        const cj = await c.json().catch(() => ({}));
        if (cj?.ok && Array.isArray(cj.data)) setCustodyCount(cj.data.length);
      } catch {}
      try {
        const apiBase = import.meta.env.VITE_AIGENT_API_URL || '';
        const r = await fetch(`${apiBase}/api/x402/claims?did=${encodeURIComponent(did)}&status=open`, { cache: 'no-store' });
        const rj = await r.json().catch(() => ({}));
        if (rj?.ok && Array.isArray(rj.data)) setClaimCount(rj.data.length);
      } catch {}
    })();
  }, [agent?.id]);

  // Check wallet unlock status on mount
  useEffect(() => {
    if (personaId) {
      const sessionToken = sessionStorage.getItem(`wallet_session_${personaId}`);
      setIsWalletUnlocked(!!sessionToken);
    }
  }, [personaId]);

  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onClose();
    window.location.href = '/';
  };

  // Handle sign in
  const handleSignIn = () => {
    onClose();
    window.location.href = '/auth';
  };

  const { executeAction } = useSmartContentAction();

  // Handle invite click - open social sharing modal with signup link
  const handleInviteClick = async () => {
    if (!personaId) return;
    
    try {
      const inviteUrl = `${window.location.origin}/auth?mode=signup&ref=${encodeURIComponent(personaId)}`;
      const shareItem = {
        id: `invite-${personaId}`,
        title: 'Join The Qriptopian',
        description: 'Join me on The Qriptopian - earn KNYT tokens and explore the future of content!',
        section: 'referral',
        modalities: {
          link: { url: inviteUrl },
        },
      };

      executeAction('share', shareItem);
    } catch (error) {
      console.error('Failed to generate invite link:', error);
    }
  };

  // Handle persona created - refresh data via callback
  const handlePersonaCreated = () => {
    if (onCreatePersona) {
      onCreatePersona();
    } else {
      window.location.reload();
    }
  };

  // Request/release avatar based on copilot state and mode
  useEffect(() => {
    if (open && copilotOpen && copilotMode === 'avatar') {
      requestAvatar('copilot', 'moneypenny');
    } else {
      releaseAvatar('copilot');
    }
    
    // Cleanup on unmount
    return () => releaseAvatar('copilot');
  }, [open, copilotOpen, copilotMode, requestAvatar, releaseAvatar]);

  // Get tasks from wallet node or use empty array
  const tasks = walletNode?.tasks || [];
  const quests = walletNode?.activeQuests || [];
  const rewards = walletNode?.rewardsContext;
  
  // Format token display
  const formatToken = (amount: number, decimals: number = 0) => {
    return amount.toLocaleString(undefined, { maximumFractionDigits: decimals });
  };

  // Detect intent from user message and switch tabs accordingly
  const detectIntentAndSwitchTab = (message: string): { tab: DrawerTab | null; response: string } => {
    const lowerMsg = message.toLowerCase();
    
    // Rewards/earnings intent
    if (lowerMsg.includes('reward') || lowerMsg.includes('earn') || lowerMsg.includes('earning')) {
      return { 
        tab: 'rewards', 
        response: `Here's your rewards overview! You've earned ${rewards?.totalEarned?.amount || 0} Q¢ total. ${rewards?.recentRewards?.length ? `Your most recent reward was for "${rewards.recentRewards[0].reason}".` : 'Complete tasks to start earning rewards!'}`
      };
    }
    
    // Tasks intent
    if (lowerMsg.includes('task') || lowerMsg.includes('todo') || lowerMsg.includes('what can i do') || lowerMsg.includes('how can i earn')) {
      const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
      return { 
        tab: 'tasks', 
        response: `You have ${pendingTasks.length} active task${pendingTasks.length !== 1 ? 's' : ''}! ${pendingTasks.length > 0 ? `Try "${pendingTasks[0].label}" to earn +${pendingTasks[0].rewardPreview?.amount || 0} Q¢.` : 'Check back soon for new tasks.'}`
      };
    }
    
    // Balance/wallet intent
    if (lowerMsg.includes('balance') || lowerMsg.includes('afford') || lowerMsg.includes('how much') || lowerMsg.includes('wallet') || lowerMsg.includes('money')) {
      return { 
        tab: 'wallet', 
        response: `Your current balance is ${walletNode?.balances?.totalQc?.toLocaleString() || 0} Q¢. ${walletNode?.balances?.pendingRewards ? `You also have ${walletNode.balances.pendingRewards} Q¢ in pending rewards!` : ''}`
      };
    }
    
    // Library/content intent
    if (lowerMsg.includes('library') || lowerMsg.includes('content') || lowerMsg.includes('own') || lowerMsg.includes('purchased') || lowerMsg.includes('read')) {
      const entitlements = walletNode?.contentEntitlements || [];
      return { 
        tab: 'library', 
        response: `You have ${entitlements.length} item${entitlements.length !== 1 ? 's' : ''} in your library. ${entitlements.length > 0 ? 'Tap any item to continue reading!' : 'Purchase or earn content to build your library.'}`
      };
    }
    
    // Reputation intent
    if (lowerMsg.includes('reputation') || lowerMsg.includes('score') || lowerMsg.includes('badge') || lowerMsg.includes('level') || lowerMsg.includes('rank')) {
      const repScore = walletNode?.personaContext?.activePersona?.reputationScore || 0;
      const badges = walletNode?.personaContext?.activePersona?.badges || [];
      return { 
        tab: 'reputation', 
        response: `Your reputation score is ${repScore}. ${badges.length > 0 ? `You've earned ${badges.length} badge${badges.length !== 1 ? 's' : ''}: ${badges.join(', ')}.` : 'Complete tasks and engage with content to earn badges!'}`
      };
    }
    
    // TRANSACTION INTENTS - Send, Receive, Verify
    
    // Send intent - "send 50 Q¢ to alice@knyt", "transfer 100 to 0x...", "pay bob@knyt"
    if (lowerMsg.includes('send') || lowerMsg.includes('transfer') || lowerMsg.includes('pay ')) {
      // Extract amount if present
      const amountMatch = lowerMsg.match(/(\d+(?:\.\d+)?)\s*(?:q¢|qc|qct|tokens?)?/i);
      const extractedAmount = amountMatch ? parseFloat(amountMatch[1]) : undefined;
      
      // Extract recipient if present (Persona handle or address)
      const fioMatch = lowerMsg.match(/(?:to\s+)?([a-z0-9]+@[a-z0-9]+)/i);
      const addressMatch = lowerMsg.match(/(?:to\s+)?(0x[a-fA-F0-9]{40})/i);
      const extractedRecipient = fioMatch?.[1] || addressMatch?.[1];
      
      // Set prefill values and open modal
      if (extractedAmount) setPrefillAmount(extractedAmount);
      if (extractedRecipient) setPrefillRecipient(extractedRecipient);
      setTransactionTab('send');
      setTransactionModalOpen(true);
      
      return { 
        tab: 'wallet', 
        response: extractedRecipient 
          ? `Opening send dialog${extractedAmount ? ` for ${extractedAmount} Q¢` : ''} to ${extractedRecipient}. Please confirm the transaction details.`
          : `Opening send dialog${extractedAmount ? ` for ${extractedAmount} Q¢` : ''}. Enter the recipient address or Persona handle to continue.`
      };
    }
    
    // Receive/Request intent - "request 100 Q¢", "receive payment", "get paid"
    if (lowerMsg.includes('receive') || lowerMsg.includes('request') || lowerMsg.includes('get paid') || lowerMsg.includes('invoice')) {
      // Extract amount if present
      const amountMatch = lowerMsg.match(/(\d+(?:\.\d+)?)\s*(?:q¢|qc|qct|tokens?)?/i);
      const extractedAmount = amountMatch ? parseFloat(amountMatch[1]) : undefined;
      
      if (extractedAmount) setPrefillAmount(extractedAmount);
      setTransactionTab('receive');
      setTransactionModalOpen(true);
      
      return { 
        tab: 'wallet', 
        response: `Opening payment request dialog${extractedAmount ? ` for ${extractedAmount} Q¢` : ''}. You can generate a QR code or shareable link.`
      };
    }
    
    // Verify intent - "verify tx 0x...", "check transaction", "tx status"
    if (lowerMsg.includes('verify') || lowerMsg.includes('check tx') || lowerMsg.includes('check transaction') || lowerMsg.includes('tx status') || lowerMsg.includes('transaction status')) {
      // Extract tx hash if present
      const txMatch = lowerMsg.match(/(0x[a-fA-F0-9]{64})/i);
      const extractedTxHash = txMatch?.[1];
      
      if (extractedTxHash) setPrefillTxHash(extractedTxHash);
      setTransactionTab('verify');
      setTransactionModalOpen(true);
      
      return { 
        tab: 'wallet', 
        response: extractedTxHash 
          ? `Verifying transaction ${extractedTxHash.slice(0, 10)}...${extractedTxHash.slice(-8)}. Please wait.`
          : `Opening transaction verification. Enter a transaction hash to check its status.`
      };
    }
    
    // KNYT intent - "buy knyt", "what is knyt", "knyt balance", "knyt price"
    if (lowerMsg.includes('knyt')) {
      if (lowerMsg.includes('buy') || lowerMsg.includes('purchase') || lowerMsg.includes('get')) {
        setBuyKnytModalOpen(true);
        return { tab: 'wallet', response: `Opening KNYT purchase dialog. Current price: $${knytPriceUsd.toFixed(2)} per KNYT (0.0005 ETH). You currently have ${knytBalance?.dvnKnyt?.toFixed(2) || '0'} KNYT.` };
      }
      if (lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('worth')) {
        return { tab: 'wallet', response: `KNYT is priced at $${knytPriceUsd.toFixed(2)} per token (0.0005 ETH). KNYT is used for DVN attestation fees, cross-chain messaging, and premium features.` };
      }
      if (lowerMsg.includes('balance') || lowerMsg.includes('how much') || lowerMsg.includes('have')) {
        return { tab: 'wallet', response: `You have ${knytBalance?.dvnKnyt?.toFixed(2) || '0'} KNYT (worth ~$${((knytBalance?.dvnKnyt || 0) * knytPriceUsd).toFixed(2)}). Use KNYT for DVN fees and cross-chain operations.` };
      }
      return { tab: 'wallet', response: `KNYT is the utility token for DVN attestation and cross-chain operations. Price: $${knytPriceUsd.toFixed(2)}/KNYT. Your balance: ${knytBalance?.dvnKnyt?.toFixed(2) || '0'} KNYT. Say "buy KNYT" to purchase more.` };
    }
    
    // DVN Events intent
    if (lowerMsg.includes('dvn') || lowerMsg.includes('event') || lowerMsg.includes('attestation')) {
      return { tab: 'wallet', response: `DVN (Decentralized Verification Network) handles cross-chain attestations. ${dvnEvents.length > 0 ? `Recent events: ${dvnEvents.slice(0,2).map(e => e.event).join(', ')}.` : 'No recent DVN events.'} KNYT is used to pay DVN fees.` };
    }
    
    // x402 Settlement intent
    if (lowerMsg.includes('x402') || lowerMsg.includes('settlement') || lowerMsg.includes('custody') || lowerMsg.includes('settlement id') || lowerMsg.includes('message id')) {
      return { tab: 'wallet', response: `x402 is the payment protocol for content monetization. You have ${custodyCount} custody sessions and ${claimCount} pending claims. To retry a specific settlement, enter the Settlement ID (unique identifier for the payment session) and/or Message ID (DVN cross-chain message reference) in the x402 Settlement section. Both fields are optional - leave blank to retry all pending settlements.` };
    }
    
    // Persona/Identity intent
    if (lowerMsg.includes('persona') || lowerMsg.includes('identity') || lowerMsg.includes('wallet address') || lowerMsg.includes('fio')) {
      return { tab: 'wallet', response: `Your x402 Wallet ID (DID): ${fioDid ? fioDid.slice(0,16) + '...' : 'Not set'}. Persona Handle: ${agent.fioHandle || 'Not set'}. Your DID maps to all your chain addresses (EVM, BTC, SOL) via FIO.` };
    }
    
    // Default - no tab switch
    return { 
      tab: null, 
      response: "I'm here to help! Ask me about your balance, KNYT, rewards, tasks, library, or reputation. I can also help you send/receive payments, buy KNYT, or check DVN events."
    };
  };
  
  // Helper to open transaction modal from UI buttons
  const openTransactionModal = (tab: TransactionTab) => {
    setPrefillRecipient(undefined);
    setPrefillAmount(undefined);
    setPrefillTxHash(undefined);
    setTransactionTab(tab);
    setTransactionModalOpen(true);
  };
  
  // Handle transaction completion
  const handleTransactionComplete = (result: TransactionResult) => {
    if (result.success) {
      setCopilotMessages(prev => [...prev, { 
        role: 'assistant', 
        content: result.txHash 
          ? `✅ Transaction sent! Hash: ${result.txHash.slice(0, 10)}...${result.txHash.slice(-8)}. Amount: ${result.amount} Q¢`
          : `✅ ${result.deliveryMode === 'claim' ? 'Claim created' : 'Transaction completed'}! Amount: ${result.amount} Q¢`
      }]);
    }
  };
  
  // Handle payment request creation
  const handleRequestCreated = (request: PaymentRequest) => {
    setCopilotMessages(prev => [...prev, { 
      role: 'assistant', 
      content: `💰 Payment request created for ${request.amount} Q¢. Share the link or QR code with the payer.`
    }]);
  };

  // Handle sending a prompt to the copilot
  const handleSendPrompt = async (prompt?: string) => {
    const messageToSend = prompt || copilotPrompt.trim();
    if (!messageToSend) return;
    
    setCopilotMessages(prev => [...prev, { role: 'user', content: messageToSend }]);
    setCopilotPrompt("");
    setCopilotLoading(true);
    
    // Detect intent and get contextual response
    setTimeout(() => {
      const { tab, response } = detectIntentAndSwitchTab(messageToSend);
      
      // Switch tab if intent detected
      if (tab) {
        setActiveTab(tab);
      }
      
      setCopilotMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response
      }]);
      setCopilotLoading(false);
    }, 800);
  };

  // USDC→Q¢ conversion handler
  const handleConvertUsdcToQc = async () => {
    if (!personaId) return;
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
      const apiBase = import.meta.env.VITE_AIGENT_API_URL || '';
      const r = await fetch(`${apiBase}/api/wallet/qct/convert/usdc-to-qc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId, usdcAmount: n }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Conversion failed");
      setConvertResult(j);
      setConvertStep("success");
      setConvertUsdcAmount("");
    } catch (e: any) {
      setConvertError(e?.message || "Conversion failed");
      setConvertStep("error");
    }
  };

  if (!open) return null;

  // Drawer width: normal = 21.6rem, expanded (copilot) = 28rem, embedded = full width
  const drawerWidth = variant === 'embedded' ? 'w-full' : (copilotOpen ? "w-[28rem]" : "w-[21.6rem]");

  const drawerPanel = (
    <>
      <div className={`${variant === 'overlay' ? 'ml-auto h-full' : 'h-full'} ${drawerWidth} bg-black/30 backdrop-blur-xl ring-1 ring-white/10 border-l border-white/10 overflow-hidden flex flex-col transition-all duration-300 pt-4`}>
        {/* Header with Persona Info and Close */}
        <header className="flex items-center justify-between gap-2 px-3 py-2 mx-3 rounded-xl bg-white/5 ring-1 ring-white/10 flex-shrink-0">
          {/* Persona Display - Icon with dropdown chevron */}
          <div className="relative z-[100]">
            <button
              onClick={() => setPersonaMenuOpen(!personaMenuOpen)}
              className="flex items-center gap-1 hover:bg-white/5 rounded-lg p-1.5 transition-colors"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${walletNode?.personaContext?.activePersona?.isAgent ? 'bg-amber-500/20' : 'bg-cyan-500/20'}`}>
                {walletNode?.personaContext?.activePersona?.isAgent ? (
                  <Bot className="w-4 h-4 text-amber-400" />
                ) : (
                  <User className="w-4 h-4 text-cyan-400" />
                )}
              </div>
              <ChevronDown className={`w-3 h-3 text-white/50 transition-transform ${personaMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Persona Dropdown Menu */}
            {personaMenuOpen && (
              <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-slate-950 rounded-lg border border-white/20 shadow-2xl z-[200] overflow-hidden">
                {/* Available Personas */}
                {availablePersonas.length > 0 && (
                  <div className="max-h-48 overflow-y-auto">
                    <div className="px-3 py-2 border-b border-white/10">
                      <p className="text-xs text-white/50 uppercase tracking-wider">Switch Persona</p>
                    </div>
                    {availablePersonas.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onPersonaChange?.(p.id);
                          setPersonaMenuOpen(false);
                        }}
                        className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 transition-colors ${
                          walletNode?.personaContext?.activePersona?.id === p.id ? 'bg-white/5' : ''
                        }`}
                      >
                        {p.isAgent ? (
                          <Bot className="w-4 h-4 text-amber-400" />
                        ) : (
                          <User className="w-4 h-4 text-cyan-400" />
                        )}
                        <div className="text-left min-w-0 flex-1">
                          <p className="text-sm text-white/90 truncate">{p.name}</p>
                          <p className="text-xs text-white/50 truncate">{p.fioHandle || 'No Persona handle'}</p>
                        </div>
                        {walletNode?.personaContext?.activePersona?.id === p.id && (
                          <Check className="w-3 h-3 text-emerald-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Edit Current Persona */}
                {walletNode?.personaContext?.activePersona && (
                  <div className="border-t border-white/10">
                    <button
                      onClick={() => {
                        setPersonaMenuOpen(false);
                        setEditingPersona({
                          id: walletNode.personaContext?.activePersona?.id || '',
                          fioHandle: walletNode.personaContext?.activePersona?.fioHandle,
                          displayName: walletNode.personaContext?.activePersona?.displayName || agent.name,
                          avatarUri: walletNode.personaContext?.activePersona?.avatarUri,
                          reputationScore: walletNode.personaContext?.activePersona?.reputationScore,
                        });
                        setPersonaEditModalOpen(true);
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="text-sm">Edit Persona</span>
                    </button>
                  </div>
                )}

                {/* Unlock Wallet */}
                {!isWalletUnlocked && personaId && (
                  <div className="border-t border-white/10">
                    <button
                      onClick={() => {
                        setPersonaMenuOpen(false);
                        setUnlockModalOpen(true);
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 text-amber-400 hover:bg-amber-500/10 transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      <span className="text-sm">Unlock Wallet</span>
                    </button>
                  </div>
                )}

                {/* Add Persona Button - Quick */}
                <div className="border-t border-white/10">
                      <button
                        onClick={() => {
                          setPersonaMenuOpen(false);
                          setAddPersonaModalOpen(true);
                        }}
                        className="w-full px-3 py-2 flex items-center gap-2 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm">Quick Add Persona</span>
                      </button>
                    </div>

                {/* Create Persona with Wizard */}
                <div className="border-t border-white/10">
                  <button
                    onClick={() => {
                      setPersonaMenuOpen(false);
                      setPersonaSetupWizardOpen(true);
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2 text-purple-400 hover:bg-purple-500/10 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm">Create with Wizard</span>
                  </button>
                </div>
                    
                    {/* Sign Out Button */}
                    <div className="border-t border-white/10">
                      <button
                        onClick={() => {
                          setPersonaMenuOpen(false);
                          handleSignOut();
                        }}
                        className="w-full px-3 py-2 flex items-center gap-2 text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm">Sign Out</span>
                      </button>
                    </div>
              </div>
            )}
          </div>
          
          {/* Right side buttons */}
          <div className="flex items-center gap-1">
            {/* Copilot Button */}
            <Tooltip text="Copilot">
              <button
                onClick={() => {
                  setCopilotOpen(!copilotOpen);
                  onOpenCopilot?.();
                }}
                className={`p-1.5 rounded-lg transition-colors ${copilotOpen ? 'text-purple-400 bg-purple-500/10' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
              >
                <Bot className="w-4 h-4" />
              </button>
            </Tooltip>
            
            {/* Close Button */}
            <Tooltip text="Close Wallet">
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </header>

        {/* Tab Navigation - Icons only with tooltips */}
        <div className="flex justify-around px-3 py-2 bg-black/20">
          {TAB_CONFIG.map((tab) => (
            <Tooltip key={tab.key} text={tab.label}>
              <button
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 p-2 rounded-lg transition-colors ${
                  activeTab === tab.key 
                    ? 'text-cyan-400 bg-cyan-500/10' 
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.icon}
              </button>
            </Tooltip>
          ))}
        </div>

        {/* Copilot Panel - Full contextual command center */}
        {copilotOpen && (
          <div className="absolute inset-x-0 top-[111px] bottom-0 bg-slate-950/95 backdrop-blur-2xl z-10 flex flex-col">
            {/* Copilot Header with Mode Toggle and Back button */}
            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                {/* Mode Toggle: Text Copilot vs MoneyPenny Avatar */}
                <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                  <button
                    onClick={() => setCopilotMode('text')}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all ${
                      copilotMode === 'text' 
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
            
            {/* Chat Interface or Avatar Mode */}
            {copilotMode === 'text' ? (
              <section className="mx-3 mt-3 rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs uppercase tracking-wider text-white/60">Ask Copilot</div>
                  {copilotLoading && (
                    <div className="copilot-thinking-dots emerald">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </div>
                  )}
                </div>
                
                {/* Messages */}
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
              
              {/* Input */}
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
                <button 
                  onClick={() => handleSendPrompt()}
                  disabled={copilotLoading || !copilotPrompt.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white/90 text-sm font-medium hover:bg-white/15 hover:border-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              
              {/* Quick Prompts - Swipeable Carousel */}
              <div className="mt-3 -mx-1 px-1 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 pb-1 px-3 w-max">
                  {["My balance", "Show tasks", "My rewards", "My library", "My reputation", "How to earn Q¢", "What can I buy?"].map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendPrompt(prompt)}
                      disabled={copilotLoading}
                      className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all text-xs text-white/60 hover:text-white/90 disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </section>
            ) : (
              /* Avatar Mode - MoneyPenny MetaAvatar
                 The actual avatar is rendered globally in Layout.tsx
                 and positioned via CSS to appear in this area */
              <section className="mx-3 mt-3 rounded-xl bg-white/5 border border-white/10 p-4 h-[280px] flex flex-col items-center justify-center">
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

            {/* Contextual Tab Content - controlled by main tabs above */}
            <div className="flex-1 overflow-y-auto p-3">
              {/* Wallet Tab Content */}
              {activeTab === "wallet" && (
                <div className="space-y-3">
                  {/* KNYT Balance Summary - Primary for initial release */}
                  <section className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-amber-300">
                          {knytBalance?.totalKnyt?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'} <span className="text-amber-400 text-lg">KNYT</span>
                        </div>
                        <div className="text-xs text-white/50 mt-0.5">≈ ${((knytBalance?.totalKnyt || 0) * knytPriceUsd).toFixed(2)} USD</div>
                      </div>
                      <div className="text-right">
                        <button onClick={() => setBuyKnytModalOpen(true)} className="px-2 py-1 text-[10px] bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/30">Buy</button>
                      </div>
                    </div>
                    
                    {/* Transaction Actions */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
                      <button
                        onClick={() => openTransactionModal('send')}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Send
                      </button>
                      <button
                        onClick={() => openTransactionModal('receive')}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium transition-colors"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        Receive
                      </button>
                    </div>
                  </section>

                  {/* Payment Requests Panel */}
                  <PaymentRequestsPanel
                    agentId={agent?.id || ''}
                    fioHandle={agent?.fioHandle}
                    walletAddress={walletNode?.addresses?.evm}
                    onPaymentExecuted={(txHash, requestId) => {
                      console.log(`Payment executed: ${txHash} for request ${requestId}`);
                      // Refresh balances after payment
                      fetchLiveBalances();
                    }}
                  />

                  {/* Balances - KNYT, USDC, Base Q¢ */}
                  <section className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] uppercase tracking-wider text-white/50">Balances</div>
                      {isLoadingBalances ? (
                        <div className="text-[10px] text-amber-400 flex items-center gap-1 animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        </div>
                      ) : (
                        <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Live
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {/* KNYT (DVN) - Spendable */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <span className="flex items-center gap-2 text-xs">
                          <Award className="w-4 h-4 text-amber-400" />
                          <span className="text-amber-300">KNYT (DVN)</span>
                          <span className="text-[9px] text-emerald-400 bg-emerald-500/20 px-1 rounded">Spendable</span>
                        </span>
                        <span className="font-mono text-xs text-amber-300">{knytBalance?.dvnKnyt?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</span>
                      </div>
                      {/* KNYT (EVM) - On-chain */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <span className="flex items-center gap-2 text-xs">
                          <Award className="w-4 h-4 text-amber-400/60" />
                          <span className="text-amber-300/60">KNYT (EVM)</span>
                          <span className="text-[9px] text-white/40 bg-white/10 px-1 rounded">On-chain</span>
                        </span>
                        <span className="font-mono text-xs text-amber-300/60">{knytBalance?.evmKnyt?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</span>
                      </div>
                      {/* USDC */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                        <span className="flex items-center gap-2 text-xs">
                          <CircleDollarSign className="w-4 h-4 text-green-400" />
                          <span className="text-green-300">USDC</span>
                        </span>
                        <span className="font-mono text-xs text-green-300">
                          {balances.usdcSep ? (Number(balances.usdcSep) / Math.pow(10, balances.usdcSepDecimals || 6)).toFixed(2) : '0.00'}
                        </span>
                      </div>
                      {/* Base Q¢ */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <span className="flex items-center gap-2 text-xs">
                          <Coins className="w-4 h-4 text-cyan-400" />
                          <span className="text-cyan-300">Base Q¢</span>
                        </span>
                        <span className="font-mono text-xs text-cyan-300">
                          {balances.qctBase ? (Number(balances.qctBase) / Math.pow(10, balances.qctBaseDecimals || 18)).toFixed(2) : '0.00'}
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* USDC → Q¢ Conversion */}
                  <section className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-300 mb-2">Convert USDC → Q¢</div>
                    <div className="text-[10px] text-white/50 mb-2">1 USDC = 99 Q¢ (1% fee)</div>
                    <div className="flex gap-2">
                      <input type="number" value={convertUsdcAmount} onChange={(e) => setConvertUsdcAmount(e.target.value)} placeholder="USDC" className="flex-1 px-2 py-1.5 text-xs rounded bg-black/40 ring-1 ring-white/10 text-white [&::-webkit-outer-spin-button]:opacity-100 [&::-webkit-inner-spin-button]:opacity-100 accent-white"/>
                      <button onClick={handleConvertUsdcToQc} disabled={convertStep==='processing'||!convertUsdcAmount} className="px-3 py-1.5 text-xs rounded bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50">{convertStep==='processing'?'...':'Convert'}</button>
                    </div>
                    {convertStep==='success'&&<div className="text-xs text-emerald-300 mt-2">✓ Credited {convertResult?.qcCredited?.toFixed(2)} Q¢</div>}
                    {convertStep==='error'&&<div className="text-xs text-red-300 mt-2">{convertError}</div>}
                  </section>

                  {/* x402 Wallet ID - FIO DID (universal identifier for all chains) */}
                  <section className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-white/50">x402 Wallet ID</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[10px] text-white/60 truncate max-w-[140px]" title={fioDid || undefined}>{fioDid ? `${fioDid.slice(0, 12)}...${fioDid.slice(-8)}` : '—'}</span>
                        <button onClick={() => fioDid && navigator.clipboard.writeText(fioDid)} className="p-1 hover:bg-white/10 rounded" disabled={!fioDid}><Copy className="w-3 h-3 text-white/50 hover:text-white"/></button>
                      </div>
                    </div>
                  </section>

                  {/* Pending Rewards */}
                  {walletNode?.balances?.pendingRewards != null && walletNode.balances.pendingRewards > 0 && (
                    <section className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
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

                  {/* DVN Events - Narrow */}
                  <section className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2 flex items-center gap-1"><Zap className="w-3 h-3 text-purple-400"/>DVN Events</div>
                    {dvnEvents.slice(0,2).map((e,i)=><div key={i} className="flex justify-between text-[11px] p-1 bg-white/5 rounded mb-1"><span className={e.event==='PaymentConfirmed'?'text-emerald-300':'text-amber-300'}>{e.event}</span><span className="text-white/40">{e.chain}</span></div>)}
                    {!dvnEvents.length&&<div className="text-[11px] text-white/40">No events</div>}
                  </section>

                  {/* Persona Identity - Narrow */}
                  <section className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1"><BadgeCheck className="w-3 h-3 text-purple-400"/>Persona Identity</span>
                      <span className="px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20 text-cyan-300 font-mono text-[10px]">{agent.fioHandle||'—'}</span>
                    </div>
                    <div className="flex gap-2 text-[10px] mb-1"><span className="px-1 py-0.5 bg-purple-500/10 rounded">Custody: {custodyCount}</span><span className="px-1 py-0.5 bg-cyan-500/10 text-cyan-300 rounded">Claims: {claimCount}</span></div>
                    <div className="mt-2"><AliasConsentToggle consented={aliasConsent} onChange={setAliasConsent}/></div>
                  </section>

                  {/* x402 Settlement - Narrow */}
                  <section className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2 flex items-center gap-1"><RefreshCw className="w-3 h-3 text-purple-400"/>x402 Settlement</div>
                    <div className="space-y-2">
                      <input
                        value={retrySettlementId}
                        onChange={(e) => setRetrySettlementId(e.target.value)}
                        placeholder="Settlement ID (optional)"
                        className="w-full px-2 py-1 text-[11px] rounded bg-black/40 ring-1 ring-white/10 text-white/90 placeholder:text-white/40"
                      />
                      <input
                        value={retryMessageId}
                        onChange={(e) => setRetryMessageId(e.target.value)}
                        placeholder="Message ID (optional)"
                        className="w-full px-2 py-1 text-[11px] rounded bg-black/40 ring-1 ring-white/10 text-white/90 placeholder:text-white/40"
                      />
                      <SettlementRetryButton settlementId={retrySettlementId || undefined} messageId={retryMessageId || undefined} />
                    </div>
                  </section>
                </div>
              )}

              {/* Library Tab Content */}
              {activeTab === "library" && (
                <div className="space-y-3">
                  {/* Poster view for selected item */}
                  {selectedLibraryItem && (
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <button onClick={() => setSelectedLibraryItem(null)} className="text-xs text-white/50 mb-2">← Back</button>
                      <div className="aspect-[3/4] w-32 mx-auto rounded-lg overflow-hidden bg-black/40 mb-2 relative">
                        {selectedLibraryItem.coverCid ? (
                          <img 
                            src={`/api/content/cover/${selectedLibraryItem.coverCid}?variant=thumb`}
                            alt={selectedLibraryItem.contentTitle}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-full h-full flex items-center justify-center ${selectedLibraryItem.coverCid ? 'hidden' : ''}`}>
                          {isMotionContent(selectedLibraryItem) ? (
                            <Film className="w-12 h-12 text-purple-400/50" />
                          ) : (
                            <Book className="w-12 h-12 text-purple-400/50" />
                          )}
                        </div>
                        {/* Rarity knight icon - bottom left */}
                        {getRarityIcon((selectedLibraryItem as any).coverType) && (
                          <Tooltip text={getRarityTooltip((selectedLibraryItem as any).coverType)}>
                            <img 
                              src={getRarityIcon((selectedLibraryItem as any).coverType)!} 
                              alt="rarity" 
                              className="absolute bottom-1 left-1 w-6 h-6 object-contain drop-shadow-lg cursor-help"
                            />
                          </Tooltip>
                        )}
                        {/* Motion/Still indicator - top right */}
                        <Tooltip text={isMotionContent(selectedLibraryItem) ? 'Motion Comic' : 'Digital Still'}>
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
                    </div>
                  )}
                  {/* Grid of thumbnails */}
                  {!selectedLibraryItem && walletNode?.contentEntitlements?.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {walletNode.contentEntitlements.map((ent) => {
                        console.log('[Wallet] Rendering library item:', ent.id, ent.title);
                        return (
                        <div key={ent.id} onClick={() => setSelectedLibraryItem(ent)} className="cursor-pointer group">
                          <div className="aspect-[3/4] rounded-lg overflow-hidden bg-purple-500/10 border border-white/10 group-hover:border-purple-500/50 relative">
                            {ent.coverCid ? (
                              <img 
                                src={`/api/content/cover/${ent.coverCid}?variant=thumb`}
                                alt={ent.contentTitle}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-white/40 text-xs">No Cover</span>
                              </div>
                            )}
                            {/* Motion/Still indicator - top right */}
                            <Tooltip text={isMotionContent(ent) ? 'Motion Comic' : 'Digital Still'}>
                              <div className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/50 cursor-help">
                                {isMotionContent(ent) ? (
                                  <Film className="w-2.5 h-2.5 text-cyan-400" />
                                ) : (
                                  <Book className="w-2.5 h-2.5 text-amber-400" />
                                )}
                              </div>
                            </Tooltip>
                          </div>
                          <div className="text-[10px] text-white/70 truncate mt-1">{ent.contentTitle}</div>
                        </div>
                        );
                      })}
                    </div>
                  ) : !selectedLibraryItem && (
                    <div className="text-center py-6 text-white/50 text-sm">
                      <BookOpen className="w-8 h-8 mx-auto mb-2 text-purple-400/50" />
                      No content yet.
                    </div>
                  )}
                </div>
              )}

              {/* Tasks Tab Content - Phase 1 Hero Tasks */}
              {activeTab === "tasks" && (
                <div className="space-y-3">
                  {/* Hero Task: Bring a Knight (Referral) */}
                  <section className="rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 p-2.5">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-medium text-cyan-300">Bring a Knight</span>
                      <span className="ml-auto text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">+2 KNYT</span>
                    </div>
                    <p className="text-[10px] text-white/50 mb-2">Invite friends to join. Earn 2 KNYT when they make their first purchase!</p>
                    <button className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-cyan-500/20 text-cyan-300 text-xs hover:bg-cyan-500/30">
                      <Share2 className="w-3 h-3" />
                      Share Invite Link
                    </button>
                  </section>

                  {/* Hero Task: Knight of Attention (Engagement) */}
                  <section className="rounded-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 border border-purple-500/20 p-2.5">
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span className="text-xs font-medium text-purple-300">Knight of Attention</span>
                      <span className="ml-auto text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">+0.5 KNYT</span>
                    </div>
                    <p className="text-[10px] text-white/50 mb-2">Complete episodes to earn rewards. Build streaks for bonus KNYT!</p>
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <span>Episodes: 0/2 this week</span>
                      <span className="text-white/20">|</span>
                      <span>Streak: 0 weeks</span>
                    </div>
                  </section>

                  {/* Hero Task: Herald of the Order (Social) */}
                  <section className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-2.5">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-medium text-amber-300">Herald of the Order</span>
                      <span className="ml-auto text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">+0.25 KNYT</span>
                    </div>
                    <p className="text-[10px] text-white/50 mb-2">Share content and earn when others click, sign up, or purchase!</p>
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <span>Clicks: 0/10</span>
                      <span className="text-white/20">|</span>
                      <span>Signups: 0/3</span>
                    </div>
                  </section>

                  {/* Active Tasks from props */}
                  {tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length > 0 && (
                    <section className="rounded-xl bg-white/5 border border-white/10 p-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Active Tasks</div>
                      <div className="space-y-2">
                        {tasks
                          .filter((t) => t.status === "pending" || t.status === "in_progress")
                          .map((task) => (
                            <div key={task.id} className="rounded-lg bg-white/5 p-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-white/90">{task.label}</div>
                                  <div className="text-[10px] text-white/50 mt-0.5 line-clamp-2">{task.description}</div>
                                </div>
                                {task.rewardPreview && (
                                  <span className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                                    <Coins className="w-3 h-3" />
                                    +{task.rewardPreview.amount}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {/* Reputation Tab Content */}
              {activeTab === "reputation" && (
                <div className="space-y-3">
                  {/* Score Card */}
                  <section className="rounded-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 border border-purple-500/20 p-4 text-center">
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
                  </section>

                  {/* Badges */}
                  <section className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Badges</div>
                    {walletNode?.personaContext?.activePersona?.badges?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {walletNode.personaContext.activePersona.badges.map((badge, idx) => (
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
                </div>
              )}

              {/* Rewards Tab Content - Phase 1 KNYT Rewards */}
              {activeTab === "rewards" && (
                <div className="space-y-3">
                  {/* KNYT Balance & Rewards */}
                  <section className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-amber-300/70 mb-2">KNYT Balance</div>
                    <div className="text-2xl font-bold text-amber-300">
                      {knytBalance?.totalKnyt?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'} <span className="text-amber-400 text-lg">KNYT</span>
                    </div>
                    <div className="text-xs text-white/50 mt-1">≈ ${((knytBalance?.totalKnyt || 0) * 1.40).toFixed(2)} USD</div>
                    <button onClick={() => setBuyKnytModalOpen(true)} className="mt-2 w-full px-3 py-1.5 text-xs bg-amber-500/20 text-amber-300 rounded-lg hover:bg-amber-500/30 transition-colors">Buy KNYT</button>
                  </section>

                  {/* Reputation Tier & Multiplier */}
                  <section className="rounded-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 border border-purple-500/20 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] uppercase tracking-wider text-purple-300/70">Order Tier</div>
                      <div className="flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-medium text-amber-300">
                          {walletNode?.personaContext?.activePersona?.orderTier || 'Knight'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/50">Reward Multiplier</span>
                      <span className="text-sm font-bold text-emerald-300">
                        ×{rewards?.reputationMultiplier?.toFixed(2) || '1.00'}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/40 mt-2">Higher tiers earn more KNYT per task!</p>
                  </section>

                  {/* Recent KNYT Rewards */}
                  <section className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Recent KNYT Rewards</div>
                    {rewards && rewards.recentRewards.length > 0 ? (
                      <div className="space-y-1.5">
                        {rewards.recentRewards.slice(0, 5).map((reward, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                            <span className="text-xs text-white/80">{reward.reason}</span>
                            <span className="flex items-center gap-1 text-xs font-medium text-emerald-300">
                              <Coins className="w-3 h-3" />
                              +{reward.amount} KNYT
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-white/40 text-center py-2">
                        <Gift className="w-6 h-6 mx-auto mb-1 text-purple-400/50" />
                        Complete tasks to earn KNYT!
                      </div>
                    )}
                  </section>

                  {/* Lifetime Stats */}
                  <section className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Lifetime Earned</div>
                    <div className="text-xl font-bold text-emerald-300">
                      {rewards?.totalEarned?.amount?.toFixed(2) || '0.00'} <span className="text-emerald-400 text-sm">KNYT</span>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Wallet Tab */}
          {activeTab === "wallet" && (
            <div className="space-y-4">
              {/* Balances */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60">
                    <Coins className="w-3.5 h-3.5 text-purple-400" />
                    Balances
                  </div>
                  {isLoadingBalances ? (
                    <div className="text-[10px] text-amber-400 flex items-center gap-1 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Fetching...
                    </div>
                  ) : (
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Live
                    </div>
                  )}
                </div>
                
                <ul className="space-y-1.5 text-sm text-white/90">
                  {/* KNYT (DVN) - Spendable */}
                  <li className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span className="text-amber-300">KNYT (DVN)</span>
                      <span className="text-[9px] text-emerald-400 bg-emerald-500/20 px-1 rounded">Spendable</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-300">{knytBalance?.dvnKnyt?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</span>
                      <button onClick={() => setBuyKnytModalOpen(true)} className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/30">Buy</button>
                    </div>
                  </li>
                  {/* KNYT (EVM) - On-chain */}
                  <li className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <span className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400/60" />
                      <span className="text-amber-300/60">KNYT (EVM)</span>
                      <span className="text-[9px] text-white/40 bg-white/10 px-1 rounded">On-chain</span>
                    </span>
                    <span className="font-mono text-amber-300/60">{knytBalance?.evmKnyt?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</span>
                  </li>
                  {/* USDC Balance */}
                  <li className="flex items-center justify-between p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <span className="flex items-center gap-2">
                      <CircleDollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-green-300">USDC</span>
                    </span>
                    <span className="font-mono text-green-300">
                      {balances.usdcSep ? (Number(balances.usdcSep) / Math.pow(10, balances.usdcSepDecimals || 6)).toFixed(2) : '0.00'}
                    </span>
                  </li>
                  {/* Base Q¢ Balance */}
                  <li className="flex items-center justify-between p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <span className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-cyan-400" />
                      <span className="text-cyan-300">Base Q¢</span>
                    </span>
                    <span className="font-mono text-cyan-300">
                      {balances.qctBase ? (Number(balances.qctBase) / Math.pow(10, balances.qctBaseDecimals || 18)).toFixed(2) : '0.00'}
                    </span>
                  </li>
                </ul>
                
                {/* x402 Wallet ID - FIO DID (universal identifier for all chains) */}
                <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-white/50">x402 Wallet ID</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[10px] text-white/60 truncate max-w-[140px]" title={fioDid || undefined}>{fioDid ? `${fioDid.slice(0, 12)}...${fioDid.slice(-8)}` : '—'}</span>
                    <button onClick={() => fioDid && navigator.clipboard.writeText(fioDid)} title="Copy DID" className="p-1 hover:bg-white/10 rounded" disabled={!fioDid}><Copy className="w-3 h-3 text-white/50 hover:text-white"/></button>
                  </div>
                </div>
                
                {/* Transaction Actions */}
                <div className="flex gap-2 mt-3 pt-2 border-t border-white/10">
                  <button
                    onClick={() => openTransactionModal('send')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </button>
                  <button
                    onClick={() => openTransactionModal('receive')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium transition-colors"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Receive
                  </button>
                </div>
                
                {/* Hidden: Q¢ Chain Breakdown - will unhide after mainnet deployment
                {walletNode?.balances?.assets && walletNode.balances.assets.filter(a => a.asset === 'QCT').length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <button onClick={()=>setQcChainCollapsed(!qcChainCollapsed)} className="flex items-center gap-1 text-[10px] text-white/40 mb-1 hover:text-white/60"><ChevronDown className={`w-3 h-3 transition-transform ${qcChainCollapsed?'-rotate-90':''}`}/>Q¢ by Chain {qcChainCollapsed && <span className="ml-1 text-cyan-400">{(walletNode?.balances?.totalQc||0).toFixed(1)}</span>}</button>
                    {!qcChainCollapsed && <div className="grid grid-cols-2 gap-1 text-[10px]">
                      {walletNode.balances.assets
                        .filter(a => a.asset === 'QCT')
                        .slice(0, 7)
                        .map((asset, idx) => {
                          const ticker = asset.chainName?.includes('Arbitrum') ? 'ARB' :
                                         asset.chainName?.includes('Base') ? 'BASE' :
                                         asset.chainName?.includes('Optimism') ? 'OPT' :
                                         asset.chainName?.includes('Polygon') ? 'MATIC' :
                                         asset.chainName?.includes('Ethereum') ? 'ETH' :
                                         asset.chainName?.includes('Bitcoin') ? 'BTC' :
                                         asset.chainName?.includes('Solana') ? 'SOL' : 'QCT';
                          const balance = parseFloat(asset.formattedBalance || '0');
                          return (
                            <div key={idx} className="flex justify-between text-white/50">
                              <span>{ticker} Q¢</span>
                              <span className="font-mono">{balance.toFixed(1)}</span>
                            </div>
                          );
                        })}
                    </div>}
                  </div>
                )}
                */}
              </section>

              {/* USDC → Q¢ Conversion */}
              <section className="rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 p-3">
                <div className="text-[11px] uppercase tracking-wider text-emerald-300 mb-2">Convert USDC → Q¢</div>
                <div className="text-[10px] text-white/50 mb-2">1 USDC = 99 Q¢ (1% fee)</div>
                <div className="flex gap-2">
                  <input type="number" value={convertUsdcAmount} onChange={(e) => setConvertUsdcAmount(e.target.value)} placeholder="USDC" className="flex-1 px-2 py-1.5 text-xs rounded bg-black/40 ring-1 ring-white/10 text-white [&::-webkit-outer-spin-button]:opacity-100 [&::-webkit-inner-spin-button]:opacity-100 accent-white"/>
                  <button onClick={handleConvertUsdcToQc} disabled={convertStep==='processing'||!convertUsdcAmount} className="px-3 py-1.5 text-xs rounded bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50">{convertStep==='processing'?'...':'Convert'}</button>
                </div>
                {convertStep==='success'&&<div className="text-xs text-emerald-300 mt-2">✓ Credited {convertResult?.qcCredited?.toFixed(2)} Q¢</div>}
                {convertStep==='error'&&<div className="text-xs text-red-300 mt-2">{convertError}</div>}
              </section>

              {/* DVN Events */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60 mb-2">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  Recent DVN Events
                </div>
                <div className="space-y-2">
                  {dvnEvents.slice(0, 3).map((e, i) => {
                    const statusColor = e.event === 'PaymentConfirmed' ? 'text-emerald-300' : e.event === 'PaymentFailed' ? 'text-red-300' : 'text-amber-300';
                    const StatusIcon = e.event === 'PaymentConfirmed' ? Check : e.event === 'PaymentFailed' ? X : Clock;
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
                  {dvnEvents.length === 0 && <div className="text-xs text-white/50">No events yet.</div>}
                </div>
              </section>

              {/* Persona Identity */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-white/60 mb-2">
                  <span className="flex items-center gap-2">
                    <BadgeCheck className="w-3.5 h-3.5 text-purple-400" />
                    Persona Identity
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20 text-cyan-300 font-mono text-[10px] normal-case">{agent.fioHandle || '—'}</span>
                </div>
                <div className="flex items-center gap-2 mb-2 text-[11px]">
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-white/80 ring-1 ring-purple-500/20">
                    <Wallet className="w-3 h-3" />
                    Custody: {custodyCount}
                  </span>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20">
                    <Award className="w-3 h-3" />
                    Claims: {claimCount}
                  </span>
                </div>
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
              {selectedLibraryItem ? (
                <section className="rounded-2xl bg-purple-500/10 ring-1 ring-purple-500/20 p-4">
                  <button onClick={() => setSelectedLibraryItem(null)} className="text-xs text-white/50 mb-3">← Back</button>
                  <div className="aspect-[3/4] w-40 mx-auto rounded-xl overflow-hidden bg-black/40 mb-3 relative">
                    {selectedLibraryItem.coverCid && (
                      <img 
                        src={`/api/content/cover/${selectedLibraryItem.coverCid}?variant=thumb`}
                        alt={selectedLibraryItem.contentTitle}
                        className="w-full h-full object-cover absolute inset-0"
                      />
                    )}
                    {!selectedLibraryItem.coverCid && (
                      <div className="w-full h-full flex items-center justify-center">
                        {isMotionContent(selectedLibraryItem) ? (
                          <Film className="w-16 h-16 text-purple-400/50" />
                        ) : (
                          <Book className="w-16 h-16 text-purple-400/50" />
                        )}
                      </div>
                    )}
                    {/* Rarity knight icon - bottom left */}
                    {getRarityIcon((selectedLibraryItem as any).coverType) && (
                      <Tooltip text={getRarityTooltip((selectedLibraryItem as any).coverType)}>
                        <img 
                          src={getRarityIcon((selectedLibraryItem as any).coverType)!} 
                          alt="rarity" 
                          className="absolute bottom-2 left-2 w-8 h-8 object-contain drop-shadow-lg cursor-help"
                        />
                      </Tooltip>
                    )}
                    {/* Motion/Still indicator - top right */}
                    <Tooltip text={isMotionContent(selectedLibraryItem) ? 'Motion Comic' : 'Digital Still'}>
                      <div className="absolute top-2 right-2 p-1.5 rounded bg-black/50 cursor-help">
                        {isMotionContent(selectedLibraryItem) ? (
                          <Film className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Book className="w-4 h-4 text-amber-400" />
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
                <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-white/60 mb-2">
                    Your Library ({walletNode.contentEntitlements.length})
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {walletNode.contentEntitlements.map((ent) => (
                      <div key={ent.id} onClick={() => setSelectedLibraryItem(ent)} className="cursor-pointer group">
                        <div className="aspect-[3/4] rounded-lg overflow-hidden bg-purple-500/10 ring-1 ring-white/10 group-hover:ring-purple-500/50 relative">
                          {ent.coverCid && <img src={`/api/content/cover/${ent.coverCid}?variant=thumb`} alt="" className="w-full h-full object-cover absolute inset-0"/>}
                          {!ent.coverCid && <div className="w-full h-full flex items-center justify-center">{isMotionContent(ent) ? <Film className="w-8 h-8 text-purple-400/50"/> : <Book className="w-8 h-8 text-purple-400/50"/>}</div>}
                          {/* Rarity knight icon - bottom left */}
                          {getRarityIcon((ent as any).coverType) && (
                            <Tooltip text={getRarityTooltip((ent as any).coverType)}>
                              <img 
                                src={getRarityIcon((ent as any).coverType)!} 
                                alt="rarity" 
                                className="absolute bottom-0.5 left-0.5 w-5 h-5 object-contain drop-shadow-lg cursor-help"
                              />
                            </Tooltip>
                          )}
                          {/* Motion/Still indicator - top right */}
                          <Tooltip text={isMotionContent(ent) ? 'Motion Comic' : 'Digital Still'}>
                            <div className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/50 cursor-help">
                              {isMotionContent(ent) ? (
                                <Film className="w-2.5 h-2.5 text-cyan-400" />
                              ) : (
                                <Book className="w-2.5 h-2.5 text-amber-400" />
                              )}
                            </div>
                          </Tooltip>
                        </div>
                        <div className="text-[10px] text-white/70 truncate mt-1">{ent.contentTitle}</div>
                      </div>
                    ))}
                  </div>
                </section>
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

          {/* Tasks Tab - Phase 1 Hero Tasks */}
          {activeTab === "tasks" && (
            <div className="space-y-4">
              {/* Hero Tasks Grid */}
              <div className="grid grid-cols-1 gap-3">
                {/* Bring a Knight (Referral) */}
                <section className="rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 ring-1 ring-cyan-500/20 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-cyan-300">Bring a Knight</div>
                      <div className="text-xs text-white/50">Referral Program</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-amber-300">+2 KNYT</div>
                      <div className="text-[10px] text-white/40">per referral</div>
                    </div>
                  </div>
                  <p className="text-xs text-white/60 mb-3">Invite friends to join the Order. You earn 2 KNYT when they make their first purchase, and they get 1 KNYT as a welcome bonus!</p>
                  <button 
                    onClick={() => handleInviteClick()}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 text-sm hover:bg-cyan-500/30 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Invite Friends
                  </button>
                </section>

                {/* Knight of Attention (Engagement) */}
                <section className="rounded-2xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 ring-1 ring-purple-500/20 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Flame className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-purple-300">Knight of Attention</div>
                      <div className="text-xs text-white/50">Engagement Rewards</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-amber-300">+0.5 KNYT</div>
                      <div className="text-[10px] text-white/40">per episode</div>
                    </div>
                  </div>
                  <p className="text-xs text-white/60 mb-3">Complete episodes to earn KNYT. Build weekly streaks for bonus rewards - 4 consecutive weeks earns you 2 KNYT bonus!</p>
                  <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-black/20">
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">0/2</div>
                      <div className="text-[10px] text-white/40">Episodes this week</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-400">0</div>
                      <div className="text-[10px] text-white/40">Week streak</div>
                    </div>
                  </div>
                </section>

                {/* Herald of the Order (Social) */}
                <section className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 ring-1 ring-amber-500/20 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-amber-300">Herald of the Order</div>
                      <div className="text-xs text-white/50">Social Sharing</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-amber-300">+0.25-2 KNYT</div>
                      <div className="text-[10px] text-white/40">per milestone</div>
                    </div>
                  </div>
                  <p className="text-xs text-white/60 mb-3">Share content and earn when others engage! Clicks, signups, and conversions all earn you KNYT.</p>
                  <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-black/20">
                    <div className="text-center">
                      <div className="text-sm font-bold text-white">0/10</div>
                      <div className="text-[10px] text-white/40">Clicks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-white">0/3</div>
                      <div className="text-[10px] text-white/40">Signups</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-white">0/1</div>
                      <div className="text-[10px] text-white/40">Conversions</div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Active Tasks from props */}
              {tasks.filter((t) => t.status === "pending" || t.status === "in_progress").length > 0 && (
                <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-white/60 mb-2">Other Active Tasks</div>
                  <div className="space-y-2">
                    {tasks
                      .filter((t) => t.status === "pending" || t.status === "in_progress")
                      .map((task) => (
                        <div key={task.id} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-sm text-white/90">{task.label}</div>
                              <div className="text-xs text-white/50 mt-0.5">{task.description}</div>
                            </div>
                            {task.rewardPreview && (
                              <span className="flex items-center gap-1 text-xs text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                <Coins className="w-3 h-3" />
                                +{task.rewardPreview.amount}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {/* Quest Progress */}
              {quests.length > 0 && (
                <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-white/60 mb-2">Quest Progress</div>
                  <div className="space-y-2">
                    {quests.map((quest) => (
                      <div key={quest.questId} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2">
                        <div className="flex items-center gap-2 text-sm text-white/90">
                          <Flame className="w-4 h-4 text-orange-400" />
                          {quest.questTitle}
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

              {/* Badges */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-white/60 mb-3">Badges</div>
                {walletNode?.personaContext?.activePersona?.badges?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {walletNode.personaContext.activePersona.badges.map((badge, idx) => (
                      <span key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-500/20 text-white/90 text-xs ring-1 ring-purple-500/30">
                        <Award className="w-3 h-3" />
                        {badge}
                      </span>
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
                <button 
                  onClick={onSubmitReputationClaim}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-white/90 text-sm font-medium ring-1 ring-purple-500/30 hover:bg-purple-500/30 transition-colors"
                >
                  <Award className="w-4 h-4" />
                  Submit Claim
                </button>
              </section>
            </div>
          )}

          {/* Rewards Tab - Phase 1 KNYT Rewards */}
          {activeTab === "rewards" && (
            <div className="space-y-4">
              {/* KNYT Balance Card */}
              <section className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 ring-1 ring-amber-500/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-amber-300/70 mb-1">KNYT Balance</div>
                    <div className="text-3xl font-bold text-amber-300">
                      {knytBalance?.totalKnyt?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}
                    </div>
                    <div className="text-xs text-white/50 mt-1">≈ ${((knytBalance?.totalKnyt || 0) * 1.40).toFixed(2)} USD</div>
                  </div>
                  <button 
                    onClick={() => setBuyKnytModalOpen(true)} 
                    className="px-4 py-2 bg-amber-500/20 text-amber-300 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors"
                  >
                    Buy KNYT
                  </button>
                </div>
              </section>

              {/* Reputation Tier & Multiplier */}
              <section className="rounded-2xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 ring-1 ring-purple-500/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-purple-300/70 mb-1">Order Tier</div>
                    <div className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-amber-400" />
                      <span className="text-lg font-bold text-amber-300">
                        {walletNode?.personaContext?.activePersona?.orderTier || 'Knight'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Reward Multiplier</div>
                    <div className="text-2xl font-bold text-emerald-300">
                      ×{rewards?.reputationMultiplier?.toFixed(2) || '1.00'}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-white/40 mt-3">Higher order tiers earn more KNYT per task. Upgrade by investing or increasing reputation!</p>
              </section>

              {/* Lifetime Stats */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Lifetime Earned</div>
                    <div className="text-xl font-bold text-emerald-300">
                      {rewards?.totalEarned?.amount?.toFixed(2) || '0.00'} <span className="text-emerald-400 text-sm">KNYT</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1">This Month</div>
                    <div className="text-xl font-bold text-cyan-300">
                      {rewards?.earnedThisPeriod?.amount?.toFixed(2) || '0.00'} <span className="text-cyan-400 text-sm">KNYT</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Recent Rewards */}
              <section className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60 mb-3">
                  <Star className="w-3.5 h-3.5 text-amber-400" />
                  Recent KNYT Rewards
                </div>
                {rewards && rewards.recentRewards.length > 0 ? (
                  <div className="space-y-2">
                    {rewards.recentRewards.slice(0, 8).map((reward, idx) => (
                      <div key={idx} className="rounded-lg bg-white/5 ring-1 ring-white/10 p-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm text-white/90">{reward.reason}</span>
                            <div className="text-[10px] text-white/40 mt-0.5">{new Date(reward.earnedAt).toLocaleDateString()}</div>
                          </div>
                          <span className="flex items-center gap-1 text-sm font-medium text-emerald-300">
                            <Coins className="w-3.5 h-3.5" />
                            +{reward.amount} KNYT
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-white/50 text-sm">
                    <Gift className="w-8 h-8 mx-auto mb-2 text-purple-400/50" />
                    No rewards yet
                    <p className="text-xs text-white/30 mt-1">Complete tasks to earn KNYT!</p>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
      
      {/* Add Persona Modal */}
      <AddPersonaModal
        isOpen={addPersonaModalOpen}
        onClose={() => setAddPersonaModalOpen(false)}
        onPersonaCreated={handlePersonaCreated}
      />
      
      {/* Transaction Modal */}
      <TransactionModal
        isOpen={transactionModalOpen}
        onClose={() => setTransactionModalOpen(false)}
        initialTab={transactionTab}
        walletAddress={agent.walletAddress || agent.evmArb || agent.evmSepolia}
        personaId={personaId}
        agentId={agent.id}
        fioHandle={agent.fioHandle}
        prefillRecipient={prefillRecipient}
        prefillAmount={prefillAmount}
        prefillTxHash={prefillTxHash}
        onTransactionComplete={handleTransactionComplete}
        onRequestCreated={handleRequestCreated}
      />
      
      {/* Buy KNYT Modal */}
      <BuyKnytModal
        open={buyKnytModalOpen}
        onClose={() => setBuyKnytModalOpen(false)}
        personaId={personaId || ''}
        onPurchaseComplete={(knytAmount, newBalance) => {
          refetchKnyt();
          setCopilotMessages(prev => [...prev, {
            role: 'assistant',
            content: `🎉 You purchased ${knytAmount} KNYT! New balance: ${newBalance} KNYT`
          }]);
        }}
      />
      
      {/* Persona Setup Wizard */}
      {personaSetupWizardOpen && (
        <PersonaSetupWizard
          onComplete={(newPersonaId) => {
            setPersonaSetupWizardOpen(false);
            onPersonaChange?.(newPersonaId);
            setCopilotMessages(prev => [...prev, {
              role: 'assistant',
              content: '🎉 Your new persona has been created! Welcome to the ecosystem.'
            }]);
          }}
          onCancel={() => setPersonaSetupWizardOpen(false)}
        />
      )}
      
      {/* Persona Edit Modal */}
      {editingPersona && (
        <PersonaEditModal
          isOpen={personaEditModalOpen}
          onClose={() => {
            setPersonaEditModalOpen(false);
            setEditingPersona(null);
          }}
          persona={editingPersona}
          onSave={(updated) => {
            setPersonaEditModalOpen(false);
            setEditingPersona(null);
            // Refresh KNYT balance after persona update (in case EVM address changed)
            if (refetchKnyt) {
              setTimeout(() => refetchKnyt(), 500);
            }
            setCopilotMessages(prev => [...prev, {
              role: 'assistant',
              content: `✅ Persona "${updated.displayName}" has been updated.${updated.evmAddress ? ' KNYT balance refreshing...' : ''}`
            }]);
          }}
        />
      )}
      
      {/* Unlock Modal */}
      <UnlockModal
        isOpen={unlockModalOpen}
        onClose={() => setUnlockModalOpen(false)}
        personaId={personaId || ''}
        personaName={walletNode?.personaContext?.activePersona?.displayName || agent.name}
        onUnlockSuccess={() => {
          setIsWalletUnlocked(true);
          setUnlockModalOpen(false);
          setCopilotMessages(prev => [...prev, {
            role: 'assistant',
            content: '🔓 Wallet unlocked! You can now make transactions.'
          }]);
        }}
      />
    </>
  );

  if (variant === 'embedded') {
    return drawerPanel;
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {drawerPanel}
    </div>
  );
}
