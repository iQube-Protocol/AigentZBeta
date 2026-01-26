/**
 * WalletDrawer - Smart Wallet drawer for The Qriptopian
 * 
 * This is a wrapper around the SmartWalletDrawer component which implements:
 * - x402 protocol for payments (custody, claims)
 * - DIDQube for identity management
 * - RQH (Reputation Qube Hub) integration
 * - Rewards system
 * - Persona management
 * 
 * Now fetches real persona data from Supabase instead of hardcoded demo data.
 */

import { useState, useEffect, useCallback } from 'react';
import { SmartWalletDrawer } from '@/components/wallet';
import type { SmartWalletNode, WalletTask, ContentEntitlement, QuestProgress, RecentReward } from '@/types/smartWallet';
import { createSmartWalletNode } from '@/types/smartWallet';
import { supabase } from '@/integrations/supabase/client';
import { fetchBalances, getWalletAddress, type ChainBalances } from '@/services/balanceService';
import type { CampaignStateView } from '@/types/campaign';
import { getMyWalletPersonas, type WalletPersona } from '@/services/walletApi';

interface WalletDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'wallet' | 'library' | 'tasks' | 'reputation' | 'rewards';
  variant?: 'overlay' | 'embedded';
  embeddedWidth?: 'fill' | 'fixed';
}

interface SavedPersona {
  id: string;
  name: string;
  fioHandle?: string;
  isAgent: boolean;
}

