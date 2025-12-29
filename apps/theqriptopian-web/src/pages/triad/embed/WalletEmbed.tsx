/**
 * WalletEmbed - Self-contained SmartWallet panel for embedding
 * 
 * Renders the SmartWallet UI as a panel that fills its container.
 * Designed to be embedded in iframes, drawers, or other host containers.
 * Route: /triad/embed/wallet
 */

import React, { useState, useEffect } from 'react';
import { EmbedLayout } from './EmbedLayout';
import SmartWalletDrawer from '@/components/wallet/SmartWalletDrawer';
import { supabase } from '@/integrations/supabase/client';

export default function WalletEmbed() {
  const [user, setUser] = useState<any>(null);
  const [personaId, setPersonaId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current user session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Mock agent data - in production, fetch from session/context
  const agent = {
    id: user?.id || 'guest',
    name: user?.email?.split('@')[0] || 'Guest',
    fioHandle: user?.user_metadata?.fio_handle,
    walletAddress: user?.user_metadata?.wallet_address,
  };

  if (loading) {
    return (
      <EmbedLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-white/50">Loading wallet...</div>
        </div>
      </EmbedLayout>
    );
  }

  return (
    <EmbedLayout>
      <SmartWalletDrawer
        open={true}
        onClose={() => {}} // No-op in embedded mode
        variant="embedded"
        agent={agent}
        personaId={personaId}
        initialTab="wallet"
      />
    </EmbedLayout>
  );
}
