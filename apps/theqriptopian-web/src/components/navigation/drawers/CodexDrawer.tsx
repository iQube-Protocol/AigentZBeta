/**
 * CodexDrawer - Two-Layer Drawer System for Digital Scrolls & Collectibles
 * 
 * Architecture:
 * - Layer 1 (Background): CodexMainLayer - Full-screen content stage
 * - Layer 2 (Foreground): CodexCopilotLayer - Floating copilot drawer
 */

import { useEffect, useState, useCallback } from "react";
import { CodexCopilotProvider, useCodexCopilot } from "@/contexts/CodexCopilotContext";
import { CodexMainLayer, CodexCopilotLayer } from "@/components/codex";
import { X, Library, Sparkles, BookOpen, Users, Scroll, Gamepad2, Globe, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useKnytBalance } from "@/hooks/useKnytBalance";

interface CodexDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type CodexTab = 'codex' | 'scrolls' | 'characters' | 'lore' | 'digiterra' | 'terra' | 'order';

const TAB_CONFIG: { id: CodexTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'codex', label: 'Codex', icon: Sparkles },
  { id: 'scrolls', label: 'Scrolls', icon: BookOpen },
  { id: 'characters', label: 'Characters', icon: Users },
  { id: 'lore', label: 'Lore', icon: Scroll },
  { id: 'digiterra', label: 'DigiTerra', icon: Gamepad2 },
  { id: 'terra', label: 'Terra', icon: Globe },
  { id: 'order', label: 'Order', icon: Crown },
];

// Inner component that uses the context
function CodexDrawerContent({ isOpen, onClose }: CodexDrawerProps) {
  const { setIsFirstVisit, setContentInstruction } = useCodexCopilot();
  const [activeTab, setActiveTab] = useState<CodexTab>('codex');
  const [personaId, setPersonaId] = useState<string>('');
  
  // Fetch persona ID from current user
  const fetchPersonaId = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('persona_id')
        .eq('id', user.id)
        .single();
      
      if (profile?.persona_id) {
        setPersonaId(profile.persona_id);
      }
    } catch (e) {
      console.error('[CodexDrawer] Error fetching persona:', e);
    }
  }, []);
  
  useEffect(() => {
    if (isOpen) {
      fetchPersonaId();
    }
  }, [isOpen, fetchPersonaId]);
  
  // Get KNYT balance for the persona
  const { balance, refetch: refetchBalance } = useKnytBalance(personaId);
  const knytBalance = balance?.totalKnyt || 0;
  const spendableKnyt = balance?.spendableKnyt || 0;
  
  // Handlers for KNYT Codex actions
  const handleMintRequest = (episodeNumber: number) => {
    console.log('[CodexDrawer] Mint requested for Episode', episodeNumber);
  };

  const handleReadRequest = (issueId: string) => {
    console.log('[CodexDrawer] Read requested for Issue', issueId);
    window.open(`/api/content/issue/${issueId}/stream`, '_blank');
  };

  const handleWatchRequest = (issueId: string) => {
    console.log('[CodexDrawer] Watch requested for Issue', issueId);
  };
  
  // Check if user has visited before
  useEffect(() => {
    if (isOpen) {
      const hasVisited = localStorage.getItem('codex_visited');
      if (hasVisited) {
        setIsFirstVisit(false);
        setContentInstruction({ type: 'grid' });
      } else {
        setIsFirstVisit(true);
        setContentInstruction({ type: 'welcome' });
        localStorage.setItem('codex_visited', 'true');
      }
    }
  }, [isOpen, setIsFirstVisit, setContentInstruction]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Full-screen drawer container */}
      <div className="absolute inset-0 flex flex-col bg-black/30 backdrop-blur-xl ring-1 ring-white/10">
        {/* Header with tabs */}
        <header className="flex items-end justify-between px-6 pt-3 pb-0 bg-white/5 backdrop-blur-2xl flex-shrink-0">
          <div className="flex items-end gap-4 flex-1 min-w-0">
            {/* Logo and title */}
            <div className="flex items-center gap-3 flex-shrink-0 pb-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 ring-1 ring-white/10">
                <Library className="w-5 h-5 text-cyan-400" />
              </div>
              <h1 className="text-lg font-semibold text-white">Codex</h1>
            </div>
            
            {/* Vertical divider */}
            <div className="h-8 w-px bg-white/20 flex-shrink-0 mb-3" />
            
            {/* Tab navigation - aligned to bottom */}
            <div className="flex gap-1 overflow-x-auto flex-1 min-w-0">
              {TAB_CONFIG.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-2 flex items-center gap-1.5 whitespace-nowrap transition-colors text-sm flex-shrink-0 rounded-t-lg border-b-2 ${
                      activeTab === tab.id
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-400'
                        : 'text-white/60 hover:text-white hover:bg-white/5 border-transparent'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 ring-1 ring-white/10 transition-colors flex-shrink-0 ml-4 mb-3"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        {/* Header bottom border */}
        <div className="h-px bg-white/10" />
        
        {/* Main Content Layer */}
        <div className="flex-1 overflow-hidden">
          <CodexMainLayer
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onMintRequest={handleMintRequest}
            onReadRequest={handleReadRequest}
            onWatchRequest={handleWatchRequest}
            personaId={personaId}
            knytBalance={knytBalance}
            spendableKnyt={spendableKnyt}
            onBalanceRefresh={refetchBalance}
          />
        </div>
      </div>
      
      {/* Copilot Layer - floats above main content */}
      <CodexCopilotLayer isDrawerOpen={isOpen} />
    </div>
  );
}

// Wrapper component that provides the context
export function CodexDrawer({ isOpen, onClose }: CodexDrawerProps) {
  return (
    <CodexCopilotProvider>
      <CodexDrawerContent isOpen={isOpen} onClose={onClose} />
    </CodexCopilotProvider>
  );
}
