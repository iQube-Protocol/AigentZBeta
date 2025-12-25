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
import type { SmartWalletNode, WalletTask, ContentEntitlement } from '@/types/smartWallet';
import { createSmartWalletNode } from '@/types/smartWallet';
import { supabase } from '@/integrations/supabase/client';
import { fetchBalances, getWalletAddress, type ChainBalances } from '@/services/balanceService';

interface WalletDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'wallet' | 'library' | 'tasks' | 'reputation' | 'rewards';
  variant?: 'overlay' | 'embedded';
}

interface UserPersona {
  id: string;
  fio_handle: string | null;
  default_identity_state: string;
  world_id_status: string | null;
}

interface SavedPersona {
  id: string;
  name: string;
  fioHandle?: string;
  isAgent: boolean;
}

export function WalletDrawer({ isOpen, onClose, initialTab = 'wallet', variant = 'overlay' }: WalletDrawerProps) {
  const [persona, setPersona] = useState<UserPersona | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [balances, setBalances] = useState<ChainBalances | null>(null);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [savedPersonas, setSavedPersonas] = useState<SavedPersona[]>([]);
  const [entitlements, setEntitlements] = useState<ContentEntitlement[]>([]);
  const [baseQcBalance, setBaseQcBalance] = useState<number>(0);

  // Fetch user's persona and saved list from Supabase
  const fetchPersona = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(true);

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('persona_id, display_name, trading_preferences')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.display_name) {
        setDisplayName(profile.display_name);
      }

      // Load saved personas from preferences
      let currentSaved: SavedPersona[] = [];
      if (profile?.trading_preferences && (profile.trading_preferences as any).saved_personas) {
        currentSaved = (profile.trading_preferences as any).saved_personas;
        setSavedPersonas(currentSaved);
      }

      if (profile?.persona_id) {
        // Get active persona details
        const { data: personaData } = await supabase
          .from('persona')
          .select('id, fio_handle, default_identity_state, world_id_status')
          .eq('id', profile.persona_id)
          .maybeSingle();

        if (personaData) {
          setPersona(personaData);

          // Update saved personas if current is missing (e.g. first load or newly added)
          const isAgent = personaData.world_id_status === 'verified_ai_agent' || personaData.world_id_status === 'agent_declared';
          const personaEntry: SavedPersona = {
            id: personaData.id,
            name: profile.display_name || personaData.fio_handle?.split('@')[0] || 'User',
            fioHandle: personaData.fio_handle || undefined,
            isAgent
          };

          if (!currentSaved.some(p => p.id === personaData.id)) {
            const newSaved = [...currentSaved, personaEntry];
            setSavedPersonas(newSaved);
            
            // Persist to DB
            await supabase.from('profiles').update({
              trading_preferences: {
                ...(profile.trading_preferences as any || {}),
                saved_personas: newSaved
              }
            }).eq('id', user.id);
          }
        }
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
      if (!persona?.fio_handle) {
        setBalances(null);
        return;
      }

      const walletAddress = getWalletAddress(persona.fio_handle);
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
      }
    };

    if (isOpen && persona) {
      loadBalances();
    }
  }, [isOpen, persona?.fio_handle]);

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
        coverCid: e.assetMeta?.autoDriveCid || e.metadata?.contentImage,
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const targetPersona = savedPersonas.find(p => p.id === personaId);
      
      await supabase.from('profiles').update({
        persona_id: personaId,
        display_name: targetPersona?.name || displayName
      }).eq('id', user.id);
      
      await fetchPersona();
    } catch (e) {
      console.error('Error switching persona:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Get wallet address for the persona
  const walletAddress = persona?.fio_handle ? getWalletAddress(persona.fio_handle) : null;

  // Build agent config from real persona or show sign-in prompt
  const agentConfig = persona ? {
    id: persona.id,
    name: displayName || persona.fio_handle?.split('@')[0] || 'User',
    fioHandle: persona.fio_handle || undefined,
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
        displayName: displayName || persona.fio_handle?.split('@')[0] || 'User',
        fioHandle: persona.fio_handle || undefined,
        identifiability: persona.default_identity_state === 'anonymous' ? 'anon' : 'pseudo',
        reputationBucket: 1,
        reputationScore: 0,
        worldIdStatus: persona.world_id_status === 'verified_human' ? 'verified' : 'unverified',
        isAgent: persona.world_id_status === 'verified_ai_agent' || persona.world_id_status === 'agent_declared',
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
    contentEntitlements: entitlements,
    rewardsContext: {
      recentRewards: [],
      totalEarned: { amount: 0, asset: 'QCT' },
      earnedThisPeriod: {
        amount: 0,
        asset: 'QCT',
        periodStart: new Date().toISOString(),
        periodEnd: new Date().toISOString(),
      },
      pendingDistribution: { amount: 0, asset: 'QCT', proposalCount: 0 },
      reputationMultiplier: 1.0,
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
    />
  );
}
