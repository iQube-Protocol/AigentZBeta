/**
 * CodexEmbed - Self-contained Codex panel for embedding
 * 
 * Renders the Codex UI as a panel that fills its container.
 * Designed to be embedded in iframes, drawers, or other host containers.
 * Route: /triad/embed/codex?tab=scrolls|characters|lore|digiterra|terra|order
 */

import React, { useState, useEffect } from 'react';
import { EmbedLayout } from './EmbedLayout';
import { CodexMainLayer } from '@/components/codex/CodexMainLayer';
import { supabase } from '@/integrations/supabase/client';

type CodexTab = 'codex' | 'scrolls' | 'characters' | 'lore' | 'digiterra' | 'terra' | 'order';

export default function CodexEmbed() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CodexTab>('scrolls');

  useEffect(() => {
    // Get tab from URL params
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as CodexTab;
    if (tab) setActiveTab(tab);

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

  if (loading) {
    return (
      <EmbedLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-white/50">Loading codex...</div>
        </div>
      </EmbedLayout>
    );
  }

  return (
    <EmbedLayout>
      <CodexMainLayer
        activeTab={activeTab}
        onTabChange={setActiveTab}
        personaId={user?.id}
        knytBalance={0}
        spendableKnyt={0}
      />
    </EmbedLayout>
  );
}
