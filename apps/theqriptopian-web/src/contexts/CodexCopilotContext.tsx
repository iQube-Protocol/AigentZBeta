/**
 * CodexCopilotContext - State management for the Codex Copilot system
 * 
 * Manages:
 * - Active codex context (KNYT vs Qriptopian)
 * - Copilot layer visibility and mode (chat vs metaVatar)
 * - Drawer width (narrow vs wide)
 * - Active persona/avatar (Kn0w1 for KNYT, MoneyPenny for Qriptopian)
 * - Content instructions for main layer
 * - MetaAvatar coordination with global state
 */

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useMetaAvatar } from './MetaAvatarContext';

export type CodexType = 'knyt' | 'qriptopian';
export type CopilotMode = 'chat' | 'metavatar';
export type CopilotWidth = 'narrow' | 'wide';

// Content instruction types for the main layer
export interface ContentInstruction {
  type: 'grid' | 'detail' | 'reader' | 'player' | 'welcome' | 'custom';
  contentId?: string;
  episodeNumber?: number;
  data?: Record<string, unknown>;
}

export interface CodexCopilotContextType {
  // Codex context
  activeCodex: CodexType;
  setActiveCodex: (codex: CodexType) => void;
  
  // Copilot layer state
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
  copilotMode: CopilotMode;
  setCopilotMode: (mode: CopilotMode) => void;
  copilotWidth: CopilotWidth;
  
  // Active persona based on codex
  activePersona: 'kn0w1' | 'moneypenny';
  
  // Main content layer instructions
  contentInstruction: ContentInstruction;
  setContentInstruction: (instruction: ContentInstruction) => void;
  
  // User context for personalization
  isFirstVisit: boolean;
  setIsFirstVisit: (value: boolean) => void;
  
  // Chat messages
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  addChatMessage: (role: 'user' | 'assistant', content: string) => void;
  clearChatMessages: () => void;
}

const CodexCopilotContext = createContext<CodexCopilotContextType | null>(null);

interface CodexCopilotProviderProps {
  children: ReactNode;
  defaultCodex?: CodexType;
}

export function CodexCopilotProvider({ 
  children, 
  defaultCodex = 'knyt' 
}: CodexCopilotProviderProps) {
  const [activeCodex, setActiveCodexState] = useState<CodexType>(defaultCodex);
  const [copilotOpen, setCopilotOpenState] = useState(false);
  const [copilotMode, setCopilotModeState] = useState<CopilotMode>('chat');
  const [contentInstruction, setContentInstruction] = useState<ContentInstruction>({ type: 'welcome' });
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  
  // MetaAvatar context for coordinating avatar switches
  const { requestAvatar, releaseAvatar, setAgent } = useMetaAvatar();
  
  // Derive persona from active codex
  const activePersona = activeCodex === 'knyt' ? 'kn0w1' : 'moneypenny';
  
  // Derive width from mode
  const copilotWidth: CopilotWidth = copilotMode === 'metavatar' ? 'wide' : 'narrow';
  
  // Handle codex change - also updates avatar persona
  const setActiveCodex = useCallback((codex: CodexType) => {
    console.log(`[CodexCopilot] Switching to ${codex} codex`);
    setActiveCodexState(codex);
    
    // Update avatar persona if in metaVatar mode
    if (copilotOpen && copilotMode === 'metavatar') {
      const newPersona = codex === 'knyt' ? 'kn0w1' : 'moneypenny';
      setAgent(newPersona);
    }
    
    // Reset chat for new context
    setChatMessages([{
      role: 'assistant',
      content: codex === 'knyt' 
        ? "Welcome to the KNYT Codex! I'm Kn0w1, your guide to the metaKnyts universe. How can I help you explore?"
        : "Welcome to the Qriptopian Codex! I'm MoneyPenny, here to help you navigate the Quantum-Ready Internet. What would you like to discover?"
    }]);
  }, [copilotOpen, copilotMode, setAgent]);
  
  // Handle copilot open/close
  const setCopilotOpen = useCallback((open: boolean) => {
    console.log(`[CodexCopilot] Copilot ${open ? 'opening' : 'closing'}`);
    setCopilotOpenState(open);
    
    if (!open) {
      // Release avatar when closing
      releaseAvatar('copilot');
    } else if (copilotMode === 'metavatar') {
      // Request avatar when opening in metaVatar mode
      requestAvatar('copilot', activePersona);
    }
  }, [copilotMode, activePersona, requestAvatar, releaseAvatar]);
  
  // Handle mode change
  const setCopilotMode = useCallback((mode: CopilotMode) => {
    console.log(`[CodexCopilot] Mode changing to ${mode}`);
    setCopilotModeState(mode);
    
    if (copilotOpen) {
      if (mode === 'metavatar') {
        requestAvatar('copilot', activePersona);
      } else {
        releaseAvatar('copilot');
      }
    }
  }, [copilotOpen, activePersona, requestAvatar, releaseAvatar]);
  
  // Chat message management
  const addChatMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setChatMessages(prev => [...prev, { role, content }]);
  }, []);
  
  const clearChatMessages = useCallback(() => {
    setChatMessages([{
      role: 'assistant',
      content: activeCodex === 'knyt' 
        ? "Welcome to the KNYT Codex! I'm Kn0w1, your guide to the metaKnyts universe. How can I help you explore?"
        : "Welcome to the Qriptopian Codex! I'm MoneyPenny, here to help you navigate the Quantum-Ready Internet. What would you like to discover?"
    }]);
  }, [activeCodex]);
  
  // Initialize chat on first render
  useEffect(() => {
    if (chatMessages.length === 0) {
      clearChatMessages();
    }
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseAvatar('copilot');
    };
  }, [releaseAvatar]);
  
  const value: CodexCopilotContextType = {
    activeCodex,
    setActiveCodex,
    copilotOpen,
    setCopilotOpen,
    copilotMode,
    setCopilotMode,
    copilotWidth,
    activePersona,
    contentInstruction,
    setContentInstruction,
    isFirstVisit,
    setIsFirstVisit,
    chatMessages,
    addChatMessage,
    clearChatMessages,
  };
  
  return (
    <CodexCopilotContext.Provider value={value}>
      {children}
    </CodexCopilotContext.Provider>
  );
}

/**
 * Hook to access Codex Copilot context
 */
export function useCodexCopilot(): CodexCopilotContextType {
  const context = useContext(CodexCopilotContext);
  if (!context) {
    throw new Error('useCodexCopilot must be used within a CodexCopilotProvider');
  }
  return context;
}
