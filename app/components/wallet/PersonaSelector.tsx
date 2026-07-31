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
  EyeOff,
  Eye,
  Trash2,
  Loader2,
  RotateCcw,
  Copy,
} from 'lucide-react';
import { PersonaQube } from '@/types/persona';
import { PersonaState } from '@/types/smartWallet';
import {
  setActivePersona,
  getPersonasByAuthProfile,
} from '@/services/wallet/personaService';
import { isWalletUnlocked } from '@/services/wallet/sessionService';
import { usePersonaSafe } from '@/app/contexts/PersonaContext';

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
  /** Show archive/delete action buttons per persona */
  allowManage?: boolean;
  /**
   * When provided, the selector shows a "Set as default for this cartridge"
   * option in the footer.  cartridgeSlug matches the codexId (e.g. 'knyt-codex').
   */
  cartridgeSlug?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { getSupabaseBrowserClient } = await import('@/utils/supabaseBrowser');
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    if (data.session?.access_token) return { Authorization: `Bearer ${data.session.access_token}` };
  } catch { /* ignore */ }
  return {};
}

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
  allowManage = false,
  cartridgeSlug,
}: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<PersonaData[]>(preloadedPersonas || []);
  const [activePersona, setActivePersonaState] = useState<PersonaData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(externalLoading ?? !preloadedPersonas);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { getCartridgeDefault, setCartridgeDefault, registerPersonaNames, activePersonaId: contextPersonaId } = usePersonaSafe();

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
  const fetchPersonas = React.useCallback(async (includeArchived = false) => {
    if (!authProfileId || preloadedPersonas) return;
    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const url = `/api/wallet/persona${includeArchived ? '?includeArchived=true' : ''}`;
      const res = await fetch(url, { headers });
      const json = await res.json() as { personas?: PersonaData[]; ok?: boolean };
      const loaded: PersonaData[] = json.personas ?? [];
      setPersonas(loaded);
      // Populate the global persona name registry so banners can display names
      registerPersonaNames(
        loaded.map((p) => ({
          id: p.id,
          displayName: (p as Record<string, unknown>).displayName as string | undefined,
          fioHandle: (p as Record<string, unknown>).fioHandle as string | undefined,
        }))
      );
      const activeId = preloadedActiveId || contextPersonaId;
      if (activeId) {
        const active = loaded.find(p => p.id === activeId);
        if (active) {
          setActivePersonaState(active);
        } else if (loaded.length > 0) {
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
  }, [authProfileId, preloadedPersonas, preloadedActiveId]);

  useEffect(() => {
    fetchPersonas(showArchived);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authProfileId, preloadedPersonas, preloadedActiveId]);

  // Archive (inactive) or restore (active) a persona
  const handleArchive = React.useCallback(async (personaId: string, archive: boolean) => {
    setActionPending(personaId);
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/wallet/persona/${personaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ status: archive ? 'inactive' : 'active' }),
      });
      // Update local state immediately; refetch for server truth
      setPersonas(prev => {
        const updated = prev.map(p =>
          p.id === personaId ? { ...p, status: archive ? 'inactive' : 'active' } as PersonaData : p
        );
        // If not showing archived, filter out newly archived ones
        return showArchived ? updated : updated.filter(p => (p as Record<string,unknown>).status !== 'inactive');
      });
    } catch { /* non-fatal */ }
    finally { setActionPending(null); }
  }, [showArchived]);

  // Soft-delete a persona
  const handleDelete = React.useCallback(async (personaId: string) => {
    setActionPending(personaId);
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/wallet/persona/${personaId}`, { method: 'DELETE', headers });
      setPersonas(prev => prev.filter(p => p.id !== personaId));
      if (activePersona?.id === personaId) setActivePersonaState(null);
      setConfirmDeleteId(null);
    } catch { /* non-fatal */ }
    finally { setActionPending(null); }
  }, [activePersona]);

  // Toggle archived visibility
  const handleToggleArchived = React.useCallback(() => {
    const next = !showArchived;
    setShowArchived(next);
    fetchPersonas(next);
  }, [showArchived, fetchPersonas]);

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
            {personas.map((persona) => {
              const isArchived = (persona as Record<string,unknown>).status === 'inactive';
              const isConfirming = confirmDeleteId === persona.id;
              const isPending = actionPending === persona.id;
              return (
                <div
                  key={persona.id}
                  className={`group flex items-center gap-2 px-3 py-2.5 transition-colors ${
                    persona.id === activePersona?.id ? 'bg-purple-500/10' : 'hover:bg-white/5'
                  } ${isArchived ? 'opacity-50' : ''}`}
                >
                  {/* Selectable area */}
                  <button
                    onClick={() => !isArchived && handleSelect(persona)}
                    disabled={isArchived}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 ring-1 ring-white/20 flex items-center justify-center text-white text-sm shrink-0">
                      {getDomainIcon(persona)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate text-sm">
                        {getDisplayName(persona)}
                        {isArchived && <span className="ml-1.5 text-[10px] text-white/40">(archived)</span>}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-white/60">
                        {getReputationStars(persona.reputationBucket)}
                        <span>({persona.reputationScore})</span>
                      </div>
                    </div>
                  </button>

                  {/* Active check or manage buttons */}
                  {!allowManage && persona.id === activePersona?.id && (
                    <Check className="w-4 h-4 text-purple-400 shrink-0" />
                  )}
                  {/* Copy UUID — always visible on hover, even without allowManage */}
                  {!allowManage && (
                    <button
                      title={`Copy persona ID: ${persona.id}`}
                      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(persona.id); }}
                      className="p-1 rounded hover:bg-white/10 text-white/0 group-hover:text-white/40 hover:!text-cyan-400 transition-colors shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                  {allowManage && !isConfirming && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {isPending
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white/40" />
                        : (
                          <>
                            <button
                              title={`Copy persona ID: ${persona.id}`}
                              onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(persona.id); }}
                              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-cyan-400 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title={isArchived ? 'Restore' : 'Archive'}
                              onClick={() => handleArchive(persona.id, !isArchived)}
                              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-amber-400 transition-colors"
                            >
                              {isArchived
                                ? <RotateCcw className="w-3.5 h-3.5" />
                                : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              title="Delete"
                              onClick={() => setConfirmDeleteId(persona.id)}
                              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )
                      }
                    </div>
                  )}
                  {allowManage && isConfirming && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-red-400">Delete?</span>
                      <button
                        onClick={() => handleDelete(persona.id)}
                        disabled={isPending}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 hover:bg-red-500/40 transition-colors disabled:opacity-50"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-1.5 py-0.5 rounded text-[10px] text-white/40 hover:text-white/70 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Archived toggle — only shown when manage mode is on */}
          {allowManage && (
            <button
              onClick={handleToggleArchived}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors border-t border-white/5"
            >
              {showArchived
                ? <Eye className="w-3.5 h-3.5" />
                : <EyeOff className="w-3.5 h-3.5" />}
              {showArchived ? 'Hide archived personas' : 'Show archived personas'}
            </button>
          )}

          {/* Set as default for cartridge — shown when inside a cartridge context */}
          {cartridgeSlug && activePersona && (() => {
            const isCurrentDefault = getCartridgeDefault(cartridgeSlug) === activePersona.id;
            return (
              <button
                onClick={async () => {
                  if (!isCurrentDefault) {
                    await setCartridgeDefault(cartridgeSlug, activePersona.id);
                  }
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors border-t border-white/5 ${
                  isCurrentDefault
                    ? 'text-indigo-300/50 cursor-default'
                    : 'text-indigo-300 hover:text-indigo-200 hover:bg-white/5'
                }`}
                disabled={isCurrentDefault}
              >
                <Star className="w-3.5 h-3.5 shrink-0" />
                {isCurrentDefault
                  ? 'Default persona for this cartridge'
                  : 'Set as default for this cartridge'}
              </button>
            );
          })()}

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
