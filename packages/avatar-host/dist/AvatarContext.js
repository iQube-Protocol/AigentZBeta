import { jsx as _jsx } from "react/jsx-runtime";
/**
 * @agentiq/avatar-host - Avatar Context
 * Global context provider for metaAvatar state management
 */
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
const AvatarContext = createContext(null);
export function AvatarProvider({ children, initialState = 'minimized', context: initialContext, enablePersistence = true, }) {
    const [state, setState] = useState(initialState);
    const [currentAgent, setCurrentAgent] = useState('copilot');
    const [context, setContext] = useState(initialContext);
    const iframeRef = useRef(null);
    // Load persisted state from localStorage
    useEffect(() => {
        if (enablePersistence) {
            const saved = localStorage.getItem('avatar-state');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.state)
                        setState(parsed.state);
                    if (parsed.agent)
                        setCurrentAgent(parsed.agent);
                }
                catch (e) {
                    console.warn('[AvatarHost] Failed to restore state:', e);
                }
            }
        }
    }, [enablePersistence]);
    // Persist state to localStorage
    useEffect(() => {
        if (enablePersistence) {
            localStorage.setItem('avatar-state', JSON.stringify({
                state,
                agent: currentAgent,
            }));
        }
    }, [state, currentAgent, enablePersistence]);
    const isOpen = state === 'expanded' || state === 'fullscreen';
    const toggle = useCallback(() => {
        setState(prev => prev === 'minimized' ? 'expanded' : 'minimized');
    }, []);
    const open = useCallback(() => {
        setState('expanded');
    }, []);
    const close = useCallback(() => {
        setState('minimized');
    }, []);
    const minimize = useCallback(() => {
        setState('minimized');
    }, []);
    const expand = useCallback(() => {
        setState('expanded');
    }, []);
    const sendMessage = useCallback((message, messageContext) => {
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'user-message',
                payload: {
                    message,
                    context: { ...context, ...messageContext },
                    agent: currentAgent,
                },
                timestamp: Date.now(),
            }, '*');
        }
    }, [context, currentAgent]);
    const setAgent = useCallback((agentId) => {
        setCurrentAgent(agentId);
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'agent-change',
                payload: { agentId },
                timestamp: Date.now(),
            }, '*');
        }
    }, []);
    const updateContext = useCallback((newContext) => {
        setContext(prev => ({ ...prev, ...newContext }));
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'context-update',
                payload: newContext,
                timestamp: Date.now(),
            }, '*');
        }
    }, []);
    const value = {
        isOpen,
        state,
        currentAgent,
        toggle,
        open,
        close,
        minimize,
        expand,
        sendMessage,
        setAgent,
        updateContext,
    };
    return (_jsx(AvatarContext.Provider, { value: value, children: children }));
}
/**
 * Hook to access avatar context
 */
export function useAvatar() {
    const context = useContext(AvatarContext);
    if (!context) {
        throw new Error('useAvatar must be used within an AvatarProvider');
    }
    return context;
}
/**
 * Hook to register iframe ref with the provider
 * Internal use only
 */
export function useAvatarIframeRef() {
    const context = useContext(AvatarContext);
    return useCallback((ref) => {
        if (context) {
            // Store ref for postMessage communication
            context.iframeRef = ref;
        }
    }, [context]);
}
