/**
 * CodexMainLayer - Full-screen content stage for the Codex
 * 
 * This is the background layer that displays content orchestrated by the copilot.
 * Liquid UI templates are available but disabled by default to preserve legacy behavior.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCodexCopilot } from '@/contexts/CodexCopilotContext';
import { KnytCodexTab } from '@/components/content/KnytCodexTab';
import { Library, Sparkles, BookOpen, Play, Users, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ENABLE_LIQUID_UI = false;

type CodexTab = 'codex' | 'scrolls' | 'characters' | 'lore' | 'digiterra' | 'terra' | 'order';

interface CodexMainLayerProps {
  activeTab?: CodexTab;
  onTabChange?: (tab: CodexTab) => void;
  onMintRequest?: (episodeNumber: number) => void;
  onReadRequest?: (issueId: string) => void;
  onWatchRequest?: (issueId: string) => void;
  personaId?: string;
  knytBalance?: number;
  spendableKnyt?: number;
  onBalanceRefresh?: () => void;
  onDrawerClose?: () => void;
}

export function CodexMainLayer({ 
  activeTab = 'codex',
  onTabChange,
  onMintRequest, 
  onReadRequest, 
  onWatchRequest,
  personaId = '',
  knytBalance = 0,
  spendableKnyt,
  onBalanceRefresh,
  onDrawerClose,
}: CodexMainLayerProps) {
  const navigate = useNavigate();
  const { activeCodex, contentInstruction, isFirstVisit } = useCodexCopilot();
  
  // Welcome screen for first-time visitors
  const renderWelcome = () => (
    <div className="h-full flex flex-col items-center justify-center text-center px-8">
      <div className="max-w-2xl">
        <div className="w-24 h-24 mx-auto mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-full animate-pulse" />
          <div className="absolute inset-2 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full flex items-center justify-center">
            {activeCodex === 'knyt' ? (
              <BookOpen className="w-10 h-10 text-cyan-400" />
            ) : (
              <Sparkles className="w-10 h-10 text-purple-400" />
            )}
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-4">
          {activeCodex === 'knyt' 
            ? 'Welcome to the KNYT Codex'
            : 'Welcome to the Qriptopian Codex'
          }
        </h1>
        
        <p className="text-lg text-gray-300 mb-8">
          {activeCodex === 'knyt'
            ? 'Explore the metaKnyts universe through digital scrolls, limited edition covers, and exclusive content. Collect, read, and own pieces of the story.'
            : 'Discover the lore of the Quantum-Ready Internet. Character profiles, world-building documents, and interactive experiences await.'
          }
        </p>
        
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <Library className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <p className="text-sm text-white/80">Digital Scrolls</p>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <Play className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <p className="text-sm text-white/80">Motion Comics</p>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <Users className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-white/80">Collectibles</p>
          </div>
        </div>
        
        <div className="bg-white/5 rounded-xl border border-white/10 p-6 mb-8">
          <p className="text-gray-300 mb-4">
            To access the Codex, you'll need to create a persona and sign in. Your persona is your identity in the Qriptopian universe.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button 
              onClick={() => navigate('/auth?mode=signin')}
              variant="outline"
              className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
            <Button 
              onClick={() => navigate('/auth?mode=signup')}
              className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Create Persona
            </Button>
          </div>
        </div>
        
        <p className="text-sm text-gray-500">
          Hover in the bottom-right corner to open the Codex Copilot for personalized guidance.
        </p>
      </div>
    </div>
  );
  
  // Grid view - episode/content grid
  const renderGrid = () => {
    if (activeCodex === 'knyt') {
      // Always use legacy KnytCodexTab - Liquid UI disabled until fully tested
      // ENABLE_LIQUID_UI flag reserved for future use
      return (
        <div className="h-full overflow-auto p-6">
          <KnytCodexTab
            viewMode="grid"
            activeTab={activeTab}
            onTabChange={onTabChange}
            onMintRequest={onMintRequest}
            onReadRequest={onReadRequest}
            onWatchRequest={onWatchRequest}
            personaId={personaId}
            knytBalance={knytBalance}
            spendableKnyt={spendableKnyt}
            onBalanceRefresh={onBalanceRefresh}
            onDrawerClose={onDrawerClose}
          />
        </div>
      );
    }
    
    // Qriptopian grid - coming soon placeholder
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mb-6">
          <Sparkles className="w-10 h-10 text-purple-400" />
        </div>
        <h2 className="text-2xl font-medium text-white mb-3">
          Qriptopian Codex Coming Soon
        </h2>
        <p className="text-gray-400 max-w-md">
          The Qriptopian Codex is being prepared. Check back soon for exclusive content 
          from the Quantum-Ready Internet universe.
        </p>
      </div>
    );
  };
  
  // Render based on content instruction
  const renderContent = () => {
    if (isFirstVisit && contentInstruction.type === 'welcome') {
      return renderWelcome();
    }
    
    switch (contentInstruction.type) {
      case 'welcome':
        return renderWelcome();
      case 'grid':
      default:
        return renderGrid();
    }
  };
  
  return (
    <div className="h-full w-full bg-gradient-to-br from-[#020818] via-[#0a1628] to-[#020818]">
      {renderContent()}
    </div>
  );
}
