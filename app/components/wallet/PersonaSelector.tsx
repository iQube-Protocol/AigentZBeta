"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronDown, 
  Plus, 
  User, 
  Star, 
  Check,
  Lock,
  Unlock,
  Bot,
  Settings,
} from 'lucide-react';
import { PersonaQube } from '@/types/persona';
import { PersonaState } from '@/types/smartWallet';
import { 
  getActivePersonaId, 
  setActivePersona,
  getPersonasByAuthProfile,
} from '@/services/wallet/personaService';
import { isWalletUnlocked } from '@/services/wallet/sessionService';

// =============================================================================
// TYPES
// =============================================================================

/** Union type for persona data - accepts either PersonaQube or PersonaState */
type PersonaData = PersonaQube | PersonaState;

interface PersonaSelectorProps {
  /** Auth profile ID - if provided, personas will be fetched */
  authProfileId?: string;
  /** Pre-loaded personas - if provided, these will be used instead of fetching */
  personas?: PersonaData[];
  /** Currently active persona ID */
  activePersonaId?: string;
  /** Callback when persona is selected */
  onPersonaChange?: (persona: PersonaData) => void;
  /** Callback when persona ID is selected (simpler) */
  onSelect?: (personaId: string) => void;
  /** Callback to create new persona */
  onCreateNew?: () => void;
  /** Quick add persona (lightweight flow) */
  onQuickAdd?: () => void;
  /** Edit currently active persona */
  onEditActive?: () => void;
  /** Compact mode for smaller spaces */
  compact?: boolean;
  /** Loading state override */
  isLoading?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PersonaSelector({
  authProfileId,
  personas: preloadedPersonas,
  activePersonaId: preloadedActiveId,
  onPersonaChange,
  onSelect,
  onCreateNew,
  onQuickAdd,
  onEditActive,
  compact = false,
  isLoading: externalLoading,
}: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<PersonaData[]>(preloadedPersonas || []);
  const [activePersona, setActivePersonaState] = useState<PersonaData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(externalLoading ?? !preloadedPersonas);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Use preloaded personas if provided
  useEffect(() => {
    if (preloadedPersonas) {
      setPersonas(preloadedPersonas);
      setIsLoading(false);
      
      // Set active persona from preloaded
      if (preloadedActiveId) {
        const active = preloadedPersonas.find(p => p.id === preloadedActiveId);
        if (active) {
          setActivePersonaState(active);
        }
      } else if (preloadedPersonas.length > 0) {
        setActivePersonaState(preloadedPersonas[0]);
      }
    }
  }, [preloadedPersonas, preloadedActiveId]);

  // Load personas from API if authProfileId provided and no preloaded personas
  useEffect(() => {
    if (!authProfileId || preloadedPersonas) return;
    
    async function loadPersonas() {
      setIsLoading(true);
      try {
        const loaded = await getPersonasByAuthProfile(authProfileId!);
        setPersonas(loaded);
        
        // Set active persona
        const activeId = preloadedActiveId || getActivePersonaId();
        if (activeId) {
          const active = loaded.find(p => p.id === activeId);
          if (active) {
            setActivePersonaState(active);
          } else if (loaded.length > 0) {
            // Default to first persona
            setActivePersonaState(loaded[0]);
            setActivePersona(loaded[0].id);
          }
        } else if (loaded.length > 0) {
          setActivePersonaState(loaded[0]);
          setActivePersona(loaded[0].id);
        }
      } catch (error) {
        console.error('Failed to load personas:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadPersonas();
  }, [authProfileId, preloadedPersonas, preloadedActiveId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle persona selection
  const handleSelect = async (persona: PersonaData) => {
    setActivePersonaState(persona);
    await setActivePersona(persona.id);
    setIsOpen(false);
    onPersonaChange?.(persona);
    onSelect?.(persona.id);
  };

  // Get reputation stars as Lucide Star components
  const getReputationStars = (bucket: number) => {
    const count = Math.min(bucket, 5);
    return (
      <span className="flex items-center gap-0.5">
        {[...Array(count)].map((_, i) => (
          <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
        ))}
      </span>
    );
  };

  // Check if persona is an agent (has 'aigent' in name or domain)
  const isAgentPersona = (persona: PersonaData): boolean => {
    const name = getDisplayName(persona).toLowerCase();
    const domain = getDomain(persona)?.toLowerCase() || '';
    return name.includes('aigent') || domain.includes('aigent') || name.includes('agent');
  };

  // Get domain icon - use Bot for agents, User for humans
  const getDomainIcon = (persona?: PersonaData) => {
    if (!persona) return <User className="w-4 h-4" />;
    if (isAgentPersona(persona)) {
      return <Bot className="w-4 h-4 text-purple-400" />;
    }
    return <User className="w-4 h-4 text-cyan-400" />;
  };
  
  // Helper to get display name from persona (works with both PersonaQube and PersonaState)
  const getDisplayName = (persona: PersonaData): string => {
    if ('fioHandle' in persona && persona.fioHandle) return persona.fioHandle;
    if ('displayName' in persona) return persona.displayName;
    return 'Unknown';
  };
  
  // Helper to get domain from persona
  const getDomain = (persona: PersonaData): string | undefined => {
    if ('fioDomain' in persona) return persona.fioDomain;
    // Try to extract from fioHandle if available
    if ('fioHandle' in persona && persona.fioHandle) {
      const parts = persona.fioHandle.split('@');
      return parts.length > 1 ? parts[1] : undefined;
    }
    return undefined;
  };
  
  // Helper to get avatar URI
  const getAvatarUri = (persona: PersonaData): string | undefined => {
    if ('avatarUri' in persona) return persona.avatarUri;
    return undefined;
  };

  // Check if wallet is unlocked for active persona
  const isUnlocked = activePersona ? isWalletUnlocked(activePersona.id) : false;

  if (isLoading) {
    return (
      <div className={`animate-pulse ${compact ? 'h-10' : 'h-14'} bg-white/5 rounded-lg`} />
    );
  }

  if (!activePersona && personas.length === 0) {
    // No personas - show create button
    return (
      <div className="flex flex-col gap-2">
        {onQuickAdd && (
          <button
            onClick={onQuickAdd}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-lg text-white hover:from-emerald-500/30 hover:to-cyan-500/30 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>Quick Add Persona</span>
          </button>
        )}
        {onCreateNew && (
          <button
            onClick={onCreateNew}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30 rounded-lg text-white hover:from-purple-500/30 hover:to-cyan-500/30 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>Create with Wizard</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button - compact mode shows only avatar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 ${compact ? 'p-1' : 'w-full px-3 py-3'} bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors`}
      >
        {/* Avatar / Icon */}
        <div className={`${compact ? 'w-7 h-7' : 'w-10 h-10'} rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 ring-1 ring-white/20 flex items-center justify-center text-white font-bold flex-shrink-0`}>
          {activePersona && getAvatarUri(activePersona) ? (
            <img src={getAvatarUri(activePersona)} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            getDomainIcon(activePersona ?? undefined)
          )}
        </div>
        
        {/* Info - hidden in compact mode */}
        {!compact && (
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white truncate">
                {activePersona ? getDisplayName(activePersona) : 'Select Persona'}
              </span>
              {isUnlocked ? (
                <Unlock className="w-3 h-3 text-green-400" />
              ) : (
                <Lock className="w-3 h-3 text-slate-500" />
              )}
            </div>
            {activePersona && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{getReputationStars(activePersona.reputationBucket)}</span>
                <span>({activePersona.reputationScore})</span>
              </div>
            )}
          </div>
        )}
        
        {/* Chevron - smaller in compact mode */}
        <ChevronDown className={`${compact ? 'w-3.5 h-3.5' : 'w-5 h-5'} text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Dropdown - narrower width */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-slate-900/95 border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {/* Persona list */}
          <div className="max-h-64 overflow-y-auto">
            {personas.map((persona) => (
              <button
                key={persona.id}
                onClick={() => handleSelect(persona)}
                className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-white/5 transition-colors ${
                  persona.id === activePersona?.id ? 'bg-purple-500/10' : ''
                }`}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 ring-1 ring-white/20 flex items-center justify-center text-white text-sm">
                  {getDomainIcon(persona)}
                </div>
                
                {/* Info */}
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-white truncate">{getDisplayName(persona)}</div>
                  <div className="flex items-center gap-1 text-xs text-white/60">
                    {getReputationStars(persona.reputationBucket)}
                    <span>({persona.reputationScore})</span>
                  </div>
                </div>
                
                {/* Check mark */}
                {persona.id === activePersona?.id && (
                  <Check className="w-5 h-5 text-purple-400" />
                )}
              </button>
            ))}
          </div>
          
          {/* Divider */}
          <div className="border-t border-white/10" />

          {onEditActive && activePersona && (
            <button
              onClick={() => {
                setIsOpen(false);
                onEditActive();
              }}
              className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/5 transition-colors text-cyan-400"
            >
              <div className="w-8 h-8 rounded-full border border-cyan-400/40 flex items-center justify-center">
                <Settings className="w-4 h-4" />
              </div>
              <span className="font-medium">Edit Persona</span>
            </button>
          )}

          {onQuickAdd && (
            <button
              onClick={() => {
                setIsOpen(false);
                onQuickAdd();
              }}
              className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/5 transition-colors text-emerald-400"
            >
              <div className="w-8 h-8 rounded-full border border-emerald-400/40 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <span className="font-medium">Quick Add Persona</span>
            </button>
          )}
          
          {/* Create new */}
          {onCreateNew && (
            <button
              onClick={() => {
                setIsOpen(false);
                onCreateNew?.();
              }}
              className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/5 transition-colors text-purple-400"
            >
              <div className="w-8 h-8 rounded-full border-2 border-dashed border-purple-400/50 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <span className="font-medium">Create with Wizard</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default PersonaSelector;