export function WalletDrawer({
  isOpen,
  onClose,
  initialTab = 'wallet',
  variant = 'overlay',
  embeddedWidth = 'fill',
}: WalletDrawerProps) {
  const [persona, setPersona] = useState<WalletPersona | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [balances, setBalances] = useState<ChainBalances | null>(null);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [savedPersonas, setSavedPersonas] = useState<SavedPersona[]>([]);
  const [entitlements, setEntitlements] = useState<ContentEntitlement[]>([]);
  const [baseQcBalance, setBaseQcBalance] = useState<number>(0);
  const [isLoadingWalletData, setIsLoadingWalletData] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignStateView[]>([]);
  const [rewardHistory, setRewardHistory] = useState<RecentReward[]>([]);
  const [totalRewardsEarned, setTotalRewardsEarned] = useState<number>(0);
  const [rewardMultiplier, setRewardMultiplier] = useState<number>(1);

  // Fetch user's personas via API (no direct table access)
  const fetchPersona = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(true);

      const { personas } = await getMyWalletPersonas();
      const activeId =
        localStorage.getItem('currentPersonaId') ||
        sessionStorage.getItem('currentPersonaId') ||
        localStorage.getItem('activePersonaId') ||
        undefined;
      const active = activeId ? personas.find((p) => p.id === activeId) : personas[0];

      setPersona(active || null);
      setDisplayName(active?.displayName || active?.fioHandle?.split('@')[0] || '');

      const saved: SavedPersona[] = (personas || []).map((p) => ({
        id: p.id,
        name: p.displayName || p.fioHandle?.split('@')[0] || 'User',
        fioHandle: p.fioHandle || undefined,
        isAgent: p.worldIdStatus === 'agent_declared',
      }));
      setSavedPersonas(saved);

      if (active?.id) {
        try {
          localStorage.setItem('currentPersonaId', active.id);
          sessionStorage.setItem('currentPersonaId', active.id);
          localStorage.setItem('activePersonaId', active.id);
        } catch {}
      }
    } catch (e) {
      console.error('[WalletDrawer] Error fetching persona:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPersona();
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (isOpen) {
        fetchPersona();
      }
    });

    return () => subscription.unsubscribe();
  }, [isOpen, fetchPersona]);

  // Fetch balances when persona changes
  useEffect(() => {
    const loadBalances = async () => {
      if (!persona?.fioHandle) {
        setBalances(null);
        return;
      }

      setIsLoadingWalletData(true);
      const walletAddress = getWalletAddress(persona.fioHandle);
      if (!walletAddress) {
        // console.log('[WalletDrawer] No wallet address found for:', persona.fio_handle);
        return;
      }

      setIsLoadingBalances(true);
      try {
        const result = await fetchBalances(walletAddress);
        setBalances(result);
      } catch (e) {
        console.error('[WalletDrawer] Error fetching balances:', e);
      } finally {
        setIsLoadingBalances(false);
        setIsLoadingWalletData(false);
      }
    };

    if (isOpen && persona) {
      loadBalances();
    }
  }, [isOpen, persona?.fioHandle]);

  // Fetch Base Q¢ balance when persona changes
  useEffect(() => {
    const loadBaseQc = async () => {
      if (!persona?.id) {
        setBaseQcBalance(0);
        return;
      }

      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiUrl}/api/wallet/base-qc/balance?personaId=${persona.id}`);
        if (response.ok) {
          const data = await response.json();
          setBaseQcBalance(data.balance || 0);
        }
      } catch (e) {
        console.error('[WalletDrawer] Error fetching Base Q¢:', e);
      }
    };

    if (isOpen && persona) {
      loadBaseQc();
    }
  }, [isOpen, persona?.id]);

  useEffect(() => {
    const loadRewards = async () => {
      if (!persona?.id) {
        setRewardHistory([]);
        setTotalRewardsEarned(0);
        setRewardMultiplier(1);
        return;
      }

      try {
        const apiBase = import.meta.env.VITE_AIGENT_API_URL || import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiBase}/api/rewards/history?personaId=${persona.id}`);
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const rewards = Array.isArray(data?.rewards) ? data.rewards : [];

        const mapped: RecentReward[] = rewards.map((reward: any) => ({
          id: reward.id,
          amount: reward.amountKnyt || reward.amount_knyt || 0,
          asset: 'KNYT',
          reason: reward.taskType || reward.task_type || 'Reward',
          questId: reward.sourceEventId || reward.source_event_id || undefined,
          status: 'distributed',
          earnedAt: reward.createdAt || reward.created_at || new Date().toISOString(),
        }));

        setRewardHistory(mapped);
        setTotalRewardsEarned(typeof data?.totalEarned === 'number' ? data.totalEarned : 0);
        setRewardMultiplier(typeof data?.reputationMultiplier === 'number' ? data.reputationMultiplier : 1);
      } catch (error) {
        console.error('[WalletDrawer] Failed to load rewards:', error);
      }
    };

    if (isOpen && persona) {
      loadRewards();
    }
  }, [isOpen, persona?.id]);

  useEffect(() => {
    const loadCampaigns = async () => {
      if (!persona?.id) {
        setCampaigns([]);
        return;
      }

      try {
        const apiBase = import.meta.env.VITE_AIGENT_API_URL || import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiBase}/api/campaigns/state?personaId=${persona.id}`);
        if (!response.ok) {
          setCampaigns([]);
          return;
        }

        const data = await response.json();
        setCampaigns(Array.isArray(data?.campaigns) ? data.campaigns : []);
      } catch (error) {
        console.error('[WalletDrawer] Failed to load campaign state:', error);
        setCampaigns([]);
      }
    };

    if (isOpen && persona) {
      loadCampaigns();
    }
  }, [isOpen, persona?.id]);

  const mapCampaignsToQuests = useCallback((items: CampaignStateView[]): QuestProgress[] => {
    return items.map((campaign) => {
      const completedCount = campaign.completedSteps.length;
      const status = completedCount >= campaign.totalSteps
        ? 'completed'
        : completedCount > 0
          ? 'in_progress'
          : 'not_started';

      return {
        questId: campaign.campaignId,
        questTitle: campaign.title,
        group: campaign.group,
        currentStep: campaign.currentStep,
        totalSteps: campaign.totalSteps,
        completedSteps: campaign.completedSteps,
        status,
        totalReward: { amount: 0, asset: 'KNYT' },
        earnedSoFar: { amount: 0, asset: 'KNYT' },
        phases: campaign.phases,
        counters: campaign.counters,
      };
    });
  }, []);

  // Helper to format asset ID to franchise display name with enriched metadata
  const formatAssetTitle = (assetId: string, metadata?: any, assetMeta?: any): string => {
    // Use character name for character cards
    if (assetMeta?.characterName) {
      return assetMeta.characterName;
    }
    
    if (metadata?.contentTitle) return metadata.contentTitle;
    if (!assetId) return 'Content';
    
    // Extract episode number and convert to franchise numbering (#0, #1, etc.)
    const epMatch = assetId.match(/ep(\d+)/i);
    if (epMatch) {
      const epNum = parseInt(epMatch[1], 10);
      const franchiseNum = epNum - 1; // ep01 = #0, ep02 = #1, etc.
      const isMotion = assetId.toLowerCase().includes('motion') || assetMeta?.isMotion;
      const isStill = assetId.toLowerCase().includes('still');
      const type = isMotion ? 'Motion' : isStill ? 'Still' : 'Scroll';
      return `KNYT ${type} #${franchiseNum}`;
    }
    
    // Fallback: clean up asset ID
    return assetId.replace(/_/g, ' ').replace(/knyt /i, 'KNYT ');
  };

  // Helper to get cover type badge
  const getCoverTypeBadge = (assetMeta?: any): string | null => {
    if (!assetMeta) return null;
    if (assetMeta.coverType) return assetMeta.coverType;
    if (assetMeta.assetKind === 'character_poster') return 'CHARACTER';
    if (assetMeta.assetKind === 'powers_sheet') return 'POWERS';
    return null;
  };

  // Fetch entitlements
  useEffect(() => {
    if (!isOpen || !persona?.id) return;
    const apiBase = import.meta.env.VITE_API_URL || '';
    fetch(`${apiBase}/api/entitlements/list?personaId=${persona.id}`)
      .then(r => r.json())
      .then(d => d.entitlements && setEntitlements(d.entitlements.map((e:any) => ({
        id: e.id,
        contentId: e.assetId || '',
        contentTitle: formatAssetTitle(e.assetId, e.metadata, e.assetMeta),
        scope: (e.tier === 'full' ? 'full' : 'preview') as 'full' | 'preview',
        acquiredVia: 'purchase' as const,
        expiresAt: e.expiresAt,
        acquiredAt: e.createdAt,
        coverType: getCoverTypeBadge(e.assetMeta),
        coverCid: e.assetMeta?.coverCid || e.assetMeta?.autoDriveCid || e.metadata?.contentImage,
        assetId: e.assetId,
        characterName: e.assetMeta?.characterName,
      }))))
      .catch(() => {});
  }, [isOpen, persona?.id]);

  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setPersona(null);
    setIsAuthenticated(false);
    onClose();
  };

  // Handle persona change
  const handlePersonaChange = async (personaId: string) => {
    setIsLoading(true);
    try {
      const selected = personaId ? (await getMyWalletPersonas()).personas.find(p => p.id === personaId) : undefined;
      if (selected) {
        setPersona(selected);
        setDisplayName(selected.displayName || selected.fioHandle?.split('@')[0] || '');
        try {
          localStorage.setItem('currentPersonaId', selected.id);
          sessionStorage.setItem('currentPersonaId', selected.id);
          localStorage.setItem('activePersonaId', selected.id);
        } catch {}
      }
    } catch (e) {
      console.error('Error switching persona:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Get wallet address for the persona
  const walletAddress = persona?.fioHandle ? getWalletAddress(persona.fioHandle) : null;

  // Build agent config from real persona or show sign-in prompt
  const agentConfig = persona ? {
    id: persona.id,
    name: displayName || persona.fioHandle?.split('@')[0] || 'User',
    fioHandle: persona.fioHandle || undefined,
    walletAddress: walletAddress || undefined,
  } : {
    id: 'guest',
    name: 'Guest',
    fioHandle: undefined,
  };

  // Build wallet node with real persona data
  const walletNode: SmartWalletNode = createSmartWalletNode({
    id: persona?.id || 'guest-wallet',
    personaContext: {
      activePersonaId: persona?.id || 'guest',
      activePersona: persona ? {
        id: persona.id,
        displayName: displayName || persona.fioHandle?.split('@')[0] || 'User',
        fioHandle: persona.fioHandle || undefined,
        identifiability: persona.defaultIdentityState === 'anonymous' ? 'anon' : 'pseudo',
        reputationBucket: 1,
        reputationScore: 0,
        worldIdStatus: persona.worldIdStatus === 'verified_human' ? 'verified' : 'unverified',
        isAgent: persona.worldIdStatus === 'agent_declared',
        appOrigin: 'qriptopian',
        badges: [],
      } : undefined,
      availablePersonas: [], // We use the prop now
      switchingAllowed: true,
    },
    balances: {
      totalQc: (balances?.totalQct || 0) + baseQcBalance,
      baseQc: baseQcBalance,
      assets: [
        // QCT across all chains (include all, even with 0 balance)
        ...(balances?.chains || []).map(chain => ({
          asset: 'QCT' as const,
          chainId: chain.chain === 'arbitrum' ? 421614 : 
                   chain.chain === 'base' ? 84532 :
                   chain.chain === 'optimism' ? 11155420 :
                   chain.chain === 'polygon' ? 80002 :
                   chain.chain === 'ethereum' ? 11155111 :
                   chain.chain === 'bitcoin' ? 0 :
                   chain.chain === 'solana' ? 101 : 0,
          chainName: chain.chainName,
          rawBalance: (parseFloat(chain.qct || '0') * 1e18).toString(),
          formattedBalance: parseFloat(chain.qct || '0').toFixed(1),
          decimals: 18,
          usdValue: parseFloat(chain.qct || '0') * 0.01, // 1 QCT = $0.01
          lastUpdated: balances?.lastUpdated || new Date().toISOString(),
        })),
        // USDC total
        {
          asset: 'USDC' as const,
          chainId: 0,
          chainName: 'All Chains',
          rawBalance: ((balances?.totalUsdc || 0) * 1e6).toString(),
          formattedBalance: (balances?.totalUsdc || 0).toFixed(2),
          decimals: 6,
          usdValue: balances?.totalUsdc || 0,
          lastUpdated: balances?.lastUpdated || new Date().toISOString(),
        },
        // KNYT placeholder (mainnet - not yet connected)
        {
          asset: 'KNYT' as const,
          chainId: 1,
          chainName: 'Ethereum Mainnet',
          rawBalance: '0',
          formattedBalance: '0',
          decimals: 18,
          usdValue: 0,
          lastUpdated: new Date().toISOString(),
        },
      ],
      pendingRewards: 0,
      pendingRewardsAsset: 'QCT',
      lastRefreshed: balances?.lastUpdated || new Date().toISOString(),
    },
    tasks: [],
    activeQuests: mapCampaignsToQuests(campaigns),
    contentEntitlements: entitlements,
    rewardsContext: {
      recentRewards: rewardHistory,
      totalEarned: { amount: totalRewardsEarned, asset: 'KNYT' },
      earnedThisPeriod: {
        amount: rewardHistory.reduce((sum, reward) => {
          const earnedAt = new Date(reward.earnedAt).getTime();
          const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
          return earnedAt >= cutoff ? sum + reward.amount : sum;
        }, 0),
        asset: 'KNYT',
        periodStart: new Date().toISOString(),
        periodEnd: new Date().toISOString(),
      },
      pendingDistribution: { amount: 0, asset: 'KNYT', proposalCount: 0 },
      reputationMultiplier: rewardMultiplier,
    },
    connectionStatus: isAuthenticated ? 'connected' : 'disconnected',
  });

  // Handle task actions
  const handleTaskAction = (task: WalletTask, action: 'complete' | 'dismiss') => {
    console.log(`Task ${task.id} ${action}ed`);
  };

  // Handle reputation claim submission
  const handleSubmitReputationClaim = () => {
    console.log('Opening reputation claim form');
  };

  // Handle sign in - redirect to auth page
  const handleSignIn = () => {
    window.location.href = '/auth';
  };

  // If not authenticated, show sign-in prompt in drawer
  if (!isAuthenticated && !isLoading) {
    return (
      <SmartWalletDrawer
        open={isOpen}
        onClose={onClose}
        variant={variant}
        embeddedWidth={embeddedWidth}
        agent={{ id: 'guest', name: 'Sign In Required' }}
        walletNode={walletNode}
        onTaskAction={handleTaskAction}
        onPersonaChange={handlePersonaChange}
        onSubmitReputationClaim={handleSubmitReputationClaim}
        onCreatePersona={handleSignIn}
        initialTab={initialTab}
      />
    );
  }

  return (
    <SmartWalletDrawer
      open={isOpen}
      onClose={onClose}
      variant={variant}
      embeddedWidth={embeddedWidth}
      agent={agentConfig}
      personaId={persona?.id}
      walletNode={walletNode}
      onTaskAction={handleTaskAction}
      onPersonaChange={handlePersonaChange}
      onSubmitReputationClaim={handleSubmitReputationClaim}
      onCreatePersona={fetchPersona}
      initialTab={initialTab}
      availablePersonas={savedPersonas}
      isLoadingBalances={isLoadingBalances}
      isLoadingWalletData={isLoadingWalletData}
    />
  );
}
