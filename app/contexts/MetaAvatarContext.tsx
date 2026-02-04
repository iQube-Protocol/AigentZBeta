/**
 * MetaAvatarContext - Global State for Persistent MetaAvatar
 * 
 * Ported from Netlify app for AgentiQ integration
 * 
 * This context manages a singleton MetaAvatar that persists across navigation.
 * Instead of mounting/unmounting the avatar, we use CSS positioning to move it
 * between different container locations.
 * 
 * Container Types (Generic):
 * - 'immersive': Full drawer/screen size (e.g., AigentDrawer)
 * - 'sidebar': Compact sidebar placement (1/3 width, ~400px height)
 * - 'copilot': Wallet copilot modal size
 * - 'codexCopilot': Codex copilot drawer avatar area
 * - 'mini': Small floating pip (120x120)
 * - null: Hidden (avatar stays loaded but invisible)
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Generic container types that can be used across the estate
export type MetaAvatarContainer = 
  | 'immersive'     // Full drawer size (AigentDrawer, full-screen experiences)
  | 'sidebar'       // Sidebar placement (PennyDrops, article sidebars)
  | 'copilot'       // Wallet copilot modal
  | 'codexCopilot'  // Codex copilot drawer avatar area
  | 'mini'          // Floating pip mode
  | null;           // Hidden

export interface MetaAvatarContextType {
  /** Has the avatar been initialized (lazy loading) */
  avatarInitialized: boolean;
  
  /** Current container owning the avatar */
  activeContainer: MetaAvatarContainer;
  
  /** Current agent ID being displayed */
  activeAgent: string;
  
  /** Request avatar ownership for a container */
  requestAvatar: (container: MetaAvatarContainer, agentId?: string) => void;
  
  /** Release avatar ownership (with safety check) */
  releaseAvatar: (container?: MetaAvatarContainer) => void;
  
  /** Key to force avatar refresh/remount */
  avatarRefreshKey: number;
  
  /** Trigger avatar refresh */
  refreshAvatar: () => void;
  
  /** Set the active agent */
  setAgent: (agentId: string) => void;
}

const MetaAvatarContext = createContext<MetaAvatarContextType | null>(null);

interface MetaAvatarProviderProps {
  children: ReactNode;
  defaultAgent?: string;
}

export function MetaAvatarProvider({ 
  children, 
  defaultAgent = 'aigent-z' 
}: MetaAvatarProviderProps) {
  const [avatarInitialized, setAvatarInitialized] = useState(false);
  const [activeContainer, setActiveContainer] = useState<MetaAvatarContainer>(null);
  const [activeAgent, setActiveAgent] = useState(defaultAgent);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);

  const requestAvatar = useCallback((container: MetaAvatarContainer, agentId?: string) => {
    console.log(`[MetaAvatar] requestAvatar: ${container}, agent: ${agentId || activeAgent}`);
    
    // Initialize on first request (lazy loading)
    if (!avatarInitialized) {
      setAvatarInitialized(true);
    }
    
    setActiveContainer(container);
    
    if (agentId) {
      setActiveAgent(agentId);
    }
  }, [avatarInitialized, activeAgent]);

  const releaseAvatar = useCallback((container?: MetaAvatarContainer) => {
    setActiveContainer(current => {
      // CRITICAL: Only release if the requesting container is the current owner
      // This prevents race conditions where Drawer A closes but Drawer B already took ownership
      if (container && current !== container) {
        console.log(`[MetaAvatar] ${container} tried to release, but ${current} is active - ignoring`);
        return current; // Don't change anything
      }
      
      console.log(`[MetaAvatar] releaseAvatar: ${container || 'any'} releasing from ${current}`);
      return null;
    });
  }, []);

  const refreshAvatar = useCallback(() => {
    console.log('[MetaAvatar] refreshAvatar triggered');
    setAvatarRefreshKey(prev => prev + 1);
    
    // Dispatch event for MetaAvatar component to handle
    window.dispatchEvent(new CustomEvent('metaAvatarRefresh'));
  }, []);

  const setAgent = useCallback((agentId: string) => {
    console.log(`[MetaAvatar] setAgent: ${agentId}`);
    setActiveAgent(agentId);
  }, []);

  const value: MetaAvatarContextType = {
    avatarInitialized,
    activeContainer,
    activeAgent,
    requestAvatar,
    releaseAvatar,
    avatarRefreshKey,
    refreshAvatar,
    setAgent,
  };

  return (
    <MetaAvatarContext.Provider value={value}>
      {children}
    </MetaAvatarContext.Provider>
  );
}

/**
 * Hook to access MetaAvatar context
 */
export function useMetaAvatar(): MetaAvatarContextType {
  const context = useContext(MetaAvatarContext);
  if (!context) {
    throw new Error('useMetaAvatar must be used within a MetaAvatarProvider');
  }
  return context;
}

/**
 * Hook for components that only need to check if avatar is active
 * (lighter weight, doesn't need full context)
 */
export function useMetaAvatarStatus() {
  const context = useContext(MetaAvatarContext);
  return {
    isActive: context?.activeContainer !== null,
    container: context?.activeContainer,
    agent: context?.activeAgent,
  };
}
