/**
 * PersonaSelector - Rich persona dropdown with reputation, lock status
 */
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, User, Star, Check, Lock, Unlock, Bot, Settings } from 'lucide-react';

interface PersonaData {
  id: string;
  fioHandle?: string;
  displayName: string;
  avatarUri?: string;
  reputationScore: number;
  reputationBucket: number;
  evmAddress?: string;
}

interface Props {
  personas: PersonaData[];
  activePersonaId?: string;
  onSelect: (personaId: string) => void;
  onCreateNew?: () => void;
  onEditPersona?: (persona: PersonaData) => void;
  isLoading?: boolean;
  compact?: boolean;
}

export function PersonaSelector({ personas, activePersonaId, onSelect, onCreateNew, onEditPersona, isLoading, compact = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activePersona = personas.find(p => p.id === activePersonaId) || personas[0];

  // Check if wallet is unlocked (from session storage)
  const isUnlocked = activePersona ? !!sessionStorage.getItem(`wallet_session_${activePersona.id}`) : false;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getReputationStars = (bucket: number) => (
    <span className="flex items-center gap-0.5">
      {[...Array(Math.min(bucket, 5))].map((_, i) => (
        <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
      ))}
    </span>
  );

  const isAgent = (p: PersonaData) => {
    const name = (p.displayName || '').toLowerCase();
    return name.includes('aigent') || name.includes('agent');
  };

  const getIcon = (p?: PersonaData) => {
    if (!p) return <User className="w-4 h-4" />;
    return isAgent(p) ? <Bot className="w-4 h-4 text-purple-400" /> : <User className="w-4 h-4 text-cyan-400" />;
  };

  if (isLoading) {
    return <div className={`animate-pulse ${compact ? 'h-10' : 'h-14'} bg-white/5 rounded-lg`} />;
  }

  if (!activePersona && personas.length === 0) {
    return (
      <button onClick={onCreateNew} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30 rounded-lg text-white hover:from-purple-500/30 hover:to-cyan-500/30 transition-all">
        <Plus className="w-5 h-5" /><span>Create Persona</span>
      </button>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center gap-2 ${compact ? 'p-1' : 'w-full px-3 py-3'} bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors`}>
        <div className={`${compact ? 'w-7 h-7' : 'w-10 h-10'} rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 ring-1 ring-white/20 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden`}>
          {activePersona?.avatarUri ? <img src={activePersona.avatarUri} alt="" className="w-full h-full object-cover" /> : getIcon(activePersona)}
        </div>
        {!compact && (
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white truncate">{activePersona?.displayName || activePersona?.fioHandle || 'Select Persona'}</span>
              {isUnlocked ? <Unlock className="w-3 h-3 text-green-400" /> : <Lock className="w-3 h-3 text-slate-500" />}
            </div>
            {activePersona && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {getReputationStars(activePersona.reputationBucket)}
                <span>({activePersona.reputationScore})</span>
              </div>
            )}
          </div>
        )}
        <ChevronDown className={`${compact ? 'w-3.5 h-3.5' : 'w-5 h-5'} text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900/95 border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="max-h-64 overflow-y-auto">
            {personas.map(p => (
              <button key={p.id} onClick={() => { onSelect(p.id); setIsOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-white/5 transition-colors ${p.id === activePersonaId ? 'bg-purple-500/10' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 ring-1 ring-white/20 flex items-center justify-center text-white text-sm overflow-hidden">
                  {p.avatarUri ? <img src={p.avatarUri} alt="" className="w-full h-full object-cover" /> : getIcon(p)}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-white truncate">{p.displayName || p.fioHandle}</div>
                  <div className="flex items-center gap-1 text-xs text-white/60">
                    {getReputationStars(p.reputationBucket)}
                    <span>({p.reputationScore})</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {onEditPersona && (
                    <button onClick={(e) => { e.stopPropagation(); onEditPersona(p); setIsOpen(false); }} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white">
                      <Settings className="w-4 h-4" />
                    </button>
                  )}
                  {p.id === activePersonaId && <Check className="w-5 h-5 text-purple-400" />}
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-white/10" />
          <button onClick={() => { setIsOpen(false); onCreateNew?.(); }} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/5 transition-colors text-purple-400">
            <div className="w-8 h-8 rounded-full border-2 border-dashed border-purple-400/50 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <span className="font-medium">Create New Persona</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default PersonaSelector;
