/**
 * @agentiq/avatar-host - Avatar Context
 * Global context provider for metaAvatar state management
 */
import type { AvatarContextValue, AvatarState, AvatarContext as AvatarContextData } from './types';
export interface AvatarProviderProps {
    children: React.ReactNode;
    initialState?: AvatarState;
    context?: AvatarContextData;
    enablePersistence?: boolean;
}
export declare function AvatarProvider({ children, initialState, context: initialContext, enablePersistence, }: AvatarProviderProps): import("react/jsx-runtime").JSX.Element;
/**
 * Hook to access avatar context
 */
export declare function useAvatar(): AvatarContextValue;
/**
 * Hook to register iframe ref with the provider
 * Internal use only
 */
export declare function useAvatarIframeRef(): (ref: HTMLIFrameElement | null) => void;
//# sourceMappingURL=AvatarContext.d.ts.map