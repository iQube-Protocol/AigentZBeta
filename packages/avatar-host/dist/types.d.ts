/**
 * @agentiq/avatar-host - Type Definitions
 * Global persistent metaAvatar interface for agent interactions
 */
export type AvatarPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
export type AvatarState = 'minimized' | 'expanded' | 'fullscreen' | 'hidden';
export interface AgentConfig {
    agentId: string;
    name: string;
    avatar?: string;
    systemPrompt?: string;
}
export interface AvatarMessage {
    type: 'agent-context' | 'user-message' | 'agent-response' | 'state-change' | 'action';
    payload: any;
    timestamp?: number;
}
export interface AvatarContext {
    franchiseId: string;
    tenantId: string;
    personaId?: string;
    currentPage?: string;
    contentContext?: {
        domainId?: string;
        articleId?: string;
        tags?: string[];
    };
}
export interface AvatarHostProps {
    /**
     * Position of the avatar interface
     * @default 'bottom-right'
     */
    position?: AvatarPosition;
    /**
     * Default agent to load
     * @default 'copilot'
     */
    defaultAgent?: string;
    /**
     * Enable persistent state across navigation
     * @default true
     */
    enablePersistence?: boolean;
    /**
     * Initial state of the avatar
     * @default 'minimized'
     */
    initialState?: AvatarState;
    /**
     * URL to the metaAvatar service iframe
     */
    iframeUrl?: string;
    /**
     * Global context for the avatar
     */
    context?: AvatarContext;
    /**
     * Callback when avatar state changes
     */
    onStateChange?: (state: AvatarState) => void;
    /**
     * Callback when messages are exchanged
     */
    onMessage?: (message: AvatarMessage) => void;
    /**
     * Custom z-index for the avatar container
     * @default 9999
     */
    zIndex?: number;
}
export interface AvatarContextValue {
    isOpen: boolean;
    state: AvatarState;
    currentAgent: string | null;
    toggle: () => void;
    open: () => void;
    close: () => void;
    minimize: () => void;
    expand: () => void;
    sendMessage: (message: string, context?: Record<string, any>) => void;
    setAgent: (agentId: string) => void;
    updateContext: (context: Partial<AvatarContext>) => void;
}
//# sourceMappingURL=types.d.ts.map