import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * @agentiq/avatar-host - AvatarHost Component
 * Persistent metaAvatar iframe container with global state
 */
import { useState, useEffect, useCallback } from 'react';
import { useAvatar } from './AvatarContext';
const DEFAULT_IFRAME_URL = 'https://metavatar.agentiq.ai/metaVatar.html';
export function AvatarHost({ position = 'bottom-right', defaultAgent = 'copilot', enablePersistence = true, initialState = 'minimized', iframeUrl = DEFAULT_IFRAME_URL, context, onStateChange, onMessage, zIndex = 9999, }) {
    const avatar = useAvatar();
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(initialState === 'expanded' || initialState === 'fullscreen');
    // Sync internal expanded state with context
    useEffect(() => {
        setIsExpanded(avatar.state === 'expanded' || avatar.state === 'fullscreen');
    }, [avatar.state]);
    // Notify parent of state changes
    useEffect(() => {
        onStateChange?.(avatar.state);
    }, [avatar.state, onStateChange]);
    // Update context when it changes
    useEffect(() => {
        if (context) {
            avatar.updateContext(context);
        }
    }, [context, avatar]);
    // Handle iframe load
    const handleIframeLoad = useCallback(() => {
        setIsLoading(false);
        // Send initial context to iframe
        if (context) {
            avatar.updateContext(context);
        }
        // Set default agent
        if (defaultAgent) {
            avatar.setAgent(defaultAgent);
        }
    }, [context, defaultAgent, avatar]);
    // Handle messages from iframe
    useEffect(() => {
        const handleMessage = (event) => {
            // Security: Validate origin in production
            const message = event.data;
            if (!message.type)
                return;
            // Handle state changes from iframe
            if (message.type === 'state-change') {
                if (message.payload.state === 'minimize') {
                    avatar.minimize();
                }
                else if (message.payload.state === 'expand') {
                    avatar.expand();
                }
                else if (message.payload.state === 'close') {
                    avatar.close();
                }
            }
            // Forward to parent
            onMessage?.(message);
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [avatar, onMessage]);
    // Position classes
    const positionClasses = {
        'bottom-right': 'bottom-4 right-4',
        'bottom-left': 'bottom-4 left-4',
        'top-right': 'top-4 right-4',
        'top-left': 'top-4 left-4',
    };
    // Size based on state
    const sizeClasses = isExpanded
        ? 'w-[400px] h-[600px] md:w-[500px] md:h-[700px]'
        : 'w-16 h-16';
    return (_jsxs("div", { className: `fixed ${positionClasses[position]} ${sizeClasses} transition-all duration-300 ease-in-out`, style: { zIndex }, children: [isLoading && isExpanded && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg", children: _jsxs("div", { className: "flex flex-col items-center gap-2", children: [_jsx("div", { className: "w-8 h-8 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Loading metaAvatar..." })] }) })), _jsx("iframe", { src: iframeUrl, className: `w-full h-full rounded-lg border border-border/30 shadow-2xl transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`, style: {
                    backgroundColor: 'transparent',
                }, allow: "microphone; camera; clipboard-read; clipboard-write", sandbox: "allow-scripts allow-same-origin allow-forms allow-popups allow-modals", title: "metaAvatar Agent Interface", onLoad: handleIframeLoad }), !isExpanded && (_jsx("button", { onClick: avatar.toggle, className: "absolute inset-0 w-full h-full rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg hover:shadow-xl transition-all flex items-center justify-center group", "aria-label": "Open metaAvatar", children: _jsx("svg", { className: "w-8 h-8 text-white group-hover:scale-110 transition-transform", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" }) }) })), isExpanded && (_jsx("button", { onClick: avatar.minimize, className: "absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 hover:bg-background text-foreground hover:text-cyan-400 backdrop-blur-sm flex items-center justify-center transition-colors z-10", "aria-label": "Minimize metaAvatar", children: _jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) }) }))] }));
}
